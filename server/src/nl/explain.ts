import type { Stock } from "../data/stockSchema.js";
import { stockFieldValue } from "../engine/fields.js";
import type { Filter, FilterField } from "../engine/filterSpec.js";
import { MARKET_CAP_LARGE_MIN_INR, MARKET_CAP_MID_MIN_INR, marketCapBucket, priceHistory } from "../engine/metrics.js";
import { PERCENT_FIELDS, formatValue, vagueTerm } from "./filterLabel.js";
import { VAGUE_TERMS } from "./vocabulary.js";

// Plain-English explanations built from fixed templates, never an LLM:
//   - matchReasons: why a stock passed each active filter ("P/E 18.2, below 20 (cheap)").
//   - metricReadings: what each of a stock's numbers means by StockPilot's own
//     cut-offs ("P/E 44.2: above 40, which StockPilot calls expensive. ...").
// Every cut-off is read from vocabulary.ts or metrics.ts, never typed again
// here, so an explanation can't disagree with what a filter actually does.
// Wording is neutral on purpose: these describe numbers, they never say what to do.

const NA = "n/a";

const LABELS: Record<FilterField, string> = {
  sector: "Sector",
  marketCapBucket: "Market cap group",
  pe: "P/E",
  debtToEquity: "Debt/Equity",
  profitMargin: "Profit margin",
  change1m: "1-month change",
  belowHigh52w: "Below 52-week high",
  aboveLow52w: "Above 52-week low",
  change3m: "3-month change",
  change6m: "6-month change",
  change1y: "1-year change",
};

/** Fields shown with a sign, because the number is a change up or down. */
const SIGNED_FIELDS: ReadonlySet<FilterField> = new Set(["change1m", "change3m", "change6m", "change1y"]);

function signedPercent(value: number): string {
  const rounded = value.toFixed(1);
  if (Number(rounded) === 0) return "0.0%";
  return `${value > 0 ? "+" : ""}${rounded}%`;
}

/** A stock's own value for a field, formatted the way the UI shows it. */
function formatStockValue(field: FilterField, value: string | number | null): string {
  if (value === null) return NA;
  if (typeof value === "string") return value;
  if (field === "profitMargin") return `${(value * 100).toFixed(1)}%`;
  if (field === "debtToEquity") return `${value.toFixed(2)}×`;
  if (SIGNED_FIELDS.has(field)) return signedPercent(value);
  if (PERCENT_FIELDS.has(field)) return `${value.toFixed(1)}%`;
  return value.toFixed(1);
}

/** "below 20", "above 0%", "between 10 and 20", "one of Large, Mid". */
function condition(filter: Filter): string | null {
  const fmt = (v: string | number) => formatValue(filter.field, v);
  switch (filter.op) {
    case "lt":
      return `below ${fmt(filter.value)}`;
    case "gt":
      return `above ${fmt(filter.value)}`;
    case "between":
      return `between ${fmt(filter.value[0])} and ${fmt(filter.value[1])}`;
    case "in":
      return filter.value.length > 1 ? `one of ${filter.value.map(fmt).join(", ")}` : null;
    case "eq":
      return typeof filter.value === "number" ? `equal to ${fmt(filter.value)}` : null;
  }
}

/** One line per active filter, plus the name search, saying how this stock meets it. */
export function matchReasons(stock: Stock, filters: Filter[], search = ""): string[] {
  const lines = filters.map((filter) => {
    const value = formatStockValue(filter.field, stockFieldValue(stock, filter.field));
    const rule = condition(filter);
    const term = vagueTerm(filter)?.note.split(" = ")[0];
    return `${LABELS[filter.field]} ${value}${rule ? `, ${rule}` : ""}${term ? ` (${term})` : ""}`;
  });
  if (search.trim()) lines.push(`Name or ticker matches "${search.trim()}"`);
  return lines;
}

/** The vocabulary's cut-off and word for a field and direction, e.g. pe + lt -> 20, "cheap". */
function cutOff(field: FilterField, op: "lt" | "gt"): { limit: number; word: string } {
  const term = VAGUE_TERMS.find((t) => t.filter.field === field && t.filter.op === op);
  if (!term || typeof term.filter.value !== "number") throw new Error(`No vocabulary term for ${field} ${op}`);
  return { limit: term.filter.value, word: term.note.split(" = ")[0] };
}

function crore(inr: number): string {
  return `₹${Math.round(inr / 1e7).toLocaleString("en-IN")} crore`;
}

function peReading(pe: number | null): string {
  if (pe === null) return "P/E n/a: the data has no P/E for this stock, so it never matches a P/E filter.";
  const cheap = cutOff("pe", "lt");
  const expensive = cutOff("pe", "gt");
  const band =
    pe < cheap.limit
      ? `below ${cheap.limit}, which StockPilot calls ${cheap.word}`
      : pe > expensive.limit
        ? `above ${expensive.limit}, which StockPilot calls ${expensive.word}`
        : `between ${cheap.limit} and ${expensive.limit}, so StockPilot calls it neither ${cheap.word} nor ${expensive.word}`;
  const perRupee = pe > 0 ? ` Investors pay ₹${Math.round(pe)} for every ₹1 of yearly profit.` : "";
  return `P/E ${pe.toFixed(1)}: ${band}.${perRupee}`;
}

