// Loads data/stocks.json into MongoDB, for a fresh, empty database. The meta
// asOf is the file's own asOf, so no date is made up.
//
// It refuses to run if the stocks collection already has documents, because
// the file is usually older than what the daily ingest wrote. Pass --force to
// overwrite anyway (it still never deletes documents).
//
// Run with: npm run seed (from the repo root or server/), or npm run seed -- --force.
import "dotenv/config";
import path from "node:path";
import { errorSummary } from "./errorSummary.js";
import { readSnapshotFromFile } from "../src/data/loadStocks.js";
import { closeMongoClient, countStocks, getDb, upsertStocks, writeMeta } from "../src/data/mongoSource.js";

const DATA_PATH = path.resolve(import.meta.dirname, "../../data/stocks.json");

async function main() {
  if (!process.env.MONGODB_URI?.trim()) {
    console.error("MONGODB_URI is not set. Nothing was written.");
    process.exitCode = 1;
    return;
  }

  const db = getDb();
  const existing = await countStocks(db);
  if (existing > 0 && !process.argv.includes("--force")) {
    console.error(`MongoDB already has ${existing} stock documents. Not overwriting them with data/stocks.json.`);
    console.error("Run `npm run seed -- --force` if you really want to.");
    process.exitCode = 1;
    return;
  }

  const snapshot = await readSnapshotFromFile(DATA_PATH);
  await upsertStocks(db, snapshot.stocks, snapshot.asOf);
  const count = await countStocks(db);
  await writeMeta(db, { asOf: snapshot.asOf, source: snapshot.source, count, failed: [] });
  console.log(`Seeded ${snapshot.stocks.length} stocks (asOf ${snapshot.asOf}). Stock documents now in MongoDB: ${count}`);
}

main()
  .catch((err) => {
    // Name and code only, never the message (see errorSummary.ts).
    console.error(`MongoDB connection failed (${errorSummary(err)}), check MONGODB_URI and Atlas network access`);
    process.exitCode = 1;
  })
  .finally(() => closeMongoClient());
