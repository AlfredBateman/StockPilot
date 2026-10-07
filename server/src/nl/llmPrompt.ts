import {
  FILTER_FIELDS,
  FILTER_OPS,
  FilterSpecSchema,
  MARKET_CAP_BUCKETS,
  type FilterSpec,
} from "../engine/filterSpec.js";
import { VOCABULARY } from "./vocabulary.js";

// The prompt and the output check are shared by llmClient.ts (cloud) and
// ollamaClient.ts (local) so both tiers ask for exactly the same thing and
// are held to exactly the same standard.

/**
 * Everything a model is ever allowed to see: the user's own words, the field
 * and operator names, and the vocabulary's plain-language notes. No stock
 * rows, no prices, no tickers — the model's entire job is turning text into a
 * FilterSpec, so it has no reason to see the data being filtered.
 */
export function buildParsePrompt(query: string): string {
  const vocabularyNotes = VOCABULARY.map((term) => `- ${term.note}`).join("\n");

  return [
    "You convert a stock-screening request written in plain English into a JSON filter list.",
    "",
    `Allowed fields: ${FILTER_FIELDS.join(", ")}`,
    `Allowed operators: ${FILTER_OPS.join(", ")}`,
    `Allowed marketCapBucket values: ${MARKET_CAP_BUCKETS.join(", ")}`,
    "",
    "Field notes:",
    "- pe: a plain number.",
    "- debtToEquity: a ratio, so 1 means debt equals equity and 0.5 means debt is half of equity.",
    "- profitMargin: a fraction, so 10% is 0.1.",
    "- change1m: a percent, so 5% is 5.",
    "- sector and marketCapBucket are text and only support eq and in.",
    "",
    "House definitions for vague words (follow these exactly):",
    vocabularyNotes,
    "",
    'Reply with only a JSON object of the form {"filters": [{"field": ..., "op": ..., "value": ...}]}.',
    "Use an empty list if the request has nothing you can express with the allowed fields.",
    "Do not explain, do not add any other keys, do not wrap the JSON in markdown.",
    "",
    `Request: ${query}`,
  ].join("\n");
}

/**
 * Turns whatever a model actually said into a validated FilterSpec, or null.
 *
 * Models add markdown fences and chatty preambles even when told not to, so
 * this pulls out the first {...} block before parsing. Anything that isn't
 * valid JSON, or that the FilterSpec schema rejects, returns null — which is
 * what makes the calling tier fall through to the next one instead of
 * trusting a made-up field or operator.
 */
export function parseModelOutput(text: string): FilterSpec | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  let body: unknown;
  try {
    body = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }

  if (typeof body !== "object" || body === null) return null;
  const filters = (body as { filters?: unknown }).filters;

  const validated = FilterSpecSchema.safeParse(filters);
  return validated.success ? validated.data : null;
}
