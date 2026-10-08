import { useEffect, useState } from "react";
import { getSectors, screenStocks, type FilterSpec, type SortSpec, type Stock } from "../api/client";
import { CompareBar } from "../components/CompareBar";
import { CompareView } from "../components/CompareView";
import { FilterChips } from "../components/FilterChips";
import { FilterPanel } from "../components/FilterPanel";
import { togglePreset, type ActivePreset } from "../components/filterSpecUtils";
import { PresetBar } from "../components/PresetBar";
import { QueryBox } from "../components/QueryBox";
import { SearchBar } from "../components/SearchBar";
import { SectorChart } from "../components/SectorChart";
import { EmptyPanel, ErrorPanel, TableSkeleton } from "../components/StatePanels";
import { StockDetail } from "../components/StockDetail";
import { COMPARE_LIMIT, StockTable } from "../components/StockTable";
import { useWatchlist } from "../hooks/useWatchlist";

const PAGE_SIZE = 25;
/** The whole universe is 100 stocks, so a pageSize this large always returns every match unpaginated. */
const ALL_MATCHING_PAGE_SIZE = 100;
/** Filter/search edits are debounced before hitting the network, so a controlled
 * input stays cheap per keystroke instead of firing a request per character. */
const QUERY_DEBOUNCE_MS = 300;

type ScreenState =
  | { kind: "loading" }
  | { kind: "ready"; items: Stock[]; total: number; asOf: string; refreshing: boolean }
  | { kind: "error"; message: string };

