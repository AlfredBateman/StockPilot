import { describe, expect, it } from "vitest";
import { applyFilters } from "./applyFilters.js";
import type { FilterSpec } from "./filterSpec.js";
import { makeCloses, makeStock } from "./testStocks.js";

const energyCheap = makeStock({ ticker: "A.NS", sector: "Energy", pe: 10 });
const energyPricey = makeStock({ ticker: "B.NS", sector: "Energy", pe: 40 });
const techCheap = makeStock({ ticker: "C.NS", sector: "Technology", pe: 12 });

const stocks = [energyCheap, energyPricey, techCheap];

function tickers(filters: FilterSpec, list = stocks): string[] {
  return applyFilters(list, filters).map((stock) => stock.ticker);
}

describe("applyFilters", () => {
  it("returns everything when there are no filters", () => {
    expect(tickers([])).toEqual(["A.NS", "B.NS", "C.NS"]);
  });

  it("filters on a numeric field", () => {
    expect(tickers([{ field: "pe", op: "lt", value: 20 }])).toEqual(["A.NS", "C.NS"]);
  });

  it("filters on a text field, ignoring case", () => {
    expect(tickers([{ field: "sector", op: "eq", value: "energy" }])).toEqual(["A.NS", "B.NS"]);
  });

  it("filters on a list of values", () => {
    const filters: FilterSpec = [{ field: "sector", op: "in", value: ["Technology", "Utilities"] }];
    expect(tickers(filters)).toEqual(["C.NS"]);
  });

  it("ANDs several filters together", () => {
    const filters: FilterSpec = [
      { field: "sector", op: "eq", value: "Energy" },
      { field: "pe", op: "lt", value: 20 },
    ];
    expect(tickers(filters)).toEqual(["A.NS"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(tickers([{ field: "pe", op: "gt", value: 1000 }])).toEqual([]);
  });

  describe("between", () => {
    it("includes both endpoints", () => {
      expect(tickers([{ field: "pe", op: "between", value: [10, 12] }])).toEqual(["A.NS", "C.NS"]);
    });

    it("excludes values outside the range", () => {
      expect(tickers([{ field: "pe", op: "between", value: [11, 11] }])).toEqual([]);
    });
  });

  describe("missing values", () => {
    const noPe = makeStock({ ticker: "NULL.NS", pe: null, sector: null });
    const list = [energyCheap, noPe];

    it("never matches a less-than filter", () => {
      expect(tickers([{ field: "pe", op: "lt", value: 1000 }], list)).toEqual(["A.NS"]);
    });

    it("never matches a greater-than filter", () => {
      expect(tickers([{ field: "pe", op: "gt", value: -1000 }], list)).toEqual(["A.NS"]);
    });

    it("never matches a between filter", () => {
      expect(tickers([{ field: "pe", op: "between", value: [-1000, 1000] }], list)).toEqual(["A.NS"]);
    });

    it("never matches an equality filter", () => {
      expect(tickers([{ field: "sector", op: "eq", value: "Energy" }], list)).toEqual(["A.NS"]);
    });

    it("is not treated as zero", () => {
      // If null were read as 0 this would match, which is the bug this guards.
      expect(tickers([{ field: "pe", op: "lt", value: 1 }], list)).toEqual([]);
    });
  });

  describe("derived fields", () => {
    const large = makeStock({ ticker: "L.NS", marketCap: 3_000_000_000_000 });
    const small = makeStock({ ticker: "S.NS", marketCap: 500_000_000_000 });
    const noCap = makeStock({ ticker: "N.NS", marketCap: null });
    const list = [large, small, noCap];

    it("filters on the computed market cap bucket", () => {
      expect(tickers([{ field: "marketCapBucket", op: "eq", value: "Large" }], list)).toEqual(["L.NS"]);
    });

    it("excludes stocks whose bucket cannot be computed", () => {
      const filters: FilterSpec = [
        { field: "marketCapBucket", op: "in", value: ["Large", "Mid", "Small"] },
      ];
      expect(tickers(filters, list)).toEqual(["L.NS", "S.NS"]);
    });

    it("filters on the computed 1-month change", () => {
      const riser = makeStock({ ticker: "UP.NS", weeklyCloses: makeCloses(100, 101, 102, 103, 110) });
      const faller = makeStock({ ticker: "DOWN.NS", weeklyCloses: makeCloses(100, 99, 98, 97, 90) });
      const noHistory = makeStock({ ticker: "NONE.NS", weeklyCloses: [] });

      const filters: FilterSpec = [{ field: "change1m", op: "gt", value: 0 }];
      expect(tickers(filters, [riser, faller, noHistory])).toEqual(["UP.NS"]);
    });
  });

  it("does not modify the list it was given", () => {
    const list = [energyCheap, energyPricey];
    applyFilters(list, [{ field: "pe", op: "lt", value: 20 }]);
    expect(list).toHaveLength(2);
  });
});
