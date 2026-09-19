export interface PageParams {
  limit: number;
  offset: number;
}

export interface PagedResult<T> {
  items: T[];
  hasMore: boolean;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/** Parses `?limit=&offset=` from a request's query, clamped to sane bounds. */
export function parsePageParams(query: Record<string, unknown>): PageParams {
  const rawLimit = Number(query.limit);
  const rawOffset = Number(query.offset);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), MAX_LIMIT) : DEFAULT_LIMIT;
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.floor(rawOffset) : 0;
  return { limit, offset };
}

/**
 * Fetches `limit + 1` rows via `fetchPage` and slices back down to `limit` —
 * tells the caller whether more rows exist without a second COUNT query.
 */
export async function paginate<T>(
  { limit, offset }: PageParams,
  fetchPage: (limit: number, offset: number) => Promise<T[]>,
): Promise<PagedResult<T>> {
  const rows = await fetchPage(limit + 1, offset);
  const hasMore = rows.length > limit;
  return { items: hasMore ? rows.slice(0, limit) : rows, hasMore };
}
