import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useGuide } from "../hooks/guideContext";
import { GLOSSARY, type GlossaryKey } from "./glossary";
import { GlossaryEntryBody } from "./GlossaryEntryBody";
import { IconClose, IconExternal } from "./Icons";

type MetricHelpProps = {
  metric: GlossaryKey;
};

const POPOVER_WIDTH = 400;
/** Smallest gap kept between the popover and the screen edge. */
const EDGE_MARGIN = 16;
/** Gap between the "?" button and the popover. */
const ANCHOR_GAP = 8;

/**
 * A "?" button next to a column header or filter label. It opens a popover with
 * the term's full glossary entry (meaning, why it matters, a real example, how
 * StockPilot uses it) and a "Learn more" link. Works from the keyboard: Enter or
 * Space opens it, focus moves into it, Tab stays inside it, Esc closes it and
 * puts focus back on the button. Clicking outside also closes it.
 *
 * The popover is drawn in a portal with fixed positioning that is clamped to the
 * screen, so a narrow phone, a sideways-scrolling table or a header's overflow
 * can never clip it. The button is 24px with a 36px tap area.
 */
export function MetricHelp({ metric }: MetricHelpProps) {
  const entry = GLOSSARY[metric];
  const { openGuide } = useGuide();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const popoverId = useId();

  // Places the popover under the button, or above it when there is more room there, and caps its height
  // to the room available so the header and the "Learn more" footer always stay visible (the body scrolls).
  function place() {
    const trigger = triggerRef.current;
    const popover = popoverRef.current;
    if (!trigger || !popover) return;
    const anchor = trigger.getBoundingClientRect();
    const width = Math.min(POPOVER_WIDTH, window.innerWidth - 2 * EDGE_MARGIN);
    const left = Math.min(Math.max(anchor.left, EDGE_MARGIN), window.innerWidth - width - EDGE_MARGIN);
    // Width first: the height depends on it (narrower text wraps onto more lines).
    popover.style.width = `${width}px`;
    popover.style.maxHeight = "";
    const naturalHeight = popover.offsetHeight;
    const spaceBelow = window.innerHeight - (anchor.bottom + ANCHOR_GAP) - EDGE_MARGIN;
    const spaceAbove = anchor.top - ANCHOR_GAP - EDGE_MARGIN;
    const placeBelow = naturalHeight <= spaceBelow || spaceBelow >= spaceAbove;
    const height = Math.min(naturalHeight, placeBelow ? spaceBelow : spaceAbove);
    popover.style.maxHeight = `${height}px`;
    popover.style.left = `${left}px`;
    popover.style.top = `${placeBelow ? anchor.bottom + ANCHOR_GAP : anchor.top - ANCHOR_GAP - height}px`;
  }

  // Before the first paint, so the popover never flashes in the top-left corner.
  useLayoutEffect(() => {
    if (open) place();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    popoverRef.current?.focus({ preventScroll: true });

    function close(returnFocus: boolean) {
      setOpen(false);
      if (returnFocus) triggerRef.current?.focus();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close(true);
    }
    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    }
    // The page can scroll or resize while it is open (the table scrolls sideways), so follow the button.
    // (Scrolling inside the popover's own body is not the page moving, and re-placing would fight it.)
    function handleReposition(e: Event) {
      if (e.target instanceof Node && popoverRef.current?.contains(e.target)) return;
      place();
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open]);

  // Keeps Tab inside the popover while it is open (it is in a portal, so the page order does not lead into it).
  function handlePopoverKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab") return;
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("a[href], button"));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === e.currentTarget)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function handleOpenGuide() {
    setOpen(false);
    openGuide(metric);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          // The "?" sits beside a sortable header's own button; it must never reach a clickable parent.
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        aria-label={`What is ${entry.term}?`}
        // currentColor, so the "?" matches whatever it sits in: stone labels, or white text on the dark
        // table header. The ::before pad grows the 24px button to a 36px tap area without moving the layout.
        className="relative ml-1.5 inline-flex size-6 shrink-0 touch-manipulation items-center justify-center rounded-full border border-current text-[0.8125rem] font-semibold leading-none opacity-80 transition-opacity duration-150 before:absolute before:-inset-1.5 before:content-[''] hover:opacity-100 aria-expanded:opacity-100"
      >
        ?
      </button>
      {open &&
        createPortal(
          <div
            ref={popoverRef}
            id={popoverId}
            role="dialog"
            aria-labelledby={titleId}
            tabIndex={-1}
            onKeyDown={handlePopoverKeyDown}
            // A portal still bubbles React events to the parent, so a click in here must not reach a clickable row.
            onClick={(e) => e.stopPropagation()}
            // The text styles are set outright (not left to inherit) so nothing from a table header, such as
            // nowrap, uppercase or letter-spacing, can ever change how the popover reads.
            className="fixed z-50 flex outline-none max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden whitespace-normal break-words rounded-xl border border-stone-200 bg-elevated text-left text-body font-normal normal-case tracking-normal text-stone-700 shadow-e2"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 px-4 pt-4 pb-3">
              <h3 id={titleId} className="text-h3 text-stone-900">
                {entry.term}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                aria-label="Close"
                className="-mr-2 -mt-2 flex size-9 shrink-0 touch-manipulation items-center justify-center rounded-xl text-stone-500 transition-colors duration-150 hover:bg-stone-100 hover:text-stone-900"
              >
                <IconClose size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
              <GlossaryEntryBody entry={entry} />
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-t border-stone-200 bg-stone-50/70 px-4 py-2.5">
              {entry.source ? (
                <a
                  href={entry.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg text-body font-medium text-accent-700 underline decoration-accent-300 underline-offset-4 transition-colors duration-150 hover:text-accent-800 hover:decoration-accent-600"
                >
                  Learn more
                  <IconExternal size={14} />
                  <span className="sr-only">(opens {entry.source.label} in a new tab)</span>
                </a>
              ) : null}
              <button
                type="button"
                onClick={handleOpenGuide}
                className={
                  entry.source
                    ? "inline-flex h-10 touch-manipulation items-center rounded-xl border border-stone-300 bg-elevated px-3.5 text-body font-medium text-stone-800 shadow-e1 transition-[background-color,transform] duration-150 hover:bg-stone-50 active:scale-[0.98]"
                    : "inline-flex h-10 touch-manipulation items-center rounded-xl bg-accent-600 px-3.5 text-body font-medium text-white shadow-e1 transition-[background-color,transform] duration-150 hover:bg-accent-700 active:scale-[0.98]"
                }
              >
                {entry.source ? "See it in the Guide" : "Learn more"}
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
