import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, ScreenRequestSchema } from "./screenRequest.js";

describe("ScreenRequestSchema", () => {
  it("treats an empty body as a request for the first page", () => {
    const result = ScreenRequestSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        filters: [],
        search: "",
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
      });
    }
  });

  it("accepts a fully specified request", () => {
    const body = {
      filters: [{ field: "pe", op: "lt", value: 30 }],
      search: "reliance",
      sort: { field: "marketCap", direction: "desc" },
      page: 2,
      pageSize: 10,
    };
    expect(ScreenRequestSchema.safeParse(body).success).toBe(true);
  });

  it("defaults the sort direction to ascending", () => {
    const result = ScreenRequestSchema.safeParse({ sort: { field: "pe" } });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.sort?.direction).toBe("asc");
  });

  it("rejects an unknown key so typos are not silently ignored", () => {
    expect(ScreenRequestSchema.safeParse({ pagesize: 10 }).success).toBe(false);
  });

  it("rejects a page below 1", () => {
    expect(ScreenRequestSchema.safeParse({ page: 0 }).success).toBe(false);
  });

  it("rejects a non-integer page", () => {
    expect(ScreenRequestSchema.safeParse({ page: 1.5 }).success).toBe(false);
  });

  it("rejects a page size above the maximum", () => {
    expect(ScreenRequestSchema.safeParse({ pageSize: MAX_PAGE_SIZE + 1 }).success).toBe(false);
  });

  it("rejects an unknown sort field", () => {
    expect(ScreenRequestSchema.safeParse({ sort: { field: "dividendYield" } }).success).toBe(false);
  });

  it("rejects an unknown sort direction", () => {
    const body = { sort: { field: "pe", direction: "sideways" } };
    expect(ScreenRequestSchema.safeParse(body).success).toBe(false);
  });

  it("rejects an invalid filter inside an otherwise valid request", () => {
    const body = { filters: [{ field: "pe", op: "eq", value: "cheap" }] };
    expect(ScreenRequestSchema.safeParse(body).success).toBe(false);
  });
});