export function Screener() {
  const [filters, setFilters] = useState<FilterSpec>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortSpec | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [sectors, setSectors] = useState<string[]>([]);
  const [state, setState] = useState<ScreenState>({ kind: "loading" });
  const [retryToken, setRetryToken] = useState(0);
  const [activePreset, setActivePreset] = useState<ActivePreset>(null);
  // QueryBox keeps its own text and answer card; changing its key throws both away ("Clear all filters").
  const [queryBoxKey, setQueryBoxKey] = useState(0);

  // All stocks matching the current filters/search (not just the visible
  // page), for SectorChart. Kept separate from the table's own paginated
  // fetch above so neither has to know about the other.
  const [allMatching, setAllMatching] = useState<Stock[]>([]);

  const [detailTicker, setDetailTicker] = useState<string | null>(null);
  const [compareTickers, setCompareTickers] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const { tickers: watchedTickers, toggle: toggleWatch } = useWatchlist();

  // Debounced copy of {filters, search}: typing updates `filters`/`search`
  // immediately (so the controls themselves feel instant), but the network
  // request below only fires once typing pauses.
  const [debouncedQuery, setDebouncedQuery] = useState({ filters, search });
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery({ filters, search }), QUERY_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filters, search]);

  // The sector list is only for populating FilterPanel's checkboxes; if it
  // fails to load the page still works, just with no sector filter options.
  useEffect(() => {
    getSectors()
      .then(setSectors)
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState((prev) => (prev.kind === "ready" ? { ...prev, refreshing: true } : { kind: "loading" }));

    screenStocks({ ...debouncedQuery, sort, page, pageSize: PAGE_SIZE })
      .then((result) => {
        if (!cancelled) setState({ kind: "ready", ...result, refreshing: false });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({ kind: "error", message: err instanceof Error ? err.message : "n/a" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, sort, page, retryToken]);

  useEffect(() => {
    let cancelled = false;
    screenStocks({ ...debouncedQuery, page: 1, pageSize: ALL_MATCHING_PAGE_SIZE })
      .then((result) => {
        if (!cancelled) setAllMatching(result.items);
      })
      .catch(() => {
        // SectorChart is a secondary view; if this fetch fails the main
        // table's own error state (above) already tells the user why.
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, retryToken]);

  function toggleCompare(ticker: string) {
    setCompareTickers((current) => {
      if (current.includes(ticker)) return current.filter((t) => t !== ticker);
      if (current.length >= COMPARE_LIMIT) return current; // capped at 3
      return [...current, ticker];
    });
  }

  // Any change to what's being asked for invalidates the current page number.
  // A filter edit that doesn't come from a preset card also ends the preset, so a card is "Active" only while
  // its exact filters are still applied.
  function updateFilters(next: FilterSpec) {
    setFilters(next);
    setActivePreset(null);
    setPage(1);
  }
  function applyPreset(name: string, presetFilters: FilterSpec) {
    const next = togglePreset(activePreset, filters, name, presetFilters);
    setFilters(next.filters);
    setActivePreset(next.active);
    setPage(1);
  }
  function clearAll() {
    updateFilters([]);
    setSearch("");
    setQueryBoxKey((k) => k + 1);
  }
  function updateSearch(next: string) {
    setSearch(next);
    setPage(1);
  }
  function updateSort(next: SortSpec) {
    setSort(next);
    setPage(1);
  }

  const showChart = allMatching.length > 0;
  const refreshing = state.kind === "ready" && state.refreshing;

  return (
    <main id="main-content" className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:gap-8 md:px-6 md:py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-balance text-h1 text-stone-900">Stock Screener</h1>
      </header>

      {/* The hero: the only double-bezel card on the page (docs/DESIGN.md section 12), so the plain-English
          query reads as the entry point. The outer shell is a teal-tinted tray; the inner core is the card. */}
      <section className="rounded-[1.75rem] bg-gradient-to-b from-accent-100 to-stone-100 p-1.5 shadow-e2 ring-1 ring-accent-200/70">
        <div className="flex flex-col gap-7 rounded-[1.375rem] bg-card p-5 shadow-[inset_0_1px_0_rgb(255_255_255/0.9)] sm:p-8">
          <QueryBox key={queryBoxKey} onApply={updateFilters} />
          <div className="flex flex-col gap-3.5 border-t border-stone-200 pt-6">
            <h2 className="text-balance text-h3 text-stone-800">Or Start From a Preset</h2>
            <PresetBar activeName={activePreset?.name ?? null} onToggle={applyPreset} />
          </div>
        </div>
      </section>

      <div className="grid gap-6 md:gap-8 lg:grid-cols-3">
        <section
          aria-labelledby="filters-heading"
          className={`flex flex-col gap-6 rounded-2xl border border-stone-200 bg-card p-4 shadow-e1 sm:p-6 ${
            showChart ? "lg:col-span-2" : "lg:col-span-3"
          }`}
        >
          <h2 id="filters-heading" className="text-h2 text-stone-900">
            Filters
          </h2>
          <SearchBar value={search} onChange={updateSearch} />
          <FilterPanel filters={filters} onChange={updateFilters} sectors={sectors} />
          <FilterChips
            filters={filters}
            onRemove={(index) => updateFilters(filters.filter((_, i) => i !== index))}
            onClearAll={clearAll}
          />
        </section>

        {showChart && <SectorChart items={allMatching} />}
      </div>

      <section aria-labelledby="results-heading" className="flex flex-col gap-4">
        <div className="flex min-h-7 items-center justify-between gap-3">
          <h2 id="results-heading" className="flex items-baseline gap-2.5 text-h2 text-stone-900">
            Results
            {state.kind === "ready" && (
              <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-label tabular-nums text-stone-600 ring-1 ring-stone-200">
                {state.total} {state.total === 1 ? "stock" : "stocks"}
              </span>
            )}
          </h2>
          {/* A reserved slot, so "Updating" never pushes the table down. */}
          {refreshing && (
            <span className="inline-flex h-7 items-center rounded-full border border-stone-200 bg-elevated px-3 text-label text-stone-600 shadow-e1">
              Updating…
            </span>
          )}
        </div>

        <div aria-live="polite" aria-busy={refreshing}>
          {state.kind === "loading" && <TableSkeleton label="Loading stocks…" />}

          {state.kind === "ready" && state.total === 0 && (
            <EmptyPanel
              title="No Stocks Match Your Filters"
              hint={
                search.trim()
                  ? "Try a different search, or remove a filter."
                  : "Try removing a filter or widening one of the ranges."
              }
              action={filters.length > 0 ? { label: "Clear all filters", onClick: clearAll } : undefined}
            />
          )}

          {state.kind === "ready" && state.total > 0 && (
            <div className={`transition-opacity duration-150 ${refreshing ? "opacity-60" : ""}`}>
              <StockTable
                items={state.items}
                total={state.total}
                page={page}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
                sort={sort}
                onSortChange={updateSort}
                selectedTickers={compareTickers}
                onToggleCompare={toggleCompare}
                onViewDetail={setDetailTicker}
                watchedTickers={watchedTickers}
                onToggleWatch={toggleWatch}
              />
            </div>
          )}
        </div>

        {state.kind === "error" && (
          <ErrorPanel
            title="Couldn’t Reach the Server"
            message={state.message}
            onRetry={() => setRetryToken((t) => t + 1)}
          />
        )}

        {compareTickers.length > 0 && (
          <CompareBar tickers={compareTickers} limit={COMPARE_LIMIT} onOpen={() => setCompareOpen(true)} />
        )}
      </section>

      {detailTicker && <StockDetail ticker={detailTicker} onClose={() => setDetailTicker(null)} />}

      {compareOpen && compareTickers.length > 0 && (
        <CompareView tickers={compareTickers} onClose={() => setCompareOpen(false)} onRemove={toggleCompare} />
      )}
    </main>
  );
}
