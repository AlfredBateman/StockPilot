// One-off connectivity check: can Yahoo Finance (via yahoo-finance2) be reached
// from a GitHub Actions runner? Fetches 5 tickers from data/stocks.json with the
// same quoteSummary modules and weekly chart call as snapshot.ts, one at a time
// with 1s spacing, and prints OK/FAIL, any HTTP status or error message, and
// which fields came back null. It never writes data/stocks.json.
//
// Run with: npx tsx scripts/cloudFetchTest.ts (from server/).
import { readFile } from "node:fs/promises";
import path from "node:path";
import YahooFinance from "yahoo-finance2";

const DATA_PATH = path.resolve(import.meta.dirname, "../../data/stocks.json");
// HDFCBANK is the bank: Yahoo often leaves debtToEquity empty for banks.
const TEST_TICKERS = ["HDFCBANK.NS", "RELIANCE.NS", "TCS.NS", "INFY.NS", "ITC.NS"];
const SPACING_MS = 1000;

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

/** Pulls out whatever HTTP status / code the error carries, without assuming a shape. */
function describeError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const e = err as Error & { code?: unknown; status?: unknown; statusCode?: unknown; response?: { status?: unknown } };
  const status = e.response?.status ?? e.status ?? e.statusCode;
  const parts = [`${e.name}: ${e.message}`];
  if (status !== undefined) parts.push(`HTTP status ${String(status)}`);
  if (e.code !== undefined) parts.push(`code ${String(e.code)}`);
  if (e.cause instanceof Error) parts.push(`cause ${e.cause.name}: ${e.cause.message}`);
  return parts.join(" | ");
}

async function testOne(symbol: string): Promise<boolean> {
  try {
    const summary = await yahooFinance.quoteSummary(symbol, {
      modules: ["price", "summaryDetail", "financialData", "assetProfile"],
    });

    const period1 = new Date();
    period1.setFullYear(period1.getFullYear() - 1);
    const chart = await yahooFinance.chart(symbol, { period1, interval: "1wk" });

    const fields: Record<string, unknown> = {
      name: summary.price?.longName ?? summary.price?.shortName ?? null,
      sector: summary.assetProfile?.sector ?? null,
      price: summary.price?.regularMarketPrice ?? null,
      marketCap: summary.price?.marketCap ?? summary.summaryDetail?.marketCap ?? null,
      pe: summary.summaryDetail?.trailingPE ?? null,
      debtToEquity: summary.financialData?.debtToEquity ?? null,
      profitMargin: summary.financialData?.profitMargins ?? null,
      weeklyCloses: chart.quotes.length > 0 ? chart.quotes.length : null,
    };
    const nullFields = Object.entries(fields)
      .filter(([, v]) => v === null)
      .map(([k]) => k);

    console.log(
      `OK   ${symbol} | quoteSummary + chart succeeded (${chart.quotes.length} weekly quotes) | null fields: ${
        nullFields.length > 0 ? nullFields.join(", ") : "none"
      }`
    );
    return true;
  } catch (err) {
    console.log(`FAIL ${symbol} | ${describeError(err)}`);
    return false;
  }
}

async function main() {
  const snapshot = JSON.parse(await readFile(DATA_PATH, "utf-8")) as { stocks: { ticker: string }[] };
  const known = new Set(snapshot.stocks.map((s) => s.ticker));
  const missing = TEST_TICKERS.filter((t) => !known.has(t));
  if (missing.length > 0) {
    console.error(`Test tickers not found in data/stocks.json: ${missing.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Node ${process.version}. Testing ${TEST_TICKERS.length} tickers against Yahoo Finance...`);
  let okCount = 0;
  for (const [i, symbol] of TEST_TICKERS.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, SPACING_MS));
    if (await testOne(symbol)) okCount++;
  }

  console.log(`\nResult: ${okCount}/${TEST_TICKERS.length} tickers OK`);
  if (okCount < TEST_TICKERS.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exitCode = 1;
});
