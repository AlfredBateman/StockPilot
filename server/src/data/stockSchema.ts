import { z } from "zod";

// The single contract for a stock snapshot: server/scripts/snapshot.ts
// writes data that must satisfy this shape, and loadStocks.ts re-validates
// it on load so a corrupt or hand-edited file is caught immediately instead
// of causing confusing bugs later.

const WeeklyCloseSchema = z.object({
  /** ISO calendar date (YYYY-MM-DD) for this week's bar, in NSE's IST calendar. */
  date: z.string(),
  /** Closing price that week, in the exchange's currency (INR). null if Yahoo had no data for that point. */
  close: z.number().nullable(),
});

export const StockSchema = z.object({
  /** Yahoo Finance / NSE symbol, e.g. "RELIANCE.NS". */
  ticker: z.string(),
  name: z.string().nullable(),
  sector: z.string().nullable(),
  /** Most recent regular-market price. */
  price: z.number().nullable(),
  marketCap: z.number().nullable(),
  /** Trailing P/E ratio. */
  pe: z.number().nullable(),
  /**
   * Total debt / total equity as a true ratio (1.2 = debt is 1.2x equity). Yahoo reports this
   * as a percentage (119.6); yahooFetch.ts divides by 100 on the way in. null for banks and
   * other financials, where Yahoo reports no D/E.
   */
  debtToEquity: z.number().nullable(),
  /** Raw fraction as reported by Yahoo's financialData.profitMargins (e.g. 0.066 = 6.6%). */
  profitMargin: z.number().nullable(),
  /** ~1 year of weekly closes, oldest first. */
  weeklyCloses: z.array(WeeklyCloseSchema),
});

export const SnapshotSchema = z.object({
  /** ISO timestamp of when this snapshot was generated. */
  asOf: z.string(),
  /** Where this data came from, e.g. "yahoo-finance2". */
  source: z.string(),
  stocks: z.array(StockSchema),
});

export type WeeklyClose = z.infer<typeof WeeklyCloseSchema>;
export type Stock = z.infer<typeof StockSchema>;
export type Snapshot = z.infer<typeof SnapshotSchema>;
