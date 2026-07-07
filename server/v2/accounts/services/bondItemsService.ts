import {
  BondItemsRepository,
  MonthlyTransactionsRepository,
  PayElementsRepository,
  EngagementsRepository,
} from "../repositories";
import type {
  AccBondItemV2,
  InsertAccBondItemV2,
  AccMonthlyTransactionV2,
  AccEngagementV2,
} from "../../../../shared/v2/accounts/types";
import { applyAuditUser } from "./auditUtils";

const bondItemsRepository = new BondItemsRepository();
const txnRepo = new MonthlyTransactionsRepository();
const payElementsRepo = new PayElementsRepository();
const engagementsRepo = new EngagementsRepository();

const PERIOD_RE = /^\d{4}-\d{2}$/;

function coded(
  code: "CONFLICT" | "VALIDATION" | "NOT_FOUND",
  message: string,
): Error {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  return err;
}

function monthBounds(period: string): { monthStart: string; monthEnd: string } {
  const [y, m] = period.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    monthStart: `${period}-01`,
    monthEnd: `${period}-${String(lastDay).padStart(2, "0")}`,
  };
}

function toCents(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Deduction basis per item: explicit deduction_amount, else total price. */
function itemDeductionCents(item: AccBondItemV2): number {
  return toCents(item.deductionAmount ?? item.totalPrice);
}

/** Same lock rule as monthly transactions: locked portage = read-only. */
async function assertUnlocked(
  vesselUuid: string | null | undefined,
  period: string,
): Promise<void> {
  if (!vesselUuid) return;
  const portage = await txnRepo.findPortage(vesselUuid, period);
  if (portage && (portage.isLocked || portage.status === "locked")) {
    throw coded(
      "CONFLICT",
      `Portage bill for vessel ${vesselUuid} period ${period} is locked; bond items are read-only`,
    );
  }
}

/**
 * The engagement the rollup transaction posts against: an explicit
 * engagement on a bond item wins, else the crew's engagement covering the
 * period (error when none — the rollup needs an engagement to post).
 */
async function resolveEngagement(
  crewUuid: string,
  period: string,
  explicitUuid: string | null | undefined,
): Promise<AccEngagementV2> {
  if (explicitUuid) {
    const engagement = await engagementsRepo.findByUuid(explicitUuid);
    if (!engagement) {
      throw coded("VALIDATION", `Engagement not found: ${explicitUuid}`);
    }
    return engagement;
  }
  const { monthStart, monthEnd } = monthBounds(period);
  const candidates = (await engagementsRepo.findByCrewUuids([crewUuid]))
    .filter(
      (e) =>
        e.status !== "cancelled" &&
        e.startDate != null &&
        e.startDate <= monthEnd &&
        (e.endDate == null || e.endDate >= monthStart),
    )
    .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""));
  if (candidates.length === 0) {
    throw coded(
      "VALIDATION",
      `No engagement covers ${period} for crew ${crewUuid}; bond items need an engagement for the monthly rollup`,
    );
  }
  return candidates[0];
}

async function findRollup(
  crewUuid: string,
  period: string,
): Promise<AccMonthlyTransactionV2 | undefined> {
  const txns = await txnRepo.findAll({ crewUuid, period });
  return txns.find((t) => t.sourceType === "bond");
}

/**
 * Single-posting-path (spec Prompt 07 2a): maintain exactly ONE rolled-up
 * monthly transaction per (crew, period) — element category
 * bond_slop_chest, source_type='bond', origin office, status accepted,
 * amount = Σ deduction_amount of live, auto-deduct, non-cancelled items.
 * Σ = 0 (or no items) removes the rollup. The engine posts bond only via
 * this transaction; it never reads acc_bond_items_v2 directly anymore.
 */
