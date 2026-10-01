import { useId } from "react";
import { IconSearch } from "./Icons";

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
};

export function SearchBar({ value, onChange }: SearchBarProps) {
  const inputId = useId();

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-label text-stone-600">
        Search by name or ticker
      </label>
      <div className="relative">
        <IconSearch size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" />
        <input
          id={inputId}
          type="search"
          name="stock-search"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. Infosys or TCS…"
          className="h-11 w-full rounded-xl border border-stone-400 bg-elevated pl-11 pr-3.5 text-body text-stone-900 shadow-e1 transition-colors duration-150 placeholder:text-stone-500 hover:border-stone-500 focus:border-accent-500"
        />
      </div>
    </div>
  );
}
