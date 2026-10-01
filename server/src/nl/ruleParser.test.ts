import { describe, expect, it } from "vitest";
import { parseQuery } from "./ruleParser.js";

describe("parseQuery — vocabulary terms", () => {
  it('parses "cheap" as a low P/E filter', () => {
    const result = parseQuery("cheap stocks");
    expect(result.filters).toEqual([{ field: "pe", op: "lt", value: 20 }]);
    expect(result.notes).toEqual(["cheap = P/E below 20"]);
    expect(result.tier).toBe("rules");
  });

  it('parses "expensive" as a high P/E filter', () => {
    const result = parseQuery("expensive stocks");
    expect(result.filters).toEqual([{ field: "pe", op: "gt", value: 40 }]);
  });

  it('parses "profitable" as a positive profit margin filter', () => {
    const result = parseQuery("profitable companies");
    expect(result.filters).toEqual([{ field: "profitMargin", op: "gt", value: 0 }]);
  });

  it('parses "low debt"', () => {
    const result = parseQuery("low debt stocks");
    expect(result.filters).toEqual([{ field: "debtToEquity", op: "lt", value: 0.5 }]);
  });

  it('parses "high debt"', () => {
    const result = parseQuery("high debt stocks");
    expect(result.filters).toEqual([{ field: "debtToEquity", op: "gt", value: 1 }]);
  });

  it('parses "small cap"', () => {
    const result = parseQuery("small cap stocks");
    expect(result.filters).toEqual([{ field: "marketCapBucket", op: "eq", value: "Small" }]);
  });

  it('parses "midcap" (no space)', () => {
    const result = parseQuery("midcap stocks");
    expect(result.filters).toEqual([{ field: "marketCapBucket", op: "eq", value: "Mid" }]);
  });

  it('parses "large cap"', () => {
    const result = parseQuery("large cap stocks");
    expect(result.filters).toEqual([{ field: "marketCapBucket", op: "eq", value: "Large" }]);
  });

  it('parses "rose this month"', () => {
    const result = parseQuery("stocks that rose this month");
    expect(result.filters).toEqual([{ field: "change1m", op: "gt", value: 0 }]);
  });

  it('parses "fell this month"', () => {
    const result = parseQuery("stocks that fell this month");
    expect(result.filters).toEqual([{ field: "change1m", op: "lt", value: 0 }]);
  });

  it("parses a sector's own name", () => {
    const result = parseQuery("technology stocks");
    expect(result.filters).toEqual([{ field: "sector", op: "eq", value: "Technology" }]);
  });

  it("parses a sector synonym", () => {
    const result = parseQuery("pharma companies");
    expect(result.filters).toEqual([{ field: "sector", op: "eq", value: "Healthcare" }]);
  });
});

describe("parseQuery — numeric phrases", () => {
  it('parses "P/E under 15"', () => {
    const result = parseQuery("P/E under 15");
    expect(result.filters).toEqual([{ field: "pe", op: "lt", value: 15 }]);
  });

  it('parses "debt to equity above 2"', () => {
    const result = parseQuery("debt to equity above 2");
    expect(result.filters).toEqual([{ field: "debtToEquity", op: "gt", value: 2 }]);
  });

  it('converts a percent-style field like "profit margin above 10" to a fraction', () => {
    const result = parseQuery("profit margin above 10");
    expect(result.filters).toEqual([{ field: "profitMargin", op: "gt", value: 0.1 }]);
  });

  it("lets an explicit number override a vague term on the same field", () => {
    const result = parseQuery("cheap stocks with P/E under 10");
    expect(result.filters).toEqual([{ field: "pe", op: "lt", value: 10 }]);
  });
});

describe("parseQuery — combined queries and edge cases", () => {
  it('fills exactly 4 filters for "cheap profitable midcaps that fell this month"', () => {
    const result = parseQuery("cheap profitable midcaps that fell this month");
    expect(result.filters).toHaveLength(4);
    expect(result.notes).toHaveLength(4);
    expect(result.filters).toEqual(
      expect.arrayContaining([
        { field: "pe", op: "lt", value: 20 },
        { field: "profitMargin", op: "gt", value: 0 },
        { field: "marketCapBucket", op: "eq", value: "Mid" },
        { field: "change1m", op: "lt", value: 0 },
      ])
    );
    expect(result.tier).toBe("rules");
  });

  it("returns no filters and a non-empty unmatched list for gibberish", () => {
    const result = parseQuery("asdkjh qweoiuqwe zzxxcc");
    expect(result.filters).toEqual([]);
    expect(result.notes).toEqual([]);
    expect(result.unmatched.length).toBeGreaterThan(0);
    expect(result.tier).toBe("rules");
  });

  it("matches vocabulary terms case-insensitively", () => {
    const result = parseQuery("CHEAP Profitable STOCKS");
    expect(result.filters).toHaveLength(2);
  });

  it("filters common stopwords out of the unmatched list", () => {
    const result = parseQuery("show me the cheap stocks");
    expect(result.filters).toEqual([{ field: "pe", op: "lt", value: 20 }]);
    expect(result.unmatched).toEqual([]);
  });

  it("never throws on an empty string", () => {
    expect(() => parseQuery("")).not.toThrow();
    expect(parseQuery("")).toEqual({ filters: [], notes: [], unmatched: [], tier: "rules" });
  });
});
