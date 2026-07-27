import {
  MonthlyTransactionsRepository,
  PayElementsRepository,
} from "../repositories";
import type {
  AccMonthlyTransactionV2,
  InsertAccMonthlyTransactionV2,
  AccPayElementV2,
} from "../../../../shared/v2/accounts/types";
import { applyAuditUser } from "./auditUtils";
import { ctmService } from "./ctmService";
import { assertVesselScope } from "./vesselScope";
import type { RequestActor } from "../controllers/_auth";

const repo = new MonthlyTransactionsRepository();
const payElementsRepo = new PayElementsRepository();

function coded(
  code: "CONFLICT" | "VALIDATION" | "NOT_FOUND",
  message: string,
): Error {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  return err;
}

function conflict(message: string): Error {
  return coded("CONFLICT", message);
}

/**
 * Refuse any mutation touching a vessel-month whose portage bill is locked
 * (spec: after lock the monthly-transactions grid is read-only).
 */
async function assertUnlocked(
  vesselUuid: string | null | undefined,
  period: string,
): Promise<void> {
  if (!vesselUuid) return;
  const portage = await repo.findPortage(vesselUuid, period);
  if (portage && (portage.isLocked || portage.status === "locked")) {
    throw conflict(
      `Portage bill for vessel ${vesselUuid} period ${period} is locked; monthly transactions are read-only`,
    );
  }
}

/** Portage statuses in which vessel users may create/edit/delete drafts. */
const VESSEL_EDITABLE_PORTAGE = new Set(["open", "vessel_draft", "returned"]);

/** Vessel edit window: month not yet submitted (or returned) and unlocked. */
async function assertVesselWindow(
  vesselUuid: string,
  period: string,
): Promise<void> {
  const portage = await repo.findPortage(vesselUuid, period);
  if (portage && !VESSEL_EDITABLE_PORTAGE.has(portage.status)) {
    throw conflict(
      `Month ${period} is ${portage.status}; vessel edits are not allowed`,
    );
  }
}

async function requireElement(
  payElementUuid: string,
): Promise<AccPayElementV2> {
  const element = await payElementsRepo.findByUuid(payElementUuid);
  if (!element) {
    throw coded("NOT_FOUND", `Pay element not found: ${payElementUuid}`);
  }
  return element;
}

/**
 * Vessel-side entry categories (spec Prompt 06): variable OT, on-board cash
 * advances, bond/slop chest, radio/tel, allotment transactions and misc
 * one-off/other deductions. Everything else is office-only.
 * Keep in sync with VESSEL_ENTRY_CATEGORIES in VesselPortagePage.tsx.
 */
export const VESSEL_ALLOWED_CATEGORIES = new Set([
  "overtime_variable",
  "advance_recovery",
  "bond_slop_chest",
  "communication",
  "allotment",
  "one_off",
  "other",
]);

/**
 * Hard principle: the vessel never touches scale-derived wages, and vessel
 * entry is limited to the vessel-side variable categories above.
 */
function assertVesselElementAllowed(element: AccPayElementV2): void {
  if (element.calcMethod === "scale_lookup") {
    throw coded(
      "VALIDATION",
      `Vessel users cannot enter scale-derived wage elements (${element.code})`,
    );
  }
  if (!VESSEL_ALLOWED_CATEGORIES.has(element.category)) {
    throw coded(
      "VALIDATION",
      `Vessel users cannot enter '${element.category}' elements (${element.code}); allowed categories: ${[...VESSEL_ALLOWED_CATEGORIES].join(", ")}`,
    );
  }
}

/**
 * Advance dual-record sync (spec 2b): a vessel-origin transaction on an
 * `advance_recovery` element mirrors exactly one CTM cash_advance_to_crew
 * line. Create/update/delete of the draft transaction keeps the line in
 * sync; reject removes the line (documented choice: remove, not void).
 */
