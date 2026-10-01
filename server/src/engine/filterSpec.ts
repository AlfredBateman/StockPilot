import { z } from "zod";

// FilterSpec is the single contract for screening. Manual UI filters, saved
// presets, and (later) the LLM's output all have to produce this same shape,
// and anything that fails this schema is rejected rather than guessed at.

export const FILTER_FIELDS = [
  "sector",
  "marketCapBucket",
  "pe",
  "debtToEquity",
  "profitMargin",
  "change1m",
] as const;

export const FILTER_OPS = ["eq", "in", "lt", "gt", "between"] as const;

export const MARKET_CAP_BUCKETS = ["Large", "Mid", "Small"] as const;

export const FilterFieldSchema = z.enum(FILTER_FIELDS);
export const MarketCapBucketSchema = z.enum(MARKET_CAP_BUCKETS);

export type FilterField = z.infer<typeof FilterFieldSchema>;
export type FilterOp = (typeof FILTER_OPS)[number];
export type MarketCapBucket = z.infer<typeof MarketCapBucketSchema>;

/** Which fields hold text and which hold numbers. Drives the checks below. */
export const FIELD_KINDS: Record<FilterField, "text" | "number"> = {
  sector: "text",
  marketCapBucket: "text",
  pe: "number",
  debtToEquity: "number",
  profitMargin: "number",
  change1m: "number",
};

/** Text fields can only be compared for equality — "sector < 3" is meaningless. */
const TEXT_OPS: readonly FilterOp[] = ["eq", "in"];

// The op decides the shape of `value`, so the union is discriminated on it.
// strictObject means a typo like {field, op, valeu} is a validation error
// rather than a filter that silently does nothing.
const FilterVariantSchema = z.discriminatedUnion("op", [
  z.strictObject({
    field: FilterFieldSchema,
    op: z.literal("eq"),
    value: z.union([z.string(), z.number()]),
  }),
  z.strictObject({
    field: FilterFieldSchema,
    op: z.literal("in"),
    value: z.array(z.union([z.string(), z.number()])).min(1),
  }),
  z.strictObject({ field: FilterFieldSchema, op: z.literal("lt"), value: z.number() }),
  z.strictObject({ field: FilterFieldSchema, op: z.literal("gt"), value: z.number() }),
  z.strictObject({
    field: FilterFieldSchema,
    op: z.literal("between"),
    value: z.tuple([z.number(), z.number()]),
  }),
]);

// The union checks that `value` has the right shape for the op; these checks
// add the rules that depend on which *field* was chosen.
export const FilterSchema = FilterVariantSchema.superRefine((filter, ctx) => {
  const kind = FIELD_KINDS[filter.field];

  if (kind === "text" && !TEXT_OPS.includes(filter.op)) {
    ctx.addIssue({
      code: "custom",
      path: ["op"],
      message: `Field "${filter.field}" holds text, so it only supports ${TEXT_OPS.join(" and ")}.`,
    });
    return;
  }

  const values: (string | number)[] =
    filter.op === "in" || filter.op === "between" ? [...filter.value] : [filter.value];

  for (const value of values) {
    if (kind === "text" && typeof value !== "string") {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: `Field "${filter.field}" holds text, but got the number ${value}.`,
      });
    } else if (kind === "number" && typeof value !== "number") {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: `Field "${filter.field}" holds a number, but got the text "${value}".`,
      });
    } else if (
      filter.field === "marketCapBucket" &&
      typeof value === "string" &&
      !MARKET_CAP_BUCKETS.includes(value as MarketCapBucket)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: `"${value}" is not a market cap bucket. Expected one of: ${MARKET_CAP_BUCKETS.join(", ")}.`,
      });
    }
  }

  if (filter.op === "between" && filter.value[0] > filter.value[1]) {
    ctx.addIssue({
      code: "custom",
      path: ["value"],
      message: "between expects [min, max] with min less than or equal to max.",
    });
  }
});

/** A list of filters. An empty list is valid and means "no filtering". */
export const FilterSpecSchema = z.array(FilterSchema);

export type Filter = z.infer<typeof FilterSchema>;
export type FilterSpec = z.infer<typeof FilterSpecSchema>;
