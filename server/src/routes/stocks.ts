import { Router } from "express";
import { findStock, loadStocks } from "../data/loadStocks.js";
import { priceHistory } from "../engine/metrics.js";
import { metricReadings } from "../nl/explain.js";

// GET /api/stocks/:ticker — looks up one stock from the cached snapshot.
export const stocksRouter = Router();

stocksRouter.get("/:ticker", async (req, res) => {
  const snapshot = await loadStocks();
  const stock = findStock(snapshot, req.params.ticker);
  if (!stock) {
    res.status(404).json({ error: `No stock found for ticker "${req.params.ticker}"` });
    return;
  }
  // `readings` is a plain-English line per metric, built from fixed templates (nl/explain.ts).
  res.json({ data: { ...stock, ...priceHistory(stock.weeklyCloses), readings: metricReadings(stock) } });
});
