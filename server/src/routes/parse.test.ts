import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
