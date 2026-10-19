import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SortField, SortSpec, Stock } from "../api/client";
import {
  debtToEquityNote,
  displayTicker,
  formatDebtToEquity,
  formatMarketCapCrore,
  formatPercent,
  formatPrice,
  formatRatio,
  formatSignedPercent,
} from "./format";
import { IconCheck, IconChevron, IconSort, IconStar } from "./Icons";
import type { GlossaryKey } from "./glossary";
import { MetricHelp } from "./MetricHelp";
import { animateRowsIn, popStar } from "./motion";
import { HISTORY_CAPTION } from "./stockMetrics";

export const COMPARE_LIMIT = 3;

/** True once any table has shown data, so the row entrance plays on the first load only (not when returning to a tab). */
let introPlayed = false;

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
  /** Optional hover text for this cell (e.g. why a bank has no Debt/Equity). */
  title?: (stock: Stock) => string | undefined;
  /** When set, a MetricHelp "?" appears next to this column's header/label. */
  metricKey?: GlossaryKey;
};

const COLUMNS: Column[] = [
  { field: "ticker", label: "Ticker", align: "left", width: "w-36", render: (s) => displayTicker(s.ticker) },
  { field: "name", label: "Name", align: "left", width: "", truncate: true, render: (s) => s.name ?? "n/a" },
  {
    field: "sector",
    label: "Sector",
    align: "left",
    width: "w-36",
    truncate: true,
    render: (s) => s.sector ?? "n/a",
    metricKey: "sector",
  },
  {
    field: "price",
    label: "Price",
    align: "right",
    width: "w-28",
    render: (s) => formatPrice(s.price),
    metricKey: "price",
  },
  {
    field: "marketCap",
    label: "Market Cap",
    align: "right",
    width: "w-36",
    render: (s) => formatMarketCapCrore(s.marketCap),
    metricKey: "marketCap",
  },
  { field: "pe", label: "P/E", align: "right", width: "w-28", render: (s) => formatRatio(s.pe), metricKey: "pe" },
  {
    field: "debtToEquity",
    label: "Debt/Equity",
    align: "right",
    width: "w-40",
    render: (s) => formatDebtToEquity(s.debtToEquity),
    title: debtToEquityNote,
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

/** The same identity columns (ticker, name, sector, price), then the price-history metrics instead of the fundamentals. */
const HISTORY_COLUMNS: Column[] = [
  ...COLUMNS.slice(0, 4),
  {
    field: "belowHigh52w",
    label: "Below 52W High",
    align: "right",
    width: "w-44",
    render: (s) => formatRatio(s.belowHigh52w, "%"),
    metricKey: "range52w",
  },
  {
    field: "change3m",
    label: "3M Change",
    align: "right",
    width: "w-36",
    render: (s) => formatSignedPercent(s.change3m),
    metricKey: "longChange",
  },
  {
    field: "change6m",
    label: "6M Change",
    align: "right",
    width: "w-36",
    render: (s) => formatSignedPercent(s.change6m),
    metricKey: "longChange",
  },
  {
    field: "change1y",
    label: "1Y Change",
    align: "right",
    width: "w-36",
    render: (s) => formatSignedPercent(s.change1y),
    metricKey: "longChange",
  },
];

type TableView = "fundamentals" | "history";

const VIEWS: { key: TableView; label: string; columns: Column[] }[] = [
  { key: "fundamentals", label: "Fundamentals", columns: COLUMNS },
  { key: "history", label: "Price History", columns: HISTORY_COLUMNS },
];

/** The four numeric columns shown as a 2x2 grid on mobile cards (price and sector have their own spots there). */
function metricColumns(columns: Column[]): Column[] {
  return columns.filter((column) => column.metricKey && column.field !== "price" && column.field !== "sector");
}

/** The lines saying how one stock meets each active filter, shown when its "Why?" disclosure is open. */
function ReasonList({ reasons }: { reasons: string[] }) {
  return (
    <ul className="mt-1.5 mb-1 flex flex-col gap-1 whitespace-normal text-caption text-stone-700">
      {reasons.map((reason) => (
        <li key={reason} className="flex items-start gap-1.5">
          <IconCheck size={12} className="mt-0.5 shrink-0 text-accent-600" />
          {reason}
        </li>
      ))}
    </ul>
  );
}

function StarToggle({ ticker, watched, onToggle }: { ticker: string; watched: boolean; onToggle: () => void }) {
  // Animation (c): a pop when the star turns on (not on first render, not when it turns off).
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasWatched = useRef(watched);
  useEffect(() => {
    const added = watched && !wasWatched.current;
    wasWatched.current = watched;
    if (added && buttonRef.current) return popStar(buttonRef.current);
  }, [watched]);

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onToggle}
      aria-pressed={watched}
      aria-label={watched ? `Remove ${displayTicker(ticker)} from watchlist` : `Add ${displayTicker(ticker)} to watchlist`}
      className={`flex size-8 shrink-0 touch-manipulation items-center justify-center rounded-lg transition-[color,background-color,scale] duration-(--motion-press) active:scale-95 hover:bg-stone-100 ${
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
  const [view, setView] = useState<TableView>("fundamentals");
  const columns = VIEWS.find((v) => v.key === view)!.columns;
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

  // Animation (a): the rows of the layout on screen animate in the first time the app shows data and when
  // Previous/Next turns the page, never on a filter, sort, search or tab return. Keyed on the tickers shown
  // (in order), so ticking a compare box or a star, which re-renders the same rows, never replays it.
  // The decision is stored per rowKey, so React StrictMode's second effect run in dev plays it too.
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);
  const cardListRef = useRef<HTMLUListElement>(null);
  const pageTurn = useRef(false);
  const decided = useRef<{ key: string; play: boolean } | null>(null);
  const rowKey = items.map((stock) => stock.ticker).join(",");
  useLayoutEffect(() => {
    if (decided.current?.key !== rowKey) {
      decided.current = { key: rowKey, play: pageTurn.current || !introPlayed };
      pageTurn.current = false;
      introPlayed = true;
    }
    if (!decided.current.play) return;
    const visible = [tableBodyRef.current, cardListRef.current].find((el) => el && el.getClientRects().length > 0);
    return animateRowsIn(Array.from(visible?.children ?? []) as HTMLElement[]);
  }, [rowKey]);

  function turnPage(next: number) {
    pageTurn.current = true;
    onPageChange(next);
  }

  function renderPagination(className: string) {
    const buttonClass =
      "inline-flex h-10 touch-manipulation items-center gap-1.5 rounded-xl border border-stone-300 bg-elevated px-3.5 text-body font-medium text-stone-800 shadow-e1 transition-[background-color,scale] duration-(--motion-press) hover:bg-stone-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-elevated disabled:active:scale-100";
    return (
      <div className={`flex flex-wrap items-center justify-between gap-3 text-body ${className}`}>
        <span aria-live="polite" className="tabular-nums text-stone-600">
          Showing <span className="font-semibold text-stone-900">{rangeStart}-{rangeEnd}</span> of{" "}
          <span className="font-semibold text-stone-900">{total}</span>
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => turnPage(page - 1)} disabled={page <= 1} className={buttonClass}>
              <IconChevron direction="left" size={16} />
              Previous
            </button>
            <span className="hidden px-1 tabular-nums text-stone-600 sm:inline">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => turnPage(page + 1)}
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div role="group" aria-label="Columns to show" className="flex gap-2">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              aria-pressed={view === v.key}
              onClick={() => setView(v.key)}
              className={`inline-flex h-9 touch-manipulation items-center rounded-full border px-3.5 text-body shadow-e1 transition-[background-color,border-color,color,scale] duration-(--motion-press) active:scale-[0.97] ${
                view === v.key
                  ? "border-accent-600 bg-accent-600 font-medium text-white hover:bg-accent-700"
                  : "border-stone-300 bg-elevated text-stone-700 hover:border-stone-400 hover:text-stone-900"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        {view === "history" && <p className="text-caption text-stone-600">{HISTORY_CAPTION}</p>}
      </div>
      {/* Desktop / tablet: a table inside a card. table-fixed + explicit column widths so long
          names/sectors truncate (with a title tooltip) instead of wrapping into uneven row heights.
          Below xl the table keeps a minimum width and scrolls sideways inside its card rather
          than crushing columns; the page itself never scrolls sideways. */}
      <div className="hidden rounded-2xl border border-stone-200 bg-card shadow-e1 sm:block">
        <div className="overflow-x-auto rounded-t-2xl xl:overflow-visible">
          <table className="w-full min-w-[73rem] table-fixed text-body xl:min-w-0">
            <colgroup>
              <col className="w-[4.75rem]" />
              {columns.map((column) => (
                <col key={column.field} className={column.width} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="h-11 whitespace-nowrap rounded-tl-2xl bg-accent-700 px-3 text-left text-label text-white/80"
                >
                  Compare
                </th>
                {columns.map((column, index) => {
                  const isSorted = sort?.field === column.field;
                  const isLast = index === columns.length - 1;
                  return (
                    <th
                      key={column.field}
                      scope="col"
                      aria-sort={isSorted ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
                      className={`h-11 whitespace-nowrap bg-accent-700 px-3 text-label [&_button:focus-visible]:outline-accent-300 ${
                        column.align === "right" ? "text-right" : "text-left"
                      } ${isLast ? "rounded-tr-2xl" : ""} ${isSorted ? "text-white" : "text-white/80"}`}
                    >
                      <span
                        className={`inline-flex items-center ${
                          column.align === "right" ? "justify-end" : ""
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSort(column.field)}
                          className="-mx-1 inline-flex touch-manipulation items-center gap-1 rounded-md px-1 py-1 transition-[color,scale] duration-(--motion-press) hover:text-white active:scale-[0.97] focus-visible:outline-accent-300"
                        >
                          {column.label}
                          <IconSort
                            direction={isSorted ? sort.direction : null}
                            size={14}
                            className={isSorted ? "text-accent-300" : "text-white/70"}
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
                    className={`border-b border-stone-200 transition-colors duration-(--motion-fast) last:border-b-0 ${
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
                    {columns.map((column) => {
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
                                className="touch-manipulation truncate rounded-md font-mono text-ticker font-semibold text-stone-900 underline-offset-4 transition-colors duration-(--motion-fast) hover:text-accent-700 hover:underline"
                              >
                                {value}
                              </button>
                            </span>
                          </td>
                        );
                      }
                      if (column.field === "name" && stock.reasons?.length) {
                        // A native disclosure: keyboard and screen-reader support for free, and the
                        // row only grows while it is open.
                        return (
                          <td key={column.field} className="min-w-0 px-3 py-3.5 text-left text-stone-600">
                            <details className="group">
                              {/* The name takes the leftover width and truncates, so "Why?" sits at the same x on every row. */}
                              <summary className="group/why flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden">
                                <span className="min-w-0 flex-1 truncate" title={value}>
                                  {value}
                                </span>
                                <span className="inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-lg border border-accent-200 pl-1 pr-0.5 text-xs font-medium text-accent-700 transition-colors duration-(--motion-fast) group-hover/why:bg-accent-100">
                                  <span aria-hidden="true">Why?</span>
                                  <span className="sr-only">Why this stock matched</span>
                                  <IconChevron
                                    direction="right"
                                    size={12}
                                    className="transition-transform duration-(--motion-fast) group-open:rotate-90"
                                  />
                                </span>
                              </summary>
                              <ReasonList reasons={stock.reasons} />
                            </details>
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
                          title={column.truncate ? value : column.title?.(stock)}
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
              className={`rounded-2xl border bg-card p-4 shadow-e1 transition-colors duration-(--motion-fast) ${
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
                  <span className="flex items-center text-label text-stone-500">
                    Price
                    <MetricHelp metric="price" />
                  </span>
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
                {metricColumns(columns).map((column) => {
                  const value = column.render(stock);
                  return (
                    <div key={column.field} className="flex flex-col gap-0.5">
                      <dt className="flex items-center text-label text-stone-500">
                        {column.label}
                        {column.metricKey && <MetricHelp metric={column.metricKey} />}
                      </dt>
                      <dd
                        title={column.title?.(stock)}
                        className={`text-body font-medium tabular-nums ${value === "n/a" ? "text-stone-500" : "text-stone-900"}`}
                      >
                        {value}
                      </dd>
                    </div>
                  );
                })}
              </dl>

              {stock.reasons && stock.reasons.length > 0 && (
                <details className="mt-3 border-t border-stone-200 pt-3">
                  <summary className="cursor-pointer touch-manipulation text-label font-semibold text-accent-700">
                    Why this matched ({stock.reasons.length})
                  </summary>
                  <ReasonList reasons={stock.reasons} />
                </details>
              )}

              <label
                className={`mt-4 inline-flex h-9 touch-manipulation items-center gap-2 rounded-full border px-3.5 text-body shadow-e1 transition-colors duration-(--motion-fast) ${
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
