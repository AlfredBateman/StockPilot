import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Stock } from "../api/client";
import { CHART_TOOLTIP_STYLE, countBySector } from "./chartData";

type SectorChartProps = {
  items: Pick<Stock, "sector">[];
};

/** Height per sector row; the chart grows with the number of sectors instead of squeezing them. */
const ROW_HEIGHT = 30;
/** Bar thickness; the data-end radius is half of it, so each bar ends in a full round cap. */
const BAR_SIZE = 18;

// A count-per-sector overview of the current (filtered + searched, not just
// the visible page) result set. Updates whenever Screener's filters change.
// Horizontal bars so sector names read left-to-right instead of rotated.
export function SectorChart({ items }: SectorChartProps) {
  const data = countBySector(items);

  return (
    <section
      aria-labelledby="sector-chart-heading"
      className="flex flex-col gap-4 self-start rounded-2xl border border-stone-200 bg-card p-4 shadow-e1 sm:p-6"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="sector-chart-heading" className="text-balance text-h2 text-stone-900">
          Stocks by Sector
        </h2>
        <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-label tabular-nums text-stone-600">
          {items.length} {items.length === 1 ? "stock" : "stocks"}
        </span>
      </div>

      {data.length === 0 ? (
        <p className="text-body text-stone-600">No sector data for the current filters.</p>
      ) : (
        <div
          role="img"
          aria-label={`Bar chart, stocks by sector: ${data.map((d) => `${d.sector} ${d.count}`).join(", ")}.`}
        >
          <ResponsiveContainer width="100%" height={data.length * ROW_HEIGHT + 8}>
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 32, bottom: 0, left: 0 }}>
              {/* Every bar is labelled at its tip, so a value axis would only repeat those numbers. */}
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="sector"
                width={164}
                tick={{ fontSize: 12, fill: "var(--color-stone-600)" }}
                tickLine={false}
                axisLine={false}
                interval={0}
              />
              <Tooltip
                formatter={(value) => [typeof value === "number" ? `${value}` : "n/a", "Stocks"]}
                cursor={{ fill: "var(--color-stone-100)", radius: 8 }}
                {...CHART_TOOLTIP_STYLE}
              />
              <Bar
                dataKey="count"
                fill="var(--color-chart-1)"
                barSize={BAR_SIZE}
                radius={[0, BAR_SIZE / 2, BAR_SIZE / 2, 0]}
                isAnimationActive={false}
              >
                <LabelList
                  dataKey="count"
                  position="right"
                  style={{ fontSize: 12, fontWeight: 600, fill: "var(--color-stone-700)" }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
