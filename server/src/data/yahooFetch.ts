// Fetches stock data from Yahoo Finance (via the unofficial `yahoo-finance2`
// package) and maps it into the app's Stock shape. Shared by
// scripts/snapshot.ts and the planned ingest job, so the field mapping and the
// D/E unit conversion live in exactly one place.
//
// Only scripts import this file. No server route does, so the running app
// (and DEMO_MODE in particular) never makes a call to Yahoo.
import YahooFinance from "yahoo-finance2";
import { debtToEquityRatio } from "./debtToEquity.js";
import type { Stock, WeeklyClose } from "./stockSchema.js";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DEFAULT_RETRY_DELAY_MS = 1000;

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
  // Yahoo's endpoints aren't official and will throttle bursts of requests;
  // a small, spaced-out queue keeps ~200 requests (2 per ticker) reliable.
  queue: { concurrency: 3, interval: 200 },
});

/** Converts a UTC Date to the NSE trading day (IST) as "YYYY-MM-DD". */
function toIstDateString(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Fetches one ticker's summary and ~1 year of weekly closes. Throws on any Yahoo error. */
export async function fetchStock(ticker: string): Promise<Stock> {
  const summary = await yahooFinance.quoteSummary(ticker, {
    modules: ["price", "summaryDetail", "financialData", "assetProfile"],
  });

  const period1 = new Date();
  period1.setFullYear(period1.getFullYear() - 1);
  const chart = await yahooFinance.chart(ticker, { period1, interval: "1wk" });

  const weeklyCloses: WeeklyClose[] = chart.quotes
    .map((q): WeeklyClose => ({ date: toIstDateString(q.date), close: q.close ?? null }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return {
    ticker,
    name: summary.price?.longName ?? summary.price?.shortName ?? null,
    sector: summary.assetProfile?.sector ?? null,
    price: summary.price?.regularMarketPrice ?? null,
    marketCap: summary.price?.marketCap ?? summary.summaryDetail?.marketCap ?? null,
    pe: summary.summaryDetail?.trailingPE ?? null,
    // Yahoo reports D/E as a percentage; the rest of the app uses a true ratio.
    debtToEquity: debtToEquityRatio(summary.financialData?.debtToEquity),
    profitMargin: summary.financialData?.profitMargins ?? null,
    weeklyCloses,
  };
}

export type FailedTicker = { ticker: string; error: string };

export type FetchStocksOptions = {
  /** Wait before the single retry. Tests pass 0. */
  retryDelayMs?: number;
  /** Fetches one ticker. Defaults to fetchStock; tests swap in a fake so they never touch the network. */
  fetchOne?: (ticker: string) => Promise<Stock>;
  /** Called once per ticker after its final attempt; error is set only if it failed. */
  onProgress?: (ticker: string, index: number, error?: string) => void;
};

/**
 * Fetches every ticker in order, one at a time. Each ticker gets one retry
 * after a failure; if it still fails, it goes into `failed` and the batch
 * moves on. One bad ticker never stops the rest. The caller decides what an
 * incomplete batch means (snapshot.ts refuses to write the file).
 */
export async function fetchStocks(
  tickers: string[],
  options: FetchStocksOptions = {}
): Promise<{ stocks: Stock[]; failed: FailedTicker[] }> {
  const { retryDelayMs = DEFAULT_RETRY_DELAY_MS, fetchOne = fetchStock, onProgress } = options;
  const stocks: Stock[] = [];
  const failed: FailedTicker[] = [];

  for (const [index, ticker] of tickers.entries()) {
    let lastError = "unknown error";
    let stock: Stock | null = null;

    for (let attempt = 1; attempt <= 2 && !stock; attempt++) {
      try {
        stock = await fetchOne(ticker);
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        if (attempt === 1) await new Promise((r) => setTimeout(r, retryDelayMs));
      }
    }

    if (stock) {
      stocks.push(stock);
      onProgress?.(ticker, index);
    } else {
      failed.push({ ticker, error: lastError });
      onProgress?.(ticker, index, lastError);
    }
  }

  return { stocks, failed };
}
