import { describe, expect, it } from "vitest";
import type { Stock } from "../api/client";
import { sortStocksClient } from "./clientSort";

function makeStock(overrides: Partial<Stock>): Stock {
  return {
    ticker: "AAA.NS",
    name: "A",
    sector: "Energy",
    price: 100,
    marketCap: 1000,
    pe: 10,
    debtToEquity: 0.5,
    profitMargin: 0.1,
    weeklyCloses: [],
    ...overrides,
  };
}

describe("sortStocksClient", () => {
  it("returns the original order when no sort is given", () => {
    const stocks = [makeStock({ ticker: "B" }), makeStock({ ticker: "A" })];
    expect(sortStocksClient(stocks)).toEqual(stocks);
  });

  it("sorts numeric fields ascending and descending", () => {
    const stocks = [makeStock({ ticker: "A", price: 300 }), makeStock({ ticker: "B", price: 100 })];
    expect(sortStocksClient(stocks, { field: "price", direction: "asc" }).map((s) => s.ticker)).toEqual(["B", "A"]);
    expect(sortStocksClient(stocks, { field: "price", direction: "desc" }).map((s) => s.ticker)).toEqual(["A", "B"]);
  });

  it("sorts string fields case-sensitively via localeCompare", () => {
    const stocks = [makeStock({ ticker: "B.NS" }), makeStock({ ticker: "A.NS" })];
    expect(sortStocksClient(stocks, { field: "ticker", direction: "asc" }).map((s) => s.ticker)).toEqual([
      "A.NS",
      "B.NS",
    ]);
  });

  it("always sorts nulls last, regardless of direction", () => {
    const stocks = [makeStock({ ticker: "A", pe: null }), makeStock({ ticker: "B", pe: 5 })];
    expect(sortStocksClient(stocks, { field: "pe", direction: "asc" }).map((s) => s.ticker)).toEqual(["B", "A"]);
    expect(sortStocksClient(stocks, { field: "pe", direction: "desc" }).map((s) => s.ticker)).toEqual(["B", "A"]);
  });

  it("does not mutate the input array", () => {
    const stocks = [makeStock({ ticker: "B", price: 300 }), makeStock({ ticker: "A", price: 100 })];
    const original = [...stocks];
    sortStocksClient(stocks, { field: "price", direction: "asc" });
    expect(stocks).toEqual(original);
  });
});
