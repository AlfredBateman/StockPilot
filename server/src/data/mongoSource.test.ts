import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "mongodb";
import type { Stock } from "./stockSchema.js";
import {
  closeMongoClient,
  getMongoClient,
  mongoSource,
  readSnapshotFromMongo,
  tooManyFailed,
  upsertStocks,
  writeMeta,
} from "./mongoSource.js";

// Replace the mongodb driver with a fake so these tests never touch the
// network. vi.mock is hoisted above the imports, so mongoSource.ts gets it.
const driver = vi.hoisted(() => ({ constructed: vi.fn(), db: vi.fn(), close: vi.fn() }));
vi.mock("mongodb", () => ({
  MongoClient: class {
    constructor(...args: unknown[]) {
      driver.constructed(...args);
    }
    db = driver.db;
    close = driver.close;
  },
}));

const stockFor = (ticker: string): Stock => ({
  ticker,
  name: `${ticker} Ltd`,
  sector: null,
  price: 100,
  marketCap: null,
  pe: null,
  debtToEquity: null,
  profitMargin: null,
  weeklyCloses: [],
});

const META = { _id: "snapshot", asOf: "2026-10-06T12:30:00.000Z", source: "yahoo-finance2", count: 2, failed: [] };

/** A fake Db whose collections return the given docs and record writes. */
function fakeDb(stockDocs: object[], meta: object | null) {
  const stocks = {
    find: vi.fn(() => ({ toArray: async () => stockDocs.map((d) => ({ ...d })) })),
    bulkWrite: vi.fn(async () => ({})),
    deleteMany: vi.fn(),
    deleteOne: vi.fn(),
  };
  const metaCol = { findOne: vi.fn(async () => meta), replaceOne: vi.fn(async () => ({})) };
  const db = { collection: vi.fn((name: string) => (name === "meta" ? metaCol : stocks)) };
  return { db: db as unknown as Db, stocks, meta: metaCol };
}

describe("readSnapshotFromMongo", () => {
  it("maps docs to a validated Snapshot in TICKERS order, dropping Mongo-only fields", async () => {
    // Stored out of order: TCS comes after ADANIENT in tickers.ts.
    const { db } = fakeDb(
      [
        { _id: "TCS.NS", ...stockFor("TCS.NS"), fetchedAt: "2026-10-06T12:30:00.000Z" },
        { _id: "ADANIENT.NS", ...stockFor("ADANIENT.NS"), fetchedAt: "2026-10-06T12:30:00.000Z" },
      ],
      META
    );
    const snapshot = await readSnapshotFromMongo(db);
    expect(snapshot.asOf).toBe(META.asOf);
    expect(snapshot.source).toBe("yahoo-finance2");
    expect(snapshot.stocks.map((s) => s.ticker)).toEqual(["ADANIENT.NS", "TCS.NS"]);
    expect(snapshot.stocks[0]).toEqual(stockFor("ADANIENT.NS"));
  });

  it("rejects when the stocks collection is empty", async () => {
    const { db } = fakeDb([], META);
    await expect(readSnapshotFromMongo(db)).rejects.toThrow("no stock data");
  });

  it("rejects when there is no meta doc", async () => {
    const { db } = fakeDb([{ _id: "TCS.NS", ...stockFor("TCS.NS") }], null);
    await expect(readSnapshotFromMongo(db)).rejects.toThrow("no stock data");
  });

  it("rejects a doc that fails the Stock schema", async () => {
    const { db } = fakeDb([{ _id: "TCS.NS", ticker: "TCS.NS", price: "not a number" }], META);
    await expect(readSnapshotFromMongo(db)).rejects.toThrow();
  });
});

describe("getMongoClient / mongoSource", () => {
  const savedUri = process.env.MONGODB_URI;
  beforeEach(() => driver.constructed.mockReset());
  afterEach(async () => {
    process.env.MONGODB_URI = savedUri;
    await closeMongoClient();
  });

  it("rejects without ever building a client when MONGODB_URI is blank", async () => {
    process.env.MONGODB_URI = "  ";
    await expect(mongoSource().load()).rejects.toThrow("MONGODB_URI is not set");
    expect(driver.constructed).not.toHaveBeenCalled();
  });

  it("builds one shared client with a short server-selection timeout", () => {
    process.env.MONGODB_URI = "mongodb://fake-host-for-tests";
    const a = getMongoClient();
    const b = getMongoClient();
    expect(a).toBe(b);
    expect(driver.constructed).toHaveBeenCalledTimes(1);
    expect(driver.constructed).toHaveBeenCalledWith("mongodb://fake-host-for-tests", { serverSelectionTimeoutMS: 5000 });
  });
});

describe("upsertStocks", () => {
  it("sends one upsert per ticker keyed by _id, and never deletes", async () => {
    const { db, stocks } = fakeDb([], null);
    await upsertStocks(db, [stockFor("TCS.NS"), stockFor("INFY.NS")], "2026-10-07T12:30:00.000Z");
    expect(stocks.bulkWrite).toHaveBeenCalledTimes(1);
    expect(stocks.bulkWrite).toHaveBeenCalledWith([
      {
        replaceOne: {
          filter: { _id: "TCS.NS" },
          replacement: { ...stockFor("TCS.NS"), fetchedAt: "2026-10-07T12:30:00.000Z" },
          upsert: true,
        },
      },
      {
        replaceOne: {
          filter: { _id: "INFY.NS" },
          replacement: { ...stockFor("INFY.NS"), fetchedAt: "2026-10-07T12:30:00.000Z" },
          upsert: true,
        },
      },
    ]);
    expect(stocks.deleteMany).not.toHaveBeenCalled();
    expect(stocks.deleteOne).not.toHaveBeenCalled();
  });

  it("does nothing for an empty batch (every ticker failed)", async () => {
    const { db, stocks } = fakeDb([], null);
    await upsertStocks(db, [], "2026-10-07T12:30:00.000Z");
    expect(stocks.bulkWrite).not.toHaveBeenCalled();
  });
});

describe("writeMeta", () => {
  it("upserts the single meta doc", async () => {
    const { db, meta } = fakeDb([], null);
    const failed = [{ ticker: "TCS.NS", error: "timeout" }];
    await writeMeta(db, { asOf: META.asOf, source: "yahoo-finance2", count: 100, failed });
    expect(meta.replaceOne).toHaveBeenCalledWith(
      { _id: "snapshot" },
      { asOf: META.asOf, source: "yahoo-finance2", count: 100, failed },
      { upsert: true }
    );
  });
});

describe("tooManyFailed", () => {
  it("allows exactly 10% and fails above it", () => {
    expect(tooManyFailed(0, 100)).toBe(false);
    expect(tooManyFailed(10, 100)).toBe(false);
    expect(tooManyFailed(11, 100)).toBe(true);
    expect(tooManyFailed(100, 100)).toBe(true);
  });
});
