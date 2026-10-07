import { buildParsePrompt, parseModelOutput, type LlmReply } from "./llmPrompt.js";

/** Gemini gets 5 seconds; past that the rule parser is a better answer than a slow one. */
const LLM_TIMEOUT_MS = 5000;

/** NVIDIA's hosted Nemotron is a reasoning model and slower to first token, so it gets 8 seconds. */
export const NVIDIA_TIMEOUT_MS = 8000;

// Request/response shapes below were taken from each provider's current REST
// documentation (checked September 2026), not from memory:
//
//   Gemini: POST /v1beta/models/{model}:generateContent, x-goog-api-key header,
//           {contents:[{parts:[{text}]}]} -> candidates[0].content.parts[0].text
//   NVIDIA: POST https://integrate.api.nvidia.com/v1/chat/completions (OpenAI-
//           compatible), Authorization: Bearer, {model, messages:[...]} ->
//           choices[0].message.content. The model page on build.nvidia.com
//           (checked October 2026) turns thinking on with the top-level body
//           key "chat_template_kwargs": {"enable_thinking": true}; we send
//           false so replies are short and fast. When thinking is on, the
//           reasoning comes back in message.reasoning_content, which we never
//           read.
//
// Gemini also has a newer "Interactions" API, which we deliberately do not
// use: it keeps conversations server-side by default (store=true) and this
// app sends single-shot, stateless requests that need none of what it adds.

type ProviderCall = {
  url: string;
  headers: Record<string, string>;
  body: unknown;
  /** Pulls the model's text out of that provider's response envelope. */
  readText: (json: unknown) => string | null;
  timeoutMs: number;
};

/** OpenAI-style envelope (NVIDIA): only the final message content, never reasoning_content. */
function readChatContent(json: unknown): string | null {
  const content = (json as { choices?: { message?: { content?: unknown } }[] }).choices?.[0]?.message?.content;
  return typeof content === "string" ? content : null;
}

function geminiCall(apiKey: string, model: string, prompt: string): ProviderCall {
  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0 },
    },
    readText: (json) => {
      const candidate = (json as { candidates?: { content?: { parts?: { text?: unknown }[] } }[] }).candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text;
      return typeof text === "string" ? text : null;
    },
    timeoutMs: LLM_TIMEOUT_MS,
  };
}

function nvidiaCall(apiKey: string, model: string, prompt: string): ProviderCall {
  return {
    url: "https://integrate.api.nvidia.com/v1/chat/completions",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: {
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      // A 3-sentence answer plus the JSON around it fits easily; the cap keeps a runaway reply short.
      max_tokens: 400,
      chat_template_kwargs: { enable_thinking: false },
    },
    readText: readChatContent,
    timeoutMs: NVIDIA_TIMEOUT_MS,
  };
}

const PROVIDERS = new Map<string, (apiKey: string, model: string, prompt: string) => ProviderCall>([
  ["nvidia", nvidiaCall],
  ["gemini", geminiCall],
]);

/** True when provider, key and model are all set and the provider is one we support. No network. */
export function isLlmConfigured(): boolean {
  const provider = process.env.LLM_PROVIDER?.trim().toLowerCase() ?? "";
  return Boolean(PROVIDERS.has(provider) && process.env.LLM_API_KEY?.trim() && process.env.LLM_MODEL?.trim());
}

/**
 * The cloud LLM tier. Returns null — never throws — when it is not configured,
 * times out, errors, or answers with anything the reply schema (or, for a
 * filter reply, the FilterSpec schema) rejects, so the orchestrator can simply
 * move to the next tier.
 *
 * The model name is only ever read from LLM_MODEL. If it is missing we skip
 * the tier rather than guess a model that may not exist on the account.
 */
export async function callLlm(query: string): Promise<LlmReply | null> {
  const provider = process.env.LLM_PROVIDER?.trim().toLowerCase() ?? "";
  const apiKey = process.env.LLM_API_KEY?.trim();
  const model = process.env.LLM_MODEL?.trim();

  const buildCall = PROVIDERS.get(provider);
  if (!buildCall || !apiKey || !model) return null;

  const call = buildCall(apiKey, model, buildParsePrompt(query));

  try {
    const response = await fetch(call.url, {
      method: "POST",
      headers: call.headers,
      body: JSON.stringify(call.body),
      signal: AbortSignal.timeout(call.timeoutMs),
    });
    if (!response.ok) return null;

    const text = call.readText(await response.json());
    return text === null ? null : parseModelOutput(text);
  } catch {
    // Timeout, DNS failure, no internet, malformed JSON body — all the same
    // to us: this tier didn't answer.
    return null;
  }
}
