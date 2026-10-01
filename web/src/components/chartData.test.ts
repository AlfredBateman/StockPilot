import { describe, expect, it } from "vitest";
import { buildCompareSeries, countBySector, normalizeToBase100 } from "./chartData";

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
