import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseQuery } from "../server/src/nl/ruleParser.js";
import { callLlm } from "../server/src/nl/llmClient.js";
import type { Filter, FilterSpec } from "../server/src/engine/filterSpec.js";

// Scores the rule parser (always) and, if an LLM key is configured, the LLM
// tier ALONE (callLlm, no ollama/cache/rules fallback) against a hand-built
// set of queries. Never touches app code — only reads the two exported pure
// functions the rest of the app already depends on.
//
// process.loadEnvFile (Node stdlib, no dotenv dependency needed here) reads
// ./.env relative to cwd, same default dotenv/config uses in server/src/index.ts.
// This script runs via `npm run eval --prefix server`, so cwd is server/ and
// the same server/.env applies. Missing file = same as no env vars set.
try {
  process.loadEnvFile();
} catch {
  // No .env file — LLM_* vars simply stay unset, which is the offline path.
}

type Category = "simple" | "vague" | "numeric" | "unanswerable";

type EvalQuery = {
  id: string;
  query: string;
  category: Category;
  expectedFilters: FilterSpec;
  status: "unreviewed" | "reviewed";
};

type FilterScore = { precision: number; recall: number; fullMatch: boolean };

const QUERIES_PATH = path.resolve(import.meta.dirname, "queries.json");
const RESULTS_PATH = path.resolve(import.meta.dirname, "results.md");

const queries: EvalQuery[] = JSON.parse(readFileSync(QUERIES_PATH, "utf-8"));

/** field+op+value identity; "in" values are order-independent, everything else isn't. */
function filterKey(f: Filter): string {
  const value = f.op === "in" && Array.isArray(f.value) ? [...f.value].sort() : f.value;
  return JSON.stringify({ field: f.field, op: f.op, value });
}

function scoreFilters(expected: FilterSpec, actual: FilterSpec): FilterScore {
  const remaining = expected.map(filterKey);
  let truePositives = 0;
  for (const key of actual.map(filterKey)) {
    const idx = remaining.indexOf(key);
    if (idx !== -1) {
      truePositives++;
      remaining.splice(idx, 1);
    }
  }
  const precision = actual.length === 0 ? (expected.length === 0 ? 1 : 0) : truePositives / actual.length;
  const recall = expected.length === 0 ? 1 : truePositives / expected.length;
  return { precision, recall, fullMatch: truePositives === expected.length && truePositives === actual.length };
}

