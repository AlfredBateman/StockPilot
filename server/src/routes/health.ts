import { Router } from "express";
import { getDataStatus } from "../data/loadStocks.js";

// GET /api/health — reports whether the server is up, whether it is running
// in demo mode (no live data sources, safe for offline/demo use), where the
// stock data came from ("mongo" or "file") and its asOf date. If the data
// can't be loaded at all, dataSource and asOf are null; health still answers.
export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  const demoMode = process.env.DEMO_MODE === "true";
  try {
    const { dataSource, asOf } = await getDataStatus();
    res.json({ data: { status: "ok", demoMode, dataSource, asOf } });
  } catch {
    res.json({ data: { status: "ok", demoMode, dataSource: null, asOf: null } });
  }
});
