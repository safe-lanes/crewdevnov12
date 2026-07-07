import {
  AdvancesRepository,
  PayElementsRepository,
  EngagementsRepository,
} from "../repositories";
import type { AdvanceRecoveryLine } from "../repositories/advancesRepository";
import type {
  AccAdvanceV2,
  InsertAccAdvanceV2,
} from "../../../../shared/v2/accounts/types";
import { applyAuditUser } from "./auditUtils";

const advancesRepository = new AdvancesRepository();
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

function toCents(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function centsToString(cents: number): string {
  return (cents / 100).toFixed(2);
}

function nextPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return m === 12
    ? `${y + 1}-01`
    : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/**
 * Recovered cents per period from the ledger, deduplicating preview vs
 * portage-attached lines (same rule as the engine clamp): per period,
 * count only the portage-attached lines when any exist, else previews.
 */
function actualsByPeriod(lines: AdvanceRecoveryLine[]): Map<
  string,
  { amountCents: number; portagePosted: boolean }
> {
  const byPeriod = new Map<string, AdvanceRecoveryLine[]>();
  for (const line of lines) {
    const list = byPeriod.get(line.period);
    if (list) list.push(line);
    else byPeriod.set(line.period, [line]);
  }
  const result = new Map<
    string,
    { amountCents: number; portagePosted: boolean }
  >();
  for (const [period, group] of byPeriod) {
    const portageLines = group.filter((l) => l.portageUuid != null);
    const counted = portageLines.length > 0 ? portageLines : group;
    result.set(period, {
      amountCents: counted.reduce((s, l) => s + toCents(l.amount), 0),
      portagePosted: portageLines.length > 0,
    });
  }
  return result;
}

function recoveredCents(lines: AdvanceRecoveryLine[]): number {
  let sum = 0;
  for (const { amountCents } of actualsByPeriod(lines).values()) {
    sum += amountCents;
  }
  return sum;
}

/**
 * Grid/detail status: open / fully-recovered / cancelled / closed.
 * fully-recovered is DERIVED (outstanding = 0), never stored.
 */
function displayStatus(advance: AccAdvanceV2, outstandingCents: number): string {
  if (advance.status === "cancelled") return "cancelled";
  if (advance.status === "closed") return "closed";
  if (outstandingCents <= 0) return "fully-recovered";
  return "open";
}

export interface AdvanceEnriched extends AccAdvanceV2 {
  recoveredToDate: string;
  outstanding: string;
  displayStatus: string;
  vesselUuid: string | null;
  vesselName: string | null;
}

export interface AdvanceDetail {
  advance: AccAdvanceV2;
  schedule: Array<{ period: string; amount: string }>;
  actuals: Array<{ period: string; amount: string; portagePosted: boolean }>;
  recoveredToDate: string;
  outstanding: string;
  displayStatus: string;
}

/** Projected schedule: recovery_amount/month, final month clamped. */
function projectSchedule(
  advance: AccAdvanceV2,
): Array<{ period: string; amount: string }> {
  const totalCents = toCents(advance.amount);
  const recoveryCents = toCents(advance.recoveryAmount);
  if (!advance.period || totalCents <= 0 || recoveryCents <= 0) return [];
  const schedule: Array<{ period: string; amount: string }> = [];
  let outstanding = totalCents;
  let period = advance.period;
  while (outstanding > 0 && schedule.length < 240) {
    const post = Math.min(recoveryCents, outstanding);
    schedule.push({ period, amount: centsToString(post) });
    outstanding -= post;
    period = nextPeriod(period);
  }
  return schedule;
}

/** Portage-attached recovery lines = recoveries actually posted. */
function portageLineCount(lines: AdvanceRecoveryLine[]): number {
  return lines.filter((l) => l.portageUuid != null).length;
}

export const advancesService = {
  async getAll(filters?: {
    crewUuid?: string;
    status?: string;
  }): Promise<AdvanceEnriched[]> {
    const rows = await advancesRepository.findAll(filters);
    const lines = await advancesRepository.findRecoveryLines(
      rows.map((a) => a.advanceUuid),
    );
    const linesByAdvance = new Map<string, AdvanceRecoveryLine[]>();
    for (const line of lines) {
      if (!line.sourceUuid) continue;
      const list = linesByAdvance.get(line.sourceUuid);
      if (list) list.push(line);
      else linesByAdvance.set(line.sourceUuid, [line]);
    }
    const engagementUuids = rows
      .map((a) => a.engagementUuid)
      .filter((u): u is string => u != null);
    const engagements = await engagementsRepo.findByUuids(engagementUuids);
    const engagementByUuid = new Map(
      engagements.map((e) => [e.engagementUuid, e]),
    );
    const vesselNames = await engagementsRepo.findVesselNames(
      engagements
        .map((e) => e.vesselUuid)
        .filter((u): u is string => u != null),
    );
    return rows.map((advance) => {
      const advLines = linesByAdvance.get(advance.advanceUuid) ?? [];
      const recovered = recoveredCents(advLines);
      const outstanding = Math.max(0, toCents(advance.amount) - recovered);
      const engagement = advance.engagementUuid
        ? engagementByUuid.get(advance.engagementUuid)
        : undefined;
      const vesselUuid = engagement?.vesselUuid ?? null;
      return {
        ...advance,
        recoveredToDate: centsToString(recovered),
        outstanding: centsToString(outstanding),
        displayStatus: displayStatus(advance, outstanding),
        vesselUuid,
        vesselName: vesselUuid ? (vesselNames.get(vesselUuid) ?? null) : null,
      };
    });
  },

  async getByCrew(crewUuid: string): Promise<AccAdvanceV2[]> {
    return advancesRepository.findAll({ crewUuid });
  },

  async getByUuid(advanceUuid: string): Promise<AccAdvanceV2> {
    const record = await advancesRepository.findByUuid(advanceUuid);
    if (!record) {
      throw new Error(`Advance not found: ${advanceUuid}`);
    }
    return record;
  },

  /** Detail: schedule projection vs actual ledger recoveries per month. */
  async getDetail(advanceUuid: string): Promise<AdvanceDetail> {
    const advance = await this.getByUuid(advanceUuid);
    const lines = await advancesRepository.findRecoveryLines([advanceUuid]);
    const actuals = Array.from(actualsByPeriod(lines).entries())
      .map(([period, a]) => ({
        period,
        amount: centsToString(a.amountCents),
        portagePosted: a.portagePosted,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));
    const recovered = recoveredCents(lines);
    const outstanding = Math.max(0, toCents(advance.amount) - recovered);
    return {
      advance,
      schedule: projectSchedule(advance),
      actuals,
      recoveredToDate: centsToString(recovered),
      outstanding: centsToString(outstanding),
      displayStatus: displayStatus(advance, outstanding),
    };
  },

  async create(
    data: Omit<InsertAccAdvanceV2, "advanceUuid"> & {
      auditUserUuid?: string;
    },
  ): Promise<AccAdvanceV2> {
    if (!data.crewUuid) throw new Error("crewUuid is required");
    if (toCents(data.amount) <= 0) {
      throw coded("VALIDATION", "amount must be greater than 0");
    }
    if (toCents(data.recoveryAmount) <= 0) {
      throw coded("VALIDATION", "recoveryAmount (per month) must be greater than 0");
    }
    if (!data.period || !PERIOD_RE.test(data.period)) {
      throw coded("VALIDATION", "period (first recovery month, YYYY-MM) is required");
    }
    // Default the recovery element to the Advance Recovery element.
    let recoveryPayElementUuid = data.recoveryPayElementUuid ?? null;
    if (!recoveryPayElementUuid) {
      const elements = await payElementsRepo.findAll({
        status: "active",
        category: "advance_recovery",
      });
      recoveryPayElementUuid = elements[0]?.payElementUuid ?? null;
    }
    return advancesRepository.create(
      applyAuditUser(
        {
          ...data,
          recoveryPayElementUuid,
          status: "open",
        },
        true,
      ),
    );
  },

  /** Editable only while no recovery has been posted (portage-attached). */
  async update(
    advanceUuid: string,
    data: Partial<InsertAccAdvanceV2> & { auditUserUuid?: string },
  ): Promise<AccAdvanceV2> {
    const existing = await this.getByUuid(advanceUuid);
    if (existing.status === "cancelled" || existing.status === "closed") {
      throw coded("CONFLICT", `Advance is ${existing.status}; it can no longer be edited`);
    }
    if (data.status && data.status !== existing.status) {
      throw coded(
        "VALIDATION",
        "Status changes go through the cancel/close endpoints",
      );
    }
    const lines = await advancesRepository.findRecoveryLines([advanceUuid]);
    if (portageLineCount(lines) > 0) {
      throw coded(
        "CONFLICT",
        "Recovery has already been posted for this advance; it can no longer be edited (use close to write off the remainder)",
      );
    }
    if (data.amount != null && toCents(data.amount) <= 0) {
      throw coded("VALIDATION", "amount must be greater than 0");
    }
    if (data.recoveryAmount != null && toCents(data.recoveryAmount) <= 0) {
      throw coded("VALIDATION", "recoveryAmount (per month) must be greater than 0");
    }
    if (data.period != null && !PERIOD_RE.test(data.period)) {
      throw coded("VALIDATION", "period must be YYYY-MM");
    }
    const updated = await advancesRepository.update(
      advanceUuid,
      applyAuditUser(data, false),
    );
    if (!updated) {
      throw new Error(`Failed to update advance: ${advanceUuid}`);
    }
    return updated;
  },

  /** Cancel: allowed only while NO recovery has been posted. */
  async cancel(
    advanceUuid: string,
    auditUserUuid?: string,
  ): Promise<AccAdvanceV2> {
    const existing = await this.getByUuid(advanceUuid);
    if (existing.status === "cancelled" || existing.status === "closed") {
      throw coded("CONFLICT", `Advance is already ${existing.status}`);
    }
    const lines = await advancesRepository.findRecoveryLines([advanceUuid]);
    if (portageLineCount(lines) > 0) {
      throw coded(
        "CONFLICT",
        "Recovery has already been posted for this advance; use close to write off the remainder instead",
      );
    }
    const updated = await advancesRepository.update(
      advanceUuid,
      applyAuditUser({ status: "cancelled", auditUserUuid }, false),
    );
    return updated!;
  },

  /**
   * Close: write off the remainder with a required remark. Service rule
   * (documented): closing posts NOTHING to the ledger — the outstanding
   * balance is simply written off and the advance stops recovering
   * (engine only posts for open/approved/disbursed advances).
   */
  async close(
    advanceUuid: string,
    remark: string,
    auditUserUuid?: string,
  ): Promise<AccAdvanceV2> {
    if (!remark?.trim()) {
      throw coded("VALIDATION", "A remark is required to close an advance (write-off reason)");
    }
    const existing = await this.getByUuid(advanceUuid);
    if (existing.status === "cancelled" || existing.status === "closed") {
      throw coded("CONFLICT", `Advance is already ${existing.status}`);
    }
    const lines = await advancesRepository.findRecoveryLines([advanceUuid]);
    const outstanding = Math.max(
      0,
      toCents(existing.amount) - recoveredCents(lines),
    );
    const writeOffNote = `Write-off ${centsToString(outstanding)}: ${remark.trim()}`;
    const reason = existing.reason
      ? `${existing.reason}\n${writeOffNote}`
      : writeOffNote;
    const updated = await advancesRepository.update(
      advanceUuid,
      applyAuditUser({ status: "closed", reason, auditUserUuid }, false),
    );
    return updated!;
  },

  async delete(advanceUuid: string): Promise<void> {
    const existing = await this.getByUuid(advanceUuid);
    const lines = await advancesRepository.findRecoveryLines([
      existing.advanceUuid,
    ]);
    if (portageLineCount(lines) > 0) {
      throw coded(
        "CONFLICT",
        "Recovery has already been posted for this advance; it cannot be deleted",
      );
    }
    const success = await advancesRepository.softDelete(advanceUuid);
    if (!success) {
      throw new Error(`Failed to delete advance: ${advanceUuid}`);
    }
  },
};
