import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FilterSpec } from "../engine/filterSpec.js";
import { NVIDIA_TIMEOUT_MS } from "./llmClient.js";
import { createLlmGuard } from "./llmGuard.js";
import { readCacheEntry, writeCacheEntry } from "./nlCache.js";
import { AI_RESTING_NOTICE, TRUNCATED_NOTICE, parseWithTiers } from "./parseOrchestrator.js";

// Every test here runs with fetch replaced, so nothing ever leaves the
// machine, and with the cache module mocked, so no test reads or writes the
// real data/nlCache.json. Each test gets a fresh guard so rate limits from
// one test never leak into another.
vi.mock("./nlCache.js", () => ({
  normalizeQuery: (q: string) => q.trim().toLowerCase(),
  readCacheEntry: vi.fn(),
  writeCacheEntry: vi.fn(),
}));

const VALID_FILTERS: FilterSpec = [{ field: "pe", op: "lt", value: 15 }];

/** Rules find "cheap" here but not "strong growth", so the LLM tier is needed. */
const PARTIAL_QUERY = "cheap stocks with strong growth";

/** A fetch mock that answers with the given JSON body. */
function mockFetchJson(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({ ok, json: async () => body });
}

function chatBody(text: string, reasoning?: string) {
  return { choices: [{ message: { content: text, ...(reasoning ? { reasoning_content: reasoning } : {}) } }] };
}

function geminiBody(text: string) {
  return { candidates: [{ content: { parts: [{ text }] } }] };
}

function filterReply(filters: unknown = VALID_FILTERS) {
  return JSON.stringify({ intent: "filter", filters, answer: null });
}

function parse(query: string, ip = "1.1.1.1") {
  return parseWithTiers(query, { ip, guard: createLlmGuard() });
}

beforeEach(() => {
  vi.stubEnv("LLM_PROVIDER", "nvidia");
  vi.stubEnv("LLM_API_KEY", "test-key");
  vi.stubEnv("LLM_MODEL", "test-model");
  vi.stubEnv("LLM_DAILY_CAP", "");
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

describe("parseWithTiers — rules first", () => {
  it("does not call the LLM when rules understood every word", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await parse("cheap profitable midcaps that fell this month");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(readCacheEntry).not.toHaveBeenCalled();
    expect(result).toMatchObject({ tier: "rules", intent: "filter", answer: null, notice: null });
    expect(result.filters).toHaveLength(4);
  });

  it("fixes typos before the rules run and reports the corrected query", async () => {
    vi.stubGlobal("fetch", vi.fn());

    const result = await parse("chep tecnology stocks");

    expect(result.correctedQuery).toBe("cheap technology stocks");
    expect(result.filters).toEqual([
      { field: "pe", op: "lt", value: 20 },
      { field: "sector", op: "eq", value: "Technology" },
    ]);
    expect(result.tier).toBe("rules");
  });

  it("reads only the first 200 characters and says so", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    const result = await parse("cheap " + "x".repeat(300));

    expect(result.notice).toContain(TRUNCATED_NOTICE);
  });
});

describe("parseWithTiers — NVIDIA provider", () => {
  it("sends the documented thinking switch, turned off, with an 8s timeout", async () => {
    const fetchMock = mockFetchJson(chatBody(filterReply()));
    vi.stubGlobal("fetch", fetchMock);
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");

    await parse(PARTIAL_QUERY);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://integrate.api.nvidia.com/v1/chat/completions");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("test-model");
    expect(body.chat_template_kwargs).toEqual({ enable_thinking: false });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(timeoutSpy).toHaveBeenCalledWith(NVIDIA_TIMEOUT_MS);
  });

  it("parses only message.content and ignores reasoning_content", async () => {
    const reasoning = JSON.stringify({ intent: "offtopic", answer: "should never be read" });
    vi.stubGlobal("fetch", mockFetchJson(chatBody(filterReply(), reasoning)));

    const result = await parse(PARTIAL_QUERY);

    expect(result.tier).toBe("llm");
    expect(result.filters).toEqual(VALID_FILTERS);
  });

  it("keeps the API key in the header only, never in the body the model sees", async () => {
    const fetchMock = mockFetchJson(chatBody(filterReply()));
    vi.stubGlobal("fetch", fetchMock);

    await parse(PARTIAL_QUERY);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(init.body)).not.toContain("test-key");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
  });

  it("never sends stock data to the model, only the query, fields and vocabulary", async () => {
    const fetchMock = mockFetchJson(chatBody(filterReply()));
    vi.stubGlobal("fetch", fetchMock);

    await parse(PARTIAL_QUERY);

    const sent = String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body);
    expect(sent).toContain("strong growth");
    expect(sent).toContain("marketCapBucket");
    expect(sent).not.toContain("RELIANCE");
    expect(sent).not.toContain("weeklyCloses");
  });
});

