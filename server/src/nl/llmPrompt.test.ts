import { describe, expect, it } from "vitest";
import { ADVICE_LINE, OFFTOPIC_LINE, buildParsePrompt, cleanAnswer, parseModelOutput } from "./llmPrompt.js";

const FILTERS = [{ field: "pe", op: "lt", value: 15 }];

describe("buildParsePrompt", () => {
  it("contains the user's text, the four intents and the allowed fields, and nothing from the data", () => {
    const prompt = buildParsePrompt("what is P/E?");
    expect(prompt).toContain("what is P/E?");
    for (const intent of ["filter", "question", "advice", "offtopic"]) expect(prompt).toContain(`"${intent}"`);
    expect(prompt).toContain("marketCapBucket");
    expect(prompt).not.toContain("RELIANCE");
    expect(prompt).not.toContain("weeklyCloses");
  });
});

describe("parseModelOutput — filter intent", () => {
  it("accepts filters that pass FilterSpecSchema", () => {
    const reply = parseModelOutput(JSON.stringify({ intent: "filter", filters: FILTERS, answer: null }));
    expect(reply).toEqual({ intent: "filter", filters: FILTERS, answer: null });
  });

  it("discards the whole reply when the filters fail validation", () => {
    const bad = { intent: "filter", filters: [{ field: "pe", op: "eq", value: "cheap" }], answer: null };
    expect(parseModelOutput(JSON.stringify(bad))).toBeNull();
  });

  it("discards an unknown intent", () => {
    expect(parseModelOutput(JSON.stringify({ intent: "chat", filters: [], answer: "hi" }))).toBeNull();
  });

  it("ignores a <think> block and markdown fences around the JSON", () => {
    const text = '<think>maybe {"intent": "question"}</think>\n```json\n' + JSON.stringify({ intent: "filter", filters: FILTERS }) + "\n```";
    expect(parseModelOutput(text)?.filters).toEqual(FILTERS);
  });

  it("returns null for text with no JSON object", () => {
    expect(parseModelOutput("Sure! {not json")).toBeNull();
    expect(parseModelOutput("no braces here")).toBeNull();
  });
});

describe("parseModelOutput — answer intents", () => {
  it("returns a question's answer with no filters", () => {
    const reply = parseModelOutput(
      JSON.stringify({ intent: "question", filters: FILTERS, answer: "P/E compares price to earnings." })
    );
    expect(reply).toEqual({ intent: "question", filters: [], answer: "P/E compares price to earnings." });
  });

  it("adds the fixed educational line to advice", () => {
    const reply = parseModelOutput(JSON.stringify({ intent: "advice", answer: "Look at debt and profit margin." }));
    expect(reply?.answer).toBe(`Look at debt and profit margin. ${ADVICE_LINE}`);
  });

  it("adds the fixed screening line to offtopic", () => {
    const reply = parseModelOutput(JSON.stringify({ intent: "offtopic", answer: "I can't help with recipes." }));
    expect(reply?.answer).toBe(`I can't help with recipes. ${OFFTOPIC_LINE}`);
  });

  it("discards an answer intent with an empty or missing answer", () => {
    expect(parseModelOutput(JSON.stringify({ intent: "question", answer: "  " }))).toBeNull();
    expect(parseModelOutput(JSON.stringify({ intent: "question" }))).toBeNull();
  });
});

describe("cleanAnswer", () => {
  it("strips HTML tags and markdown marks", () => {
    expect(cleanAnswer('<script>alert(1)</script>**P/E** is <b>price</b> over `earnings`.')).toBe(
      "alert(1) P/E is price over earnings."
    );
  });

  it("keeps at most 3 sentences", () => {
    expect(cleanAnswer("One. Two! Three? Four. Five.")).toBe("One. Two! Three?");
  });

  it("cuts very long text at a word boundary", () => {
    const long = "word ".repeat(200);
    const cleaned = cleanAnswer(long);
    expect(cleaned.length).toBeLessThanOrEqual(501);
    expect(cleaned.endsWith("…")).toBe(true);
  });
});
