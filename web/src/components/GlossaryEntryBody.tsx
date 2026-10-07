import type { GlossaryEntry } from "./glossary";

type GlossaryEntryBodyProps = {
  entry: GlossaryEntry;
};

/**
 * The sections of one glossary entry, in the order a beginner needs them: the
 * one-sentence meaning, why it matters, a real example, then the exact
 * thresholds StockPilot uses. Shared by the "?" popover and the Guide, so the
 * two can never tell different stories. A definition list, so a screen reader
 * announces each label with its text.
 */
export function GlossaryEntryBody({ entry }: GlossaryEntryBodyProps) {
  return (
    <dl className="flex flex-col gap-3.5 text-body text-stone-700">
      <div>
        <dt className="sr-only">Meaning</dt>
        <dd className="text-pretty text-stone-900">{entry.definition}</dd>
      </div>

      <div className="flex flex-col gap-0.5">
        <dt className="text-label text-stone-500">Why it matters</dt>
        <dd className="text-pretty">{entry.whyItMatters}</dd>
      </div>

      <div className="flex flex-col gap-1 rounded-xl border border-stone-200 bg-stone-50 p-3">
        <dt className="text-label text-stone-500">Example from the data</dt>
        <dd className="text-pretty tabular-nums">{entry.example}</dd>
      </div>

      <div className="flex flex-col gap-1 rounded-xl border border-accent-200 bg-accent-100/60 p-3">
        <dt className="text-label text-accent-800">How StockPilot uses it</dt>
        <dd className="text-pretty text-stone-800">{entry.howStockPilotUsesIt}</dd>
      </div>

      {entry.goodToKnow.length > 0 && (
        <div className="flex flex-col gap-1">
          <dt className="text-label text-stone-500">Good to know</dt>
          <dd>
            <ul className="flex list-disc flex-col gap-1.5 pl-4 marker:text-stone-400">
              {entry.goodToKnow.map((point) => (
                <li key={point} className="text-pretty">
                  {point}
                </li>
              ))}
            </ul>
          </dd>
        </div>
      )}
    </dl>
  );
}
