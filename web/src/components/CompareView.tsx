import { useCallback, useEffect, useRef, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getStock, type Stock } from "../api/client";
import { buildCompareSeries, CHART_TICK, CHART_TOOLTIP_STYLE, indexedAxis, spreadTicks } from "./chartData";
import { Drawer } from "./Drawer";
import { displayTicker, formatAsOfDate, formatAxisMonth } from "./format";
import { IconClose } from "./Icons";
import { BlockSkeleton, ErrorPanel } from "./StatePanels";
import { STOCK_METRICS } from "./stockMetrics";

type CompareViewProps = {
  tickers: string[];
  onClose: () => void;
  onRemove: (ticker: string) => void;
};

type CompareState = { kind: "loading" } | { kind: "ready"; stocks: Stock[] } | { kind: "error"; message: string };

/**
 * One color per compare slot (by position, not by ticker), so a line's color never changes as stocks are
 * swapped in/out. These are the three chart colors validated in docs/DESIGN.md section 5.
 * They color lines and swatches only; all text stays in stone colors.
 */
const LINE_COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)"];

/** Fixed plot height, so the chart never depends on how tall its parents happen to be. */
const CHART_HEIGHT = 300;
/** How many month labels sit under the x-axis; few enough to stay readable at 390px. */
const X_TICK_COUNT = 4;

/** A short line-key in the series color: identity comes from this mark, not from colored text. */
function SeriesKey({ color }: { color: string }) {
  return <span aria-hidden="true" className="inline-block h-1 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />;
}

function RemoveButton({ ticker, onRemove }: { ticker: string; onRemove: (ticker: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onRemove(ticker)}
      aria-label={`Remove ${displayTicker(ticker)} from comparison`}
      className="flex size-7 shrink-0 touch-manipulation items-center justify-center rounded-lg text-stone-500 transition-colors duration-150 hover:bg-error-soft hover:text-error"
    >
      <IconClose size={14} />
    </button>
  );
}

/** Metric column width, and the narrowest a stock column may get before the table scrolls sideways instead. */
const METRIC_COL_PX = 112;
const STOCK_COL_MIN_PX = 176;

