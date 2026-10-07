import { readFile } from "node:fs/promises";
import path from "node:path";
import { mongoSource } from "./mongoSource.js";
import { SnapshotSchema, type Snapshot, type Stock } from "./stockSchema.js";

const DEFAULT_DATA_PATH = path.resolve(import.meta.dirname, "../../../data/stocks.json");

/** How long a loaded snapshot is reused before the source is read again. */
const STOCKS_TTL_MS = 10 * 60 * 1000;

/**
 * Where a snapshot comes from. Two implementations: the JSON file (below) and
 * MongoDB (mongoSource.ts). Nothing outside server/src/data knows which one
 * is in use; routes only ever see a Snapshot.
 */
export interface StockSource {
  /** Returns a zod-validated snapshot, or rejects. */
  load(): Promise<Snapshot>;
}

/** Reads and zod-validates a snapshot file. Exported separately from loadStocks() so tests can point it at a fixture. */
export async function readSnapshotFromFile(filePath: string): Promise<Snapshot> {
  const raw = await readFile(filePath, "utf-8");
  return SnapshotSchema.parse(JSON.parse(raw));
}

/** A StockSource backed by a snapshot file (data/stocks.json by default). */
export function jsonFileSource(filePath: string = DEFAULT_DATA_PATH): StockSource {
  return { load: () => readSnapshotFromFile(filePath) };
}

/**
 * Wraps a StockSource in a short-lived cache. Calls within `ttlMs` of the last
 * load share the same promise, so concurrent requests cause one read, not many.
 * After the TTL the source is read again, so a refreshed file is picked up
 * without restarting the server.
 *
 * If a reload fails (say the file is mid-rewrite), the last good snapshot keeps
 * being served until the next TTL. If there has never been a good snapshot,
 * the call rejects and the next call tries again straight away.
 */
export function createStockLoader(
  source: StockSource,
  ttlMs: number = STOCKS_TTL_MS,
  now: () => number = Date.now
): () => Promise<Snapshot> {
  let cache: { snapshot: Promise<Snapshot>; loadedAt: number } | null = null;
  let lastGood: Snapshot | null = null;

  return function load() {
    if (cache && now() - cache.loadedAt < ttlMs) return cache.snapshot;

    const snapshot: Promise<Snapshot> = source.load().then(
      (fresh) => {
        lastGood = fresh;
        return fresh;
      },
      (err: unknown) => {
        if (lastGood) return lastGood;
        if (cache?.snapshot === snapshot) cache = null;
        throw err;
      }
    );
    cache = { snapshot, loadedAt: now() };
    return snapshot;
  };
}

type DataSourceKind = "mongo" | "file";

/** Remembers which source produced each snapshot, for getDataStatus(). */
const servedFrom = new WeakMap<Snapshot, DataSourceKind>();

/**
 * Tries `primary` (Mongo) and, on any error, serves `fallback` (the JSON
 * file) instead. Logs only when it switches from primary to fallback, so one
 * outage is one log line, not one per reload.
 */
export function withFallback(
  primary: StockSource,
  fallback: StockSource,
  log: (message: string) => void = console.warn
): StockSource {
  let usingFallback = false;
  return {
    async load() {
      try {
        const snapshot = await primary.load();
        usingFallback = false;
        servedFrom.set(snapshot, "mongo");
        return snapshot;
      } catch (err) {
        if (!usingFallback) {
          const reason = err instanceof Error ? err.message : String(err);
          log(`MongoDB unavailable (${reason}), serving data/stocks.json instead`);
          usingFallback = true;
        }
        const snapshot = await fallback.load();
        servedFrom.set(snapshot, "file");
        return snapshot;
      }
    },
  };
}

/**
 * Picks the source on every load, so it follows the current env:
 * DEMO_MODE=true reads only the JSON file and never touches the network;
 * otherwise Mongo first, the JSON file if Mongo is unreachable or empty.
 */
export function defaultSource(
  mongo: StockSource = mongoSource(),
  file: StockSource = jsonFileSource()
): StockSource {
  const online = withFallback(mongo, file);
  return {
    async load() {
      if (process.env.DEMO_MODE === "true") {
        const snapshot = await file.load();
        servedFrom.set(snapshot, "file");
        return snapshot;
      }
      return online.load();
    },
  };
}

/** The app-wide loader every route uses, re-read at most every 10 minutes. */
export const loadStocks = createStockLoader(defaultSource());

/** Which source the current snapshot came from, and its asOf. For /api/health. */
export async function getDataStatus(
  load: () => Promise<Snapshot> = loadStocks
): Promise<{ dataSource: DataSourceKind; asOf: string }> {
  const snapshot = await load();
  return { dataSource: servedFrom.get(snapshot) ?? "file", asOf: snapshot.asOf };
}

export function findStock(snapshot: Snapshot, ticker: string): Stock | undefined {
  const needle = ticker.trim().toUpperCase();
  return snapshot.stocks.find((s) => s.ticker.toUpperCase() === needle);
}
