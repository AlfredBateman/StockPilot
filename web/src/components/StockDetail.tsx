import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getStock, type Stock } from "../api/client";
import { CHART_TICK, CHART_TOOLTIP_STYLE } from "./chartData";
import { Drawer } from "./Drawer";
import { displayTicker, formatAsOfDate, formatPrice, formatSignedPercent } from "./format";
import { IconTrend } from "./Icons";
import { countUp } from "./motion";
import { BlockSkeleton, ErrorPanel } from "./StatePanels";
import { change1mPercent, STOCK_METRICS } from "./stockMetrics";

type StockDetailProps = {
  ticker: string;
  onClose: () => void;
};

type DetailState = { kind: "loading" } | { kind: "ready"; stock: Stock } | { kind: "error"; message: string };

/** Text color for a signed change: gain green, loss red, neutral when flat or unknown. */
function changeTone(change: number | null): string {
  if (change === null || formatSignedPercent(change) === "0.0%") return "text-stone-900";
  return change > 0 ? "text-gain" : "text-loss";
}

/** The "+3.2% 1M" chip beside the price: sign, arrow and a visible "1M" label, so the price color has a stated meaning. */
function ChangeChip({ change }: { change: number | null }) {
  const text = formatSignedPercent(change);
  if (change === null || text === "0.0%") {
    return (
      <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-2.5 text-label tabular-nums text-stone-600">
        {text} <span className="text-stone-500">1M</span>
      </span>
    );
  }
  const up = change > 0;
  return (
    <span
      className={`inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-label tabular-nums ${
        up ? "bg-gain-soft text-gain" : "bg-loss-soft text-loss"
      }`}
    >
      <IconTrend direction={up ? "up" : "down"} size={14} />
      <span className="font-semibold">{text}</span>
      <span className="ml-0.5 opacity-80">1M</span>
    </span>
  );
}

