import { IconTray, IconWarning } from "./Icons";

// The loading / empty / error looks from docs/DESIGN.md section 17, shared
// by Screener, Watchlist, StockDetail and CompareView so every state in the
// app reads the same way. Pure markup: callers keep all their own state.
// The shimmer is the CSS `skeleton` utility in index.css, not anime.js.

/** A shimmering placeholder the same shape as StockTable (dark header included), so nothing jumps when data arrives. */
export function TableSkeleton({ rows = 6, label }: { rows?: number; label: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-card shadow-e1">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">
        <div className="flex h-11 items-center gap-6 bg-accent-900 px-4">
          <span className="h-2.5 w-16 rounded-full bg-white/15" />
          <span className="hidden h-2.5 w-24 rounded-full bg-white/15 sm:block" />
          <span className="ml-auto h-2.5 w-14 rounded-full bg-white/15" />
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex h-13 items-center gap-6 border-b border-stone-200 px-4 last:border-b-0">
            <span className="skeleton h-3 w-20 rounded-full" />
            <span className="skeleton hidden h-3 w-44 rounded-full sm:block" />
            <span className="skeleton ml-auto h-3 w-16 rounded-full" />
            <span className="skeleton hidden h-3 w-16 rounded-full md:block" />
            <span className="skeleton hidden h-3 w-12 rounded-full md:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Shimmering bars in the shape of the drawer content (name, price, chart, tiles). */
export function BlockSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="flex flex-col gap-3">
        <span className="skeleton h-4 w-2/3 rounded-full" />
        <span className="skeleton h-3 w-1/3 rounded-full" />
        <span className="skeleton mt-2 h-10 w-1/2 rounded-xl" />
        <span className="skeleton mt-2 h-48 w-full rounded-2xl" />
        <span className="grid grid-cols-2 gap-2">
          <span className="skeleton h-16 rounded-xl" />
          <span className="skeleton h-16 rounded-xl" />
          <span className="skeleton h-16 rounded-xl" />
          <span className="skeleton h-16 rounded-xl" />
        </span>
      </div>
    </div>
  );
}

type EmptyPanelProps = {
  title: string;
  hint: string;
  action?: { label: string; onClick: () => void };
};

export function EmptyPanel({ title, hint, action }: EmptyPanelProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-stone-200 bg-card px-6 py-14 text-center shadow-e1">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-accent-100 text-accent-700 ring-8 ring-accent-100/40">
        <IconTray size={26} />
      </span>
      <div className="flex flex-col gap-1.5">
        <p className="text-balance text-h2 text-stone-900">{title}</p>
        <p className="max-w-sm text-body text-stone-600">{hint}</p>
      </div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="h-10 touch-manipulation rounded-xl bg-accent-600 px-5 text-body font-medium text-white shadow-e1 transition-[background-color,transform] duration-150 hover:bg-accent-700 active:scale-[0.98]"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

type ErrorPanelProps = {
  title: string;
  message: string;
  /** What the user can do about it, when there is no Retry button to press. */
  hint?: string;
  onRetry?: () => void;
};

export function ErrorPanel({ title, message, hint, onRetry }: ErrorPanelProps) {
  return (
    <div
      role="alert"
      className="flex items-start gap-4 rounded-2xl border border-error-border bg-error-soft p-5 shadow-e1"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-elevated text-error shadow-e1">
        <IconWarning size={20} />
      </span>
      <div className="flex min-w-0 flex-col items-start gap-1">
        <p className="text-h3 text-stone-900">{title}</p>
        <p className="break-words text-body text-error">{message}</p>
        {hint && <p className="text-body text-stone-700">{hint}</p>}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 h-10 touch-manipulation rounded-xl border border-stone-300 bg-elevated px-5 text-body font-medium text-stone-800 shadow-e1 transition-[background-color,transform] duration-150 hover:bg-stone-50 active:scale-[0.98]"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
