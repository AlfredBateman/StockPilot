import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createStockLoader,
  defaultSource,
  findStock,
  getDataStatus,
  jsonFileSource,
  readSnapshotFromFile,
  withFallback,
} from "./loadStocks.js";
import type { Snapshot } from "./stockSchema.js";

// loadStocks.ts pulls in mongoSource.ts; swap the driver for a fake that
// records construction, so no test here can open a real connection.
const driver = vi.hoisted(() => ({ constructed: vi.fn() }));
vi.mock("mongodb", () => ({
  MongoClient: class {
    constructor() {
      driver.constructed();
    }
  },
}));

const FIXTURE_PATH = path.resolve(import.meta.dirname, "./loadStocks.fixture.json");

describe("readSnapshotFromFile", () => {
  it("parses and validates a 3-stock fixture", async () => {
    const snapshot = await readSnapshotFromFile(FIXTURE_PATH);
    expect(snapshot.source).toBe("fixture");
    expect(snapshot.stocks).toHaveLength(3);
  });

  it("keeps missing values as null instead of dropping them", async () => {
    const snapshot = await readSnapshotFromFile(FIXTURE_PATH);
    const missing = findStock(snapshot, "MISSINGDATA.NS");
    expect(missing?.price).toBeNull();
    expect(missing?.weeklyCloses).toEqual([]);
  });

  it("rejects a snapshot that fails the schema", async () => {
    const badPath = path.resolve(import.meta.dirname, "./does-not-exist.json");
    await expect(readSnapshotFromFile(badPath)).rejects.toThrow();
  });
});

describe("findStock", () => {
  it("finds a ticker case-insensitively", async () => {
    const snapshot = await readSnapshotFromFile(FIXTURE_PATH);
    expect(findStock(snapshot, "tcs.ns")?.name).toBe("Tata Consultancy Services Limited");
  });

  it("returns undefined for an unknown ticker", async () => {
    const snapshot = await readSnapshotFromFile(FIXTURE_PATH);
    expect(findStock(snapshot, "NOPE.NS")).toBeUndefined();
  });
});

describe("jsonFileSource", () => {
  it("loads a validated snapshot from the given file", async () => {
    const snapshot = await jsonFileSource(FIXTURE_PATH).load();
    expect(snapshot.source).toBe("fixture");
    expect(snapshot.stocks).toHaveLength(3);
  });
});

