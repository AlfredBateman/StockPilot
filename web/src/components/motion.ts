// Every anime.js animation in the app lives in this file (docs/DESIGN.md
// section 18), so there is exactly one place to check what moves and why.
// Each function reads prefers-reduced-motion first; when it's set, the
// function puts the element straight into its final state and animates
// nothing. Components only call these; they never import anime.js directly.
import { animate, stagger } from "animejs";

/**
 * The shared motion numbers, mirroring the CSS tokens in index.css @theme (milliseconds).
 * motion.test.ts reads index.css and fails if the two disagree.
 */
export const MOTION = {
  press: 120,
  fast: 150,
  base: 180,
  enter: 240,
  count: 350,
  stagger: 15,
  staggerMax: 12,
  easeOut: "cubicBezier(0.2, 0, 0, 1)",
  easeIn: "cubicBezier(0.4, 0, 1, 1)",
} as const;

/** True when the user has asked the OS/browser for reduced motion. Safe outside a browser (returns false). */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * (a) Table rows / mobile stock cards: the first 12 fade in and rise 4px, 180ms
 * each, 15ms apart (the rest simply appear). anime.js writes the start values
 * as soon as it is called, so there is no flash and no hand-set opacity.
 * Returns a function that reverts the rows to plain CSS (effect cleanup).
 * Reduced motion: nothing is touched, rows are simply visible.
 */
export function animateRowsIn(rows: HTMLElement[]): () => void {
  if (rows.length === 0 || prefersReducedMotion()) return () => {};
  const animation = animate(rows.slice(0, MOTION.staggerMax), {
    opacity: [0, 1],
    translateY: [4, 0],
    duration: MOTION.base,
    delay: stagger(MOTION.stagger),
    ease: MOTION.easeOut,
  });
  return () => {
    animation.revert();
  };
}

/**
 * (b) Counts a number up from 0 into `el`'s text, formatted by `format` on
 * every frame, ending on exactly format(to). Returns a function that stops
 * the count and writes the final value (for effect cleanup). Reduced motion:
 * writes the final value immediately.
 */
export function countUp(el: HTMLElement, to: number, format: (n: number) => string): () => void {
  const finish = () => {
    el.textContent = format(to);
  };
  if (prefersReducedMotion()) {
    finish();
    return () => {};
  }
  const counter = { value: 0 };
  el.textContent = format(0);
  const animation = animate(counter, {
    value: to,
    duration: MOTION.count,
    ease: "outCubic",
    onUpdate: () => {
      el.textContent = format(counter.value);
    },
    onComplete: finish,
  });
  return () => {
    animation.pause();
    finish();
  };
}

/**
 * (c) A small pop on the star when a stock is added to the watchlist: 1 to 1.15 and back, 150ms.
 * Returns a function that reverts the button to plain CSS (effect cleanup). Reduced motion: nothing happens.
 */
export function popStar(el: HTMLElement): () => void {
  if (prefersReducedMotion()) return () => {};
  const animation = animate(el, {
    scale: [{ to: 1.15 }, { to: 1 }],
    duration: MOTION.fast,
    ease: MOTION.easeOut,
    onComplete: (self) => self.revert(),
  });
  return () => {
    animation.revert();
  };
}
