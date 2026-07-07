import {
  PortageRepository,
  MonthlyTransactionsRepository,
} from "../repositories";
import { ctmService, computeClosing } from "./ctmService";
import { CtmRepository } from "../repositories/ctmRepository";
import { assertVesselScope, assertOfficeUser } from "./vesselScope";
import type { RequestActor } from "../controllers/_auth";
import type {
  AccPortageBillV2,
  AccCtmV2,
} from "../../../../shared/v2/accounts/types";

const portageRepo = new PortageRepository();
const txnRepo = new MonthlyTransactionsRepository();
const ctmRepo = new CtmRepository();

function coded(
  code: "CONFLICT" | "VALIDATION" | "NOT_FOUND",
  message: string,
): Error {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  return err;
}

/** Portage statuses from which the vessel may submit the month. */
const VESSEL_SUBMITTABLE = new Set(["open", "vessel_draft", "returned"]);

/** Portage statuses from which the office may return the month. */
const OFFICE_RETURNABLE = new Set(["submitted", "office_review"]);

export interface VesselSubmitResult {
  portage: AccPortageBillV2;
  ctm: AccCtmV2;
  transactionsSubmitted: number;
  warnings: string[];
}

export interface OfficeReturnResult {
  portage: AccPortageBillV2;
  transactionsReturned: number;
}

/**
 * Vessel-side submission package lifecycle (Prompt 06, spec 2a) on the
 * portage status machine: open | vessel_draft | submitted | office_review |
 * returned | approved | locked.
 */
export const vesselPortageService = {
  /**
   * Vessel action: flip the month's vessel-originated drafts to submitted,
   * portage → submitted, CTM → submitted. CTM imbalance yields a warning
   * but does not block.
   */
  async submit(
    vesselUuid: string,
    period: string,
    actor?: RequestActor,
  ): Promise<VesselSubmitResult> {
    assertVesselScope(actor, vesselUuid);
    const auditUserUuid = actor?.auditUserUuid;

    let portage = await portageRepo.findByVesselPeriod(vesselUuid, period);
    if (!portage) {
      portage = await portageRepo.createPortage({
        vesselUuid,
        period,
        status: "open",
        preparedMode: "vessel_prepares",
        createdByUuid: auditUserUuid ?? null,
        updatedByUuid: auditUserUuid ?? null,
      });
    }
    if (portage.isLocked || portage.status === "locked") {
      throw coded("CONFLICT", "Portage bill is locked");
    }
    if (!VESSEL_SUBMITTABLE.has(portage.status)) {
      throw coded(
        "CONFLICT",
        `Month cannot be submitted from status '${portage.status}'`,
      );
    }

    // Precondition: the CTM record exists (auto-created on first entry).
    const ctm = await ctmService.getOrCreate(vesselUuid, period, auditUserUuid);
    if (ctm.status === "locked") {
      throw coded("CONFLICT", "CTM cash account is locked");
    }

    const flipped = await txnRepo.flipVesselStatus(
      vesselUuid,
      period,
      "draft",
      "submitted",
      { auditUserUuid },
    );

    const updatedPortage = await portageRepo.updatePortage(
      portage.portageUuid,
      {
        status: "submitted",
        submittedByUuid: auditUserUuid ?? null,
        submittedDate: new Date().toISOString().slice(0, 10),
        updatedByUuid: auditUserUuid ?? null,
      },
    );

    const detail = await ctmService.submitForPortage(
      vesselUuid,
      period,
      portage.portageUuid,
      auditUserUuid,
    );

    const warnings: string[] = [];
    const computed = computeClosing(detail.ctm, detail.lines);
    if (Number(detail.ctm.closingBalance ?? 0).toFixed(2) !== computed) {
      warnings.push(
        `CTM cash account is out of balance: recorded closing ${detail.ctm.closingBalance} vs computed ${computed}`,
      );
    }

    return {
      portage: updatedPortage!,
      ctm: detail.ctm,
      transactionsSubmitted: flipped.length,
      warnings,
    };
  },

  /**
   * Office action (comment required): portage → returned; the month's
   * submitted vessel entries revert to draft carrying the office comment;
   * CTM submitted → open. Rejected/accepted rows are untouched.
   */
  async returnToVessel(
    portageUuid: string,
    comment: string,
    actor?: RequestActor,
  ): Promise<OfficeReturnResult> {
    assertOfficeUser(actor, "Return to vessel");
    const auditUserUuid = actor?.auditUserUuid;

    const portage = await portageRepo.findByUuid(portageUuid);
    if (!portage) throw coded("NOT_FOUND", "Portage bill not found");
    if (portage.isLocked || portage.status === "locked") {
      throw coded("CONFLICT", "Portage bill is locked");
    }
    if (!OFFICE_RETURNABLE.has(portage.status)) {
      throw coded(
        "CONFLICT",
        `Month cannot be returned from status '${portage.status}'`,
      );
    }

    const reverted = await txnRepo.flipVesselStatus(
      portage.vesselUuid,
      portage.period,
      "submitted",
      "draft",
      { reviewComment: comment, auditUserUuid },
    );

    const updatedPortage = await portageRepo.updatePortage(portageUuid, {
      status: "returned",
      updatedByUuid: auditUserUuid ?? null,
    });

    await ctmService.reopenForVessel(
      portage.vesselUuid,
      portage.period,
      auditUserUuid,
    );

    return {
      portage: updatedPortage!,
      transactionsReturned: reverted.length,
    };
  },

  /** Vessel-month package status for the workspace/Payroll Run step 1. */
  async getStatus(
    vesselUuid: string,
    period: string,
  ): Promise<{
    portage: AccPortageBillV2 | null;
    ctm: AccCtmV2 | null;
    counts: Record<string, number>;
  }> {
    const [portage, ctm, txns] = await Promise.all([
      portageRepo.findByVesselPeriod(vesselUuid, period),
      ctmRepo.findByVesselPeriod(vesselUuid, period),
      txnRepo.findAll({ vesselUuid, period, origin: "vessel" }),
    ]);
    const counts: Record<string, number> = {};
    for (const txn of txns) {
      counts[txn.status] = (counts[txn.status] ?? 0) + 1;
    }
    return { portage: portage ?? null, ctm: ctm ?? null, counts };
  },
};
