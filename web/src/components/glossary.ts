// Typed access to content/glossary.json plus the small pure helpers the help
// UI needs: which entry belongs to a filter field, which entry a parser note is
// about, and the Guide's search. No React in here, so it is easy to unit test.
import type { FilterField } from "../api/client";
import glossaryJson from "../content/glossary.json";

export type GlossaryKey = keyof typeof glossaryJson;

export type GlossaryEntry = {
  term: string;
  /** One plain-English sentence. */
  definition: string;
  whyItMatters: string;
  /** A worked example with a real stock and numbers from the saved snapshot. */
  example: string;
  /** The exact thresholds StockPilot applies. */
  howStockPilotUsesIt: string;
  /** Extra short points a beginner trips over (for example how to read "1.2×"). */
  goodToKnow: string[];
  /** A page that was checked to load. null when no verified page exists (never guess a URL). */
  source: { label: string; url: string } | null;
};

export const GLOSSARY: Record<GlossaryKey, GlossaryEntry> = glossaryJson;

export const GLOSSARY_KEYS = Object.keys(GLOSSARY) as GlossaryKey[];

/** Which glossary entry explains each FilterSpec field (used by the filter chips). */
export const GLOSSARY_KEY_FOR_FIELD: Record<FilterField, GlossaryKey> = {
  sector: "sector",
  marketCapBucket: "marketCap",
  pe: "pe",
  debtToEquity: "debtToEquity",
  profitMargin: "profitMargin",
  change1m: "change1m",
};

/**
 * Which entry a parser note is about, e.g. "cheap = P/E below 20" -> "pe".
 * The notes are plain text from the server (and are not index-aligned with the
 * filters once a cache or an LLM answer is involved), so this reads the note
 * itself. Returns null for a note that names no known term; the UI then shows
 * no link rather than a wrong one.
 */
export function glossaryKeyForNote(note: string): GlossaryKey | null {
  const text = note.toLowerCase();
  if (text.includes("p/e")) return "pe";
  if (text.includes("debt/equity")) return "debtToEquity";
  if (text.includes("profit margin")) return "profitMargin";
  if (text.includes("1-month change")) return "change1m";
  if (text.includes("market-cap") || text.includes("market cap")) return "marketCap";
  if (text.includes("sector")) return "sector";
  return null;
}

/** The text a search looks through for one entry. */
function searchableText(entry: GlossaryEntry): string {
  return [
    entry.term,
    entry.definition,
    entry.whyItMatters,
    entry.example,
    entry.howStockPilotUsesIt,
    ...entry.goodToKnow,
  ]
    .join(" ")
    .toLowerCase();
}

/**
 * The entries that match a Guide search, in glossary order. Every word the
 * user typed has to appear somewhere in the entry ("debt banks" finds
 * Debt/Equity); an empty search returns everything.
 */
export function searchGlossary(query: string): GlossaryKey[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return GLOSSARY_KEYS;
  return GLOSSARY_KEYS.filter((key) => {
    const text = searchableText(GLOSSARY[key]);
    return words.every((word) => text.includes(word));
  });
}
