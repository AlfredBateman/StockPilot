import { describe, expect, it } from "vitest";
import { FilterSchema, FilterSpecSchema } from "./filterSpec.js";

describe("FilterSchema (valid specs)", () => {
  it("accepts text equality on sector", () => {
    expect(FilterSchema.safeParse({ field: "sector", op: "eq", value: "Energy" }).success).toBe(true);
  });

  it("accepts a list of market cap buckets", () => {
    const filter = { field: "marketCapBucket", op: "in", value: ["Large", "Mid"] };
    expect(FilterSchema.safeParse(filter).success).toBe(true);
  });

  it("accepts numeric comparisons", () => {
    expect(FilterSchema.safeParse({ field: "pe", op: "lt", value: 30 }).success).toBe(true);
    expect(FilterSchema.safeParse({ field: "profitMargin", op: "gt", value: 0.1 }).success).toBe(true);
  });

  it("accepts a between range, including negative numbers", () => {
    expect(FilterSchema.safeParse({ field: "change1m", op: "between", value: [-5, 5] }).success).toBe(
      true
    );
  });
});

describe("FilterSchema (invalid specs)", () => {
  it("rejects text given to a numeric field", () => {
    expect(FilterSchema.safeParse({ field: "pe", op: "eq", value: "cheap" }).success).toBe(false);
  });

  it("rejects a numeric op on a text field", () => {
    expect(FilterSchema.safeParse({ field: "sector", op: "lt", value: 3 }).success).toBe(false);
  });

  it("rejects a number given to a text field", () => {
    expect(FilterSchema.safeParse({ field: "sector", op: "eq", value: 3 }).success).toBe(false);
  });

  it("rejects a market cap bucket that does not exist", () => {
    expect(FilterSchema.safeParse({ field: "marketCapBucket", op: "eq", value: "Huge" }).success).toBe(
      false
    );
  });

  it("rejects a reversed between range", () => {
    expect(FilterSchema.safeParse({ field: "pe", op: "between", value: [30, 10] }).success).toBe(false);
  });

  it("rejects an unknown field", () => {
    expect(FilterSchema.safeParse({ field: "dividendYield", op: "gt", value: 1 }).success).toBe(false);
  });

  it("rejects an unknown op", () => {
    expect(FilterSchema.safeParse({ field: "pe", op: "approximately", value: 1 }).success).toBe(false);
  });

  it("rejects an empty in list", () => {
    expect(FilterSchema.safeParse({ field: "sector", op: "in", value: [] }).success).toBe(false);
  });

  it("rejects an unknown key, so typos are caught", () => {
    const filter = { field: "pe", op: "lt", value: 30, inclusive: true };
    expect(FilterSchema.safeParse(filter).success).toBe(false);
  });

  it("explains what went wrong", () => {
    const result = FilterSchema.safeParse({ field: "pe", op: "eq", value: "cheap" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("holds a number");
    }
  });
});

describe("FilterSpecSchema", () => {
  it("accepts an empty list, meaning no filtering", () => {
    expect(FilterSpecSchema.safeParse([]).success).toBe(true);
  });

  it("accepts several filters at once", () => {
    const spec = [
      { field: "sector", op: "eq", value: "Energy" },
      { field: "pe", op: "lt", value: 30 },
    ];
    expect(FilterSpecSchema.safeParse(spec).success).toBe(true);
  });

  it("rejects the whole list if any one filter is invalid", () => {
    const spec = [
      { field: "sector", op: "eq", value: "Energy" },
      { field: "pe", op: "eq", value: "cheap" },
    ];
    expect(FilterSpecSchema.safeParse(spec).success).toBe(false);
  });
});
