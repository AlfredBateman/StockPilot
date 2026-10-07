import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getDataStatus } from "../data/loadStocks.js";
import { createApp } from "../app.js";

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

  it("still answers ok with null dataSource and asOf when no data can be loaded", async () => {
    vi.mocked(getDataStatus).mockRejectedValueOnce(new Error("no data"));
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: Record<string, unknown> };
    expect(json.data).toMatchObject({ status: "ok", dataSource: null, asOf: null });
  });
});
