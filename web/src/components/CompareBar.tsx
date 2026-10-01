import { displayTicker } from "./format";

type CompareBarProps = {
  tickers: string[];
  limit: number;
  onOpen: () => void;
};

// The "N of 3 selected" strip that opens CompareView, shared by Screener and
// Watchlist. A dark teal bar that sticks to the bottom of the viewport, so it
// stays reachable while the user scrolls through the table picking stocks.
export function CompareBar({ tickers, limit, onOpen }: CompareBarProps) {
  const canCompare = tickers.length >= 2;

  return (
    <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-2xl bg-accent-900 p-3 text-white shadow-e2 ring-1 ring-white/10 sm:flex-row sm:items-center sm:justify-between sm:pl-5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-h3">
          {tickers.length} of {limit} selected to compare
        </p>
        <p className="truncate text-body text-accent-200">
          <span translate="no" className="font-mono text-ticker">
            {tickers.map(displayTicker).join(", ")}
          </span>
          {!canCompare && ". Pick at least one more to compare."}
        </p>
      </div>
      <button
        type="button"
        onClick={onOpen}
        disabled={!canCompare}
        className="h-10 shrink-0 touch-manipulation rounded-xl bg-elevated px-5 text-body font-semibold text-accent-800 shadow-e1 transition-[background-color,transform] duration-150 hover:bg-accent-100 focus-visible:outline-white active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/70 disabled:shadow-none disabled:hover:bg-white/15 disabled:active:scale-100"
      >
        Compare ({tickers.length})
      </button>
    </div>
  );
}
