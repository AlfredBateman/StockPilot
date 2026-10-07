import { describe, expect, it } from "vitest";
import {
  displayTicker,
  debtToEquityNote,
  formatAsOfDate,
  formatDebtToEquity,
  formatMarketCapCrore,
  formatPercent,
  formatPrice,
  formatRatio,
  formatSignedPercent,
} from "./format";

describe("formatPrice", () => {
  it("formats a number as INR currency", () => {
    expect(formatPrice(1246.9)).toBe("₹1,246.90");
  });

  it("renders null as n/a", () => {
    expect(formatPrice(null)).toBe("n/a");
  });
});

describe("formatMarketCapCrore", () => {
  it("converts rupees to crore and adds Indian digit grouping", () => {
    expect(formatMarketCapCrore(16_902_058_409_984)).toBe("16,90,206 Cr");
  });

  it("renders null as n/a", () => {
    expect(formatMarketCapCrore(null)).toBe("n/a");
  });
});

describe("formatRatio", () => {
  it("rounds to one decimal", () => {
    expect(formatRatio(22.630913)).toBe("22.6");
  });

  it("renders null as n/a", () => {
    expect(formatRatio(null)).toBe("n/a");
  });
});

describe("formatRatio with a suffix", () => {
  it("appends the suffix to a number but not to n/a", () => {
    expect(formatRatio(1.1956, "×")).toBe("1.2×");
    expect(formatRatio(null, "×")).toBe("n/a");
  });
});

describe("formatDebtToEquity", () => {
  it("shows a ratio as a multiple", () => {
    expect(formatDebtToEquity(1.1956)).toBe("1.2×");
    expect(formatDebtToEquity(0.32)).toBe("0.3×");
  });

  it("renders null as n/a", () => {
    expect(formatDebtToEquity(null)).toBe("n/a");
  });
});

describe("debtToEquityNote", () => {
  it("explains a missing D/E for financials", () => {
    expect(debtToEquityNote({ sector: "Financial Services", debtToEquity: null })).toMatch(/banks and financials/);
  });

  it("has no note when a financial does report D/E, or a non-financial is missing it", () => {
    expect(debtToEquityNote({ sector: "Financial Services", debtToEquity: 2 })).toBeUndefined();
    expect(debtToEquityNote({ sector: "Energy", debtToEquity: null })).toBeUndefined();
  });
});

describe("formatPercent", () => {
  it("converts a fraction to a percent string", () => {
    expect(formatPercent(0.066149995)).toBe("6.6%");
  });

  it("renders null as n/a", () => {
    expect(formatPercent(null)).toBe("n/a");
  });
});

describe("formatAsOfDate", () => {
  it("formats an ISO timestamp as a readable date", () => {
    expect(formatAsOfDate("2026-09-22T04:48:46.527Z")).toBe("22 Sept 2026");
  });

  it("renders an invalid date as n/a", () => {
    expect(formatAsOfDate("not-a-date")).toBe("n/a");
  });
});

describe("displayTicker", () => {
  it("hides the .NS exchange suffix", () => {
    expect(displayTicker("RELIANCE.NS")).toBe("RELIANCE");
  });

  it("leaves a ticker without the suffix unchanged", () => {
    expect(displayTicker("M&M")).toBe("M&M");
  });
});

describe("formatSignedPercent", () => {
  it("adds a + to gains and keeps the - on losses", () => {
    expect(formatSignedPercent(3.24)).toBe("+3.2%");
    expect(formatSignedPercent(-1.55)).toBe("-1.6%");
  });

  it("shows zero without a sign", () => {
    expect(formatSignedPercent(0)).toBe("0.0%");
    expect(formatSignedPercent(-0.04)).toBe("0.0%");
  });

  it("renders null as n/a", () => {
    expect(formatSignedPercent(null)).toBe("n/a");
  });
});
