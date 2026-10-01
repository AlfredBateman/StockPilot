import { useEffect, useRef } from "react";
import { IconClose } from "./Icons";

type DrawerProps = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

// Shared side-panel chrome for StockDetail and CompareView: a backdrop, a
// close button, and Escape-to-close. The panel is the elevated surface (white,
// shadow-e3, docs/DESIGN.md sections 1 and 9). It slides/fades in with plain
// CSS (@starting-style via Tailwind's `starting:` variant), no JavaScript
// animation, and appears instantly under reduced motion.
export function Drawer({ title, onClose, children }: DrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-stone-900/35 backdrop-blur-[2px] transition-opacity duration-200 starting:opacity-0 motion-reduce:transition-none"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 flex h-full w-full flex-col overscroll-contain bg-elevated shadow-e3 transition-[translate,opacity] duration-200 ease-out starting:translate-x-8 starting:opacity-0 motion-reduce:transition-none sm:max-w-xl sm:rounded-l-2xl sm:border-l sm:border-stone-200"
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-stone-200 px-5 sm:px-6">
          <h2 className="truncate text-h2 text-stone-900">{title}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-9 shrink-0 touch-manipulation items-center justify-center rounded-xl text-stone-500 transition-colors duration-150 hover:bg-stone-100 hover:text-stone-900"
          >
            <IconClose size={18} />
          </button>
        </div>
        <div aria-live="polite" className="flex flex-1 flex-col gap-6 overflow-y-auto overscroll-contain p-5 sm:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
