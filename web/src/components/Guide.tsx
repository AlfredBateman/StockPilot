import { useEffect, useId, useState } from "react";
import { Drawer } from "./Drawer";
import { GLOSSARY, searchGlossary, type GlossaryKey } from "./glossary";
import { GlossaryEntryBody } from "./GlossaryEntryBody";
import { IconExternal, IconSearch } from "./Icons";
import { prefersReducedMotion } from "./motion";

type GuideProps = {
  onClose: () => void;
  /** When set, the Guide opens scrolled to this term and highlights it. */
  focusKey: GlossaryKey | null;
};

// Written for a total beginner. Every feature named here exists in the app today.
const STEPS: { title: string; text: string }[] = [
  {
    title: "Say what you want",
    text: "Type it in plain English, for example “cheap profitable midcaps”, or start from a preset. StockPilot turns your words into filters.",
  },
  {
    title: "Check the filters",
    text: "Each filter shows as a chip. Remove one with its x, or change the numbers in the Filters card. Tap “What does this mean?” under a chip whenever a term is new.",
  },
  {
    title: "Read the results",
    text: "Sort the table, tap a ticker to see its price history, star stocks for your Watchlist, or tick up to 3 to compare them side by side.",
  },
];

/**
 * The Guide: a drawer with a 3-step "how to use StockPilot" at the top, then
 * every glossary term with a search box. Opened from the header, from a "?"
 * popover's "See it in the Guide", or from a "What does this mean?" link; in
 * the last two cases it scrolls to that term. Reads the same glossary.json as
 * the popovers, so the explanations cannot disagree.
 */
export function Guide({ onClose, focusKey }: GuideProps) {
  const [search, setSearch] = useState("");
  const searchId = useId();
  const matches = searchGlossary(search);

  // Scroll to the requested term and move keyboard/screen-reader focus to its heading.
  // Instant under reduced motion, smooth otherwise (nothing here animates on its own).
  useEffect(() => {
    if (!focusKey) return;
    const entry = document.getElementById(`guide-${focusKey}`);
    if (!entry) return;
    entry.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    entry.querySelector<HTMLElement>("h4")?.focus({ preventScroll: true });
  }, [focusKey]);

  return (
    <Drawer title="Guide" onClose={onClose}>
      <section aria-labelledby="guide-steps-heading" className="flex flex-col gap-3.5">
        <h3 id="guide-steps-heading" className="text-h3 text-stone-900">
          How to use StockPilot
        </h3>
        <ol className="flex flex-col gap-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-600 text-label font-semibold tabular-nums text-white shadow-e1"
              >
                {index + 1}
              </span>
              <div className="flex flex-col gap-0.5">
                <p className="text-body font-semibold text-stone-900">{step.title}</p>
                <p className="text-pretty text-body text-stone-600">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-caption text-stone-600">
          StockPilot is an educational tool, not financial advice. Its numbers are end-of-day data from a saved
          snapshot, not live prices.
        </p>
      </section>

      <section aria-labelledby="guide-terms-heading" className="flex flex-col gap-3.5 border-t border-stone-200 pt-6">
        <h3 id="guide-terms-heading" className="text-h3 text-stone-900">
          Every term, explained
        </h3>

        <div className="flex flex-col gap-2">
          <label htmlFor={searchId} className="text-label text-stone-600">
            Search the terms
          </label>
          <div className="relative">
            <IconSearch size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" />
            <input
              id={searchId}
              type="search"
              name="guide-search"
              autoComplete="off"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. debt or margin…"
              className="h-11 w-full rounded-xl border border-stone-400 bg-elevated pl-11 pr-3.5 text-body text-stone-900 shadow-e1 transition-colors duration-150 placeholder:text-stone-500 hover:border-stone-500 focus:border-accent-500"
            />
          </div>
          <p aria-live="polite" className="text-caption tabular-nums text-stone-500">
            {matches.length} of {Object.keys(GLOSSARY).length} terms
          </p>
        </div>

        {matches.length === 0 ? (
          <p className="rounded-xl border border-dashed border-stone-300 px-4 py-8 text-center text-body text-stone-600">
            No term matches &ldquo;{search.trim()}&rdquo;. Try a shorter word, like &ldquo;debt&rdquo; or
            &ldquo;margin&rdquo;.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {matches.map((key) => {
              const entry = GLOSSARY[key];
              const isTarget = key === focusKey;
              return (
                <li
                  key={key}
                  id={`guide-${key}`}
                  className={`flex scroll-mt-2 flex-col gap-3 rounded-2xl border bg-card p-4 shadow-e1 ${
                    isTarget ? "border-accent-600 ring-1 ring-accent-600" : "border-stone-200"
                  }`}
                >
                  <h4 tabIndex={-1} className="text-h3 text-stone-900 outline-none">
                    {entry.term}
                  </h4>
                  <GlossaryEntryBody entry={entry} />
                  {entry.source ? (
                    <a
                      href={entry.source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-8 w-fit items-center gap-1.5 text-caption font-medium text-accent-700 underline decoration-accent-300 underline-offset-4 transition-colors duration-150 hover:text-accent-800 hover:decoration-accent-600"
                    >
                      Learn more: {entry.source.label}
                      <IconExternal size={12} />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  ) : (
                    <p className="text-caption text-stone-500">No source page has been checked for this term yet.</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </Drawer>
  );
}
