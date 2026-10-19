import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { animateRowsIn, countUp, MOTION, popStar, prefersReducedMotion } from "./motion";

// The CSS tokens and the anime.js numbers are written twice (index.css @theme and MOTION), so a test
// keeps them equal. The raw CSS is also checked for the two things the motion rules promise.
const cssSource = readFileSync(new URL("../index.css", import.meta.url), "utf8");

describe("motion tokens", () => {
  const token = (name: string) => cssSource.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1].trim();

  it("MOTION matches the durations and easings in index.css", () => {
    for (const name of ["press", "fast", "base", "enter"] as const) {
      expect(token(`motion-${name}`), name).toBe(`${MOTION[name]}ms`);
    }
    expect(token("ease-out-soft")).toBe(`cubic-bezier(${MOTION.bezierOut.join(", ")})`);
    expect(token("ease-in-soft")).toBe(`cubic-bezier(${MOTION.bezierIn.join(", ")})`);
  });

  it("every @keyframes touches only opacity, transform and background-position (no layout properties)", () => {
    const blocks = cssSource.match(/@keyframes [\w-]+ \{[\s\S]*?\n  \}/g) ?? [];
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      const props = [...block.matchAll(/^\s+([a-z-]+):/gm)].map((m) => m[1]);
      for (const prop of props) expect(["opacity", "transform", "background-position"], block).toContain(prop);
    }
  });

  it("keeps the global reduced-motion block", () => {
    expect(cssSource).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration: 0\.01ms !important/);
    expect(cssSource).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*transition-duration: 0\.01ms !important/);
  });

  it("stays inside the entrance and micro-interaction caps", () => {
    expect(MOTION.enter).toBeLessThanOrEqual(350);
    expect(MOTION.count).toBeLessThanOrEqual(350);
    for (const ms of [MOTION.press, MOTION.fast, MOTION.base]) expect(ms).toBeLessThanOrEqual(200);
  });
});

// The reduced-motion contract: with prefers-reduced-motion set, every
// animation must leave its element in the final state immediately and start
// no anime.js animation at all. These tests pin that down.

function setReducedMotion(reduce: boolean) {
  vi.stubGlobal("window", { matchMedia: () => ({ matches: reduce }) });
}

/** A stand-in for an HTMLElement: only the fields motion.ts touches. */
function fakeElement() {
  return { style: {} as Record<string, string>, textContent: "", scrollHeight: 120 } as unknown as HTMLElement;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("prefersReducedMotion", () => {
  it("is false outside a browser", () => {
    expect(prefersReducedMotion()).toBe(false);
  });

  it("follows the prefers-reduced-motion media query", () => {
    setReducedMotion(true);
    expect(prefersReducedMotion()).toBe(true);
    setReducedMotion(false);
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe("under prefers-reduced-motion", () => {
  it("(a) leaves table rows untouched, so they are fully visible", () => {
    setReducedMotion(true);
    const row = fakeElement();
    const revert = animateRowsIn([row]);
    expect(row.style.opacity).toBeUndefined();
    expect(() => revert()).not.toThrow();
  });

  it("(b) writes the final price immediately", () => {
    setReducedMotion(true);
    const el = fakeElement();
    countUp(el, 2993.5, (n) => n.toFixed(2));
    expect(el.textContent).toBe("2993.50");
  });

  it("(c) does not pop the star", () => {
    setReducedMotion(true);
    const star = fakeElement();
    const revert = popStar(star);
    expect(star.style.transform).toBeUndefined();
    expect(() => revert()).not.toThrow();
  });
});
