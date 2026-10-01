# Design system

Design read: a premium fintech screener for beginner investors. Warm, paper-like
light theme with real depth: a textured page, cards that float above it, and
interactive elements that sit clearly above the cards. Calm and trustworthy,
never playful, never a default Tailwind starter.

Dials: DESIGN_VARIANCE 4 (a symmetric grid with one deliberately dominant hero
card), MOTION_INTENSITY 4 (exactly four purposeful anime.js animations plus CSS
hover/focus transitions and one CSS skeleton shimmer), VISUAL_DENSITY 6 (data
first, grouped into floating surfaces).

Light theme only. Offline only: two self-hosted fonts, inline SVG icons, a CSS
noise texture from an inline SVG data URI, anime.js from npm. No CDN, no image
files, no external URLs at runtime.

Every token lives in `web/src/index.css` under `@theme` (Tailwind v4 reads
tokens from `@theme`; there is no `tailwind.config.ts`). Each token becomes a
normal utility class, e.g. `bg-card`, `text-stone-500`, `shadow-e2`,
`text-display`.

Colors are defined in OKLCH (perceptually even steps). Hex values are the sRGB
conversions; every contrast ratio below was computed from those hex values
with a script, not estimated.

## 1. Surfaces (three levels, each visibly distinct)

| Level | Token | OKLCH | Hex | Used for |
|---|---|---|---|---|
| 0 Page | `page` | 0.95 0.01 80 | `#f2eee7` | Body background, with the noise texture and a faint teal glow on top |
| 1 Card | `card` | 0.982 0.006 85 | `#fbf9f5` | Every card: query hero, filters, chart, table, mobile stock cards |
| 2 Elevated | `elevated` | 1 0 0 | `#ffffff` | Drawers, popovers, the compare bar's button, inputs, chips, preset tiles, secondary buttons |

Contrast between levels: card on page 1.10:1, elevated on card 1.05:1. Color
alone is a small step on purpose (it should feel like paper, not panels), so
**every level change is also marked by a border and a shadow** (sections 9 and
10). Rule: an interactive element always sits one level above the surface it is
on (white inputs and chips on warm cards).

## 2. Accent: Deep Teal (one accent, 9 shades)

| Token | OKLCH | Hex | Role |
|---|---|---|---|
| `accent-100` | 0.955 0.024 190 | `#dff6f4` | Selected row, results panel fill, empty-state icon disc |
| `accent-200` | 0.90 0.048 190 | `#bbe9e5` | Borders on accent surfaces; secondary text on dark accent (12.03:1 on accent-900) |
| `accent-300` | 0.81 0.075 191 | `#86d1cc` | Hover border on preset tiles; sorted-column arrow on the dark table header (9.08:1) |
| `accent-400` | 0.68 0.095 192 | `#43aba7` | Focus ring on dark surfaces |
| `accent-500` | 0.56 0.095 193 | `#058684` | Focused input border |
| `accent-600` | 0.47 0.085 195 | `#00696a` | **Primary**: buttons, active chips, links, focus ring, checkboxes (6.19:1 on card; white on it 6.50:1) |
| `accent-700` | 0.39 0.072 197 | `#005052` | Primary hover, active tab text |
| `accent-800` | 0.31 0.058 199 | `#00393b` | Text on accent-100 (11.30:1) |
| `accent-900` | 0.245 0.045 201 | `#002729` | **Dark table header**, compare bar (white on it 15.88:1) |

Why teal: it reads as calm and financial, it is distinct from the previous
cobalt, and it pairs with the warm page without the "AI purple" look. It is
kept clearly bluer (hue 190 to 201) than the gain green (hue 150), and gains
are never shown by color alone (a sign and an arrow always go with them).

**Color lock:** the accent is the only decorative hue. Stars, tabs, chips,
focus rings, buttons and the table header all use it.

## 3. Neutrals: Stone (warm grey, same warmth as the page)

