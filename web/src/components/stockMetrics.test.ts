import { describe, expect, it } from "vitest";
import { change1mPercent } from "./stockMetrics";

const weeks = (closes: (number | null)[]) => closes.map((close, i) => ({ date: `2026-01-${10 + i}`, close }));

describe("change1mPercent", () => {
  it("compares the latest close with the close 4 weeks earlier", () => {
    // base = 100 (4 closes back from 110), latest = 110
    expect(change1mPercent(weeks([90, 100, 101, 102, 105, 110]))).toBeCloseTo(10);
  });

  it("returns a negative number for a fall", () => {
    expect(change1mPercent(weeks([200, 190, 180, 170, 150]))).toBeCloseTo(-25);
  });

  it("skips null closes before counting back 4 weeks, like the server's change1m", () => {
    // Without skipping the trailing null, this would compare against the wrong week.
    expect(change1mPercent(weeks([100, 101, 102, 103, 120, null]))).toBeCloseTo(20);
  });

  it("returns null when there are fewer than 5 real closes", () => {
    expect(change1mPercent(weeks([100, null, 101, 102, 103]))).toBeNull();
    expect(change1mPercent([])).toBeNull();
  });

  it("returns null instead of Infinity when the base close is 0", () => {
    expect(change1mPercent(weeks([0, 1, 2, 3, 4]))).toBeNull();
  });
});
