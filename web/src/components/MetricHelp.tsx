import { useId, useState } from "react";
import glossary from "../content/glossary.json";

export type GlossaryKey = keyof typeof glossary;

type MetricHelpProps = {
  metric: GlossaryKey;
};

/**
 * A small "?" button next to a column header or filter label. Click reveals
 * the metric's plain-language definition (content/glossary.json), click
 * again (or blur) hides it. Click rather than CSS hover, since touch devices
 * have no hover. No animation library, just conditional render.
 */
export function MetricHelp({ metric }: MetricHelpProps) {
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const entry = glossary[metric];

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        aria-expanded={open}
        aria-describedby={open ? popoverId : undefined}
        aria-label={`What is ${entry.term}?`}
        // currentColor, so the "?" matches whatever it sits in: stone labels, or white text on the dark
        // table header. The ::before pad grows the tap target to 28px without moving the layout.
        className="relative ml-1 inline-flex size-4 touch-manipulation items-center justify-center rounded-full border border-current text-[10px] font-semibold leading-none opacity-75 transition-opacity duration-150 before:absolute before:-inset-1.5 before:content-[''] hover:opacity-100"
      >
        ?
      </button>
      {open && (
        <span
          id={popoverId}
          role="tooltip"
          // Opens to the right by default; a parent can flip it with [&_[role=tooltip]]:right-0 (StockTable's right-aligned headers do).
          className="absolute left-0 top-full z-20 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-stone-200 bg-elevated p-3.5 text-left text-caption font-normal normal-case tracking-normal text-stone-700 shadow-e2"
        >
          <span className="block text-h3 text-stone-900">{entry.term}</span>
          <span className="mt-1 block leading-relaxed text-stone-600">{entry.definition}</span>
          <span className="mt-2 block border-t border-stone-200 pt-2 leading-relaxed">{entry.whatItMeans}</span>
        </span>
      )}
    </span>
  );
}
