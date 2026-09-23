import { v4 as uuidv4 } from "uuid";
import { pendingChangesRepository } from "./pendingChangesRepository";
import {
  collections,
  attachmentAdapters,
  applySingletonSection,
  isCollectionName,
  isSingletonSection,
  removeRecordAndAttachments,
  type CollectionName,
  type SingletonSection,
} from "./adapters";
import { AlertsRepository } from "../../alerts/repositories/alertsRepository";
import { crewMembersService } from "../../crew-pool/services";
import type { AppCrewPendingChange } from "../../../../shared/v2/crew-app/types";
import { notFound, httpError } from "../errors";

const alertsRepository = new AlertsRepository();
const CREW_PORTAL_SUBMISSION_ALERT_TYPE = "crew_portal_submission";

export interface Reviewer {
  uuid: string;
  name: string | null;
}

/**
 * Per-tenant flexibility knob for requirement 1 — absence of a settings row
 * means the gate is ON (the safer default for a new client). A client that
 * doesn't want the review gate just gets one settings row with the flag set
 * to false; no code change.
 */
async function isVerificationRequired(domain: string): Promise<boolean> {
  const settings = await pendingChangesRepository.getSettings(domain);
  return settings ? settings.requireOfficeVerification : true;
}

async function crewDisplayName(crewUuid: string): Promise<string> {
  try {
    const crew = await crewMembersService.getByUuid(crewUuid);
    return `${crew?.firstName ?? ""} ${crew?.familyName ?? ""}`.trim() || crewUuid;
  } catch {
    return crewUuid;
  }
}

/** Builds the office-side deep link for one pending change — straight to the Crew Portal Submissions review queue (highlighting this row), not directly into the crew record, since the entry isn't live/visible there until an office reviewer approves it. Matches the `page`/`pending` query-param convention CrewPoolModule_v2.tsx's deep-link effect already listens for. */
function crewInfoFormLink(row: AppCrewPendingChange): string {
  return `/crew-pool?page=portal-submissions&pending=${row.pendingUuid}`;
}

/** Requirement 2: every crew-portal entry raises an alert for the crewing team, via the existing generic alert engine — no separate alert system. */
async function raiseSubmissionAlert(row: AppCrewPendingChange, autoApplied: boolean): Promise<void> {
  const policies = await alertsRepository.getAlertPolicies();
  const policy = policies.find(p => p.alertType === CREW_PORTAL_SUBMISSION_ALERT_TYPE);
  if (!policy || !policy.enabled) return; // tenant has opted out of this alert type — no code change needed to support that

  const crewName = await crewDisplayName(row.crewUuid);
  const message = autoApplied
    ? `${crewName} submitted a ${row.section} entry via the crew portal (auto-published — office verification is disabled for this domain).`
    : `${crewName} submitted a ${row.section} entry via the crew portal and it is awaiting your verification.`;

  await alertsRepository.createAlertEvent({
    aeuuid: uuidv4(),
    policyUuid: policy.apuuid,
    alertType: CREW_PORTAL_SUBMISSION_ALERT_TYPE,
    priority: policy.priority,
    objectType: "crew_app_pending_change",
    objectId: row.pendingUuid,
    dedupeKey: `crew-portal-${row.pendingUuid}-${(row.updatedAt ?? row.createdAt ?? new Date()).toString()}`,
    state: autoApplied ? "auto_approved" : "pending",
    payload: JSON.stringify({
      alertMessage: message,
      crewName,
      crewId: row.crewUuid,
      section: row.section,
      action: row.action,
      link: crewInfoFormLink(row),
    }),
    createdByUuid: row.crewUuid,
    isDeleted: false,
    isSync: false,
  });
}

/** Applies a pending change's payload to the canonical crew-pool tables — the one place both crew-app auto-apply and the office review "approve" action call into. */
export async function applyPendingChange(row: AppCrewPendingChange): Promise<any> {
  const payload = JSON.parse(row.payload || "{}");

  if (isSingletonSection(row.section)) {
    return applySingletonSection(row.section as SingletonSection, row.crewUuid, payload);
  }

  if (!isCollectionName(row.section)) {
    throw httpError(`Unknown crew-app section '${row.section}'`, 422);
  }
  const section = row.section as CollectionName;
  const adapter = collections[section];

  if (row.action === "create") {
    const created = await adapter.create(row.crewUuid, payload);
    const staged: any[] = JSON.parse(row.stagedAttachments || "[]");
    const attachAdapter = attachmentAdapters[section];
    if (attachAdapter && staged.length) {
      for (const file of staged) {
        await attachAdapter.add(created[adapter.primaryKey], {
          fileName: file.fileName,
          filePath: file.filePath,
          fileData: null,
          fileType: file.fileType,
          fileSize: file.fileSize,
          uploadedByUuid: row.crewUuid,
        });
      }
    }
    return created;
  }
  if (row.action === "update") {
    if (!row.targetUuid) throw httpError("Pending update is missing its target record", 422);
    return adapter.update(row.targetUuid, payload);
  }
  if (row.action === "delete") {
    if (!row.targetUuid) throw httpError("Pending delete is missing its target record", 422);
    await removeRecordAndAttachments(section, row.targetUuid);
    return null;
  }
  throw httpError(`Unknown pending-change action '${row.action}'`, 422);
}

export interface StageParams {
  domain: string;
  crewUuid: string;
  section: string;
  action: "create" | "update" | "delete";
  targetUuid?: string | null;
  payload: unknown;
}

export interface StageResult {
  pendingChange: AppCrewPendingChange;
  autoApplied: boolean;
  appliedResult?: any;
}

/** Requirement 1 + 2 entry point: stage a crew submission, alert the crewing team, and auto-apply only if this tenant has the verification gate switched off. */
export async function stageChange(params: StageParams): Promise<StageResult> {
  let row = await pendingChangesRepository.stage(params);
  let autoApplied = false;
  let appliedResult: any;

  if (!(await isVerificationRequired(params.domain))) {
    appliedResult = await applyPendingChange(row);
    row = await pendingChangesRepository.markApproved(row.pendingUuid, { uuid: "system", name: "Auto-approved (office verification disabled)" });
    autoApplied = true;
  }

  await raiseSubmissionAlert(row, autoApplied);
  return { pendingChange: row, autoApplied, appliedResult };
}

export async function approveChange(pendingUuid: string, reviewer: Reviewer): Promise<{ pendingChange: AppCrewPendingChange; appliedResult: any }> {
  const row = await pendingChangesRepository.findByUuid(pendingUuid);
  if (!row) throw notFound("Pending change not found");
  if (row.status !== "pending") throw httpError(`Pending change is already '${row.status}'`, 409);

  const appliedResult = await applyPendingChange(row);
  const updated = await pendingChangesRepository.markApproved(pendingUuid, reviewer);
  return { pendingChange: updated, appliedResult };
}

export async function rejectChange(pendingUuid: string, reviewer: Reviewer, reason: string): Promise<AppCrewPendingChange> {
  const row = await pendingChangesRepository.findByUuid(pendingUuid);
  if (!row) throw notFound("Pending change not found");
  if (row.status !== "pending") throw httpError(`Pending change is already '${row.status}'`, 409);
  return pendingChangesRepository.markRejected(pendingUuid, reviewer, reason);
}

export { isVerificationRequired };
