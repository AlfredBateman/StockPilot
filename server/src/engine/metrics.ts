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

/**
 * Percent change over roughly the last month, e.g. 5.2 means +5.2%.
 * Returns null when there isn't enough history to answer honestly.
 *
 * Null closes are dropped *before* counting back, and that matters: Yahoo's
 * weekly data ends with a null close for the in-progress week followed by a
 * live price point, so counting back 4 raw array slots would quietly measure
 * three weeks instead of four for every stock.
 */
export function change1m(weeklyCloses: WeeklyClose[]): number | null {
  const closes = weeklyCloses
    .map((week) => week.close)
    .filter((close): close is number => close !== null);

  if (closes.length < CHANGE_1M_LOOKBACK_WEEKS + 1) return null;

  const latest = closes[closes.length - 1];
  const base = closes[closes.length - 1 - CHANGE_1M_LOOKBACK_WEEKS];
  if (base === 0) return null;

  return ((latest - base) / base) * 100;
}
