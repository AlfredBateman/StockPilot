import { useEffect, useState } from "react";
import { getStock, type SortSpec, type Stock } from "../api/client";
import { CompareBar } from "../components/CompareBar";
import { CompareView } from "../components/CompareView";
import { sortStocksClient } from "../components/clientSort";
import { EmptyPanel, ErrorPanel, TableSkeleton } from "../components/StatePanels";
import { StockDetail } from "../components/StockDetail";
import { StockTable } from "../components/StockTable";
import { useWatchlist } from "../hooks/useWatchlist";

const COMPARE_LIMIT = 3;
/** The watchlist is a short, hand-picked list, so one page is always enough: this is really just "unpaginated". */
const PAGE_SIZE = 100;

type WatchlistState = { kind: "loading" } | { kind: "ready"; stocks: Stock[] } | { kind: "error"; message: string };

// Same StockTable component as Screener, fed by getStock (one request per
// watched ticker, no new endpoint) instead of POST /api/screen, since this
// view is never about the whole universe, just whatever's starred.
export function Watchlist() {
  const { tickers, toggle: toggleWatch } = useWatchlist();
  const [state, setState] = useState<WatchlistState>({ kind: "loading" });
  const [sort, setSort] = useState<SortSpec | undefined>(undefined);
  const [detailTicker, setDetailTicker] = useState<string | null>(null);
  const [compareTickers, setCompareTickers] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const tickerKey = tickers.join(",");

  useEffect(() => {
    if (tickers.length === 0) {
      setState({ kind: "ready", stocks: [] });
      return;
    }
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
    // tickerKey is the stable form of the tickers array dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickerKey]);

  function toggleCompare(ticker: string) {
    setCompareTickers((current) => {
      if (current.includes(ticker)) return current.filter((t) => t !== ticker);
      if (current.length >= COMPARE_LIMIT) return current;
      return [...current, ticker];
    });
  }

  return (
    <main id="main-content" className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:gap-8 md:px-6 md:py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-balance text-h1 text-stone-900">Watchlist</h1>
        <p className="text-caption text-stone-500">Stocks you&rsquo;ve starred. Saved in this browser only.</p>
      </header>

      <div aria-live="polite" className="flex flex-col gap-4">
        {state.kind === "loading" && (
          <TableSkeleton rows={Math.min(Math.max(tickers.length, 1), 6)} label="Loading watchlist…" />
        )}

        {state.kind === "error" && (
          <ErrorPanel
            title="Couldn’t Load Your Watchlist"
            message={state.message}
            hint="Check that the StockPilot server is running, then open this tab again to retry."
          />
        )}

        {state.kind === "ready" && state.stocks.length === 0 && (
          <EmptyPanel
            title="No Stocks Starred Yet"
            hint="Tap the star next to any stock on the Screen tab and it will show up here."
          />
        )}

        {state.kind === "ready" && state.stocks.length > 0 && (
          <>
            <StockTable
              items={sortStocksClient(state.stocks, sort)}
              total={state.stocks.length}
              page={1}
              pageSize={PAGE_SIZE}
              onPageChange={() => {}}
              sort={sort}
              onSortChange={setSort}
              selectedTickers={compareTickers}
              onToggleCompare={toggleCompare}
              onViewDetail={setDetailTicker}
              watchedTickers={tickers}
              onToggleWatch={toggleWatch}
            />

            {compareTickers.length > 0 && (
              <CompareBar tickers={compareTickers} limit={COMPARE_LIMIT} onOpen={() => setCompareOpen(true)} />
            )}
          </>
        )}
      </div>

      {detailTicker && <StockDetail ticker={detailTicker} onClose={() => setDetailTicker(null)} />}

      {compareOpen && compareTickers.length > 0 && (
        <CompareView tickers={compareTickers} onClose={() => setCompareOpen(false)} onRemove={toggleCompare} />
      )}
    </main>
  );
}
