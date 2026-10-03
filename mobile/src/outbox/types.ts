export const SAFE_COLLECTION_UPDATES = ["children", "documents", "visas", "education", "licenses", "training", "sea-service"] as const;

export type OutboxStatus =
  | "QUEUED"
  | "SENDING"
  | "AWAITING_CONFIRMATION"
  | "WAITING_RETRY"
  | "NEEDS_RECONCILIATION"
  | "COMPLETED"
  | "REJECTED";

export type OutboxOperation = {
  version: 1;
  localId: string;
  operationId: string;
  owner: { domain: string; crewUuid: string };
  kind: "UPDATE_SINGLETON" | "UPDATE_COLLECTION";
  section: string;
  targetUuid?: string;
  payload: Record<string, unknown>;
  fingerprint: string;
  status: OutboxStatus;
  serverStatus?: string;
  attempts: number;
  confirmationFailures: number;
  lastAttemptAt?: number;
  lastSafeErrorCode?: string;
  nextAttemptAt: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
};

export type EnqueueInput = Pick<OutboxOperation, "kind" | "section" | "targetUuid" | "payload">;
export type Owner = OutboxOperation["owner"];

export function assertSafeOperation(input: EnqueueInput): void {
  const safe = input.kind === "UPDATE_SINGLETON"
    ? input.section === "particulars" && !input.targetUuid
    : (SAFE_COLLECTION_UPDATES as readonly string[]).includes(input.section) && Boolean(input.targetUuid);
  if (!safe) throw new Error("This change requires an online connection and cannot be queued.");
}
