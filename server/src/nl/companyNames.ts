import type { Stock } from "../data/stockSchema.js";
import type { Filter } from "../engine/filterSpec.js";
import { searchStocks } from "../engine/searchStocks.js";
import { nearestKnownWord } from "./typoFix.js";

// Lets the main search box understand company names and tickers ("tata
// stocks", "infosys", "companies like infosys"), using the same name search as
// the separate name field (searchStocks) instead of asking the LLM. Runs after
// the rule parser, on the words it could not use. Offline and deterministic.

/** Words in many company names that say nothing about which company is meant. */
const GENERIC_WORDS = new Set(
  "limited ltd india indian company corporation industries industrial services solutions the of and bank finance financial investment holdings enterprises shares share".split(
    " "
  )
);

/**
 * Everyday words that are only part of a name (State Bank of India, United
 * Spirits). Alone they say nothing about which company is meant, so they count
 * only when another unmatched word comes with them.
 */
const WEAK_WORDS = new Set(["state", "united"]);

const MIN_WORD_LENGTH = 3;

/**
 * Typo tolerance for a company name, stricter than typoFix's: names are many and
 * short, and a wrong company is worse than no company ("shares" must not become "Shree").
 */
function nameDistance(word: string): number {
  if (word.length <= 4) return 0;
  if (word.length <= 7) return 1;
  return 2;
}

/** Lowercased name words and the ticker without ".NS", each pointing at the stocks that have it. */
function buildNameIndex(stocks: Stock[]): Map<string, Stock[]> {
  const index = new Map<string, Stock[]>();
  for (const stock of stocks) {
    const words = new Set([
      stock.ticker.replace(/\.NS$/, "").toLowerCase(),
      ...(stock.name ?? "").toLowerCase().split(/[^\p{L}\p{N}]+/u),
    ]);
    for (const word of words) {
      if (word.length < MIN_WORD_LENGTH || GENERIC_WORDS.has(word)) continue;
      index.set(word, [...(index.get(word) ?? []), stock]);
    }
  }
  return index;
}

/** The index key a query word means: itself, or the single closest name word. */
function resolveWord(word: string, index: Map<string, Stock[]>): string | null {
  if (word.length < MIN_WORD_LENGTH || GENERIC_WORDS.has(word)) return null;
  if (index.has(word)) return word;
  return nearestKnownWord(word, nameDistance(word), index.keys());
}

/** "Tata" as the real name spells it, or null when the term only matches tickers. */
function nameSpelling(stocks: Stock[], term: string): string | null {
  for (const stock of searchStocks(stocks, term)) {
    const at = (stock.name ?? "").toLowerCase().indexOf(term);
    if (at !== -1) return stock.name!.slice(at, at + term.length);
  }
  return null;
}

/** "Infosys Limited" -> "Infosys". */
function shortName(stock: Stock): string {
  return (stock.name ?? stock.ticker).replace(/ (Limited|Ltd\.?)$/i, "");
}

export type CompanyMatch = {
  /** For the name search (comma-separated terms, any one matches), or null when no company was named. */
  search: string | null;
  /** A sector filter for "companies like X"; empty otherwise. */
  filters: Filter[];
  notes: string[];
  /** The unmatched words that are still unused. */
  unmatched: string[];
};

/**
 * Finds company names in the words the rule parser left over.
 *
 *   - "companies like infosys" / "stocks similar to infosys": X's sector, as a
 *     filter. Nothing more than "same sector" is claimed.
 *   - Any other name or ticker: a name search, the same one the name field runs.
 *     Words next to each other that name the same company ("tata motors") stay
 *     together as one search term.
 */
export function findCompanies(stocks: Stock[], text: string, unmatched: string[]): CompanyMatch {
  const none: CompanyMatch = { search: null, filters: [], notes: [], unmatched };
  if (stocks.length === 0) return none;

  const index = buildNameIndex(stocks);
  const filters: Filter[] = [];
  const notes: string[] = [];
  const used = new Set<string>();

  // 1. "like X" / "similar to X" -> X's sector.
  const like = /\b(?:like|similar to)\s+([\p{L}\p{N}&'.-]+)/iu.exec(text);
  const likeKey = like ? resolveWord(like[1].toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""), index) : null;
  if (like && likeKey) {
    const candidates = index.get(likeKey)!;
    const stock = candidates.find((s) => (s.name ?? "").toLowerCase().startsWith(likeKey)) ?? candidates[0];
    if (stock.sector) {
      filters.push({ field: "sector", op: "eq", value: stock.sector });
      notes.push(`Showing ${stock.sector} stocks, the same sector as ${shortName(stock)}`);
      for (const word of like[0].toLowerCase().split(/[^\p{L}\p{N}]+/u)) used.add(word);
    }
  }

  // 2. Every other name word, grouped while neighbours point at the same company.
  const groups: { words: string[]; tickers: Set<string> }[] = [];
  for (const word of unmatched) {
    if (used.has(word)) continue;
    if (WEAK_WORDS.has(word) && unmatched.length < 2) continue;
    const key = resolveWord(word, index);
    if (!key) continue;
    used.add(word);
    const tickers = new Set(index.get(key)!.map((s) => s.ticker));
    const last = groups.at(-1);
    const shared = last ? new Set([...last.tickers].filter((t) => tickers.has(t))) : new Set<string>();
    if (last && shared.size > 0) {
      last.words.push(key);
      last.tickers = shared;
    } else {
      groups.push({ words: [key], tickers });
    }
  }
  // A phrase the names don't actually contain in that order falls back to its first word.
  const terms = groups.map(({ words }) => {
    const phrase = words.join(" ");
    return searchStocks(stocks, phrase).length > 0 ? phrase : words[0];
  });

  if (terms.length > 0) {
    const spelled = terms.map((t) => nameSpelling(stocks, t));
    const shown = terms.map((t, i) => spelled[i] ?? t.toUpperCase()).join(" or ");
    const where = spelled.every((s) => s !== null) ? "name" : "name or ticker";
    notes.push(`Showing companies whose ${where} contains ${shown}`);
  }

  if (filters.length === 0 && terms.length === 0) return none;
  return {
    search: terms.length > 0 ? terms.join(", ") : null,
    filters,
    notes,
    unmatched: unmatched.filter((word) => !used.has(word)),
  };
}
