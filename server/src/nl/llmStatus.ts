// What went wrong the last time the cloud LLM tier did not answer, for GET
// /api/health. Only a category and a time are kept: never the key, the prompt,
// the user's query or any part of the response, so it is safe to show publicly.
// In memory only, so a restart clears it.

export type LlmErrorReason =
  | "not_configured"
  | "timeout"
  | "network_error"
  | `http_${number}`
  | "bad_json"
  | "validation_failed"
  | "rate_capped_ip"
  | "rate_capped_daily";

let last: { reason: LlmErrorReason; at: string } | null = null;

/** Remembers the reason and logs the same category (and nothing else) for the server logs. */
export function recordLlmError(reason: LlmErrorReason): void {
  last = { reason, at: new Date().toISOString() };
  console.error(`[llm] ${reason}`);
}

/** A good answer means the tier works again, so the last error is dropped. */
export function clearLlmError(): void {
  last = null;
}

export function getLlmLastError(): { reason: LlmErrorReason; at: string } | null {
  return last;
}
