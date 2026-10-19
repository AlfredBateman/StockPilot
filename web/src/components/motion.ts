// Every anime.js animation in the app lives in this file (docs/DESIGN.md
// section 18), so there is exactly one place to check what moves and why.
// Each function reads prefers-reduced-motion first; when it's set, the
// function puts the element straight into its final state and animates
// nothing. Components only call these; they never import anime.js directly.
import { animate, cubicBezier, stagger } from "animejs";

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
  /** The two cubic-bezier curves as [x1, y1, x2, y2], the same as --ease-out-soft and --ease-in-soft. */
  bezierOut: [0.2, 0, 0, 1],
  bezierIn: [0.4, 0, 1, 1],
} as const;

// anime.js 4 no longer accepts "cubicBezier(...)" strings; it takes the easing function.
const easeOut = cubicBezier(...MOTION.bezierOut);
const easeIn = cubicBezier(...MOTION.bezierIn);

/** True when the user has asked the OS/browser for reduced motion. Safe outside a browser (returns false). */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Runs an animation that hands its elements back to plain CSS when it finishes (revert), so nothing keeps an
 * inline style. The returned function reverts it early, for effect cleanup; after the end it does nothing.
 */
function playThenRevert(targets: HTMLElement | HTMLElement[], params: Parameters<typeof animate>[1]): () => void {
  let finished = false;
  const animation = animate(targets, {
    ...params,
    onComplete: (self) => {
      finished = true;
      self.revert();
    },
  });
  return () => {
    if (!finished) animation.revert();
  };
}

/**
 * (a) Table rows / mobile stock cards: the first 12 fade in and rise 4px, 180ms
 * each, 15ms apart (the rest simply appear). anime.js writes the start values
 * as soon as it is called, so there is no flash and no hand-set opacity.
 * Returns a function that stops it and reverts the rows to plain CSS (effect cleanup).
 * Reduced motion: nothing is touched, rows are simply visible.
 */
export function animateRowsIn(rows: HTMLElement[]): () => void {
  if (rows.length === 0 || prefersReducedMotion()) return () => {};
  return playThenRevert(rows.slice(0, MOTION.staggerMax), {
    opacity: [0, 1],
    translateY: [4, 0],
    duration: MOTION.base,
    delay: stagger(MOTION.stagger),
    ease: easeOut,
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
 * Returns a function that stops it and reverts the button to plain CSS (effect cleanup). Reduced motion: nothing happens.
 */
export function popStar(el: HTMLElement): () => void {
  if (prefersReducedMotion()) return () => {};
  return playThenRevert(el, { scale: [{ to: 1.15 }, { to: 1 }], duration: MOTION.fast, ease: easeOut });
}

/**
 * (d) A closing drawer fades and slides 32px right over 180ms. The drawer itself is already unmounted by the
 * caller, so this plays on a copy of it: inert, hidden from screen readers and pointer-events none, so it
 * cannot take a click, a Tab stop or an Esc, and focus return and re-opening never wait for it. The copy
 * removes itself when it finishes (or after a second, if the tab was hidden and the animation stalled).
 * Reduced motion: no copy at all, the drawer just disappears.
 */
export function animateDrawerOut(root: HTMLElement): void {
  if (prefersReducedMotion()) return;
  const ghost = root.cloneNode(true) as HTMLElement;
  ghost.setAttribute("inert", "");
  ghost.setAttribute("aria-hidden", "true");
  ghost.style.pointerEvents = "none";
  // A second copy of every id (aria links, chart gradients, Guide terms) must not confuse getElementById.
  for (const el of ghost.querySelectorAll("[id]")) el.removeAttribute("id");
  const backdrop = ghost.querySelector<HTMLElement>("[data-drawer-backdrop]");
  const panel = ghost.querySelector<HTMLElement>("[data-drawer-panel]");
  if (!backdrop || !panel) return;
  // The copy is a new element, so the CSS `starting:` entrance would play on it: switch it off.
  backdrop.style.transition = "none";
  panel.style.transition = "none";
  document.body.appendChild(ghost);
  const scroller = ghost.querySelector<HTMLElement>("[data-drawer-scroll]");
  if (scroller) scroller.scrollTop = root.querySelector<HTMLElement>("[data-drawer-scroll]")?.scrollTop ?? 0;
  const remove = () => ghost.remove();
  setTimeout(remove, 1000);
  animate(backdrop, { opacity: [1, 0], duration: MOTION.base, ease: easeIn });
  animate(panel, {
    opacity: [1, 0],
    translateX: [0, 32],
    duration: MOTION.base,
    ease: easeIn,
    onComplete: remove,
  });
}
