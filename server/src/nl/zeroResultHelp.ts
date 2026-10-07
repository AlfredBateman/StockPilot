import type { Stock } from "../data/stockSchema.js";
import { applyFilters } from "../engine/applyFilters.js";
import type { Filter, FilterSpec } from "../engine/filterSpec.js";
import { filterShortLabel } from "./filterLabel.js";
import type { Suggestion } from "./parseOrchestrator.js";
import { parseQuery } from "./ruleParser.js";
import { nearestKnownWord } from "./typoFix.js";
import { SECTORS, SECTOR_SYNONYMS } from "./vocabulary.js";

// When a search matches nothing, the server (never the LLM) works out what
// would help, by actually running the screen again on the real data:
//   - "Dropping 'low debt' gives 14 stocks": remove one filter at a time,
//     keep the two that bring back the most stocks.
//   - "Did you mean 'Energy'?": a sector name the data doesn't have, or a
//     leftover word close to a known term, that would bring results back.
// Every suggestion carries the full FilterSpec to apply, so a click is enough.

const MAX_DROP_SUGGESTIONS = 2;

function plural(count: number): string {
  return `${count} ${count === 1 ? "stock" : "stocks"}`;
}

/** A sector the data really has, for a value that isn't one: synonym, then prefix, then spelling. */
function nearestSector(value: string): string | null {
  const lower = value.trim().toLowerCase();
  if (SECTORS.some((s) => s.toLowerCase() === lower)) return null;

  if (Object.hasOwn(SECTOR_SYNONYMS, lower)) return SECTOR_SYNONYMS[lower];

  const prefixMatches = SECTORS.filter((s) => lower.length >= 3 && s.toLowerCase().startsWith(lower));
  if (prefixMatches.length === 1) return prefixMatches[0];

  const lowered = SECTORS.map((s) => s.toLowerCase());
  const nearest = nearestKnownWord(lower, Math.max(2, Math.floor(lower.length / 3)), lowered);
  return nearest ? SECTORS[lowered.indexOf(nearest)] : null;
}

/** Same filters with one sector value swapped for a real sector name. */
function withSectorFixed(filters: FilterSpec, index: number, sector: string): FilterSpec {
  return filters.map((f, i) => (i === index ? { field: "sector", op: "eq", value: sector } : f)) as FilterSpec;
}

/** A looser spelling match than typoFix's automatic one, offered as a question instead of applied. */
function looseDistance(word: string): number {
  if (word.length <= 3) return 0;
  if (word.length <= 6) return 2;
  return 3;
}

function didYouMean(stocks: Stock[], filters: FilterSpec, unmatched: string[]): Suggestion | null {
  // 1. A sector filter whose value isn't a sector in the data (an LLM saying "Banking" or "IT").
  for (const [index, filter] of filters.entries()) {
    if (filter.field !== "sector" || filter.op !== "eq" || typeof filter.value !== "string") continue;
    const sector = nearestSector(filter.value);
    if (!sector) continue;
    const fixed = withSectorFixed(filters, index, sector);
    const count = applyFilters(stocks, fixed).length;
    if (count > 0) return { label: `Did you mean '${sector}'? ${plural(count)}`, filters: fixed };
  }

  // 2. A leftover word that is a bit too far from a known term to have been fixed automatically.
  for (const word of unmatched) {
    const guess = nearestKnownWord(word, looseDistance(word));
    if (!guess) continue;
    const extra = parseQuery(guess).filters;
    if (extra.length === 0) continue;
    const fields = new Set(extra.map((f) => f.field));
    const merged = [...filters.filter((f) => !fields.has(f.field)), ...extra];
    const count = applyFilters(stocks, merged).length;
    if (count > 0) return { label: `Did you mean '${guess}'? ${plural(count)}`, filters: merged };
  }

  return null;
}

/**
 * Suggestions for a search that matched no stocks (or found no filters at
 * all): at most one "did you mean" and at most two "dropping X" chips.
 * Returns [] when the filters already match something.
 */
export function zeroResultHelp(stocks: Stock[], filters: FilterSpec, unmatched: string[] = []): Suggestion[] {
  if (filters.length === 0) {
    const guess = didYouMean(stocks, filters, unmatched);
    return guess ? [guess] : [];
  }
  if (applyFilters(stocks, filters).length > 0) return [];

  const drops = filters
    .map((dropped: Filter, index) => {
      const rest = filters.filter((_, i) => i !== index);
      return { dropped, rest, count: applyFilters(stocks, rest).length };
    })
    // Dropping the only filter just means "show everything", which isn't a useful suggestion.
    .filter((d) => d.rest.length > 0 && d.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_DROP_SUGGESTIONS)
    .map((d) => ({ label: `Dropping '${filterShortLabel(d.dropped)}' gives ${plural(d.count)}`, filters: d.rest }));

  const guess = didYouMean(stocks, filters, unmatched);
  return guess ? [guess, ...drops] : drops;
}
