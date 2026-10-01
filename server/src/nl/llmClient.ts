import type { FilterSpec } from "../engine/filterSpec.js";
import { buildParsePrompt, parseModelOutput } from "./llmPrompt.js";

/** The cloud tier gets 5 seconds; past that the rule parser is a better answer than a slow one. */
export const LLM_TIMEOUT_MS = 5000;

// Request/response shapes below were taken from each provider's current REST
// documentation (checked September 2026), not from memory:
//
//   Gemini: POST /v1beta/models/{model}:generateContent, x-goog-api-key header,
//           {contents:[{parts:[{text}]}]} -> candidates[0].content.parts[0].text
//   Groq:   POST /openai/v1/chat/completions, Authorization: Bearer,
//           {model, messages:[...]} -> choices[0].message.content
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
};

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
  };
}

function groqCall(apiKey: string, model: string, prompt: string): ProviderCall {
  return {
    url: "https://api.groq.com/openai/v1/chat/completions",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: {
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      response_format: { type: "json_object" },
    },
    readText: (json) => {
      const content = (json as { choices?: { message?: { content?: unknown } }[] }).choices?.[0]?.message?.content;
      return typeof content === "string" ? content : null;
    },
  };
}

/**
 * The cloud LLM tier. Returns null — never throws — when it is not configured,
 * times out, errors, or answers with anything the FilterSpec schema rejects,
 * so the orchestrator can simply move to the next tier.
 *
 * The model name is only ever read from LLM_MODEL. If it is missing we skip
 * the tier rather than guess a model that may not exist on the account.
 */
export async function callLlm(query: string): Promise<FilterSpec | null> {
  const provider = process.env.LLM_PROVIDER?.trim().toLowerCase();
  const apiKey = process.env.LLM_API_KEY?.trim();
  const model = process.env.LLM_MODEL?.trim();

  if (!provider || !apiKey || !model) return null;

  const prompt = buildParsePrompt(query);
  let call: ProviderCall;
  if (provider === "gemini") {
    call = geminiCall(apiKey, model, prompt);
  } else if (provider === "groq") {
    call = groqCall(apiKey, model, prompt);
  } else {
    return null;
  }

  try {
    const response = await fetch(call.url, {
      method: "POST",
      headers: call.headers,
      body: JSON.stringify(call.body),
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
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
