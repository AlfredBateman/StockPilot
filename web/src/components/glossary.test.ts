import { describe, expect, it } from "vitest";
// The raw text of the files whose numbers the glossary quotes, so a drifting threshold fails a test
// instead of silently teaching a beginner the wrong rule. `?raw` gives the file as a string (no import of server code).
import metricsSource from "../../../server/src/engine/metrics.ts?raw";
import vocabularySource from "../../../server/src/nl/vocabulary.ts?raw";
import presetsSource from "../content/presets.json?raw";
import snapshotSource from "../../../data/stocks.json?raw";
import { FILTER_FIELDS } from "../api/client";
import { formatMarketCapCrore } from "./format";
import {
  GLOSSARY,
  GLOSSARY_KEYS,
  GLOSSARY_KEY_FOR_FIELD,
  glossaryKeyForNote,
  searchGlossary,
  type GlossaryEntry,
} from "./glossary";

type SnapshotStock = {
  name: string;
  ticker: string;
  sector: string | null;
  price: number | null;
  marketCap: number | null;
  pe: number | null;
  debtToEquity: number | null;
  profitMargin: number | null;
  weeklyCloses: { date: string; close: number | null }[];
};
const snapshot = JSON.parse(snapshotSource) as { asOf: string; stocks: SnapshotStock[] };

function allText(entry: GlossaryEntry): string[] {
  return [
    entry.term,
    entry.definition,
    entry.whyItMatters,
    entry.example,
    entry.howStockPilotUsesIt,
    ...entry.goodToKnow,
    entry.source?.label ?? "",
  ];
}

