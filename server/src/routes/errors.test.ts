import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";

// The data layer is made to fail so the shared error handler in app.ts is the
// only thing that can produce the answer.
vi.mock("../data/loadStocks.js", () => ({
  loadStocks: vi.fn().mockRejectedValue(new Error("snapshot unavailable")),
  findStock: vi.fn(),
  getDataStatus: vi.fn(),
}));

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("shared error handler", () => {
  it.each([
    ["GET", "/api/sectors"],
    ["GET", "/api/stocks/TCS.NS"],
    ["POST", "/api/screen"],
  ])("answers %s %s with a 500 and the error message", async (method, path) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      ...(method === "POST" ? { headers: { "Content-Type": "application/json" }, body: "{}" } : {}),
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "snapshot unavailable" });
  });

  it("keeps malformed JSON as a 400 in the {error} shape", async () => {
    const response = await fetch(`${baseUrl}/api/screen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toHaveProperty("error");
  });
});
