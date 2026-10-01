import { describe, expect, it } from "vitest";
import { searchStocks } from "./searchStocks.js";
import { makeStock } from "./testStocks.js";

const reliance = makeStock({ ticker: "RELIANCE.NS", name: "Reliance Industries Limited" });
const tcs = makeStock({ ticker: "TCS.NS", name: "Tata Consultancy Services Limited" });
const unnamed = makeStock({ ticker: "MYSTERY.NS", name: null });

const stocks = [reliance, tcs, unnamed];

function tickers(query: string): string[] {
  return searchStocks(stocks, query).map((stock) => stock.ticker);
}

describe("searchStocks", () => {
  it("returns everything for an empty query", () => {
    expect(tickers("")).toEqual(["RELIANCE.NS", "TCS.NS", "MYSTERY.NS"]);
  });

  it("returns everything for a whitespace-only query", () => {
    expect(tickers("   ")).toEqual(["RELIANCE.NS", "TCS.NS", "MYSTERY.NS"]);
  });

  it("matches on ticker, ignoring case", () => {
    expect(tickers("tcs")).toEqual(["TCS.NS"]);
  });

  it("matches on company name, ignoring case", () => {
    expect(tickers("tata consultancy")).toEqual(["TCS.NS"]);
  });

  it("matches on part of a name", () => {
    expect(tickers("industries")).toEqual(["RELIANCE.NS"]);
  });

  it("ignores surrounding whitespace in the query", () => {
    expect(tickers("  reliance  ")).toEqual(["RELIANCE.NS"]);
  });

  it("still searches a stock that has no name", () => {
    expect(tickers("mystery")).toEqual(["MYSTERY.NS"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(tickers("nosuchcompany")).toEqual([]);
  });

  it("does not modify the list it was given", () => {
    const list = [reliance, tcs];
    searchStocks(list, "tcs");
    expect(list).toHaveLength(2);
  });
});
