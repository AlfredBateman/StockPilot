import { describe, expect, it } from "vitest";
import { makeStock } from "../engine/testStocks.js";
import { zeroResultHelp } from "./zeroResultHelp.js";

// Five stocks: three cheap Technology stocks with high debt, two expensive Energy stocks with low debt.
const STOCKS = [
  makeStock({ ticker: "T1.NS", sector: "Technology", pe: 10, debtToEquity: 2 }),
  makeStock({ ticker: "T2.NS", sector: "Technology", pe: 12, debtToEquity: 2 }),
  makeStock({ ticker: "T3.NS", sector: "Technology", pe: 14, debtToEquity: 2 }),
  makeStock({ ticker: "E1.NS", sector: "Energy", pe: 50, debtToEquity: 0.2 }),
  makeStock({ ticker: "E2.NS", sector: "Energy", pe: 60, debtToEquity: 0.2 }),
];

const CHEAP = { field: "pe", op: "lt", value: 20 } as const;
const LOW_DEBT = { field: "debtToEquity", op: "lt", value: 0.5 } as const;
const ENERGY = { field: "sector", op: "eq", value: "Energy" } as const;

describe("zeroResultHelp", () => {
  it("returns nothing when the filters already match stocks", () => {
    expect(zeroResultHelp(STOCKS, [CHEAP])).toEqual([]);
  });

  it("suggests dropping each filter that brings stocks back, most results first", () => {
    expect(zeroResultHelp(STOCKS, [CHEAP, LOW_DEBT])).toEqual([
      { label: "Dropping 'low debt' gives 3 stocks", filters: [CHEAP] },
      { label: "Dropping 'cheap' gives 2 stocks", filters: [LOW_DEBT] },
    ]);
  });

  it("returns at most two drop suggestions", () => {
    // With these two added, dropping any one of the three filters brings stocks back.
    const more = [
      ...STOCKS,
      makeStock({ ticker: "H1.NS", sector: "Healthcare", pe: 10, debtToEquity: 0.2 }),
      makeStock({ ticker: "E3.NS", sector: "Energy", pe: 10, debtToEquity: 2 }),
    ];
    const suggestions = zeroResultHelp(more, [CHEAP, LOW_DEBT, ENERGY]);
    expect(suggestions).toHaveLength(2);
    expect(suggestions[0].label).toBe("Dropping 'cheap' gives 2 stocks");
  });

  it("never suggests dropping the only filter (that would just show everything)", () => {
    expect(zeroResultHelp(STOCKS, [{ field: "pe", op: "lt", value: 1 }])).toEqual([]);
  });

  it("offers a real sector for a sector name the data doesn't have", () => {
    expect(zeroResultHelp(STOCKS, [{ field: "sector", op: "eq", value: "Tech" }])).toEqual([
      { label: "Did you mean 'Technology'? 3 stocks", filters: [{ field: "sector", op: "eq", value: "Technology" }] },
    ]);
  });

  it("offers a near-miss term for a leftover word, even when no filter was found", () => {
    expect(zeroResultHelp(STOCKS, [], ["enrgyy"])).toEqual([
      { label: "Did you mean 'energy'? 2 stocks", filters: [ENERGY] },
    ]);
  });

  it("returns nothing for a word that is not close to anything", () => {
    expect(zeroResultHelp(STOCKS, [], ["zzzzzz"])).toEqual([]);
  });
});
