export type Page<T> = {
  items: T[];
  total: number;
};

/**
 * Cuts one page out of a list. `page` is 1-based.
 *
 * `total` is the size of the whole list, counted before slicing, so the UI can
 * say "showing 25 of 100" and work out how many pages exist. Asking for a page
 * past the end gives an empty page, not an error.
 */
export function paginate<T>(items: T[], page: number, pageSize: number): Page<T> {
  const total = items.length;
  const start = Math.max(0, (page - 1) * pageSize);
  return { items: items.slice(start, start + pageSize), total };
}
