import type { WeeklyClose } from "../data/stockSchema.js";
import type { MarketCapBucket } from "./filterSpec.js";

// ---------------------------------------------------------------------------
// Thresholds — review these.
//
// These are OUR OWN buckets, calibrated to this app's universe (NIFTY 50 +
// NIFTY NEXT 50). They are NOT the SEBI/AMFI definition, which classifies by
// rank (top 100 = large cap, 101-250 = mid cap, rest = small cap).
//
// The common absolute rule of thumb is "large cap above Rs 20,000 crore", but
// the NIFTY 100 *is* the top 100 listed companies, so by that rule all 100
// stocks here are large caps and the filter would match everything. These
// thresholds split the same universe into a usable spread instead:
// currently 43 Large / 50 Mid / 7 Small.
//
// 1 crore = 1_00_00_000 (1e7), and market caps in data/stocks.json are in INR.
// ---------------------------------------------------------------------------

/** Rs 2,00,000 crore. */
export const MARKET_CAP_LARGE_MIN_INR = 2_000_000_000_000;

/** Rs 1,00,000 crore. */
export const MARKET_CAP_MID_MIN_INR = 1_000_000_000_000;

/** How far back "1 month" looks in weekly bars. */
export const CHANGE_1M_LOOKBACK_WEEKS = 4;

export function marketCapBucket(marketCap: number | null): MarketCapBucket | null {
  if (marketCap === null) return null;
  if (marketCap >= MARKET_CAP_LARGE_MIN_INR) return "Large";
  if (marketCap >= MARKET_CAP_MID_MIN_INR) return "Mid";
  return "Small";
}

/** Lookbacks for the longer changes, in weekly bars: about 3 months, 6 months and 1 year. */
export const CHANGE_3M_WEEKS = 13;
export const CHANGE_6M_WEEKS = 26;
export const CHANGE_1Y_WEEKS = 52;

/** How many of the latest weekly closes make up "the 52-week range". */
export const RANGE_52W_CLOSES = 52;

/**
 * The non-null closes, oldest first.
 *
 * Null closes are dropped *before* counting back, and that matters: Yahoo's
 * weekly data ends with a null close for the in-progress week followed by a
 * live price point, so counting back 4 raw array slots would quietly measure
 * three weeks instead of four for every stock.
 */
function knownCloses(weeklyCloses: WeeklyClose[]): number[] {
  return weeklyCloses.map((week) => week.close).filter((close): close is number => close !== null);
}

/**
 * Percent change from the close `weeks` weekly bars ago to the latest close,
 * e.g. 5.2 means +5.2%. Returns null when there isn't enough history to answer
 * honestly, or when the earlier close is 0.
 */
export function changeOverWeeks(weeklyCloses: WeeklyClose[], weeks: number): number | null {
  const closes = knownCloses(weeklyCloses);
  if (closes.length < weeks + 1) return null;

  const latest = closes[closes.length - 1];
  const base = closes[closes.length - 1 - weeks];
  if (base === 0) return null;

  return ((latest - base) / base) * 100;
}

/** Percent change over roughly the last month (4 weekly bars). */
export function change1m(weeklyCloses: WeeklyClose[]): number | null {
  return changeOverWeeks(weeklyCloses, CHANGE_1M_LOOKBACK_WEEKS);
}

/** The last 52 weekly closes, or null when fewer are stored. */
function last52(weeklyCloses: WeeklyClose[]): number[] | null {
  const closes = knownCloses(weeklyCloses);
  return closes.length < RANGE_52W_CLOSES ? null : closes.slice(-RANGE_52W_CLOSES);
}

/** Highest of the last 52 weekly closing prices (not an intraday high). */
export function high52w(weeklyCloses: WeeklyClose[]): number | null {
  const closes = last52(weeklyCloses);
  return closes ? Math.max(...closes) : null;
}

/** Lowest of the last 52 weekly closing prices (not an intraday low). */
export function low52w(weeklyCloses: WeeklyClose[]): number | null {
  const closes = last52(weeklyCloses);
  return closes ? Math.min(...closes) : null;
}

/** How far the latest close sits below the 52-week high, in percent (0 = at the high). */
export function belowHigh52w(weeklyCloses: WeeklyClose[]): number | null {
  const closes = last52(weeklyCloses);
  if (!closes) return null;
  const high = Math.max(...closes);
  return high === 0 ? null : ((high - closes[closes.length - 1]) / high) * 100;
}

/** How far the latest close sits above the 52-week low, in percent (0 = at the low). */
export function aboveLow52w(weeklyCloses: WeeklyClose[]): number | null {
  const closes = last52(weeklyCloses);
  if (!closes) return null;
  const low = Math.min(...closes);
  return low === 0 ? null : ((closes[closes.length - 1] - low) / low) * 100;
}

/** Every price-history metric for one stock, added to API responses (never stored). */
export function priceHistory(weeklyCloses: WeeklyClose[]) {
  return {
    high52w: high52w(weeklyCloses),
    low52w: low52w(weeklyCloses),
    belowHigh52w: belowHigh52w(weeklyCloses),
    aboveLow52w: aboveLow52w(weeklyCloses),
    change3m: changeOverWeeks(weeklyCloses, CHANGE_3M_WEEKS),
    change6m: changeOverWeeks(weeklyCloses, CHANGE_6M_WEEKS),
    change1y: changeOverWeeks(weeklyCloses, CHANGE_1Y_WEEKS),
  };
}
