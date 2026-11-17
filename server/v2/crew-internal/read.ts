import { sql } from "drizzle-orm";
import { historyFor, InternalError, tableFor, type Resource } from "./access";

// Removal metadata is public within the section. Wording, assignee, notes and
// historical snapshots are not returned at all without Delete after removal.
export function present(row: any, canDelete: boolean) {
  if (row.removed_at && !canDelete) return {
    entry_uuid:row.entry_uuid,crew_uuid:row.crew_uuid,revision:row.revision,
    removed_at:row.removed_at,removed_by:row.removed_by,removal_reason:row.removal_reason,
  };
  return row;
}
export async function readEntry(db: any, resource: Resource, crewUuid: string, entryUuid: string, lock=false) {
  const rows = (await db.execute(sql`SELECT *,due_date::text AS due_date FROM ${tableFor(resource)}
    WHERE crew_uuid=${crewUuid} AND entry_uuid=${entryUuid} ${lock ? sql`FOR UPDATE` : sql``}`)).rows;
  if (rows.length !== 1) throw new InternalError(404,"This internal entry is not available.");
  return rows[0];
}
export async function listEntries(db: any,resource: Resource,crewUuid: string,canDelete: boolean) {
  const rows = (await db.execute(sql`SELECT *,due_date::text AS due_date,
    (status='Open' AND due_date < (now() AT TIME ZONE 'UTC')::date) AS overdue
    FROM ${tableFor(resource)} WHERE crew_uuid=${crewUuid} ORDER BY created_at,entry_uuid`)).rows;
  return rows.map((row: any)=>present(row,canDelete));
}
export async function history(db: any,resource: Resource,crewUuid: string,entryUuid: string,canDelete: boolean) {
  // Lock/read the current parent under the same transaction as the history to
  // prevent a concurrent removal revealing an earlier unredacted snapshot.
  return db.transaction(async (tx: any)=>{
    const entry = await readEntry(tx,resource,crewUuid,entryUuid,true);
    if (entry.removed_at && !canDelete)
      throw new InternalError(403,"You need Delete permission to read removed content and its history.");
    return (await tx.execute(sql`SELECT * FROM ${historyFor(resource)}
      WHERE crew_uuid=${crewUuid} AND entry_uuid=${entryUuid} ORDER BY revision`)).rows;
  });
}
