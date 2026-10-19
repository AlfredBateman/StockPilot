import { describe, expect, it } from "vitest";
// The served page before React runs: what crawlers and link previews see.
import html from "../index.html?raw";

const count = (pattern: RegExp) => (html.match(pattern) ?? []).length;

describe("index.html static shell", () => {
  it("has exactly one h1 and one main, inside #root so React replaces them", () => {
    expect(count(/<h1[\s>]/g)).toBe(1);
    expect(count(/<main[\s>]/g)).toBe(1);
    expect(html).toMatch(/<div id="root"><main[^>]*>.*<h1>/s);
  });

  it("says the data is end-of-day and not financial advice", () => {
    expect(html).toContain("end-of-day data");
    expect(html).toContain("not financial advice");
  });

  it("has a canonical link and absolute preview image URLs", () => {
    expect(html).toContain('<link rel="canonical" href="https://stockpilot-hw7d.onrender.com/" />');
    expect(html).toContain('property="og:image" content="https://stockpilot-hw7d.onrender.com/og-image.png"');
    expect(html).toContain('name="twitter:image" content="https://stockpilot-hw7d.onrender.com/og-image.png"');
  });
});
