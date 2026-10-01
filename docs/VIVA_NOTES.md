# Viva Notes

Plain-language notes for explaining every folder in this repo, two full request traces, the design choices behind the UI, and answers to likely viva questions — all grounded in what the code actually does, not what it's supposed to do.

## Per-folder explanations

### `server/src/routes/`
Express route handlers — the thinnest possible layer. Each file parses the request, calls into `engine/` or `nl/`, and returns `{ data }` or `{ error }`. `health.ts` reports server status and `DEMO_MODE`. `stocks.ts` looks up one ticker (404 if unknown). `screen.ts` is the main endpoint: validates the body with zod, then runs filter → search → sort → paginate in that order. `sectors.ts` derives the sector list from the data itself instead of hardcoding it. `parse.ts` is the odd one out — it never validates its body and always answers `200`, because "I couldn't understand that" is a normal answer for free text, not an error.

### `server/src/engine/`
Pure functions with no side effects — no `fetch`, no file I/O (that's `data/`'s job), so every one of them is trivially unit-testable. `filterSpec.ts` is the single zod contract every filter (manual UI, presets, LLM output) must satisfy. `fields.ts` is the one place a field name turns into an actual comparable value off a `Stock`, so filtering and sorting on the same field can never disagree with each other. `applyFilters.ts`, `searchStocks.ts`, `sortStocks.ts`, `paginate.ts` each do exactly what they're named. `metrics.ts` computes the two values that aren't stored directly in the snapshot: `marketCapBucket` (Large/Mid/Small, from house-defined thresholds) and `change1m` (percent price change over ~4 weeks).

### `server/src/nl/`
Turns free text into a `FilterSpec`. `vocabulary.ts` is a fixed, documented dictionary ("cheap" → P/E < 20, sector names and synonyms, etc.) — every entry has a human-readable `note` so a vague word never silently means something the user didn't expect. `ruleParser.ts` matches that vocabulary plus a few numeric-phrase regexes ("P/E under 15") and never throws. `llmPrompt.ts` builds the one shared prompt (fields, ops, and the vocabulary's own notes — never any stock data) and validates a model's JSON reply against the same `FilterSpecSchema`. `llmClient.ts` calls Gemini or Groq over plain `fetch` with a 5s timeout; `ollamaClient.ts` calls a local Ollama with a 3s timeout. `nlCache.ts` persists successful model answers to `data/nlCache.json`, keyed by normalized query text. `parseOrchestrator.ts` is the only place that decides the fallback order between all of the above (see [AI tier flow](../README.md#ai-tier-flow)).

### `server/src/data/`
Everything about reading (not fetching) stock data. `stockSchema.ts` is the zod contract a snapshot file must satisfy. `loadStocks.ts` reads and validates `data/stocks.json` once per server process and caches the promise — every request after the first reuses that same cached snapshot instead of re-reading the file. `tickers.ts` is the hand-reviewed list of ~100 NIFTY 50 + NIFTY NEXT 50 symbols the snapshot script fetches.

### `server/scripts/`
`snapshot.ts` is the *only* place allowed to write `data/stocks.json`. It fetches all ~100 tickers from Yahoo Finance (via `yahoo-finance2`), validates the result against `stockSchema.ts`, and refuses to write the file at all if any ticker fails — so the app never runs on a silently-incomplete snapshot. Run with `npm run snapshot`; requires internet.

### `web/src/components/`
Everything reusable in the UI, split roughly into: data display (`StockTable`, `StockDetail`, `CompareView`, `SectorChart`), filter input (`FilterPanel`, `FilterChips`, `PresetBar`, `QueryBox`, `SearchBar`), and small shared pieces. `Drawer` is the shared modal chrome behind both detail views; `MetricHelp` is the "?" glossary popover; `CompareBar` is the sticky "N of 3 selected" strip that opens `CompareView`, shared by `Screener` and `Watchlist` so neither page repeats it; `StatePanels` holds the loading-skeleton, empty, and error looks every async view uses, so a loading state looks the same whether it's the main table or a drawer; `Icons` is every inline SVG icon in the app (no icon font, no CDN, per `CLAUDE.md`), kept in one file so a glyph like the close "×" isn't copy-pasted into four components. Pure logic that doesn't need React lives alongside as plain `.ts` files, unit-tested without rendering anything: `format.ts` (number/date formatting, plus `displayTicker()`, which hides the `.NS` exchange suffix on screen only — the data and every API call still use the full ticker), `filterSpecUtils.ts`, `chartData.ts` (per-chart data shaping, plus the shared Recharts tooltip/tick style objects all three charts use), `clientSort.ts`, `stockMetrics.ts`.

