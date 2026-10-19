import { Router } from "express";
import { loadStocks } from "../data/loadStocks.js";
import { searchStocks } from "../engine/searchStocks.js";
import { parseWithTiers } from "../nl/parseOrchestrator.js";
import { zeroResultHelp } from "../nl/zeroResultHelp.js";

// POST /api/parse — free text in, FilterSpec (or a short answer) out; tier
// order is in nl/parseOrchestrator.ts. Unlike /api/screen the body is never
// zod-validated and this always answers 200 (a missing or non-string `query`
// is treated as ""): graceful degradation, never a 400 for "didn't understand".
export const parseRouter = Router();

parseRouter.post("/", async (req, res) => {
  const query = typeof req.body?.query === "string" ? req.body.query : "";

  // The stocks are needed to recognise company names. If the data can't be
  // loaded, names are simply not recognised and the answer has no suggestions.
  const stocks = await loadStocks().then(
    (snapshot) => snapshot.stocks,
    () => []
  );
  const result = await parseWithTiers(query, { ip: req.ip, stocks });

  // Zero-result help is worked out here on the real data, never by the LLM,
  // within the companies the query named (if any).
  if (result.intent === "filter" && (result.filters.length > 0 || result.unmatched.length > 0)) {
    const named = result.search ? searchStocks(stocks, result.search) : stocks;
    result.suggestions = zeroResultHelp(named, result.filters, result.unmatched);
  }

  res.status(200).json({ data: result });
});
