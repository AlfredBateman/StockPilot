import type { Filter, FilterField } from "../engine/filterSpec.js";
import { VAGUE_TERMS } from "./vocabulary.js";

// Plain-language text for a filter that did not come from the rule parser
// (an LLM answer, or a filter in a zero-result suggestion). The field names
// below are the same ones the rule parser's notes use, so the web app's
// glossaryKeyForNote() links them to the right glossary entry.

const FIELD_NAMES: Record<FilterField, string> = {
  sector: "sector",
  marketCapBucket: "market cap",
  pe: "P/E",
  debtToEquity: "Debt/Equity",
  profitMargin: "profit margin",
  change1m: "1-month change",
};

/** profitMargin is stored as a fraction (0.1) but read as a percent (10%); change1m is already a percent. */
function formatValue(field: FilterField, value: string | number): string {
  if (typeof value === "string") return value;
  if (field === "profitMargin") return `${Number((value * 100).toFixed(2))}%`;
  if (field === "change1m") return `${value}%`;
  return String(value);
}

/** "P/E below 15", "Technology sector", "Large or Mid market cap". */
export function describeFilter(filter: Filter): string {
  const name = FIELD_NAMES[filter.field];
  const isText = filter.field === "sector" || filter.field === "marketCapBucket";

  switch (filter.op) {
    case "eq":
      return isText ? `${filter.value} ${name}` : `${name} equal to ${formatValue(filter.field, filter.value)}`;
    case "in": {
      const values = filter.value.map((v) => formatValue(filter.field, v)).join(" or ");
      return isText ? `${values} ${name}` : `${name} one of ${values}`;
    }
    case "lt":
      return `${name} below ${formatValue(filter.field, filter.value)}`;
    case "gt":
      return `${name} above ${formatValue(filter.field, filter.value)}`;
    case "between":
      return `${name} between ${formatValue(filter.field, filter.value[0])} and ${formatValue(filter.field, filter.value[1])}`;
  }
}

function sameFilter(a: Filter, b: Filter): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function vagueTerm(filter: Filter) {
  return VAGUE_TERMS.find((t) => sameFilter(t.filter, filter));
}

/** The vague word ("low debt") if this filter is exactly one, else describeFilter's text. */
export function filterShortLabel(filter: Filter): string {
  const term = vagueTerm(filter);
  return term ? term.note.split(" = ")[0] : describeFilter(filter);
}

/** A note line like the rule parser's: the vocabulary note when it matches, else describeFilter's text. */
export function filterNote(filter: Filter): string {
  return vagueTerm(filter)?.note ?? describeFilter(filter);
}
