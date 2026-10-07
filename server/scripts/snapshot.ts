// Fetches ~100 NIFTY 50 + NIFTY NEXT 50 stocks from Yahoo Finance and writes
// data/stocks.json. The actual Yahoo calls and field mapping live in
// src/data/yahooFetch.ts; this script only runs the batch and writes the file.
//
// This is the ONLY place stock data is allowed to come from — never hand-edit
// data/stocks.json. The batch always tries every ticker, but if any of them
// still fail after a retry, the script logs every failure and exits without
// writing the file, so the app never runs on a silently-incomplete snapshot.
//
// Run with: npm run snapshot (from the repo root) or `npx tsx scripts/snapshot.ts` (from server/).
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { TICKERS } from "../src/data/tickers.js";
import { SnapshotSchema } from "../src/data/stockSchema.js";
import { fetchStocks } from "../src/data/yahooFetch.js";

const SOURCE = "yahoo-finance2";
const OUTPUT_PATH = path.resolve(import.meta.dirname, "../../data/stocks.json");

async function main() {
  console.log(`Fetching ${TICKERS.length} tickers from Yahoo Finance...`);

  const { stocks, failed } = await fetchStocks(
    TICKERS.map((t) => t.symbol),
    {
      onProgress: (ticker, index, error) => {
        const status = error ? `FAILED: ${error}` : "ok";
        console.log(`[${index + 1}/${TICKERS.length}] ${ticker} — ${status}`);
      },
    }
  );

  if (failed.length > 0) {
    console.error(`\n${failed.length} of ${TICKERS.length} tickers failed to fetch:`);
    for (const f of failed) console.error(`  ${f.ticker}: ${f.error}`);
    console.error("\nSTOPPING without writing data/stocks.json. Fix the failing tickers or retry.");
    process.exitCode = 1;
    return;
  }

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
