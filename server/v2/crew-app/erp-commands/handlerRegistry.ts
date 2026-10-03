import { collections, collectionSchemas, getCurrentValues, particularsSchema, applySingletonSection, type CollectionName } from "../crew-information/adapters";
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

export function getCommandHandler(commandType: string): CommandHandler | undefined {
  const policy = commandPolicy(commandType);
  if (!policy.automated) return undefined;
  return handlers[commandType];
}

export function validateApprovedPayload(commandType: string, payload: unknown): Record<string, unknown> {
  if (commandType === "UPDATE_CREW_PARTICULARS") return particularsSchema.parse(payload) as Record<string, unknown>;
  const section = collectionByCommand[commandType];
  if (!section) throw Object.assign(new Error("No approved payload schema"), { code: "COMMAND_BLOCKED" });
  return collectionSchemas[section].parse(payload) as Record<string, unknown>;
}

export const ERP_COMMAND_HANDLERS = Object.freeze({ ...handlers });
