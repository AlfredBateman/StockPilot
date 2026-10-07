# API

All routes are mounted in `server/src/app.ts`. Every response is JSON, and (with one exception noted below) every successful response is shaped `{ "data": ... }` and every error response `{ "error": "<message>" }`. There is no authentication — this is a single-user, offline-first demo.

The server never talks to a live market data source at request time; every route below reads the same in-memory snapshot loaded once from `data/stocks.json` (`server/src/data/loadStocks.ts`), except `/api/parse`, which may make an outbound network call to an LLM provider (see [AI tier flow in the README](../README.md#ai-tier-flow)).

---

## `GET /api/health`

Reports whether the server is up and whether it's running in demo mode.

**Response `200`**
```json
{ "data": { "status": "ok", "demoMode": false } }
```
`demoMode` is `true` only when the server's `DEMO_MODE` environment variable is exactly the string `"true"`.

---

## `GET /api/stocks/:ticker`

Looks up one stock by ticker (case-insensitive, whitespace-trimmed).

**Response `200`**
```json
{
  "data": {
    "ticker": "RELIANCE.NS",
    "name": "Reliance Industries Limited",
    "sector": "Energy",
    "price": 2993.5,
    "marketCap": 4259670917120,
    "pe": 51.9,
    "debtToEquity": 1.1956,
    "profitMargin": 0.0655,
    "weeklyCloses": [{ "date": "2025-09-22", "close": 2543.7 }, "... ~52 weekly bars, oldest first"]
  }
}
```
Any field except `ticker` and `weeklyCloses` may be `null` if Yahoo Finance had no value for it.

**Response `404`** — no stock matches that ticker:
```json
{ "error": "No stock found for ticker \"NOPE.NS\"" }
```

**Response `500`** — the snapshot file couldn't be loaded/parsed:
```json
{ "error": "<error message>" }
```

---

## `POST /api/screen`

The one endpoint that answers "which stocks match this?" — filters, then searches, then sorts, then paginates, in that order. **Filtering logic runs only on the server.**

**Request body** (all fields optional; an empty body `{}` is valid and returns page 1 of everything):
```json
{
  "filters": [
    { "field": "sector", "op": "eq", "value": "Technology" },
    { "field": "pe", "op": "lt", "value": 20 },
    { "field": "marketCapBucket", "op": "in", "value": ["Large", "Mid"] },
    { "field": "profitMargin", "op": "between", "value": [0.05, 0.2] }
  ],
  "search": "bank",
  "sort": { "field": "pe", "direction": "asc" },
  "page": 1,
  "pageSize": 25
}
```

**Filter contract** (`server/src/engine/filterSpec.ts`, the single FilterSpec schema shared by manual filters, presets, and the LLM's output):

| Field | Kind | Allowed `op` |
| --- | --- | --- |
| `sector` | text | `eq`, `in` |
| `marketCapBucket` (`"Large"` \| `"Mid"` \| `"Small"`) | text | `eq`, `in` |
| `pe` | number | `eq`, `in`, `lt`, `gt`, `between` |
| `debtToEquity` | number (ratio — `1` = debt equals equity; `null` for banks/financials) | `eq`, `in`, `lt`, `gt`, `between` |
| `profitMargin` | number (fraction — 0.1 = 10%) | `eq`, `in`, `lt`, `gt`, `between` |
| `change1m` | number (percent — 5 = +5%) | `eq`, `in`, `lt`, `gt`, `between` |

Filters are ANDed together. A stock whose value for a filtered field is `null` never matches that filter (a missing P/E is not the same as a P/E of 0). Body validation is `strictObject` — an unknown key (e.g. a typo like `pagesize`) is a `400`, not silently ignored. `sort.field` may additionally be `ticker` or `name` (not filterable, but sortable); `marketCapBucket` is filterable but deliberately not sortable (sorting by a bucket name is ambiguous — sort by `marketCap` instead, which isn't itself filterable).

**Response `200`**
```json
{
  "data": {
    "items": ["... array of Stock objects, same shape as GET /api/stocks/:ticker ..."],
    "total": 47,
    "asOf": "2026-09-22T04:48:46.527Z"
  }
}
```
`total` counts everything that matched (for pagination), not just the returned page. `asOf` is the snapshot's own timestamp, included so the client can show "data as of …" without a second request.

**Response `400`** — invalid body:
```json
{ "error": "filters.0.value: Field \"sector\" holds text, but got the number 5" }
```

**Response `500`** — snapshot failed to load.

---

## `GET /api/sectors`

Returns the distinct, alphabetically sorted list of sectors actually present in the snapshot (so the UI's sector checkboxes can never drift out of step with the data).

**Response `200`**
```json
{ "data": ["Basic Materials", "Communication Services", "Consumer Cyclical", "..."] }
```

**Response `500`** — snapshot failed to load.

---

## `POST /api/parse`

Turns free text into a `FilterSpec`, or (through the LLM tier) into a short educational answer. **Deliberately never validates the request body and always returns `200`**: the entire point of this endpoint is graceful degradation on arbitrary/gibberish text, never a `400` for "didn't understand you." A missing or non-string `query` is treated as `""`, and only the first 200 characters are read.

**Request body**
```json
{ "query": "chep profitable midcaps that fell this month" }
```

**Response `200`** (always)
```json
{
  "data": {
    "filters": [
      { "field": "pe", "op": "lt", "value": 20 },
      { "field": "profitMargin", "op": "gt", "value": 0 },
      { "field": "marketCapBucket", "op": "eq", "value": "Mid" },
      { "field": "change1m", "op": "lt", "value": 0 }
    ],
    "notes": [
      "cheap = P/E below 20",
      "profitable = profit margin above 0%",
      "midcap = Mid market-cap bucket",
      "fell this month = 1-month change below 0%"
    ],
    "unmatched": [],
    "tier": "rules",
    "intent": "filter",
    "answer": null,
    "correctedQuery": "cheap profitable midcaps that fell this month",
    "notice": null,
    "suggestions": []
  }
}
```
- `filters`: same `FilterSpec` shape `/api/screen` accepts; can be fed straight into it. Empty for a question, advice or off-topic reply.
- `notes`: one plain-language line per filter (the rule parser's vocabulary note, or for an LLM answer a line generated from the filter itself, so notes always describe the filters actually returned).
- `unmatched`: leftover words nothing understood, after stripping stopwords.
- `tier`: which source produced the result: `"rules"` (offline dictionary), `"llm"` (cloud model), or `"cache"` (a saved model answer for this exact query, re-served without a network call).
- `intent`: `"filter"` (a screening request), `"question"` (e.g. "what is P/E"), `"advice"` (e.g. "should I buy X"), or `"offtopic"`. Only the LLM tier can return anything other than `"filter"`.
- `answer`: plain text (at most 3 sentences, tags stripped) for the three non-filter intents, else `null`. Advice always ends with "This is educational, not financial advice."; off-topic always ends with a line pointing back to screening. Both lines are added by the server, not the model.
- `correctedQuery`: the query after offline typo fixes ("Showing results for ..."), or `null` when nothing was fixed.
- `notice`: a one-line status, e.g. "AI helper is resting, showing keyword matching only." when the LLM was needed but is rate-limited, capped, not configured, in DEMO_MODE, or failing. `null` otherwise.
- `suggestions`: when the filters match zero stocks, up to two `{label, filters}` chips such as "Dropping 'low debt' gives 14 stocks", plus at most one "Did you mean 'Energy'? 7 stocks". Computed by the server on the real data, never by the LLM; each carries the full `FilterSpec` to apply.

Typo fixing and the rule parser always run first. The LLM is only called when words are left over or no filter was found, at most 10 times a minute per IP and `LLM_DAILY_CAP` (default 300) times a day in total. See the README's [AI tier flow](../README.md#ai-tier-flow) for the exact order and timeouts.
