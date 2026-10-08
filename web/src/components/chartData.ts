// Pure data-shaping helpers for the charts, kept free of React/Recharts so
// they're trivial to unit test. Neither ever produces NaN: a stock with no
// usable history contributes null points (a gap in the line), never a
// computed-from-null number.
import type { Stock, WeeklyClose } from "../api/client";

type SectorCount = { sector: string; count: number };

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

type NormalizedPoint = { date: string; value: number | null };

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
type CompareRow = { date: string } & Record<string, number | null | string>;

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

/**
 * Y-axis domain and ticks for the "indexed to 100" chart. Rounded outward to a multiple of 10, 20 or 50 so 100
 * is always one of the ticks (the grey baseline then sits exactly on a labelled line), whatever the data does.
 */
export function indexedAxis(values: (number | null)[]): { domain: [number, number]; ticks: number[] } {
  const nums = values.filter((v): v is number => v !== null && Number.isFinite(v));
  const min = Math.min(100, ...nums);
  const max = Math.max(100, ...nums);
  const span = max - min;
  const step = span <= 60 ? 10 : span <= 120 ? 20 : 50;
  let lo = Math.floor(min / step) * step;
  let hi = Math.ceil(max / step) * step;
  if (lo === hi) {
    lo -= step;
    hi += step;
  }
  const ticks: number[] = [];
  for (let t = lo; t <= hi; t += step) ticks.push(t);
  return { domain: [lo, hi], ticks };
}

/** Up to `count` values spread evenly over `items`, always including the first and last, for a few readable x-axis labels. */
export function spreadTicks<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items;
  return Array.from({ length: count }, (_, i) => items[Math.round((i * (items.length - 1)) / (count - 1))]);
}
