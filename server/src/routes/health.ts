import { Router } from "express";

// GET /api/health — reports whether the server is up and whether it is
// running in demo mode (no live data sources, safe for offline/demo use).
export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  const demoMode = process.env.DEMO_MODE === "true";
  res.json({ data: { status: "ok", demoMode } });
});
