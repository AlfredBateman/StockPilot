import { Router } from "express";
import { loadStocks } from "../data/loadStocks.js";
import { parseWithTiers } from "../nl/parseOrchestrator.js";
import { zeroResultHelp } from "../nl/zeroResultHelp.js";

// POST /api/parse — turns free text into a FilterSpec (or, through the LLM
// tier, a short educational answer), see nl/parseOrchestrator.ts for the
// order of tiers. Unlike /api/screen, the request body is never
// zod-validated and this always answers 200: the whole point of this endpoint
// is graceful degradation on arbitrary text (including a missing or
// non-string `query`, treated as ""), never a 400 for "didn't understand
// you". The orchestrator never throws, so there is no error path here either.
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
      result.suggestions = [];
    }
  }

  res.status(200).json({ data: result });
});
