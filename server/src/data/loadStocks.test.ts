import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createStockLoader, findStock, jsonFileSource, readSnapshotFromFile } from "./loadStocks.js";
import type { Snapshot } from "./stockSchema.js";

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
