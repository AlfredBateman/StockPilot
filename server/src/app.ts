import express from "express";
import cors from "cors";
import { healthRouter } from "./routes/health.js";
import { parseRouter } from "./routes/parse.js";
import { screenRouter } from "./routes/screen.js";
import { sectorsRouter } from "./routes/sectors.js";
import { stocksRouter } from "./routes/stocks.js";

// Builds the Express app without starting a listener, so tests can import
// it directly instead of binding to a real port.
export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/api/health", healthRouter);
  app.use("/api/stocks", stocksRouter);
  app.use("/api/screen", screenRouter);
  app.use("/api/sectors", sectorsRouter);
  app.use("/api/parse", parseRouter);
  return app;
}
