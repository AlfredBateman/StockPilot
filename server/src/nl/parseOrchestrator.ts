import type { FilterSpec } from "../engine/filterSpec.js";
import { callLlm } from "./llmClient.js";
import { callOllama } from "./ollamaClient.js";
import { readCacheEntry, writeCacheEntry } from "./nlCache.js";
import { parseQuery, type ParseResult } from "./ruleParser.js";

/**
 * Decides which tier answers a query.
 *
 *   DEMO_MODE=true : cache -> rules, and nothing above is even attempted, so
 *                    the process makes zero network calls.
 *   otherwise      : LLM (5s) -> Ollama (3s) -> cache -> rules.
 *
 * The rule parser is the floor: it is offline, instant, and always returns
 * something, so this function can never fail to produce a ParseResult.
 */
export async function parseWithTiers(query: string): Promise<ParseResult> {
  // The rule parse is cheap and pure, and its notes/unmatched are the only
  // explanation we have to show the user, so it runs regardless of tier.
  const rules = parseQuery(query);

  if (!query.trim()) return rules;

  const demoMode = process.env.DEMO_MODE === "true";

  if (!demoMode) {
    const llmFilters = await callLlm(query);
    if (llmFilters) return await remember(query, llmFilters, rules, "llm");

    const ollamaFilters = await callOllama(query);
    if (ollamaFilters) return await remember(query, ollamaFilters, rules, "ollama");
  }

  const cached = await readCacheEntry(query);
  if (cached) {
    return { filters: cached.filters, notes: cached.notes, unmatched: cached.unmatched, tier: "cache" };
  }

  return rules;
}

/**
 * Saves a model's answer for next time and returns it. Model tiers are slow
 * and non-deterministic, so both the cloud and local tiers are worth caching —
 * and a cached answer is what makes DEMO_MODE able to reply to a real query
 * with no network at all.
 */
async function remember(
  query: string,
  filters: FilterSpec,
  rules: ParseResult,
  tier: "llm" | "ollama"
): Promise<ParseResult> {
  const entry = { filters, notes: rules.notes, unmatched: rules.unmatched };
  await writeCacheEntry(query, entry);
  return { ...entry, tier };
}
