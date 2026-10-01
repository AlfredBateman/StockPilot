import path from "node:path";
import { describe, expect, it } from "vitest";
import { findStock, readSnapshotFromFile } from "./loadStocks.js";

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
