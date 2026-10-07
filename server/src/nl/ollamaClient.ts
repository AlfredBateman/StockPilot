import { buildParsePrompt, parseModelOutput, type LlmReply } from "./llmPrompt.js";

/** A local model should answer fast or not at all; 3s keeps the request snappy. */
export const OLLAMA_TIMEOUT_MS = 3000;

/** Ollama's documented default host and generate endpoint. */
const OLLAMA_URL = "http://localhost:11434/api/generate";

/**
 * The local Ollama tier: same prompt and same validation as the cloud tier,
 * but it never leaves the machine.
 *
 * Ollama's /api/generate requires a model name and we must not invent one, so
 * this reads OLLAMA_MODEL and skips the tier (without making any request) when
 * it isn't set. Like every other tier, it returns null instead of throwing.
 */
export async function callOllama(query: string): Promise<LlmReply | null> {
  const model = process.env.OLLAMA_MODEL?.trim();
  if (!model) return null;

  try {
    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: buildParsePrompt(query), stream: false, format: "json" }),
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const body = (await response.json()) as { response?: unknown };
    return typeof body.response === "string" ? parseModelOutput(body.response) : null;
  } catch {
    // Ollama not installed / not running is the normal case, not an error.
    return null;
  }
}