describe("createStockLoader", () => {
  const TTL = 1000;
  const snapshotFrom = (source: string): Snapshot => ({ asOf: "2026-10-07T00:00:00.000Z", source, stocks: [] });

  /** A fake source whose results are queued by the test, plus a fake clock. */
  function setup(...results: Array<Snapshot | Error>) {
    const load = vi.fn(async () => {
      const next = results.shift();
      if (!next) throw new Error("no more results queued");
      if (next instanceof Error) throw next;
      return next;
    });
    let time = 0;
    const loader = createStockLoader({ load }, TTL, () => time);
    return { load, loader, advance: (ms: number) => (time += ms) };
  }

  it("reads the source once and reuses it within the TTL", async () => {
    const { load, loader, advance } = setup(snapshotFrom("first"));
    expect((await loader()).source).toBe("first");
    advance(TTL - 1);
    expect((await loader()).source).toBe("first");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("reads the source again once the TTL has passed", async () => {
    const { load, loader, advance } = setup(snapshotFrom("first"), snapshotFrom("second"));
    await loader();
    advance(TTL);
    expect((await loader()).source).toBe("second");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shares one read between concurrent callers", async () => {
    const { load, loader } = setup(snapshotFrom("first"));
    const [a, b] = await Promise.all([loader(), loader()]);
    expect(a).toBe(b);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("rejects when the first read fails, then retries on the next call", async () => {
    const { load, loader } = setup(new Error("file missing"), snapshotFrom("recovered"));
    await expect(loader()).rejects.toThrow("file missing");
    expect((await loader()).source).toBe("recovered");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("keeps serving the last good snapshot when a later reload fails", async () => {
    const { load, loader, advance } = setup(snapshotFrom("good"), new Error("half-written file"));
    await loader();
    advance(TTL);
    expect((await loader()).source).toBe("good");
    // The fallback is cached for a full TTL, so the broken source isn't hammered.
    expect((await loader()).source).toBe("good");
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe("withFallback", () => {
  const snapshotFrom = (source: string): Snapshot => ({ asOf: "2026-10-07T00:00:00.000Z", source, stocks: [] });
  const ok = (source: string) => ({ load: vi.fn(async () => snapshotFrom(source)) });
  const failing = () => ({
    load: vi.fn(async (): Promise<Snapshot> => {
      throw new Error("connection refused");
    }),
  });

  it("serves the primary (Mongo) when it loads, without touching the file", async () => {
    const file = ok("file-data");
    const snapshot = await withFallback(ok("mongo-data"), file, vi.fn()).load();
    expect(snapshot.source).toBe("mongo-data");
    expect(file.load).not.toHaveBeenCalled();
    expect(await getDataStatus(async () => snapshot)).toEqual({ dataSource: "mongo", asOf: snapshot.asOf });
  });

  it("falls back to the file when the primary fails, and reports dataSource file", async () => {
    const snapshot = await withFallback(failing(), ok("file-data"), vi.fn()).load();
    expect(snapshot.source).toBe("file-data");
    expect((await getDataStatus(async () => snapshot)).dataSource).toBe("file");
  });

  it("logs once per outage, not once per reload", async () => {
    const log = vi.fn();
    const primary = { load: vi.fn<() => Promise<Snapshot>>() };
    primary.load
      .mockRejectedValueOnce(new Error("down"))
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce(snapshotFrom("back"))
      .mockRejectedValueOnce(new Error("down again"));
    const source = withFallback(primary, ok("file-data"), log);

    await source.load();
    await source.load();
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain("down");

    expect((await source.load()).source).toBe("back");
    await source.load();
    expect(log).toHaveBeenCalledTimes(2);
  });

  it("rejects if both Mongo and the file fail", async () => {
    await expect(withFallback(failing(), failing(), vi.fn()).load()).rejects.toThrow("connection refused");
  });
});

describe("defaultSource", () => {
  const savedDemo = process.env.DEMO_MODE;
  afterEach(() => {
    process.env.DEMO_MODE = savedDemo;
    driver.constructed.mockReset();
    vi.restoreAllMocks();
  });

  it("with DEMO_MODE=true reads only the file and never calls Mongo", async () => {
    process.env.DEMO_MODE = "true";
    const mongo = { load: vi.fn(async (): Promise<Snapshot> => ({ asOf: "x", source: "mongo", stocks: [] })) };
    const snapshot = await defaultSource(mongo, jsonFileSource(FIXTURE_PATH)).load();
    expect(snapshot.source).toBe("fixture");
    expect(mongo.load).not.toHaveBeenCalled();
    expect((await getDataStatus(async () => snapshot)).dataSource).toBe("file");
  });

  it("with DEMO_MODE=true and the real Mongo source, never builds a MongoClient", async () => {
    process.env.DEMO_MODE = "true";
    await defaultSource(undefined, jsonFileSource(FIXTURE_PATH)).load();
    expect(driver.constructed).not.toHaveBeenCalled();
  });

  it("without DEMO_MODE tries Mongo first, then the file", async () => {
    process.env.DEMO_MODE = "false";
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const mongo = {
      load: vi.fn(async (): Promise<Snapshot> => {
        throw new Error("unreachable");
      }),
    };
    const snapshot = await defaultSource(mongo, jsonFileSource(FIXTURE_PATH)).load();
    expect(mongo.load).toHaveBeenCalledTimes(1);
    expect(snapshot.source).toBe("fixture");
  });

  it("without DEMO_MODE and no MONGODB_URI (blank in tests), falls back without building a client", async () => {
    process.env.DEMO_MODE = "false";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const snapshot = await defaultSource(undefined, jsonFileSource(FIXTURE_PATH)).load();
    expect(snapshot.source).toBe("fixture");
    expect(driver.constructed).not.toHaveBeenCalled();
    expect(warn.mock.calls[0][0]).toContain("MONGODB_URI is not set");
  });
});
