# StockPilot
Final-year B.Tech project. Beginner stock screener. Educational, NOT financial advice. I'm a student and must explain every file in a viva.

## Stack (fixed)
TypeScript only. web/: Vite, React, Tailwind, Recharts. server/: Express, zod, tsx. Tests: Vitest. Data: data/stocks.json snapshot loaded in memory. No database, auth, ORM, state library, UI kit, or extra CSS files.
Layout: web/src/{components,pages,hooks,api,content}, server/src/{routes,engine,nl,data}, server/scripts, data/, eval/, docs/.
Names: components PascalCase.tsx, other files camelCase.ts, named exports, tests beside code.

## Architecture
- Screening is server-side: pure functions in server/src/engine behind POST /api/screen. Responses are {data, error}. web/src/api/client.ts is the only file that calls fetch.
- FilterSpec (zod) is the single contract for manual filters, presets, and AI output.
- Offline first: runtime reads only data/stocks.json. Only the LLM tier uses the network; every failure falls back to the rule parser. Never crash. Env: DEMO_MODE, LLM_PROVIDER, LLM_API_KEY, LLM_MODEL. Never read or commit .env.
- Never invent data, sources, or citations. Use null or "TODO".

## AI features
- Parser (server/src/nl): the LLM only turns text into a FilterSpec. It never sees stock data. Output is zod-validated or discarded.
- Explainer (server/src/explain): single-turn beginner explanations, never a chatbot. The model gets the question, matching glossary entries, and, only when a ticker is given, that stock's metrics, looked up server-side from data/stocks.json by ticker. The client never sends numbers. It explains; it never recommends, predicts, or judges a stock.
- Advice questions are blocked by a deterministic check before any model call. Model output matching advice patterns is replaced with a fixed redirect.
- Explainer tiers: DEMO_MODE → cache → glossary-only. Otherwise LLM (10s timeout) → cache → glossary-only. Never throw. Never block the screener.
- Output is plain text, max about 150 words, rendered as text, never as HTML.
- LLM_API_KEY lives only in server/.env. Never in web/, logs, or git. Never read .env files.

## Rules
- Do only what the prompt asks. Extra ideas go in the summary as suggestions.
- Touch only allowed files. Ask before adding any dependency.
- Verify a package or API exists before using it. If unsure, ask.
- Before finishing, run npm test and npm run build. Never weaken or delete tests to pass.
- Start by reading docs/PROGRESS.md. End by appending 3 lines to it.
- Finish with "Plain-language summary": each file, what it does, why it exists, assumptions, anything skipped.

## UI and skills
- UI follows docs/DESIGN.md. Do not change the design language unless a prompt explicitly says "redesign" or "rewrite DESIGN.md".
- Offline: no CDN calls at runtime. All assets (fonts, libraries, icons) must be npm-installed or committed to web/public/. anime.js is allowed via npm. No GSAP. No external CDN icon packs.
- Animations via anime.js must be purposeful (data loads, filter transitions, number countups). Never animate on every scroll or every keypress. Every animation must respect prefers-reduced-motion: if the user has that set, the final state shows instantly.
- Missing values render as "n/a", never NaN, never an em dash.
- Background does not have to be white. Use depth: layered backgrounds, subtle texture, shadows, contrast between surface levels.
- Use design-taste-frontend, gpt-taste, high-end-visual-design, or web-design-guidelines only when a prompt names them. Use full-output-enforcement whenever a prompt names it. ponytail is always on, but prompt requirements override it: build every listed item in its simplest form. If ponytail says an item is unnecessary, say so in the summary instead of skipping it.
- Never change component props, state logic, or API calls during a UI/style pass. If a visual change requires a server or engine change, stop and report it instead.

## Git
- The only commit author is the configured git user. Never add Co-Authored-By, Claude-Session, "Generated with Claude Code", or any AI attribution to commits, tags, PRs, or files.
- Commit messages: one short imperative line. Use plain `git commit -m`. No --amend or --force unless a prompt says so.
- Never force-push, never delete branches, never read or print .env or any API key.
