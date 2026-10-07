// ONE-OFF: converts debtToEquity in the existing data/stocks.json from Yahoo's
// percentage (119.56) to a true ratio (1.1956), so the file matches what
// snapshot.ts now writes. Re-running `npm run snapshot` makes this unnecessary;
// it exists so the committed snapshot can be fixed without hitting the network.
//
// Refuses to run twice: after conversion no value is above ~12, while the
// percentage form has a median around 30. Pass --force to override the check.
//
// Run with: npx tsx scripts/migrateDebtToEquity.ts (from server/).
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { debtToEquityRatio } from "../src/data/debtToEquity.js";
import { SnapshotSchema } from "../src/data/stockSchema.js";

const DATA_PATH = path.resolve(import.meta.dirname, "../../data/stocks.json");
const ALREADY_MIGRATED_BELOW = 30;

async function main() {
  const snapshot = SnapshotSchema.parse(JSON.parse(await readFile(DATA_PATH, "utf-8")));

  const values = snapshot.stocks.flatMap((s) => (s.debtToEquity === null ? [] : [s.debtToEquity]));
  const max = Math.max(...values);
  if (max < ALREADY_MIGRATED_BELOW && !process.argv.includes("--force")) {
    console.error(`Largest debtToEquity is ${max}, so data/stocks.json already looks converted. Nothing changed (--force to override).`);
    process.exitCode = 1;
    return;
  }

  const migrated = {
    ...snapshot,
    stocks: snapshot.stocks.map((s) => ({ ...s, debtToEquity: debtToEquityRatio(s.debtToEquity) })),
  };
  await writeFile(DATA_PATH, JSON.stringify(SnapshotSchema.parse(migrated), null, 2) + "\n", "utf-8");
  console.log(`Converted ${values.length} debtToEquity values (${snapshot.stocks.length - values.length} null left as null).`);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exitCode = 1;
});
