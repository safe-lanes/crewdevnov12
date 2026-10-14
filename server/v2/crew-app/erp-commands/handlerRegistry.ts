import { attachmentAdapters, collections, collectionSchemas, getCurrentValues, listCollectionAttachments, particularsSchema, applySingletonSection, type CollectionName } from "../crew-information/adapters";
import type { PendingRow } from "./commandRepository";
import { canonicalApproved, canonicalAuthoritative, canonicalMatches } from "./canonical";
import { commandPolicy, type CommandClassification } from "./commandPolicy";

export interface CommandHandler {
  classification: CommandClassification;
  validateTarget(pending: PendingRow): Promise<void>;
  loadAuthoritativeState(pending: PendingRow): Promise<Record<string, unknown>>;
  canonicalizeApprovedPayload(payload: Record<string, unknown>): Record<string, unknown>;
  canonicalizeAuthoritativeState(state: Record<string, unknown>, approved: Record<string, unknown>): Record<string, unknown>;
  compare(payload: Record<string, unknown>, state: Record<string, unknown>): boolean;
  execute(pending: PendingRow, payload: Record<string, unknown>): Promise<unknown>;
  reconcile(pending: PendingRow, payload: Record<string, unknown>): Promise<"matches" | "conflicts" | "missing">;
}

const collectionByCommand: Record<string, CollectionName> = {
  UPDATE_CHILDREN: "children", UPDATE_DOCUMENTS: "documents", UPDATE_VISAS: "visas",
  UPDATE_EDUCATION: "education", UPDATE_LICENSES: "licenses", UPDATE_TRAINING: "training",
  UPDATE_SEA_SERVICE: "sea-service",
};

function common(section: CollectionName): CommandHandler {
  return {
    classification: "SAFE_WITH_RECONCILIATION",
    async validateTarget(pending) {
      if (!pending.targetUuid) throw Object.assign(new Error("Target UUID required"), { code: "MISSING_TARGET" });
      const row = await collections[section].get(pending.targetUuid, pending.crewUuid);
      if (!row) throw Object.assign(new Error("Target record missing"), { code: "TARGET_NOT_FOUND" });
      if (row.crewUuid !== pending.crewUuid) throw Object.assign(new Error("Target ownership mismatch"), { code: "OWNERSHIP_MISMATCH" });
    },
    async loadAuthoritativeState(pending) {
      if (!pending.targetUuid) throw Object.assign(new Error("Target UUID required"), { code: "MISSING_TARGET" });
      return collections[section].get(pending.targetUuid, pending.crewUuid);
    },
    canonicalizeApprovedPayload: canonicalApproved,
    canonicalizeAuthoritativeState: canonicalAuthoritative,
    compare: canonicalMatches,
    execute(pending, payload) { return collections[section].update(pending.targetUuid!, payload); },
    async reconcile(pending, payload) {
      try { return canonicalMatches(payload, await this.loadAuthoritativeState(pending)) ? "matches" : "conflicts"; }
      catch (error: any) { return error?.status === 404 || /not found/i.test(error?.message ?? "") ? "missing" : "conflicts"; }
    },
  };
}

const handlers: Record<string, CommandHandler> = Object.fromEntries(
  Object.entries(collectionByCommand).map(([type, section]) => [type, common(section)]),
);

handlers.UPDATE_CREW_PARTICULARS = {
  classification: "SAFE_WITH_RECONCILIATION",
  async validateTarget(pending) {
    const row = await getCurrentValues("particulars", pending.crewUuid, null);
    if (!row || row.crewUuid !== pending.crewUuid) throw Object.assign(new Error("Crew target missing"), { code: "TARGET_NOT_FOUND" });
  },
  async loadAuthoritativeState(pending) {
    const row = await getCurrentValues("particulars", pending.crewUuid, null);
    if (!row) throw Object.assign(new Error("Crew target missing"), { code: "TARGET_NOT_FOUND" });
    return row;
  },
  canonicalizeApprovedPayload: canonicalApproved,
  canonicalizeAuthoritativeState: canonicalAuthoritative,
  compare: canonicalMatches,
  execute(pending, payload) { return applySingletonSection("particulars", pending.crewUuid, payload); },
  async reconcile(pending, payload) {
    try { return canonicalMatches(payload, await this.loadAuthoritativeState(pending)) ? "matches" : "conflicts"; }
    catch { return "missing"; }
  },
};

