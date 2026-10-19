import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getDataStatus } from "../data/loadStocks.js";
import { createApp } from "../app.js";
import { clearLlmError, recordLlmError } from "../nl/llmStatus.js";

// Mock only getDataStatus, so the health route is tested without loading any
// real data source.
vi.mock("../data/loadStocks.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../data/loadStocks.js")>()),
  getDataStatus: vi.fn(),
}));

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

describe("GET /api/health", () => {
  it("reports the data source and asOf", async () => {
    vi.mocked(getDataStatus).mockResolvedValueOnce({ dataSource: "mongo", asOf: "2026-10-06T12:30:00.000Z" });
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: Record<string, unknown> };
    expect(json.data).toMatchObject({ status: "ok", dataSource: "mongo", asOf: "2026-10-06T12:30:00.000Z" });
    expect(typeof json.data.demoMode).toBe("boolean");
  });

  it("reports the AI helper's state without the key, and the last error once there is one", async () => {
    vi.stubEnv("LLM_PROVIDER", "nvidia");
    vi.stubEnv("LLM_API_KEY", "sk-secret-key-123");
    vi.stubEnv("LLM_MODEL", "test-model");
    clearLlmError();
    vi.mocked(getDataStatus).mockResolvedValue({ dataSource: "file", asOf: "2026-10-06T12:30:00.000Z" });
    const get = async () => (await (await fetch(`${baseUrl}/api/health`)).json()) as { data: Record<string, unknown> };

    expect((await get()).data).toMatchObject({
      llmConfigured: true,
      llmProvider: "nvidia",
      llmLastError: null,
      llmLastErrorAt: null,
    });

    vi.spyOn(console, "error").mockImplementation(() => {});
    recordLlmError("http_429");
    const { data } = await get();
    expect(data.llmLastError).toBe("http_429");
    expect(new Date(String(data.llmLastErrorAt)).toISOString()).toBe(data.llmLastErrorAt);
    expect(JSON.stringify(data)).not.toContain("sk-secret-key-123");

    vi.stubEnv("LLM_API_KEY", "");
    expect((await get()).data).toMatchObject({ llmConfigured: false });
    clearLlmError();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("still answers ok with null dataSource and asOf when no data can be loaded", async () => {
    vi.mocked(getDataStatus).mockRejectedValueOnce(new Error("no data"));
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: Record<string, unknown> };
    expect(json.data).toMatchObject({ status: "ok", dataSource: null, asOf: null });
  });
});
