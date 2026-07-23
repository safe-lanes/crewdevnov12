import { PortageRepository, EngagementsRepository } from "../repositories";
import { sortByRankOrder } from "./engagementsService";
import { tenantConfigService } from "./tenantConfigService";
import { wageEngineService } from "../engine";
import type { CrewTotals } from "../engine";
import type {
  AccPortageBillV2,
  AccPortageApprovalV2,
  AccCalculationRunV2,
} from "../../../../shared/v2/accounts/types";

const repo = new PortageRepository();
const engagementsRepo = new EngagementsRepository();

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
    const [approvals, crewTotals, latestRun, rankSortOrders] =
      await Promise.all([
        repo.findApprovalsByPortage(portage.portageUuid),
        wageEngineService.summaryForPortage(portage.portageUuid, period),
        repo.findLatestRun(portage.portageUuid),
        engagementsRepo.findRankSortOrders(),
      ]);
    const crewNames = await engagementsRepo.findCrewInfo(
      Array.from(new Set(crewTotals.map((t) => t.crewUuid))),
    );
    const sortedTotals = sortByRankOrder(
      crewTotals,
      rankSortOrders,
      (t) => t.rankId,
      (t) => crewNames.get(t.crewUuid)?.name || t.crewUuid,
    );
    return {
      portage,
      approvals,
      crewTotals: sortedTotals,
      latestRun: latestRun ?? null,
    };
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
    deciderId?: string | null,
  ): Promise<{ portage: AccPortageBillV2; approvals: AccPortageApprovalV2[] }> {
    // Config is read up front; every write (approval row, portage status,
    // and — on auto-lock — the linked CTM lock) happens inside ONE
    // transaction in the repository, with the portage row locked FOR UPDATE
    // so concurrent approver decisions serialize and the terminal
    // transition fires exactly once. With autoLockOnApproval=false the
    // terminal transition sets status 'approved' only: the month remains
    // unlocked (engine re-runs, transactions, bonds stay editable) until
    // explicitly locked.
    const config = await tenantConfigService.get();
    return repo.applyDecision({
      pbApprovalUuid,
      decision,
      comments,
      auditUserUuid: auditUserUuid ?? null,
      autoLockOnApproval: Boolean(config.autoLockOnApproval),
      deciderId: deciderId ?? null,
    });
  },
};
