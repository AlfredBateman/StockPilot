// Every anime.js animation in the app lives in this file (docs/DESIGN.md
// section 18), so there is exactly one place to check what moves and why.
// Each function reads prefers-reduced-motion first; when it's set, the
// function puts the element straight into its final state and animates
// nothing. Components only call these; they never import anime.js directly.
import { animate, stagger } from "animejs";

/** True when the user has asked the OS/browser for reduced motion. Safe outside a browser (returns false). */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * (a) Table rows / mobile stock cards animate in on a data load: fade in and
 * rise 4px, 180ms each, 20ms apart. Opacity is set to 0 synchronously first,
 * so the rows never flash at full opacity for a frame before the animation's
 * first tick. Reduced motion: nothing is touched, rows are simply visible.
 */
export function animateRowsIn(rows: HTMLElement[]): void {
  if (rows.length === 0 || prefersReducedMotion()) return;
  for (const row of rows) row.style.opacity = "0";
  animate(rows, {
    opacity: [0, 1],
    translateY: [4, 0],
    duration: 180,
    delay: stagger(20),
    ease: "outQuad",
  });
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
    duration: 700,
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

/** (c, in) A newly added filter chip scales up from 85% and fades in, 120ms. Reduced motion: shown as-is. */
export function animateChipIn(el: HTMLElement): void {
  if (prefersReducedMotion()) return;
  el.style.opacity = "0";
  animate(el, { opacity: [0, 1], scale: [0.85, 1], duration: 120, ease: "outQuad" });
}

/**
 * (c, out) A removed filter chip scales down and fades out, 120ms, then `done`
 * runs (which actually removes the filter). Reduced motion: `done` runs
 * immediately, so the chip disappears at once.
 */
export function animateChipOut(el: HTMLElement, done: () => void): void {
  if (prefersReducedMotion()) {
    done();
    return;
  }
  animate(el, { opacity: [1, 0], scale: [1, 0.85], duration: 120, ease: "inQuad", onComplete: () => done() });
}

/**
 * (d) The QueryBox results panel slides down from 0 to its natural height
 * and fades in, 200ms, then hands its height back to CSS ("auto") so later
 * content changes size normally. Reduced motion: shown at full height at once.
 */
export function slideDown(el: HTMLElement): void {
  if (prefersReducedMotion()) return;
  const height = el.scrollHeight;
  el.style.overflow = "hidden";
  el.style.height = "0px";
  el.style.opacity = "0";
  animate(el, {
    height: [0, height],
    opacity: [0, 1],
    duration: 200,
    ease: "outCubic",
    onComplete: () => {
      el.style.height = "";
      el.style.overflow = "";
    },
  });
}
