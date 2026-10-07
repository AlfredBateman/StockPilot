import { Router } from "express";
import { findStock, loadStocks } from "../data/loadStocks.js";

// GET /api/stocks/:ticker — looks up one stock from the cached snapshot.
export const stocksRouter = Router();

stocksRouter.get("/:ticker", async (req, res) => {
  const snapshot = await loadStocks();
  const stock = findStock(snapshot, req.params.ticker);
  if (!stock) {
    res.status(404).json({ error: `No stock found for ticker "${req.params.ticker}"` });
    return;
  }
  res.json({ data: stock });
});
