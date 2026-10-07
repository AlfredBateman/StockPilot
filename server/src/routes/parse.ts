import { Router } from "express";
import { loadStocks } from "../data/loadStocks.js";
import { parseWithTiers } from "../nl/parseOrchestrator.js";
import { zeroResultHelp } from "../nl/zeroResultHelp.js";

// POST /api/parse — free text in, FilterSpec (or a short answer) out; tier
// order is in nl/parseOrchestrator.ts. Unlike /api/screen the body is never
// zod-validated and this always answers 200 (a missing or non-string `query`
// is treated as ""): graceful degradation, never a 400 for "didn't understand".
export const parseRouter = Router();

parseRouter.post("/", async (req, res) => {
  const query = typeof req.body?.query === "string" ? req.body.query : "";
  const result = await parseWithTiers(query, { ip: req.ip });

  // Zero-result help is worked out here on the real data, never by the LLM.
  // If the data can't be loaded the answer simply has no suggestions.
  if (result.intent === "filter" && (result.filters.length > 0 || result.unmatched.length > 0)) {
    try {
      const snapshot = await loadStocks();
      result.suggestions = zeroResultHelp(snapshot.stocks, result.filters, result.unmatched);
    } catch {
      // Data not loadable: the answer keeps its empty suggestions.
    }
  }

  res.status(200).json({ data: result });
});
