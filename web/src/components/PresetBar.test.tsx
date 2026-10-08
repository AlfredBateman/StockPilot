// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FilterSpec } from "../api/client";
import presetsData from "../content/presets.json";
import { FilterChips } from "./FilterChips";
import { PresetBar } from "./PresetBar";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PRESETS = presetsData as { name: string; filters: FilterSpec }[];

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  // Reduced motion: the chip animations put the element straight into its final state.
  window.matchMedia = ((query: string) => ({ matches: true, media: query })) as unknown as typeof window.matchMedia;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function cards() {
  return [...container.querySelectorAll<HTMLButtonElement>("button")];
}

describe("PresetBar", () => {
  it("marks only the active preset as pressed and labels it Active", () => {
    act(() => root.render(<PresetBar activeName={PRESETS[1].name} onToggle={() => {}} />));

    expect(cards().map((b) => b.getAttribute("aria-pressed"))).toEqual(PRESETS.map((_, i) => (i === 1 ? "true" : "false")));
    expect(cards()[1].textContent).toContain("Active");
    expect(container.textContent?.match(/Active/g)).toHaveLength(1);
  });

  it("shows no preset as active when activeName is null", () => {
    act(() => root.render(<PresetBar activeName={null} onToggle={() => {}} />));
    expect(cards().every((b) => b.getAttribute("aria-pressed") === "false")).toBe(true);
  });

  it("reports the clicked preset's name and filters, active or not", () => {
    const onToggle = vi.fn();
    act(() => root.render(<PresetBar activeName={PRESETS[0].name} onToggle={onToggle} />));

    act(() => cards()[0].click());
    act(() => cards()[2].click());

    expect(onToggle).toHaveBeenNthCalledWith(1, PRESETS[0].name, PRESETS[0].filters);
    expect(onToggle).toHaveBeenNthCalledWith(2, PRESETS[2].name, PRESETS[2].filters);
  });
});

describe("FilterChips clear all", () => {
  const filters: FilterSpec = [{ field: "pe", op: "lt", value: 15 }];

  it("shows Clear all filters whenever a filter is active and calls onClearAll", () => {
    const onClearAll = vi.fn();
    act(() => root.render(<FilterChips filters={filters} onRemove={() => {}} onClearAll={onClearAll} />));

    const button = [...container.querySelectorAll("button")].find((b) => b.textContent === "Clear all filters");
    expect(button).toBeDefined();
    act(() => button!.click());
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when no filter is active", () => {
    act(() => root.render(<FilterChips filters={[]} onRemove={() => {}} onClearAll={() => {}} />));
    expect(container.textContent).toBe("");
  });
});
