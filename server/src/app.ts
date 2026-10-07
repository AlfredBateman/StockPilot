import fs from "node:fs";
import path from "node:path";
import express from "express";
import cors from "cors";
import { healthRouter } from "./routes/health.js";
import { parseRouter } from "./routes/parse.js";
import { screenRouter } from "./routes/screen.js";
import { sectorsRouter } from "./routes/sectors.js";
import { stocksRouter } from "./routes/stocks.js";

// web/dist sits two folders above this file both under tsx (server/src) and
// after tsc (server/dist), so one path works in dev and in production.
const DEFAULT_WEB_DIST = path.resolve(import.meta.dirname, "../../web/dist");

export type AppOptions = {
  /** Folder holding the built frontend; defaults to web/dist. Tests pass a temp folder. */
  webDist?: string;
};

// Builds the Express app without starting a listener, so tests can import
// it directly instead of binding to a real port.
export function createApp(options: AppOptions = {}) {
  const app = express();

  // Basic hardening headers (a hand-written subset of what helmet sets, so no
  // new dependency). No Content-Security-Policy on purpose: a wrong one would
  // silently break the charts' inline styles.
  app.disable("x-powered-by");
  // Render puts one proxy in front of the app; trusting exactly that hop makes
  // req.ip the visitor's address (for the LLM rate limit) instead of the proxy's.
  app.set("trust proxy", 1);
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });

  // The page and the API share one origin in production, so CORS stays off
  // unless ALLOWED_ORIGIN names a different site that may call the API.
  const allowedOrigin = process.env.ALLOWED_ORIGIN?.trim();
  if (allowedOrigin) app.use(cors({ origin: allowedOrigin }));

  app.use(express.json());
  app.use("/api/health", healthRouter);
  app.use("/api/stocks", stocksRouter);
  app.use("/api/screen", screenRouter);
  app.use("/api/sectors", sectorsRouter);
  app.use("/api/parse", parseRouter);

  // Serve the built frontend only if it exists, so `npm run dev` and the
  // tests (which have no build) behave exactly as before.
  const webDist = options.webDist ?? DEFAULT_WEB_DIST;
  const indexHtml = path.join(webDist, "index.html");
  if (fs.existsSync(indexHtml)) {
    app.use(express.static(webDist));
    // SPA fallback: any other GET that is not an API call gets the app shell.
    app.use((req, res, next) => {
      if ((req.method !== "GET" && req.method !== "HEAD") || req.path.startsWith("/api")) {
        next();
        return;
      }
      res.sendFile(indexHtml);
    });
  }

  return app;
}
