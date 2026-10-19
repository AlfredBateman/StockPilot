import type { Stock, WeeklyClose } from "../api/client";
import {
  debtToEquityNote,
  formatDebtToEquity,
  formatMarketCapCrore,
  formatPercent,
  formatPrice,
  formatRatio,
  formatSignedPercent,
} from "./format";

type StockMetric = {
  label: string;
  value: (s: Stock) => string;
  /** Hover text for the value (e.g. why a bank has no Debt/Equity). */
  title?: (s: Stock) => string | undefined;
  /** For a signed change: the raw number, so the view can color it gain or loss. */
  signed?: (s: Stock) => number | null;
};

/** The headline metrics shown for one stock, shared by StockDetail and CompareView. */
export const STOCK_METRICS: StockMetric[] = [
  { label: "Price", value: (s) => formatPrice(s.price) },
  { label: "Market Cap", value: (s) => formatMarketCapCrore(s.marketCap) },
  { label: "P/E", value: (s) => formatRatio(s.pe) },
  { label: "Debt/Equity", value: (s) => formatDebtToEquity(s.debtToEquity), title: debtToEquityNote },
  { label: "Profit Margin", value: (s) => formatPercent(s.profitMargin) },
];

/** Shown under every price-history block, because these are not the intraday highs and lows other sites show. */
export const HISTORY_CAPTION = "Based on weekly closing prices, not intraday highs and lows.";

/** Price-history metrics (worked out by the server from the weekly closes), shared by StockDetail and CompareView. */
export const HISTORY_METRICS: StockMetric[] = [
  { label: "52W High", value: (s) => formatPrice(s.high52w) },
  { label: "52W Low", value: (s) => formatPrice(s.low52w) },
  { label: "Below 52W High", value: (s) => formatRatio(s.belowHigh52w, "%") },
  { label: "Above 52W Low", value: (s) => formatRatio(s.aboveLow52w, "%") },
  { label: "3M Change", value: (s) => formatSignedPercent(s.change3m), signed: (s) => s.change3m },
  { label: "6M Change", value: (s) => formatSignedPercent(s.change6m), signed: (s) => s.change6m },
  { label: "1Y Change", value: (s) => formatSignedPercent(s.change1y), signed: (s) => s.change1y },
];

const CHANGE_1M_LOOKBACK_WEEKS = 4;

/**
 * Percent price change over the last 4 weeks, for coloring the StockDetail
 * price. The API doesn't send this number (the server only uses its own
 * change1m for filtering and sorting), so this deliberately mirrors
 * server/src/engine/metrics.ts's change1m rule: drop null closes first (the
 * snapshot ends with a null close for the in-progress week), then compare the
 * latest close with the close 4 weeks earlier. Returns null, never NaN, when
 * there isn't enough history or the base price is 0.
 */
export function change1mPercent(weeklyCloses: WeeklyClose[]): number | null {
  const closes = weeklyCloses.map((week) => week.close).filter((close): close is number => close !== null);
  if (closes.length < CHANGE_1M_LOOKBACK_WEEKS + 1) return null;

  const latest = closes[closes.length - 1];
  const base = closes[closes.length - 1 - CHANGE_1M_LOOKBACK_WEEKS];
  if (base === 0) return null;

  return ((latest - base) / base) * 100;
}
