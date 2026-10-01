import type { Stock, WeeklyClose } from "../data/stockSchema.js";

// Test helpers, so the engine tests don't each repeat a whole Stock literal.

/** A complete, valid stock. Override only the fields a test cares about. */
export function makeStock(overrides: Partial<Stock> = {}): Stock {
  return {
    ticker: "TEST.NS",
    name: "Test Company Limited",
    sector: "Technology",
    price: 100,
    marketCap: 1_500_000_000_000,
    pe: 20,
    debtToEquity: 50,
    profitMargin: 0.1,
    weeklyCloses: [],
    ...overrides,
  };
}

/** Builds a weekly close series (oldest first) from plain numbers. */
export function makeCloses(...closes: (number | null)[]): WeeklyClose[] {
  return closes.map((close, index) => ({
    date: `2026-01-${String(index + 1).padStart(2, "0")}`,
    close,
  }));
}
