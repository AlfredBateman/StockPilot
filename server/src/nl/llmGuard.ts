// Limits on how often the cloud LLM may be called, so one busy user (or a
// script) can't use up a free API quota. Both limits live in memory: a
// restart resets them, which is fine for a single small server.
//
//   - per IP:  at most 10 LLM calls in any 60-second window
//   - global:  at most LLM_DAILY_CAP calls per UTC day (default 300)
//
// When a limit is hit the caller skips the LLM and answers with the rule
// parser, so being limited never means getting an error.

export const PER_IP_PER_MINUTE = 10;
export const DEFAULT_DAILY_CAP = 300;
const WINDOW_MS = 60_000;

/** LLM_DAILY_CAP as a whole number of calls, or the default when unset or not a positive integer. */
export function dailyCapFromEnv(): number {
  const raw = Number(process.env.LLM_DAILY_CAP?.trim());
  return Number.isInteger(raw) && raw > 0 ? raw : DEFAULT_DAILY_CAP;
}

export type LlmGuard = {
  /** Records one LLM call for this IP and returns true, or returns false (recording nothing) if a limit is reached. */
  tryAcquire(ip: string): boolean;
};

export function createLlmGuard(now: () => number = Date.now): LlmGuard {
  const callsByIp = new Map<string, number[]>();
  let day = "";
  let usedToday = 0;

  return {
    tryAcquire(ip) {
      const time = now();

      // Forget calls older than the window, and IPs with nothing left, so the map can't grow forever.
      for (const [key, times] of callsByIp) {
        const recent = times.filter((t) => time - t < WINDOW_MS);
        if (recent.length === 0) callsByIp.delete(key);
        else callsByIp.set(key, recent);
      }

      const today = new Date(time).toISOString().slice(0, 10);
      if (today !== day) {
        day = today;
        usedToday = 0;
      }

      const recent = callsByIp.get(ip) ?? [];
      if (recent.length >= PER_IP_PER_MINUTE) return false;
      if (usedToday >= dailyCapFromEnv()) return false;

      callsByIp.set(ip, [...recent, time]);
      usedToday++;
      return true;
    },
  };
}

/** The one guard the running server shares across all requests. */
export const llmGuard = createLlmGuard();