| Token | Hex | Role |
|---|---|---|
| `stone-50` | `#f7f5f2` | Zebra row tint, inset panels |
| `stone-100` | `#f0ece7` | Segmented-control track, icon wells, skeleton base |
| `stone-200` | `#e2ddd7` | Card borders and hairlines |
| `stone-300` | `#cfcac2` | Chip borders, secondary button borders, decorative dividers |
| `stone-400` | `#918b83` | **Input borders** (3.21:1 on card, 3.37:1 on white: passes the 3:1 rule for UI boundaries) |
| `stone-500` | `#6e6860` | Muted text, labels, placeholders, **"n/a"** (5.24:1 on card, 4.76:1 on page) |
| `stone-600` | `#58514a` | Secondary body text (7.54:1 on card) |
| `stone-700` | `#423c35` | Chip text, legend text, secondary numbers |
| `stone-800` | `#2d2823` | Strong secondary headings |
| `stone-900` | `#1a1512` | **Primary text**, prices (17.22:1 on card) |

Rule: no text lighter than `stone-500`, anywhere.

## 4. Semantic colors (functional, never decorative)

All text values pass 4.5:1 on the card surface and on their own soft fill.

| Token | Hex | On card | Role |
|---|---|---|---|
| `gain` | `#1b763a` | 5.40:1 | Positive change (with "+" and an up arrow) |
| `gain-soft` | `#e0f7e4` | | Gain chip fill (gain on it: 5.03:1) |
| `loss` | `#b82f2b` | 5.74:1 | Negative change (with "-" and a down arrow) |
| `loss-soft` | `#ffeae7` | | Loss chip fill (loss on it: 5.22:1) |
| `warning` | `#985b0b` | 5.21:1 | Cautionary notes (the offline demo badge) |
| `warning-soft` | `#fdeed6` | | Warning fill (warning on it: 4.79:1) |
| `error` | `#a8212e` | 6.83:1 | Errors only |
| `error-soft` | `#ffebe9` | | Error panel fill (error on it: 6.27:1) |
| `error-border` | `#f6c2bf` | | Error panel border |
| muted | `stone-500` | 5.24:1 | Muted text (section 3) |

Loss and error are separate tokens on purpose: a falling price is not an error.

## 5. Chart colors (3 series, harmonious, not the Recharts default)

| Slot | Token | OKLCH | Hex |
|---|---|---|---|
| 1 | `chart-1` (teal) | 0.60 0.11 183 | `#009586` |
| 2 | `chart-2` (terracotta) | 0.66 0.145 48 | `#d87339` |
| 3 | `chart-3` (plum) | 0.47 0.14 305 | `#6e4199` |

Checked with the dataviz skill's `validate_palette.js --pairs all` against the
card surface `#faf8f4`: every check passes (lightness band, chroma floor,
colorblind separation worst ΔE 9.9, normal-vision worst ΔE 24.1, all three at
least 3:1 against the surface). Series colors are for marks only (lines, bars,
swatches); labels and legends always use `stone-*` text tokens. In
CompareView, color follows the compare slot, not the ticker.

## 6. Typography

Two self-hosted fonts from the official `vercel/geist-font` v1.7.2 release,
both variable (one file covers every weight), both under the SIL Open Font
License 1.1 (`web/public/fonts/Geist-OFL.txt`, identical for both):

- **Geist Sans** (`Geist-Variable.woff2`): all UI text. Has tabular figures
  (`tnum`) and a real ₹ glyph.
- **Geist Mono** (`GeistMono-Variable.woff2`): **tickers only**, so a ticker
  reads as a ticker, not as a word.

| Role | Class | Size / line-height | Weight | Notes |
|---|---|---|---|---|
| Display (stock price in the drawer) | `text-display` | 40 / 44 | 600 | `tabular-nums` so the countup never jitters |
| Page title (h1) | `text-h1` | 28 / 34 | 600 | tracking -0.02em |
| Section title (h2) | `text-h2` | 18 / 26 | 600 | tracking -0.01em |
| Subsection title (h3) | `text-h3` | 15 / 22 | 600 | |
| Body, table cells | `text-body` | 14 / 20 | 400 | |
| Label (field labels, table headers) | `text-label` | 12 / 16 | 500 | |
| Caption (helper text, "Data as of") | `text-caption` | 12 / 16 | 400 | |
| Ticker | `text-ticker font-mono` | 13 / 18 | 500 | tracking 0.02em |