function debtReading(stock: Stock): string {
  const de = stock.debtToEquity;
  if (de === null) {
    return stock.sector === "Financial Services"
      ? "Debt/Equity n/a: not reported, which is usual for banks and other financial companies, because borrowing and lending is their everyday business."
      : "Debt/Equity n/a: the data has no Debt/Equity for this stock.";
  }
  const low = cutOff("debtToEquity", "lt");
  const high = cutOff("debtToEquity", "gt");
  const band =
    de < low.limit
      ? `below ${low.limit}×, which StockPilot calls ${low.word}`
      : de > high.limit
        ? `above ${high.limit}×, which StockPilot calls ${high.word}`
        : `between ${low.limit}× and ${high.limit}×, so StockPilot calls it neither ${low.word} nor ${high.word}`;
  return `Debt/Equity ${de.toFixed(2)}×: ${band}. It owes about ₹${de.toFixed(2)} for every ₹1 of its owners’ money.`;
}

function marginReading(margin: number | null): string {
  if (margin === null) return "Profit margin n/a: the data has no profit margin for this stock.";
  const profitable = cutOff("profitMargin", "gt");
  const percent = (margin * 100).toFixed(1);
  if (margin > profitable.limit) {
    return `Profit margin ${percent}%: above ${profitable.limit * 100}%, which StockPilot calls ${profitable.word}. It keeps about ₹${Math.round(margin * 100)} of every ₹100 of sales as profit.`;
  }
  return `Profit margin ${percent}%: not above ${profitable.limit * 100}%, so StockPilot does not call it ${profitable.word}.`;
}

function marketCapReading(cap: number | null): string {
  const bucket = marketCapBucket(cap);
  if (cap === null || bucket === null) return "Market cap n/a: the data has no market cap for this stock.";
  const range =
    bucket === "Large"
      ? `${crore(MARKET_CAP_LARGE_MIN_INR)} or more`
      : bucket === "Mid"
        ? `${crore(MARKET_CAP_MID_MIN_INR)} up to ${crore(MARKET_CAP_LARGE_MIN_INR)}`
        : `below ${crore(MARKET_CAP_MID_MIN_INR)}`;
  return `Market cap ${crore(cap)}: in StockPilot’s ${bucket} group (${range}).`;
}

/** A change with a "rose/fell" vocabulary word, or a plain one when no word exists (3 months). */
function changeReading(label: string, value: number | null, field?: FilterField): string {
  if (value === null) return `${label} n/a: not enough price history.`;
  const shown = signedPercent(value);
  if (!field || shown === "0.0%") return `${label} ${shown}.`;
  const { limit, word } = value > 0 ? cutOff(field, "gt") : cutOff(field, "lt");
  return `${label} ${shown}: ${value > 0 ? "above" : "below"} ${limit}%, so it counts as “${word}”.`;
}

function rangeReading(stock: Stock): string {
  const { belowHigh52w, aboveLow52w } = priceHistory(stock.weeklyCloses);
  if (belowHigh52w === null || aboveLow52w === null) {
    return "52-week range n/a: there are fewer than 52 weeks of closing prices for this stock.";
  }
  const nearLow = cutOff("aboveLow52w", "lt");
  const nearHigh = cutOff("belowHigh52w", "lt");
  const where = `Latest close is ${belowHigh52w.toFixed(1)}% below its 52-week high and ${aboveLow52w.toFixed(1)}% above its 52-week low (weekly closing prices).`;
  const near = [
    belowHigh52w < nearHigh.limit ? `within ${nearHigh.limit}% of the high, which StockPilot calls ${nearHigh.word}` : null,
    aboveLow52w < nearLow.limit ? `within ${nearLow.limit}% of the low, which StockPilot calls ${nearLow.word}` : null,
  ].filter(Boolean);
  return near.length > 0
    ? `${where} That is ${near.join(", and ")}.`
    : `${where} That is not within ${nearHigh.limit}% of either, so it is neither near its 52-week high nor its low.`;
}

/** One short, neutral reading of each of a stock's numbers, n/a included. */
export function metricReadings(stock: Stock): string[] {
  const history = priceHistory(stock.weeklyCloses);
  return [
    peReading(stock.pe),
    debtReading(stock),
    marginReading(stock.profitMargin),
    marketCapReading(stock.marketCap),
    changeReading("1-month change", stockFieldValue(stock, "change1m") as number | null, "change1m"),
    rangeReading(stock),
    changeReading("3-month change", history.change3m),
    changeReading("6-month change", history.change6m, "change6m"),
    changeReading("1-year change", history.change1y, "change1y"),
  ];
}
