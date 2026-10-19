import type { Stock } from "../data/stockSchema.js";
import type { FilterSpec } from "../engine/filterSpec.js";
import { findCompanies, GENERIC_WORDS } from "./companyNames.js";
import { filterNote } from "./filterLabel.js";
import { callLlm, isLlmConfigured } from "./llmClient.js";
import { llmGuard, type LlmGuard } from "./llmGuard.js";
import type { LlmReply, ParseIntent } from "./llmPrompt.js";
import { recordLlmError } from "./llmStatus.js";
import { readCacheEntry, writeCacheEntry } from "./nlCache.js";
import { parseQuery, type ParseResult } from "./ruleParser.js";
import { fixTypos } from "./typoFix.js";

/** Longer text is cut to this before anything reads it. Real screening requests are a line, not an essay. */
const MAX_QUERY_LENGTH = 200;

export const AI_RESTING_NOTICE = "AI helper is resting, showing keyword matching only.";
export const TRUNCATED_NOTICE = `Only the first ${MAX_QUERY_LENGTH} characters were read.`;

/** A one-click way out of a zero-result search, computed by the server (see zeroResultHelp.ts). */
export type Suggestion = { label: string; filters: FilterSpec };

type QueryResult = ParseResult & {
  /** A company-name search for the name field ("tata", or "infosys, wipro"), or null when no company was named. */
  search: string | null;
  intent: ParseIntent;
  /** Plain-text reply for question/advice/offtopic; null for a filter request. */
  answer: string | null;
  /** The query after typo fixes, shown as "Showing results for …"; null when nothing was fixed. */
  correctedQuery: string | null;
  /** A one-line status for the user (AI resting, query cut short), or null. */
  notice: string | null;
  /** Filled in by the /api/parse route when the filters match zero stocks. */
  suggestions: Suggestion[];
};

type ParseOptions = {
  /** Who is asking, for the per-IP LLM rate limit. */
  ip?: string;
  /** The stocks whose names can be recognised. Empty (the default) turns name matching off. */
  stocks?: Stock[];
  /** Tests pass their own guard; the server shares one. */
  guard?: LlmGuard;
};

/**
 * Decides which tier answers a query.
 *
 *   1. Cut to 200 characters, fix typos, run the rule parser, then look for
 *      company names in the leftover words (always, see parseOffline).
 *   2. That found filters or a company and understood every word -> done, no network.
 *   3. Cache (identical query seen before) -> done.
 *   4. Not DEMO_MODE: cloud LLM (if configured and the guard allows it).
 *   5. Nothing better answered -> the rules result, with a notice saying the
 *      AI helper is resting.
 *
 * The rule parser is the floor: it is offline, instant, and always returns
 * something, so this function can never fail to produce a result.
 */
export async function parseWithTiers(rawQuery: string, options: ParseOptions = {}): Promise<QueryResult> {
  const query = rawQuery.slice(0, MAX_QUERY_LENGTH);
  const { fixed, rules } = parseOffline(query, options.stocks ?? []);

  const base: QueryResult = {
    ...rules,
    intent: "filter",
    answer: null,
    correctedQuery: fixed.corrections.length > 0 ? fixed.text : null,
    notice: rawQuery.length > MAX_QUERY_LENGTH ? TRUNCATED_NOTICE : null,
    suggestions: [],
  };

  if (!query.trim()) return base;
  if ((rules.filters.length > 0 || rules.search) && rules.unmatched.length === 0) return base;

  const cached = await readCacheEntry(query);
  if (cached) {
    return {
      ...base,
      filters: cached.filters,
      notes: cached.notes,
      unmatched: cached.unmatched,
      intent: cached.intent ?? "filter",
      answer: cached.answer ?? null,
      tier: "cache",
    };
  }

  if (process.env.DEMO_MODE !== "true") {
    const reply = await askLlm(fixed.text, options);
    if (reply) {
      const result = fromReply(base, reply);
      await writeCacheEntry(query, {
        filters: result.filters,
        notes: result.notes,
        unmatched: result.unmatched,
        intent: result.intent,
        answer: result.answer,
      });
      return result;
    }
  }

  return { ...base, notice: [base.notice, AI_RESTING_NOTICE].filter(Boolean).join(" ") };
}

/**
 * The offline part every query gets, also scored by eval/run.ts: typo fix,
 * rule parser, then company names in the words the rules left over. A
 * "companies like X" sector filter replaces a sector the rules found.
 */
export function parseOffline(query: string, stocks: Stock[]) {
  const fixed = fixTypos(query);
  const parsed = parseQuery(fixed.text);
  const names = findCompanies(stocks, fixed.text, parsed.unmatched);
  const replaced = new Set(names.filters.map((f) => f.field));
  // The rule parser's notes are one per filter, in the same order, so they are dropped together.
  const kept = parsed.filters.map((filter, i) => ({ filter, note: parsed.notes[i] })).filter((m) => !replaced.has(m.filter.field));

  const filters = [...kept.map((m) => m.filter), ...names.filters];
  // "india" or "limited" left over beside a real filter or name is not a word the rules failed to
  // understand, so it must not send the query on to the cache or the LLM.
  const understood = filters.length > 0 || names.search !== null;
  const rules: ParseResult & { search: string | null } = {
    ...parsed,
    filters,
    notes: [...kept.map((m) => m.note), ...names.notes],
    unmatched: understood ? names.unmatched.filter((word) => !GENERIC_WORDS.has(word)) : names.unmatched,
    search: names.search,
  };
  return { fixed, rules };
}

/** The cloud LLM (rate-limited and capped). Null if it is off, over its limit or gave no valid reply. */
async function askLlm(text: string, { ip = "unknown", guard = llmGuard }: ParseOptions): Promise<LlmReply | null> {
  if (!isLlmConfigured()) {
    recordLlmError("not_configured");
    return null;
  }
  // Only take a slot from the guard when a call will actually be made.
  if (!guard.tryAcquire(ip)) {
    recordLlmError(guard.lastDenial ?? "rate_capped_ip");
    return null;
  }
  return callLlm(text);
}

/**
 * Builds the result from a model's reply. A filter reply replaces the rules'
 * filters (the model read the whole sentence) and gets its own notes so they
 * describe the filters actually applied; an empty filter reply keeps the
 * rules' result. Any other intent is an answer only and applies no filters,
 * so asking a question never clears the user's current screen.
 */
function fromReply(base: QueryResult, reply: LlmReply): QueryResult {
  const tier = "llm";
  if (reply.intent !== "filter") {
    return { ...base, filters: [], notes: [], unmatched: [], intent: reply.intent, answer: reply.answer, tier };
  }
  if (reply.filters.length === 0) return { ...base, tier };
  return { ...base, filters: reply.filters, notes: reply.filters.map(filterNote), unmatched: [], tier };
}
