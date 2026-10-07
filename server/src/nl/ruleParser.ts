import type { Filter, FilterField, FilterSpec } from "../engine/filterSpec.js";
import { VOCABULARY } from "./vocabulary.js";

export type ParseTier = "rules" | "llm" | "cache";

export type ParseResult = {
  filters: FilterSpec;
  /** One human-readable line per filter that was matched, e.g. "cheap = P/E below 20". */
  notes: string[];
  /** Leftover words the parser didn't recognize, after stripping stopwords. */
  unmatched: string[];
  tier: ParseTier;
};

export const STOPWORDS = new Set(
  "a an the and or with of is are that this in for me show find list give some please stocks stock companies company".split(" ")
);

type NumericFieldSpec = {
  field: FilterField;
  label: string;
  aliases: string[];
  /** profitMargin is stored as a fraction (0.1 = 10%), but always spoken of as a percent. */
  percent?: boolean;
};

export const NUMERIC_FIELDS: NumericFieldSpec[] = [
  { field: "pe", label: "P/E", aliases: ["p/e", "pe", "price to earnings"] },
  { field: "debtToEquity", label: "Debt/Equity", aliases: ["debt to equity", "debt/equity", "d/e"] },
  { field: "profitMargin", label: "profit margin", aliases: ["profit margin", "margin"], percent: true },
  { field: "change1m", label: "1-month change", aliases: ["1 month change", "1-month change", "monthly change"] },
];

export const COMPARATORS: { words: string[]; op: "lt" | "gt" }[] = [
  { words: ["under", "below", "less than"], op: "lt" },
  { words: ["over", "above", "more than", "greater than"], op: "gt" },
];

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type NumericMatch = { field: FilterField; filter: Filter; note: string; matchedText: string };

/**
 * Explicit numeric phrases like "P/E under 15" or "debt to equity above 2".
 * Only the "<field> <comparator> <number>" word order is supported — this is
 * a fixed dictionary match, not general NLP, and that's a deliberate,
 * documented limitation for a beginner project.
 */
function extractNumericPhrases(text: string): NumericMatch[] {
  const matches: NumericMatch[] = [];

  for (const nf of NUMERIC_FIELDS) {
    for (const alias of nf.aliases) {
      for (const comparator of COMPARATORS) {
        for (const word of comparator.words) {
          const re = new RegExp(`\\b${escapeRegExp(alias)}\\s+${escapeRegExp(word)}\\s+(\\d+(?:\\.\\d+)?)`, "i");
          const match = re.exec(text);
          if (!match) continue;

          const raw = Number(match[1]);
          const value = nf.percent ? raw / 100 : raw;
          const direction = comparator.op === "lt" ? "below" : "above";

          matches.push({
            field: nf.field,
            filter: { field: nf.field, op: comparator.op, value },
            note: `"${match[0]}" = ${nf.label} ${direction} ${raw}${nf.percent ? "%" : ""}`,
            matchedText: match[0],
          });
        }
      }
    }
  }

  return matches;
}

/**
 * Turns free text into a FilterSpec using a fixed vocabulary and a handful of
 * numeric-phrase patterns — no network call, no learned model. Never throws:
 * gibberish just comes back with empty filters and everything in `unmatched`.
 */
export function parseQuery(query: string): ParseResult {
  const text = query.toLowerCase();
  let remaining = text;
  const byField = new Map<FilterField, { filter: Filter; note: string }>();

  for (const term of VOCABULARY) {
    if (term.pattern.test(text)) {
      byField.set(term.filter.field, { filter: term.filter, note: term.note });
      remaining = remaining.replace(term.pattern, " ");
    }
  }

  // Explicit numbers are more specific than a vague word, so they run second
  // and win any conflict on the same field (e.g. "cheap ... P/E under 10").
  for (const match of extractNumericPhrases(text)) {
    byField.set(match.field, { filter: match.filter, note: match.note });
    remaining = remaining.replace(match.matchedText, " ");
  }

  const unmatched = remaining
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 0 && !STOPWORDS.has(word));

  const matches = [...byField.values()];

  return {
    filters: matches.map((m) => m.filter),
    notes: matches.map((m) => m.note),
    unmatched,
    tier: "rules",
  };
}
