// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Drawer } from "../components/Drawer";
import { GuideHint } from "../components/GuideHint";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

/** The real hint and the real Drawer, wired the way App and Screener wire them (fresh callbacks every render). */
function Page() {
  const [hint, setHint] = useState(true);
  const [drawer, setDrawer] = useState(false);
  return (
    <>
      {hint && <GuideHint onOpen={() => {}} onDismiss={() => setHint(false)} />}
      <button onClick={() => setDrawer(true)}>open drawer</button>
      {drawer && (
        <Drawer title="Compare (3)" onClose={() => setDrawer(false)}>
          body
        </Drawer>
      )}
    </>
  );
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Page />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const openDrawer = () => [...container.querySelectorAll("button")].find((b) => b.textContent === "open drawer")!.click();
const hint = () => container.querySelector("[role='note']");
const drawer = () => container.querySelector("[role='dialog']");
const pressEsc = () => act(() => void document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));

describe("Esc closes the topmost layer", () => {
  it("with the hint showing, the first Esc closes the drawer and leaves the hint, the second closes the hint", () => {
    act(() => openDrawer());
    expect(drawer()).not.toBeNull();
    expect(hint()).not.toBeNull();

    pressEsc();
    expect(drawer()).toBeNull();
    expect(hint()).not.toBeNull();

    pressEsc();
    expect(hint()).toBeNull();
  });

  it("with only the hint showing, Esc dismisses it", () => {
    pressEsc();
    expect(hint()).toBeNull();
  });

  it("stops listening once every layer has closed", () => {
    pressEsc();
    act(() => openDrawer());
    pressEsc();
    expect(drawer()).toBeNull();
    pressEsc(); // nothing open: must not throw
  });
});
