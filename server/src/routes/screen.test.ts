import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import type { Stock } from "../data/stockSchema.js";
import { DEFAULT_PAGE_SIZE } from "../engine/screenRequest.js";

// These run against the real data/stocks.json, so they assert on rules that
// hold whatever the market did (every row matches the filter, page sizes are
// respected) rather than on prices that change every snapshot.

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

async function screen(body: unknown): Promise<{ status: number; json: any }> {
  const response = await fetch(`${baseUrl}/api/screen`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: await response.json() };
}

describe("POST /api/screen", () => {
  it("returns a page of results and the total for an empty request", async () => {
    const { status, json } = await screen({});
    expect(status).toBe(200);
    expect(json.data.total).toBeGreaterThan(0);
    expect(json.data.items.length).toBe(Math.min(DEFAULT_PAGE_SIZE, json.data.total));
  });

  it("includes the snapshot's asOf date", async () => {
    const { json } = await screen({});
    expect(typeof json.data.asOf).toBe("string");
    expect(new Date(json.data.asOf).toString()).not.toBe("Invalid Date");
  });

  it("respects the requested page size", async () => {
    const { json } = await screen({ pageSize: 5 });
    expect(json.data.items).toHaveLength(5);
    expect(json.data.total).toBeGreaterThan(5);
  });

  it("returns a different page for page 2", async () => {
    const first = await screen({ pageSize: 5, page: 1 });
    const second = await screen({ pageSize: 5, page: 2 });
    expect(second.json.data.items[0].ticker).not.toBe(first.json.data.items[0].ticker);
    expect(second.json.data.total).toBe(first.json.data.total);
  });

  it("returns an empty page past the end without erroring", async () => {
    const { status, json } = await screen({ page: 9999 });
    expect(status).toBe(200);
    expect(json.data.items).toEqual([]);
    expect(json.data.total).toBeGreaterThan(0);
  });

  it("only returns stocks matching a sector filter", async () => {
    const body = { filters: [{ field: "sector", op: "eq", value: "Energy" }], pageSize: 100 };
    const { json } = await screen(body);
    expect(json.data.total).toBeGreaterThan(0);
    for (const stock of json.data.items as Stock[]) {
      expect(stock.sector).toBe("Energy");
    }
  });

  it("applies several filters together", async () => {
    const body = {
      filters: [
        { field: "sector", op: "eq", value: "Energy" },
        { field: "pe", op: "lt", value: 30 },
      ],
      pageSize: 100,
    };
    const { json } = await screen(body);
    for (const stock of json.data.items as Stock[]) {
      expect(stock.sector).toBe("Energy");
      expect(stock.pe).not.toBeNull();
      expect(stock.pe as number).toBeLessThan(30);
    }
  });

  it("never returns a stock with a missing value for a numeric filter", async () => {
    // Every real debt-to-equity is >= 0, so this matches every stock that has
    // the figure at all — and must exclude the ones where it is null.
    const body = { filters: [{ field: "debtToEquity", op: "gt", value: -1 }], pageSize: 100 };
    const { json } = await screen(body);
    expect(json.data.total).toBeGreaterThan(0);
    for (const stock of json.data.items as Stock[]) {
      expect(stock.debtToEquity).not.toBeNull();
    }
  });

  it("searches by name or ticker", async () => {
    const { json } = await screen({ search: "reliance", pageSize: 100 });
    expect(json.data.total).toBeGreaterThan(0);
    for (const stock of json.data.items as Stock[]) {
      const haystack = `${stock.ticker} ${stock.name ?? ""}`.toLowerCase();
      expect(haystack).toContain("reliance");
    }
  });

  it("sorts results and keeps missing values last", async () => {
    const { json } = await screen({ sort: { field: "pe", direction: "asc" }, pageSize: 100 });
    const pes = (json.data.items as Stock[]).map((stock) => stock.pe);

    const firstNullAt = pes.indexOf(null);
    const withValues = firstNullAt === -1 ? pes : pes.slice(0, firstNullAt);
    const nullsAfter = firstNullAt === -1 ? [] : pes.slice(firstNullAt);

    expect(nullsAfter.every((pe) => pe === null)).toBe(true);
    for (let i = 1; i < withValues.length; i++) {
      expect(withValues[i] as number).toBeGreaterThanOrEqual(withValues[i - 1] as number);
    }
  });

  it("returns 400 with a readable message for an invalid filter", async () => {
    const { status, json } = await screen({ filters: [{ field: "pe", op: "eq", value: "cheap" }] });
    expect(status).toBe(400);
    expect(typeof json.error).toBe("string");
    expect(json.error).toContain("holds a number");
  });

  it("returns 400 for an unknown field", async () => {
    const { status } = await screen({ filters: [{ field: "dividendYield", op: "gt", value: 1 }] });
    expect(status).toBe(400);
  });

  it("returns 400 for an unknown key in the body", async () => {
    const { status } = await screen({ pagesize: 10 });
    expect(status).toBe(400);
  });

  it("returns 400 for an out-of-range page size", async () => {
    const { status } = await screen({ pageSize: 1000 });
    expect(status).toBe(400);
  });
});
