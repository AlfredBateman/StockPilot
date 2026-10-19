import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { readSnapshotFromFile } from "../server/src/data/loadStocks.js";
import type { Filter, FilterSpec } from "../server/src/engine/filterSpec.js";
import { callLlm } from "../server/src/nl/llmClient.js";
import type { ParseIntent } from "../server/src/nl/llmPrompt.js";
import { searchStocks } from "../server/src/engine/searchStocks.js";
import { parseOffline } from "../server/src/nl/parseOrchestrator.js";
import { zeroResultHelp } from "../server/src/nl/zeroResultHelp.js";

// Scores the offline pipeline (typo fix + rule parser + company names, the
// same parseOffline the app runs, always) and, if an LLM
// key is configured, the LLM tier ALONE (callLlm, no guard/cache/rules
// fallback) against a hand-built set of queries. It also checks that the
// server's zero-result help finds a suggestion where one is expected, and
// times every LLM call. Never touches app code, only calls exported functions.
//
// process.loadEnvFile (Node stdlib, no dotenv dependency needed here) reads
// ./.env relative to cwd, same default dotenv/config uses in server/src/index.ts,
// then the repo-root .env; variables already set (shell, server/.env) win.
// This script runs via `npm run eval --prefix server`, so cwd is server/.
// Missing files = same as no env vars set. Nothing from them is ever printed.
for (const envFile of [".env", "../.env"]) {
  try {
    process.loadEnvFile(envFile);
  } catch {
    // No such file — LLM_* vars simply stay unset, which is the offline path.
  }
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
  "names",
] as const;
type Category = (typeof CATEGORIES)[number];

