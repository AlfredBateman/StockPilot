import { describe, expect, it } from "vitest";
import { makeCloses, makeStock } from "../engine/testStocks.js";
import { matchReasons, metricReadings } from "./explain.js";

/** 53 weekly closes: 52 at `base`, then the latest at `latest`. */
function closes(base: number, latest: number) {
  return makeCloses(...Array(52).fill(base), latest);
}

describe("matchReasons", () => {
  const stock = makeStock({ pe: 18.24, debtToEquity: 0.3, profitMargin: 0.123, sector: "Technology" });

  it("names the stock's value, the threshold and the vague word when the filter is one", () => {
    expect(matchReasons(stock, [{ field: "pe", op: "lt", value: 20 }])).toEqual(["P/E 18.2, below 20 (cheap)"]);
    expect(matchReasons(stock, [{ field: "debtToEquity", op: "lt", value: 0.5 }])).toEqual([
      "Debt/Equity 0.3×, below 0.5 (low debt)",
    ]);
  });

  it("leaves the word out when the threshold is not a vocabulary term", () => {
    expect(matchReasons(stock, [{ field: "pe", op: "lt", value: 25 }])).toEqual(["P/E 18.2, below 25"]);
    expect(matchReasons(stock, [{ field: "pe", op: "between", value: [10, 30] }])).toEqual(["P/E 18.2, between 10 and 30"]);
  });

  it("shows profit margin and changes as percents, with a sign on changes", () => {
    const riser = makeStock({ profitMargin: 0.123, weeklyCloses: closes(100, 110) });
    expect(
      matchReasons(riser, [
        { field: "profitMargin", op: "gt", value: 0.1 },
        { field: "change1y", op: "gt", value: 0 },
      ])
    ).toEqual(["Profit margin 12.3%, above 10%", "1-year change +10.0%, above 0% (rose over 1 year)"]);
  });

  it("describes text filters plainly", () => {
    expect(matchReasons(stock, [{ field: "sector", op: "eq", value: "Technology" }])).toEqual(["Sector Technology"]);
    expect(matchReasons(stock, [{ field: "sector", op: "in", value: ["Technology", "Energy"] }])).toEqual([
      "Sector Technology, one of Technology, Energy",
    ]);
  });

  it("adds the name search, and says n/a rather than NaN for a missing value", () => {
    const noPe = makeStock({ pe: null });
    expect(matchReasons(noPe, [{ field: "pe", op: "lt", value: 20 }], " tata ")).toEqual([
      "P/E n/a, below 20 (cheap)",
      'Name or ticker matches "tata"',
    ]);
  });
});

describe("metricReadings", () => {
  const readingFor = (overrides: Parameters<typeof makeStock>[0], prefix: string) =>
    metricReadings(makeStock(overrides)).find((line) => line.startsWith(prefix));

  it("reads P/E against the cheap and expensive cut-offs", () => {
    expect(readingFor({ pe: 44.2 }, "P/E")).toBe(
      "P/E 44.2: above 40, which StockPilot calls expensive. Investors pay ₹44 for every ₹1 of yearly profit."
    );
    expect(readingFor({ pe: 12 }, "P/E")).toContain("below 20, which StockPilot calls cheap");
    expect(readingFor({ pe: 20 }, "P/E")).toContain("between 20 and 40, so StockPilot calls it neither cheap nor expensive");
    expect(readingFor({ pe: null }, "P/E")).toBe("P/E n/a: the data has no P/E for this stock, so it never matches a P/E filter.");
  });

  it("reads Debt/Equity, and explains n/a for banks", () => {
    expect(readingFor({ debtToEquity: 1.2 }, "Debt/Equity")).toBe(
      "Debt/Equity 1.2×: above 1×, which StockPilot calls high debt. It owes about ₹1.20 for every ₹1 of its owners’ money."
    );
    expect(readingFor({ debtToEquity: 0.7 }, "Debt/Equity")).toContain("neither low debt nor high debt");
    expect(readingFor({ debtToEquity: null, sector: "Financial Services" }, "Debt/Equity")).toContain("usual for banks");
    expect(readingFor({ debtToEquity: null, sector: "Energy" }, "Debt/Equity")).toBe(
      "Debt/Equity n/a: the data has no Debt/Equity for this stock."
    );
  });

  it("reads profit margin and the market-cap group", () => {
    expect(readingFor({ profitMargin: 0.25 }, "Profit margin")).toContain("above 0%, which StockPilot calls profitable");
    expect(readingFor({ profitMargin: -0.05 }, "Profit margin")).toContain("does not call it profitable");
    expect(readingFor({ marketCap: 3_000_000_000_000 }, "Market cap")).toBe(
      "Market cap ₹3,00,000 crore: in StockPilot’s Large group (₹2,00,000 crore or more)."
    );
    expect(readingFor({ marketCap: null }, "Market cap")).toContain("n/a");
  });

  it("reads the 52-week position with the 5% near rule", () => {
    // 52-week window: one close at 500, the rest at 400, latest 410 -> 18% below the high, 2.5% above the low.
    const stock = makeStock({ weeklyCloses: makeCloses(500, ...Array(50).fill(400), 410) });
    expect(readingFor(stock, "Latest close")).toBe(
      "Latest close is 18.0% below its 52-week high and 2.5% above its 52-week low (weekly closing prices). That is within 5% of the low, which StockPilot calls near 52-week low."
    );
    expect(readingFor({ weeklyCloses: makeCloses(100, 101) }, "52-week range")).toContain("n/a");
  });

  it("reads the changes, with n/a when history is short", () => {
    const readings = metricReadings(makeStock({ weeklyCloses: closes(100, 90) }));
    expect(readings).toContain("1-year change -10.0%: below 0%, so it counts as “fell over 1 year”.");
    expect(readings).toContain("3-month change -10.0%.");
    expect(metricReadings(makeStock({ weeklyCloses: [] }))).toContain("1-year change n/a: not enough price history.");
  });

  it("never uses buy, sell or hold language, and never prints NaN", () => {
    const stocks = [
      makeStock(),
      makeStock({ pe: null, debtToEquity: null, profitMargin: null, marketCap: null, weeklyCloses: [] }),
      makeStock({ pe: 80, debtToEquity: 3, profitMargin: -0.2, weeklyCloses: closes(100, 50) }),
    ];
    for (const stock of stocks) {
      for (const line of metricReadings(stock)) {
        expect(line).not.toMatch(/\b(buy|sell|hold|invest|recommend)\b/i);
        expect(line).not.toContain("NaN");
      }
    }
  });
});
