import type { FilterSpec } from "../api/client";
import { describeFilter, describeFilterParts } from "./filterSpecUtils";
import { GLOSSARY_KEY_FOR_FIELD } from "./glossary";
import { GlossaryLink } from "./GlossaryLink";
import { IconClose } from "./Icons";

type FilterChipsProps = {
  filters: FilterSpec;
  onRemove: (index: number) => void;
  onClearAll: () => void;
};

// Renders the current FilterSpec as removable chips. Each chip removes
// exactly the filter it describes, by index into the same array Screener
// holds as state, so there is never a second copy of "what's filtered" to
// keep in sync. A new chip fades and scales in with CSS (`starting:`); a removed chip just goes.
// Nothing else here is stateful.
export function FilterChips({ filters, onRemove, onClearAll }: FilterChipsProps) {
  // Keys are field + operator + the nth such filter, not the index: removing a chip does not remount
  // (and so does not re-animate) the others, and editing a value in FilterPanel keeps its chip.
  const counts = new Map<string, number>();
  const keys = filters.map((filter) => {
    const base = `${filter.field}-${filter.op}`;
    const n = counts.get(base) ?? 0;
    counts.set(base, n + 1);
    return `${base}-${n}`;
  });

  if (filters.length === 0) return null;

  return (
    <div className="flex flex-col gap-2.5 border-t border-stone-200 pt-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-label text-stone-600">Active filters ({filters.length})</p>
        <button
          type="button"
          onClick={onClearAll}
          className="touch-manipulation rounded-lg px-2 py-1 text-label font-semibold text-accent-700 underline-offset-2 transition-colors duration-(--motion-fast) hover:bg-accent-100 hover:underline"
        >
          Clear all filters
        </button>
      </div>
      <ul className="flex flex-wrap gap-2">
        {filters.map((filter, index) => {
          const { label, value } = describeFilterParts(filter);
          return (
            <li
              key={keys[index]}
              className="flex max-w-full flex-col items-start gap-0.5 transition-[opacity,scale] duration-(--motion-fast) ease-out-soft starting:scale-[0.92] starting:opacity-0"
            >
              <span className="inline-flex h-9 max-w-full items-center gap-2 rounded-full border border-stone-300 bg-elevated pl-3.5 pr-1 shadow-e1">
                <span className="shrink-0 text-label text-stone-500">{label}</span>
                <span title={value} className="min-w-0 truncate text-body font-semibold tabular-nums text-stone-900">
                  {value}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  aria-label={`Remove filter: ${describeFilter(filter)}`}
                  className="flex size-7 touch-manipulation items-center justify-center rounded-full bg-stone-100 text-stone-600 transition-colors duration-(--motion-fast) hover:bg-error-soft hover:text-error"
                >
                  <IconClose size={14} />
                </button>
              </span>
              <span className="pl-3.5">
                <GlossaryLink metric={GLOSSARY_KEY_FOR_FIELD[filter.field]} />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
