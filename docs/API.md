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
    "debtToEquity": 119.56,
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
| `debtToEquity` | number | `eq`, `in`, `lt`, `gt`, `between` |
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

Turns free text into a `FilterSpec`. **Deliberately never validates the request body and always returns `200`** — the entire point of this endpoint is graceful degradation on arbitrary/gibberish text, never a `400` for "didn't understand you." A missing or non-string `query` is treated as `""`.

**Request body**
```json
{ "query": "cheap profitable midcaps that fell this month" }
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
    "tier": "rules"
  }
}
```
- `filters` — same `FilterSpec` shape `/api/screen` accepts; can be fed straight into it.
- `notes` — one plain-language line per matched term (always from the offline rule parser's own vocabulary, even when a different tier answered — see below).
- `unmatched` — leftover words the rule parser didn't recognize, after stripping stopwords.
- `tier` — which source actually produced `filters`: `"rules"` (offline dictionary), `"llm"` (cloud model), `"ollama"` (local model), or `"cache"` (a previously saved model answer for this exact query, re-served without a new network call).

The rule parser always runs first regardless of tier (its `notes`/`unmatched` are the only explanation available), and its `filters` are what's returned whenever no higher tier answers. See the README's [AI tier flow](../README.md#ai-tier-flow) for the exact fallback order and timeouts.