describe("glossary content", () => {
  it("covers every term the Guide promises", () => {
    expect(GLOSSARY_KEYS.sort()).toEqual(
      ["asOf", "change1m", "debtToEquity", "longChange", "marketCap", "pe", "price", "profitMargin", "range52w", "sector"].sort()
    );
  });

  it("gives every entry a definition, why it matters, an example and the StockPilot rule", () => {
    for (const key of GLOSSARY_KEYS) {
      const entry = GLOSSARY[key];
      for (const field of [entry.term, entry.definition, entry.whyItMatters, entry.example, entry.howStockPilotUsesIt]) {
        expect(field.trim().length, `${key} has an empty section`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the definition to one sentence", () => {
    for (const key of GLOSSARY_KEYS) {
      // A sentence-ending full stop followed by a capital would mean two sentences.
      expect(GLOSSARY[key].definition, key).not.toMatch(/[.!?]\s+[A-Z]/);
    }
  });

  it("never uses an em dash or en dash in visible text", () => {
    for (const key of GLOSSARY_KEYS) {
      for (const text of allText(GLOSSARY[key])) expect(text, key).not.toMatch(/[–—]/);
    }
  });

  it("uses only https source links, and null where no page was verified", () => {
    for (const key of GLOSSARY_KEYS) {
      const { source } = GLOSSARY[key];
      if (source === null) continue;
      expect(source.url, key).toMatch(/^https:\/\/en\.wikipedia\.org\/wiki\/[^\s]+$/);
      expect(source.label.length, key).toBeGreaterThan(0);
    }
    expect(GLOSSARY.asOf.source).toBeNull();
  });

  it("explains the × notation and why banks show n/a", () => {
    const text = allText(GLOSSARY.debtToEquity).join(" ");
    expect(text).toContain("1.2×");
    expect(text).toContain("₹1.20 for every ₹1");
    expect(text).toContain("0.5×");
    expect(text).toContain("₹0.50 for every ₹1");
    expect(text).toMatch(/banks/i);
    expect(text).toContain("n/a");
  });
});

describe("thresholds quoted in the glossary match the code", () => {
  it("market cap Large / Mid cut-offs match server/src/engine/metrics.ts", () => {
    const large = Number(/MARKET_CAP_LARGE_MIN_INR = ([\d_]+)/.exec(metricsSource)?.[1].replaceAll("_", ""));
    const mid = Number(/MARKET_CAP_MID_MIN_INR = ([\d_]+)/.exec(metricsSource)?.[1].replaceAll("_", ""));
    // formatMarketCapCrore gives "2,00,000 Cr"; the glossary writes "₹2,00,000 crore".
    const asCrore = (inr: number) => formatMarketCapCrore(inr).replace(/\s*Cr$/u, "");
    const text = GLOSSARY.marketCap.howStockPilotUsesIt;
    expect(text).toContain(`Large is ₹${asCrore(large)} crore or more`);
    expect(text).toContain(`Mid is ₹${asCrore(mid)} crore up to ₹${asCrore(large)} crore`);
    expect(text).toContain(`Small is below ₹${asCrore(mid)} crore`);
  });

  it("the 4-week window matches the engine", () => {
    expect(metricsSource).toContain("CHANGE_1M_LOOKBACK_WEEKS = 4");
    expect(GLOSSARY.change1m.definition).toContain("four weeks");
  });

  it("cheap, expensive, low debt and high debt match the rule parser's vocabulary", () => {
    expect(vocabularySource).toContain("cheap = P/E below 20");
    expect(GLOSSARY.pe.howStockPilotUsesIt).toContain("below 20 as cheap");
    expect(vocabularySource).toContain("expensive = P/E above 40");
    expect(GLOSSARY.pe.howStockPilotUsesIt).toContain("above 40 as expensive");
    expect(vocabularySource).toContain("debt/equity ratio below 0.5");
    expect(GLOSSARY.debtToEquity.howStockPilotUsesIt).toContain("below 0.5× as low debt");
    expect(vocabularySource).toContain("debt/equity ratio above 1 ");
    expect(GLOSSARY.debtToEquity.howStockPilotUsesIt).toContain("above 1× as high debt");
    expect(vocabularySource).toContain("profitable = profit margin above 0%");
    expect(GLOSSARY.profitMargin.howStockPilotUsesIt).toContain("above 0% as profitable");
  });

  it("the 52-week window, the 3/6/12-month lookbacks and the near-high/low rule match the engine and vocabulary", () => {
    expect(metricsSource).toContain("RANGE_52W_CLOSES = 52");
    expect(GLOSSARY.range52w.howStockPilotUsesIt).toContain("last 52 weekly closing prices");
    expect(metricsSource).toContain("CHANGE_3M_WEEKS = 13");
    expect(metricsSource).toContain("CHANGE_6M_WEEKS = 26");
    expect(metricsSource).toContain("CHANGE_1Y_WEEKS = 52");
    expect(GLOSSARY.longChange.definition).toContain("13, 26 and 52 weeks");
    expect(vocabularySource).toContain("near 52-week low = within 5% of the 52-week low");
    expect(vocabularySource).toContain("near 52-week high = within 5% of the 52-week high");
    expect(GLOSSARY.range52w.howStockPilotUsesIt).toContain("within 5% of the 52-week low");
    expect(GLOSSARY.range52w.howStockPilotUsesIt).toContain("within 5% of the 52-week high");
    expect(vocabularySource).toContain("rose over 6 months = 6-month change above 0%");
    expect(vocabularySource).toContain("fell over 6 months = 6-month change below 0%");
    expect(GLOSSARY.longChange.howStockPilotUsesIt).toContain("6-month change above 0%");
  });

  it("both price-history entries say they are based on weekly closing prices", () => {
    for (const key of ["range52w", "longChange"] as const) {
      expect(allText(GLOSSARY[key]).join(" "), key).toContain("weekly closing prices");
    }
  });

  it("the preset thresholds quoted in the glossary match presets.json", () => {
    const presets = JSON.parse(presetsSource) as { name: string; filters: { field: string; value: number }[] }[];
    const valueOf = (name: string, field: string) =>
      presets.find((p) => p.name === name)?.filters.find((f) => f.field === field)?.value;
    expect(valueOf("Low Debt, Steady Profit", "debtToEquity")).toBe(0.5);
    expect(valueOf("Low Debt, Steady Profit", "profitMargin")).toBe(0.1);
    expect(valueOf("High Margin Business", "profitMargin")).toBe(0.2);
    expect(valueOf("Recent Gainers", "change1m")).toBe(5);
    expect(GLOSSARY.profitMargin.howStockPilotUsesIt).toContain("“High Margin Business” preset uses above 20%");
    expect(GLOSSARY.profitMargin.howStockPilotUsesIt).toContain("“Low Debt, Steady Profit” uses above 10%");
    expect(GLOSSARY.change1m.howStockPilotUsesIt).toContain("“Recent Gainers” preset uses above 5%");
  });
});

// The worked examples use made-up round numbers, never a real stock's figures, so they stay true
// whatever data is loaded. These tests always run: they check the arithmetic written in each example,
// and that no example (or note) names a real company, ticker or date.
describe("worked examples are correct whatever data is loaded", () => {
  const ratio = (top: number, bottom: number, digits = 1) => (top / bottom).toFixed(digits);

  it("P/E", () => {
    expect(GLOSSARY.pe.example).toContain(`100 ÷ 5 = ${ratio(100, 5, 0)}`);
    expect(GLOSSARY.pe.example).toContain(`P/E of ${ratio(100, 2, 0)}`);
  });

  it("Market Cap", () => {
    const large = Number(/MARKET_CAP_LARGE_MIN_INR = ([\d_]+)/.exec(metricsSource)?.[1].replaceAll("_", ""));
    const mid = Number(/MARKET_CAP_MID_MIN_INR = ([\d_]+)/.exec(metricsSource)?.[1].replaceAll("_", ""));
    const crore = 10_000_000;
    const groupOf = (capCrore: number) => (capCrore * crore >= large ? "Large" : capCrore * crore >= mid ? "Mid" : "Small");
    const small = 100 * 500;
    const big = 100 * 3000;
    expect(GLOSSARY.marketCap.example).toContain(`100 crore × ₹500 = ₹${small.toLocaleString("en-IN")} crore, which puts it in the ${groupOf(small)} group`);
    expect(GLOSSARY.marketCap.example).toContain(`₹${big.toLocaleString("en-IN")} crore, which is in the ${groupOf(big)} group`);
  });

  it("Debt/Equity", () => {
    expect(GLOSSARY.debtToEquity.example).toContain(`120 ÷ 100 = ${ratio(120, 100)}×`);
    expect(GLOSSARY.debtToEquity.example).toContain(`about ₹${ratio(120, 100, 2)} for every ₹1`);
    expect(GLOSSARY.debtToEquity.example).toContain(`shows ${ratio(10, 100)}×`);
    expect(GLOSSARY.debtToEquity.example).toContain(`about ₹${ratio(10, 100, 2)} for every ₹1`);
  });

  it("Profit Margin", () => {
    expect(GLOSSARY.profitMargin.example).toContain(`profit margin is ${(25 / 100) * 100}%`);
    expect(GLOSSARY.profitMargin.example).toContain(`a margin of ${(6 / 100) * 100}%`);
  });

  it("1-Month Change", () => {
    const percent = (from: number, to: number) => ((to - from) / from) * 100;
    expect(GLOSSARY.change1m.example).toContain(`(210 − 200) ÷ 200 = +${percent(200, 210).toFixed(1)}%`);
    expect(GLOSSARY.change1m.example).toContain(`the change would be ${percent(200, 180).toFixed(1)}%`);
  });

  it("52-Week High and Low", () => {
    const below = ((500 - 410) / 500) * 100;
    const above = ((410 - 400) / 400) * 100;
    expect(GLOSSARY.range52w.example).toContain(`(500 − 410) ÷ 500 = ${below.toFixed(1)}% below`);
    expect(GLOSSARY.range52w.example).toContain(`(410 − 400) ÷ 400 = ${above.toFixed(1)}% above`);
    // 2.5% is within the 5% "near" rule, which is what the example says.
    expect(above).toBeLessThan(5);
    expect(GLOSSARY.range52w.example).toContain("near its 52-week low");
  });

  it("3, 6 and 12-Month Change", () => {
    const percent = (from: number, to: number) => (((to - from) / from) * 100).toFixed(1);
    expect(GLOSSARY.longChange.example).toContain(`(330 − 250) ÷ 250 = +${percent(250, 330)}%`);
    expect(GLOSSARY.longChange.example).toContain(`(330 − 300) ÷ 300 = +${percent(300, 330)}%`);
    expect(GLOSSARY.longChange.example).toContain(`(330 − 320) ÷ 320 = +${percent(320, 330)}%`);
  });

  it("Price", () => {
    expect(GLOSSARY.price.example).toContain(`its P/E is ${ratio(1000, 100, 0)}`);
    expect(GLOSSARY.price.example).toContain(`its P/E is ${ratio(100, 2, 0)}`);
  });

  it("Sector and Data as of", () => {
    // Sector labels are the data's own categories; both must be real ones in the loaded data.
    const sectors = new Set(snapshot.stocks.map((s) => s.sector));
    for (const label of ["Technology", "Consumer Defensive"]) {
      expect(GLOSSARY.sector.example).toContain(label);
      expect(sectors.has(label), `${label} is not a sector in data/stocks.json`).toBe(true);
    }
    expect(GLOSSARY.asOf.example).toContain("Data as of");
  });

  it("no entry names a real company or ticker, or quotes a date, so none can go stale", () => {
    const datePattern = /\b\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* 20\d\d\b/;
    const tickers = new Set(snapshot.stocks.map((s) => s.ticker.replace(/\.NS$/, "")));
    for (const key of GLOSSARY_KEYS) {
      const text = allText(GLOSSARY[key]).join(" ");
      expect(text, `${key} quotes a date`).not.toMatch(datePattern);
      const words = new Set(text.split(/[^A-Za-z&-]+/));
      for (const s of snapshot.stocks) {
        const shortName = s.name.replace(/ (Limited|Ltd\.?|Corporation|Corp\.?)$/i, "");
        expect(text, `${key} names ${s.name}`).not.toContain(shortName);
      }
      for (const ticker of tickers) expect(words.has(ticker), `${key} uses the ticker ${ticker}`).toBe(false);
    }
  });
});

describe("GLOSSARY_KEY_FOR_FIELD", () => {
  it("has an entry for every FilterSpec field, and each points at a real glossary entry", () => {
    for (const field of FILTER_FIELDS) {
      expect(GLOSSARY[GLOSSARY_KEY_FOR_FIELD[field]], field).toBeDefined();
    }
  });
});

describe("glossaryKeyForNote", () => {
  it.each([
    ["cheap = P/E below 20", "pe"],
    ["expensive = P/E above 40", "pe"],
    ["profitable = profit margin above 0%", "profitMargin"],
    ["low debt = debt/equity ratio below 0.5 (debt under half of equity)", "debtToEquity"],
    ["high debt = debt/equity ratio above 1 (debt greater than equity)", "debtToEquity"],
    ["small cap = Small market-cap bucket", "marketCap"],
    ["midcap = Mid market-cap bucket", "marketCap"],
    ["large cap = Large market-cap bucket", "marketCap"],
    ["rose this month = 1-month change above 0%", "change1m"],
    ["fell this month = 1-month change below 0%", "change1m"],
    ['"tech" = Technology sector', "sector"],
    ['"Real Estate" = Real Estate sector', "sector"],
    ['"p/e under 15" = P/E below 15', "pe"],
    ['"margin above 10" = profit margin above 10%', "profitMargin"],
    ['"debt to equity under 2" = Debt/Equity below 2', "debtToEquity"],
    ['"1 month change over 5" = 1-month change above 5', "change1m"],
    ["near 52-week low = within 5% of the 52-week low (weekly closes)", "range52w"],
    ["near 52-week high = within 5% of the 52-week high (weekly closes)", "range52w"],
    ["drop from 52-week high below 10%", "range52w"],
    ["rose over 6 months = 6-month change above 0%", "longChange"],
    ["fell over 1 year = 1-year change below 0%", "longChange"],
    ['"3 month change over 5" = 3-month change above 5', "longChange"],
  ])("%s -> %s", (note, key) => {
    expect(glossaryKeyForNote(note)).toBe(key);
  });

  it("returns null for a note that names no known term, so no wrong link is shown", () => {
    expect(glossaryKeyForNote("something else entirely")).toBeNull();
    expect(glossaryKeyForNote("")).toBeNull();
  });
});

describe("searchGlossary", () => {
  it("returns every term for an empty or blank search", () => {
    expect(searchGlossary("")).toEqual(GLOSSARY_KEYS);
    expect(searchGlossary("   ")).toEqual(GLOSSARY_KEYS);
  });

  it("finds a term by its name, case-insensitively", () => {
    expect(searchGlossary("p/e")).toContain("pe");
    expect(searchGlossary("MARKET CAP")).toEqual(["marketCap"]);
  });

  it("finds a term by words in its explanation", () => {
    expect(searchGlossary("banks")).toContain("debtToEquity");
    expect(searchGlossary("crore")).toContain("marketCap");
  });

  it("needs every typed word to match, in any order", () => {
    expect(searchGlossary("debt banks")).toEqual(["debtToEquity"]);
    expect(searchGlossary("banks debt")).toEqual(["debtToEquity"]);
  });

  it("returns nothing for a word no entry contains", () => {
    expect(searchGlossary("zzzzqq")).toEqual([]);
  });
});
