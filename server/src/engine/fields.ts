import type { Stock } from "../data/stockSchema.js";
import type { FilterField } from "./filterSpec.js";
import {
  CHANGE_1Y_WEEKS,
  CHANGE_3M_WEEKS,
  CHANGE_6M_WEEKS,
  aboveLow52w,
  belowHigh52w,
  change1m,
  changeOverWeeks,
  marketCapBucket,
} from "./metrics.js";

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
  "belowHigh52w",
  "aboveLow52w",
  "change3m",
  "change6m",
  "change1y",
] as const;

export type SortField = (typeof SORT_FIELDS)[number];

/** Every field the engine can read off a stock, filterable or sortable. */
type StockField = FilterField | SortField;

/**
 * The one place that turns a field name into a comparable value, so filtering
 * and sorting on the same field can never disagree. Derived fields
 * (marketCapBucket and the price-history changes) are computed here; everything else is read
 * straight off the snapshot. Missing values stay null — never 0, never NaN.
 */
export function stockFieldValue(stock: Stock, field: StockField): string | number | null {
  if (field === "marketCapBucket") return marketCapBucket(stock.marketCap);
  if (field === "change1m") return change1m(stock.weeklyCloses);
  if (field === "change3m") return changeOverWeeks(stock.weeklyCloses, CHANGE_3M_WEEKS);
  if (field === "change6m") return changeOverWeeks(stock.weeklyCloses, CHANGE_6M_WEEKS);
  if (field === "change1y") return changeOverWeeks(stock.weeklyCloses, CHANGE_1Y_WEEKS);
  if (field === "belowHigh52w") return belowHigh52w(stock.weeklyCloses);
  if (field === "aboveLow52w") return aboveLow52w(stock.weeklyCloses);
  return stock[field];
}
