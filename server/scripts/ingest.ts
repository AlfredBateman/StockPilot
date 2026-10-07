// Daily ingest: fetches every ticker from Yahoo Finance and upserts it into
// MongoDB, one document per ticker. Run by .github/workflows/ingest.yml after
// the NSE close; the data is end-of-day, never live.
//
// Rules:
// - A ticker that fails this run is simply not written, so its document keeps
//   the previous day's data. Nothing is ever deleted.
// - meta.failed always records this run's failures.
// - meta.asOf only moves forward if at most 10% of tickers failed; otherwise
//   it keeps the old date, so the app never claims fresh data when much of it
//   is stale. The run then exits non-zero so the workflow shows red.
//
// Run with: npm run ingest (from the repo root or server/). Needs MONGODB_URI.
import "dotenv/config";
import { StockSchema } from "../src/data/stockSchema.js";
import { TICKERS } from "../src/data/tickers.js";
import { fetchStocks } from "../src/data/yahooFetch.js";
import {
  closeMongoClient,
  countStocks,
  getDb,
  readMeta,
  tooManyFailed,
  upsertStocks,
  writeMeta,
} from "../src/data/mongoSource.js";

const SOURCE = "yahoo-finance2";

async function main() {
  if (!process.env.MONGODB_URI?.trim()) {
    console.error("MONGODB_URI is not set. Nothing was fetched or written.");
    process.exitCode = 1;
    return;
  }

  const total = TICKERS.length;
  console.log(`Fetching ${total} tickers from Yahoo Finance...`);
  const { stocks, failed } = await fetchStocks(
    TICKERS.map((t) => t.symbol),
    {
      onProgress: (ticker, index, error) => {
        const status = error ? `FAILED: ${error}` : "ok";
        console.log(`[${index + 1}/${total}] ${ticker} — ${status}`);
      },
    }
  );

  const runAt = new Date().toISOString();
  const db = getDb();
  await upsertStocks(db, stocks.map((s) => StockSchema.parse(s)), runAt);
  const count = await countStocks(db);

  const runFailed = tooManyFailed(failed.length, total);
  const previous = await readMeta(db);
  const asOf = runFailed ? previous?.asOf : runAt;
  if (asOf) {
    await writeMeta(db, { asOf, source: SOURCE, count, failed });
  } else {
    console.error("No previous asOf and too many failures: meta not written, so the app keeps using data/stocks.json.");
  }

  console.log(`\nUpserted ${stocks.length} of ${total} tickers. Failed: ${failed.length}.`);
  for (const f of failed) console.log(`  ${f.ticker}: ${f.error} (kept previous data)`);
  console.log(`Stock documents now in MongoDB: ${count}`);
  console.log(`meta.asOf: ${asOf ?? "not written"}`);

  if (runFailed) {
    console.error(`\nMore than 10% of tickers failed (${failed.length}/${total}); asOf was not advanced.`);
    process.exitCode = 1;
  }
}

main()
  .catch(() => {
    // Generic on purpose: the driver's message can include the cluster hostname and these logs are public.
    console.error("MongoDB connection failed, check MONGODB_URI and Atlas network access");
    process.exitCode = 1;
  })
  .finally(() => closeMongoClient());