async function syncCtmLine(
  txn: AccMonthlyTransactionV2,
  element: AccPayElementV2 | undefined,
  auditUserUuid?: string,
): Promise<AccMonthlyTransactionV2> {
  const isAdvance =
    txn.origin === "vessel" && element?.category === "advance_recovery";
  if (isAdvance) {
    if (!txn.vesselUuid) {
      throw coded(
        "VALIDATION",
        "vesselUuid is required for on-board cash advances",
      );
    }
    if (txn.ctmLineUuid) {
      await ctmService.updateAdvanceLine(
        txn.ctmLineUuid,
        {
          crewUuid: txn.crewUuid,
          amount: txn.amount ?? "0.00",
          currency: txn.currency ?? undefined,
          // The CTM mirror carries the advance's dated column, not the
          // entry date (falls back to today only when the txn is undated).
          lineDate: txn.txnDate ?? undefined,
          description: txn.remarks ?? "On-board cash advance",
        },
        auditUserUuid,
      );
      return txn;
    }
    const line = await ctmService.addAdvanceLine(
      txn.vesselUuid,
      txn.period,
      {
        crewUuid: txn.crewUuid,
        amount: txn.amount ?? "0.00",
        currency: txn.currency ?? undefined,
        lineDate: txn.txnDate ?? undefined,
        description: txn.remarks ?? "On-board cash advance",
      },
      auditUserUuid,
    );
    const updated = await repo.update(txn.txnUuid, {
      ctmLineUuid: line.ctmLineUuid,
    });
    return updated ?? txn;
  }
  if (txn.ctmLineUuid) {
    await ctmService.removeAdvanceLine(txn.ctmLineUuid, auditUserUuid);
    const updated = await repo.update(txn.txnUuid, { ctmLineUuid: null });
    return updated ?? txn;
  }
  return txn;
}