Numbers in tables, metric tiles, chips and the price all use
`font-variant-numeric: tabular-nums` (Tailwind `tabular-nums`) so columns line
up on the decimal point.

No uppercase eyebrow labels. No em dash or en dash in any visible text.

## 7. Spacing and fixed sizes

Tailwind's 4px base; this subset only: `1` 4 · `1.5` 6 · `2` 8 · `3` 12 · `4` 16 · `5` 20 · `6` 24 · `8` 32 · `10` 40 · `12` 48.

| Element | Size |
|---|---|
| Table row | **52px** (`h-13`) |
| Table header row | 44px (`h-11`) |
| Filter chip (choice and applied) | **36px** (`h-9`) |
| Button | **40px** (`h-10`) |
| Input | **44px** (`h-11`) |
| Hero query input | 56px (`h-14`) |
| Header bar | 64px (`h-16`) |

Layout: content max width `max-w-7xl`, page gutter `px-4 md:px-6`, gap between
page sections `gap-6 md:gap-8`, card padding `p-4 sm:p-6`.

## 8. Radius (one rule, used everywhere)

| Element | Radius |
|---|---|
| Hero outer shell | 28px `rounded-[1.75rem]` |
| Hero inner core | 22px `rounded-[1.375rem]` (outer minus the 6px shell padding) |
| Cards, drawer panel | 16px `rounded-2xl` |
| Inputs, buttons, tiles, inner panels, popovers | 12px `rounded-xl` |
| Button nested inside an input | 10px `rounded-[10px]` |
| Chips, badges, pills | `rounded-full` |
| Chart bar data-ends | fully rounded (half the bar thickness), square at the baseline |

## 9. Elevation (three shadow levels, warm-tinted, never pure black)

Each shadow is layered (a tight contact shadow plus a soft ambient one) and
tinted with the page's warm hue. Levels 1 and 2 also carry a 1px white inner
top highlight, so a card reads as a lit physical surface.

| Token | Use | Definition |
|---|---|---|
| `shadow-e1` | Cards, chips, inputs, buttons | `inset 0 1px 0 rgb(255 255 255 / .7), 0 1px 2px oklch(.3 .02 60 / .06), 0 4px 12px -4px oklch(.3 .02 60 / .10)` |
| `shadow-e2` | Hero card, popovers, sticky compare bar, hovered tiles | `inset 0 1px 0 rgb(255 255 255 / .8), 0 2px 4px oklch(.3 .02 60 / .06), 0 12px 32px -8px oklch(.3 .02 60 / .16)` |
| `shadow-e3` | Drawer | `0 2px 8px oklch(.25 .02 60 / .08), 0 32px 80px -16px oklch(.25 .02 60 / .32)` |

**Rule: every card has a visible border AND a shadow.** Border `stone-200`
plus `shadow-e1` at minimum.

## 10. Page background and texture

- Base: `page` color.
- A very faint teal radial glow at the top left (`accent-100` fading to
  transparent), so the page is lit, not flat.
- Grain: an SVG `feTurbulence` noise pattern, inlined as a `data:` URI in
  `index.css` (no image file, no network), drawn on a fixed `body::before`
  layer behind all content at low opacity. Cards are opaque, so the grain only
  shows on the page itself, like paper.

## 11. Header

Sticky, 64px, full width, `bg-card/80` with `backdrop-blur` (CSS only) so the
page shows through softly while scrolling, bottom border `stone-200`.
Left: a 32px teal logo mark with an inner highlight and the StockPilot
wordmark. Center-left: the Screen/Watchlist segmented control (a `stone-100`
track; the active tab is a white elevated pill with `shadow-e1` and
`accent-700` text). Right: the offline demo badge (warning style) when the
server is in demo mode.

## 12. Cards

