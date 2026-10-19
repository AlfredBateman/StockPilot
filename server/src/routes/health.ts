import { Router } from "express";
import { getDataStatus } from "../data/loadStocks.js";
import { isLlmConfigured, llmProviderName } from "../nl/llmClient.js";
import { getLlmLastError } from "../nl/llmStatus.js";

// GET /api/health — reports whether the server is up, whether it is running
// in demo mode (no live data sources, safe for offline/demo use), where the
// stock data came from ("mongo" or "file") and its asOf date. If the data
// can't be loaded at all, dataSource and asOf are null; health still answers.
//
// It also says whether the AI helper is set up and why it last failed:
// llmConfigured, llmProvider (name only), llmLastError (a category such as
// "timeout" or "http_429", or null) and llmLastErrorAt. Never the key, the
// prompt, the user's query or the provider's response.
export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  const demoMode = process.env.DEMO_MODE === "true";
  const lastError = getLlmLastError();
  const llm = {
    llmConfigured: isLlmConfigured(),
    llmProvider: llmProviderName(),
    llmLastError: lastError?.reason ?? null,
    llmLastErrorAt: lastError?.at ?? null,
  };
  try {
    const { dataSource, asOf } = await getDataStatus();
    res.json({ data: { status: "ok", demoMode, dataSource, asOf, ...llm } });
  } catch {
    res.json({ data: { status: "ok", demoMode, dataSource: null, asOf: null, ...llm } });
  }
});
