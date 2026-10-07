import { afterEach, describe, expect, it, vi } from "vitest";
import { getHealth } from "./client";

describe("getHealth", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the parsed health payload", async () => {
    const payload = { data: { status: "ok", demoMode: true, dataSource: "file", asOf: "2026-10-06T12:30:00.000Z" } };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => payload,
      })
    );

    await expect(getHealth()).resolves.toEqual(payload);
  });
});

describe("waking notice", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  // Each test imports a fresh client, because "server is awake" is module state.
  async function loadClient() {
    vi.resetModules();
    return import("./client");
  }

  it("turns on after 3 seconds of waiting and off once the server answers", async () => {
    vi.useFakeTimers();
    let answer!: () => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise((resolve) => (answer = () => resolve({ ok: true, json: async () => ({ data: {} }) }))))
    );
    const client = await loadClient();

    const pending = client.getHealth();
    expect(client.getWaking()).toBe(false);
    await vi.advanceTimersByTimeAsync(2999);
    expect(client.getWaking()).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(client.getWaking()).toBe(true);

    answer();
    await pending;
    expect(client.getWaking()).toBe(false);
  });

  it("never shows for a fast first call", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {} }) }));
    const client = await loadClient();

    await client.getHealth();
    await vi.advanceTimersByTimeAsync(5000);
    expect(client.getWaking()).toBe(false);
  });

  it("stays off for slow calls after the server has answered once", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {} }) });
    vi.stubGlobal("fetch", fetchMock);
    const client = await loadClient();
    await client.getHealth();

    fetchMock.mockImplementation(() => new Promise(() => {}));
    void client.getHealth();
    await vi.advanceTimersByTimeAsync(10000);
    expect(client.getWaking()).toBe(false);
  });
});