// A create is retry-safe only when every attempt addresses the same canonical
// primary key. Reuse the durable operation UUID as the visa UUID.
handlers.CREATE_VISAS = {
  classification: "SAFE_WITH_RECONCILIATION",
  async validateTarget(pending) {
    const existing = await collections.visas.get(pending.operationUuid, pending.crewUuid).catch(() => undefined);
    if (existing && existing.crewUuid !== pending.crewUuid) {
      throw Object.assign(new Error("Target ownership mismatch"), { code: "OWNERSHIP_MISMATCH" });
    }
  },
  async loadAuthoritativeState(pending) {
    return collections.visas.get(pending.operationUuid, pending.crewUuid).catch(() => ({}));
  },
  canonicalizeApprovedPayload: canonicalApproved,
  canonicalizeAuthoritativeState: canonicalAuthoritative,
  // Always run the idempotent ensure step so recovery can finish attachments
  // after a crash that occurred after the parent visa insert.
  compare: () => false,
  async execute(pending, payload) {
    const current = await collections.visas.get(pending.operationUuid, pending.crewUuid).catch(() => undefined);
    if (!current) await collections.visas.create(pending.crewUuid, payload, pending.operationUuid);
    else if (current.crewUuid !== pending.crewUuid || !canonicalMatches(payload, current)) {
      throw Object.assign(new Error("Deterministic visa UUID conflicts with authoritative state"), { code: "AUTHORITATIVE_CONFLICT" });
    }

    const staged: any[] = JSON.parse(pending.stagedAttachments || "[]");
    const existing = await listCollectionAttachments("visas", pending.operationUuid);
    const existingIds = new Set(existing.map(file => file.attUuid));
    for (const file of staged) {
      if (!file.attUuid || existingIds.has(file.attUuid)) continue;
      await attachmentAdapters.visas!.add(pending.operationUuid, {
        fileName: file.fileName, filePath: file.filePath, fileData: null,
        fileType: file.fileType, fileSize: file.fileSize, uploadedByUuid: pending.crewUuid,
      }, file.attUuid);
    }
  },
  async reconcile(pending, payload) {
    try {
      const current = await collections.visas.get(pending.operationUuid, pending.crewUuid);
      if (current.crewUuid !== pending.crewUuid) return "conflicts";
      if (!canonicalMatches(payload, current)) return "conflicts";
      const staged: any[] = JSON.parse(pending.stagedAttachments || "[]");
      const existing = await listCollectionAttachments("visas", pending.operationUuid);
      const existingIds = new Set(existing.map(file => file.attUuid));
      return staged.every(file => file.attUuid && existingIds.has(file.attUuid)) ? "matches" : "missing";
    } catch (error: any) {
      return /not found/i.test(error?.message ?? "") ? "missing" : "conflicts";
    }
  },
};

export function getCommandHandler(commandType: string): CommandHandler | undefined {
  const policy = commandPolicy(commandType);
  if (!policy.automated) return undefined;
  return handlers[commandType];
}

export function validateApprovedPayload(commandType: string, payload: unknown): Record<string, unknown> {
  if (commandType === "UPDATE_CREW_PARTICULARS") return particularsSchema.parse(payload) as Record<string, unknown>;
  if (commandType === "CREATE_VISAS") return collectionSchemas.visas.parse(payload) as Record<string, unknown>;
  const section = collectionByCommand[commandType];
  if (!section) throw Object.assign(new Error("No approved payload schema"), { code: "COMMAND_BLOCKED" });
  return collectionSchemas[section].parse(payload) as Record<string, unknown>;
}

export const ERP_COMMAND_HANDLERS = Object.freeze({ ...handlers });
