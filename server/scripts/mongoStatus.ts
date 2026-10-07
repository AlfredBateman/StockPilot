// Prints what is in MongoDB right now: the number of stock documents and the
// meta doc (asOf, count, failed tickers). Read-only. Never prints the URI.
//
// Run with: npm run mongo:status (from server/).
import "dotenv/config";
import { closeMongoClient, countStocks, getDb, readMeta } from "../src/data/mongoSource.js";

async function main() {
  if (!process.env.MONGODB_URI?.trim()) {
    console.error("MONGODB_URI is not set.");
    process.exitCode = 1;
    return;
  }

  const db = getDb();
  const count = await countStocks(db);
  const meta = await readMeta(db);
  console.log(`Stock documents in MongoDB: ${count}`);
  console.log(`meta.asOf:   ${meta?.asOf ?? "n/a"}`);
  console.log(`meta.count:  ${meta?.count ?? "n/a"}`);
  console.log(`meta.source: ${meta?.source ?? "n/a"}`);
  const failed = meta?.failed ?? [];
  console.log(`meta.failed: ${failed.length === 0 ? "none" : failed.map((f) => f.ticker).join(", ")}`);
}

main()
  .catch(() => {
    // Generic on purpose: the driver's message can include the cluster hostname and these logs are public.
    console.error("MongoDB connection failed, check MONGODB_URI and Atlas network access");
    process.exitCode = 1;
  })
  .finally(() => closeMongoClient());