async function recomputeRollup(
  crewUuid: string,
  period: string,
  auditUserUuid?: string,
): Promise<AccMonthlyTransactionV2 | null> {
  const items = (await bondItemsRepository.findAll({ crewUuid, period })).filter(
    (i) => i.status !== "cancelled" && i.autoDeduct,
  );
  const totalCents = items.reduce((s, i) => s + itemDeductionCents(i), 0);
  const existing = await findRollup(crewUuid, period);

  if (totalCents <= 0) {
    if (existing) {
      await txnRepo.softDelete(existing.txnUuid);
    }
    await bondItemsRepository.linkTxn(crewUuid, period, null);
    return null;
  }

  const engagement = await resolveEngagement(
    crewUuid,
    period,
    items.find((i) => i.engagementUuid)?.engagementUuid ?? null,
  );
  const elements = await payElementsRepo.findAll({
    status: "active",
    category: "bond_slop_chest",
  });
  if (elements.length === 0) {
    throw coded(
      "VALIDATION",
      "no active pay element with category 'bond_slop_chest'",
    );
  }
  const payload = {
    crewUuid,
    period,
    engagementUuid: engagement.engagementUuid,
    vesselUuid: engagement.vesselUuid,
    payElementUuid: elements[0].payElementUuid,
    qty: null,
    rate: null,
    amount: (totalCents / 100).toFixed(2),
    currency: items[0].currency ?? engagement.currency,
    origin: "office",
    status: "accepted",
    sourceType: "bond",
    sourceUuid: `bond:${crewUuid}:${period}`,
    remarks: `Bond/slop chest rollup (${items.length} item${items.length === 1 ? "" : "s"})`,
    auditUserUuid,
  };

  let rollup: AccMonthlyTransactionV2 | undefined;
  if (existing) {
    rollup = await txnRepo.update(
      existing.txnUuid,
      applyAuditUser(payload, false),
    );
  } else {
    try {
      rollup = await txnRepo.create(applyAuditUser(payload, true));
    } catch (error) {
      // Concurrent create: the partial unique index
      // (uq_acc_monthly_txn_bond_rollup) allows only one live rollup per
      // crew-month — fall back to updating the winner.
      const winner = await findRollup(crewUuid, period);
      if (!winner) throw error;
      rollup = await txnRepo.update(
        winner.txnUuid,
        applyAuditUser(payload, false),
      );
    }
  }
  if (!rollup) {
    throw new Error(
      `Failed to upsert bond rollup transaction for crew ${crewUuid} period ${period}`,
    );
  }
  await bondItemsRepository.linkTxn(crewUuid, period, rollup.txnUuid);
  return rollup;
}

