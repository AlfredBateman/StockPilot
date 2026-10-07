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
