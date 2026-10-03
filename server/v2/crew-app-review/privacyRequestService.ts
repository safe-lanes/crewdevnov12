import crypto from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../db";
import { appCrewCredentials, appCrewErpCommands, appCrewNotifications, appCrewPendingChanges, appCrewPrivacyRequestAudits, appCrewPrivacyRequests, appCrewRefreshTokens } from "../../../shared/v2/crew-app/schema";
import { fileStorageService } from "../shared/fileStorageService";

const TERMINAL_COMMANDS = new Set(["applied", "closed", "dead_letter", "blocked", "manual_reconciliation_required", "reconciliation_required"]);
type Actor = { uuid: string; correlationId: string };

async function audit(tx: any, requestUuid: string, actor: Actor, previousStatus: string, newStatus: string, action: string, reason: string) {
  await tx.insert(appCrewPrivacyRequestAudits).values({ auditUuid: uuidv4(), requestUuid, actorUuid: actor.uuid, previousStatus, newStatus, action, reason, correlationId: actor.correlationId });
}

export async function listPrivacyRequests() {
  return getDb().select().from(appCrewPrivacyRequests).orderBy(desc(appCrewPrivacyRequests.createdAt)).limit(200);
}

export async function listPrivacyRequestAudit(requestUuid: string) {
  return getDb().select().from(appCrewPrivacyRequestAudits).where(eq(appCrewPrivacyRequestAudits.requestUuid, requestUuid)).orderBy(desc(appCrewPrivacyRequestAudits.createdAt));
}

export async function transitionPrivacyRequest(requestUuid: string, actor: Actor, action: "verify" | "approve" | "reject" | "legal_hold", reason: string, requesterMessage: string) {
  return getDb().transaction(async (tx: any) => {
    const [row] = await tx.select().from(appCrewPrivacyRequests).where(eq(appCrewPrivacyRequests.requestUuid, requestUuid)).for("update").limit(1);
    if (!row) throw Object.assign(new Error("Privacy request not found"), { status: 404 });
    const now = new Date();
    const rules = {
      verify: { from: ["submitted", "verifying"], to: "under_review", values: { identityVerifiedAt: now } },
      approve: { from: ["under_review"], to: "approved", values: { reviewedAt: now, reviewerId: actor.uuid, legalHold: false } },
      reject: { from: ["under_review"], to: "rejected", values: { reviewedAt: now, reviewerId: actor.uuid, completedAt: now } },
      legal_hold: { from: ["under_review", "approved", "in_progress"], to: "legal_hold", values: { reviewedAt: now, reviewerId: actor.uuid, legalHold: true } },
    } as const;
    const rule = rules[action];
    if (!(rule.from as readonly string[]).includes(row.status)) throw Object.assign(new Error(`Cannot ${action} a request in ${row.status}`), { status: 409 });
    await tx.update(appCrewPrivacyRequests).set({ status: rule.to, resolutionNotes: requesterMessage, ...rule.values }).where(eq(appCrewPrivacyRequests.id, row.id));
    await audit(tx, requestUuid, actor, row.status, rule.to, action === "verify" ? "identity_verified" : action, reason);
    return { ...row, status: rule.to };
  });
}

