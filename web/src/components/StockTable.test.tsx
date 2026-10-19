// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Stock } from "../api/client";
import { StockTable } from "./StockTable";

// Tells React that act() is in use, so it applies state updates right away instead of warning.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function makeStock(overrides: Partial<Stock>): Stock {
  return {
    ticker: "AAA.NS",
    name: "Alpha Limited",
    sector: "Energy",
    price: 100,
    marketCap: 1e12,
    pe: 15,
    debtToEquity: 0.5,
    profitMargin: 0.1,
    weeklyCloses: [],
    high52w: 120,
    low52w: 80,
    belowHigh52w: 16.7,
    aboveLow52w: 25,
    change3m: 2,
    change6m: -3,
    change1y: null,
    ...overrides,
  };
}

function render(items: Stock[]) {
  act(() => {
    root.render(
      <StockTable
        items={items}
        total={items.length}
        page={1}
        pageSize={25}
        onPageChange={vi.fn()}
        onSortChange={vi.fn()}
        selectedTickers={[]}
        onToggleCompare={vi.fn()}
        onViewDetail={vi.fn()}
        watchedTickers={[]}
        onToggleWatch={vi.fn()}
      />
    );
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("StockTable — why this matched", () => {
  it("shows a closed disclosure with every reason, on the row and on the mobile card", () => {
    render([makeStock({ reasons: ["P/E 15.0, below 20 (cheap)", 'Name or ticker matches "alpha"'] })]);
    const disclosures = container.querySelectorAll("details");
    expect(disclosures).toHaveLength(2); // desktop row + mobile card
    for (const details of disclosures) {
      expect(details.open).toBe(false);
      expect(details.textContent).toContain("P/E 15.0, below 20 (cheap)");
      expect(details.textContent).toContain('Name or ticker matches "alpha"');
    }
    expect(container.textContent).toContain("Why this stock matched");
  });

  it("shows no disclosure when nothing is filtered", () => {
    render([makeStock({ reasons: [] }), makeStock({ ticker: "BBB.NS" })]);
    expect(container.querySelectorAll("details")).toHaveLength(0);
  });
});

describe("StockTable — price history view", () => {
  it("switches the columns to the weekly-close metrics, labelled as such, and renders n/a for missing ones", () => {
    render([makeStock({})]);
    const button = [...container.querySelectorAll("button")].find((b) => b.textContent === "Price History")!;
    expect(button.getAttribute("aria-pressed")).toBe("false");
    act(() => button.click());

    expect(button.getAttribute("aria-pressed")).toBe("true");
    const headers = [...container.querySelectorAll("th")].map((th) => th.textContent);
    expect(headers.join("|")).toContain("Below 52W High");
    expect(headers.join("|")).toContain("1Y Change");
    expect(headers.join("|")).not.toContain("P/E");
    expect(container.textContent).toContain("Based on weekly closing prices");
    const row = container.querySelector("tbody tr")!.textContent!;
    expect(row).toContain("16.7%");
    expect(row).toContain("-3.0%");
    expect(row).toContain("n/a");
    expect(row).not.toContain("NaN");
  });
});
