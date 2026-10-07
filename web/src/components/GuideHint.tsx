import { useEffect } from "react";
import { IconClose } from "./Icons";

type GuideHintProps = {
  onOpen: () => void;
  onDismiss: () => void;
};

/**
 * The first-visit nudge that points at the header's Guide button. It sits just
 * under that button (the caller wraps both in a relative box), never takes
 * focus, never covers the page, and stays gone once dismissed (useGuideHint
 * remembers that). Esc dismisses it too. No animation, so nothing to gate on
 * reduced motion.
 */
export function GuideHint({ onOpen, onDismiss }: GuideHintProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onDismiss();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onDismiss]);

  return (
    <div
      role="note"
      aria-label="Tip: the Guide"
      className="absolute right-0 top-full z-30 mt-3 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-stone-200 bg-elevated p-4 text-left shadow-e2"
    >
      {/* The little arrow pointing up at the Guide button. */}
      <span
        aria-hidden="true"
        className="absolute -top-1.5 right-4 size-3 rotate-45 border-l border-t border-stone-200 bg-elevated"
      />
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss this tip"
        className="absolute right-1.5 top-1.5 flex size-8 touch-manipulation items-center justify-center rounded-lg text-stone-500 transition-colors duration-150 hover:bg-stone-100 hover:text-stone-900"
      >
        <IconClose size={16} />
      </button>
      <p className="pr-7 text-body font-semibold text-stone-900">New to stocks?</p>
      <p className="mt-1 text-pretty text-body text-stone-600">
        The Guide explains every term in plain English and shows how to use StockPilot in 3 steps.
      </p>
      <button
        type="button"
        onClick={onOpen}
        className="mt-3 inline-flex h-10 touch-manipulation items-center rounded-xl bg-accent-600 px-3.5 text-body font-medium text-white shadow-e1 transition-[background-color,transform] duration-150 hover:bg-accent-700 active:scale-[0.98]"
      >
        Open the Guide
      </button>
    </div>
  );
}