/** True while the scroll area still has content hidden off its right edge, so the table can show a "more" cue. */
function useScrollCue() {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  const update = useCallback(() => {
    const el = ref.current;
    if (el) setMore(el.scrollWidth - el.clientWidth - el.scrollLeft > 1);
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [update]);
  return { ref, more, update };
}

/**
 * The side-by-side table (640px and up; below that, stacked cards). On a wide panel every stock fits in an equal
 * column, with names wrapping instead of truncating. When the panel is too narrow for that, it scrolls sideways
 * with the metric column pinned and a visible cue, so nothing is ever silently cut off.
 */
function CompareTable({ stocks, onRemove }: { stocks: Stock[]; onRemove: (ticker: string) => void }) {
  const { ref, more, update } = useScrollCue();
  // Sticky cells are opaque (they sit over the scrolling ones), so each takes its row's own background.
  const stickyTh = "sticky left-0 z-10 px-4 py-3 text-left text-label text-stone-600 shadow-[inset_-1px_0_0_var(--color-stone-200)]";

  return (
    <div className="hidden flex-col gap-2 sm:flex">
      <div className="relative rounded-2xl border border-stone-200 bg-card shadow-e1">
        <div
          ref={ref}
          onScroll={update}
          role="region"
          aria-label="Side-by-side comparison table"
          tabIndex={0}
          className="overflow-x-auto rounded-2xl"
        >
          <table className="w-full table-fixed text-body" style={{ minWidth: METRIC_COL_PX + stocks.length * STOCK_COL_MIN_PX }}>
            <colgroup>
              <col style={{ width: METRIC_COL_PX }} />
              {stocks.map((stock) => (
                <col key={stock.ticker} />
              ))}
            </colgroup>
            <thead>
              <tr className="bg-stone-100">
                <th scope="col" className="sticky left-0 z-10 h-11 border-b border-stone-200 bg-stone-100 px-4 text-left text-label text-stone-600">
                  Metric
                </th>
                {stocks.map((stock, i) => (
                  <th key={stock.ticker} scope="col" className="h-11 border-b border-stone-200 py-1 pl-3 pr-1.5 text-right">
                    <span className="inline-flex items-center gap-2">
                      <SeriesKey color={LINE_COLORS[i]} />
                      <span translate="no" className="font-mono text-ticker font-semibold text-stone-900">
                        {displayTicker(stock.ticker)}
                      </span>
                      <RemoveButton ticker={stock.ticker} onRemove={onRemove} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-stone-200">
                <th scope="row" className={`${stickyTh} bg-card`}>
                  Name
                </th>
                {stocks.map((stock) => (
                  <td
                    key={stock.ticker}
                    className={`break-words px-3 py-3 text-right ${stock.name === null ? "text-stone-500" : "text-stone-700"}`}
                    title={stock.name ?? "n/a"}
                  >
                    {stock.name ?? "n/a"}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-stone-200 bg-stone-50">
                <th scope="row" className={`${stickyTh} bg-stone-50`}>
                  Sector
                </th>
                {stocks.map((stock) => (
                  <td
                    key={stock.ticker}
                    className={`break-words px-3 py-3 text-right ${stock.sector === null ? "text-stone-500" : "text-stone-700"}`}
                  >
                    {stock.sector ?? "n/a"}
                  </td>
                ))}
              </tr>
              {STOCK_METRICS.map((metric, index) => (
                <tr
                  key={metric.label}
                  className={`border-b border-stone-200 last:border-b-0 ${index % 2 === 1 ? "bg-stone-50" : ""}`}
                >
                  <th scope="row" className={`${stickyTh} ${index % 2 === 1 ? "bg-stone-50" : "bg-card"}`}>
                    {metric.label}
                  </th>
                  {stocks.map((stock) => {
                    const value = metric.value(stock);
                    return (
                      <td
                        key={stock.ticker}
                        title={metric.title?.(stock)}
                        className={`whitespace-nowrap px-3 py-3 text-right tabular-nums ${
                          value === "n/a" ? "text-stone-500" : "font-semibold text-stone-900"
                        }`}
                      >
                        {value}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {more && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-12 rounded-r-2xl bg-gradient-to-l from-stone-900/20 to-transparent"
          />
        )}
      </div>
      {more && <p className="text-caption text-stone-600">Scroll sideways to see every stock. The metric column stays in place.</p>}
    </div>
  );
}

export function CompareView({ tickers, onClose, onRemove }: CompareViewProps) {
  const [state, setState] = useState<CompareState>({ kind: "loading" });
  const tickerKey = tickers.join(",");

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });

    Promise.all(tickers.map(getStock))
      .then((stocks) => {
        if (!cancelled) setState({ kind: "ready", stocks });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ kind: "error", message: err instanceof Error ? err.message : "n/a" });
      });

    return () => {
      cancelled = true;
    };
    // tickers is a new array reference every render; tickerKey is the stable form of the same dependency.
  }, [tickerKey]);

  // The chart's data, y-axis (always including 100) and x-axis labels, worked out once per load.
  const series = state.kind === "ready" ? buildCompareSeries(state.stocks) : [];
  const yAxis = indexedAxis(series.flatMap((row) => tickers.map((t) => row[t])).filter((v): v is number => typeof v === "number"));
  const xTicks = spreadTicks(series.map((row) => row.date), X_TICK_COUNT);

  return (
    <Drawer title={`Compare (${tickers.length})`} onClose={onClose} wide>
      {state.kind === "loading" && <BlockSkeleton label="Loading comparison…" />}

      {state.kind === "error" && (
        <ErrorPanel
          title="Couldn’t Load These Stocks"
          message={state.message}
          hint="Close this panel and press Compare again to retry."
        />
      )}

      {state.kind === "ready" && (
        <>
          <section className="rounded-2xl border border-stone-200 bg-card shadow-e1">
            <div className="flex flex-col gap-1 px-4 pb-2 pt-4">
              <h3 className="text-balance text-h3 text-stone-900">Performance, Indexed to 100</h3>
              <p className="text-caption text-stone-600">
                Each line starts at 100, so you can compare how they moved, not their prices. The grey line marks
                100.
              </p>
            </div>
            <div
              role="img"
              aria-label={`Line chart, performance indexed to 100 for ${state.stocks
                .map((s) => displayTicker(s.ticker))
                .join(", ")}.`}
              className="px-1 pb-3"
            >
              <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                <LineChart data={series} margin={{ top: 12, right: 36, bottom: 4, left: 4 }}>
                  <CartesianGrid stroke="var(--color-stone-200)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={CHART_TICK}
                    tickLine={false}
                    axisLine={{ stroke: "var(--color-stone-300)" }}
                    ticks={xTicks}
                    interval={0}
                    tickMargin={6}
                    tickFormatter={formatAxisMonth}
                  />
                  <YAxis
                    tick={CHART_TICK}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    domain={yAxis.domain}
                    ticks={yAxis.ticks}
                    interval={0}
                    allowDataOverflow
                  />
                  {/* The baseline every line starts from: above it = up since the start, below = down. */}
                  <ReferenceLine y={100} stroke="var(--color-stone-400)" strokeWidth={1.5} />
                  <Tooltip
                    // `name` is each Line's display ticker, so the tooltip says which value belongs to which stock.
                    formatter={(value, name) => [typeof value === "number" ? value.toFixed(1) : "n/a", name]}
                    labelFormatter={(label) => formatAsOfDate(String(label))}
                    cursor={{ stroke: "var(--color-stone-400)" }}
                    {...CHART_TOOLTIP_STYLE}
                  />
                  <Legend
                    iconType="plainline"
                    wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                    formatter={(value) => <span style={{ color: "var(--color-stone-700)", fontWeight: 500 }}>{value}</span>}
                  />
                  {state.stocks.map((stock, i) => (
                    <Line
                      key={stock.ticker}
                      dataKey={stock.ticker}
                      name={displayTicker(stock.ticker)}
                      type="monotone"
                      stroke={LINE_COLORS[i]}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4.5, stroke: "white", strokeWidth: 2, fill: LINE_COLORS[i] }}
                      isAnimationActive={false}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="flex flex-col gap-2.5">
            <h3 className="text-balance text-h3 text-stone-900">Side by Side</h3>

            <CompareTable stocks={state.stocks} onRemove={onRemove} />

            {/* Below 640px: one stacked card per stock instead of a 3-wide table (same pattern as StockTable). */}
            <ul className="flex flex-col gap-3 sm:hidden">
              {state.stocks.map((stock, i) => (
                <li key={stock.ticker} className="rounded-2xl border border-stone-200 bg-card p-4 shadow-e1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <SeriesKey color={LINE_COLORS[i]} />
                      <span translate="no" className="font-mono text-ticker font-semibold text-stone-900">
                        {displayTicker(stock.ticker)}
                      </span>
                    </span>
                    <RemoveButton ticker={stock.ticker} onRemove={onRemove} />
                  </div>
                  <p className="break-words text-body text-stone-600" title={stock.name ?? "n/a"}>
                    {stock.name ?? "n/a"}
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 border-t border-stone-200 pt-3">
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-label text-stone-500">Sector</dt>
                      <dd className={`text-body ${stock.sector === null ? "text-stone-500" : "text-stone-700"}`}>
                        {stock.sector ?? "n/a"}
                      </dd>
                    </div>
                    {STOCK_METRICS.map((metric) => {
                      const value = metric.value(stock);
                      return (
                        <div key={metric.label} className="flex flex-col gap-0.5">
                          <dt className="text-label text-stone-500">{metric.label}</dt>
                          <dd
                            title={metric.title?.(stock)}
                            className={`text-body tabular-nums ${value === "n/a" ? "text-stone-500" : "font-semibold text-stone-900"}`}
                          >
                            {value}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </Drawer>
  );
}
