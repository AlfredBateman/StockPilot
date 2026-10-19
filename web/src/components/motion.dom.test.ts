// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { animateRowsIn, popStar } from "./motion";

// Real anime.js against a jsdom document (not reduced motion: jsdom has no matchMedia).
function makeRows(count: number): HTMLElement[] {
  return Array.from({ length: count }, () => document.body.appendChild(document.createElement("div")));
}

describe("animateRowsIn", () => {
  it("animates at most the first 12 rows and leaves the rest untouched", () => {
    const rows = makeRows(25);
    const revert = animateRowsIn(rows);
    expect(rows.slice(0, 12).every((row) => row.style.opacity === "0")).toBe(true);
    expect(rows.slice(12).every((row) => row.style.cssText === "")).toBe(true);
    revert();
  });

  it("reverts every row to plain CSS", () => {
    const rows = makeRows(5);
    animateRowsIn(rows)();
    expect(rows.every((row) => row.style.cssText === "")).toBe(true);
  });

  it("does nothing for no rows", () => {
    expect(() => animateRowsIn([])()).not.toThrow();
  });
});

describe("popStar", () => {
  it("scales the button while it runs and leaves plain CSS once reverted", () => {
    const [star] = makeRows(1);
    const revert = popStar(star);
    expect(star.style.transform).toContain("scale");
    revert();
    expect(star.style.cssText).toBe("");
  });
});
