import { z } from "zod";
import { SORT_FIELDS } from "./fields.js";
import { FilterSpecSchema } from "./filterSpec.js";

// The contract for the POST /api/screen body. Everything is optional: an
// empty body is a valid request for the first page of the whole list.

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;
export const MAX_SEARCH_LENGTH = 100;

export const SortFieldSchema = z.enum(SORT_FIELDS);

export const SortSpecSchema = z.strictObject({
  field: SortFieldSchema,
  direction: z.enum(["asc", "desc"]).default("asc"),
});

// strictObject so an unknown key (a typo like "pagesize") is a clear 400
// instead of being silently ignored and returning the wrong page.
export const ScreenRequestSchema = z.strictObject({
  filters: FilterSpecSchema.default([]),
  search: z.string().max(MAX_SEARCH_LENGTH).default(""),
  sort: SortSpecSchema.optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});