// Drawer showing one stock's price history and headline metrics, opened by
// clicking its ticker in StockTable.
export function StockDetail({ ticker, onClose }: StockDetailProps) {
  const [state, setState] = useState<DetailState>({ kind: "loading" });
  const priceRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });

    getStock(ticker)
      .then((stock) => {
        if (!cancelled) setState({ kind: "ready", stock });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ kind: "error", message: err instanceof Error ? err.message : "n/a" });
      });

    return () => {
      cancelled = true;
    };
  }, [ticker]);

  // Animation (b): the price counts up from 0 when the drawer's data arrives. A layout
  // effect, so the count starts before the first paint (no flash of the final number).
  const readyPrice = state.kind === "ready" ? state.stock.price : null;
  useLayoutEffect(() => {
    if (readyPrice === null || !priceRef.current) return;
    return countUp(priceRef.current, readyPrice, formatPrice);
  }, [readyPrice]);

  const shownTicker = displayTicker(ticker);

  if (state.kind !== "ready") {
    return (
      <Drawer title={shownTicker} onClose={onClose}>
        {state.kind === "loading" && <BlockSkeleton label={`Loading ${shownTicker}…`} />}
        {state.kind === "error" && (
          <ErrorPanel
            title={`Couldn’t Load ${shownTicker}`}
            message={state.message}
            hint="Close this panel and open the stock again to retry."
          />
        )}
      </Drawer>
    );
  }

  const { stock } = state;
  const change = change1mPercent(stock.weeklyCloses);
  const closes = stock.weeklyCloses;
  const tiles: { label: string; value: string; tone?: string; title?: string }[] = [
    // Price is the hero above, so it isn't repeated here.
    ...STOCK_METRICS.filter((metric) => metric.label !== "Price").map((metric) => ({
      label: metric.label,
      value: metric.value(stock),
      title: metric.title?.(stock),
    })),
    { label: "1M Change", value: formatSignedPercent(change), tone: changeTone(change) },
    { label: "Sector", value: stock.sector ?? "n/a" },
  ];

  return (
    <Drawer title={shownTicker} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-h3 text-stone-900">{stock.name ?? "n/a"}</p>
          <p className="text-caption text-stone-500">Weekly data from the saved snapshot</p>
        </div>
        <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
          <div className="flex flex-col">
            <span className="text-label text-stone-500">Price</span>
            {/* The counting number is hidden from screen readers (it would be read out ~40 times);
                they get the final price from the sr-only copy instead. */}
            <span
              ref={priceRef}
              aria-hidden="true"
              className={`text-display tabular-nums ${stock.price === null ? "text-stone-500" : changeTone(change)}`}
            >
              {formatPrice(stock.price)}
            </span>
            <span className="sr-only">{formatPrice(stock.price)}</span>
          </div>
          <div className="pb-1.5">
            <ChangeChip change={change} />
          </div>
        </div>
      </div>

      {/* The chart card: the area runs edge to edge; the price axis sits inside the plot. */}
      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-card shadow-e1">
        <div className="flex items-baseline justify-between gap-2 px-4 pb-1 pt-4">
          <h3 className="text-balance text-h3 text-stone-900">Weekly Closing Price</h3>
          <span className="text-caption text-stone-500">{closes.length} weeks</span>
        </div>
        {closes.length === 0 ? (
          <p className="m-4 rounded-xl border border-dashed border-stone-300 px-4 py-8 text-center text-body text-stone-600">
            No price history available.
          </p>
        ) : (
          <>
            <div
              role="img"
              aria-label={`Line chart, weekly closing price for ${shownTicker}: from ${formatPrice(
                closes[0].close
              )} on ${formatAsOfDate(closes[0].date)} to ${formatPrice(
                closes[closes.length - 1].close
              )} on ${formatAsOfDate(closes[closes.length - 1].date)}.`}
            >
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={closes} margin={{ top: 12, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="detail-area-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-accent-500)" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="var(--color-accent-500)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--color-stone-200)" vertical={false} />
                  <XAxis dataKey="date" hide />
                  <YAxis
                    domain={["auto", "auto"]}
                    mirror
                    tick={{ ...CHART_TICK, dx: 4, dy: -6 }}
                    tickLine={false}
                    axisLine={false}
                    // A compact tick (no currency symbol/decimals) so the label fits;
                    // the tooltip below shows the fully formatted price.
                    tickFormatter={(v: number) => Math.round(v).toLocaleString("en-IN")}
                  />
                  <Tooltip
                    formatter={(value) => [typeof value === "number" ? formatPrice(value) : "n/a", "Close"]}
                    labelFormatter={(label) => formatAsOfDate(String(label))}
                    cursor={{ stroke: "var(--color-stone-400)" }}
                    {...CHART_TOOLTIP_STYLE}
                  />
                  <Area
                    dataKey="close"
                    type="monotone"
                    stroke="var(--color-accent-600)"
                    strokeWidth={2.5}
                    fill="url(#detail-area-fill)"
                    activeDot={{ r: 4.5, stroke: "white", strokeWidth: 2, fill: "var(--color-accent-600)" }}
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {/* Start and end dates as text instead of an x-axis, so no tick label is clipped at the card edge. */}
            <div className="flex justify-between border-t border-stone-200 bg-stone-50/70 px-4 py-2 text-caption tabular-nums text-stone-500">
              <span>{formatAsOfDate(closes[0].date)}</span>
              <span>{formatAsOfDate(closes[closes.length - 1].date)}</span>
            </div>
          </>
        )}
      </section>

      <section className="flex flex-col gap-2.5">
        <h3 className="text-balance text-h3 text-stone-900">Key Numbers</h3>
        <dl className="grid grid-cols-2 gap-2">
          {tiles.map((tile) => (
            <div
              key={tile.label}
              className="flex min-w-0 flex-col gap-0.5 rounded-xl border border-stone-200 bg-card px-3.5 py-3 shadow-e1"
            >
              <dt className="text-label text-stone-500">{tile.label}</dt>
              <dd
                className={`truncate text-h3 tabular-nums ${
                  tile.value === "n/a" ? "font-normal text-stone-500" : (tile.tone ?? "text-stone-900")
                }`}
                title={tile.title ?? tile.value}
              >
                {tile.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </Drawer>
  );
}
