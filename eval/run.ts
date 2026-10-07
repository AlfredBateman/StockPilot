import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { readSnapshotFromFile } from "../server/src/data/loadStocks.js";
import type { Filter, FilterSpec } from "../server/src/engine/filterSpec.js";
import { callLlm } from "../server/src/nl/llmClient.js";
import type { ParseIntent } from "../server/src/nl/llmPrompt.js";
import { parseQuery } from "../server/src/nl/ruleParser.js";
import { fixTypos } from "../server/src/nl/typoFix.js";
import { zeroResultHelp } from "../server/src/nl/zeroResultHelp.js";

// Scores the offline pipeline (typo fix + rule parser, always) and, if an LLM
// key is configured, the LLM tier ALONE (callLlm, no guard/cache/rules
// fallback) against a hand-built set of queries. It also checks that the
// server's zero-result help finds a suggestion where one is expected, and
// times every LLM call. Never touches app code, only calls exported functions.
//
// process.loadEnvFile (Node stdlib, no dotenv dependency needed here) reads
// ./.env relative to cwd, same default dotenv/config uses in server/src/index.ts.
// This script runs via `npm run eval --prefix server`, so cwd is server/ and
// the same server/.env applies. Missing file = same as no env vars set.
// Nothing from it is ever printed.
try {
  process.loadEnvFile();
} catch {
  // No .env file — LLM_* vars simply stay unset, which is the offline path.
}

const CATEGORIES = [
  "simple",
  "vague",
  "numeric",
  "unanswerable",
  "typo",
  "messy",
  "question",
  "advice",
  "offtopic",
  "zeroResult",
] as const;
type Category = (typeof CATEGORIES)[number];

type EvalQuery = {
  id: string;
  query: string;
  category: Category;
  expectedFilters: FilterSpec;
  /** Defaults to "filter". The rule parser can only ever answer "filter". */
  expectedIntent?: ParseIntent;
  /** True for queries that match zero stocks and should get a suggestion chip. */
  expectSuggestions?: boolean;
  status: "unreviewed" | "reviewed";
};

type FilterScore = { precision: number; recall: number; fullMatch: boolean };

/** Pause between LLM calls, so a full run does not trip the provider's per-minute rate limit. */
const LLM_SPACING_MS = 1600;

const QUERIES_PATH = path.resolve(import.meta.dirname, "queries.json");
const RESULTS_PATH = path.resolve(import.meta.dirname, "results.md");
const STOCKS_PATH = path.resolve(import.meta.dirname, "../data/stocks.json");

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

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function pct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

type TierRun = {
  filters: FilterSpec;
  intent: ParseIntent;
  score: FilterScore;
  intentOk: boolean;
  /** null when the query expects no suggestion, so it isn't scored. */
  suggestionsOk: boolean | null;
};

type Row = {
  q: EvalQuery;
  correctedQuery: string | null;
  rules: TierRun;
  llm: TierRun | null;
  /** Wall-clock time of the LLM call; null when the LLM tier is not configured. */
  llmMs: number | null;
  /** True when callLlm returned null (timeout, HTTP error, or a reply that failed validation). */
  llmFailed: boolean;
  llmAnswer: string | null;
};

function aggregate(runs: TierRun[]) {
  const suggestionRuns = runs.filter((r) => r.suggestionsOk !== null);
  return {
    precision: average(runs.map((r) => r.score.precision)),
    recall: average(runs.map((r) => r.score.recall)),
    fullMatchRate: average(runs.map((r) => (r.score.fullMatch ? 1 : 0))),
    fullMatches: runs.filter((r) => r.score.fullMatch).length,
    intentRate: average(runs.map((r) => (r.intentOk ? 1 : 0))),
    intentHits: runs.filter((r) => r.intentOk).length,
    suggestionHits: suggestionRuns.filter((r) => r.suggestionsOk).length,
    suggestionTotal: suggestionRuns.length,
  };
}

