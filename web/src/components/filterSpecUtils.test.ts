import { describe, expect, it } from "vitest";
import type { Filter, FilterSpec } from "../api/client";
import { buildRangeFilter, describeFilter, describeFilterParts, getFilter, togglePreset, withFilter } from "./filterSpecUtils";

describe("getFilter", () => {
  const filters: FilterSpec = [
    { field: "sector", op: "in", value: ["Energy"] },
    { field: "pe", op: "lt", value: 30 },
  ];

  it("finds the filter for a field", () => {
    expect(getFilter(filters, "pe")).toEqual({ field: "pe", op: "lt", value: 30 });
  });

  it("returns undefined when the field has no filter", () => {
    expect(getFilter(filters, "debtToEquity")).toBeUndefined();
  });
});

describe("withFilter", () => {
  const base: FilterSpec = [{ field: "sector", op: "in", value: ["Energy"] }];

  it("adds a filter for a field that has none yet", () => {
    const next = withFilter(base, "pe", { field: "pe", op: "lt", value: 30 });
    expect(next).toEqual([
      { field: "sector", op: "in", value: ["Energy"] },
      { field: "pe", op: "lt", value: 30 },
    ]);
  });

  it("replaces the existing filter for that field", () => {
    const next = withFilter(base, "sector", { field: "sector", op: "in", value: ["Technology"] });
    expect(next).toEqual([{ field: "sector", op: "in", value: ["Technology"] }]);
  });

  it("removes the field's filter when given null", () => {
    expect(withFilter(base, "sector", null)).toEqual([]);
  });

  it("does not modify the array it was given", () => {
    withFilter(base, "pe", { field: "pe", op: "lt", value: 30 });
    expect(base).toHaveLength(1);
  });
});

describe("buildRangeFilter", () => {
  it("builds a between filter when both bounds are given", () => {
    expect(buildRangeFilter("pe", 10, 30)).toEqual({ field: "pe", op: "between", value: [10, 30] });
  });

  it("builds a gt filter when only the min is given", () => {
    expect(buildRangeFilter("profitMargin", 0.1, null)).toEqual({
      field: "profitMargin",
      op: "gt",
      value: 0.1,
    });
  });

  it("builds a lt filter when only the max is given", () => {
    expect(buildRangeFilter("debtToEquity", null, 50)).toEqual({
      field: "debtToEquity",
      op: "lt",
      value: 50,
    });
  });

  it("returns null when neither bound is given", () => {
    expect(buildRangeFilter("pe", null, null)).toBeNull();
  });
});

describe("describeFilter", () => {
  it("describes an in filter", () => {
    const filter: Filter = { field: "sector", op: "in", value: ["Energy", "Technology"] };
    expect(describeFilter(filter)).toBe("Sector: Energy, Technology");
  });

  it("describes a lt filter", () => {
    expect(describeFilter({ field: "pe", op: "lt", value: 30 })).toBe("P/E < 30");
  });

  it("describes a gt filter", () => {
    expect(describeFilter({ field: "debtToEquity", op: "gt", value: 20 })).toBe("Debt/Equity > 20");
  });

  it("describes a between filter", () => {
    expect(describeFilter({ field: "pe", op: "between", value: [10, 30] })).toBe("P/E: 10-30");
  });

  it("converts profitMargin fractions to whole percents", () => {
    expect(describeFilter({ field: "profitMargin", op: "gt", value: 0.15 })).toBe(
      "Profit Margin > 15%"
    );
  });

  it("describes an eq filter", () => {
    expect(describeFilter({ field: "marketCapBucket", op: "eq", value: "Large" })).toBe(
      "Market Cap: Large"
    );
  });
});

describe("describeFilterParts", () => {
  it("splits an in filter into field and joined values", () => {
    const filter = { field: "sector" as const, op: "in" as const, value: ["Energy", "Technology"] };
    expect(describeFilterParts(filter)).toEqual({ label: "Sector", value: "Energy, Technology" });
  });

  it("keeps the comparison sign with the value", () => {
    expect(describeFilterParts({ field: "pe", op: "lt", value: 30 })).toEqual({ label: "P/E", value: "< 30" });
    expect(describeFilterParts({ field: "debtToEquity", op: "gt", value: 20 })).toEqual({
      label: "Debt/Equity",
      value: "> 20",
    });
  });

  it("describes a between filter as a range", () => {
    expect(describeFilterParts({ field: "pe", op: "between", value: [10, 30] })).toEqual({
      label: "P/E",
      value: "10-30",
    });
  });

  it("converts profitMargin fractions to whole percents", () => {
    expect(describeFilterParts({ field: "profitMargin", op: "gt", value: 0.15 })).toEqual({
      label: "Profit Margin",
      value: "> 15%",
    });
  });

  it("describes an eq filter", () => {
    expect(describeFilterParts({ field: "marketCapBucket", op: "eq", value: "Large" })).toEqual({
      label: "Market Cap",
      value: "Large",
    });
  });

  it("always matches describeFilter's wording once the two parts are joined back", () => {
    const filters = [
      { field: "pe" as const, op: "lt" as const, value: 30 },
      { field: "profitMargin" as const, op: "gt" as const, value: 0.15 },
    ];
    for (const filter of filters) {
      const { label, value } = describeFilterParts(filter);
      expect(describeFilter(filter)).toBe(`${label} ${value}`);
    }
  });
});

describe("togglePreset", () => {
  const mine: FilterSpec = [{ field: "sector", op: "in", value: ["Energy"] }];
  const presetA: FilterSpec = [{ field: "pe", op: "lt", value: 15 }];
  const presetB: FilterSpec = [{ field: "debtToEquity", op: "lt", value: 0.5 }];

  it("replaces the current filters with the preset, it does not stack on them", () => {
    const next = togglePreset(null, mine, "A", presetA);
    expect(next.filters).toEqual(presetA);
    expect(next.active).toEqual({ name: "A", previous: mine });
  });

  it("clicking the active preset again restores the previous filters", () => {
    const on = togglePreset(null, mine, "A", presetA);
    const off = togglePreset(on.active, on.filters, "A", presetA);
    expect(off.filters).toEqual(mine);
    expect(off.active).toBeNull();
  });

  it("restores an empty list when nothing was filtered before", () => {
    const on = togglePreset(null, [], "A", presetA);
    expect(togglePreset(on.active, on.filters, "A", presetA).filters).toEqual([]);
  });

  it("switching presets keeps the original previous filters, not the first preset", () => {
    const a = togglePreset(null, mine, "A", presetA);
    const b = togglePreset(a.active, a.filters, "B", presetB);
    expect(b.filters).toEqual(presetB);
    expect(togglePreset(b.active, b.filters, "B", presetB).filters).toEqual(mine);
  });
});
