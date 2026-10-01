// Pure data-shaping helpers for the charts, kept free of React/Recharts so
// they're trivial to unit test. Neither ever produces NaN: a stock with no
// usable history contributes null points (a gap in the line), never a
// computed-from-null number.
import type { Stock, WeeklyClose } from "../api/client";

export type SectorCount = { sector: string; count: number };

/** How many of the given stocks fall in each sector. A null sector is grouped under "n/a", never dropped. */
export function countBySector(stocks: Pick<Stock, "sector">[]): SectorCount[] {
  const counts = new Map<string, number>();
  for (const stock of stocks) {
    const sector = stock.sector ?? "n/a";
    counts.set(sector, (counts.get(sector) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([sector, count]) => ({ sector, count }))
    .sort((a, b) => b.count - a.count);
}

export type NormalizedPoint = { date: string; value: number | null };

/**
 * Rebases a weekly-close series so the first available close = 100, so
 * differently-priced stocks can be compared by relative performance on one
 * chart. Returns all-null points (not an error, not NaN) when there is no
 * usable base price.
 */
export function normalizeToBase100(weeklyCloses: WeeklyClose[]): NormalizedPoint[] {
  const base = weeklyCloses.find((w) => w.close !== null)?.close ?? null;
  if (base === null || base === 0) {
    return weeklyCloses.map((w) => ({ date: w.date, value: null }));
  }
  return weeklyCloses.map((w) => ({
    date: w.date,
    // Rounded to 2dp: floating-point division otherwise produces values like
    // 110.00000000000001, which would render ugly in a chart tooltip.
    value: w.close === null ? null : Math.round((w.close / base) * 100 * 100) / 100,
  }));
}

/** One row per date, with a normalized value per ticker, for Recharts' multi-series LineChart. */
export type CompareRow = { date: string } & Record<string, number | null | string>;

export function buildCompareSeries(stocks: Pick<Stock, "ticker" | "weeklyCloses">[]): CompareRow[] {
  const perStock = stocks.map((s) => ({
    ticker: s.ticker,
    points: new Map(normalizeToBase100(s.weeklyCloses).map((p) => [p.date, p.value])),
  }));

  const allDates = [...new Set(perStock.flatMap((s) => [...s.points.keys()]))].sort();

  return allDates.map((date) => {
    const row: CompareRow = { date };
    for (const s of perStock) {
      row[s.ticker] = s.points.get(date) ?? null;
    }
    return row;
  });
}

/** Shared chart styling (docs/DESIGN.md section 20), plain objects handed to Recharts props by StockDetail, CompareView and SectorChart. */
export const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    fontSize: 12,
    borderRadius: 12,
    border: "1px solid var(--color-stone-200)",
    background: "var(--color-elevated)",
    boxShadow: "var(--shadow-e2)",
    padding: "10px 12px",
  },
  labelStyle: { color: "var(--color-stone-600)", marginBottom: 4 },
  itemStyle: { color: "var(--color-stone-900)", padding: 0, fontVariantNumeric: "tabular-nums" },
};

export const CHART_TICK = { fontSize: 11, fill: "var(--color-stone-500)" };
