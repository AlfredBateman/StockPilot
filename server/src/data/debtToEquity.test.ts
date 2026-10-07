import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { debtToEquityRatio } from "./debtToEquity.js";
import { SnapshotSchema } from "./stockSchema.js";

describe("data/stocks.json", () => {
  it("stores debtToEquity as a ratio, not Yahoo's percentage", () => {
    const file = path.resolve(import.meta.dirname, "../../../data/stocks.json");
    const { stocks } = SnapshotSchema.parse(JSON.parse(readFileSync(file, "utf-8")));
    const values = stocks.flatMap((s) => (s.debtToEquity === null ? [] : [s.debtToEquity]));

    expect(values.length).toBeGreaterThan(0);
    // The percentage form reaches 1000+; real NIFTY 100 ratios stay in single digits.
    expect(Math.max(...values)).toBeLessThan(30);
    // ADANIENT.NS: Yahoo reported 119.56 (%), i.e. total debt / total equity = 1.1956.
    expect(stocks.find((s) => s.ticker === "ADANIENT.NS")?.debtToEquity).toBe(1.1956);
  });
});

describe("debtToEquityRatio", () => {
  it("converts Yahoo's percentage to a ratio", () => {
    expect(debtToEquityRatio(119.56)).toBe(1.1956);
    expect(debtToEquityRatio(50)).toBe(0.5);
  });

  it("keeps small values precise", () => {
    expect(debtToEquityRatio(0.012)).toBe(0.00012);
  });

  it("passes missing values through as null (banks and financials have none)", () => {
    expect(debtToEquityRatio(null)).toBeNull();
    expect(debtToEquityRatio(undefined)).toBeNull();
  });
});
