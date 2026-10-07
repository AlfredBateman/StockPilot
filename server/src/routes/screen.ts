import { Router } from "express";
import type { ZodError } from "zod";
import { loadStocks } from "../data/loadStocks.js";
import { applyFilters } from "../engine/applyFilters.js";
import { paginate } from "../engine/paginate.js";
import { ScreenRequestSchema } from "../engine/screenRequest.js";
import { searchStocks } from "../engine/searchStocks.js";
import { sortStocks } from "../engine/sortStocks.js";

// POST /api/screen — the one endpoint that answers "which stocks match this?".
export const screenRouter = Router();

screenRouter.post("/", async (req, res) => {
  // An empty body is a valid request, so fall back to {} and let the schema
  // fill in its defaults.
  const parsed = ScreenRequestSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: describeIssues(parsed.error) });
    return;
  }

  const { filters, search, sort, page, pageSize } = parsed.data;

  const snapshot = await loadStocks();

  // Order matters: narrow the list first, then order it, then cut the page.
  // `total` therefore counts everything that matched, not just this page.
  const matched = searchStocks(applyFilters(snapshot.stocks, filters), search);
  const { items, total } = paginate(sortStocks(matched, sort), page, pageSize);

  // asOf lets the client show "data as of <date>" without a separate
  // request; it's the one field from the snapshot that isn't per-stock.
  res.json({ data: { items, total, asOf: snapshot.asOf } });
});

/** Turns zod's issue list into one readable sentence for the client. */
function describeIssues(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const where = issue.path.join(".");
      return where ? `${where}: ${issue.message}` : issue.message;
    })
    .join("; ");
}
