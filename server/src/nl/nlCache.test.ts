import { describe, expect, it } from "vitest";
import { normalizeQuery, readCacheEntry } from "./nlCache.js";

describe("normalizeQuery", () => {
  it("lowercases, trims, and collapses whitespace so spacing never causes a miss", () => {
    expect(normalizeQuery("  Cheap   MIDCAPS ")).toBe("cheap midcaps");
  });

  it("leaves an already-normal query alone", () => {
    expect(normalizeQuery("cheap midcaps")).toBe("cheap midcaps");
  });
});

describe("readCacheEntry", () => {
  it("returns null for a query that was never cached, instead of throwing", async () => {
    await expect(readCacheEntry("a query nobody has ever asked before")).resolves.toBeNull();
  });
});