describe("parseWithTiers — LLM intents", () => {
  it("a filter reply replaces the rules' filters, gets matching notes, and is cached", async () => {
    vi.stubGlobal("fetch", mockFetchJson(chatBody(filterReply())));

    const result = await parse(PARTIAL_QUERY);

    expect(result).toMatchObject({ tier: "llm", intent: "filter", filters: VALID_FILTERS, unmatched: [] });
    expect(result.notes).toEqual(["P/E below 15"]);
    expect(writeCacheEntry).toHaveBeenCalledTimes(1);
  });

  it("a question returns a plain-text answer and no filters", async () => {
    const reply = JSON.stringify({ intent: "question", filters: [], answer: "P/E is <b>price</b> over earnings." });
    vi.stubGlobal("fetch", mockFetchJson(chatBody(reply)));

    const result = await parse("what is pe ratio");

    expect(result).toMatchObject({ intent: "question", filters: [], answer: "P/E is price over earnings." });
  });

  it("advice gets the fixed educational line", async () => {
    const reply = JSON.stringify({ intent: "advice", filters: [], answer: "Compare its debt and margins." });
    vi.stubGlobal("fetch", mockFetchJson(chatBody(reply)));

    const result = await parse("should I buy infosys");

    expect(result.intent).toBe("advice");
    expect(result.answer).toContain("not financial advice");
  });

  it("an empty filter reply keeps the rules' result", async () => {
    vi.stubGlobal("fetch", mockFetchJson(chatBody(filterReply([]))));

    const result = await parse(PARTIAL_QUERY);

    expect(result.filters).toEqual([{ field: "pe", op: "lt", value: 20 }]);
    expect(result.tier).toBe("llm");
  });

  it("still works with the gemini provider's response shape", async () => {
    vi.stubEnv("LLM_PROVIDER", "gemini");
    vi.stubGlobal("fetch", mockFetchJson(geminiBody(filterReply())));

    const result = await parse(PARTIAL_QUERY);

    expect(result.tier).toBe("llm");
    expect(result.filters).toEqual(VALID_FILTERS);
  });
});

describe("parseWithTiers — failing LLM falls back to rules with a notice", () => {
  it("on a timeout", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("aborted", "TimeoutError")));

    const result = await parse(PARTIAL_QUERY);

    expect(result.tier).toBe("rules");
    expect(result.filters).toEqual([{ field: "pe", op: "lt", value: 20 }]);
    expect(result.notice).toBe(AI_RESTING_NOTICE);
  });

  it("on malformed JSON", async () => {
    vi.stubGlobal("fetch", mockFetchJson(chatBody("Sure! Here you go: {not json at all")));
    expect((await parse(PARTIAL_QUERY)).tier).toBe("rules");
  });

  it("on schema-invalid filters, which are discarded and never cached", async () => {
    vi.stubGlobal("fetch", mockFetchJson(chatBody(filterReply([{ field: "pe", op: "eq", value: "cheap" }]))));

    const result = await parse(PARTIAL_QUERY);

    expect(result.tier).toBe("rules");
    expect(writeCacheEntry).not.toHaveBeenCalled();
  });

  it("on a non-2xx response", async () => {
    vi.stubGlobal("fetch", mockFetchJson({ error: "unauthorized" }, false));
    expect((await parse(PARTIAL_QUERY)).notice).toBe(AI_RESTING_NOTICE);
  });

  it("when the model name is missing, without calling fetch", async () => {
    vi.stubEnv("LLM_MODEL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await parse(PARTIAL_QUERY);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.notice).toBe(AI_RESTING_NOTICE);
  });
});

describe("parseWithTiers — guardrails", () => {
  it("stops calling the LLM for an IP after 10 calls in a minute", async () => {
    const fetchMock = mockFetchJson(chatBody(filterReply()));
    vi.stubGlobal("fetch", fetchMock);
    const guard = createLlmGuard();

    for (let i = 0; i < 10; i++) await parseWithTiers(`${PARTIAL_QUERY} ${i}`, { ip: "9.9.9.9", guard });
    const eleventh = await parseWithTiers(`${PARTIAL_QUERY} 10`, { ip: "9.9.9.9", guard });

    expect(fetchMock).toHaveBeenCalledTimes(10);
    expect(eleventh).toMatchObject({ tier: "rules", notice: AI_RESTING_NOTICE });
  });

  it("stops calling the LLM for everyone once the daily cap is reached", async () => {
    vi.stubEnv("LLM_DAILY_CAP", "1");
    const fetchMock = mockFetchJson(chatBody(filterReply()));
    vi.stubGlobal("fetch", fetchMock);
    const guard = createLlmGuard();

    await parseWithTiers(PARTIAL_QUERY, { ip: "a", guard });
    const second = await parseWithTiers(`${PARTIAL_QUERY} again`, { ip: "b", guard });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.notice).toBe(AI_RESTING_NOTICE);
  });

  it("answers an identical query from the cache without calling the LLM", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(readCacheEntry).mockResolvedValue({
      filters: VALID_FILTERS,
      notes: ["P/E below 15"],
      unmatched: [],
      intent: "filter",
      answer: null,
    });

    const result = await parse(PARTIAL_QUERY);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ tier: "cache", filters: VALID_FILTERS, notes: ["P/E below 15"] });
  });

  it("returns a cached question with its answer", async () => {
    vi.stubGlobal("fetch", vi.fn());
    vi.mocked(readCacheEntry).mockResolvedValue({
      filters: [],
      notes: [],
      unmatched: [],
      intent: "question",
      answer: "P/E is price over earnings.",
    });

    const result = await parse("what is pe ratio");

    expect(result).toMatchObject({ tier: "cache", intent: "question", answer: "P/E is price over earnings." });
  });
});

describe("parseWithTiers — DEMO_MODE", () => {
  it("makes zero network calls and answers from cache", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(readCacheEntry).mockResolvedValue({ filters: VALID_FILTERS, notes: [], unmatched: [] });

    const result = await parse(PARTIAL_QUERY);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ tier: "cache", intent: "filter" });
  });

  it("makes zero network calls and falls back to rules with a notice on a cache miss", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await parse("what is a good stock");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ tier: "rules", notice: AI_RESTING_NOTICE });
  });
});
