// Shapes shared by the shore service, the applier, the routes and (Phase 4) the
// ship engine. Everything on the wire is plain JSON.
//
// Whole rows travel as `to_jsonb(row)` objects keyed by SQL column name, with
// every value as Postgres wrote it (timestamps as text, bigints as strings). They
// never pass through a JS Date, so the server's time zone cannot change a value.

export interface WireFieldLog {
  logUuid: string;
  instanceId: string;
  tableName: string;
  rowUuid: string;
  fieldName: string;
  op: "I" | "U" | "D";
  oldValue: string | null;
  newValue: string | null;
  vesselId: string | null;
  // ISO timestamp with milliseconds and a zone.
  changedAt: string;
  changedBy: string | null;
}

export type WireRow = Record<string, unknown>;
export type WireRows = Record<string, WireRow[]>;

// The ship a protocol call comes from, as registered on the office.
export interface ShipIdentity {
  instanceId: string;
  vesselUuid: string;
}

export interface ApplyContext {
  // The instance applying the change (receiver) and the one that sent it.
  receiverInstanceId: string;
  senderInstanceId: string;
  batchId: string | null;
  // The one vessel the sender may write. When set, an existing row of any other
  // vessel is left alone, even if the sender names its uuid.
  vesselScope?: string;
}

export interface TableApplyCounts {
  applied: number;
  // Already there, or the receiver's copy is newer: nothing to do.
  skipped: number;
  // Not accepted: wrong scope, wrong category, bad row.
  rejected: number;
  failed: number;
}

// The sender's uuid for a row and the uuid of the row the receiver kept for it.
export interface RowAlias {
  table: string;
  aliasUuid: string;
  canonicalUuid: string;
}

export interface RowsApplyResult {
  counts: TableApplyCounts;
  aliases: RowAlias[];
  // Rows that actually changed the receiver, for recompute and the D3 reopen:
  // [vesselId, monthValue] pairs where the table has a month column.
  changed: Array<{ table: string; rowUuid: string }>;
  errors: Array<{ rowUuid: string; error: string }>;
}

export interface FieldLogApplyResult {
  // Logs the sender may now mark synced: applied, or skipped as already applied,
  // or rejected for good (so they are not retried forever).
  acceptedLogUuids: string[];
  rejected: Array<{ logUuid: string; reason: string }>;
  // Logs that threw: not acknowledged, the sender retries them.
  failed: Array<{ logUuid: string; error: string }>;
  // Rows an update log needs but the receiver does not have. The sender must
  // send the whole row (self-heal).
  missingRows: Array<{ table: string; rowUuid: string }>;
  conflicts: number;
  applied: number;
  changed: Array<{ table: string; rowUuid: string }>;
  aliases: RowAlias[];
}

export const RECEIVER_RESOLUTIONS = ["local_kept", "incoming_applied", "unique_key", "merged"] as const;
