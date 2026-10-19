import { describe, expect, it } from "vitest";
import { makeStock } from "../engine/testStocks.js";
import { findCompanies } from "./companyNames.js";
import { parseOffline } from "./parseOrchestrator.js";
import { parseQuery } from "./ruleParser.js";

const stocks = [
  makeStock({ ticker: "INFY.NS", name: "Infosys Limited", sector: "Technology" }),
  makeStock({ ticker: "WIPRO.NS", name: "Wipro Limited", sector: "Technology" }),
  makeStock({ ticker: "TCS.NS", name: "Tata Consultancy Services Limited", sector: "Technology" }),
  makeStock({ ticker: "TATASTEEL.NS", name: "Tata Steel Limited", sector: "Basic Materials" }),
  makeStock({ ticker: "TMCV.NS", name: "Tata Motors Limited", sector: "Consumer Cyclical" }),
  makeStock({ ticker: "EICHERMOT.NS", name: "Eicher Motors Limited", sector: "Consumer Cyclical" }),
  makeStock({ ticker: "HDFCBANK.NS", name: "HDFC Bank Limited", sector: "Financial Services" }),
  makeStock({ ticker: "SHREECEM.NS", name: "Shree Cement Limited", sector: "Basic Materials" }),
  makeStock({ ticker: "COALINDIA.NS", name: "Coal India Limited", sector: "Energy" }),
];

/** The same steps the app runs: rule parser first, then names in its leftover words. */
function find(query: string) {
  return findCompanies(stocks, query, parseQuery(query).unmatched);
}

describe("findCompanies — names and tickers", () => {
  it("turns a company name into a name search, with a note", () => {
    expect(find("tata stocks")).toEqual({
      search: "tata",
      filters: [],
      notes: ["Showing companies whose name contains Tata"],
      unmatched: [],
    });
  });

  it("fixes a small spelling mistake in a name", () => {
    expect(find("infosis").search).toBe("infosys");
    expect(find("infosis").notes).toEqual(["Showing companies whose name contains Infosys"]);
  });

  it("finds a ticker, and says it matched the ticker rather than the name", () => {
    expect(find("infy").search).toBe("infy");
    expect(find("infy").notes).toEqual(["Showing companies whose name or ticker contains INFY"]);
  });

  it("keeps two words that name the same company together", () => {
    expect(find("tata motors").search).toBe("tata motors");
  });

  it("joins two different companies as alternatives", () => {
    const result = find("infosys and wipro");
    expect(result.search).toBe("infosys, wipro");
    expect(result.notes).toEqual(["Showing companies whose name contains Infosys or Wipro"]);
  });

  it("ignores generic name words like limited, india or shares", () => {
    expect(find("india limited").search).toBeNull();
    // "shares" is two letters from "Shree" but must never become it.
    expect(find("cheap shares")).toMatchObject({ search: null, unmatched: ["shares"] });
  });

  it("does not search a name on state or united alone, but does inside a fuller name", () => {
    const withStateBank = [...stocks, makeStock({ ticker: "SBIN.NS", name: "State Bank of India", sector: "Financial Services" })];
    const findIn = (query: string) => findCompanies(withStateBank, query, parseQuery(query).unmatched);
    expect(findIn("state")).toMatchObject({ search: null, unmatched: ["state"] });
    expect(findIn("united stocks").search).toBeNull();
    expect(findIn("state bank of india").search).toBe("state");
  });

  it("never turns a sector word, or india/indian, into a name search", () => {
    for (const query of ["bank stocks", "banking stocks", "finance companies", "pharma", "best bank stocks", "india", "indian companies", "large cap stocks in India"]) {
      expect(parseOffline(query, stocks).rules.search, query).toBeNull();
    }
  });

  it("leaves words that are not names alone, for the LLM to read", () => {
    expect(find("best growth stocks")).toMatchObject({ search: null, filters: [], unmatched: ["best", "growth"] });
    expect(find("is infosys a buy")).toMatchObject({ search: "infosys", unmatched: ["buy"] });
  });

  it("does nothing without stock data", () => {
    expect(findCompanies([], "tata stocks", ["tata"])).toEqual({ search: null, filters: [], notes: [], unmatched: ["tata"] });
  });
});

describe("findCompanies — companies like X", () => {
  it("shows X's sector and claims nothing more than that", () => {
    expect(find("companies like infosys")).toEqual({
      search: null,
      filters: [{ field: "sector", op: "eq", value: "Technology" }],
      notes: ["Showing Technology stocks, the same sector as Infosys"],
      unmatched: [],
    });
  });

  it("understands 'similar to' and a ticker", () => {
    expect(find("stocks similar to tcs").filters).toEqual([{ field: "sector", op: "eq", value: "Technology" }]);
    expect(find("stocks similar to tcs").notes).toEqual(["Showing Technology stocks, the same sector as Tata Consultancy Services"]);
  });

  it("leaves 'like' alone when no company follows it", () => {
    expect(find("stocks i like")).toMatchObject({ search: null, filters: [], unmatched: ["i", "like"] });
  });
});
