// The only file allowed to call fetch. Every screen talks to the server
// through the functions exported here, so there is one place to change if
// the API contract changes.
//
// The types below mirror server/src/engine (FilterSpec) and
// server/src/data/stockSchema.ts (Stock). web/ and server/ are separate
// packages with separate builds, so these can't be imported directly; they
// are kept here, by hand, in step with the server's zod contract.

export type HealthData = {
  status: string;
  demoMode: boolean;
};

export type HealthResponse = {
  data: HealthData;
};

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch("/api/health");
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.status}`);
  }
  return res.json() as Promise<HealthResponse>;
}

// --- Screening contract (mirrors server/src/engine/filterSpec.ts) ---

export const FILTER_FIELDS = [
  "sector",
  "marketCapBucket",
  "pe",
  "debtToEquity",
  "profitMargin",
  "change1m",
] as const;
export type FilterField = (typeof FILTER_FIELDS)[number];

export const MARKET_CAP_BUCKETS = ["Large", "Mid", "Small"] as const;
export type MarketCapBucket = (typeof MARKET_CAP_BUCKETS)[number];

export type Filter =
  | { field: FilterField; op: "eq"; value: string | number }
  | { field: FilterField; op: "in"; value: (string | number)[] }
  | { field: FilterField; op: "lt"; value: number }
  | { field: FilterField; op: "gt"; value: number }
  | { field: FilterField; op: "between"; value: [number, number] };

export type FilterSpec = Filter[];

export const SORT_FIELDS = [
  "ticker",
  "name",
  "sector",
  "price",
  "marketCap",
  "pe",
  "debtToEquity",
  "profitMargin",
] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export type SortDirection = "asc" | "desc";
export type SortSpec = { field: SortField; direction: SortDirection };

export type ScreenRequest = {
  filters?: FilterSpec;
  search?: string;
  sort?: SortSpec;
  page?: number;
  pageSize?: number;
};

export type WeeklyClose = { date: string; close: number | null };

export type Stock = {
  ticker: string;
  name: string | null;
  sector: string | null;
  price: number | null;
  marketCap: number | null;
  pe: number | null;
  debtToEquity: number | null;
  profitMargin: number | null;
  weeklyCloses: WeeklyClose[];
};

export type ScreenResult = {
  items: Stock[];
  total: number;
  asOf: string;
};

/** Reads the server's {error} message out of a failed response, if present. */
async function readError(res: Response, fallback: string): Promise<Error> {
  try {
    const body = (await res.json()) as { error?: string };
    return new Error(body.error ?? fallback);
  } catch {
    return new Error(fallback);
  }
}

export async function screenStocks(request: ScreenRequest): Promise<ScreenResult> {
  const res = await fetch("/api/screen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    throw await readError(res, `Screen request failed: ${res.status}`);
  }
  const body = (await res.json()) as { data: ScreenResult };
  return body.data;
}

export async function getStock(ticker: string): Promise<Stock> {
  const res = await fetch(`/api/stocks/${encodeURIComponent(ticker)}`);
  if (!res.ok) {
    throw await readError(res, `Failed to load ${ticker}: ${res.status}`);
  }
  const body = (await res.json()) as { data: Stock };
  return body.data;
}

// --- Natural-language query (mirrors server/src/nl/ruleParser.ts) ---

export type ParseTier = "rules" | "llm" | "ollama" | "cache";

export type ParseResult = {
  filters: FilterSpec;
  notes: string[];
  unmatched: string[];
  tier: ParseTier;
};

/** POST /api/parse always answers 200 (see server/src/routes/parse.ts), so there's no error path to throw here. */
export async function parseQuery(query: string): Promise<ParseResult> {
  const res = await fetch("/api/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const body = (await res.json()) as { data: ParseResult };
  return body.data;
}

export async function getSectors(): Promise<string[]> {
  const res = await fetch("/api/sectors");
  if (!res.ok) {
    throw await readError(res, `Failed to load sectors: ${res.status}`);
  }
  const body = (await res.json()) as { data: string[] };
  return body.data;
}
