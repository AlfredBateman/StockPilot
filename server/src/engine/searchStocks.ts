import type { Stock } from "../data/stockSchema.js";

/**
 * Free-text search over company name and ticker, ignoring case. An empty or
 * whitespace-only query keeps everything. Always returns a new array.
 */
export function searchStocks(stocks: Stock[], query: string): Stock[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return [...stocks];

  return stocks.filter((stock) => {
    const tickerMatches = stock.ticker.toLowerCase().includes(needle);
    // A stock with no name is still searchable by ticker.
    const nameMatches = stock.name !== null && stock.name.toLowerCase().includes(needle);
    return tickerMatches || nameMatches;
  });
}
