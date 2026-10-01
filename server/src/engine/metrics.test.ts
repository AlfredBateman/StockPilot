import { describe, expect, it } from "vitest";
import {
  CHANGE_1M_LOOKBACK_WEEKS,
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
