import { useId, useLayoutEffect, useRef, useState } from "react";
import { parseQuery, type FilterSpec, type ParseIntent, type ParseResult, type ParseTier } from "../api/client";
import { glossaryKeyForNote } from "./glossary";
import { GlossaryLink } from "./GlossaryLink";
import { IconArrowRight, IconChat, IconCheck, IconInfo, IconWarning } from "./Icons";
import { slideDown } from "./motion";

type QueryBoxProps = {
  onApply: (filters: FilterSpec) => void;
};

type QueryState = { kind: "idle" } | { kind: "loading" } | { kind: "ready"; result: ParseResult } | { kind: "error"; message: string };

const TIER_LABELS: Record<ParseTier, string> = {
  rules: "Rules",
  llm: "LLM",
  cache: "Cached",
};

function Badge({ text }: { text: string }) {
  return (
    <span className="inline-flex h-6 w-fit items-center rounded-full border border-accent-200 bg-elevated px-2.5 text-label text-accent-800">
      {text}
    </span>
  );
}

const INTENT_LABELS: Record<ParseIntent, string> = {
  filter: "Search",
  question: "Question",
  advice: "Advice",
  offtopic: "Off-topic",
};

const RESULT_TITLES: Record<Exclude<ParseIntent, "filter">, string> = {
  question: "Answer",
  advice: "Before You Decide",
  offtopic: "Not a Stock Search",
};

function resultTitle(result: ParseResult): string {
  if (result.intent !== "filter") return RESULT_TITLES[result.intent];
  return result.filters.length === 0 ? "No Filters Found" : "Filters Applied";
}

