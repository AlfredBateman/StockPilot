import { describe, expect, it } from "vitest";
// The raw text of the files whose numbers the glossary quotes, so a drifting threshold fails a test
// instead of silently teaching a beginner the wrong rule. `?raw` gives the file as a string (no import of server code).
import metricsSource from "../../../server/src/engine/metrics.ts?raw";
import vocabularySource from "../../../server/src/nl/vocabulary.ts?raw";
import presetsSource from "../content/presets.json?raw";
import snapshotSource from "../../../data/stocks.json?raw";
import { FILTER_FIELDS } from "../api/client";
import { formatMarketCapCrore, formatPrice } from "./format";
import {
  GLOSSARY,
  GLOSSARY_KEYS,
  GLOSSARY_KEY_FOR_FIELD,
  glossaryKeyForNote,
  searchGlossary,
  type GlossaryEntry,
} from "./glossary";

type SnapshotStock = {
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

function stock(ticker: string): SnapshotStock {
  const found = snapshot.stocks.find((s) => s.ticker === ticker);
  if (!found) throw new Error(`${ticker} is not in data/stocks.json`);
  return found;
}

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
      ["asOf", "change1m", "debtToEquity", "marketCap", "pe", "price", "profitMargin", "sector"].sort()
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

// The worked examples are real numbers from the 22 Sep 2026 snapshot. If data/stocks.json is ever
// refreshed, these fail on purpose: re-pick the examples from the new data and update the date in the text.
describe.skipIf(!snapshot.asOf.startsWith("2026-09-22"))("worked examples match data/stocks.json", () => {
  const fixed = (n: number | null, digits = 1) => (n === null ? "n/a" : n.toFixed(digits));
  const croreOf = (ticker: string) => formatMarketCapCrore(stock(ticker).marketCap).replace(/\s*Cr$/u, "");

  it("P/E", () => {
    expect(GLOSSARY.pe.example).toContain(formatPrice(stock("TCS.NS").price));
    expect(GLOSSARY.pe.example).toContain(`P/E of ${fixed(stock("TCS.NS").pe)}`);
    expect(GLOSSARY.pe.example).toContain(`P/E of ${fixed(stock("ADANIENT.NS").pe)}`);
  });

  it("Market Cap", () => {
    expect(croreOf("RELIANCE.NS")).toBe("16,90,206");
    expect(GLOSSARY.marketCap.example).toContain("₹16,90,206 crore");
    expect(croreOf("CIPLA.NS")).toBe("1,11,097");
    expect(GLOSSARY.marketCap.example).toContain("₹1,11,097 crore");
  });

  it("Debt/Equity", () => {
    expect(GLOSSARY.debtToEquity.example).toContain(`${fixed(stock("ADANIENT.NS").debtToEquity)}×`);
    expect(GLOSSARY.debtToEquity.example).toContain(`${fixed(stock("INFY.NS").debtToEquity)}×`);
    const missing = snapshot.stocks.filter((s) => s.debtToEquity === null);
    expect(missing).toHaveLength(10);
    expect(missing.every((s) => s.sector === "Financial Services")).toBe(true);
    expect(GLOSSARY.debtToEquity.goodToKnow.join(" ")).toContain("all 10 stocks with n/a are in Financial Services");
  });

  it("Profit Margin", () => {
    expect(GLOSSARY.profitMargin.example).toContain(`${fixed((stock("ITC.NS").profitMargin ?? 0) * 100)}%`);
    expect(GLOSSARY.profitMargin.example).toContain(`${fixed((stock("RELIANCE.NS").profitMargin ?? 0) * 100)}%`);
  });

  it("1-Month Change", () => {
    // Same rule as the server: drop null closes, then compare the latest with the close 4 closes earlier.
    function change(ticker: string) {
      const closes = stock(ticker).weeklyCloses.filter((w) => w.close !== null) as { date: string; close: number }[];
      const latest = closes[closes.length - 1];
      const base = closes[closes.length - 5];
      return { latest, base, percent: ((latest.close - base.close) / base.close) * 100 };
    }
    const tcs = change("TCS.NS");
    expect(tcs.base.date).toBe("2026-08-24");
    expect(tcs.latest.date).toBe("2026-09-22");
    expect(GLOSSARY.change1m.example).toContain(`${formatPrice(tcs.base.close)} on 24 Aug 2026`);
    expect(GLOSSARY.change1m.example).toContain(`${formatPrice(tcs.latest.close)} on 22 Sep 2026`);
    expect(GLOSSARY.change1m.example).toContain(`${tcs.percent.toFixed(1)}%`);
    const coal = change("COALINDIA.NS");
    expect(GLOSSARY.change1m.example).toContain(`${formatPrice(coal.base.close)} to ${formatPrice(coal.latest.close)}`);
    expect(GLOSSARY.change1m.example).toContain(`+${coal.percent.toFixed(1)}%`);
  });

  it("Sector", () => {
    expect(stock("TCS.NS").sector).toBe("Technology");
    expect(stock("INFY.NS").sector).toBe("Technology");
    expect(stock("ITC.NS").sector).toBe("Consumer Defensive");
    expect(GLOSSARY.sector.example).toContain(`(${fixed(stock("TCS.NS").pe)} and ${fixed(stock("INFY.NS").pe)})`);
  });

  it("Price and Data as of", () => {
    expect(GLOSSARY.price.example).toContain(formatPrice(stock("INFY.NS").price));
    expect(GLOSSARY.price.example).toContain(formatPrice(stock("TCS.NS").price));
    expect(GLOSSARY.price.example).toContain(`(${fixed(stock("INFY.NS").pe)} and ${fixed(stock("TCS.NS").pe)})`);
    expect(GLOSSARY.asOf.example).toContain(formatPrice(stock("ADANIENT.NS").price));
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
