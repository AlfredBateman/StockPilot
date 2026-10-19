import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLlmGuard } from "./llmGuard.js";
import { clearLlmError, getLlmLastError, type LlmErrorReason } from "./llmStatus.js";
import { parseWithTiers } from "./parseOrchestrator.js";

// One test per failure category the health route can report. Fetch is always
// replaced and the cache mocked, so nothing leaves the machine or touches disk.
vi.mock("./nlCache.js", () => ({
  readCacheEntry: vi.fn().mockResolvedValue(null),
  writeCacheEntry: vi.fn().mockResolvedValue(undefined),
}));

/** Rules find "cheap" but not "strong growth", so the LLM tier is needed. */
const QUERY = "cheap stocks with strong growth";
const SECRET_KEY = "sk-secret-key-123";

const chat = (text: string) => ({ choices: [{ message: { content: text } }] });
const okJson = (body: unknown) => vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body });

let errorLog: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.stubEnv("LLM_PROVIDER", "nvidia");
  vi.stubEnv("LLM_API_KEY", SECRET_KEY);
  vi.stubEnv("LLM_MODEL", "test-model");
  vi.stubEnv("LLM_DAILY_CAP", "");
  vi.stubEnv("DEMO_MODE", "false");
  clearLlmError();
  errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Runs one query and checks the recorded reason, an ISO time, and that the log line is only the category. */
async function expectReason(reason: LlmErrorReason, guard = createLlmGuard()) {
  await parseWithTiers(QUERY, { ip: "1.1.1.1", guard });
  const last = getLlmLastError();
  expect(last?.reason).toBe(reason);
  expect(new Date(last?.at ?? "").toISOString()).toBe(last?.at);
  expect(errorLog).toHaveBeenCalledWith(`[llm] ${reason}`);
}

describe("LLM failure categories", () => {
  it("not_configured when the key is missing", async () => {
    vi.stubEnv("LLM_API_KEY", "");
    vi.stubGlobal("fetch", vi.fn());
    await expectReason("not_configured");
  });

  it("timeout", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("timed out", "TimeoutError")));
    await expectReason("timeout");
  });

  it("timeout while the body is still being read", async () => {
    const stalled = { ok: true, status: 200, json: async () => Promise.reject(new DOMException("t", "TimeoutError")) };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(stalled));
    await expectReason("timeout");
  });

  it("network_error for any other fetch failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("getaddrinfo ENOTFOUND")));
    await expectReason("network_error");
  });

  it.each([401, 429, 503])("http_%i for a non-2xx response", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status, json: async () => ({}) }));
    await expectReason(`http_${status}`);
  });

  it("bad_json when the reply has no JSON in it", async () => {
    vi.stubGlobal("fetch", okJson(chat("Sorry, I cannot help with that.")));
    await expectReason("bad_json");
  });

  it("bad_json when the response body is not JSON at all", async () => {
    const broken = { ok: true, status: 200, json: async () => Promise.reject(new SyntaxError("Unexpected token <")) };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(broken));
    await expectReason("bad_json");
  });

  it("validation_failed when the JSON breaks the filter schema", async () => {
    const reply = JSON.stringify({ intent: "filter", filters: [{ field: "pe", op: "eq", value: "cheap" }] });
    vi.stubGlobal("fetch", okJson(chat(reply)));
    await expectReason("validation_failed");
  });

  it("rate_capped_ip after 10 calls from one IP in a minute", async () => {
    const reply = JSON.stringify({ intent: "filter", filters: [{ field: "pe", op: "lt", value: 15 }] });
    vi.stubGlobal("fetch", okJson(chat(reply)));
    const guard = createLlmGuard();
    for (let i = 0; i < 10; i++) await parseWithTiers(`${QUERY} ${i}`, { ip: "1.1.1.1", guard });
    expect(getLlmLastError()).toBeNull();
    await expectReason("rate_capped_ip", guard);
  });

  it("rate_capped_daily once the daily cap is used up", async () => {
    vi.stubEnv("LLM_DAILY_CAP", "1");
    const reply = JSON.stringify({ intent: "filter", filters: [{ field: "pe", op: "lt", value: 15 }] });
    vi.stubGlobal("fetch", okJson(chat(reply)));
    const guard = createLlmGuard();
    await parseWithTiers(`${QUERY} first`, { ip: "a", guard });
    await expectReason("rate_capped_daily", guard);
  });

  it("a good answer clears the last error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("t", "TimeoutError")));
    await expectReason("timeout");
    const reply = JSON.stringify({ intent: "filter", filters: [{ field: "pe", op: "lt", value: 15 }] });
    vi.stubGlobal("fetch", okJson(chat(reply)));
    await parseWithTiers(`${QUERY} again`, { ip: "1.1.1.1", guard: createLlmGuard() });
    expect(getLlmLastError()).toBeNull();
  });

  it("never records or logs the key, the query or the response body", async () => {
    vi.stubGlobal("fetch", okJson(chat("secret-model-words with no json")));
    await parseWithTiers(QUERY, { ip: "1.1.1.1", guard: createLlmGuard() });
    const seen = JSON.stringify([getLlmLastError(), errorLog.mock.calls]);
    for (const leak of [SECRET_KEY, "strong growth", "secret-model-words"]) expect(seen).not.toContain(leak);
  });
});
