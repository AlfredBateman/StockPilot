import { Router } from "express";
import { loadStocks } from "../data/loadStocks.js";

// GET /api/sectors — the distinct sectors present in the snapshot, so the UI
// can build a sector filter without hard-coding a list that might drift out of
// step with the data.
export const sectorsRouter = Router();

sectorsRouter.get("/", async (_req, res) => {
  const snapshot = await loadStocks();

  const sectors = [
    ...new Set(
      snapshot.stocks
        .map((stock) => stock.sector)
        .filter((sector): sector is string => sector !== null)
    ),
  ].sort((a, b) => a.localeCompare(b));

  res.json({ data: sectors });
});
