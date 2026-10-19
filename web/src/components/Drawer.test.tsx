// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Drawer } from "./Drawer";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

/** A parent like Screener: a button opens the drawer, onClose clears the state (so the drawer unmounts at once). */
function Host({ onClosed }: { onClosed?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button id="opener" onClick={() => setOpen(true)}>
        open
      </button>
      {open && (
        <Drawer
          title="Test drawer"
          onClose={() => {
            setOpen(false);
            onClosed?.();
          }}
        >
          <p id="inside">hello</p>
        </Drawer>
      )}
    </>
  );
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Host />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  for (const ghost of document.body.querySelectorAll("[aria-hidden='true'][inert]")) ghost.remove();
  vi.unstubAllGlobals();
});

function openDrawer() {
  const opener = container.querySelector<HTMLButtonElement>("#opener")!;
  opener.focus();
  act(() => opener.click());
  return opener;
}

const dialog = () => container.querySelector("[role='dialog']");
const ghost = () => document.body.querySelector<HTMLElement>("body > div[inert]");
const pressEsc = () => act(() => void document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));

describe("Drawer closing", () => {
  it("closes on Esc at once and puts focus back on the control that opened it", () => {
    const opener = openDrawer();
    expect(dialog()).not.toBeNull();
    expect(document.activeElement).not.toBe(opener); // focus moved into the drawer

    pressEsc();

    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("does the same from the X button and from the backdrop", () => {
    const opener = openDrawer();
    act(() => container.querySelector<HTMLButtonElement>("button[aria-label='Close'][class*='size-9']")!.click());
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(opener);

    openDrawer();
    act(() => container.querySelector<HTMLButtonElement>("[data-drawer-backdrop]")!.click());
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("leaves an inert, hidden, click-through copy to play the exit, and no copy under reduced motion", () => {
    openDrawer();
    pressEsc();
    const copy = ghost()!;
    expect(copy).not.toBeNull();
    expect(copy.getAttribute("aria-hidden")).toBe("true");
    expect(copy.style.pointerEvents).toBe("none");
    expect(copy.querySelector("[id]")).toBeNull();
    expect(copy.textContent).toContain("hello");
    copy.remove();

    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    openDrawer();
    pressEsc();
    expect(ghost()).toBeNull();
  });

  it("can be reopened straight after closing, and each Esc closes only one drawer", () => {
    const opener = openDrawer();
    pressEsc();
    act(() => opener.click());
    expect(dialog()).not.toBeNull();
    expect(container.querySelectorAll("[role='dialog']").length).toBe(1);

    const onClosed = vi.fn();
    act(() => root.render(<Host onClosed={onClosed} />));
    pressEsc();
    pressEsc(); // nothing is left to receive the second press
    expect(onClosed.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it("does not throw when the control that opened it has gone", () => {
    const onClose = vi.fn();
    act(() => root.render(<Drawer title="x" onClose={onClose} returnFocusTo={document.createElement("button")} />));
    expect(() => pressEsc()).not.toThrow();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