function buildReport(rows: Row[], llmConfigured: boolean): string {
  const lines: string[] = [];
  const counts = CATEGORIES.map((cat) => `${rows.filter((r) => r.q.category === cat).length} ${cat}`).join(", ");

  lines.push("# NL Query Eval Results", "");
  lines.push(`${rows.length} queries (${counts}), all "unreviewed".`, "");
  lines.push(
    '"Rules" means the offline pipeline the app runs first: typo fix, then the rule parser. It always answers intent "filter", so it can never get a question, advice or off-topic query right on intent.',
    ""
  );
  lines.push(
    "The LLM column is the cloud LLM called alone, with no guard, cache or rules fallback. A failed call (timeout, HTTP error, or a reply discarded by validation) scores as no filters and intent \"filter\".",
    ""
  );

  lines.push("## Overall", "");
  lines.push("| Tier | Precision | Recall | Full-query match | Intent correct | Zero-result help |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  const r = aggregate(rows.map((row) => row.rules));
  lines.push(
    `| Rules | ${r.precision.toFixed(2)} | ${r.recall.toFixed(2)} | ${pct(r.fullMatchRate)} (${r.fullMatches}/${rows.length}) | ${pct(r.intentRate)} (${r.intentHits}/${rows.length}) | ${r.suggestionHits}/${r.suggestionTotal} |`
  );
  if (llmConfigured) {
    const l = aggregate(rows.map((row) => row.llm!));
    lines.push(
      `| LLM (alone, no fallback) | ${l.precision.toFixed(2)} | ${l.recall.toFixed(2)} | ${pct(l.fullMatchRate)} (${l.fullMatches}/${rows.length}) | ${pct(l.intentRate)} (${l.intentHits}/${rows.length}) | ${l.suggestionHits}/${l.suggestionTotal} |`
    );
  } else {
    lines.push("| LLM (alone, no fallback) | skipped: no LLM_PROVIDER/LLM_API_KEY/LLM_MODEL configured | | | | |");
  }
  lines.push("");

  lines.push("## By category", "");
  lines.push(
    llmConfigured
      ? "| Category | Rules P | Rules R | Rules full | Rules intent | LLM P | LLM R | LLM full | LLM intent |"
      : "| Category | Rules P | Rules R | Rules full | Rules intent |"
  );
  lines.push(llmConfigured ? "| --- | --- | --- | --- | --- | --- | --- | --- | --- |" : "| --- | --- | --- | --- | --- |");
  for (const cat of CATEGORIES) {
    const catRows = rows.filter((row) => row.q.category === cat);
    if (catRows.length === 0) continue;
    const cr = aggregate(catRows.map((row) => row.rules));
    const rulesCells = `${cr.precision.toFixed(2)} | ${cr.recall.toFixed(2)} | ${pct(cr.fullMatchRate)} | ${pct(cr.intentRate)}`;
    if (llmConfigured) {
      const cl = aggregate(catRows.map((row) => row.llm!));
      lines.push(
        `| ${cat} | ${rulesCells} | ${cl.precision.toFixed(2)} | ${cl.recall.toFixed(2)} | ${pct(cl.fullMatchRate)} | ${pct(cl.intentRate)} |`
      );
    } else {
      lines.push(`| ${cat} | ${rulesCells} |`);
    }
  }
  lines.push("");

  if (llmConfigured) {
    const times = rows.map((row) => row.llmMs!).filter((ms) => ms !== null);
    const failed = rows.filter((row) => row.llmFailed).length;
    lines.push("## LLM latency", "");
    lines.push(
      `Provider: ${process.env.LLM_PROVIDER?.trim()}, model: ${process.env.LLM_MODEL?.trim()}. Wall-clock time per call, measured in this run from this machine, ${times.length} calls.`,
      ""
    );
    lines.push("| Median | Worst case | Failed or discarded calls |");
    lines.push("| --- | --- | --- |");
    lines.push(`| ${seconds(median(times))} | ${seconds(Math.max(...times))} | ${failed}/${times.length} |`);
    lines.push("");

    lines.push("## LLM answers (question, advice, offtopic)", "");
    for (const row of rows.filter((x) => x.q.expectedIntent && x.q.expectedIntent !== "filter")) {
      lines.push(`- **${row.q.id}** \`${row.q.query}\` -> intent ${row.llm!.intent}: ${row.llmAnswer ?? "n/a"}`);
    }
    lines.push("");
  }

  lines.push("## Failing cases", "");
  const failing = rows.filter(
    (row) =>
      !row.rules.score.fullMatch ||
      !row.rules.intentOk ||
      row.rules.suggestionsOk === false ||
      (llmConfigured && (!row.llm!.score.fullMatch || !row.llm!.intentOk || row.llm!.suggestionsOk === false))
  );
  if (failing.length === 0) {
    lines.push("None: every query got a full-query match from every scored tier.");
  } else {
    for (const row of failing) {
      const intent = row.q.expectedIntent ?? "filter";
      lines.push(`- **${row.q.id}** \`${row.q.query}\` (${row.q.category})`);
      lines.push(`  - expected: intent ${intent}, filters ${JSON.stringify(row.q.expectedFilters)}`);
      if (row.correctedQuery) lines.push(`  - typo fix: \`${row.correctedQuery}\``);
      if (!row.rules.score.fullMatch || !row.rules.intentOk || row.rules.suggestionsOk === false) {
        const help = row.rules.suggestionsOk === false ? ", no zero-result suggestion" : "";
        lines.push(`  - rules got: intent ${row.rules.intent}, filters ${JSON.stringify(row.rules.filters)}${help}`);
      }
      if (llmConfigured && (!row.llm!.score.fullMatch || !row.llm!.intentOk || row.llm!.suggestionsOk === false)) {
        const status = row.llmFailed ? " (call failed or reply discarded)" : "";
        lines.push(`  - LLM got: intent ${row.llm!.intent}, filters ${JSON.stringify(row.llm!.filters)}${status}`);
      }
    }
  }
  lines.push("");

  return lines.join("\n");
}

async function main() {
  const llmConfigured = Boolean(
    process.env.LLM_PROVIDER?.trim() && process.env.LLM_API_KEY?.trim() && process.env.LLM_MODEL?.trim()
  );
  const { stocks } = await readSnapshotFromFile(STOCKS_PATH);

  function run(q: EvalQuery, filters: FilterSpec, intent: ParseIntent, unmatched: string[]): TierRun {
    return {
      filters,
      intent,
      score: scoreFilters(q.expectedFilters, filters),
      intentOk: intent === (q.expectedIntent ?? "filter"),
      suggestionsOk: q.expectSuggestions ? zeroResultHelp(stocks, filters, unmatched).length > 0 : null,
    };
  }

  const rows: Row[] = [];
  for (const [index, q] of queries.entries()) {
    const fixed = fixTypos(q.query);
    const parsed = parseQuery(fixed.text);
    const rules = run(q, parsed.filters, "filter", parsed.unmatched);

    let llm: TierRun | null = null;
    let llmMs: number | null = null;
    let llmFailed = false;
    let llmAnswer: string | null = null;
    if (llmConfigured) {
      if (index > 0) await sleep(LLM_SPACING_MS);
      const started = performance.now();
      const reply = await callLlm(fixed.text);
      llmMs = performance.now() - started;
      llmFailed = reply === null;
      llmAnswer = reply?.answer ?? null;
      llm = run(q, reply?.filters ?? [], reply?.intent ?? "filter", []);
      console.log(`${q.id} ${reply ? reply.intent : "failed"} ${seconds(llmMs)}`);
    }

    rows.push({ q, correctedQuery: fixed.corrections.length > 0 ? fixed.text : null, rules, llm, llmMs, llmFailed, llmAnswer });
  }

  writeFileSync(RESULTS_PATH, buildReport(rows, llmConfigured), "utf-8");

  const r = aggregate(rows.map((row) => row.rules));
  console.log(
    `Rules: precision ${r.precision.toFixed(2)} recall ${r.recall.toFixed(2)} full-match ${pct(r.fullMatchRate)} intent ${pct(r.intentRate)}`
  );
  if (llmConfigured) {
    const l = aggregate(rows.map((row) => row.llm!));
    const times = rows.map((row) => row.llmMs!);
    console.log(
      `LLM:   precision ${l.precision.toFixed(2)} recall ${l.recall.toFixed(2)} full-match ${pct(l.fullMatchRate)} intent ${pct(l.intentRate)}`
    );
    console.log(`LLM latency: median ${seconds(median(times))}, worst ${seconds(Math.max(...times))}`);
  } else {
    console.log("LLM:   skipped (no LLM_PROVIDER/LLM_API_KEY/LLM_MODEL configured)");
  }
  console.log(`Wrote ${RESULTS_PATH}`);
}

main();
