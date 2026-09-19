import { z, ZodType } from "zod";

export interface Page<T> {
  items: T[];
  hasMore: boolean;
}

/** Builds the `?limit=&offset=` query string for a paged list endpoint. */
export function pageQuery(page?: { limit?: number; offset?: number }): string {
  if (!page) return "";
  const params = new URLSearchParams();
  if (page.limit !== undefined) params.set("limit", String(page.limit));
  if (page.offset !== undefined) params.set("offset", String(page.offset));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** Zod schema for the {items, hasMore} envelope every paged endpoint returns. */
export function pageSchema<T>(item: ZodType<T>): ZodType<Page<T>> {
  return z.object({ items: z.array(item), hasMore: z.boolean() });
}
