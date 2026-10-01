import { describe, expect, it } from "vitest";
import { paginate } from "./paginate.js";

const items = ["a", "b", "c", "d", "e"];

describe("paginate", () => {
  it("returns the first page", () => {
    expect(paginate(items, 1, 2)).toEqual({ items: ["a", "b"], total: 5 });
  });

  it("returns a middle page", () => {
    expect(paginate(items, 2, 2)).toEqual({ items: ["c", "d"], total: 5 });
  });

  it("returns a short final page", () => {
    expect(paginate(items, 3, 2)).toEqual({ items: ["e"], total: 5 });
  });

  it("reports the total before slicing, not the page size", () => {
    expect(paginate(items, 1, 2).total).toBe(5);
  });

  it("returns an empty page past the end, with the total intact", () => {
    expect(paginate(items, 99, 2)).toEqual({ items: [], total: 5 });
  });

  it("returns everything when the page is bigger than the list", () => {
    expect(paginate(items, 1, 100)).toEqual({ items, total: 5 });
  });

  it("handles an empty list", () => {
    expect(paginate([], 1, 25)).toEqual({ items: [], total: 0 });
  });

  it("treats a page below 1 as the first page rather than slicing from the end", () => {
    expect(paginate(items, 0, 2).items).toEqual(["a", "b"]);
  });

  it("does not modify the list it was given", () => {
    const list = [...items];
    paginate(list, 2, 2);
    expect(list).toEqual(items);
  });
});
