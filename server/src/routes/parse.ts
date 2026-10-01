import { Router } from "express";
import { parseWithTiers } from "../nl/parseOrchestrator.js";

// POST /api/parse — turns free text into a FilterSpec, trying the LLM, Ollama
// and cache tiers before falling back to the offline rule parser (see
// nl/parseOrchestrator.ts). Unlike /api/screen, the request body is never
// zod-validated and this always answers 200: the whole point of this endpoint
// is graceful degradation on arbitrary text (including a missing or
// non-string `query`, treated as ""), never a 400 for "didn't understand
// you". The orchestrator never throws, so there is no error path here either.
export const parseRouter = Router();

parseRouter.post("/", async (req, res) => {
  const query = typeof req.body?.query === "string" ? req.body.query : "";
  res.status(200).json({ data: await parseWithTiers(query) });
});
