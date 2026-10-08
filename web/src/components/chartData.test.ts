import { describe, expect, it } from "vitest";
import { buildCompareSeries, countBySector, indexedAxis, normalizeToBase100, spreadTicks } from "./chartData";

describe("countBySector", () => {
  it("counts stocks per sector, most common first", () => {
    const stocks = [
      { sector: "Energy" },
      { sector: "Technology" },
      { sector: "Energy" },
      { sector: "Energy" },
    ];
    expect(countBySector(stocks)).toEqual([
      { sector: "Energy", count: 3 },
      { sector: "Technology", count: 1 },
    ]);
  });

  it("groups a null sector under n/a instead of dropping it", () => {
    expect(countBySector([{ sector: null }, { sector: null }])).toEqual([{ sector: "n/a", count: 2 }]);
  });

  it("returns an empty list for an empty input", () => {
    expect(countBySector([])).toEqual([]);
  });
});

describe("normalizeToBase100", () => {
  it("rebases a series so the first close is 100", () => {
    const closes = [
      { date: "2026-01-01", close: 50 },
      { date: "2026-01-08", close: 100 },
      { date: "2026-01-15", close: 25 },
    ];
    expect(normalizeToBase100(closes)).toEqual([
      { date: "2026-01-01", value: 100 },
      { date: "2026-01-08", value: 200 },
      { date: "2026-01-15", value: 50 },
    ]);
  });

  it("uses the first non-null close as the base, skipping a leading null", () => {
    const closes = [
      { date: "2026-01-01", close: null },
      { date: "2026-01-08", close: 50 },
      { date: "2026-01-15", close: 100 },
    ];
    expect(normalizeToBase100(closes)).toEqual([
      { date: "2026-01-01", value: null },
      { date: "2026-01-08", value: 100 },
      { date: "2026-01-15", value: 200 },
    ]);
  });

  it("returns all-null points instead of NaN when every close is null", () => {
    const closes = [
      { date: "2026-01-01", close: null },
      { date: "2026-01-08", close: null },
    ];
    expect(normalizeToBase100(closes)).toEqual([
      { date: "2026-01-01", value: null },
      { date: "2026-01-08", value: null },
    ]);
  });

  it("returns all-null points instead of dividing by zero", () => {
    const closes = [
      { date: "2026-01-01", close: 0 },
      { date: "2026-01-08", close: 10 },
    ];
    expect(normalizeToBase100(closes)).toEqual([
      { date: "2026-01-01", value: null },
      { date: "2026-01-08", value: null },
    ]);
  });

  it("returns an empty list for an empty input", () => {
    expect(normalizeToBase100([])).toEqual([]);
  });
});

describe("buildCompareSeries", () => {
  it("merges several stocks' normalized series by date", () => {
    const stocks = [
      {
        ticker: "A",
        weeklyCloses: [
          { date: "2026-01-01", close: 100 },
          { date: "2026-01-08", close: 110 },
        ],
      },
      {
        ticker: "B",
        weeklyCloses: [
          { date: "2026-01-01", close: 50 },
          { date: "2026-01-08", close: 25 },
        ],
      },
    ];
    expect(buildCompareSeries(stocks)).toEqual([
      { date: "2026-01-01", A: 100, B: 100 },
      { date: "2026-01-08", A: 110, B: 50 },
    ]);
  });

  it("fills a missing date for one stock with null instead of dropping the row", () => {
    const stocks = [
      {
        ticker: "A",
        weeklyCloses: [
          { date: "2026-01-01", close: 100 },
          { date: "2026-01-08", close: 110 },
        ],
      },
      {
        ticker: "B",
        weeklyCloses: [{ date: "2026-01-01", close: 50 }],
      },
    ];
    expect(buildCompareSeries(stocks)).toEqual([
      { date: "2026-01-01", A: 100, B: 100 },
      { date: "2026-01-08", A: 110, B: null },
    ]);
  });

  it("returns an empty list for no stocks", () => {
    expect(buildCompareSeries([])).toEqual([]);
  });
});

describe("indexedAxis", () => {
  it("always has 100 as a tick, with the domain rounded outward", () => {
    const { domain, ticks } = indexedAxis([72.4, 100, 135.2]);
    expect(domain).toEqual([60, 140]);
    expect(ticks).toEqual([60, 80, 100, 120, 140]);
  });

  it("uses a finer step for a narrow spread", () => {
    const { domain, ticks } = indexedAxis([94.1, 108.7]);
    expect(domain).toEqual([90, 110]);
    expect(ticks).toEqual([90, 100, 110]);
  });

  it("keeps 100 inside the domain when every value is above or below it", () => {
    expect(indexedAxis([120, 150]).ticks).toContain(100);
    expect(indexedAxis([40, 80]).ticks).toContain(100);
    expect(indexedAxis([120, 150]).domain[0]).toBeLessThanOrEqual(100);
    expect(indexedAxis([40, 80]).domain[1]).toBeGreaterThanOrEqual(100);
  });

  it("falls back to a usable axis around 100 when there is no data", () => {
    const { domain, ticks } = indexedAxis([null, null]);
    expect(domain).toEqual([90, 110]);
    expect(ticks).toEqual([90, 100, 110]);
  });

  it("uses a step of 50 for a very wide spread and still includes 100", () => {
    const { ticks } = indexedAxis([20, 190]);
    expect(ticks).toContain(100);
    expect(ticks.length).toBeLessThanOrEqual(7);
  });
});

describe("spreadTicks", () => {
  it("returns everything when there are few items", () => {
    expect(spreadTicks(["a", "b"], 4)).toEqual(["a", "b"]);
  });

  it("spreads evenly and keeps the first and last", () => {
    const items = Array.from({ length: 55 }, (_, i) => i);
    const picked = spreadTicks(items, 4);
    expect(picked).toHaveLength(4);
    expect(picked[0]).toBe(0);
    expect(picked[3]).toBe(54);
  });
});
