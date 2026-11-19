/**
 * Approval notifications: IN-APP (always) and EMAIL (unless switched off), to the same people.
 *
 *   step-activated     → the approvers of the new step:            "Approval needed"
 *   request-completed  → the submitter:                             "Approved"
 *   request-returned   → the submitter, with the remarks:           "Returned"
 *   request-withdrawn  → the approvers who were waiting:            "Withdrawn"
 *
 * In-app rows are per person (approval_notifications_v2); nobody else sees them.
 * Emails go through Crewing's email service (SES when the shared SES variables are set,
 * otherwise the existing relay → Gmail path). APPROVAL_EMAILS_ENABLED=false stops emails only.
 *
 * Runs after the engine has committed the decision. A failure is logged and NEVER breaks or
 * blocks an approval.
 */
import type { EngineEvent, Scope } from "../approval-engine";
import { sendEmailPreferSes, logEmailEvent } from "../shared/emailService";
import { contactsForUsers } from "./roles";
import { getCrewingEngine, systemEngineCtx } from "./gateway";
import { insertApprovalNotifications, type ApprovalNotificationKind } from "./notificationsRepository";
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

async function subjectLink(scope: Scope, subjectRef: string): Promise<string | null> {
  const card = cardsByModule.get(scope.moduleId);
  try {
    return card?.subjectLink ? await card.subjectLink(scope, subjectRef) : null;
  } catch (err) {
    console.error("[approvals] subjectLink failed:", err);
    return null;
  }
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

interface Notice {
  kind: ApprovalNotificationKind;
  recipients: string[];
  requuid: string;
  nodeKey?: string;
  scope: Scope;
  subjectRef: string;
  title: string;
  lines: string[];
}

async function deliver(n: Notice): Promise<void> {
  const recipients = Array.from(new Set(n.recipients.filter(Boolean)));
  if (recipients.length === 0) return;

  // In-app first: always, independent of email.
  try {
    await insertApprovalNotifications(recipients, {
      kind: n.kind,
      requuid: n.requuid,
      nodeKey: n.nodeKey,
      scope: n.scope,
      subjectRef: n.subjectRef,
      title: n.title,
      message: n.lines.join(" "),
      link: await subjectLink(n.scope, n.subjectRef),
    });
  } catch (err) {
    console.error(`[approvals] in-app notification failed (${n.kind}):`, err);
  }

  if (!approvalEmailsEnabled()) return;
  const contacts = await contactsForUsers(recipients);
  const html = n.lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("");
  for (const userUuid of recipients) {
    const to = contacts.get(userUuid)?.email ?? null;
    if (!to) {
      logEmailEvent("WARN", "Approval email skipped: user has no email", { userUuid });
      continue;
    }
    const result = await sendEmailPreferSes([to], n.title, html);
    if (result.error) logEmailEvent("ERROR", "Approval email failed", { userUuid, channel: result.channel, error: result.error });
  }
}

async function handle(evt: EngineEvent): Promise<void> {
  switch (evt.type) {
    case "step-activated": {
      const name = await subjectName(evt.scope, evt.subjectRef);
      await deliver({
        kind: "pending", recipients: evt.approverUserIds, requuid: evt.requuid, nodeKey: evt.nodeKey,
        scope: evt.scope, subjectRef: evt.subjectRef, title: `Approval needed: ${name}`,
        lines: [`${name} is waiting for your approval in SAIL Crewing.`, "Open SAIL Crewing to approve or reject it."],
      });
      return;
    }
    case "request-completed": {
      const submitter = await submitterOf(evt.scope, evt.subjectRef, evt.requuid);
      if (!submitter) return;
      const name = await subjectName(evt.scope, evt.subjectRef);
      await deliver({
        kind: "approved", recipients: [submitter], requuid: evt.requuid,
        scope: evt.scope, subjectRef: evt.subjectRef, title: `Approved: ${name}`,
        lines: [`${name} has been approved by all approvers.`],
      });
      return;
    }
    case "request-returned": {
      const submitter = await submitterOf(evt.scope, evt.subjectRef, evt.requuid);
      if (!submitter) return;
      const name = await subjectName(evt.scope, evt.subjectRef);
      const lines = [`${name} was returned by an approver.`];
      if (evt.remarks) lines.push(`Remarks: ${evt.remarks}`);
      await deliver({
        kind: "returned", recipients: [submitter], requuid: evt.requuid,
        scope: evt.scope, subjectRef: evt.subjectRef, title: `Returned: ${name}`, lines,
      });
      return;
    }
    case "request-withdrawn": {
      const name = await subjectName(evt.scope, evt.subjectRef);
      await deliver({
        kind: "withdrawn", recipients: evt.approverUserIds, requuid: evt.requuid,
        scope: evt.scope, subjectRef: evt.subjectRef, title: `Withdrawn: ${name}`,
        lines: [`${name} was withdrawn by the sender and no longer needs your approval.`],
      });
      return;
    }
    default:
      return; // slot-decided: no notification
  }
}

/** onEvent hook for the engine. Fire-and-forget; keeps the request's tenant context. */
export function approvalEventNotifier(evt: EngineEvent): void {
  handle(evt).catch((err) => console.error(`[approvals] notification failed (${evt.type}):`, err));
}
