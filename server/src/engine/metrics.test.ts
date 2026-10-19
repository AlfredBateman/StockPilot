import { describe, expect, it } from "vitest";
import {
  CHANGE_1M_LOOKBACK_WEEKS,
  CHANGE_1Y_WEEKS,
  CHANGE_3M_WEEKS,
  CHANGE_6M_WEEKS,
  RANGE_52W_CLOSES,
  aboveLow52w,
  belowHigh52w,
  changeOverWeeks,
  high52w,
  low52w,
  priceHistory,
  MARKET_CAP_LARGE_MIN_INR,
  MARKET_CAP_MID_MIN_INR,
  change1m,
  marketCapBucket,
} from "./metrics.js";
import { makeCloses } from "./testStocks.js";

describe("marketCapBucket", () => {
  it("puts a cap exactly on the large threshold in Large", () => {
    expect(marketCapBucket(MARKET_CAP_LARGE_MIN_INR)).toBe("Large");
  });

  it("puts a cap just under the large threshold in Mid", () => {
    expect(marketCapBucket(MARKET_CAP_LARGE_MIN_INR - 1)).toBe("Mid");
  });

  it("puts a cap exactly on the mid threshold in Mid", () => {
    expect(marketCapBucket(MARKET_CAP_MID_MIN_INR)).toBe("Mid");
  });

  it("puts a cap under the mid threshold in Small", () => {
    expect(marketCapBucket(MARKET_CAP_MID_MIN_INR - 1)).toBe("Small");
  });

  it("returns null for a missing market cap", () => {
    expect(marketCapBucket(null)).toBeNull();
  });
});

describe("change1m", () => {
  it("returns the percent change over the lookback window", () => {
    // 100 -> 110 across 4 weeks is +10%.
    expect(change1m(makeCloses(100, 102, 104, 106, 110))).toBeCloseTo(10);
  });

  it("returns a negative percent when the price fell", () => {
    expect(change1m(makeCloses(200, 190, 180, 170, 150))).toBeCloseTo(-25);
  });

  it("measures from the oldest close still inside the window", () => {
    // Only the last 5 entries matter, so the leading 999 is ignored.
    expect(change1m(makeCloses(999, 100, 102, 104, 106, 110))).toBeCloseTo(10);
  });

  it("skips null closes rather than counting them as weeks", () => {
    // The real snapshot has a null close on the in-progress week. Dropping it
    // keeps this a true 4-week comparison: 100 -> 110.
    expect(change1m(makeCloses(100, 102, 104, 106, null, 110))).toBeCloseTo(10);
  });

  it("returns null when there is not enough history", () => {
    expect(change1m(makeCloses(100, 102, 104, 106))).toBeNull();
    expect(change1m([])).toBeNull();
  });

  it("returns null when there are too few non-null closes", () => {
    expect(change1m(makeCloses(100, null, null, null, null, 110))).toBeNull();
  });

  it("returns null instead of dividing by zero", () => {
    expect(change1m(makeCloses(0, 1, 2, 3, 4))).toBeNull();
  });

  it("needs one more close than the lookback window", () => {
    const justEnough = makeCloses(...Array(CHANGE_1M_LOOKBACK_WEEKS + 1).fill(100));
    expect(change1m(justEnough)).toBeCloseTo(0);
  });
});

/** n weekly closes rising by 1 from `start`: start, start+1, ... */
function rising(n: number, start = 100) {
  return makeCloses(...Array.from({ length: n }, (_, i) => start + i));
}

describe("changeOverWeeks (3M, 6M, 1Y)", () => {
  it("compares the latest close with the close 13, 26 and 52 weeks earlier", () => {
    const closes = rising(60); // 100..159, latest 159
    expect(changeOverWeeks(closes, CHANGE_3M_WEEKS)).toBeCloseTo(((159 - 146) / 146) * 100);
    expect(changeOverWeeks(closes, CHANGE_6M_WEEKS)).toBeCloseTo(((159 - 133) / 133) * 100);
    expect(changeOverWeeks(closes, CHANGE_1Y_WEEKS)).toBeCloseTo(((159 - 107) / 107) * 100);
  });

  it("needs one more close than the lookback: 53 closes for 1 year, 52 is too few", () => {
    expect(changeOverWeeks(rising(53), CHANGE_1Y_WEEKS)).toBeCloseTo(52);
    expect(changeOverWeeks(rising(52), CHANGE_1Y_WEEKS)).toBeNull();
    expect(changeOverWeeks(rising(27), CHANGE_6M_WEEKS)).not.toBeNull();
    expect(changeOverWeeks(rising(26), CHANGE_6M_WEEKS)).toBeNull();
    expect(changeOverWeeks(rising(13), CHANGE_3M_WEEKS)).toBeNull();
  });

  it("skips null closes before counting back", () => {
    const closes = [...rising(53), { date: "2027-01-01", close: null }];
    expect(changeOverWeeks(closes, CHANGE_1Y_WEEKS)).toBeCloseTo(52);
  });

  it("returns null instead of dividing by zero", () => {
    expect(changeOverWeeks(makeCloses(0, ...Array(52).fill(5)), CHANGE_1Y_WEEKS)).toBeNull();
  });
});

describe("52-week high and low", () => {
  it("uses only the last 52 weekly closes", () => {
    // An old 999 just outside the window must not count as the high.
    const closes = makeCloses(999, ...Array.from({ length: 52 }, (_, i) => 100 + i)); // window 100..151
    expect(high52w(closes)).toBe(151);
    expect(low52w(closes)).toBe(100);
  });

  it("measures how far the latest close is from the high and the low", () => {
    // Window: 400, 500, then 50 closes at 410 (latest 410).
    const closes = makeCloses(400, 500, ...Array(50).fill(410));
    expect(belowHigh52w(closes)).toBeCloseTo(18); // (500 - 410) / 500
    expect(aboveLow52w(closes)).toBeCloseTo(2.5); // (410 - 400) / 400
  });

  it("is 0 when the latest close is the high (or the low)", () => {
    expect(belowHigh52w(rising(52))).toBe(0);
    expect(aboveLow52w(makeCloses(...Array.from({ length: 52 }, (_, i) => 200 - i)))).toBe(0);
  });

  it("returns null with fewer than 52 non-null closes", () => {
    const short = makeCloses(...Array(RANGE_52W_CLOSES - 1).fill(100), null);
    expect(high52w(short)).toBeNull();
    expect(low52w(short)).toBeNull();
    expect(belowHigh52w(short)).toBeNull();
    expect(aboveLow52w(short)).toBeNull();
    expect(high52w([])).toBeNull();
  });

  it("returns null rather than dividing by a zero low", () => {
    expect(aboveLow52w(makeCloses(0, ...Array(51).fill(10)))).toBeNull();
  });
});

describe("priceHistory", () => {
  it("returns all seven values, null where history is short", () => {
    expect(priceHistory(rising(30))).toEqual({
      high52w: null,
      low52w: null,
      belowHigh52w: null,
      aboveLow52w: null,
      change3m: expect.any(Number),
      change6m: expect.any(Number),
      change1y: null,
    });
  });
});