type EvalQuery = {
  id: string;
  query: string;
  category: Category;
  expectedFilters: FilterSpec;
  /** The company-name search the query should produce; omitted means none (null). */
  expectedSearch?: string;
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

/** A full match also needs the right company-name search (none expected = null). */
function scoreFilters(expected: FilterSpec, actual: FilterSpec, searchOk = true): FilterScore {
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
  return { precision, recall, fullMatch: searchOk && truePositives === expected.length && truePositives === actual.length };
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
  /** Company-name search; the LLM never produces one, so it is always null there. */
  search: string | null;
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

/** The heading of the AI part of results.md. It is always the last section, so a later run can carry it over. */
const AI_HEADING = "## AI results (LLM alone, no fallback)";

/** The AI section of the existing results.md, or null when there is none yet. */
function previousAiSection(): string | null {
  try {
    const old = readFileSync(RESULTS_PATH, "utf-8");
    const at = old.indexOf(AI_HEADING);
    return at === -1 ? null : old.slice(at).trimEnd();
  } catch {
    return null;
  }
}

/** The previous AI section, unchanged except for a line saying it was not re-run. */
function keptAiSection(previous: string, queryCount: number): string[] {
  const lines = previous.split("\n");
  // Drop an older "not re-run" note first, so repeated offline runs do not stack them.
  const runAt = lines.findIndex((line) => line.startsWith("Run: "));
  if (runAt !== -1) lines[runAt] = lines[runAt].replace(/ \*\*Not re-run:\*\*.*$/, "");
  const note = `**Not re-run:** these numbers are kept from that run, not from the ${queryCount} queries above. Run \`npm run eval\` with LLM_PROVIDER, LLM_API_KEY and LLM_MODEL set to refresh them.`;
  if (runAt !== -1) lines[runAt] += ` ${note}`;
  else lines.splice(1, 0, "", note);
  return lines;
}

function aiSection(rows: Row[]): string[] {
  const lines: string[] = [AI_HEADING, ""];
  const times = rows.map((row) => row.llmMs!);
  const failed = rows.filter((row) => row.llmFailed).length;
  const today = new Date().toISOString().slice(0, 10);
  lines.push(
    `Run: ${today}, ${rows.length} queries, provider ${process.env.LLM_PROVIDER?.trim()}, model ${process.env.LLM_MODEL?.trim()}. The cloud LLM is called alone, with no guard, cache or rules fallback. A failed call (timeout, HTTP error, or a reply discarded by validation) scores as no filters and intent "filter".`,
    ""
  );

  const l = aggregate(rows.map((row) => row.llm!));
  lines.push("| Precision | Recall | Full-query match | Intent correct | Zero-result help |");
  lines.push("| --- | --- | --- | --- | --- |");
  lines.push(
    `| ${l.precision.toFixed(2)} | ${l.recall.toFixed(2)} | ${pct(l.fullMatchRate)} (${l.fullMatches}/${rows.length}) | ${pct(l.intentRate)} (${l.intentHits}/${rows.length}) | ${l.suggestionHits}/${l.suggestionTotal} |`
  );
  lines.push("");

  lines.push("| Category | LLM P | LLM R | LLM full | LLM intent |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const cat of CATEGORIES) {
    const catRows = rows.filter((row) => row.q.category === cat);
    if (catRows.length === 0) continue;
    const cl = aggregate(catRows.map((row) => row.llm!));
    lines.push(`| ${cat} | ${cl.precision.toFixed(2)} | ${cl.recall.toFixed(2)} | ${pct(cl.fullMatchRate)} | ${pct(cl.intentRate)} |`);
  }
  lines.push("");

  lines.push("Latency (wall-clock per call, from the machine that ran it):", "");
  lines.push("| Median | Worst case | Failed or discarded calls |");
  lines.push("| --- | --- | --- |");
  lines.push(`| ${seconds(median(times))} | ${seconds(Math.max(...times))} | ${failed}/${times.length} |`);
  lines.push("");

  lines.push("Answers (question, advice, offtopic):", "");
  for (const row of rows.filter((x) => x.q.expectedIntent && x.q.expectedIntent !== "filter")) {
    lines.push(`- **${row.q.id}** \`${row.q.query}\` -> intent ${row.llm!.intent}: ${row.llmAnswer ?? "n/a"}`);
  }
  lines.push("");

  lines.push("Cases the LLM did not fully get right:", "");
  const missed = rows.filter((row) => !row.llm!.score.fullMatch || !row.llm!.intentOk || row.llm!.suggestionsOk === false);
  for (const row of missed) {
    const status = row.llmFailed ? " (call failed or reply discarded)" : "";
    lines.push(`- **${row.q.id}** \`${row.q.query}\` (${row.q.category})`);
    lines.push(`  - expected: intent ${row.q.expectedIntent ?? "filter"}, filters ${JSON.stringify(row.q.expectedFilters)}`);
    lines.push(`  - LLM got: intent ${row.llm!.intent}, filters ${JSON.stringify(row.llm!.filters)}${status}`);
  }
  if (missed.length === 0) lines.push("None.");
  lines.push("");
  return lines;
}

function buildReport(rows: Row[], aiLines: string[] | null): string {
  const lines: string[] = [];
  const counts = CATEGORIES.map((cat) => `${rows.filter((r) => r.q.category === cat).length} ${cat}`).join(", ");

  lines.push("# NL Query Eval Results", "");
  lines.push(`${rows.length} queries (${counts}), all "unreviewed".`, "");
  lines.push(
    '"Rules" means the offline pipeline the app runs first: typo fix, rule parser, then company names. It always answers intent "filter", so it can never get a question, advice or off-topic query right on intent.',
    ""
  );
  lines.push(
    'Advice queries that name a company (a01, a02, a05) expect that name search too, because the app does search the name.',
    ""
  );

  lines.push("## Overall (rules)", "");
  lines.push("| Precision | Recall | Full-query match | Intent correct | Zero-result help |");
  lines.push("| --- | --- | --- | --- | --- |");
  const r = aggregate(rows.map((row) => row.rules));
  lines.push(
    `| ${r.precision.toFixed(2)} | ${r.recall.toFixed(2)} | ${pct(r.fullMatchRate)} (${r.fullMatches}/${rows.length}) | ${pct(r.intentRate)} (${r.intentHits}/${rows.length}) | ${r.suggestionHits}/${r.suggestionTotal} |`
  );
  lines.push("");

  lines.push("## By category (rules)", "");
  lines.push("| Category | Rules P | Rules R | Rules full | Rules intent |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const cat of CATEGORIES) {
    const catRows = rows.filter((row) => row.q.category === cat);
    if (catRows.length === 0) continue;
    const cr = aggregate(catRows.map((row) => row.rules));
    lines.push(`| ${cat} | ${cr.precision.toFixed(2)} | ${cr.recall.toFixed(2)} | ${pct(cr.fullMatchRate)} | ${pct(cr.intentRate)} |`);
  }
  lines.push("");

  lines.push("## Failing cases (rules)", "");
  const failing = rows.filter((row) => !row.rules.score.fullMatch || !row.rules.intentOk || row.rules.suggestionsOk === false);
  if (failing.length === 0) {
    lines.push("None: every query got a full-query match from the rules.");
  } else {
    for (const row of failing) {
      const intent = row.q.expectedIntent ?? "filter";
      lines.push(`- **${row.q.id}** \`${row.q.query}\` (${row.q.category})`);
      const expectedSearch = row.q.expectedSearch ? `, search "${row.q.expectedSearch}"` : "";
      lines.push(`  - expected: intent ${intent}, filters ${JSON.stringify(row.q.expectedFilters)}${expectedSearch}`);
      if (row.correctedQuery) lines.push(`  - typo fix: \`${row.correctedQuery}\``);
      const help = row.rules.suggestionsOk === false ? ", no zero-result suggestion" : "";
      const search = row.rules.search ? `, search "${row.rules.search}"` : "";
      lines.push(`  - rules got: intent ${row.rules.intent}, filters ${JSON.stringify(row.rules.filters)}${search}${help}`);
    }
  }
  lines.push("");

  if (aiLines) lines.push(...aiLines);
  return lines.join("\n");
}

async function main() {
  const llmConfigured = Boolean(
    process.env.LLM_PROVIDER?.trim() && process.env.LLM_API_KEY?.trim() && process.env.LLM_MODEL?.trim()
  );
  const { stocks } = await readSnapshotFromFile(STOCKS_PATH);

  function run(q: EvalQuery, filters: FilterSpec, intent: ParseIntent, unmatched: string[], search: string | null = null): TierRun {
    return {
      filters,
      search,
      intent,
      score: scoreFilters(q.expectedFilters, filters, search === (q.expectedSearch ?? null)),
      intentOk: intent === (q.expectedIntent ?? "filter"),
      // Narrowed to the named companies, as routes/parse.ts does.
      suggestionsOk: q.expectSuggestions
        ? zeroResultHelp(search ? searchStocks(stocks, search) : stocks, filters, unmatched).length > 0
        : null,
    };
  }

  const rows: Row[] = [];
  for (const [index, q] of queries.entries()) {
    const { fixed, rules: parsed } = parseOffline(q.query, stocks);
    const rules = run(q, parsed.filters, "filter", parsed.unmatched, parsed.search);

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

  // Without a key the AI section is carried over from the old results.md, not deleted.
  const previousAi = llmConfigured ? null : previousAiSection();
  const aiLines = llmConfigured ? aiSection(rows) : previousAi ? keptAiSection(previousAi, rows.length) : null;
  writeFileSync(RESULTS_PATH, buildReport(rows, aiLines), "utf-8");

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
    console.log("LLM:   not re-run (no LLM_PROVIDER/LLM_API_KEY/LLM_MODEL configured); previous AI results kept in results.md");
  }
  console.log(`Wrote ${RESULTS_PATH}`);
}

main();
