import type { FilterSpec } from "../api/client";
import presetsData from "../content/presets.json";
import { IconArrowRight } from "./Icons";

type Preset = { name: string; description: string; filters: FilterSpec };
const PRESETS = presetsData as Preset[];

type PresetBarProps = {
  onApply: (filters: FilterSpec) => void;
};

// One-click starting points (content/presets.json). Applying a preset
// replaces the whole FilterSpec, which then shows up as chips exactly like a
// manually built filter. Presets are just a shortcut into the same
// FilterSpec contract, not a separate code path.
export function PresetBar({ onApply }: PresetBarProps) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {PRESETS.map((preset) => (
        <li key={preset.name} className="flex">
          <button
            type="button"
            onClick={() => onApply(preset.filters)}
            className="group flex w-full touch-manipulation flex-col gap-1.5 rounded-xl border border-stone-200 bg-elevated p-4 text-left shadow-e1 transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:border-accent-300 hover:shadow-e2 active:translate-y-0 active:scale-[0.99]"
          >
            <span className="flex items-center justify-between gap-2 text-h3 text-stone-900">
              {preset.name}
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-600 transition-colors duration-150 group-hover:bg-accent-600 group-hover:text-white">
                <IconArrowRight size={14} />
              </span>
            </span>
            <span className="text-body text-stone-600">{preset.description}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
