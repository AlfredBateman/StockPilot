import fs from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it, expect } from "vitest";
import { createApp } from "./app.js";

let server: Server | undefined;
let tempDir: string | undefined;

async function start(options?: Parameters<typeof createApp>[0]): Promise<string> {
  server = createApp(options).listen(0);
  await new Promise<void>((resolve) => server!.once("listening", () => resolve()));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

/** A fake web/dist with an index page and one asset. */
function makeWebDist(): string {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "stockpilot-dist-"));
  fs.writeFileSync(path.join(tempDir, "index.html"), "<!doctype html><title>shell</title>");
  fs.writeFileSync(path.join(tempDir, "app.js"), "console.log('asset');");
  return tempDir;
}

afterEach(async () => {
  delete process.env.ALLOWED_ORIGIN;
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = undefined;
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("createApp", () => {
  it("builds an Express app", () => {
    const app = createApp();
    expect(typeof app.listen).toBe("function");
  });

  it("sets basic security headers and hides x-powered-by", async () => {
    const res = await fetch(`${await start({ webDist: makeWebDist() })}/`);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(res.headers.get("x-powered-by")).toBeNull();
  });

  it("sends no CORS headers when ALLOWED_ORIGIN is unset", async () => {
    const res = await fetch(`${await start({ webDist: makeWebDist() })}/`, {
      headers: { Origin: "https://elsewhere.example" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("allows only the origin named in ALLOWED_ORIGIN", async () => {
    process.env.ALLOWED_ORIGIN = "https://app.example";
    const res = await fetch(`${await start({ webDist: makeWebDist() })}/`, {
      headers: { Origin: "https://app.example" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("https://app.example");
  });
});

describe("serving the built frontend", () => {
  it("serves static assets and the index page", async () => {
    const base = await start({ webDist: makeWebDist() });
    expect(await (await fetch(`${base}/app.js`)).text()).toContain("asset");
    expect(await (await fetch(`${base}/`)).text()).toContain("<title>shell</title>");
  });

  it("falls back to index.html for unknown non-API GET routes", async () => {
    const res = await fetch(`${await start({ webDist: makeWebDist() })}/watchlist/anything`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<title>shell</title>");
  });

  it("does not give API paths the app shell", async () => {
    const res = await fetch(`${await start({ webDist: makeWebDist() })}/api/nope`);
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain("<title>shell</title>");
  });

  it("serves nothing extra when there is no build", async () => {
    const res = await fetch(`${await start({ webDist: path.join(os.tmpdir(), "stockpilot-no-such-dist") })}/`);
    expect(res.status).toBe(404);
  });
});
