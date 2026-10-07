import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { FilterSpecSchema, type FilterSpec } from "../engine/filterSpec.js";
import { INTENTS, type ParseIntent } from "./llmPrompt.js";

const CACHE_PATH = path.resolve(import.meta.dirname, "../../../data/nlCache.json");

export type CacheEntry = {
  filters: FilterSpec;
  notes: string[];
  unmatched: string[];
  /** Entries written before intents existed have neither field; they read back as a filter answer. */
  intent?: ParseIntent;
  answer?: string | null;
};

/**
 * The cache key. "Cheap  MIDCAPS " and "cheap midcaps" are the same question,
 * and a demo shouldn't miss just because of spacing or capitals.
 */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Reads one cached answer, or null. Re-validates the filters with the
 * FilterSpec schema because this file lives on disk and may have been
 * hand-edited or half-written; a bad entry is a miss, never a crash. A
 * missing or corrupt file is also just a miss, which is what lets the app
 * run before the cache has ever been written.
 */
export async function readCacheEntry(query: string): Promise<CacheEntry | null> {
  try {
    const raw = await readFile(CACHE_PATH, "utf-8");
    const cache = JSON.parse(raw) as Record<string, unknown>;
    const entry = cache[normalizeQuery(query)];
    if (typeof entry !== "object" || entry === null) return null;

    const { filters, notes, unmatched, intent, answer } = entry as Partial<CacheEntry>;
    const validated = FilterSpecSchema.safeParse(filters);
    if (!validated.success) return null;

    const knownIntent = INTENTS.includes(intent as ParseIntent) ? (intent as ParseIntent) : "filter";
    // Answers were cleaned before they were written, but the file can be hand-edited: strip tags again.
    const plainAnswer = typeof answer === "string" ? answer.replace(/<[^>]*>/g, " ").trim() : "";
    // A non-filter entry without an answer has nothing to show, so it counts as a miss.
    if (knownIntent !== "filter" && !plainAnswer) return null;

    return {
      filters: validated.data,
      notes: Array.isArray(notes) ? notes.filter((n): n is string => typeof n === "string") : [],
      unmatched: Array.isArray(unmatched) ? unmatched.filter((u): u is string => typeof u === "string") : [],
      intent: knownIntent,
      answer: knownIntent === "filter" ? null : plainAnswer,
    };
  } catch {
    return null;
  }
}

/**
 * Saves one model-produced answer for next time. Read-modify-write of a small
 * JSON object; any failure (read-only disk, corrupt file) is swallowed, since
 * failing to cache must never fail the request that produced the answer.
 */
export async function writeCacheEntry(query: string, entry: CacheEntry): Promise<void> {
  try {
    let cache: Record<string, CacheEntry> = {};
    try {
      cache = JSON.parse(await readFile(CACHE_PATH, "utf-8")) as Record<string, CacheEntry>;
      if (typeof cache !== "object" || cache === null) cache = {};
    } catch {
      // No readable cache yet — start a fresh one.
    }

    cache[normalizeQuery(query)] = entry;
    await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2) + "\n", "utf-8");
  } catch {
    // Caching is an optimisation, never a requirement.
  }
}
