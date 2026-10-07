import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";

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

async function parse(body: unknown) {
  const response = await fetch(`${baseUrl}/api/parse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await response.json()) as { data?: unknown; error?: string };
  return { status: response.status, json };
}

describe("POST /api/parse", () => {
  it("returns 200 with parsed filters for a recognized query", async () => {
    const { status, json } = await parse({ query: "cheap profitable stocks" });
    expect(status).toBe(200);
    expect(json.data).toMatchObject({ tier: "rules" });
    const data = json.data as { filters: unknown[]; notes: string[] };
    expect(data.filters.length).toBeGreaterThan(0);
    expect(data.notes.length).toBe(data.filters.length);
  });

  it("returns 200 with empty filters for gibberish, never an error", async () => {
    const { status, json } = await parse({ query: "asdkjh qweoiuqwe" });
    expect(status).toBe(200);
    const data = json.data as { filters: unknown[]; unmatched: string[] };
    expect(data.filters).toEqual([]);
    expect(data.unmatched.length).toBeGreaterThan(0);
  });

  it("returns 200 even when query is missing", async () => {
    const { status, json } = await parse({});
    expect(status).toBe(200);
    expect(json.data).toMatchObject({ filters: [], notes: [], unmatched: [], tier: "rules" });
  });

  it("returns 200 even when query is not a string", async () => {
    const { status, json } = await parse({ query: 12345 });
    expect(status).toBe(200);
    expect(json.data).toMatchObject({ filters: [], tier: "rules" });
  });

  it("returns 200 for a completely empty body", async () => {
    const response = await fetch(`${baseUrl}/api/parse`, { method: "POST" });
    expect(response.status).toBe(200);
  });
});

describe("POST /api/parse — server-side help", () => {
  // DEMO_MODE keeps these tests offline even if LLM_* happen to be set in the shell.
  beforeAll(() => {
    vi.stubEnv("DEMO_MODE", "true");
  });
  afterEach(() => {
    vi.clearAllMocks();
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("suggests dropping a filter when the query matches zero stocks", async () => {
    // No stock has a profit margin above 9000%, but plenty are large caps.
    const { status, json } = await parse({ query: "large cap profit margin above 9000" });
    expect(status).toBe(200);
    const data = json.data as { filters: unknown[]; suggestions: { label: string; filters: unknown[] }[] };
    expect(data.filters).toHaveLength(2);
    expect(data.suggestions).toHaveLength(1);
    expect(data.suggestions[0].label).toMatch(/^Dropping 'profit margin above 9000%' gives \d+ stocks?$/);
    expect(data.suggestions[0].filters).toEqual([{ field: "marketCapBucket", op: "eq", value: "Large" }]);
  });

  it("gives no suggestions when the filters match stocks", async () => {
    const { json } = await parse({ query: "large cap" });
    expect((json.data as { suggestions: unknown[] }).suggestions).toEqual([]);
  });

  it("reports a typo fix and the intent", async () => {
    const { json } = await parse({ query: "profitible stocks" });
    expect(json.data).toMatchObject({ correctedQuery: "profitable stocks", intent: "filter", answer: null });
  });

  it("reads only the first 200 characters of a long query", async () => {
    const { status, json } = await parse({ query: "cheap " + "word ".repeat(100) });
    expect(status).toBe(200);
    expect((json.data as { notice: string }).notice).toContain("first 200 characters");
  });
});