### `web/src/pages/`
`Screener.tsx` is the main page: owns all filter/search/sort/page state, debounces it before hitting the network, and wires every component in `components/` together. `Watchlist.tsx` reuses the same `StockTable`, but fetches its stocks one-by-one via `getStock` (not `/api/screen`) since a watchlist is never "the whole universe," just whatever's starred.

### `web/src/hooks/`
`useWatchlist.ts` — the only custom hook. Reads/writes a plain array of tickers to `localStorage`, with every access wrapped in `try/catch` so a blocked or full storage falls back to an empty, non-persistent watchlist instead of crashing the app.

### `web/src/api/`
`client.ts` is, by rule, **the only file in `web/` allowed to call `fetch`.** Every network call the app makes funnels through one of its exported functions, and it hand-mirrors the server's zod types (`FilterSpec`, `Stock`, etc.) as plain TypeScript types, since `web/` and `server/` are separate builds that can't import each other's source.

### `web/src/content/`
Static JSON, not code. `presets.json` — four named one-click filter combinations. `glossary.json` — plain-language definitions for P/E, Market Cap, Debt/Equity, Profit Margin, and 1-Month Change, shown via `MetricHelp`; every entry's `source` field is literally the string `"TODO"` rather than a fabricated citation.

### `eval/`
Not part of the running app — a standalone scoring harness. `queries.json` is 40 hand-written test queries with expected filters. `run.ts` (`npm run eval`) scores the rule parser (and the LLM tier alone, if configured) against them and writes `results.md`.

### `docs/`
This project's own documentation, written by hand, describing what's actually implemented (not a spec for what should be).

---

## Request path: filtering the screen

Example: a user checks the "Small" checkbox under Market Cap in `FilterPanel`.

1. **`FilterPanel.tsx`** — `toggleInList` builds the new filter list and calls `onChange`, which is `Screener`'s `updateFilters`.
2. **`Screener.tsx`** — `updateFilters` calls `setFilters(next)` and resets `page` to `1` (any filter change invalidates the old page number). React re-renders immediately with the new chips/checkboxes reflecting the change — no network call yet.
3. Still in **`Screener.tsx`** — a `useEffect` watching `[filters, search]` restarts a 300ms timer; only once typing/clicking pauses does it update `debouncedQuery`, which is the actual thing a second `useEffect` depends on.
4. That second `useEffect` calls **`screenStocks(...)`** from **`web/src/api/client.ts`** — `POST /api/screen` with `{ filters, search, sort, page, pageSize }`.
5. Vite's dev proxy (`web/vite.config.ts`) forwards `/api/*` to `http://localhost:3001`.
6. **`server/src/routes/screen.ts`** validates the body against `ScreenRequestSchema`, then calls, in order: `loadStocks()` (cached read of `data/stocks.json`) → `applyFilters()` → `searchStocks()` → `sortStocks()` → `paginate()`.
7. The route responds `{ data: { items, total, asOf } }`.
8. Back in **`Screener.tsx`**, the promise resolves into `setState({ kind: "ready", ...result })`, and **`StockTable.tsx`** re-renders with the new `items`.

## Request path: a natural-language query

Example: a user types "cheap profitable midcaps that fell this month" into `QueryBox` and clicks Ask.

1. **`QueryBox.tsx`**'s `handleSubmit` calls **`parseQuery(value)`** from **`web/src/api/client.ts`** — `POST /api/parse` with `{ query }`.
2. **`server/src/routes/parse.ts`** reads `query` off the body (or `""` if missing/non-string — no validation, always `200`) and calls **`parseWithTiers(query)`** in **`server/src/nl/parseOrchestrator.ts`**.
3. The orchestrator always runs `parseQuery()` (the offline rule parser, `server/src/nl/ruleParser.ts`) first — its `notes`/`unmatched` are shown regardless of which tier ultimately answers. Then, unless `DEMO_MODE=true`: try the cloud LLM (5s timeout) → try local Ollama (3s timeout) → try the on-disk cache (`data/nlCache.json`) → fall back to the rule parser's own result. (Full order and diagram: [README § AI tier flow](../README.md#ai-tier-flow).)
4. The route responds `{ data: { filters, notes, unmatched, tier } }` — always `200`.
5. Back in **`QueryBox.tsx`**, `onApply(result.filters)` calls the *same* `updateFilters` function `FilterPanel` uses — the query box never keeps a separate copy of "what's filtered."
6. From here it's identical to steps 2–8 of the screen-filtering trace above: `filters` state changes → debounce → `POST /api/screen` → table re-renders.