- **Card:** `bg-card border border-stone-200 rounded-2xl shadow-e1`.
- **Hero card (QueryBox) uses a double bezel:** an outer shell
  (`rounded-[1.75rem] p-1.5`, a soft teal-to-stone gradient, a teal hairline
  ring, `shadow-e2`) holding an inner core (`rounded-[1.375rem] bg-card`, white
  top highlight). It is the only double-bezel card, which is what makes it the
  most prominent thing on the page.
- **Inner panel** (inside a card): `bg-stone-50 border border-stone-200 rounded-xl`.
- No cards inside cards, except inner panels and preset tiles.

## 13. Table

- In a card; below `xl` it keeps a minimum width and scrolls sideways inside
  the card (the page body itself never scrolls sideways).
- **Header row: `bg-accent-900`, white text**, 44px, `text-label`. Sort
  buttons are white at 80% opacity, full white when sorted. Every sortable
  column shows an arrow: a faint up/down pair (white at 45%) when unsorted, a
  single `accent-300` arrow when sorted. The "?" glossary buttons inherit the
  header's text color.
- Rows: 52px, hairline `stone-200` dividers, **alternating tint** (`stone-50`
  on even rows, barely visible), hover `accent-100` at 40%, compare-selected
  rows `accent-100` at 70% plus a 3px teal inset bar on the left edge.
- **Ticker:** Geist Mono, `text-ticker`, semibold, `stone-900`.
- **Price:** right-aligned, semibold, `stone-900`. Other numbers:
  right-aligned `stone-700`, `tabular-nums`. Name and sector: `stone-600`.
- `.NS` is hidden in every displayed ticker (`displayTicker()` in
  `format.ts`); the data keeps it.
- Footer inside the card: "Showing X-Y of Z" left, Previous/Next right.

## 14. Chips

- **Choice chip** (FilterPanel sectors and market-cap buckets): a real
  checkbox, visually hidden, with a styled label. 36px, `rounded-full`,
  `px-3.5`, `text-body`. **Off: outlined** (white, `border-stone-300`,
  `stone-700` text, `shadow-e1`). **On: filled accent** (`bg-accent-600`, white
  text, a leading check icon).
- **Applied-filter chip** (FilterChips): 36px white pill, `border-stone-300`,
  `shadow-e1`. The **field name in muted text** (`stone-500`, `text-label`),
  the **value in bold** (`stone-900`, semibold), then an always-visible 28px
  round remove button (`bg-stone-100`, hover `error-soft` + `error`).
- Badges (tier, demo mode, sector): 24px, `rounded-full`, `text-label`, always
  with a leading icon when they carry state.

## 15. Buttons and inputs

- **Primary button:** `bg-accent-600 text-white hover:bg-accent-700`, 40px,
  `rounded-xl`, `shadow-e1`, `active:scale-[0.98]`.
- **Hero Ask button:** primary, 44px, with its trailing arrow nested in its
  own round `white/15` well that nudges right on hover.
- **Secondary button:** white, `border-stone-300`, `stone-800` text,
  `shadow-e1`, hover `stone-50`.
- **Icon button:** square 32 to 36px, `rounded-xl`, `stone-500`, hover
  `stone-100` + `stone-900`. Minimum hit area 24px everywhere.
- **Input:** 44px, white (elevated), `border-stone-400`, `rounded-xl`,
  `shadow-e1`; hover `border-stone-500`; focus `border-accent-500` plus the
  focus ring. Number inputs hide the browser spinners (CSS in `index.css`).
  Units sit inside the input on the right ("%" on profit margin). The P/E
  range pair is joined by a "to" separator.
- Disabled: `opacity-40`, no hover change, `cursor-not-allowed`.

## 16. Focus ring

One global rule: `:focus-visible { outline: 2px solid accent-600; outline-offset: 2px }`.
On dark surfaces (the table header, the compare bar) the ring switches to
white or `accent-300` so it stays visible. Outlines (not box-shadow rings)
survive `overflow: hidden` and Windows High Contrast mode.

## 17. States

