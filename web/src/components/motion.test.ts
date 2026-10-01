import { afterEach, describe, expect, it, vi } from "vitest";
import { animateChipIn, animateChipOut, animateRowsIn, countUp, prefersReducedMotion, slideDown } from "./motion";

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
    animateRowsIn([row]);
    expect(row.style.opacity).toBeUndefined();
  });

  it("(b) writes the final price immediately", () => {
    setReducedMotion(true);
    const el = fakeElement();
    countUp(el, 2993.5, (n) => n.toFixed(2));
    expect(el.textContent).toBe("2993.50");
  });

  it("(c) shows an added chip as-is and removes a chip at once", () => {
    setReducedMotion(true);
    const chip = fakeElement();
    animateChipIn(chip);
    expect(chip.style.opacity).toBeUndefined();

    const done = vi.fn();
    animateChipOut(fakeElement(), done);
    expect(done).toHaveBeenCalledOnce();
  });

  it("(d) leaves the results panel at its natural height", () => {
    setReducedMotion(true);
    const panel = fakeElement();
    slideDown(panel);
    expect(panel.style.height).toBeUndefined();
    expect(panel.style.opacity).toBeUndefined();
  });
});
