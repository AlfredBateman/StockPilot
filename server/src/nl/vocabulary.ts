import type { Filter, FilterField } from "../engine/filterSpec.js";

// Every entry here is a *fixed*, documented FilterSpec fragment — no
// statistics, no learned thresholds, just numbers a human can look up and
// argue with. The note is shown back to the user in the UI so "cheap" never
// silently means something they didn't expect.

export type VocabTerm = {
  /** Matched against the lowercased query. No global flag — see ruleParser.ts. */
  pattern: RegExp;
  field: FilterField;
  filter: Filter;
  note: string;
};

const VAGUE_TERMS: VocabTerm[] = [
  { pattern: /\bcheap\b/, field: "pe", filter: { field: "pe", op: "lt", value: 20 }, note: "cheap = P/E below 20" },
  {
    pattern: /\bexpensive\b/,
    field: "pe",
    filter: { field: "pe", op: "gt", value: 40 },
    note: "expensive = P/E above 40",
  },
  {
    pattern: /\bprofitable\b/,
    field: "profitMargin",
    filter: { field: "profitMargin", op: "gt", value: 0 },
    note: "profitable = profit margin above 0%",
  },
  {
    pattern: /\blow[\s-]?debt\b/,
    field: "debtToEquity",
    // Same threshold as the "Low Debt, Steady Profit" preset (content/presets.json), so the two agree.
    filter: { field: "debtToEquity", op: "lt", value: 0.5 },
    note: "low debt = debt/equity ratio below 0.5 (debt under half of equity)",
  },
  {
    pattern: /\bhigh[\s-]?debt\b/,
    field: "debtToEquity",
    filter: { field: "debtToEquity", op: "gt", value: 1 },
    note: "high debt = debt/equity ratio above 1 (debt greater than equity)",
  },
  {
    pattern: /\bsmall[\s-]?caps?\b/,
    field: "marketCapBucket",
    filter: { field: "marketCapBucket", op: "eq", value: "Small" },
    note: "small cap = Small market-cap bucket",
  },
  {
    pattern: /\bmid[\s-]?caps?\b/,
    field: "marketCapBucket",
    filter: { field: "marketCapBucket", op: "eq", value: "Mid" },
    note: "midcap = Mid market-cap bucket",
  },
  {
    pattern: /\blarge[\s-]?caps?\b/,
    field: "marketCapBucket",
    filter: { field: "marketCapBucket", op: "eq", value: "Large" },
    note: "large cap = Large market-cap bucket",
  },
  {
    pattern: /\b(?:rose|gained?|up|climbed?)\b.*\bmonth\b/,
    field: "change1m",
    filter: { field: "change1m", op: "gt", value: 0 },
    note: "rose this month = 1-month change above 0%",
  },
  {
    pattern: /\b(?:fell|dropped?|down|declined?)\b.*\bmonth\b/,
    field: "change1m",
    filter: { field: "change1m", op: "lt", value: 0 },
    note: "fell this month = 1-month change below 0%",
  },
];

// The 11 sectors present in data/stocks.json today (see GET /api/sectors).
// Hardcoded rather than read from the snapshot at import time: loadStocks()
// is async and file-backed, and this list only needs to change if the
// snapshot is ever re-generated with different sector labels — the same
// tradeoff server/src/engine/metrics.ts already makes for its market-cap
// crore thresholds.
export const SECTORS = [
  "Basic Materials",
  "Communication Services",
  "Consumer Cyclical",
  "Consumer Defensive",
  "Energy",
  "Financial Services",
  "Healthcare",
  "Industrials",
  "Real Estate",
  "Technology",
  "Utilities",
] as const;

/** Common alternate phrasings for a sector, beyond its own exact name. */
export const SECTOR_SYNONYMS: Record<string, (typeof SECTORS)[number]> = {
  tech: "Technology",
  bank: "Financial Services",
  banking: "Financial Services",
  finance: "Financial Services",
  financial: "Financial Services",
  pharma: "Healthcare",
  health: "Healthcare",
  realty: "Real Estate",
  property: "Real Estate",
  materials: "Basic Materials",
  telecom: "Communication Services",
  utility: "Utilities",
};

/** `displayPhrase` is what the note shows the user; `regexSource` is what actually gets matched. */
function sectorTerm(displayPhrase: string, regexSource: string, sector: string): VocabTerm {
  return {
    pattern: new RegExp(`\\b${regexSource}\\b`, "i"),
    field: "sector",
    filter: { field: "sector", op: "eq", value: sector },
    note: `"${displayPhrase}" = ${sector} sector`,
  };
}

const SECTOR_TERMS: VocabTerm[] = [
  ...SECTORS.map((sector) => sectorTerm(sector, sector.replace(/ /g, "[\\s-]?"), sector)),
  ...Object.entries(SECTOR_SYNONYMS).map(([word, sector]) => sectorTerm(word, word, sector)),
];

export const VOCABULARY: VocabTerm[] = [...VAGUE_TERMS, ...SECTOR_TERMS];

/**
 * Every single word the vague terms above are built from, spelled out by hand
 * because the patterns are regexes. typoFix.ts corrects misspelled words
 * towards this list (plus sector names), so a word only belongs here if one of
 * the patterns above actually matches it.
 */
export const VAGUE_TERM_WORDS =
  "cheap expensive profitable low high debt small mid large cap caps smallcap smallcaps midcap midcaps largecap largecaps rose gain gained climb climbed fell drop dropped decline declined down month".split(
    " "
  );

/** The vague terms only (not sectors), for code that wants a short name for a filter. */
export const VAGUE_VOCABULARY: readonly VocabTerm[] = VAGUE_TERMS;

// Terms deliberately left out — nothing in data/stocks.json (or derived from
// it) can define them, so guessing a threshold would be inventing data:
//   - stable / safe / risky: no volatility or beta figure in the snapshot.
//   - growth / momentum: no revenue history; the only trend data available
//     (weeklyCloses) is already covered by "rose/fell this month".
//   - quality / value / blue chip: subjective, and would just re-skin
//     cheap/profitable/large-cap under a vaguer name instead of adding
//     information.