export async function executeDeletionRequest(requestUuid: string, actor: Actor, input: { erpOutcome: "deleted" | "retained" | "not_applicable"; reason: string; requesterMessage: string; evidenceReference: string }) {
  const db = getDb();
  const [request] = await db.select().from(appCrewPrivacyRequests).where(eq(appCrewPrivacyRequests.requestUuid, requestUuid)).limit(1);
  if (!request) throw Object.assign(new Error("Privacy request not found"), { status: 404 });
  if (request.requestType !== "deletion" || request.status !== "approved" || request.legalHold || !request.identityVerifiedAt) throw Object.assign(new Error("Deletion request is not approved for execution"), { status: 409 });

  const commands = await db.select({ status: appCrewErpCommands.status }).from(appCrewErpCommands).where(and(eq(appCrewErpCommands.domain, request.domain), eq(appCrewErpCommands.crewUuid, request.crewUuid)));
  if (commands.some((command) => !TERMINAL_COMMANDS.has(command.status))) throw Object.assign(new Error("Open ERP commands must be resolved before privacy execution"), { status: 409 });

  await db.transaction(async (tx: any) => {
    await tx.update(appCrewPrivacyRequests).set({ status: "in_progress", reviewerId: actor.uuid, evidenceReference: input.evidenceReference }).where(eq(appCrewPrivacyRequests.id, request.id));
    await audit(tx, requestUuid, actor, request.status, "in_progress", "execution_started", input.reason);
  });

  const pending = await db.select({ stagedAttachments: appCrewPendingChanges.stagedAttachments }).from(appCrewPendingChanges).where(and(eq(appCrewPendingChanges.domain, request.domain), eq(appCrewPendingChanges.crewUuid, request.crewUuid)));
  for (const row of pending) {
    let attachments: Array<{ filePath?: string }> = [];
    try { attachments = JSON.parse(row.stagedAttachments || "[]"); } catch { /* malformed legacy metadata is retained for office reconciliation */ }
    for (const attachment of attachments) if (attachment.filePath) await fileStorageService.deleteAttachmentForCurrentTenant(attachment.filePath);
  }

  const finalStatus = input.erpOutcome === "deleted" || input.erpOutcome === "not_applicable" ? "completed" : "partially_completed";
  await db.transaction(async (tx: any) => {
    const credentials = await tx.select({ id: appCrewCredentials.id }).from(appCrewCredentials).where(and(eq(appCrewCredentials.domain, request.domain), eq(appCrewCredentials.crewUuid, request.crewUuid)));
    const ids = credentials.map((row: any) => row.id);
    if (ids.length) await tx.delete(appCrewRefreshTokens).where(inArray(appCrewRefreshTokens.crewCredentialId, ids));
    await tx.delete(appCrewNotifications).where(and(eq(appCrewNotifications.domain, request.domain), eq(appCrewNotifications.crewUuid, request.crewUuid)));
    await tx.update(appCrewPendingChanges).set({ payload: "{}", stagedAttachments: "[]", status: "rejected", rejectionReason: "privacy_erasure" }).where(and(eq(appCrewPendingChanges.domain, request.domain), eq(appCrewPendingChanges.crewUuid, request.crewUuid)));
    await tx.update(appCrewCredentials).set({ empNo: null, mobile: null, email: null, passwordHash: crypto.randomBytes(48).toString("hex"), isActive: false, provisioningStatus: "privacy_erased", sessionVersion: sql`${appCrewCredentials.sessionVersion} + 1`, lastError: null }).where(and(eq(appCrewCredentials.domain, request.domain), eq(appCrewCredentials.crewUuid, request.crewUuid)));
    await tx.update(appCrewPrivacyRequests).set({ status: finalStatus, completedAt: new Date(), reviewerId: actor.uuid, evidenceReference: input.evidenceReference, resolutionNotes: input.requesterMessage }).where(eq(appCrewPrivacyRequests.id, request.id));
    await audit(tx, requestUuid, actor, "in_progress", finalStatus, finalStatus === "completed" ? "execution_completed" : "execution_partial", input.reason);
  });
  return { requestUuid, status: finalStatus, erpOutcome: input.erpOutcome };
}

export async function completeNonDeletionRequest(requestUuid: string, actor: Actor, input: { outcome: "completed" | "partially_completed"; reason: string; requesterMessage: string; evidenceReference: string }) {
  return getDb().transaction(async (tx: any) => {
    const [row] = await tx.select().from(appCrewPrivacyRequests).where(eq(appCrewPrivacyRequests.requestUuid, requestUuid)).for("update").limit(1);
    if (!row) throw Object.assign(new Error("Privacy request not found"), { status: 404 });
    if (row.requestType === "deletion" || row.status !== "approved" || row.legalHold || !row.identityVerifiedAt) throw Object.assign(new Error("Privacy request is not approved for completion"), { status: 409 });
    await tx.update(appCrewPrivacyRequests).set({ status: input.outcome, completedAt: new Date(), reviewerId: actor.uuid, evidenceReference: input.evidenceReference, resolutionNotes: input.requesterMessage }).where(eq(appCrewPrivacyRequests.id, row.id));
    await audit(tx, requestUuid, actor, row.status, input.outcome, input.outcome === "completed" ? "execution_completed" : "execution_partial", input.reason);
    return { requestUuid, status: input.outcome };
  });
}
