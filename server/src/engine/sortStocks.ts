import type { Stock } from "../data/stockSchema.js";
import { stockFieldValue } from "./fields.js";
import type { SortSpecSchema } from "./screenRequest.js";
import type { z } from "zod";

export type SortSpec = z.infer<typeof SortSpecSchema>;

/**
 * Sorts a copy of the list. Copying is not optional: loadStocks() caches one
 * shared snapshot array for the whole process, so sorting in place would
 * reorder the cached data for every later request.
 *
 * Stocks with a missing value always sink to the bottom, in both directions —
 * a company with no P/E shouldn't top a "cheapest P/E first" list.
 */
export function sortStocks(stocks: Stock[], sort?: SortSpec): Stock[] {
  const sorted = [...stocks];
  if (!sort) return sorted;

  const factor = sort.direction === "desc" ? -1 : 1;

  return sorted.sort((a, b) => {
    const left = stockFieldValue(a, sort.field);
    const right = stockFieldValue(b, sort.field);

    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;

    if (typeof left === "string" && typeof right === "string") {
      return left.localeCompare(right) * factor;
    }
    return (Number(left) - Number(right)) * factor;
  });
}
