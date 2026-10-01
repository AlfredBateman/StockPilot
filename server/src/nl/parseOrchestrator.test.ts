import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FilterSpec } from "../engine/filterSpec.js";
import { readCacheEntry, writeCacheEntry } from "./nlCache.js";
import { parseWithTiers } from "./parseOrchestrator.js";

// Every test here runs with fetch replaced, so nothing ever leaves the
// machine, and with the cache module mocked, so no test reads or writes the
// real data/nlCache.json.
vi.mock("./nlCache.js", () => ({
  normalizeQuery: (q: string) => q.trim().toLowerCase(),
  readCacheEntry: vi.fn(),
  writeCacheEntry: vi.fn(),
}));

const VALID_FILTERS: FilterSpec = [{ field: "pe", op: "lt", value: 15 }];

/** A fetch mock that answers with the given JSON body. */
function mockFetchJson(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({ ok, json: async () => body });
}

function geminiBody(text: string) {
  return { candidates: [{ content: { parts: [{ text }] } }] };
}

function groqBody(text: string) {
  return { choices: [{ message: { content: text } }] };
}

beforeEach(() => {
  vi.stubEnv("LLM_PROVIDER", "gemini");
  vi.stubEnv("LLM_API_KEY", "test-key");
  vi.stubEnv("LLM_MODEL", "test-model");
  vi.stubEnv("OLLAMA_MODEL", "");
  vi.stubEnv("DEMO_MODE", "false");

  // Cache is a miss unless a test says otherwise; writes go nowhere.
  vi.mocked(readCacheEntry).mockResolvedValue(null);
  vi.mocked(writeCacheEntry).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("parseWithTiers — LLM tier", () => {
  it('returns tier "llm" and caches the result when the model answers correctly', async () => {
    vi.stubGlobal("fetch", mockFetchJson(geminiBody(JSON.stringify({ filters: VALID_FILTERS }))));

    const result = await parseWithTiers("cheap stocks");

    expect(result.tier).toBe("llm");
    expect(result.filters).toEqual(VALID_FILTERS);
    expect(writeCacheEntry).toHaveBeenCalledTimes(1);
  });

  it("works the same way for the groq provider's response shape", async () => {
    vi.stubEnv("LLM_PROVIDER", "groq");
    vi.stubGlobal("fetch", mockFetchJson(groqBody(JSON.stringify({ filters: VALID_FILTERS }))));

    const result = await parseWithTiers("cheap stocks");

    expect(result.tier).toBe("llm");
    expect(result.filters).toEqual(VALID_FILTERS);
  });

  it("sends an abort signal so the call is actually time-limited", async () => {
    const fetchMock = mockFetchJson(geminiBody(JSON.stringify({ filters: VALID_FILTERS })));
    vi.stubGlobal("fetch", fetchMock);

    await parseWithTiers("cheap stocks");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("never sends stock data to the model — only the query, fields and vocabulary", async () => {
    const fetchMock = mockFetchJson(geminiBody(JSON.stringify({ filters: VALID_FILTERS })));
    vi.stubGlobal("fetch", fetchMock);

    await parseWithTiers("cheap stocks");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sent = String(init.body);
    expect(sent).toContain("cheap stocks");
    expect(sent).toContain("marketCapBucket");
    expect(sent).not.toContain("RELIANCE");
    expect(sent).not.toContain("weeklyCloses");
  });

  it("skips the tier without calling fetch when the model name is missing", async () => {
    vi.stubEnv("LLM_MODEL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await parseWithTiers("cheap stocks");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.tier).toBe("rules");
  });
});

describe("parseWithTiers — falling through a failing LLM tier", () => {
  it('falls back to rules when the request times out (tier "rules")', async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("The operation was aborted", "TimeoutError"))
    );

    const result = await parseWithTiers("cheap stocks");

    expect(result.tier).toBe("rules");
    expect(result.filters).toEqual([{ field: "pe", op: "lt", value: 20 }]);
  });

  it("falls back to rules when the model returns malformed JSON", async () => {
    vi.stubGlobal("fetch", mockFetchJson(geminiBody("Sure! Here you go: {not json at all")));

    const result = await parseWithTiers("cheap stocks");

    expect(result.tier).toBe("rules");
  });

  it("falls back to rules when the model returns schema-invalid filters", async () => {
    // "cheap" is not a number, so the FilterSpec schema must reject this.
    const invalid = { filters: [{ field: "pe", op: "eq", value: "cheap" }] };
    vi.stubGlobal("fetch", mockFetchJson(geminiBody(JSON.stringify(invalid))));

    const result = await parseWithTiers("cheap stocks");

    expect(result.tier).toBe("rules");
    expect(writeCacheEntry).not.toHaveBeenCalled();
  });

  it("falls back to rules on a non-2xx response", async () => {
    vi.stubGlobal("fetch", mockFetchJson({ error: "unauthorized" }, false));

    const result = await parseWithTiers("cheap stocks");

    expect(result.tier).toBe("rules");
  });

  it("accepts a fenced markdown reply, since models add fences anyway", async () => {
    const fenced = "```json\n" + JSON.stringify({ filters: VALID_FILTERS }) + "\n```";
    vi.stubGlobal("fetch", mockFetchJson(geminiBody(fenced)));

    const result = await parseWithTiers("cheap stocks");

    expect(result.tier).toBe("llm");
    expect(result.filters).toEqual(VALID_FILTERS);
  });
});

describe("parseWithTiers — Ollama tier", () => {
  it('takes over with tier "ollama" after the cloud tier fails', async () => {
    vi.stubEnv("OLLAMA_MODEL", "test-local-model");
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("no internet"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: JSON.stringify({ filters: VALID_FILTERS }) }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await parseWithTiers("cheap stocks");

    expect(result.tier).toBe("ollama");
    expect(result.filters).toEqual(VALID_FILTERS);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("http://localhost:11434/api/generate");
  });

  it("is skipped without a request when OLLAMA_MODEL is unset", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("no internet"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await parseWithTiers("cheap stocks");

    // Only the cloud attempt was made; Ollama was never contacted.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.tier).toBe("rules");
  });
});

describe("parseWithTiers — cache tier", () => {
  it('returns tier "cache" when both model tiers fail but the query was seen before', async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("no internet")));
    vi.mocked(readCacheEntry).mockResolvedValue({
      filters: VALID_FILTERS,
      notes: ["cheap = P/E below 20"],
      unmatched: [],
    });

    const result = await parseWithTiers("cheap stocks");

    expect(result.tier).toBe("cache");
    expect(result.filters).toEqual(VALID_FILTERS);
    expect(result.notes).toEqual(["cheap = P/E below 20"]);
  });
});

describe("parseWithTiers — DEMO_MODE", () => {
  it("makes zero network calls and answers from cache", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    vi.stubEnv("OLLAMA_MODEL", "test-local-model");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(readCacheEntry).mockResolvedValue({ filters: VALID_FILTERS, notes: [], unmatched: [] });

    const result = await parseWithTiers("cheap stocks");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.tier).toBe("cache");
  });

  it("makes zero network calls and falls back to rules on a cache miss", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await parseWithTiers("cheap profitable midcaps that fell this month");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.tier).toBe("rules");
    expect(result.filters).toHaveLength(4);
  });
});
