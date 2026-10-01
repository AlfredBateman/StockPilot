import { readFile } from "node:fs/promises";
import path from "node:path";
import { SnapshotSchema, type Snapshot, type Stock } from "./stockSchema.js";

const DEFAULT_DATA_PATH = path.resolve(import.meta.dirname, "../../../data/stocks.json");

/** Reads and zod-validates a snapshot file. Exported separately from loadStocks() so tests can point it at a fixture. */
export async function readSnapshotFromFile(filePath: string): Promise<Snapshot> {
  const raw = await readFile(filePath, "utf-8");
  return SnapshotSchema.parse(JSON.parse(raw));
}

let cachedSnapshot: Promise<Snapshot> | null = null;

/**
 * Loads data/stocks.json once per server process and caches the validated
 * result; every later call reuses that same promise instead of re-reading
 * the file. If the file is missing or fails validation, the rejection is
 * cached too so callers see a clear, repeatable error rather than a crash.
 */
export function loadStocks(): Promise<Snapshot> {
  if (!cachedSnapshot) {
    cachedSnapshot = readSnapshotFromFile(DEFAULT_DATA_PATH);
  }
  return cachedSnapshot;
}

export function findStock(snapshot: Snapshot, ticker: string): Stock | undefined {
  const needle = ticker.trim().toUpperCase();
  return snapshot.stocks.find((s) => s.ticker.toUpperCase() === needle);
}
