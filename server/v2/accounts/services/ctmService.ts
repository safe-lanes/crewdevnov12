import {
  CtmRepository,
  MonthlyTransactionsRepository,
} from "../repositories";
import type {
  AccCtmV2,
  AccCtmLineV2,
  InsertAccCtmLineV2,
} from "../../../../shared/v2/accounts/types";

const repo = new CtmRepository();
const txnRepo = new MonthlyTransactionsRepository();

function coded(
  code: "CONFLICT" | "VALIDATION" | "NOT_FOUND",
  message: string,
): Error {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  return err;
}

/** Previous YYYY-MM period. */
export function priorPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${d.getUTCFullYear()}-${mm}`;
}

/**
 * closing = opening + received + Σ(receipts)
 *           − Σ(cash_advance_to_crew + expenses) ± adjustments
 * Computed server-side on every change; never client-supplied.
 */
export function computeClosing(ctm: AccCtmV2, lines: AccCtmLineV2[]): string {
  let total = Number(ctm.openingBalance ?? 0) + Number(ctm.receivedAmount ?? 0);
  for (const line of lines) {
    const amt = Number(line.amount ?? 0);
    if (line.lineType === "receipt") total += amt;
    else if (line.lineType === "cash_advance_to_crew") total -= amt;
    else if (line.lineType === "expense") total -= amt;
    else if (line.lineType === "adjustment") total += amt; // signed
  }
  return total.toFixed(2);
}

export interface CtmDetail {
  ctm: AccCtmV2;
  lines: AccCtmLineV2[];
  /** True when the persisted closing does not satisfy the identity. */
  imbalance: boolean;
  /** True when opening is carried from a prior month (read-only then). */
  openingCarried: boolean;
  /** The YYYY-MM period of the source CTM, or null when no prior record exists. */
  openingCarriedFromPeriod: string | null;
}

/** Statuses in which the vessel-facing CTM header/lines are mutable. */
const MUTABLE = new Set(["open"]);

async function recompute(ctm: AccCtmV2): Promise<AccCtmV2> {
  const lines = await repo.findLines(ctm.ctmUuid);
  const closing = computeClosing(ctm, lines);
  const updated = await repo.update(ctm.ctmUuid, { closingBalance: closing });
  return updated ?? ctm;
}

async function requireCtmForLine(ctmLineUuid: string): Promise<{
  ctm: AccCtmV2;
  line: AccCtmLineV2;
}> {
  const line = await repo.findLineByUuid(ctmLineUuid);
  if (!line) throw coded("NOT_FOUND", `CTM line not found: ${ctmLineUuid}`);
  const ctm = await repo.findByUuid(line.ctmUuid);
  if (!ctm) throw coded("NOT_FOUND", `CTM not found: ${line.ctmUuid}`);
  return { ctm, line };
}

async function assertNotTxnLinked(ctmLineUuid: string): Promise<void> {
  const txn = await txnRepo.findByCtmLine(ctmLineUuid);
  if (txn) {
    throw coded(
      "CONFLICT",
      "This CTM line is linked to a vessel transaction; edit it via the transaction",
    );
  }
}

export const ctmService = {
  priorPeriod,
  computeClosing,

  /**
   * Auto-create on first vessel entry: opening carried from the most-recent
   * prior CTM's closing balance (any earlier period, most-recent-first). If
   * no prior record exists the opening is 0.00 and openingCarriedFromPeriod
   * stays null.
   */
  async getOrCreate(
    vesselUuid: string,
    period: string,
    auditUserUuid?: string,
  ): Promise<AccCtmV2> {
    const existing = await repo.findByVesselPeriod(vesselUuid, period);
    if (existing) return existing;
    const prior = await repo.findMostRecentPriorCtm(vesselUuid, period);
    const opening = prior ? Number(prior.closingBalance ?? 0).toFixed(2) : "0.00";
    const created = await repo.create({
      vesselUuid,
      period,
      openingBalance: opening,
      receivedAmount: "0.00",
      closingBalance: opening,
      currency: prior?.currency ?? "USD",
      status: "open",
      openingCarriedFromPeriod: prior ? prior.period : null,
      createdByUuid: auditUserUuid ?? null,
      updatedByUuid: auditUserUuid ?? null,
    });
    return created;
  },

  async getDetail(
    vesselUuid: string,
    period: string,
    auditUserUuid?: string,
  ): Promise<CtmDetail> {
    const ctm = await this.getOrCreate(vesselUuid, period, auditUserUuid);
    const lines = await repo.findLines(ctm.ctmUuid);
    const computed = computeClosing(ctm, lines);
    const openingCarriedFromPeriod = ctm.openingCarriedFromPeriod ?? null;
    return {
      ctm,
      lines,
      imbalance: Number(ctm.closingBalance ?? 0).toFixed(2) !== computed,
      openingCarried: openingCarriedFromPeriod !== null,
      openingCarriedFromPeriod,
    };
  },

  /** Header update: received_amount always; opening only when no prior month. */
  async updateHeader(
    vesselUuid: string,
    period: string,
    data: {
      openingBalance?: string;
      receivedAmount?: string;
      currency?: string;
    },
    auditUserUuid?: string,
  ): Promise<CtmDetail> {
    const ctm = await this.getOrCreate(vesselUuid, period, auditUserUuid);
    if (!MUTABLE.has(ctm.status)) {
      throw coded("CONFLICT", `CTM is ${ctm.status}; header is read-only`);
    }
    if (data.openingBalance !== undefined) {
      // Block manual override whenever any prior CTM was found (adjacent or not)
      if (ctm.openingCarriedFromPeriod !== null && ctm.openingCarriedFromPeriod !== undefined) {
        throw coded(
          "VALIDATION",
          "Opening balance is carried from a prior month's closing and cannot be edited",
        );
      }
    }
    const updated = await repo.update(ctm.ctmUuid, {
      ...(data.openingBalance !== undefined
        ? { openingBalance: data.openingBalance }
        : {}),
      ...(data.receivedAmount !== undefined
        ? { receivedAmount: data.receivedAmount }
        : {}),
      ...(data.currency !== undefined ? { currency: data.currency } : {}),
      updatedByUuid: auditUserUuid ?? null,
    });
    await recompute(updated!);
    return this.getDetail(vesselUuid, period, auditUserUuid);
  },

  // ------------------------------------------------------------------
  // Manual line CRUD (vessel/office via the CTM tab). Transaction-linked
  // lines are immutable here — they sync via the monthly transaction.
  // ------------------------------------------------------------------

  async createLine(
    vesselUuid: string,
    period: string,
    data: Omit<InsertAccCtmLineV2, "ctmLineUuid" | "ctmUuid">,
    auditUserUuid?: string,
  ): Promise<AccCtmLineV2> {
    const ctm = await this.getOrCreate(vesselUuid, period, auditUserUuid);
    if (!MUTABLE.has(ctm.status)) {
      throw coded("CONFLICT", `CTM is ${ctm.status}; lines are read-only`);
    }
    const line = await repo.createLine({
      ...data,
      ctmUuid: ctm.ctmUuid,
      createdByUuid: auditUserUuid ?? null,
      updatedByUuid: auditUserUuid ?? null,
    });
    await recompute(ctm);
    return line;
  },

  async updateLine(
    ctmLineUuid: string,
    data: Partial<Omit<InsertAccCtmLineV2, "ctmLineUuid" | "ctmUuid">>,
    auditUserUuid?: string,
  ): Promise<AccCtmLineV2> {
    const { ctm } = await requireCtmForLine(ctmLineUuid);
    if (!MUTABLE.has(ctm.status)) {
      throw coded("CONFLICT", `CTM is ${ctm.status}; lines are read-only`);
    }
    await assertNotTxnLinked(ctmLineUuid);
    const updated = await repo.updateLine(ctmLineUuid, {
      ...data,
      updatedByUuid: auditUserUuid ?? null,
    });
    await recompute(ctm);
    return updated!;
  },

  async deleteLine(ctmLineUuid: string, auditUserUuid?: string): Promise<void> {
    const { ctm } = await requireCtmForLine(ctmLineUuid);
    if (!MUTABLE.has(ctm.status)) {
      throw coded("CONFLICT", `CTM is ${ctm.status}; lines are read-only`);
    }
    await assertNotTxnLinked(ctmLineUuid);
    await repo.softDeleteLine(ctmLineUuid);
    await recompute(ctm);
  },

  /** Resolve a line's vessel for controller-level scope checks. */
  async getLineContext(
    ctmLineUuid: string,
  ): Promise<{ ctm: AccCtmV2; line: AccCtmLineV2 }> {
    return requireCtmForLine(ctmLineUuid);
  },

  // ------------------------------------------------------------------
  // Internal sync path for the advance dual-record (monthly transaction
  // is the source of truth; bypasses the txn-linked guard). Allowed while
  // the CTM is not locked — e.g. an office reject removes the line while
  // the CTM is 'submitted'.
  // ------------------------------------------------------------------

  async addAdvanceLine(
    vesselUuid: string,
    period: string,
    data: {
      crewUuid?: string | null;
      amount: string;
      currency?: string;
      lineDate?: string | null;
      description?: string | null;
    },
    auditUserUuid?: string,
  ): Promise<AccCtmLineV2> {
    const ctm = await this.getOrCreate(vesselUuid, period, auditUserUuid);
    if (ctm.status === "locked") {
      throw coded("CONFLICT", "CTM is locked");
    }
    const line = await repo.createLine({
      ctmUuid: ctm.ctmUuid,
      lineType: "cash_advance_to_crew",
      crewUuid: data.crewUuid ?? null,
      amount: data.amount,
      currency: data.currency ?? ctm.currency,
      lineDate: data.lineDate ?? new Date().toISOString().slice(0, 10),
      description: data.description ?? "On-board cash advance",
      createdByUuid: auditUserUuid ?? null,
      updatedByUuid: auditUserUuid ?? null,
    });
    await recompute(ctm);
    return line;
  },

  async updateAdvanceLine(
    ctmLineUuid: string,
    data: {
      crewUuid?: string | null;
      amount?: string;
      currency?: string;
      lineDate?: string | null;
      description?: string | null;
    },
    auditUserUuid?: string,
  ): Promise<void> {
    const { ctm } = await requireCtmForLine(ctmLineUuid);
    if (ctm.status === "locked") {
      throw coded("CONFLICT", "CTM is locked");
    }
    await repo.updateLine(ctmLineUuid, {
      ...data,
      updatedByUuid: auditUserUuid ?? null,
    });
    await recompute(ctm);
  },

  async removeAdvanceLine(
    ctmLineUuid: string,
    auditUserUuid?: string,
  ): Promise<void> {
    const line = await repo.findLineByUuid(ctmLineUuid);
    if (!line) return; // already gone — removal is idempotent
    const ctm = await repo.findByUuid(line.ctmUuid);
    if (ctm && ctm.status === "locked") {
      throw coded("CONFLICT", "CTM is locked");
    }
    await repo.softDeleteLine(ctmLineUuid);
    if (ctm) await recompute(ctm);
  },

  // ------------------------------------------------------------------
  // Lifecycle transitions (driven by the vessel-portage state machine)
  // ------------------------------------------------------------------

  /** Vessel submit: CTM → submitted with audit + portage link. */
  async submitForPortage(
    vesselUuid: string,
    period: string,
    portageUuid: string,
    auditUserUuid?: string,
  ): Promise<CtmDetail> {
    const ctm = await this.getOrCreate(vesselUuid, period, auditUserUuid);
    if (ctm.status === "locked") throw coded("CONFLICT", "CTM is locked");
    await recompute(ctm);
    await repo.update(ctm.ctmUuid, {
      status: "submitted",
      submittedByUuid: auditUserUuid ?? null,
      submittedDate: new Date().toISOString().slice(0, 10),
      portageUuid,
      updatedByUuid: auditUserUuid ?? null,
    });
    return this.getDetail(vesselUuid, period, auditUserUuid);
  },

  /**
   * Office return: CTM submitted/reconciled → open. A returned month is
   * fully editable aboard; any prior reconciliation is void once the month
   * reopens (the office re-reconciles after resubmission).
   */
  async reopenForVessel(
    vesselUuid: string,
    period: string,
    auditUserUuid?: string,
  ): Promise<void> {
    const ctm = await repo.findByVesselPeriod(vesselUuid, period);
    if (ctm && (ctm.status === "submitted" || ctm.status === "reconciled")) {
      await repo.update(ctm.ctmUuid, {
        status: "open",
        updatedByUuid: auditUserUuid ?? null,
      });
    }
  },

  /** Office may mark reconciled before lock. */
  async reconcile(
    vesselUuid: string,
    period: string,
    auditUserUuid?: string,
  ): Promise<AccCtmV2> {
    const ctm = await repo.findByVesselPeriod(vesselUuid, period);
    if (!ctm) {
      throw coded("NOT_FOUND", `CTM not found for ${vesselUuid} ${period}`);
    }
    if (ctm.status === "locked") throw coded("CONFLICT", "CTM is locked");
    const updated = await repo.update(ctm.ctmUuid, {
      status: "reconciled",
      updatedByUuid: auditUserUuid ?? null,
    });
    return updated!;
  },

  /** Portage lock hook: linked CTM → locked. */
  async lockForPortage(
    vesselUuid: string,
    period: string,
    auditUserUuid?: string,
  ): Promise<void> {
    const ctm = await repo.findByVesselPeriod(vesselUuid, period);
    if (ctm && ctm.status !== "locked") {
      await repo.update(ctm.ctmUuid, {
        status: "locked",
        updatedByUuid: auditUserUuid ?? null,
      });
    }
  },
};
