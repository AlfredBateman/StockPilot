// Pure display-formatting helpers, kept free of React so they're trivial to
// unit test. A missing value always renders as "n/a" — never blank, NaN, or
// an em dash (see docs/DESIGN.md).

const NA = "n/a";

export function formatPrice(value: number | null): string {
  if (value === null) return NA;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

/** Market caps are large INR amounts; showing them in crore (1 crore = 1e7) is how Indian finance data is normally read. */
export function formatMarketCapCrore(value: number | null): string {
  if (value === null) return NA;
  const crore = Math.round(value / 1e7);
  return `${crore.toLocaleString("en-IN")} Cr`;
}

/** One decimal, with an optional unit suffix (e.g. "×" for debt/equity: 1.2×). A missing value is "n/a" without the suffix. */
export function formatRatio(value: number | null, suffix = ""): string {
  if (value === null) return NA;
  return `${value.toFixed(1)}${suffix}`;
}

/** Debt/equity is a true ratio (see server/src/data/debtToEquity.ts), shown as a multiple: "1.2×". */
export function formatDebtToEquity(value: number | null): string {
  return formatRatio(value, "×");
}

const DEBT_TO_EQUITY_FINANCIALS_NOTE = "Debt works differently for banks and financials, so the ratio isn't comparable.";

/** Hover text explaining why a stock has no D/E. Only financials get one; for anyone else a missing value is just missing data. */
export function debtToEquityNote(stock: { sector: string | null; debtToEquity: number | null }): string | undefined {
  return stock.debtToEquity === null && stock.sector === "Financial Services"
    ? DEBT_TO_EQUITY_FINANCIALS_NOTE
    : undefined;
}

/** profitMargin is stored as a fraction (0.15 = 15%); this is the one place that turns it back into a percent for display. */
export function formatPercent(value: number | null): string {
  if (value === null) return NA;
  return `${(value * 100).toFixed(1)}%`;
}

export function formatAsOfDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return NA;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Every ticker in the snapshot is NSE-listed ("RELIANCE.NS"), so the suffix is noise on screen. Display only: the data and API calls keep the full ticker. */
export function displayTicker(ticker: string): string {
  return ticker.endsWith(".NS") ? ticker.slice(0, -3) : ticker;
}

/** A percent change with an explicit sign ("+3.2%", "-1.5%"), for gain/loss chips. `value` is already a percent. */
export function formatSignedPercent(value: number | null): string {
  if (value === null) return NA;
  const rounded = value.toFixed(1);
  // Anything that rounds to zero shows as "0.0%", never "-0.0%" or "+0.0%".
  if (Number(rounded) === 0) return "0.0%";
  return `${value > 0 ? "+" : ""}${rounded}%`;
}
