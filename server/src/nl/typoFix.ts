import { COMPARATORS, NUMERIC_FIELDS, parseQuery } from "./ruleParser.js";
import { SECTORS, SECTOR_SYNONYMS, VAGUE_TERM_WORDS } from "./vocabulary.js";

// Fixes small spelling mistakes ("chep tecnology stocks") before the rule
// parser runs, so a typo doesn't turn a perfectly good query into "no
// filters found". Offline, instant and deterministic, like the rule parser.

/** Every word the rule parser can do something with, lowercased. */
export const KNOWN_WORDS: ReadonlySet<string> = new Set(
  [
    ...VAGUE_TERM_WORDS,
    ...SECTORS.flatMap((sector) => sector.toLowerCase().split(" ")),
    ...Object.keys(SECTOR_SYNONYMS),
    ...NUMERIC_FIELDS.flatMap((field) => field.aliases.flatMap((alias) => alias.split(/[\s/-]+/))),
    ...COMPARATORS.flatMap((comparator) => comparator.words.flatMap((word) => word.split(" "))),
  ].filter((word) => word.length > 0)
);

/**
 * Levenshtein distance: how many single-letter inserts, deletes or swaps of
 * one letter for another turn `a` into `b`. The classic two-row version.
 */
export function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      current.push(Math.min(previous[j] + 1, current[j - 1] + 1, substitution));
    }
    previous = current;
  }
  return previous[b.length];
}

/**
 * How many mistakes a word of this length may have and still be corrected.
 * Short words are strict because almost every 3-letter word is one letter away
 * from another real word ("cap" / "car" / "cat").
 */
export function allowedDistance(word: string): number {
  if (word.length <= 3) return 0;
  if (word.length <= 5) return 1;
  return 2;
}

/**
 * The single closest known word within `maxDistance`, or null when there is
 * none or when two known words tie (a guess between two is not a fix).
 */
export function nearestKnownWord(
  word: string,
  maxDistance: number,
  candidates: Iterable<string> = KNOWN_WORDS
): string | null {
  let best: string | null = null;
  let bestDistance = Infinity;
  let tie = false;

  for (const candidate of candidates) {
    const distance = editDistance(word, candidate);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
      tie = false;
    } else if (distance === bestDistance && candidate !== best) {
      tie = true;
    }
  }

  return best !== null && bestDistance > 0 && bestDistance <= maxDistance && !tie ? best : null;
}

export type TypoFix = {
  /** The query with every accepted correction applied (or the query unchanged). */
  text: string;
  corrections: { from: string; to: string }[];
};

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Corrects the words the rule parser could not use. A correction is kept only
 * if it makes the rule parser find more filters than before, so "best stocks"
 * is not turned into "debt stocks" (a real word, but no filter on its own).
 */
export function fixTypos(query: string): TypoFix {
  let text = query;
  const corrections: TypoFix["corrections"] = [];
  let filterCount = parseQuery(text).filters.length;

  for (const word of parseQuery(query).unmatched) {
    if (KNOWN_WORDS.has(word) || /\d/.test(word)) continue;

    const fix = nearestKnownWord(word, allowedDistance(word));
    if (!fix) continue;

    const candidate = text.replace(new RegExp(`\\b${escapeRegExp(word)}\\b`, "i"), fix);
    const candidateCount = parseQuery(candidate).filters.length;
    if (candidateCount > filterCount) {
      text = candidate;
      filterCount = candidateCount;
      corrections.push({ from: word, to: fix });
    }
  }

  return { text, corrections };
}
