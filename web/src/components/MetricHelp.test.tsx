// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { MetricHelp } from "./MetricHelp";

// Tells React that act() is in use, so it applies state updates right away instead of warning.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let parentClick: Mock<() => void>;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  parentClick = vi.fn();
  // A header cell that is clickable, nowrap and uppercase: the hard case for a popover.
  act(() => {
    root.render(
      <table>
        <thead>
          <tr>
            <th onClick={parentClick} className="whitespace-nowrap uppercase tracking-wide">
              P/E
              <MetricHelp metric="pe" />
            </th>
          </tr>
        </thead>
      </table>
    );
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function trigger(): HTMLButtonElement {
  return container.querySelector<HTMLButtonElement>("button[aria-label='What is P/E?']")!;
}

function popover(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>("[role='dialog']");
}

function openPopover() {
  act(() => trigger().click());
}

describe("MetricHelp", () => {
  it("starts closed and opens a dialog when the ? is clicked", () => {
    expect(popover()).toBeNull();
    expect(trigger().getAttribute("aria-expanded")).toBe("false");

    openPopover();

    expect(popover()).not.toBeNull();
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(trigger().getAttribute("aria-controls")).toBe(popover()!.id);
    expect(popover()!.getAttribute("aria-labelledby")).toBeTruthy();
  });

  it("draws the popover in document.body, outside the header, with its own text styles", () => {
    openPopover();
    const dialog = popover()!;

    expect(dialog.parentElement).toBe(document.body);
    expect(container.contains(dialog)).toBe(false);
    for (const cls of ["fixed", "whitespace-normal", "break-words", "normal-case", "tracking-normal", "text-left", "font-normal"]) {
      expect(dialog.classList.contains(cls)).toBe(true);
    }
  });

  it("closes on Escape and puts focus back on the ?", () => {
    openPopover();

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(popover()).toBeNull();
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger());
  });

  it("closes on a click outside, but not on a click inside", () => {
    openPopover();

    act(() => {
      popover()!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(popover()).not.toBeNull();

    act(() => {
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(popover()).toBeNull();
  });

  it("closes from its Close button", () => {
    openPopover();

    act(() => popover()!.querySelector<HTMLButtonElement>("button[aria-label='Close']")!.click());

    expect(popover()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it("toggles closed when the ? is clicked again", () => {
    openPopover();
    openPopover();
    expect(popover()).toBeNull();
  });

  it("does not let a click on the ? or inside the popover reach the clickable header", () => {
    openPopover();
    expect(parentClick).not.toHaveBeenCalled();

    act(() => popover()!.click());
    expect(parentClick).not.toHaveBeenCalled();
  });
});
