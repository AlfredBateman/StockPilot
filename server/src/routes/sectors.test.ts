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

describe("GET /api/sectors", () => {
  it("returns the sectors present in the snapshot", async () => {
    const response = await fetch(`${baseUrl}/api/sectors`);
    const json = (await response.json()) as { data: string[] };

    expect(response.status).toBe(200);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThan(0);
    expect(json.data.every((sector) => typeof sector === "string" && sector.length > 0)).toBe(true);
  });

  it("returns each sector once, sorted alphabetically", async () => {
    const response = await fetch(`${baseUrl}/api/sectors`);
    const { data } = (await response.json()) as { data: string[] };

    expect(new Set(data).size).toBe(data.length);
    expect(data).toEqual([...data].sort((a, b) => a.localeCompare(b)));
  });
});