export const bondItemsService = {
  async getAll(filters?: {
    crewUuid?: string;
    status?: string;
    period?: string;
    vesselUuid?: string;
  }): Promise<AccBondItemV2[]> {
    const items = await bondItemsRepository.findAll({
      crewUuid: filters?.crewUuid,
      status: filters?.status,
      period: filters?.period,
    });
    if (!filters?.vesselUuid) return items;
    // Vessel scope resolves through the linked rollup transactions.
    const txns = await txnRepo.findAll({
      vesselUuid: filters.vesselUuid,
      period: filters.period,
    });
    const vesselTxns = new Set(
      txns.filter((t) => t.sourceType === "bond").map((t) => t.txnUuid),
    );
    return items.filter((i) => i.txnUuid != null && vesselTxns.has(i.txnUuid));
  },

  async getByCrew(crewUuid: string): Promise<AccBondItemV2[]> {
    return bondItemsRepository.findAll({ crewUuid });
  },

  async getByUuid(bondItemUuid: string): Promise<AccBondItemV2> {
    const record = await bondItemsRepository.findByUuid(bondItemUuid);
    if (!record) {
      throw new Error(`Bond item not found: ${bondItemUuid}`);
    }
    return record;
  },

  async create(
    data: Omit<InsertAccBondItemV2, "bondItemUuid"> & {
      auditUserUuid?: string;
    },
  ): Promise<AccBondItemV2> {
    if (!data.crewUuid) throw new Error("crewUuid is required");
    if (!data.itemName) throw new Error("itemName is required");
    if (!data.period || !PERIOD_RE.test(data.period)) {
      throw coded("VALIDATION", "period is required (YYYY-MM)");
    }
    // Derive total from quantity × unit price when not supplied.
    let totalPrice = data.totalPrice;
    if (totalPrice == null && data.quantity != null && data.unitPrice != null) {
      totalPrice = (Number(data.quantity) * Number(data.unitPrice)).toFixed(2);
    }
    const deductionAmount = data.deductionAmount ?? totalPrice;
    if (deductionAmount != null && Number(deductionAmount) < 0) {
      throw coded("VALIDATION", "deduction amount cannot be negative");
    }
    const engagement = await resolveEngagement(
      data.crewUuid,
      data.period,
      data.engagementUuid,
    );
    await assertUnlocked(engagement.vesselUuid, data.period);
    const created = await bondItemsRepository.create(
      applyAuditUser(
        {
          ...data,
          totalPrice: totalPrice ?? "0",
          deductionAmount,
          engagementUuid: engagement.engagementUuid,
        },
        true,
      ),
    );
    await recomputeRollup(data.crewUuid, data.period, data.auditUserUuid);
    return (await bondItemsRepository.findByUuid(created.bondItemUuid))!;
  },

  async update(
    bondItemUuid: string,
    data: Partial<InsertAccBondItemV2> & { auditUserUuid?: string },
  ): Promise<AccBondItemV2> {
    const existing = await this.getByUuid(bondItemUuid);
    if (data.period != null && !PERIOD_RE.test(data.period)) {
      throw coded("VALIDATION", "period must be YYYY-MM");
    }
    const nextCrew = data.crewUuid ?? existing.crewUuid;
    const nextPeriod = data.period ?? existing.period;

    // Lock-state guard on the source month (and target month when moved).
    if (existing.period) {
      const eng = await resolveEngagement(
        existing.crewUuid,
        existing.period,
        existing.engagementUuid,
      ).catch(() => null);
      await assertUnlocked(eng?.vesselUuid, existing.period);
    }
    let targetEngagement: AccEngagementV2 | null = null;
    if (
      nextPeriod &&
      (nextCrew !== existing.crewUuid || nextPeriod !== existing.period)
    ) {
      targetEngagement = await resolveEngagement(
        nextCrew,
        nextPeriod,
        data.engagementUuid,
      );
      await assertUnlocked(targetEngagement.vesselUuid, nextPeriod);
    }

    const updated = await bondItemsRepository.update(
      bondItemUuid,
      applyAuditUser(
        targetEngagement
          ? { ...data, engagementUuid: targetEngagement.engagementUuid }
          : data,
        false,
      ),
    );
    if (!updated) {
      throw new Error(`Failed to update bond item: ${bondItemUuid}`);
    }
    if (existing.period) {
      await recomputeRollup(
        existing.crewUuid,
        existing.period,
        data.auditUserUuid,
      );
    }
    if (
      nextPeriod &&
      (nextCrew !== existing.crewUuid || nextPeriod !== existing.period)
    ) {
      await recomputeRollup(nextCrew, nextPeriod, data.auditUserUuid);
    }
    return (await bondItemsRepository.findByUuid(bondItemUuid))!;
  },

  async delete(bondItemUuid: string, auditUserUuid?: string): Promise<void> {
    const existing = await this.getByUuid(bondItemUuid);
    if (existing.period) {
      const eng = await resolveEngagement(
        existing.crewUuid,
        existing.period,
        existing.engagementUuid,
      ).catch(() => null);
      await assertUnlocked(eng?.vesselUuid, existing.period);
    }
    const success = await bondItemsRepository.softDelete(bondItemUuid);
    if (!success) {
      throw new Error(`Failed to delete bond item: ${bondItemUuid}`);
    }
    if (existing.period) {
      await recomputeRollup(existing.crewUuid, existing.period, auditUserUuid);
    }
  },
};