export const monthlyTransactionsService = {
  async getAll(filters?: {
    vesselUuid?: string;
    period?: string;
    crewUuid?: string;
    engagementUuid?: string;
    status?: string;
    origin?: string;
  }): Promise<AccMonthlyTransactionV2[]> {
    return repo.findAll(filters);
  },

  async getByUuid(txnUuid: string): Promise<AccMonthlyTransactionV2> {
    const record = await repo.findByUuid(txnUuid);
    if (!record) {
      throw new Error(`Monthly transaction not found: ${txnUuid}`);
    }
    return record;
  },

  async create(
    data: Omit<InsertAccMonthlyTransactionV2, "txnUuid"> & {
      auditUserUuid?: string;
    },
    actor?: RequestActor,
  ): Promise<AccMonthlyTransactionV2> {
    // Bond rollup txns are system-maintained from bond items (spec 2a).
    if (data.sourceType === "bond") {
      throw coded(
        "VALIDATION",
        "Bond rollup transactions are maintained automatically from bond items; enter bond items instead",
      );
    }
    const element = await requireElement(data.payElementUuid);
    if (actor?.vesselUser) {
      assertVesselScope(actor, data.vesselUuid);
      assertVesselElementAllowed(element);
      // Vessel entries are always vessel-originated drafts.
      data = { ...data, origin: "vessel", status: "draft" };
      await assertVesselWindow(data.vesselUuid!, data.period);
    }
    await assertUnlocked(data.vesselUuid, data.period);
    const created = await repo.create(applyAuditUser(data, true));
    return syncCtmLine(created, element, data.auditUserUuid);
  },

  async update(
    txnUuid: string,
    data: Partial<InsertAccMonthlyTransactionV2> & { auditUserUuid?: string },
    actor?: RequestActor,
  ): Promise<AccMonthlyTransactionV2> {
    const existing = await this.getByUuid(txnUuid);
    if (existing.sourceType === "bond" || data.sourceType === "bond") {
      throw conflict(
        "This transaction is the bond rollup for the crew-month; edit the underlying bond items instead",
      );
    }
    if (actor?.vesselUser) {
      assertVesselScope(actor, existing.vesselUuid);
      if (data.vesselUuid && data.vesselUuid !== existing.vesselUuid) {
        assertVesselScope(actor, data.vesselUuid);
      }
      if (existing.origin !== "vessel") {
        throw conflict("Vessel users may only edit vessel-originated entries");
      }
      // Accepted/rejected/submitted rows are immutable to the vessel;
      // the office re-opens a rejected row to draft.
      if (existing.status !== "draft") {
        throw conflict(
          `Entry is ${existing.status}; vessel users may only edit drafts`,
        );
      }
      if (data.payElementUuid) {
        assertVesselElementAllowed(await requireElement(data.payElementUuid));
      }
      // The vessel cannot promote its own rows out of draft or re-origin them.
      data = { ...data, origin: "vessel", status: "draft" };
      await assertVesselWindow(existing.vesselUuid!, existing.period);
    }
    await assertUnlocked(existing.vesselUuid, existing.period);
    // Guard the destination vessel-month too when it changes.
    const nextVessel = data.vesselUuid ?? existing.vesselUuid;
    const nextPeriod = data.period ?? existing.period;
    if (nextVessel !== existing.vesselUuid || nextPeriod !== existing.period) {
      await assertUnlocked(nextVessel, nextPeriod);
    }
    const updated = await repo.update(txnUuid, applyAuditUser(data, false));
    if (!updated) {
      throw new Error(`Failed to update monthly transaction: ${txnUuid}`);
    }
    const element = await requireElement(updated.payElementUuid);
    return syncCtmLine(updated, element, data.auditUserUuid);
  },

  async delete(
    txnUuid: string,
    actor?: RequestActor,
    auditUserUuid?: string,
  ): Promise<void> {
    const existing = await this.getByUuid(txnUuid);
    if (existing.sourceType === "bond") {
      throw conflict(
        "This transaction is the bond rollup for the crew-month; delete the underlying bond items instead",
      );
    }
    if (actor?.vesselUser) {
      assertVesselScope(actor, existing.vesselUuid);
      if (existing.origin !== "vessel") {
        throw conflict(
          "Vessel users may only delete vessel-originated entries",
        );
      }
      if (existing.status !== "draft") {
        throw conflict(
          `Entry is ${existing.status}; vessel users may only delete drafts`,
        );
      }
      await assertVesselWindow(existing.vesselUuid!, existing.period);
    }
    await assertUnlocked(existing.vesselUuid, existing.period);
    const success = await repo.softDelete(txnUuid);
    if (!success) {
      throw new Error(`Failed to delete monthly transaction: ${txnUuid}`);
    }
    if (existing.ctmLineUuid) {
      await ctmService.removeAdvanceLine(existing.ctmLineUuid, auditUserUuid);
    }
  },

  /**
   * 0179 batch save (Vessel Portage category grids): apply a whole grid's
   * creates/updates/deletes in ONE request. Operations are applied
   * sequentially through the existing create/update/delete paths so every
   * guard (vessel scope, edit window, lock, element rules, CTM sync) runs
   * unchanged. On the first failure the batch stops and reports which
   * operations were applied — the client keeps unsaved values and retries.
   */
  async batchSave(
    payload: {
      creates?: Array<
        Omit<InsertAccMonthlyTransactionV2, "txnUuid"> & {
          auditUserUuid?: string;
        }
      >;
      updates?: Array<
        { txnUuid: string } & Partial<InsertAccMonthlyTransactionV2> & {
            auditUserUuid?: string;
          }
      >;
      deletes?: string[];
      auditUserUuid?: string;
    },
    actor?: RequestActor,
  ): Promise<{
    created: AccMonthlyTransactionV2[];
    updated: AccMonthlyTransactionV2[];
    deleted: string[];
    applied: number;
    failed?: { op: string; ref: string; error: string; code?: string };
  }> {
    const created: AccMonthlyTransactionV2[] = [];
    const updated: AccMonthlyTransactionV2[] = [];
    const deleted: string[] = [];
    const audit = payload.auditUserUuid;
    try {
      for (const del of payload.deletes ?? []) {
        await this.delete(del, actor, audit);
        deleted.push(del);
      }
      for (const upd of payload.updates ?? []) {
        const { txnUuid, ...data } = upd;
        updated.push(
          await this.update(
            txnUuid,
            { ...data, auditUserUuid: data.auditUserUuid ?? audit },
            actor,
          ),
        );
      }
      for (const cre of payload.creates ?? []) {
        created.push(
          await this.create(
            { ...cre, auditUserUuid: cre.auditUserUuid ?? audit },
            actor,
          ),
        );
      }
    } catch (error: any) {
      const applied = created.length + updated.length + deleted.length;
      const failed = {
        op:
          deleted.length < (payload.deletes?.length ?? 0)
            ? "delete"
            : updated.length < (payload.updates?.length ?? 0)
              ? "update"
              : "create",
        ref: String(
          deleted.length < (payload.deletes?.length ?? 0)
            ? payload.deletes![deleted.length]
            : updated.length < (payload.updates?.length ?? 0)
              ? payload.updates![updated.length].txnUuid
              : (payload.creates?.[created.length]?.payElementUuid ?? ""),
        ),
        error: error?.message ?? "Batch save failed",
        code: error?.code,
      };
      const err = new Error(failed.error) as Error & {
        code?: string;
        batchResult?: unknown;
      };
      err.code = error?.code;
      err.batchResult = { created, updated, deleted, applied, failed };
      throw err;
    }
    return {
      created,
      updated,
      deleted,
      applied: created.length + updated.length + deleted.length,
    };
  },

  // ------------------------------------------------------------------
  // Per-transaction office review (spec 2a)
  // ------------------------------------------------------------------

  /** Office accepts a submitted vessel entry. Never duplicates CTM lines. */
  async accept(
    txnUuid: string,
    auditUserUuid?: string,
  ): Promise<AccMonthlyTransactionV2> {
    const existing = await this.getByUuid(txnUuid);
    if (existing.origin !== "vessel") {
      throw coded(
        "VALIDATION",
        "Only vessel-originated entries go through office review",
      );
    }
    await assertUnlocked(existing.vesselUuid, existing.period);
    if (existing.status !== "submitted") {
      throw conflict(
        `Entry is ${existing.status}; only submitted entries can be accepted`,
      );
    }
    const updated = await repo.update(txnUuid, {
      status: "accepted",
      reviewComment: null,
      updatedByUuid: auditUserUuid ?? null,
    });
    return updated!;
  },

  /**
   * Office rejects a submitted vessel entry (comment required). The linked
   * CTM advance line is REMOVED (spec test 3: "choose remove; document") —
   * if the office later re-opens the row to draft and the vessel edits it,
   * the line is re-created by the dual-record sync.
   */
  async reject(
    txnUuid: string,
    reviewComment: string,
    auditUserUuid?: string,
  ): Promise<AccMonthlyTransactionV2> {
    const existing = await this.getByUuid(txnUuid);
    if (existing.origin !== "vessel") {
      throw coded(
        "VALIDATION",
        "Only vessel-originated entries go through office review",
      );
    }
    await assertUnlocked(existing.vesselUuid, existing.period);
    if (existing.status !== "submitted") {
      throw conflict(
        `Entry is ${existing.status}; only submitted entries can be rejected`,
      );
    }
    if (existing.ctmLineUuid) {
      await ctmService.removeAdvanceLine(existing.ctmLineUuid, auditUserUuid);
    }
    const updated = await repo.update(txnUuid, {
      status: "rejected",
      reviewComment,
      ctmLineUuid: null,
      updatedByUuid: auditUserUuid ?? null,
    });
    return updated!;
  },
};
