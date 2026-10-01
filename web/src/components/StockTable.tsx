import { useLayoutEffect, useRef } from "react";
import type { SortField, SortSpec, Stock } from "../api/client";
import { displayTicker, formatMarketCapCrore, formatPercent, formatPrice, formatRatio } from "./format";
import { IconChevron, IconSort, IconStar } from "./Icons";
import { MetricHelp, type GlossaryKey } from "./MetricHelp";
import { animateRowsIn } from "./motion";

const COMPARE_LIMIT = 3;

type StockTableProps = {
  items: Stock[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  sort?: SortSpec;
  onSortChange: (sort: SortSpec) => void;
  /** Tickers currently picked for CompareView, capped at COMPARE_LIMIT. */
  selectedTickers: string[];
  onToggleCompare: (ticker: string) => void;
  /** Clicking a ticker opens its StockDetail drawer. */
  onViewDetail: (ticker: string) => void;
  /** Tickers currently on the watchlist (hooks/useWatchlist). */
  watchedTickers: string[];
  onToggleWatch: (ticker: string) => void;
};

type Column = {
  field: SortField;
  label: string;
  align: "left" | "right";
  /** Fixed column width, so long names/sectors truncate instead of wrapping into uneven row heights. Empty = takes the leftover width. */
  width: string;
  truncate?: boolean;
  render: (stock: Stock) => string;
  /** When set, a MetricHelp "?" appears next to this column's header/label. */
  metricKey?: GlossaryKey;
};

const COLUMNS: Column[] = [
  { field: "ticker", label: "Ticker", align: "left", width: "w-40", render: (s) => displayTicker(s.ticker) },
  { field: "name", label: "Name", align: "left", width: "", truncate: true, render: (s) => s.name ?? "n/a" },
  { field: "sector", label: "Sector", align: "left", width: "w-40", truncate: true, render: (s) => s.sector ?? "n/a" },
  { field: "price", label: "Price", align: "right", width: "w-28", render: (s) => formatPrice(s.price) },
  {
    field: "marketCap",
    label: "Market Cap",
    align: "right",
    width: "w-36",
    render: (s) => formatMarketCapCrore(s.marketCap),
    metricKey: "marketCap",
  },
  { field: "pe", label: "P/E", align: "right", width: "w-20", render: (s) => formatRatio(s.pe), metricKey: "pe" },
  {
    field: "debtToEquity",
    label: "Debt/Equity",
    align: "right",
    width: "w-32",
    render: (s) => formatRatio(s.debtToEquity),
    metricKey: "debtToEquity",
  },
  {
    field: "profitMargin",
    label: "Profit Margin",
    align: "right",
    width: "w-36",
    render: (s) => formatPercent(s.profitMargin),
    metricKey: "profitMargin",
  },
];

/** The four columns with a glossary entry, shown as a 2x2 grid on mobile cards. */
const METRIC_COLUMNS = COLUMNS.filter((column) => column.metricKey);

/** Flips a MetricHelp popover to open leftwards, so it stays on-screen for right-aligned/right-hand labels. */
const POPOVER_OPENS_LEFT = "[&_[role=tooltip]]:left-auto [&_[role=tooltip]]:right-0";

function StarToggle({ ticker, watched, onToggle }: { ticker: string; watched: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={watched}
      aria-label={watched ? `Remove ${displayTicker(ticker)} from watchlist` : `Add ${displayTicker(ticker)} to watchlist`}
      className={`flex size-8 shrink-0 touch-manipulation items-center justify-center rounded-lg transition-colors duration-150 hover:bg-stone-100 ${
        watched ? "text-accent-600" : "text-stone-400 hover:text-stone-700"
      }`}
    >
      <IconStar filled={watched} size={17} />
    </button>
  );
}

function CompareCheckbox({
  ticker,
  checked,
  disabled,
  onToggle,
  className = "",
}: {
  ticker: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onToggle}
      aria-label={`Select ${displayTicker(ticker)} to compare`}
      className={`size-4 cursor-pointer accent-accent-600 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    />
  );
}

export function StockTable({
  items,
  total,
  page,
  pageSize,
  onPageChange,
  sort,
  onSortChange,
  selectedTickers,
  onToggleCompare,
  onViewDetail,
  watchedTickers,
  onToggleWatch,
}: StockTableProps) {
  const compareLimitReached = selectedTickers.length >= COMPARE_LIMIT;
  function handleSort(field: SortField) {
    if (sort?.field === field) {
      onSortChange({ field, direction: sort.direction === "asc" ? "desc" : "asc" });
    } else {
      onSortChange({ field, direction: "asc" });
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  // Animation (a): rows animate in on each data load. Keyed on the tickers shown (in order),
  // not on the `items` array itself, so ticking a compare box or a star, which re-renders with
  // the same rows, never replays it. Desktop rows and mobile cards stagger separately.
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);
  const cardListRef = useRef<HTMLUListElement>(null);
  const rowKey = items.map((stock) => stock.ticker).join(",");
  useLayoutEffect(() => {
    animateRowsIn(Array.from(tableBodyRef.current?.children ?? []) as HTMLElement[]);
    animateRowsIn(Array.from(cardListRef.current?.children ?? []) as HTMLElement[]);
  }, [rowKey]);

  function renderPagination(className: string) {
    const buttonClass =
      "inline-flex h-10 touch-manipulation items-center gap-1.5 rounded-xl border border-stone-300 bg-elevated px-3.5 text-body font-medium text-stone-800 shadow-e1 transition-[background-color,transform] duration-150 hover:bg-stone-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-elevated disabled:active:scale-100";
    return (
      <div className={`flex flex-wrap items-center justify-between gap-3 text-body ${className}`}>
        <span aria-live="polite" className="tabular-nums text-stone-600">
          Showing <span className="font-semibold text-stone-900">{rangeStart}-{rangeEnd}</span> of{" "}
          <span className="font-semibold text-stone-900">{total}</span>
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1} className={buttonClass}>
              <IconChevron direction="left" size={16} />
              Previous
            </button>
            <span className="hidden px-1 tabular-nums text-stone-600 sm:inline">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className={buttonClass}
            >
              Next
              <IconChevron direction="right" size={16} />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Desktop / tablet: a table inside a card. table-fixed + explicit column widths so long
          names/sectors truncate (with a title tooltip) instead of wrapping into uneven row heights.
          Below xl the table keeps a minimum width and scrolls sideways inside its card rather
          than crushing columns; the page itself never scrolls sideways. */}
      <div className="hidden rounded-2xl border border-stone-200 bg-card shadow-e1 sm:block">
        <div className="overflow-x-auto rounded-t-2xl xl:overflow-visible">
          <table className="w-full min-w-[71rem] table-fixed text-body xl:min-w-0">
            <colgroup>
              <col className="w-[4.75rem]" />
              {COLUMNS.map((column) => (
                <col key={column.field} className={column.width} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="h-11 whitespace-nowrap rounded-tl-2xl bg-accent-900 px-3 text-left text-label text-white/80"
                >
                  Compare
                </th>
                {COLUMNS.map((column, index) => {
                  const isSorted = sort?.field === column.field;
                  const isLast = index === COLUMNS.length - 1;
                  return (
                    <th
                      key={column.field}
                      scope="col"
                      aria-sort={isSorted ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
                      className={`h-11 whitespace-nowrap bg-accent-900 px-3 text-label [&_button:focus-visible]:outline-accent-300 ${
                        column.align === "right" ? "text-right" : "text-left"
                      } ${isLast ? "rounded-tr-2xl" : ""} ${isSorted ? "text-white" : "text-white/80"}`}
                    >
                      <span
                        className={`inline-flex items-center ${
                          column.align === "right" ? `justify-end ${POPOVER_OPENS_LEFT}` : ""
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSort(column.field)}
                          className="-mx-1 inline-flex touch-manipulation items-center gap-1 rounded-md px-1 py-1 transition-colors duration-150 hover:text-white focus-visible:outline-accent-300"
                        >
                          {column.label}
                          <IconSort
                            direction={isSorted ? sort.direction : null}
                            size={14}
                            className={isSorted ? "text-accent-300" : "text-white/45"}
                          />
                        </button>
                        {column.metricKey && <MetricHelp metric={column.metricKey} />}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody ref={tableBodyRef}>
              {items.map((stock) => {
                const isSelected = selectedTickers.includes(stock.ticker);
                const isWatched = watchedTickers.includes(stock.ticker);
                return (
                  <tr
                    key={stock.ticker}
                    className={`border-b border-stone-200 transition-colors duration-150 last:border-b-0 ${
                      isSelected ? "bg-accent-100/70" : "even:bg-stone-50 hover:bg-accent-100/40"
                    }`}
                  >
                    <td className={`p-0 ${isSelected ? "shadow-[inset_3px_0_0_var(--color-accent-600)]" : ""}`}>
                      {/* The label fills the cell, so the whole cell toggles the checkbox (no dead zone). */}
                      <label className="flex h-13 cursor-pointer touch-manipulation items-center px-3 has-[:disabled]:cursor-not-allowed">
                        <CompareCheckbox
                          ticker={stock.ticker}
                          checked={isSelected}
                          disabled={!isSelected && compareLimitReached}
                          onToggle={() => onToggleCompare(stock.ticker)}
                          className="ml-1.5"
                        />
                      </label>
                    </td>
                    {COLUMNS.map((column) => {
                      const value = column.render(stock);
                      if (column.field === "ticker") {
                        return (
                          <td key={column.field} className="py-2 pl-1 pr-3 text-left">
                            <span className="flex items-center gap-1">
                              <StarToggle
                                ticker={stock.ticker}
                                watched={isWatched}
                                onToggle={() => onToggleWatch(stock.ticker)}
                              />
                              <button
                                type="button"
                                onClick={() => onViewDetail(stock.ticker)}
                                translate="no"
                                className="touch-manipulation truncate rounded-md font-mono text-ticker font-semibold text-stone-900 underline-offset-4 transition-colors duration-150 hover:text-accent-700 hover:underline"
                              >
                                {value}
                              </button>
                            </span>
                          </td>
                        );
                      }
                      const isNumber = column.align === "right";
                      const isPrice = column.field === "price";
                      const tone =
                        value === "n/a"
                          ? "text-stone-500"
                          : isPrice
                            ? "font-semibold text-stone-900"
                            : isNumber
                              ? "text-stone-700"
                              : "text-stone-600";
                      return (
                        <td
                          key={column.field}
                          title={column.truncate ? value : undefined}
                          className={`h-13 px-3 ${column.truncate ? "truncate" : "whitespace-nowrap"} ${
                            isNumber ? "text-right tabular-nums" : "text-left"
                          } ${tone}`}
                        >
                          {value}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {renderPagination("rounded-b-2xl border-t border-stone-200 bg-stone-50/70 px-4 py-3")}
      </div>

      {/* Below 640px: one card per stock (docs/DESIGN.md section 22). Labels sit above values so they never collide. */}
      <ul ref={cardListRef} className="flex flex-col gap-3 sm:hidden">
        {items.map((stock) => {
          const isSelected = selectedTickers.includes(stock.ticker);
          const isWatched = watchedTickers.includes(stock.ticker);
          const compareDisabled = !isSelected && compareLimitReached;
          const price = formatPrice(stock.price);
          return (
            <li
              key={stock.ticker}
              className={`rounded-2xl border bg-card p-4 shadow-e1 transition-colors duration-150 ${
                isSelected ? "border-accent-300 ring-1 ring-accent-300" : "border-stone-200"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => onViewDetail(stock.ticker)}
                  className="-m-1 min-w-0 touch-manipulation rounded-lg p-1 text-left"
                >
                  <span
                    translate="no"
                    className="block font-mono text-[0.9375rem] font-semibold tracking-[0.02em] text-stone-900 underline-offset-4 hover:underline"
                  >
                    {displayTicker(stock.ticker)}
                  </span>
                  <span className="block truncate text-body text-stone-600">{stock.name ?? "n/a"}</span>
                </button>
                <StarToggle ticker={stock.ticker} watched={isWatched} onToggle={() => onToggleWatch(stock.ticker)} />
              </div>

              <div className="mt-3 flex items-end justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-label text-stone-500">Price</span>
                  <span
                    className={`text-2xl font-semibold tracking-tight tabular-nums ${price === "n/a" ? "text-stone-500" : "text-stone-900"}`}
                  >
                    {price}
                  </span>
                </div>
                <span className="inline-flex h-6 max-w-[55%] items-center rounded-full border border-stone-200 bg-stone-50 px-2.5 text-label text-stone-600">
                  <span className="truncate">{stock.sector ?? "n/a"}</span>
                </span>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 border-t border-stone-200 pt-3">
                {METRIC_COLUMNS.map((column) => {
                  const value = column.render(stock);
                  return (
                    // Right-hand grid cells open their "?" popover leftwards so it stays inside a 375px screen.
                    <div
                      key={column.field}
                      className="flex flex-col gap-0.5 [&_[role=tooltip]]:w-56 even:[&_[role=tooltip]]:left-auto even:[&_[role=tooltip]]:right-0"
                    >
                      <dt className="flex items-center text-label text-stone-500">
                        {column.label}
                        {column.metricKey && <MetricHelp metric={column.metricKey} />}
                      </dt>
                      <dd
                        className={`text-body font-medium tabular-nums ${value === "n/a" ? "text-stone-500" : "text-stone-900"}`}
                      >
                        {value}
                      </dd>
                    </div>
                  );
                })}
              </dl>

              <label
                className={`mt-4 inline-flex h-9 touch-manipulation items-center gap-2 rounded-full border px-3.5 text-body shadow-e1 transition-colors duration-150 ${
                  isSelected
                    ? "border-accent-600 bg-accent-100 font-medium text-accent-800"
                    : "border-stone-300 bg-elevated text-stone-700"
                } ${compareDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
              >
                <CompareCheckbox
                  ticker={stock.ticker}
                  checked={isSelected}
                  disabled={compareDisabled}
                  onToggle={() => onToggleCompare(stock.ticker)}
                />
                {compareDisabled ? `Compare (max ${COMPARE_LIMIT})` : "Compare"}
              </label>
            </li>
          );
        })}
      </ul>
      {renderPagination("sm:hidden")}
    </div>
  );
}
