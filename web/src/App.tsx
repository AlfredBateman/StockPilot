import { useEffect, useState } from "react";
import { getHealth } from "./api/client";
import { formatAsOfDate } from "./components/format";
import { IconInfo, IconOffline, LogoMark } from "./components/Icons";
import { WakeNotice } from "./components/WakeNotice";
import { Screener } from "./pages/Screener";
import { Watchlist } from "./pages/Watchlist";

type View = "screener" | "watchlist";

const TABS: { view: View; label: string }[] = [
  { view: "screener", label: "Screen" },
  { view: "watchlist", label: "Watchlist" },
];

export function App() {
  const [view, setView] = useState<View>("screener");
  const [demoMode, setDemoMode] = useState(false);
  // undefined until the health check answers; null if the server has no data date.
  const [dataAsOf, setDataAsOf] = useState<string | null | undefined>(undefined);

  // The server decides these (DEMO_MODE, which data it loaded), so ask it
  // rather than guessing. If the health check fails the page still works; it
  // just shows no badge and no data date.
  useEffect(() => {
    getHealth()
      .then((response) => {
        setDemoMode(response.data.demoMode);
        setDataAsOf(response.data.asOf);
      })
      .catch(() => {});
  }, []);

  const asOfLabel =
    dataAsOf === undefined
      ? null
      : `Data as of ${dataAsOf === null ? "n/a" : formatAsOfDate(dataAsOf)}, end of day, not live`;

  return (
    <div className="min-h-dvh">
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-3 focus-visible:z-50 focus-visible:rounded-xl focus-visible:bg-elevated focus-visible:px-4 focus-visible:py-2.5 focus-visible:text-body focus-visible:font-medium focus-visible:text-accent-700 focus-visible:shadow-e2"
      >
        Skip to main content
      </a>

      {/* Sticky product header: frosted over the page (CSS backdrop-filter only), docs/DESIGN.md section 11. */}
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-card/80 backdrop-blur-md backdrop-saturate-150">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 md:gap-8 md:px-6">
          <span className="flex shrink-0 items-center gap-2.5">
            <LogoMark />
            <span
              translate="no"
              className="sr-only text-[1.0625rem] font-semibold tracking-tight text-stone-900 sm:not-sr-only"
            >
              StockPilot
            </span>
          </span>

          <nav aria-label="Main" className="flex items-center gap-1 rounded-xl bg-stone-100 p-1 ring-1 ring-stone-200">
            {TABS.map((tab) => (
              <button
                key={tab.view}
                type="button"
                onClick={() => setView(tab.view)}
                aria-current={view === tab.view ? "page" : undefined}
                className={`h-9 touch-manipulation rounded-lg px-3.5 text-body font-medium transition-colors duration-150 sm:px-4 ${
                  view === tab.view
                    ? "bg-elevated text-accent-700 shadow-e1"
                    : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-3">
            {asOfLabel && <span className="hidden text-label text-stone-500 lg:inline">{asOfLabel}</span>}
            {demoMode && (
              <span
                title="No live data sources or network calls; answers come from the saved snapshot, cache, and offline parser."
                className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-warning/25 bg-warning-soft px-3 text-label text-warning"
              >
                <IconOffline size={14} />
                <span className="hidden sm:inline">Offline demo mode</span>
                <span className="sm:hidden">Offline</span>
              </span>
            )}
          </div>
        </div>
        {/* Below lg the header row has no room, so the data date gets its own line. */}
        {asOfLabel && (
          <p className="mx-auto max-w-7xl px-4 pb-2 text-label text-stone-500 md:px-6 lg:hidden">{asOfLabel}</p>
        )}
      </header>

      <WakeNotice />

      {/* The disclaimer is a proper note on every page, not a caption (docs/DESIGN.md section 19). */}
      <div className="mx-auto max-w-7xl px-4 pt-5 md:px-6 md:pt-6">
        <div
          role="note"
          className="flex items-start gap-3 rounded-xl border border-stone-200 bg-stone-50/80 px-4 py-3 text-body"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-700">
            <IconInfo size={16} />
          </span>
          <p className="pt-0.5 text-stone-600">
            <strong className="font-semibold text-stone-900">Educational tool, not financial advice.</strong>{" "}
            StockPilot screens a saved data snapshot to help you learn how screening works. Do your own research
            before investing.
          </p>
        </div>
      </div>

      {view === "screener" ? <Screener /> : <Watchlist />}
    </div>
  );
}
