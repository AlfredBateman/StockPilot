import { useEffect, useRef } from "react";

// One Esc press closes one thing: the layer opened most recently (a popover
// over a drawer, a drawer over the first-visit hint). Each layer used to listen
// for Esc on its own, so a single press reached all of them at once, and
// closing the hint re-rendered the page and could drop the drawer's listener
// before it ran. Now there is one document listener and a stack of layers.
const layers: { current: () => void }[] = [];

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === "Escape") layers[layers.length - 1]?.current();
}

/**
 * Registers `onEscape` as the topmost layer while `active`. Only the topmost
 * layer receives Esc. The latest `onEscape` is always used without moving the
 * layer in the stack, so a new callback identity does not change who is on top.
 */
export function useEscapeLayer(onEscape: () => void, active = true) {
  const handler = useRef(onEscape);
  useEffect(() => {
    handler.current = onEscape;
  });

  useEffect(() => {
    if (!active) return;
    layers.push(handler);
    if (layers.length === 1) document.addEventListener("keydown", handleKeyDown);
    return () => {
      layers.splice(layers.indexOf(handler), 1);
      if (layers.length === 0) document.removeEventListener("keydown", handleKeyDown);
    };
  }, [active]);
}
