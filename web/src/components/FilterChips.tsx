import { useLayoutEffect, useRef } from "react";
import type { FilterSpec } from "../api/client";
import { describeFilter, describeFilterParts } from "./filterSpecUtils";
import { GLOSSARY_KEY_FOR_FIELD } from "./glossary";
import { GlossaryLink } from "./GlossaryLink";
import { IconClose } from "./Icons";
import { animateChipIn, animateChipOut } from "./motion";

type FilterChipsProps = {
  filters: FilterSpec;
  onRemove: (index: number) => void;
  onClearAll: () => void;
};

// Renders the current FilterSpec as removable chips. Each chip removes
// exactly the filter it describes, by index into the same array Screener
// holds as state, so there is never a second copy of "what's filtered" to
// keep in sync. Animation (c): chips scale/fade in when added and out when
// removed (components/motion.ts); nothing else here is stateful.
export function FilterChips({ filters, onRemove, onClearAll }: FilterChipsProps) {
  const listRef = useRef<HTMLUListElement>(null);
  // Fields that already had a chip last render, so only newly added chips animate in
  // (a chip whose index shifts after a removal is not "new").
  const seenFields = useRef<Set<string>>(new Set());
  // True while a chip's exit animation (120ms) is playing, so a second click can't
  // remove by an index that is about to shift.
  const removing = useRef(false);

  useLayoutEffect(() => {
    const chips = listRef.current?.querySelectorAll<HTMLElement>("[data-field]") ?? [];
    for (const chip of chips) {
      if (!seenFields.current.has(chip.dataset.field ?? "")) animateChipIn(chip);
    }
    seenFields.current = new Set(filters.map((filter) => filter.field));
  }, [filters]);

  function handleRemove(index: number, chip: HTMLElement | null) {
    if (removing.current) return;
    if (!chip) {
      onRemove(index);
      return;
    }
    removing.current = true;
    // ponytail: removal is by index and waits 120ms for the exit animation; a filter change from elsewhere in
    // that window could shift the index. Not by field: QueryBox.onApply can create two filters on one field.
    // If it ever shows up, capture filters[index] at click time and remove that exact filter when the animation ends.
    animateChipOut(chip, () => {
      removing.current = false;
      onRemove(index);
    });
  }

  if (filters.length === 0) return null;

  return (
    <div className="flex flex-col gap-2.5 border-t border-stone-200 pt-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-label text-stone-600">Active filters ({filters.length})</p>
        <button
          type="button"
          onClick={onClearAll}
          className="touch-manipulation rounded-lg px-2 py-1 text-label font-semibold text-accent-700 underline-offset-2 transition-colors duration-150 hover:bg-accent-100 hover:underline"
        >
          Clear all filters
        </button>
      </div>
      <ul ref={listRef} className="flex flex-wrap gap-2">
        {filters.map((filter, index) => {
          const { label, value } = describeFilterParts(filter);
          return (
            <li key={`${filter.field}-${index}`} data-field={filter.field} className="flex max-w-full flex-col items-start gap-0.5">
              <span className="inline-flex h-9 max-w-full items-center gap-2 rounded-full border border-stone-300 bg-elevated pl-3.5 pr-1 shadow-e1">
                <span className="shrink-0 text-label text-stone-500">{label}</span>
                <span title={value} className="min-w-0 truncate text-body font-semibold tabular-nums text-stone-900">
                  {value}
                </span>
                <button
                  type="button"
                  onClick={(e) => handleRemove(index, e.currentTarget.closest("li"))}
                  aria-label={`Remove filter: ${describeFilter(filter)}`}
                  className="flex size-7 touch-manipulation items-center justify-center rounded-full bg-stone-100 text-stone-600 transition-colors duration-150 hover:bg-error-soft hover:text-error"
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
