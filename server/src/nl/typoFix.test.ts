import { describe, expect, it } from "vitest";
import { allowedDistance, editDistance, fixTypos, nearestKnownWord } from "./typoFix.js";

describe("editDistance", () => {
  it("counts single-letter inserts, deletes and swaps", () => {
    expect(editDistance("cheap", "cheap")).toBe(0);
    expect(editDistance("chep", "cheap")).toBe(1);
    expect(editDistance("tecnology", "technology")).toBe(1);
    expect(editDistance("kitten", "sitting")).toBe(3);
    expect(editDistance("", "abc")).toBe(3);
  });
});

describe("allowedDistance", () => {
  it("never corrects words of 3 letters or fewer, allows 1 up to 5 letters and 2 beyond", () => {
    expect(allowedDistance("cap")).toBe(0);
    expect(allowedDistance("chep")).toBe(1);
    expect(allowedDistance("enrgy")).toBe(1);
    expect(allowedDistance("tecnology")).toBe(2);
  });
});

describe("nearestKnownWord", () => {
  it("returns null on a tie instead of guessing", () => {
    expect(nearestKnownWord("ab", 1, ["aa", "bb"])).toBeNull();
  });

  it("returns null for an exact match (nothing to fix)", () => {
    expect(nearestKnownWord("cheap", 2)).toBeNull();
  });
});

describe("fixTypos", () => {
  it("fixes misspelled vocabulary words and sector names", () => {
    const result = fixTypos("chep tecnology stocks");
    expect(result.text).toBe("cheap technology stocks");
    expect(result.corrections).toEqual([
      { from: "chep", to: "cheap" },
      { from: "tecnology", to: "technology" },
    ]);
  });

  it("fixes a word inside a multi-word term (smal cap)", () => {
    expect(fixTypos("smal cap enrgy").text).toBe("small cap energy");
  });

  it("fixes comparator words in numeric phrases", () => {
    expect(fixTypos("pe undr 15").text).toBe("pe under 15");
  });

  it("leaves a correct query untouched", () => {
    expect(fixTypos("cheap profitable midcaps")).toEqual({ text: "cheap profitable midcaps", corrections: [] });
  });

  it('does not turn a real word into a term that adds no filter ("best" is not "debt")', () => {
    expect(fixTypos("best stocks")).toEqual({ text: "best stocks", corrections: [] });
  });

  it("does not touch short words or numbers", () => {
    expect(fixTypos("hot pe 15").corrections).toEqual([]);
  });
});