// A free-text alternative to FilterPanel: "cheap profitable midcaps that fell
// this month" gets parsed on the server (rules, or an LLM tier when one is
// configured) into the same FilterSpec, which then shows up as ordinary,
// removable FilterChips. This component never keeps its own copy of what's
// filtered, it just hands the result to the same onApply PresetBar uses.
export function QueryBox({ onApply }: QueryBoxProps) {
  const [value, setValue] = useState("");
  const [state, setState] = useState<QueryState>({ kind: "idle" });
  const inputId = useId();
  const helpId = useId();
  const resultsRef = useRef<HTMLDivElement>(null);

  // Animation (d): the results panel slides down each time a new result arrives.
  // A layout effect, so the panel is collapsed before the browser paints it once at full height.
  useLayoutEffect(() => {
    if (state.kind === "ready" && resultsRef.current) slideDown(resultsRef.current);
  }, [state]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setState({ kind: "loading" });
    try {
      const result = await parseQuery(value);
      // Only a search changes the screen; a question or off-topic reply leaves the current filters alone.
      if (result.intent === "filter") onApply(result.filters);
      setState({ kind: "ready", result });
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "n/a" });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex items-start gap-4">
        <span className="hidden size-12 shrink-0 items-center justify-center rounded-2xl bg-accent-600 text-white shadow-e1 ring-4 ring-accent-100 sm:flex">
          <IconChat size={24} />
        </span>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={inputId} className="text-balance text-h1 text-stone-900">
            Describe the Stocks You&rsquo;re Looking For
          </label>
          <p id={helpId} className="max-w-2xl text-body text-stone-600">
            Write it in plain English, like &ldquo;cheap profitable midcaps that fell this month&rdquo;. StockPilot
            turns it into filters you can see and edit below.
          </p>
        </div>
      </div>

      <div className="relative">
        <IconChat
          size={20}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-500"
        />
        <input
          id={inputId}
          type="text"
          name="nl-query"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. profitable large caps…"
          aria-describedby={helpId}
          className="h-14 w-full rounded-2xl border border-stone-400 bg-elevated pl-12 pr-28 text-base text-stone-900 shadow-e1 transition-colors duration-150 placeholder:text-stone-500 hover:border-stone-500 focus:border-accent-500 sm:pr-32"
        />
        <button
          type="submit"
          className="group absolute inset-y-1.5 right-1.5 inline-flex touch-manipulation items-center gap-2 rounded-[10px] bg-accent-600 pl-4 pr-1.5 text-body font-semibold text-white shadow-e1 transition-[background-color,transform] duration-150 hover:bg-accent-700 active:scale-[0.98] sm:pl-5"
        >
          Ask
          {/* Button-in-button: the arrow sits in its own well and nudges right on hover. */}
          <span className="flex size-8 items-center justify-center rounded-lg bg-white/15 transition-transform duration-150 group-hover:translate-x-0.5">
            <IconArrowRight size={16} />
          </span>
        </button>
      </div>

      {state.kind === "loading" && (
        <p aria-live="polite" className="text-body text-stone-600">
          Reading your question…
        </p>
      )}

      {state.kind === "error" && (
        <p role="alert" className="flex items-start gap-2 text-body text-error">
          <IconWarning size={16} className="mt-0.5 shrink-0" />
          Couldn&rsquo;t reach the server: {state.message}. Check that it&rsquo;s running, then press Ask again.
        </p>
      )}

      {state.kind === "ready" && (
        <div
          ref={resultsRef}
          aria-live="polite"
          className="flex flex-col gap-3 rounded-xl border border-accent-200 bg-accent-100/60 p-4 text-body sm:p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-h3 text-accent-800">{resultTitle(state.result)}</p>
            <span className="flex flex-wrap gap-2">
              <Badge text={INTENT_LABELS[state.result.intent]} />
              <Badge text={`Parsed by: ${TIER_LABELS[state.result.tier]}`} />
            </span>
          </div>

          {state.result.correctedQuery && (
            <p className="text-stone-700">
              Showing results for{" "}
              <span className="font-semibold text-stone-900">&ldquo;{state.result.correctedQuery}&rdquo;</span>
            </p>
          )}

          {state.result.notice && (
            <p className="flex items-start gap-2 text-warning">
              <IconInfo size={16} className="mt-0.5 shrink-0" />
              {state.result.notice}
            </p>
          )}

          {/* The answer is plain text from the server and is rendered as text, never as HTML. */}
          {state.result.intent !== "filter" ? (
            <p className="max-w-2xl text-stone-800">{state.result.answer ?? "n/a"}</p>
          ) : state.result.filters.length === 0 ? (
            <p className="text-stone-700">
              None of those words are terms StockPilot knows yet. Try words like &ldquo;cheap&rdquo;,
              &ldquo;profitable&rdquo;, &ldquo;small cap&rdquo;, or a sector name.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {state.result.notes.map((note, index) => {
                const termKey = glossaryKeyForNote(note);
                return (
                  <li key={index} className="flex items-start gap-2.5 text-stone-800">
                    <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-600 text-white">
                      <IconCheck size={12} />
                    </span>
                    <span className="flex flex-col items-start gap-0.5">
                      {note}
                      {termKey && <GlossaryLink metric={termKey} />}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {state.result.suggestions.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-accent-200 pt-3">
              <p className="text-label text-stone-600">
                {state.result.filters.length === 0 ? "Did you mean:" : "No stocks match all of these. Try instead:"}
              </p>
              <ul className="flex flex-wrap gap-2">
                {state.result.suggestions.map((suggestion) => (
                  <li key={suggestion.label}>
                    <button
                      type="button"
                      onClick={() => onApply(suggestion.filters)}
                      className="inline-flex h-9 touch-manipulation items-center rounded-full border border-stone-300 bg-elevated px-3.5 text-body text-stone-700 shadow-e1 transition-colors duration-150 hover:border-accent-500 hover:text-accent-800"
                    >
                      {suggestion.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {state.result.unmatched.length > 0 && (
            <p className="border-t border-accent-200 pt-3 text-stone-600">
              Ignored words: <span className="font-medium text-stone-800">{state.result.unmatched.join(", ")}</span>
            </p>
          )}
        </div>
      )}
    </form>
  );
}
