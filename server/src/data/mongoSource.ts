// A second StockSource, backed by MongoDB. The daily ingest job
// (scripts/ingest.ts) writes here; the running server reads from here when
// it is not in DEMO_MODE, and falls back to data/stocks.json if Mongo is
// unreachable or empty (see loadStocks.ts).
//
// Layout: database "stockpilot", collection "stocks" with one document per
// ticker (_id = ticker), and collection "meta" with a single document
// (_id = "snapshot") holding asOf, source, count and the tickers that failed
// in the last ingest run.
//
// The connection string only ever comes from process.env.MONGODB_URI and is
// never logged or put in an error message.
import { MongoClient, type AnyBulkWriteOperation, type Db } from "mongodb";
import type { StockSource } from "./loadStocks.js";
import { SnapshotSchema, type Snapshot, type Stock } from "./stockSchema.js";
import { TICKERS } from "./tickers.js";
import type { FailedTicker } from "./yahooFetch.js";

export const DB_NAME = "stockpilot";
export const STOCKS_COLLECTION = "stocks";
export const META_COLLECTION = "meta";
export const META_ID = "snapshot";

/** If more than this share of tickers fail in one ingest run, the run counts as failed. */
export const MAX_FAILURE_RATE = 0.1;

/** A stock as stored in Mongo: the Stock shape, keyed by ticker, plus when it was fetched. */
export type StockDoc = Stock & { _id: string; fetchedAt: string };

export type MetaDoc = {
  _id: string;
  /** ISO timestamp of the data in the collection (see ingest.ts for when it advances). */
  asOf: string;
  /** Where the data came from, e.g. "yahoo-finance2". */
  source: string;
  /** Number of stock documents in the collection after the last write. */
  count: number;
  /** Tickers that failed in the last run; their documents keep the previous day's data. */
  failed: FailedTicker[];
};

let client: MongoClient | null = null;

/**
 * Returns one shared MongoClient. The driver connects lazily on the first
 * query, so this makes no network call by itself. Throws (without building a
 * client) when MONGODB_URI is missing, so "not configured" never touches the
 * network.
 */
export function getMongoClient(): MongoClient {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error("MONGODB_URI is not set");
  // A short server-selection timeout so an unreachable cluster falls back to
  // the JSON file in seconds, not the driver's default 30s.
  client ??= new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  return client;
}

/** Closes the shared client, if one was created. Scripts call this so the process can exit. */
export async function closeMongoClient(): Promise<void> {
  await client?.close();
  client = null;
}

export function getDb(): Db {
  return getMongoClient().db(DB_NAME);
}

const tickerRank = new Map(TICKERS.map((t, i) => [t.symbol, i]));

/** Same order as data/stocks.json (the TICKERS list), so unsorted results look the same from either source. Unknown tickers go last. */
function byTickerOrder(a: { _id: string }, b: { _id: string }): number {
  const ra = tickerRank.get(a._id) ?? Infinity;
  const rb = tickerRank.get(b._id) ?? Infinity;
  if (ra !== rb) return ra < rb ? -1 : 1;
  return a._id < b._id ? -1 : a._id > b._id ? 1 : 0;
}

/** Reads every stock plus the meta doc and zod-validates them as a Snapshot. Rejects if Mongo is empty. */
export async function readSnapshotFromMongo(db: Db): Promise<Snapshot> {
  const meta = await db.collection<MetaDoc>(META_COLLECTION).findOne({ _id: META_ID });
  const docs = await db.collection<StockDoc>(STOCKS_COLLECTION).find({}).toArray();
  if (!meta || docs.length === 0) throw new Error("MongoDB has no stock data yet");

  docs.sort(byTickerOrder);
  // SnapshotSchema drops the Mongo-only fields (_id, fetchedAt), so callers
  // get exactly the same Stock shape the JSON file gives them.
  return SnapshotSchema.parse({ asOf: meta.asOf, source: meta.source, stocks: docs });
}

/** A StockSource backed by MongoDB. */
export function mongoSource(): StockSource {
  return { load: async () => readSnapshotFromMongo(getDb()) };
}

/**
 * Inserts or replaces one document per stock (_id = ticker). It never
 * deletes, so a ticker missing from `stocks` (say it failed this run) keeps
 * whatever was stored for it before.
 */
export async function upsertStocks(db: Db, stocks: Stock[], fetchedAt: string): Promise<void> {
  if (stocks.length === 0) return;
  const ops: AnyBulkWriteOperation<StockDoc>[] = stocks.map((stock) => ({
    replaceOne: {
      filter: { _id: stock.ticker },
      replacement: { ...stock, fetchedAt },
      upsert: true,
    },
  }));
  await db.collection<StockDoc>(STOCKS_COLLECTION).bulkWrite(ops);
}

export async function countStocks(db: Db): Promise<number> {
  return db.collection<StockDoc>(STOCKS_COLLECTION).countDocuments();
}

export async function readMeta(db: Db): Promise<MetaDoc | null> {
  return db.collection<MetaDoc>(META_COLLECTION).findOne({ _id: META_ID });
}

export async function writeMeta(db: Db, meta: Omit<MetaDoc, "_id">): Promise<void> {
  await db
    .collection<MetaDoc>(META_COLLECTION)
    .replaceOne({ _id: META_ID }, meta, { upsert: true });
}

/** True when more than MAX_FAILURE_RATE of the tickers failed. */
export function tooManyFailed(failedCount: number, total: number): boolean {
  return total > 0 && failedCount / total > MAX_FAILURE_RATE;
}