- **Loading:** a skeleton the same shape as the final layout (the table
  skeleton even has the dark header), with a soft **CSS shimmer** sweeping
  across `stone-100` blocks on the card surface. The shimmer is a CSS
  animation (not anime.js) and stops under `prefers-reduced-motion`.
- **Refreshing:** the current table dims to 60% with `aria-busy`, and an
  "Updating" badge appears in a reserved slot, so nothing shifts.
- **Empty:** icon in an `accent-100` disc, a real heading, a one-line hint, and
  a primary action where one exists ("Clear all filters").
- **Error:** `error-soft` panel with an icon in a white disc, a heading, the
  message in `error`, a next step, and Retry where the caller supports it.

## 18. Motion

**anime.js** (npm package `animejs`, v4) is used for exactly four things, all in
`web/src/components/motion.ts`, and nowhere else:

| # | What | Spec |
|---|---|---|
| a | Table rows (and mobile stock cards) animate in on each data load | fade from 0 + 4px slide up, 180ms each, 20ms stagger |
| b | Stock price counts up when the StockDetail drawer opens | from 0 to the price, 700ms, ease-out |
| c | FilterChips animate in when added and out when removed | scale 0.85 to 1 + fade, 120ms |
| d | QueryBox results panel slides down when results appear | height 0 to natural height + fade, 200ms |

**Every one checks `prefers-reduced-motion: reduce` first and, if set, shows
the final state instantly** (rows fully visible, the final price, chips added
or removed at once, the results panel at full height).

CSS-only motion: `transition-colors`/`transition-[opacity,transform]` on
hover and focus (150ms), the drawer's entrance via `@starting-style` (200ms),
and the skeleton shimmer. All three are disabled under reduced motion. No
scroll-triggered animation, nothing animates on every keypress.

## 19. Disclaimer

"Educational tool, not financial advice" is a real note on every page: a
rounded inner-panel strip at the top of the content, under the header, with an
info icon in a teal well, a bold first sentence, and one plain sentence about
the data. `role="note"`.

## 20. Charts

- **Sector chart:** horizontal bars in `chart-1`, 18px thick, fully rounded
  data-ends, value labelled at each bar's tip in `stone-700`, sector names in
  `stone-600` at 12px. Sits in its card with `p-4 sm:p-6` breathing room.
- **Price history (drawer):** fills its card edge to edge (no inner padding;
  the price axis sits inside the plot), a 2.5px `accent-600` line over a teal
  gradient fill fading to transparent, hairline `stone-200` grid.
- **Compare:** 2.5px lines in `chart-1..3`, and a solid `stone-400` baseline
  at 100 so "above/below where it started" is visible at a glance.
- Tooltips: white elevated, `stone-200` border, 12px radius, `shadow-e2`,
  every series named.
- Every chart has a text summary for screen readers (`role="img"`).

## 21. StockDetail drawer

Elevated white panel with `shadow-e3`. The **price is the hero**: `text-display`,
colored `gain` or `loss` by the 1-month change (neutral when there is no
change data), counting up on open. Next to it, a change chip with a sign, an
arrow and the visible label **"1M"**, so the color has a stated meaning. The
1-month change is computed in the browser by `change1mPercent()` in
`stockMetrics.ts`, which mirrors the server's own `change1m` rule (skip null
closes, compare the latest close with the close four weeks earlier). Below:
the edge-to-edge chart, then a tight **2x3 grid** of metric tiles: Market
Cap, P/E, Debt/Equity, Profit Margin, 1M Change, Sector.

## 22. Mobile (375px)

- Every card keeps `p-4` padding; nothing is clipped; the page body never
  scrolls sideways (the table's own sideways scroll lives inside its card).
- Stock cards: ticker (mono) + name on the left, star on the right; price as
  the largest number with the sector badge; a 2x2 metric grid with labels
  above values; a labeled Compare chip.
- The compare bar sticks to the bottom of the viewport.
- Tap targets at least 32px.

## 23. Missing values

Always the text `n/a` in `stone-500`. Never blank, never `NaN`, never an em dash.
