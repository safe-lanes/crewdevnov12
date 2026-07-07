import { PortageRepository } from "../repositories";
import { tenantConfigService } from "./tenantConfigService";
import { wageEngineService } from "../engine";
import type { CrewTotals } from "../engine";
import type {
  AccPortageBillV2,
  AccPortageApprovalV2,
  AccCalculationRunV2,
} from "../../../../shared/v2/accounts/types";

const repo = new PortageRepository();

function coded(code: "CONFLICT" | "VALIDATION" | "NOT_FOUND", message: string) {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  return err;
}

export interface PortageWorkspace {
  portage: AccPortageBillV2 | null;
  approvals: AccPortageApprovalV2[];
  crewTotals: CrewTotals[];
  latestRun: AccCalculationRunV2 | null;
}

/** Statuses from which a portage may be (re-)submitted for approval. */
const SUBMITTABLE = new Set(["open", "vessel_draft", "submitted", "returned"]);

export const portageService = {
  /** Everything the run workspace needs to render for a vessel-month. */
  async getWorkspace(
    vesselUuid: string,
    period: string,
  ): Promise<PortageWorkspace> {
    const portage = await repo.findByVesselPeriod(vesselUuid, period);
    if (!portage) {
      return { portage: null, approvals: [], crewTotals: [], latestRun: null };
    }
    const [approvals, crewTotals, latestRun] = await Promise.all([
      repo.findApprovalsByPortage(portage.portageUuid),
      wageEngineService.summaryForPortage(portage.portageUuid, period),
      repo.findLatestRun(portage.portageUuid),
    ]);
    return { portage, approvals, crewTotals, latestRun: latestRun ?? null };
  },

  /** Submit for approval: status → office_review + fresh Pending rows. */
  async submit(
    portageUuid: string,
    approvers: Array<{ approverId?: string | null; approver: string }>,
    auditUserUuid?: string,
  ): Promise<{ portage: AccPortageBillV2; approvals: AccPortageApprovalV2[] }> {
    const portage = await repo.findByUuid(portageUuid);
    if (!portage) throw coded("NOT_FOUND", "Portage bill not found");
    if (portage.isLocked || portage.status === "locked") {
      throw coded("CONFLICT", "Portage bill is locked");
    }
    if (!SUBMITTABLE.has(portage.status)) {
      throw coded(
        "CONFLICT",
        `Portage bill cannot be submitted from status '${portage.status}'`,
      );
    }
    if (!approvers || approvers.length === 0) {
      throw coded("VALIDATION", "At least one approver is required");
    }
    await repo.softDeleteApprovals(portageUuid);
    const approvals = await repo.createApprovals(
      approvers.map((a) => ({
        portageUuid,
        approverId: a.approverId ?? null,
        approver: a.approver,
        status: "Pending",
        createdByUuid: auditUserUuid ?? null,
      })),
    );
    const updated = await repo.updatePortage(portageUuid, {
      status: "office_review",
      submittedByUuid: auditUserUuid ?? null,
      submittedDate: new Date().toISOString().slice(0, 10),
      updatedByUuid: auditUserUuid ?? null,
    });
    return { portage: updated!, approvals };
  },

  /**
   * Record one approver's decision. Reject → returned. When every live
   * approval row is Approved → approved, then auto-lock per tenant config.
   */
  async decide(
    pbApprovalUuid: string,
    decision: "Approved" | "Rejected",
    comments: string | null,
    auditUserUuid?: string,
  ): Promise<{ portage: AccPortageBillV2; approvals: AccPortageApprovalV2[] }> {
    const approval = await repo.findApprovalByUuid(pbApprovalUuid);
    if (!approval) throw coded("NOT_FOUND", "Approval row not found");
    if (approval.status !== "Pending") {
      throw coded("CONFLICT", `Approval already ${approval.status}`);
    }
    const portage = await repo.findByUuid(approval.portageUuid);
    if (!portage) throw coded("NOT_FOUND", "Portage bill not found");
    if (portage.status !== "office_review") {
      throw coded(
        "CONFLICT",
        `Portage bill is not awaiting approval (status '${portage.status}')`,
      );
    }
    await repo.updateApproval(pbApprovalUuid, {
      status: decision,
      comments,
      date: new Date().toISOString().slice(0, 10),
      updatedByUuid: auditUserUuid ?? null,
    });

    let updatedPortage = portage;
    if (decision === "Rejected") {
      updatedPortage = (await repo.updatePortage(portage.portageUuid, {
        status: "returned",
        updatedByUuid: auditUserUuid ?? null,
      }))!;
    } else {
      const all = await repo.findApprovalsByPortage(portage.portageUuid);
      const allApproved = all.length > 0 && all.every((a) => a.status === "Approved");
      if (allApproved) {
        const config = await tenantConfigService.get();
        if (config.autoLockOnApproval) {
          updatedPortage = (await repo.updatePortage(portage.portageUuid, {
            status: "locked",
            isLocked: true,
            lockedByUuid: auditUserUuid ?? null,
            lockedDate: new Date().toISOString().slice(0, 10),
            updatedByUuid: auditUserUuid ?? null,
          }))!;
        } else {
          updatedPortage = (await repo.updatePortage(portage.portageUuid, {
            status: "approved",
            updatedByUuid: auditUserUuid ?? null,
          }))!;
        }
      }
    }
    const approvals = await repo.findApprovalsByPortage(portage.portageUuid);
    return { portage: updatedPortage, approvals };
  },
};
