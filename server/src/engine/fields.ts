import type { Stock } from "../data/stockSchema.js";
import type { FilterField } from "./filterSpec.js";
import { change1m, marketCapBucket } from "./metrics.js";

// Fields a result list can be sorted by. marketCapBucket is deliberately not
// here — sorting by a bucket name is confusing, sort by marketCap instead.
export const SORT_FIELDS = [
  "ticker",
  "name",
  "sector",
  "price",
  "marketCap",
  "pe",
  "debtToEquity",
  "profitMargin",
  "change1m",
] as const;

export type SortField = (typeof SORT_FIELDS)[number];

/** Every field the engine can read off a stock, filterable or sortable. */
export type StockField = FilterField | SortField;

/**
 * The one place that turns a field name into a comparable value, so filtering
 * and sorting on the same field can never disagree. Derived fields
 * (marketCapBucket, change1m) are computed here; everything else is read
 * straight off the snapshot. Missing values stay null — never 0, never NaN.
 */
export function stockFieldValue(stock: Stock, field: StockField): string | number | null {
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
    case "marketCapBucket":
      return marketCapBucket(stock.marketCap);
    case "pe":
      return stock.pe;
    case "debtToEquity":
      return stock.debtToEquity;
    case "profitMargin":
      return stock.profitMargin;
    case "change1m":
      return change1m(stock.weeklyCloses);
  }
}
