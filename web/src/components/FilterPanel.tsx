import { MARKET_CAP_BUCKETS, type Filter, type FilterSpec, type MarketCapBucket } from "../api/client";
import { buildRangeFilter, getFilter, withFilter } from "./filterSpecUtils";
import { IconCheck } from "./Icons";
import { MetricHelp } from "./MetricHelp";

type FilterPanelProps = {
  filters: FilterSpec;
  onChange: (filters: FilterSpec) => void;
  sectors: string[];
};

/** Reads the [min, max] a numeric filter currently represents, for display in the two range inputs. */
function rangeBounds(filter: Filter | undefined): { min: number | null; max: number | null } {
  if (!filter) return { min: null, max: null };
  if (filter.op === "between") return { min: filter.value[0], max: filter.value[1] };
  if (filter.op === "gt") return { min: filter.value, max: null };
  if (filter.op === "lt") return { min: null, max: filter.value };
  return { min: null, max: null };
}

/** Parses a number input's raw string; an empty box means "no bound". */
function parseBound(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

/** 44px custom number input (docs/DESIGN.md section 15). The browser's spinner arrows are hidden in index.css. */
const NUMBER_INPUT_CLASS =
  "h-11 w-full min-w-0 rounded-xl border border-stone-400 bg-elevated px-3.5 text-body tabular-nums text-stone-900 shadow-e1 transition-colors duration-150 placeholder:text-stone-500 hover:border-stone-500 focus:border-accent-500";

/**
 * A choice chip (docs/DESIGN.md section 14): a real checkbox, visually hidden
 * but still keyboard- and screen-reader-operable, with the label styled as a
 * toggle. Off = outlined, on = filled accent with a check icon, so "on" is
 * shown by shape as well as color.
 */
function ChoiceChip({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <label className="relative cursor-pointer touch-manipulation">
      <input type="checkbox" checked={checked} onChange={onToggle} className="peer sr-only" />
      <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-stone-300 bg-elevated px-3.5 text-body text-stone-700 shadow-e1 transition-[background-color,border-color,color,transform] duration-150 hover:border-stone-400 hover:text-stone-900 active:scale-[0.97] peer-checked:border-accent-600 peer-checked:bg-accent-600 peer-checked:font-medium peer-checked:text-white peer-checked:hover:bg-accent-700 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-600">
        {checked && <IconCheck size={14} className="-ml-0.5 shrink-0" />}
        {label}
      </span>
    </label>
  );
}

export function FilterPanel({ filters, onChange, sectors }: FilterPanelProps) {
  const selectedSectors = (getFilter(filters, "sector")?.value as string[] | undefined) ?? [];
  const selectedBuckets =
    (getFilter(filters, "marketCapBucket")?.value as MarketCapBucket[] | undefined) ?? [];

  const pe = rangeBounds(getFilter(filters, "pe"));
  const maxDebtToEquity = rangeBounds(getFilter(filters, "debtToEquity")).max;
  const minProfitMargin = rangeBounds(getFilter(filters, "profitMargin")).min;

  function toggleInList<T extends string>(field: "sector" | "marketCapBucket", current: T[], item: T) {
    const next = current.includes(item) ? current.filter((v) => v !== item) : [...current, item];
    onChange(withFilter(filters, field, next.length > 0 ? { field, op: "in", value: next } : null));
  }

  function setPeRange(min: number | null, max: number | null) {
    onChange(withFilter(filters, "pe", buildRangeFilter("pe", min, max)));
  }

  function setMaxDebtToEquity(max: number | null) {
    onChange(withFilter(filters, "debtToEquity", buildRangeFilter("debtToEquity", null, max)));
  }

  function setMinProfitMarginPercent(percent: number | null) {
    const fraction = percent === null ? null : percent / 100;
    onChange(withFilter(filters, "profitMargin", buildRangeFilter("profitMargin", fraction, null)));
  }

  return (
    <div className="grid gap-x-6 gap-y-6 sm:grid-cols-2 xl:grid-cols-[auto_1fr_1fr_1fr]">
      <fieldset className="flex flex-col sm:col-span-full">
        <legend className="mb-2.5 text-label text-stone-600">Sector</legend>
        <div className="flex flex-wrap gap-2">
          {sectors.map((sector) => (
            <ChoiceChip
              key={sector}
              label={sector}
              checked={selectedSectors.includes(sector)}
              onToggle={() => toggleInList("sector", selectedSectors, sector)}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col">
        <legend className="mb-2.5 flex items-center text-label text-stone-600">
          Market Cap
          <MetricHelp metric="marketCap" />
        </legend>
        <div className="flex gap-2">
          {MARKET_CAP_BUCKETS.map((bucket) => (
            <ChoiceChip
              key={bucket}
              label={bucket}
              checked={selectedBuckets.includes(bucket)}
              onToggle={() => toggleInList("marketCapBucket", selectedBuckets, bucket)}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col">
        <legend className="mb-2 flex items-center text-label text-stone-600">
          P/E Range
          <MetricHelp metric="pe" />
        </legend>
        <div className="flex items-center gap-2">
          <input
            type="number"
            name="pe-min"
            autoComplete="off"
            inputMode="decimal"
            placeholder="Min"
            aria-label="Minimum P/E"
            value={pe.min ?? ""}
            onChange={(e) => setPeRange(parseBound(e.target.value), pe.max)}
            className={NUMBER_INPUT_CLASS}
          />
          <span
            aria-hidden="true"
            className="flex h-6 shrink-0 items-center rounded-full bg-stone-100 px-2 text-label text-stone-600"
          >
            to
          </span>
          <input
            type="number"
            name="pe-max"
            autoComplete="off"
            inputMode="decimal"
            placeholder="Max"
            aria-label="Maximum P/E"
            value={pe.max ?? ""}
            onChange={(e) => setPeRange(pe.min, parseBound(e.target.value))}
            className={NUMBER_INPUT_CLASS}
          />
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <span className="flex items-center text-label text-stone-600">
          <label htmlFor="max-debt-to-equity">Max Debt/Equity</label>
          <MetricHelp metric="debtToEquity" />
        </span>
        <input
          id="max-debt-to-equity"
          type="number"
          name="max-debt-to-equity"
          autoComplete="off"
          inputMode="decimal"
          placeholder="No limit"
          value={maxDebtToEquity ?? ""}
          onChange={(e) => setMaxDebtToEquity(parseBound(e.target.value))}
          className={NUMBER_INPUT_CLASS}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="flex items-center text-label text-stone-600">
          <label htmlFor="min-profit-margin">Min Profit Margin</label>
          <MetricHelp metric="profitMargin" />
        </span>
        {/* The "%" unit sits inside the input on the right, so the label no longer needs "(%)". */}
        <div className="relative">
          <input
            id="min-profit-margin"
            type="number"
            name="min-profit-margin"
            autoComplete="off"
            inputMode="decimal"
            placeholder="No minimum"
            aria-describedby="min-profit-margin-unit"
            value={minProfitMargin === null ? "" : minProfitMargin * 100}
            onChange={(e) => setMinProfitMarginPercent(parseBound(e.target.value))}
            className={`${NUMBER_INPUT_CLASS} pr-9`}
          />
          <span
            id="min-profit-margin-unit"
            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-body font-medium text-stone-500"
          >
            <span aria-hidden="true">%</span>
            <span className="sr-only">percent</span>
          </span>
        </div>
      </div>
    </div>
  );
}
