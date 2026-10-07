import { describe, expect, it } from "vitest";
import { describeFilter, filterNote, filterShortLabel } from "./filterLabel.js";

describe("describeFilter", () => {
  it("names numeric filters with the same field labels the rule parser's notes use", () => {
    expect(describeFilter({ field: "pe", op: "lt", value: 15 })).toBe("P/E below 15");
    expect(describeFilter({ field: "debtToEquity", op: "gt", value: 2 })).toBe("Debt/Equity above 2");
    expect(describeFilter({ field: "change1m", op: "between", value: [-5, 5] })).toBe(
      "1-month change between -5% and 5%"
    );
  });

  it("shows profit margin as a percent, since it is stored as a fraction", () => {
    expect(describeFilter({ field: "profitMargin", op: "gt", value: 0.15 })).toBe("profit margin above 15%");
  });

  it("names text filters by their value", () => {
    expect(describeFilter({ field: "sector", op: "eq", value: "Energy" })).toBe("Energy sector");
    expect(describeFilter({ field: "marketCapBucket", op: "in", value: ["Large", "Mid"] })).toBe(
      "Large or Mid market cap"
    );
  });
});

describe("filterShortLabel and filterNote", () => {
  it("use the vocabulary word when a filter is exactly a vague term", () => {
    const lowDebt = { field: "debtToEquity", op: "lt", value: 0.5 } as const;
    expect(filterShortLabel(lowDebt)).toBe("low debt");
    expect(filterNote(lowDebt)).toBe("low debt = debt/equity ratio below 0.5 (debt under half of equity)");
  });

  it("fall back to describeFilter otherwise", () => {
    const filter = { field: "pe", op: "lt", value: 12 } as const;
    expect(filterShortLabel(filter)).toBe("P/E below 12");
    expect(filterNote(filter)).toBe("P/E below 12");
  });
});