function average(nums: number[]): number {
  return nums.length === 0 ? 0 : nums.reduce((a, b) => a + b, 0) / nums.length;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

type Row = { q: EvalQuery; rulesFilters: FilterSpec; rules: FilterScore; llmFilters: FilterSpec | null; llm: FilterScore | null };

function aggregate(rows: Row[], pick: (r: Row) => FilterScore | null) {
  const scores = rows.map(pick).filter((s): s is FilterScore => s !== null);
  return {
    n: scores.length,
    precision: average(scores.map((s) => s.precision)),
    recall: average(scores.map((s) => s.recall)),
    fullMatchRate: average(scores.map((s) => (s.fullMatch ? 1 : 0))),
  };
}

function buildReport(rows: Row[], llmConfigured: boolean): string {
  const categories: Category[] = ["simple", "vague", "numeric", "unanswerable"];
  const lines: string[] = [];

  lines.push("# NL Query Eval Results", "");
  lines.push(`${queries.length} queries (10 simple, 15 vague/compound, 10 numeric, 5 unanswerable), all "unreviewed".`, "");

  lines.push("## Overall");
  lines.push("");
  lines.push("| Tier | Precision | Recall | Full-query match |");
  lines.push("| --- | --- | --- | --- |");
  const overallRules = aggregate(rows, (r) => r.rules);
  lines.push(
    `| Rules | ${overallRules.precision.toFixed(2)} | ${overallRules.recall.toFixed(2)} | ${pct(overallRules.fullMatchRate)} (${rows.filter((r) => r.rules.fullMatch).length}/${rows.length}) |`
  );
  if (llmConfigured) {
    const overallLlm = aggregate(rows, (r) => r.llm);
    lines.push(
      `| LLM (alone, no fallback) | ${overallLlm.precision.toFixed(2)} | ${overallLlm.recall.toFixed(2)} | ${pct(overallLlm.fullMatchRate)} (${rows.filter((r) => r.llm?.fullMatch).length}/${rows.length}) |`
    );
  } else {
    lines.push("| LLM (alone, no fallback) | skipped — no LLM_PROVIDER/LLM_API_KEY/LLM_MODEL configured | | |");
  }
  lines.push("");

  lines.push("## By category");
  lines.push("");
  lines.push(llmConfigured ? "| Category | Rules P | Rules R | Rules full | LLM P | LLM R | LLM full |" : "| Category | Rules P | Rules R | Rules full |");
  lines.push(llmConfigured ? "| --- | --- | --- | --- | --- | --- | --- |" : "| --- | --- | --- | --- |");
  for (const cat of categories) {
    const catRows = rows.filter((r) => r.q.category === cat);
    const catRules = aggregate(catRows, (r) => r.rules);
    if (llmConfigured) {
      const catLlm = aggregate(catRows, (r) => r.llm);
      lines.push(
        `| ${cat} | ${catRules.precision.toFixed(2)} | ${catRules.recall.toFixed(2)} | ${pct(catRules.fullMatchRate)} | ${catLlm.precision.toFixed(2)} | ${catLlm.recall.toFixed(2)} | ${pct(catLlm.fullMatchRate)} |`
      );
    } else {
      lines.push(`| ${cat} | ${catRules.precision.toFixed(2)} | ${catRules.recall.toFixed(2)} | ${pct(catRules.fullMatchRate)} |`);
    }
  }
  lines.push("");

  lines.push("## Failing cases");
  lines.push("");
  const failing = rows.filter((r) => !r.rules.fullMatch || (llmConfigured && !r.llm?.fullMatch));
  if (failing.length === 0) {
    lines.push("None — every query got a full-query match from every scored tier.");
  } else {
    for (const r of failing) {
      lines.push(`- **${r.q.id}** \`${r.q.query}\` (${r.q.category})`);
      lines.push(`  - expected: ${JSON.stringify(r.q.expectedFilters)}`);
      if (!r.rules.fullMatch) lines.push(`  - rules got: ${JSON.stringify(r.rulesFilters)}`);
      if (llmConfigured && !r.llm?.fullMatch) lines.push(`  - LLM got: ${JSON.stringify(r.llmFilters)}`);
    }
  }
  lines.push("");

  return lines.join("\n");
}

async function main() {
  const llmConfigured = Boolean(
    process.env.LLM_PROVIDER?.trim() && process.env.LLM_API_KEY?.trim() && process.env.LLM_MODEL?.trim()
  );

  const rows: Row[] = [];
  for (const q of queries) {
    const rulesFilters = parseQuery(q.query).filters;
    const rules = scoreFilters(q.expectedFilters, rulesFilters);

    let llmFilters: FilterSpec | null = null;
    let llm: FilterScore | null = null;
    if (llmConfigured) {
      llmFilters = await callLlm(q.query);
      llm = scoreFilters(q.expectedFilters, llmFilters ?? []);
    }

    rows.push({ q, rulesFilters, rules, llmFilters, llm });
  }

  writeFileSync(RESULTS_PATH, buildReport(rows, llmConfigured), "utf-8");

  const overallRules = aggregate(rows, (r) => r.rules);
  console.log(
    `Rules: precision ${overallRules.precision.toFixed(2)} recall ${overallRules.recall.toFixed(2)} full-match ${pct(overallRules.fullMatchRate)}`
  );
  if (llmConfigured) {
    const overallLlm = aggregate(rows, (r) => r.llm);
    console.log(
      `LLM:   precision ${overallLlm.precision.toFixed(2)} recall ${overallLlm.recall.toFixed(2)} full-match ${pct(overallLlm.fullMatchRate)}`
    );
  } else {
    console.log("LLM:   skipped (no LLM_PROVIDER/LLM_API_KEY/LLM_MODEL configured)");
  }
  console.log(`Wrote ${RESULTS_PATH}`);
}

main();
