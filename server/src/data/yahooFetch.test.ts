import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Stock } from "./stockSchema.js";
import { fetchStock, fetchStocks } from "./yahooFetch.js";

// Replace yahoo-finance2 with a fake so these tests never touch the network.
// vi.mock is hoisted above the imports, so yahooFetch.ts gets this fake.
const yahoo = vi.hoisted(() => ({ quoteSummary: vi.fn(), chart: vi.fn() }));
vi.mock("yahoo-finance2", () => ({
  default: class {
    quoteSummary = yahoo.quoteSummary;
    chart = yahoo.chart;
  },
}));


const stockFor = (ticker: string): Stock => ({
  ticker,
  name: null,
  sector: null,
  price: null,
  marketCap: null,
  pe: null,
  debtToEquity: null,
  profitMargin: null,
  weeklyCloses: [],
});

describe("fetchStock", () => {
  beforeEach(() => {
    yahoo.quoteSummary.mockReset();
    yahoo.chart.mockReset();
  });

  it("maps Yahoo's fields and converts D/E from a percentage to a ratio", async () => {
    yahoo.quoteSummary.mockResolvedValue({
      price: { longName: "Adani Enterprises Limited", shortName: "ADANI ENT", regularMarketPrice: 2400, marketCap: 2.7e12 },
      summaryDetail: { trailingPE: 45.2, marketCap: 1 },
      financialData: { debtToEquity: 119.56, profitMargins: 0.066 },
      assetProfile: { sector: "Energy" },
    });
    yahoo.chart.mockResolvedValue({ quotes: [] });

    expect(await fetchStock("ADANIENT.NS")).toEqual({
      ticker: "ADANIENT.NS",
      name: "Adani Enterprises Limited",
      sector: "Energy",
      price: 2400,
      marketCap: 2.7e12,
      pe: 45.2,
      debtToEquity: 1.1956,
      profitMargin: 0.066,
      weeklyCloses: [],
    });
  });

  it("falls back to shortName and summaryDetail.marketCap, and keeps missing fields as null", async () => {
    yahoo.quoteSummary.mockResolvedValue({
      price: { shortName: "HDFC BANK" },
      summaryDetail: { marketCap: 1.5e13 },
      financialData: {},
    });
    yahoo.chart.mockResolvedValue({ quotes: [] });

    const stock = await fetchStock("HDFCBANK.NS");
    expect(stock.name).toBe("HDFC BANK");
    expect(stock.marketCap).toBe(1.5e13);
    expect(stock.sector).toBeNull();
    expect(stock.price).toBeNull();
    expect(stock.pe).toBeNull();
    expect(stock.debtToEquity).toBeNull();
    expect(stock.profitMargin).toBeNull();
  });

  it("sorts weekly closes oldest first, dated on the IST calendar", async () => {
    yahoo.quoteSummary.mockResolvedValue({});
    yahoo.chart.mockResolvedValue({
      quotes: [
        // 2026-09-28 20:00 UTC is already 2026-09-29 in IST.
        { date: new Date("2026-09-28T20:00:00Z"), close: 110 },
        { date: new Date("2026-09-21T04:00:00Z"), close: null },
      ],
    });

    const stock = await fetchStock("TCS.NS");
    expect(stock.weeklyCloses).toEqual([
      { date: "2026-09-21", close: null },
      { date: "2026-09-29", close: 110 },
    ]);
  });
});

describe("fetchStocks", () => {
  it("returns every stock in order when nothing fails", async () => {
    const fetchOne = vi.fn(async (t: string) => stockFor(t));
    const result = await fetchStocks(["A.NS", "B.NS"], { fetchOne, retryDelayMs: 0 });
    expect(result.stocks.map((s) => s.ticker)).toEqual(["A.NS", "B.NS"]);
    expect(result.failed).toEqual([]);
    expect(fetchOne).toHaveBeenCalledTimes(2);
  });

  it("retries a failed ticker exactly once and keeps it if the retry works", async () => {
    const fetchOne = vi
      .fn<(t: string) => Promise<Stock>>()
      .mockRejectedValueOnce(new Error("429 Too Many Requests"))
      .mockImplementation(async (t) => stockFor(t));

    const result = await fetchStocks(["A.NS"], { fetchOne, retryDelayMs: 0 });
    expect(result.stocks.map((s) => s.ticker)).toEqual(["A.NS"]);
    expect(result.failed).toEqual([]);
    expect(fetchOne).toHaveBeenCalledTimes(2);
  });

  it("collects a ticker that fails twice and still fetches the rest of the batch", async () => {
    const fetchOne = vi.fn(async (t: string) => {
      if (t === "BAD.NS") throw new Error("Not Found");
      return stockFor(t);
    });
    const progress: Array<[string, number, string | undefined]> = [];

    const result = await fetchStocks(["A.NS", "BAD.NS", "C.NS"], {
      fetchOne,
      retryDelayMs: 0,
      onProgress: (ticker, index, error) => progress.push([ticker, index, error]),
    });

    expect(result.stocks.map((s) => s.ticker)).toEqual(["A.NS", "C.NS"]);
    expect(result.failed).toEqual([{ ticker: "BAD.NS", error: "Not Found" }]);
    // 1 call for A, 2 for BAD (first try + one retry), 1 for C.
    expect(fetchOne).toHaveBeenCalledTimes(4);
    expect(progress).toEqual([
      ["A.NS", 0, undefined],
      ["BAD.NS", 1, "Not Found"],
      ["C.NS", 2, undefined],
    ]);
  });
});
