// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SiteFooter } from "./SiteFooter";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("SiteFooter", () => {
  it("shows the source, the data date and the disclaimer", () => {
    act(() => root.render(<SiteFooter asOf="2026-10-16T10:00:00.000Z" onOpenGuide={() => {}} />));
    const text = container.textContent ?? "";
    expect(text).toContain("Data: Yahoo Finance (unofficial), end-of-day, last updated 16 Oct 2026");
    expect(text).toContain("Educational, not financial advice");
  });

  it.each([null, undefined])("shows n/a when the date is %s", (asOf) => {
    act(() => root.render(<SiteFooter asOf={asOf} onOpenGuide={() => {}} />));
    expect(container.textContent).toContain("last updated n/a");
  });

  it("opens the Guide", () => {
    const onOpenGuide = vi.fn();
    act(() => root.render(<SiteFooter asOf={null} onOpenGuide={onOpenGuide} />));
    act(() => container.querySelector("button")!.click());
    expect(onOpenGuide).toHaveBeenCalledOnce();
  });
});
