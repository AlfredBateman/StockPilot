// Fetches ~100 NIFTY 50 + NIFTY NEXT 50 stocks from Yahoo Finance (via the
// unofficial `yahoo-finance2` package) and writes data/stocks.json.
//
// This is the ONLY place stock data is allowed to come from — never hand-edit
// data/stocks.json. If any ticker fails to fetch, the script logs every
// failure and exits without writing the file, so the app never runs on a
// silently-incomplete snapshot.
//
// Run with: npm run snapshot (from the repo root) or `npx tsx scripts/snapshot.ts` (from server/).
import { writeFile } from "node:fs/promises";
import path from "node:path";
import YahooFinance from "yahoo-finance2";
import { debtToEquityRatio } from "../src/data/debtToEquity.js";
import { TICKERS } from "../src/data/tickers.js";
import { SnapshotSchema, type Stock, type WeeklyClose } from "../src/data/stockSchema.js";

const SOURCE = "yahoo-finance2";
const OUTPUT_PATH = path.resolve(import.meta.dirname, "../../data/stocks.json");
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
  // Yahoo's endpoints aren't official and will throttle bursts of requests;
  // a small, spaced-out queue keeps ~200 requests (2 per ticker) reliable.
  queue: { concurrency: 3, interval: 200 },
});

type FetchResult = { ticker: string; stock: Stock } | { ticker: string; error: string };

/** Converts a UTC Date to the NSE trading day (IST) as "YYYY-MM-DD". */
function toIstDateString(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

async function fetchOneStock(symbol: string): Promise<Stock> {
  const summary = await yahooFinance.quoteSummary(symbol, {
    modules: ["price", "summaryDetail", "financialData", "assetProfile"],
  });

  const period1 = new Date();
  period1.setFullYear(period1.getFullYear() - 1);
  const chart = await yahooFinance.chart(symbol, { period1, interval: "1wk" });

  const weeklyCloses: WeeklyClose[] = chart.quotes
    .map((q): WeeklyClose => ({ date: toIstDateString(q.date), close: q.close ?? null }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return {
    ticker: symbol,
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

/** Fetches one ticker, retrying once after a transient failure before giving up. */
async function fetchWithRetry(symbol: string): Promise<FetchResult> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const stock = await fetchOneStock(symbol);
      return { ticker: symbol, stock };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (attempt === 2) return { ticker: symbol, error: message };
      console.warn(`  retrying ${symbol} after error: ${message}`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  // Unreachable, but keeps TypeScript happy.
  return { ticker: symbol, error: "unknown error" };
}

async function main() {
  console.log(`Fetching ${TICKERS.length} tickers from Yahoo Finance...`);

  const results: FetchResult[] = [];
  for (const [i, { symbol }] of TICKERS.entries()) {
    const result = await fetchWithRetry(symbol);
    results.push(result);
    const status = "error" in result ? `FAILED: ${result.error}` : "ok";
    console.log(`[${i + 1}/${TICKERS.length}] ${symbol} — ${status}`);
  }

  const failures = results.filter((r): r is { ticker: string; error: string } => "error" in r);

  if (failures.length > 0) {
    console.error(`\n${failures.length} of ${TICKERS.length} tickers failed to fetch:`);
    for (const f of failures) console.error(`  ${f.ticker}: ${f.error}`);
    console.error("\nSTOPPING without writing data/stocks.json. Fix the failing tickers or retry.");
    process.exitCode = 1;
    return;
  }

  const stocks = results
    .filter((r): r is { ticker: string; stock: Stock } => "stock" in r)
    .map((r) => r.stock);

  const snapshot = SnapshotSchema.parse({
    asOf: new Date().toISOString(),
    source: SOURCE,
    stocks,
  });

  await writeFile(OUTPUT_PATH, JSON.stringify(snapshot, null, 2) + "\n", "utf-8");
  console.log(`\nWrote ${stocks.length} stocks to ${OUTPUT_PATH}`);

  console.log("\nSample of 5 stocks (cross-check against Google Finance):");
  const sample = stocks.slice(0, 5);
  for (const s of sample) {
    console.log(
      `  ${s.ticker.padEnd(14)} ${(s.name ?? "n/a").padEnd(35)} price=${s.price ?? "n/a"} marketCap=${
        s.marketCap ?? "n/a"
      } pe=${s.pe ?? "n/a"} debtToEquity=${s.debtToEquity ?? "n/a"} profitMargin=${s.profitMargin ?? "n/a"}`
    );
  }
}

main().catch((err) => {
  console.error("Unexpected error while running snapshot:", err);
  process.exitCode = 1;
});
