import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_DAILY_CAP, PER_IP_PER_MINUTE, createLlmGuard, dailyCapFromEnv } from "./llmGuard.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

/** A clock the test moves by hand. */
function fakeClock(start = Date.UTC(2026, 9, 7, 10, 0, 0)) {
  let time = start;
  return { now: () => time, advance: (ms: number) => (time += ms) };
}

describe("createLlmGuard — per-IP limit", () => {
  it("allows 10 calls a minute per IP, then refuses the 11th", () => {
    const guard = createLlmGuard(fakeClock().now);

    for (let i = 0; i < PER_IP_PER_MINUTE; i++) expect(guard.tryAcquire("1.1.1.1")).toBe(true);
    expect(guard.tryAcquire("1.1.1.1")).toBe(false);
  });

  it("counts each IP separately", () => {
    const guard = createLlmGuard(fakeClock().now);
    for (let i = 0; i < PER_IP_PER_MINUTE; i++) guard.tryAcquire("1.1.1.1");

    expect(guard.tryAcquire("2.2.2.2")).toBe(true);
  });

  it("allows the IP again once the minute has passed", () => {
    const clock = fakeClock();
    const guard = createLlmGuard(clock.now);
    for (let i = 0; i < PER_IP_PER_MINUTE; i++) guard.tryAcquire("1.1.1.1");

    clock.advance(60_000);
    expect(guard.tryAcquire("1.1.1.1")).toBe(true);
  });
});

describe("createLlmGuard — daily cap", () => {
  it("refuses everyone once LLM_DAILY_CAP calls were made today", () => {
    vi.stubEnv("LLM_DAILY_CAP", "3");
    const guard = createLlmGuard(fakeClock().now);

    expect(guard.tryAcquire("a")).toBe(true);
    expect(guard.tryAcquire("b")).toBe(true);
    expect(guard.tryAcquire("c")).toBe(true);
    expect(guard.tryAcquire("d")).toBe(false);
  });

  it("starts counting again on the next UTC day", () => {
    vi.stubEnv("LLM_DAILY_CAP", "1");
    const clock = fakeClock();
    const guard = createLlmGuard(clock.now);
    guard.tryAcquire("a");
    expect(guard.tryAcquire("b")).toBe(false);

    clock.advance(24 * 60 * 60 * 1000);
    expect(guard.tryAcquire("b")).toBe(true);
  });

  it("a call refused by the per-IP limit does not use up the daily cap", () => {
    vi.stubEnv("LLM_DAILY_CAP", String(PER_IP_PER_MINUTE + 1));
    const guard = createLlmGuard(fakeClock().now);
    for (let i = 0; i < PER_IP_PER_MINUTE + 5; i++) guard.tryAcquire("busy");

    expect(guard.tryAcquire("someone-else")).toBe(true);
  });
});

describe("dailyCapFromEnv", () => {
  it("defaults to 300 when unset or not a positive whole number", () => {
    vi.stubEnv("LLM_DAILY_CAP", "");
    expect(dailyCapFromEnv()).toBe(DEFAULT_DAILY_CAP);
    vi.stubEnv("LLM_DAILY_CAP", "lots");
    expect(dailyCapFromEnv()).toBe(DEFAULT_DAILY_CAP);
    vi.stubEnv("LLM_DAILY_CAP", "-4");
    expect(dailyCapFromEnv()).toBe(DEFAULT_DAILY_CAP);
    vi.stubEnv("LLM_DAILY_CAP", "50");
    expect(dailyCapFromEnv()).toBe(50);
  });
});
