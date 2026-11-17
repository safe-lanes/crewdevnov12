/**
 * Approval emails, sent through Crewing's own email service (SES when the shared SES variables
 * are set, otherwise the existing relay → Gmail path).
 *
 *   step-activated     → the approvers of the new step: "approval needed"
 *   request-completed  → the submitter: "approved"
 *   request-returned   → the submitter: "returned", with the remarks
 *   request-withdrawn  → the approvers who were waiting: "withdrawn"
 *
 * Runs after the engine has committed the decision. A failure is logged and NEVER breaks or
 * blocks an approval. Switch off with APPROVAL_EMAILS_ENABLED=false.
 */
import type { EngineEvent, Scope } from "../approval-engine";
import { sendEmailPreferSes, logEmailEvent } from "../shared/emailService";
import { contactsForUsers } from "./roles";
import { getCrewingEngine, systemEngineCtx } from "./gateway";
import type { CrewingApprovalCard } from "./cards/types";

let cardsByModule = new Map<string, CrewingApprovalCard>();
export function setNotifierCards(cards: CrewingApprovalCard[]): void {
  cardsByModule = new Map(cards.map((c) => [c.moduleId, c]));
}

export function approvalEmailsEnabled(): boolean {
  return (process.env.APPROVAL_EMAILS_ENABLED ?? "true").trim().toLowerCase() !== "false";
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] as string);
}

async function subjectName(scope: Scope, subjectRef: string): Promise<string> {
  const card = cardsByModule.get(scope.moduleId);
  try {
    if (card?.describeSubject) return await card.describeSubject(scope, subjectRef);
  } catch (err) {
    console.error("[approvals] describeSubject failed:", err);
  }
  const screen = card?.scopes.find((s) => s.screenId === scope.screenId && s.actionId === scope.actionId);
  return `${screen?.label ?? scope.screenId} ${subjectRef}`;
}

async function submitterOf(scope: Scope, subjectRef: string, requuid: string): Promise<string | null> {
  const engine = getCrewingEngine();
  if (!engine) return null;
  try {
    const rows = await engine.status(systemEngineCtx("notifier"), scope, subjectRef);
    return rows.find((r) => r.requuid === requuid)?.submittedBy ?? null;
  } catch {
    return null;
  }
}

async function emailUsers(userUuids: string[], subject: string, lines: string[]): Promise<void> {
  const contacts = await contactsForUsers(userUuids);
  const html = lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("");
  for (const userUuid of Array.from(new Set(userUuids))) {
    const to = contacts.get(userUuid)?.email ?? null;
    if (!to) {
      logEmailEvent("WARN", "Approval email skipped: user has no email", { userUuid });
      continue;
    }
    const result = await sendEmailPreferSes([to], subject, html);
    if (result.error) logEmailEvent("ERROR", "Approval email failed", { userUuid, channel: result.channel, error: result.error });
  }
}

async function handle(evt: EngineEvent): Promise<void> {
  switch (evt.type) {
    case "step-activated": {
      const name = await subjectName(evt.scope, evt.subjectRef);
      await emailUsers(evt.approverUserIds, `Approval needed: ${name}`, [
        `${name} is waiting for your approval in SAIL Crewing.`,
        "Open SAIL Crewing to approve or reject it.",
      ]);
      return;
    }
    case "request-completed": {
      const submitter = await submitterOf(evt.scope, evt.subjectRef, evt.requuid);
      if (!submitter) return;
      const name = await subjectName(evt.scope, evt.subjectRef);
      await emailUsers([submitter], `Approved: ${name}`, [`${name} has been approved by all approvers.`]);
      return;
    }
    case "request-returned": {
      const submitter = await submitterOf(evt.scope, evt.subjectRef, evt.requuid);
      if (!submitter) return;
      const name = await subjectName(evt.scope, evt.subjectRef);
      const lines = [`${name} was returned by an approver.`];
      if (evt.remarks) lines.push(`Remarks: ${evt.remarks}`);
      await emailUsers([submitter], `Returned: ${name}`, lines);
      return;
    }
    case "request-withdrawn": {
      const name = await subjectName(evt.scope, evt.subjectRef);
      await emailUsers(evt.approverUserIds, `Withdrawn: ${name}`, [`${name} was withdrawn by the sender and no longer needs your approval.`]);
      return;
    }
    default:
      return; // slot-decided: no email
  }
}

/** onEvent hook for the engine. Fire-and-forget; keeps the request's tenant context. */
export function approvalEventNotifier(evt: EngineEvent): void {
  if (!approvalEmailsEnabled()) return;
  handle(evt).catch((err) => console.error(`[approvals] notification failed (${evt.type}):`, err));
}
