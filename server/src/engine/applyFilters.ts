import type { Stock } from "../data/stockSchema.js";
import { stockFieldValue } from "./fields.js";
import type { Filter, FilterSpec } from "./filterSpec.js";

/**
 * Keeps only the stocks that satisfy every filter (filters are ANDed).
 * An empty filter list keeps everything. Always returns a new array.
 */
export function applyFilters(stocks: Stock[], filters: FilterSpec): Stock[] {
  if (filters.length === 0) return [...stocks];
  return stocks.filter((stock) => filters.every((filter) => matchesFilter(stock, filter)));
}

function matchesFilter(stock: Stock, filter: Filter): boolean {
  const value = stockFieldValue(stock, filter.field);

  // A missing value never matches anything. "This company has no P/E" is not
  // the same as "this company has a P/E of 0", so it must not sneak into a
  // "P/E under 15" result.
  if (value === null) return false;

  switch (filter.op) {
    case "eq":
      return isEqual(value, filter.value);
    case "in":
      return filter.value.some((candidate) => isEqual(value, candidate));
    case "lt":
      return typeof value === "number" && value < filter.value;
    case "gt":
      return typeof value === "number" && value > filter.value;
    case "between": {
      // Inclusive at both ends.
      const [min, max] = filter.value;
      return typeof value === "number" && value >= min && value <= max;
    }
  }
}

/** Text comparisons ignore case, so "energy" and "Energy" both work. */
function isEqual(value: string | number, candidate: string | number): boolean {
  if (typeof value === "string" && typeof candidate === "string") {
    return value.toLowerCase() === candidate.toLowerCase();
  }
  return value === candidate;
}
