// Write helpers that report every change to the sync engine (SYN-02).
//
// A repository write goes through these so the old row is read, the write is
// done and captureChange() is called on the same transaction. A write that
// bypassed this would never be sent to the other side, so repositories must
// not call db.insert/update directly (tests/unit/sync-capture-guard.test.ts).

import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { captureChange } from "./changeCapture";

type Row = Record<string, unknown>;

// Runs fn on the caller's transaction, or opens one, so a write and its capture
// always commit or roll back together.
export async function inTx<T>(tx: any, fn: (db: any) => Promise<T>): Promise<T> {
  return tx ? fn(tx) : getDb().transaction(fn);
}

// The row as it is now, locked for the rest of the transaction.
export async function lockByUuid(db: any, table: any, uuidKey: string, rowUuid: string): Promise<Row | undefined> {
  const [row] = await db.select().from(table).where(eq(table[uuidKey], rowUuid)).for("update");
  return row;
}

export function actorOf(data: unknown): string | null {
  const d = (data ?? {}) as Row;
  return ((d.updatedByUuid ?? d.createdByUuid ?? null) as string | null) || null;
}

// Insert one row with a generated uuid and capture it as an insert.
export async function capturedInsert<T = any>(
  tx: any, table: any, uuidKey: string, values: Row, actorUuid?: string | null,
): Promise<T> {
  return inTx(tx, async (db) => {
    const [row] = await db.insert(table).values(values).returning();
    await captureChange(db, {
      table, rowUuid: row[uuidKey], oldRow: null, newRow: row, actorUuid: actorUuid ?? actorOf(values),
    });
    return row as T;
  });
}

// Update one row by uuid. `extraWhere` narrows the update (e.g. not deleted).
// Returns the new row, or undefined when no row matched (nothing is captured).
export async function capturedUpdate<T = any>(
  tx: any, table: any, uuidKey: string, rowUuid: string, set: Row,
  actorUuid?: string | null, extraWhere?: any,
): Promise<T | undefined> {
  return inTx(tx, async (db) => {
    const old = await lockByUuid(db, table, uuidKey, rowUuid);
    const where = extraWhere ? and(eq(table[uuidKey], rowUuid), extraWhere) : eq(table[uuidKey], rowUuid);
    const [row] = await db.update(table).set(set).where(where).returning();
    await captureChange(db, {
      table, rowUuid, oldRow: old ?? null, newRow: row, actorUuid: actorUuid ?? actorOf(set),
    });
    return row as T | undefined;
  });
}
