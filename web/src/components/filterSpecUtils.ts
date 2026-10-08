// Pure helpers over a FilterSpec, kept free of React. FilterPanel and
// FilterChips both read and write the single FilterSpec array through these
// instead of keeping their own shadow state, so removing a chip and editing
// a control can never disagree about what's currently filtered.
import type { Filter, FilterField, FilterSpec } from "../api/client";

/** The current filter for a field, if any. Each field has at most one filter. */
export function getFilter(filters: FilterSpec, field: FilterField): Filter | undefined {
  return filters.find((filter) => filter.field === field);
}

/** Returns a new FilterSpec with `field`'s filter replaced, added, or removed (pass null to remove). */
export function withFilter(filters: FilterSpec, field: FilterField, next: Filter | null): FilterSpec {
  const rest = filters.filter((filter) => filter.field !== field);
  return next ? [...rest, next] : rest;
}

/**
 * Builds a bounded numeric filter from up to two optional inputs: both
 * bounds -> "between" (inclusive), one bound -> "gt"/"lt" (strict, since the
 * engine has no gte/lte op), neither -> no filter at all.
 */
export function buildRangeFilter(field: FilterField, min: number | null, max: number | null): Filter | null {
  if (min !== null && max !== null) return { field, op: "between", value: [min, max] };
  if (min !== null) return { field, op: "gt", value: min };
  if (max !== null) return { field, op: "lt", value: max };
  return null;
}

const FIELD_LABELS: Record<FilterField, string> = {
  sector: "Sector",
  marketCapBucket: "Market Cap",
  pe: "P/E",
  debtToEquity: "Debt/Equity",
  profitMargin: "Profit Margin",
  change1m: "1-Month Change",
};

/**
 * The description of one filter split in two so FilterChips can show the field
 * name muted and the value bold: { label: "P/E", value: "< 30" }.
 */
export function describeFilterParts(filter: Filter): { label: string; value: string } {
  const label = FIELD_LABELS[filter.field];
  const isPercent = filter.field === "profitMargin";
  const fmt = (n: number) => (isPercent ? `${(n * 100).toFixed(0)}%` : String(n));

  switch (filter.op) {
    case "eq":
      return { label, value: String(filter.value) };
    case "in":
      return { label, value: filter.value.join(", ") };
    case "lt":
      return { label, value: `< ${fmt(filter.value)}` };
    case "gt":
      return { label, value: `> ${fmt(filter.value)}` };
    case "between":
      return { label, value: `${fmt(filter.value[0])}-${fmt(filter.value[1])}` };
  }
}

/** A short, human-readable label for one filter, for a FilterChips pill. */
export function describeFilter(filter: Filter): string {
  const { label, value } = describeFilterParts(filter);
  return filter.op === "lt" || filter.op === "gt" ? `${label} ${value}` : `${label}: ${value}`;
}

/** The preset currently applied, plus the filters the user had before it, so clicking it again can put them back. */
export type ActivePreset = { name: string; previous: FilterSpec } | null;

/**
 * Clicking a preset card. A preset replaces the whole filter set; clicking the active one again restores what was
 * there before it. Switching straight from one preset to another keeps the original "before", not the first preset.
 */
export function togglePreset(
  active: ActivePreset,
  filters: FilterSpec,
  name: string,
  presetFilters: FilterSpec
): { filters: FilterSpec; active: ActivePreset } {
  if (active?.name === name) return { filters: active.previous, active: null };
  return { filters: presetFilters, active: { name, previous: active?.previous ?? filters } };
}
