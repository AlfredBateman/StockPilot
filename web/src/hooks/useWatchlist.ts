import { useEffect, useState } from "react";

const STORAGE_KEY = "stockpilot:watchlist";

/**
 * Reads the saved ticker list from localStorage. Returns [] whenever
 * anything is wrong with it — missing, corrupt JSON, not an array, storage
 * disabled (private browsing) — rather than throwing, so a broken/blocked
 * storage backend never crashes the app; it just means the watchlist starts
 * empty.
 */
export function loadWatchlist(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

/** Same never-throw guarantee as loadWatchlist, for writes (storage disabled, or full). */
export function saveWatchlist(tickers: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tickers));
  } catch {
    // Watchlist just won't survive a refresh; nothing else to do about it.
  }
}

/** Tickers only — the actual Stock data is always re-fetched by ticker, never cached here. */
export function useWatchlist() {
  const [tickers, setTickers] = useState<string[]>(() => loadWatchlist());

  useEffect(() => {
    saveWatchlist(tickers);
  }, [tickers]);

  function toggle(ticker: string) {
    setTickers((current) => (current.includes(ticker) ? current.filter((t) => t !== ticker) : [...current, ticker]));
  }

  return { tickers, toggle };
}
