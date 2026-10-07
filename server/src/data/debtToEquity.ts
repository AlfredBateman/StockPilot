// Yahoo's financialData.debtToEquity is a PERCENTAGE: 119.56 means total debt
// is 1.1956x shareholders' equity (checked for ADANIENT.NS against total debt
// and total equity from Yahoo's balance sheet). Everything in StockPilot uses
// a true ratio, so this conversion happens once, where data enters
// (scripts/snapshot.ts), and nowhere else.

/** Converts Yahoo's percentage D/E (119.56) to a ratio (1.1956). Passes null through. */
export function debtToEquityRatio(yahooPercent: number | null | undefined): number | null {
  if (yahooPercent === null || yahooPercent === undefined) return null;
  // toFixed strips float noise (119.56 / 100 = 1.1956000000000002) without losing real precision.
  return Number((yahooPercent / 100).toFixed(6));
}
