import type { SortField, SortSpec, Stock } from "../api/client";

function fieldValue(stock: Stock, field: SortField): string | number | null {
  switch (field) {
    case "ticker":
      return stock.ticker;
    case "name":
      return stock.name;
    case "sector":
      return stock.sector;
    case "price":
      return stock.price;
    case "marketCap":
      return stock.marketCap;
    case "pe":
      return stock.pe;
    case "debtToEquity":
      return stock.debtToEquity;
    case "profitMargin":
      return stock.profitMargin;
  }
}

/**
 * Client-side sort for the Watchlist view, which loads its (small,
 * unpaginated) stock list directly via getStock rather than through
 * POST /api/screen. Mirrors the server engine's null-last rule
 * (server/src/engine/sortStocks.ts) so both views behave the same way,
 * without importing server code into web/.
 */
export function sortStocksClient(stocks: Stock[], sort?: SortSpec): Stock[] {
  if (!sort) return stocks;
  const { field, direction } = sort;
  return [...stocks].sort((a, b) => {
    const av = fieldValue(a, field);
    const bv = fieldValue(b, field);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
    return direction === "asc" ? cmp : -cmp;
  });
}