---

## Design choices (from `docs/DESIGN.md`)

`docs/DESIGN.md` was rewritten in a Milestone 10 redesign pass; everything below reflects that current version, not the original Milestone 3 look.

- **Light theme only, one self-hosted font, no animation library.** The read is "calm, trustworthy, data-heavy screener for beginners, not a marketing site" — `VISUAL_DENSITY 6`. The typeface is **Geist Sans**, a single variable `.woff2` checked into `web/public/fonts/` under its own open-source license, loaded via `@font-face` in `web/src/index.css` — never a CDN font link, so the app still renders correctly with the network off. Its tabular-figure feature is why table numbers no longer need a separate monospace font.
- **One accent hue: Cobalt.** A desaturated blue, defined as an 11-step OKLCH scale (`accent-50` … `accent-950`) so every shade used anywhere in the app comes from the same hue. `positive`/`negative` are the only other colors with meaning: `positive` (green) is reserved for gains but, as before, nothing currently renders `change1m` with it (see viva Q9 below); `negative` (red) now does double duty as both the losses color and the one error color used across every error panel and message in the app — one red, not two.
- **`n/a`, never blank/NaN/em-dash**, for every missing value — enforced in one place (`web/src/components/format.ts`), not re-implemented per component.
- **Numbers use `tabular-nums`, right-aligned** — Geist's own tabular-figure feature, not a monospace font swap, so a column of prices lines up on the decimal point instead of jittering as digit counts change.
- **The table is styled like a card, not a bare `<table>`** — a shaded header row, 48px rows, a hover state, and a highlight on rows picked for Compare — inside a bordered, shadowed container (`docs/DESIGN.md`'s card and shadow tokens). Below 640px it becomes one stacked card per stock instead of a horizontally-scrolling table, with the price as the largest number on the card and every label sitting above its value so long labels can never collide with long values.
- **Two distinct chip styles.** A *choice chip* (the sector/market-cap options in `FilterPanel`) is a real checkbox with a pill-styled label that shows a check icon when on. An *applied-filter chip* (`FilterChips`) is a separate look — a small filter icon, the description, and a 24px round remove button — so "here's an option you could pick" and "here's a filter that's actually active" never look the same thing.
- **The disclaimer is a real banner, not a caption.** "Educational tool, not financial advice" renders once in `App.tsx` as a full-width `role="note"` band with an icon, directly under the header, on every page — not a small grey line tucked into one page's own heading.
- **The query box is the visual centrepiece of the Screener page.** It gets its own card, a visible heading and helper text (not just a placeholder), a large input with a leading icon, and a filled primary-color submit button — distinct from the plainer `SearchBar` used for name/ticker search, even though both are text inputs.
- **Every icon is inline SVG** (`web/src/components/Icons.tsx`) — no icon font, no image assets (offline-first: `CLAUDE.md` bans CDN icons/fonts).
- **Motion is `transition-colors`/`transition-opacity` on hover, focus, and the drawer's entrance only** — `MOTION_INTENSITY 2`, CSS only, no animation library. The drawer's slide/fade-in uses CSS `@starting-style` and disables itself under `prefers-reduced-motion`; nothing else in the app slides, fades, or animates in.

---

## 10 likely viva questions (answered only from what the code does)

**1. Why is screening done on the server instead of in the browser, if all the data is a static JSON file anyway?**
Because `CLAUDE.md`'s contract makes `/api/screen` the single source of truth for filter/sort/search/paginate logic (`server/src/engine/*`), and `web/src/api/client.ts` is the *only* file allowed to call `fetch` — the browser never sees the raw snapshot at all, only whatever page of results it asked for. This also means the exact same filtering code answers a manual filter, a preset, and an LLM-derived query — there's only one implementation to get right.

**2. What actually happens if the LLM returns a field name that doesn't exist, like `"volatility"`?**
`llmPrompt.ts`'s `parseModelOutput` runs the model's JSON through `FilterSpecSchema.safeParse`. `FilterFieldSchema` is a strict zod enum of the six real fields, so an unknown field fails validation, `parseModelOutput` returns `null`, and `llmClient.ts`'s `callLlm` also returns `null` — the orchestrator then falls through to the next tier as if the LLM hadn't answered at all. Nothing invented ever reaches the client.

**3. "Cheap" turns into P/E < 20. Where did 20 come from, and can it change?**
It's a fixed number in `server/src/nl/vocabulary.ts` — `{ field: "pe", op: "lt", value: 20 }`, with a note ("cheap = P/E below 20") shown back to the user precisely so it's never a silent guess. It's not learned or calibrated from the data; it's a human-picked, documented, arguable threshold, same as the market-cap buckets in `metrics.ts`.

**4. Why doesn't market-cap bucketing use SEBI's official large/mid/small-cap definition?**
Because SEBI classifies by *rank* (the top 100 listed companies = large cap), and this app's entire universe already *is* that top 100 — applying the official rule would label all 100 stocks "Large" and the filter would be useless. `metrics.ts` instead uses two absolute INR thresholds picked to split this specific 100-stock universe into a usable spread (currently 43/50/7), and says so directly in a comment ("review these").

**5. What happens when a stock has no `debtToEquity` value at all — does it show as 0?**
No. `stockSchema.ts` types every metric as `number | null`, and `applyFilters.ts`'s `matchesFilter` explicitly returns `false` for a `null` value against *any* filter on that field, with the comment "a missing value never matches anything… must not sneak into a 'P/E under 15' result." Sorting treats it the same way: `sortStocks.ts` always sinks `null` to the bottom regardless of sort direction. In the UI, `format.ts` renders it as the literal string `"n/a"`.

**6. How is "1-month change" computed — why not just compare the last two weekly closes?**
`metrics.ts`'s `change1m` compares the latest close to the close 4 weeks back (`CHANGE_1M_LOOKBACK_WEEKS = 4`), not the adjacent week. It also filters out `null` closes *before* counting back 4 slots, because Yahoo's weekly data ends with a null close for the still-in-progress week followed by a live price point — counting back 4 raw array slots would quietly measure 3 weeks instead of 4 for every single stock.

**7. If two people type the exact same natural-language query, do they get the same answer?**
Not necessarily on the LLM tier — `llmClient.ts` calls Gemini/Groq with `temperature: 0` (asking for the most deterministic output the API allows), but nothing guarantees identical output across calls, and `ollamaClient.ts`'s request body sets no temperature at all. What *is* guaranteed deterministic is the rule-parser tier (pure regex/dictionary matching, `server/src/nl/ruleParser.ts`) and the cache tier (`nlCache.ts` — the same normalized query string always reads the same saved entry, and a cache hit is checked *after* the LLM/Ollama tiers, so only their misses/failures get re-tried against fresh non-determinism next time).

**8. How do you know `DEMO_MODE=true` really makes zero network calls, rather than just hiding errors?**
`parseOrchestrator.ts`'s `parseWithTiers` wraps the entire `callLlm`/`callOllama` block in `if (!demoMode) { ... }` — when `demoMode` is true, that code is never reached, so `fetch` is never constructed, not merely caught-and-ignored. This was specifically verified live in `docs/PROGRESS.md` (Milestone 7) with Playwright network-request interception showing zero external requests.

**9. Does the app color gains green and losses red?**
The color tokens exist (`--color-positive`/`--color-negative` in `web/src/index.css`) but nothing in `web/src/components/` currently applies `positive` to `change1m` — the metric is used only as a filter/sort field and in preset descriptions ("Recent Gainers"), never rendered as a colored value anywhere in the table, detail drawer, or compare view. This is a real gap between the design tokens and what's actually wired up, not a deliberate choice documented anywhere. `negative`, meanwhile, is wired up, but only as the app's one error color (every `ErrorPanel` and inline error message) — it has never been used for a losses value either.

**10. Why does `npm run eval` sometimes skip the LLM column entirely instead of showing a score of 0?**
`eval/run.ts` checks whether `LLM_PROVIDER`, `LLM_API_KEY`, and `LLM_MODEL` are *all* set before calling `callLlm` at all — if any are missing, it never makes the call and the results table prints "skipped — no key configured" instead of a real (and misleadingly low) score. This mirrors `callLlm`'s own behavior of returning `null` immediately, without a network attempt, when it isn't fully configured.
