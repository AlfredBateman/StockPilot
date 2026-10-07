import { readFile } from "node:fs/promises";
import path from "node:path";
import { SnapshotSchema, type Snapshot, type Stock } from "./stockSchema.js";

const DEFAULT_DATA_PATH = path.resolve(import.meta.dirname, "../../../data/stocks.json");

/** How long a loaded snapshot is reused before the source is read again. */
export const STOCKS_TTL_MS = 10 * 60 * 1000;

/**
 * Where a snapshot comes from. Today the only implementation is the JSON file;
 * a database source would be a second implementation in this folder, and
 * nothing outside server/src/data would need to change.
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

/** The app-wide loader every route uses: data/stocks.json, re-read at most every 10 minutes. */
export const loadStocks = createStockLoader(jsonFileSource());

export function findStock(snapshot: Snapshot, ticker: string): Stock | undefined {
  const needle = ticker.trim().toUpperCase();
  return snapshot.stocks.find((s) => s.ticker.toUpperCase() === needle);
}
