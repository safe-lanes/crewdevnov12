import { and, eq, notExists, sql } from "drizzle-orm";

/**
 * Atomic "create or update by natural key" for the Rest Hours summary tables
 * (RH-02). Replaces check-then-insert: the unique indexes decide, not a prior
 * SELECT, so two writers cannot both insert the same key.
 *
 * 1. Revive a soft-deleted row that already owns this uuid (the uuid column is
 *    unique, so it would block an insert), unless a live row holds the key.
 * 2. INSERT ... ON CONFLICT DO NOTHING (no target: it covers the unique uuid
 *    index AND the live-row partial key index; with a target, Postgres can
 *    raise the uuid violation before it reaches the target index).
 * 3. If nothing was inserted, a live row owns the key: update it. A concurrent
 *    inserter's DO NOTHING waits for the other transaction, so by now its row
 *    is visible.
 *
 * `keyColumns` are camelCase property names of the Drizzle table.
 */
export async function insertOnNaturalKey<T extends Record<string, any>>(
  db: any,
  table: any,
  opts: {
    uuidColumn: string;
    uuid: string;
    keyColumns: string[];
    values: T;
  },
): Promise<any> {
  const { uuidColumn, uuid, keyColumns, values } = opts;

  const NEVER_UPDATE = new Set([
    ...keyColumns,
    uuidColumn,
    "id",
    "createdAt",
    "createdByUuid",
    "isDeleted",
  ]);
  const updateSet: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(values)) {
    if (!NEVER_UPDATE.has(k) && v !== undefined) updateSet[k] = v;
  }

  const sameKey = keyColumns.map((c) => eq(table[c], values[c]));

  const revived = await db
    .update(table)
    .set({ ...updateSet, isDeleted: false })
    .where(
      and(
        eq(table[uuidColumn], uuid),
        eq(table.isDeleted, true),
        notExists(
          db
            .select({ one: sql`1` })
            .from(table)
            .where(and(...sameKey, eq(table.isDeleted, false))),
        ),
      ),
    )
    .returning();
  if (revived.length > 0) return revived[0];

  const inserted = await db
    .insert(table)
    .values({ ...values, [uuidColumn]: uuid })
    .onConflictDoNothing()
    .returning();
  if (inserted.length > 0) return inserted[0];

  const updated = await db
    .update(table)
    .set(updateSet)
    .where(and(...sameKey, eq(table.isDeleted, false)))
    .returning();
  if (updated.length === 0) {
    // Lost a race with a soft delete between the two statements.
    throw new Error("Rest Hours row changed while it was being saved; please retry");
  }
  return updated[0];
}
