import { describe, expect, it } from "vitest";
import { sortStocks } from "./sortStocks.js";
import { makeCloses, makeStock } from "./testStocks.js";

const cheap = makeStock({ ticker: "CHEAP.NS", name: "Cheap Limited", pe: 10 });
const mid = makeStock({ ticker: "MID.NS", name: "Average Limited", pe: 20 });
const pricey = makeStock({ ticker: "PRICEY.NS", name: "Zephyr Limited", pe: 30 });
const noPe = makeStock({ ticker: "NOPE.NS", name: "Unknown Limited", pe: null });

const stocks = [mid, pricey, cheap, noPe];

function tickers(sorted: ReturnType<typeof sortStocks>): string[] {
  return sorted.map((stock) => stock.ticker);
}

describe("sortStocks", () => {
  it("keeps the original order when no sort is given", () => {
    expect(tickers(sortStocks(stocks))).toEqual(["MID.NS", "PRICEY.NS", "CHEAP.NS", "NOPE.NS"]);
  });

  it("sorts numbers ascending", () => {
    const sorted = sortStocks(stocks, { field: "pe", direction: "asc" });
    expect(tickers(sorted)).toEqual(["CHEAP.NS", "MID.NS", "PRICEY.NS", "NOPE.NS"]);
  });

  it("sorts numbers descending", () => {
    const sorted = sortStocks(stocks, { field: "pe", direction: "desc" });
    expect(tickers(sorted)).toEqual(["PRICEY.NS", "MID.NS", "CHEAP.NS", "NOPE.NS"]);
  });

  it("puts missing values last when sorting ascending", () => {
    const sorted = sortStocks(stocks, { field: "pe", direction: "asc" });
    expect(sorted[sorted.length - 1].ticker).toBe("NOPE.NS");
  });

  it("puts missing values last when sorting descending too", () => {
    const sorted = sortStocks(stocks, { field: "pe", direction: "desc" });
    expect(sorted[sorted.length - 1].ticker).toBe("NOPE.NS");
  });

  it("sorts text alphabetically", () => {
    const sorted = sortStocks(stocks, { field: "name", direction: "asc" });
    expect(tickers(sorted)).toEqual(["MID.NS", "CHEAP.NS", "NOPE.NS", "PRICEY.NS"]);
  });

  it("sorts on a computed field", () => {
    const up = makeStock({ ticker: "UP.NS", weeklyCloses: makeCloses(100, 101, 102, 103, 110) });
    const down = makeStock({ ticker: "DOWN.NS", weeklyCloses: makeCloses(100, 99, 98, 97, 90) });
    const flat = makeStock({ ticker: "FLAT.NS", weeklyCloses: makeCloses(100, 100, 100, 100, 100) });

    const sorted = sortStocks([flat, down, up], { field: "change1m", direction: "desc" });
    expect(tickers(sorted)).toEqual(["UP.NS", "FLAT.NS", "DOWN.NS"]);
  });

  it("returns a new array and leaves the original order alone", () => {
    // loadStocks() hands out one cached array for the whole process, so an
    // in-place sort here would corrupt it for every later request.
    const original = [mid, pricey, cheap];
    const sorted = sortStocks(original, { field: "pe", direction: "asc" });

    expect(sorted).not.toBe(original);
    expect(tickers(original)).toEqual(["MID.NS", "PRICEY.NS", "CHEAP.NS"]);
  });
});
