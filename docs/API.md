# API

All routes are mounted in `server/src/app.ts`. Every response is JSON, and (with one exception noted below) every successful response is shaped `{ "data": ... }` and every error response `{ "error": "<message>" }`. There is no authentication — this is a single-user, offline-first demo.

The server never calls Yahoo at request time. Every route below reads the same end-of-day snapshot through `loadStocks()` (`server/src/data/loadStocks.ts`), which reads MongoDB first (kept in memory for 10 minutes, then read again) and falls back to the committed `data/stocks.json` if MongoDB is unreachable or empty. With `DEMO_MODE=true` it reads only the file and makes no network calls. The snapshot is refreshed by the weekday GitHub Actions ingest, so the data is end of day, not live. The one route that may make an outbound call is `/api/parse`, which can call an LLM provider, except `/api/parse`, which may make an outbound network call to an LLM provider (see [AI tier flow in the README](../README.md#ai-tier-flow)).

---

## `GET /api/health`

Reports whether the server is up, where its stock data came from, and whether the AI helper is set up.

**Response `200`**
```json
{
  "data": {
    "status": "ok",
    "demoMode": false,
    "dataSource": "mongo",
    "asOf": "2026-10-19T10:20:55.445Z",
    "llmConfigured": true,
    "llmProvider": "nvidia",
    "llmLastError": null,
    "llmLastErrorAt": null
  }
}
```
- `demoMode` is `true` only when the server's `DEMO_MODE` environment variable is exactly the string `"true"`.
- `dataSource` is `"mongo"` or `"file"`, and `asOf` is when that snapshot was taken. If the data cannot be loaded at all, both are `null` and the route still answers `200`.
- `llmConfigured` and `llmProvider` say whether an LLM key is set and which provider is chosen (the name only, never the key).
- `llmLastError` is the category of the AI helper's most recent failure (`not_configured`, `timeout`, `network_error`, `http_<status>`, `bad_json`, `validation_failed`, `rate_capped_ip` or `rate_capped_daily`), or `null` after a good answer; `llmLastErrorAt` is when it happened. They are kept in memory, so they reset when the server restarts. The prompt, the query and the provider's reply are never included.

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
    "price": 1202,
    "marketCap": 16266032054272,
    "pe": 21.767475,
    "debtToEquity": 0.46278,
    "profitMargin": 0.066149995,
    "weeklyCloses": [{ "date": "2025-10-20", "close": 1451.6 }, "... 54 weekly closes in all, oldest first"],
    "high52w": 1592.3,
    "low52w": 1167.7,
    "belowHigh52w": 24.5,
    "aboveLow52w": 2.9,
    "change3m": -5.9,
    "change6m": -9.5,
    "change1y": -17.2,
    "readings": [
      "P/E 21.8: between 20 and 40, so StockPilot calls it neither cheap nor expensive. Investors pay ₹22 for every ₹1 of yearly profit.",
      "Debt/Equity 0.5×: below 0.5×, which StockPilot calls low debt. It owes about ₹0.46 for every ₹1 of its owners’ money.",
      "... one line each for profit margin, market cap, 1-month change, 52-week range, then 3-month, 6-month and 1-year change"
    ]
  }
}
```
Any field except `ticker` and `weeklyCloses` may be `null` if Yahoo Finance had no value for it.

**Price-history fields** (`high52w` to `change1y`) are worked out on the server from the stored `weeklyCloses` on every response; they are never stored. They use weekly closing prices, not intraday highs and lows, and are `null` when there are too few closes (fewer than 52 for the 52-week fields, not enough weeks back for a change).

| Field | Meaning |
| --- | --- |
| `high52w`, `low52w` | Highest and lowest of the last 52 weekly closes, in rupees |
| `belowHigh52w` | How far the latest close is below `high52w`, in percent (`0` = at the high) |
| `aboveLow52w` | How far the latest close is above `low52w`, in percent (`0` = at the low) |
| `change3m`, `change6m`, `change1y` | Percent change of the weekly close over about 13, 26 and 52 weeks (`5` = +5%). `change1m` is not in this list because it is only used for filtering and sorting |

**`readings`** is an array of plain-English sentences, one per metric (P/E, Debt/Equity, profit margin, market cap, 1-month change, 52-week range, then 3-month, 6-month and 1-year change). They are built on the server from fixed templates, never by an LLM, and use the same cut-offs as the search words (so "cheap" always means P/E below 20). A missing value gets an "n/a" sentence saying why. The wording describes the number and never says what to do with it.

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
| `belowHigh52w` | number (percent below the 52-week high — `0` = at the high) | `eq`, `in`, `lt`, `gt`, `between` |
| `aboveLow52w` | number (percent above the 52-week low — `0` = at the low) | `eq`, `in`, `lt`, `gt`, `between` |
| `change3m`, `change6m`, `change1y` | number (percent change over 13, 26 and 52 weekly closes) | `eq`, `in`, `lt`, `gt`, `between` |

The last four rows are the price-history fields; they are worked out from the stored weekly closes (see `GET /api/stocks/:ticker`), so they are `null` for a stock with too little history and then never match.

**`search`** is a text filter on company name and ticker, ignoring case, applied after the filters. It is at most 100 characters. A comma separates alternatives and any one of them may match: `"infosys, wipro"` finds both companies, and `"tata"` finds every name or ticker containing "tata". Spaces inside a term stay part of the term (`"tata motors"`). An empty search keeps everything.

Filters are ANDed together. A stock whose value for a filtered field is `null` never matches that filter (a missing P/E is not the same as a P/E of 0). Body validation is `strictObject` — an unknown key (e.g. a typo like `pagesize`) is a `400`, not silently ignored. `sort.field` may be any filterable field except `marketCapBucket`, plus `ticker`, `name`, `price` and `marketCap` (not filterable); `marketCapBucket` is filterable but deliberately not sortable (sorting by a bucket name is ambiguous — sort by `marketCap` instead, which isn't itself filterable).

**Response `200`** (shown for filters Energy, P/E below 25 and 1-year change below 0, with `search` set to `"reliance"`)
```json
{
  "data": {
    "items": [
      {
        "ticker": "RELIANCE.NS",
        "name": "Reliance Industries Limited",
        "sector": "Energy",
        "price": 1202,
        "marketCap": 16266032054272,
        "pe": 21.767475,
        "debtToEquity": 0.46278,
        "profitMargin": 0.066149995,
        "weeklyCloses": ["... same as GET /api/stocks/:ticker ..."],
        "high52w": 1592.3,
        "low52w": 1167.7,
        "belowHigh52w": 24.5,
        "aboveLow52w": 2.9,
        "change3m": -5.9,
        "change6m": -9.5,
        "change1y": -17.2,
        "reasons": ["Sector Energy", "P/E 21.8, below 25", "1-year change -17.2%, below 0% (fell over 1 year)", "Name or ticker matches \"reliance\""]
      }
    ],
    "total": 1,
    "asOf": "2026-10-19T10:20:55.445Z"
  }
}
```
Each item is a Stock as in `GET /api/stocks/:ticker`, with the same price-history fields, but with `reasons` instead of `readings`.

**`reasons`** says why this stock is in the result: one sentence per active filter, in the order the filters were sent, then one for the name search. Each sentence gives the stock's own value and the rule it passed (`"P/E 21.8, below 25"`), and adds the search word when the filter came from one (`(fell over 1 year)`). They are built on the server from fixed templates, never by an LLM. `reasons` is an empty array when the request has no filters and no search.

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
    "search": null,
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
- `search`: a company-name search to send as `search` to `/api/screen`, or `null` when the query named no company. After the rule parser, the words it did not use are checked against the company names and tickers in the snapshot (with a strict one-or-two-letter typo allowance, so "infosis" finds Infosys), so `"tata stocks"` gives `"tata"` and `"infosys and wipro"` gives `"infosys, wipro"`. "companies like infosys" (or "similar to") gives a `sector` filter for Infosys's sector and nothing more, with a note saying so. Words that are only part of a company name, such as "india", "indian", "limited" or "bank", never start a name search, and "state" and "united" only count together with another leftover word (so "state bank of india" works, but "state" alone does not). Generic name words ("india", "limited", "ltd", "company" and similar) left over beside a filter or a name do not count as unrecognised words. When filters or a name were found and no other words are left over, neither the cache nor the LLM is used.
- `tier`: which source produced the result: `"rules"` (offline dictionary), `"llm"` (cloud model), or `"cache"` (a saved model answer for this exact query, re-served without a network call).
- `intent`: `"filter"` (a screening request), `"question"` (e.g. "what is P/E"), `"advice"` (e.g. "should I buy X"), or `"offtopic"`. Only the LLM tier can return anything other than `"filter"`.
- `answer`: plain text (at most 3 sentences, tags stripped) for the three non-filter intents, else `null`. Advice always ends with "This is educational, not financial advice."; off-topic always ends with a line pointing back to screening. Both lines are added by the server, not the model.
- `correctedQuery`: the query after offline typo fixes ("Showing results for ..."), or `null` when nothing was fixed.
- `notice`: a one-line status, e.g. "AI helper is resting, showing keyword matching only." when the LLM was needed but is rate-limited, capped, not configured, in DEMO_MODE, or failing. `null` otherwise.
- `suggestions`: when the filters match zero stocks, up to two `{label, filters}` chips such as "Dropping 'low debt' gives 14 stocks", plus at most one "Did you mean 'Energy'? 7 stocks". Computed by the server on the real data (within the companies in `search`, if any), never by the LLM; each carries the full `FilterSpec` to apply.

Typo fixing and the rule parser always run first. The LLM is only called when words are left over or neither a filter nor a company name was found, at most 10 times a minute per IP and `LLM_DAILY_CAP` (default 300) times a day in total. See the README's [AI tier flow](../README.md#ai-tier-flow) for the exact order and timeouts.
