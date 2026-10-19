import { useEffect, useRef, useState } from "react";
import { useEscapeLayer } from "../hooks/useEscapeLayer";
import { IconClose } from "./Icons";
import { animateDrawerOut } from "./motion";

type DrawerProps = {
  title: string;
  onClose: () => void;
  /** Up to 960px wide instead of 576px, for content that needs side-by-side columns. Never wider than the screen. */
  wide?: boolean;
  children: React.ReactNode;
};

// Shared side-panel chrome for StockDetail, CompareView and Guide: a backdrop, a
// close button, and Escape-to-close. The panel is the elevated surface (white,
// shadow-e3, docs/DESIGN.md sections 1 and 9). It slides/fades in with plain
// CSS (@starting-style via Tailwind's `starting:` variant) and appears instantly
// under reduced motion.
//
// Closing (X, backdrop or Esc) hands everything to the parent at once: the drawer unmounts, focus goes back
// to the control that opened it, and the Esc layer is released. The exit animation (motion.ts, animateDrawerOut)
// plays on an inert copy, so nothing here ever waits for it.
export function Drawer({ title, onClose, wide = false, children }: DrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  // The control that opened the drawer, read once on the first render while it still has focus
  // (MetricHelp focuses its "?" before opening the Guide, so that case works too).
  const [opener] = useState(() => (document.activeElement instanceof HTMLElement ? document.activeElement : null));

  function close() {
    if (rootRef.current) animateDrawerOut(rootRef.current);
    onClose();
    if (opener?.isConnected) opener.focus();
  }

  useEscapeLayer(close);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  return (
    <div ref={rootRef} className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        data-drawer-backdrop=""
        onClick={close}
        className="absolute inset-0 bg-stone-900/35 backdrop-blur-[2px] transition-opacity duration-(--motion-base) starting:opacity-0 motion-reduce:transition-none"
      />
      <div
        role="dialog"
        data-drawer-panel=""
        aria-modal="true"
        aria-label={title}
        className={`relative z-10 flex h-full w-full flex-col overscroll-contain bg-elevated shadow-e3 transition-[translate,opacity] duration-(--motion-base) ease-out-soft starting:translate-x-8 starting:opacity-0 motion-reduce:transition-none sm:rounded-l-2xl sm:border-l sm:border-stone-200 ${
          wide ? "sm:max-w-[960px]" : "sm:max-w-xl"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-stone-200 px-5 sm:px-6">
          <h2 className="truncate text-h2 text-stone-900">{title}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={close}
            aria-label="Close"
            className="flex size-9 shrink-0 touch-manipulation items-center justify-center rounded-xl text-stone-500 transition-[color,background-color,scale] duration-(--motion-press) active:scale-95 hover:bg-stone-100 hover:text-stone-900"
          >
            <IconClose size={18} />
          </button>
        </div>
        {/* shrink-0 on every child: in a flex column a card with overflow-hidden would otherwise shrink to fit
            the panel's height (a chart collapsing to a sliver) instead of letting this area scroll. */}
        <div data-drawer-scroll="" aria-live="polite" className="flex flex-1 flex-col gap-6 overflow-y-auto overscroll-contain p-5 sm:p-6 [&>*]:shrink-0">
          {children}
        </div>
      </div>
    </div>
  );
}
