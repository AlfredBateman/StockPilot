import { z } from "zod";
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

/** What the user's text was: a screening request, a general question, a buy/sell question, or something else. */
export const INTENTS = ["filter", "question", "advice", "offtopic"] as const;
export type ParseIntent = (typeof INTENTS)[number];

/** A model reply that survived validation. `answer` is null exactly when intent is "filter". */
export type LlmReply = { intent: ParseIntent; filters: FilterSpec; answer: string | null };

/** Added by the server, never left to the model, so the wording can't drift. */
export const ADVICE_LINE = "This is educational, not financial advice.";
export const OFFTOPIC_LINE = 'StockPilot is a stock screener, so try something like "cheap profitable midcaps".';

const MAX_SENTENCES = 3;
const MAX_ANSWER_CHARS = 500;

/**
 * Everything a model is ever allowed to see: the user's own words, the field
 * and operator names, and the vocabulary's plain-language notes. No stock
 * rows, no prices, no tickers, no keys. For a filter request the model only
 * turns text into a FilterSpec; for anything else it writes a short
 * educational answer that never mentions any particular stock's numbers.
 */
export function buildParsePrompt(query: string): string {
  const vocabularyNotes = VOCABULARY.map((term) => `- ${term.note}`).join("\n");

  return [
    "You are the search box of StockPilot, an educational stock screener for Indian large, mid and small caps.",
    "Classify the user's text and reply with one JSON object.",
    "",
    "Intents:",
    '- "filter": the user describes stocks they want to find. Put the filters in "filters", set "answer" to null.',
    '- "question": a general question (what is P/E, how do stocks work, anything educational). Put a plain-text answer of at most 3 short sentences in "answer", set "filters" to [].',
    '- "advice": the user asks whether to buy, sell or hold something. Give a short educational reply in "answer" about what to look at and why. Never recommend buying, selling or holding anything. Set "filters" to [].',
    '- "offtopic": anything unrelated to stocks. Answer in one short sentence in "answer", set "filters" to [].',
    "",
    "Filter rules:",
    `Allowed fields: ${FILTER_FIELDS.join(", ")}`,
    `Allowed operators: ${FILTER_OPS.join(", ")}`,
    `Allowed marketCapBucket values: ${MARKET_CAP_BUCKETS.join(", ")}`,
    "- pe: a plain number.",
    "- debtToEquity: a ratio, so 1 means debt equals equity and 0.5 means debt is half of equity.",
    "- profitMargin: a fraction, so 10% is 0.1.",
    "- change1m: a percent, so 5% is 5.",
    "- sector and marketCapBucket are text and only support eq and in.",
    "",
    "House definitions for vague words (follow these exactly):",
    vocabularyNotes,
    "",
    'Reply with only a JSON object of the form {"intent": ..., "filters": [{"field": ..., "op": ..., "value": ...}], "answer": ...}.',
    'For "filter", use an empty filters list if nothing can be expressed with the allowed fields.',
    "Answers are plain text: no markdown, no HTML, no links, no made-up numbers or sources.",
    "Do not wrap the JSON in markdown.",
    "",
    `User text: ${query}`,
  ].join("\n");
}

/** The envelope only. `filters` is checked separately by FilterSpecSchema, the one filter contract. */
const LlmEnvelopeSchema = z.object({
  intent: z.enum(INTENTS),
  filters: z.unknown().optional(),
  answer: z.string().nullable().optional(),
});

/**
 * Makes model text safe to show as plain text: no tags, no markdown marks,
 * one line, at most 3 sentences and 500 characters. React renders it as text
 * anyway; this is the second lock on the same door.
 */
export function cleanAnswer(text: string): string {
  const plain = text
    .replace(/<[^>]*>/g, " ")
    .replace(/[*_`#>]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const sentences = plain.split(/(?<=[.!?])\s+/).slice(0, MAX_SENTENCES).join(" ");
  if (sentences.length <= MAX_ANSWER_CHARS) return sentences;

  const cut = sentences.slice(0, MAX_ANSWER_CHARS);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : cut.length)}…`;
}

/**
 * Turns whatever a model actually said into a validated LlmReply, or null.
 *
 * Reasoning models can leak <think>…</think> into the text, and models add
 * markdown fences and chatty preambles even when told not to, so this drops
 * any think block and pulls out the first {...} before parsing. A "filter"
 * reply whose filters fail FilterSpecSchema is discarded (null), never
 * repaired; any other intent must come with a non-empty answer.
 */
export function parseModelOutput(text: string): LlmReply | null {
  const visible = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  const start = visible.indexOf("{");
  const end = visible.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  let body: unknown;
  try {
    body = JSON.parse(visible.slice(start, end + 1));
  } catch {
    return null;
  }

  const envelope = LlmEnvelopeSchema.safeParse(body);
  if (!envelope.success) return null;
  const { intent, filters, answer } = envelope.data;

  if (intent === "filter") {
    const validated = FilterSpecSchema.safeParse(filters);
    return validated.success ? { intent, filters: validated.data, answer: null } : null;
  }

  const cleaned = cleanAnswer(answer ?? "");
  if (!cleaned) return null;

  const fixedLine = intent === "advice" ? ADVICE_LINE : intent === "offtopic" ? OFFTOPIC_LINE : null;
  return { intent, filters: [], answer: fixedLine ? `${cleaned} ${fixedLine}` : cleaned };
}
