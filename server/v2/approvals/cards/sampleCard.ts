/**
 * SAMPLE approval card — a working template for real Crewing cards (Portage, Promotions, …).
 * Registered only when APPROVAL_ENGINE_SAMPLE_CARD=true (local / test servers). It never
 * appears on a normal server.
 *
 * The "record" being approved is kept in memory per tenant so the sample touches no Crewing
 * table. A REAL card instead reads its record from the module's repository in classify /
 * resolveApprovers, and onDecision writes the outcome through the module's own repository.
 *
 * What every card must show (all present below):
 *   1. scopes        — the screen/action being approved and its classifications
 *   2. listRoles     — roles offered in the chain builder (shared roles.ts helper)
 *   3. classify      — maps the record to one classification id
 *   4. resolveApprovers — role → user_uuids, vessel-scoped (shared roles.ts helper)
 *   5. onDecision    — applies approved / returned EXACTLY once; must be idempotent
 */
import type { CardCtx, DecisionNotice, Scope } from "../../approval-engine";
import { listApprovalRoles, resolveRoleApproverUserIds } from "../roles";
import type { CrewingApprovalCard } from "./types";

export const SAMPLE_MODULE_ID = "crewing-sample";
export const SAMPLE_SCREEN_ID = "sample-request";

export interface SampleRecord {
  ref: string;
  title: string;
  vesselUuid: string | null;
  urgent: boolean;
  status: "draft" | "pending-approval" | "approved" | "returned";
  decidedBy: string | null;
  remarks: string | null;
  applyCount: number; // proves onDecision ran once
}

// tenantId → (ref → record)
const records = new Map<string, Map<string, SampleRecord>>();

function tenantRecords(tenantId: string): Map<string, SampleRecord> {
  let m = records.get(tenantId);
  if (!m) { m = new Map(); records.set(tenantId, m); }
  return m;
}

export function sampleSaveRecord(tenantId: string, rec: SampleRecord): void { tenantRecords(tenantId).set(rec.ref, rec); }
export function sampleGetRecord(tenantId: string, ref: string): SampleRecord | null { return tenantRecords(tenantId).get(ref) ?? null; }

export const sampleApprovalCard: CrewingApprovalCard = {
  moduleId: SAMPLE_MODULE_ID,
  label: "Sample (test only)",
  scopes: [
    {
      screenId: SAMPLE_SCREEN_ID,
      actionId: "",
      label: "Sample request",
      classifications: [
        { id: "Normal", label: "Normal" },
        { id: "Urgent", label: "Urgent" },
      ],
    },
  ],

  async listRoles() {
    return listApprovalRoles();
  },

  async classify(ctx: CardCtx, _scope: Scope, subject: unknown) {
    const ref = (subject as { ref?: unknown })?.ref;
    const rec = typeof ref === "string" ? sampleGetRecord(ctx.tenantId, ref) : null;
    if (!rec) throw Object.assign(new Error("[sample] unknown record"), { statusCode: 400 });
    return rec.urgent ? "Urgent" : "Normal";
  },

  async resolveApprovers(ctx: CardCtx, _scope: Scope, roleId: string, subjectRef: string) {
    const rec = sampleGetRecord(ctx.tenantId, subjectRef);
    return resolveRoleApproverUserIds(roleId, rec?.vesselUuid ?? null);
  },

  async onDecision(ctx: CardCtx, notice: DecisionNotice) {
    const rec = sampleGetRecord(ctx.tenantId, notice.subjectRef);
    if (!rec) return;
    // Idempotent: only a record still waiting for approval changes. A replay is a no-op.
    if (rec.status !== "pending-approval") return;
    rec.status = notice.outcome === "approved" ? "approved" : "returned";
    rec.decidedBy = notice.decidedBy;
    rec.remarks = notice.remarks;
    rec.applyCount += 1;
  },

  async describeSubject(_scope: Scope, subjectRef: string) {
    return `Sample request ${subjectRef}`;
  },
};
