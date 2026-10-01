import { describe, expect, it } from "vitest";
import {
  displayTicker,
  formatAsOfDate,
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
