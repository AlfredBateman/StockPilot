import { formatAsOfDate } from "./format";

type SiteFooterProps = {
  /** The data date from /api/health; undefined while it loads, null when the server has none. Both show "n/a". */
  asOf: string | null | undefined;
  onOpenGuide: () => void;
};

/**
 * The thin muted footer under every page (docs/DESIGN.md section 19): where the
 * data comes from and how fresh it is, and a way back to the Guide. It sits
 * after <main>, so the sticky CompareBar (which lives inside the results
 * section) can never cover it.
 */
export function SiteFooter({ asOf, onOpenGuide }: SiteFooterProps) {
  return (
    <footer className="mx-auto max-w-7xl px-4 pb-8 md:px-6">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-stone-200 pt-4 text-label text-stone-600">
        <span>Data: Yahoo Finance (unofficial), end-of-day, last updated {asOf ? formatAsOfDate(asOf) : "n/a"}</span>
        <span>Educational, not financial advice</span>
        <button
          type="button"
          onClick={onOpenGuide}
          className="-my-1 touch-manipulation rounded-md py-1 font-medium text-accent-700 underline underline-offset-4 transition-colors duration-(--motion-fast) hover:text-accent-900"
        >
          Read the Guide
        </button>
      </div>
    </footer>
  );
}
