import {
  AllotmentsRepository,
  EngagementsRepository,
  WageScalesRepository,
  PayElementsRepository,
  TenantConfigRepository,
} from "../repositories";
import type {
  AccAllotmentV2,
  InsertAccAllotmentV2,
} from "../../../../shared/v2/accounts/types";
import { applyAuditUser } from "./auditUtils";

const allotmentsRepository = new AllotmentsRepository();
const engagementsRepo = new EngagementsRepository();
const wageScalesRepo = new WageScalesRepository();
const payElementsRepo = new PayElementsRepository();
const tenantConfigRepo = new TenantConfigRepository();

const VALID_STATUSES = new Set(["active", "suspended", "ended"]);

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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

export interface AllotmentEnriched extends AccAllotmentV2 {
  vesselUuid: string | null;
  vesselName: string | null;
  postedThisMonth: boolean;
}

export interface AllotmentMutationResult {
  record: AccAllotmentV2;
  /** Soft cap exceeded (never blocks — spec Prompt 07 Part 3). */
  capWarning?: string;
  /** Soft cap check skipped (unresolvable scale etc.). */
  capNote?: string;
}

/**
 * Soft cap (spec Prompt 07 Part 3): when tenant max_allotment_percent is
 * set, compare the crew's TOTAL active allotment value against
 * percent × scale-resolved monthly gross for their rank. Warning only —
 * never blocks; unresolvable scale skips the check with a note.
 */
async function softCapCheck(
  crewUuid: string,
  candidate: {
    allotmentUuid?: string;
    allotmentType: string;
    value: string | number | null | undefined;
    status: string;
  },
): Promise<{ capWarning?: string; capNote?: string }> {
  const cfg = await tenantConfigRepo.findSingle();
  const pct = cfg?.maxAllotmentPercent ? Number(cfg.maxAllotmentPercent) : 0;
  if (!pct || pct <= 0) return {};

  const engagements = (await engagementsRepo.findByCrewUuids([crewUuid]))
    .filter((e) => e.status !== "cancelled")
    .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""));
  const engagement =
    engagements.find((e) => e.status === "active") ?? engagements[0];
  if (!engagement) {
    return { capNote: "Soft cap check skipped: crew has no engagement" };
  }
  if (!engagement.wageScaleUuid || !engagement.rankIdAtStart) {
    return {
      capNote:
        "Soft cap check skipped: engagement has no wage scale or rank to resolve monthly gross",
    };
  }
  const [scaleLines, elements] = await Promise.all([
    wageScalesRepo.findLinesByScale(engagement.wageScaleUuid),
    payElementsRepo.findAll({ status: "active" }),
  ]);
  const elementByUuid = new Map(elements.map((e) => [e.payElementUuid, e]));
  const grossCents = scaleLines
    .filter(
      (l) =>
        l.rankId === engagement.rankIdAtStart &&
        l.amount != null &&
        elementByUuid.get(l.payElementUuid)?.type === "earning",
    )
    .reduce((s, l) => s + toCents(l.amount), 0);
  if (grossCents <= 0) {
    return {
      capNote:
        "Soft cap check skipped: monthly gross not resolvable from the wage scale for the crew's rank",
    };
  }

  const others = (
    await allotmentsRepository.findAll({ crewUuid, status: "active" })
  ).filter((a) => a.allotmentUuid !== candidate.allotmentUuid);
  const counted: Array<{ allotmentType: string; value: unknown }> =
    candidate.status === "active" ? [...others, candidate] : [...others];
  const totalCents = counted.reduce((s, a) => {
    if (a.allotmentType === "percentage") {
      return s + Math.round((grossCents * Number(a.value ?? 0)) / 100);
    }
    return s + toCents(a.value as string | number | null);
  }, 0);
  const capCents = Math.round((grossCents * pct) / 100);
  if (totalCents > capCents) {
    return {
      capWarning: `Total active allotments ${(totalCents / 100).toFixed(2)} exceed the cap of ${pct}% of monthly gross ${(grossCents / 100).toFixed(2)} (cap ${(capCents / 100).toFixed(2)})`,
    };
  }
  return {};
}

export const allotmentsService = {
  async getAll(filters?: {
    crewUuid?: string;
    status?: string;
    vesselUuid?: string;
  }): Promise<AllotmentEnriched[]> {
    const rows = await allotmentsRepository.findAll({
      crewUuid: filters?.crewUuid,
      status: filters?.status,
    });
    const crewUuids = Array.from(new Set(rows.map((a) => a.crewUuid)));
    const [engagements, postedUuids] = await Promise.all([
      engagementsRepo.findByCrewUuids(crewUuids),
      allotmentsRepository.findPostedAllotmentUuids(currentPeriod()),
    ]);
    const engagementByUuid = new Map(
      engagements.map((e) => [e.engagementUuid, e]),
    );
    // Fallback vessel per crew: latest non-cancelled engagement.
    const crewEngagement = new Map<string, (typeof engagements)[number]>();
    for (const e of engagements) {
      if (e.status === "cancelled") continue;
      const cur = crewEngagement.get(e.crewUuid);
      if (
        !cur ||
        (e.status === "active" && cur.status !== "active") ||
        (e.status === cur.status &&
          (e.startDate ?? "") > (cur.startDate ?? ""))
      ) {
        crewEngagement.set(e.crewUuid, e);
      }
    }
    const vesselNames = await engagementsRepo.findVesselNames(
      Array.from(
        new Set(
          engagements
            .map((e) => e.vesselUuid)
            .filter((u): u is string => u != null),
        ),
      ),
    );
    const enriched = rows.map((a) => {
      const engagement =
        (a.engagementUuid
          ? engagementByUuid.get(a.engagementUuid)
          : undefined) ?? crewEngagement.get(a.crewUuid);
      const vesselUuid = engagement?.vesselUuid ?? null;
      return {
        ...a,
        vesselUuid,
        vesselName: vesselUuid ? (vesselNames.get(vesselUuid) ?? null) : null,
        postedThisMonth: postedUuids.has(a.allotmentUuid),
      };
    });
    return filters?.vesselUuid
      ? enriched.filter((a) => a.vesselUuid === filters.vesselUuid)
      : enriched;
  },

  async getByCrew(crewUuid: string): Promise<AccAllotmentV2[]> {
    return allotmentsRepository.findAll({ crewUuid });
  },

  async getByUuid(allotmentUuid: string): Promise<AccAllotmentV2> {
    const record = await allotmentsRepository.findByUuid(allotmentUuid);
    if (!record) {
      throw new Error(`Allotment not found: ${allotmentUuid}`);
    }
    return record;
  },

  async create(
    data: Omit<InsertAccAllotmentV2, "allotmentUuid"> & {
      auditUserUuid?: string;
    },
  ): Promise<AllotmentMutationResult> {
    if (!data.crewUuid) throw new Error("crewUuid is required");
    if (!data.beneficiaryName) throw new Error("beneficiaryName is required");
    if (!data.allotmentType) throw new Error("allotmentType is required");
    if (toCents(data.value) <= 0) {
      throw coded("VALIDATION", "amount must be greater than 0");
    }
    if (!data.validFrom) {
      throw coded("VALIDATION", "validFrom is required");
    }
    if (data.status && !VALID_STATUSES.has(data.status)) {
      throw coded("VALIDATION", "status must be active, suspended or ended");
    }
    const record = await allotmentsRepository.create(
      applyAuditUser(data, true),
    );
    const cap = await softCapCheck(record.crewUuid, {
      allotmentUuid: record.allotmentUuid,
      allotmentType: record.allotmentType,
      value: record.value,
      status: record.status,
    });
    return { record, ...cap };
  },

  async update(
    allotmentUuid: string,
    data: Partial<InsertAccAllotmentV2> & { auditUserUuid?: string },
  ): Promise<AllotmentMutationResult> {
    const existing = await this.getByUuid(allotmentUuid);
    if (data.value != null && toCents(data.value) <= 0) {
      throw coded("VALIDATION", "amount must be greater than 0");
    }
    if (data.status && !VALID_STATUSES.has(data.status)) {
      throw coded("VALIDATION", "status must be active, suspended or ended");
    }
    const updated = await allotmentsRepository.update(
      allotmentUuid,
      applyAuditUser(data, false),
    );
    if (!updated) {
      throw new Error(`Failed to update allotment: ${allotmentUuid}`);
    }
    const cap = await softCapCheck(updated.crewUuid, {
      allotmentUuid: updated.allotmentUuid,
      allotmentType: updated.allotmentType,
      value: updated.value,
      status: updated.status,
    });
    return { record: updated, ...cap };
  },

  /** Suspend an active allotment (engine stops posting it). */
  async suspend(
    allotmentUuid: string,
    auditUserUuid?: string,
  ): Promise<AccAllotmentV2> {
    const existing = await this.getByUuid(allotmentUuid);
    if (existing.status !== "active") {
      throw coded("CONFLICT", `Allotment is ${existing.status}; only active allotments can be suspended`);
    }
    const updated = await allotmentsRepository.update(
      allotmentUuid,
      applyAuditUser({ status: "suspended", auditUserUuid }, false),
    );
    return updated!;
  },

  /** Reactivate a suspended allotment. */
  async reactivate(
    allotmentUuid: string,
    auditUserUuid?: string,
  ): Promise<AccAllotmentV2> {
    const existing = await this.getByUuid(allotmentUuid);
    if (existing.status !== "suspended") {
      throw coded("CONFLICT", `Allotment is ${existing.status}; only suspended allotments can be reactivated`);
    }
    const updated = await allotmentsRepository.update(
      allotmentUuid,
      applyAuditUser({ status: "active", auditUserUuid }, false),
    );
    return updated!;
  },

  /** End an allotment: sets valid_to (default today) and status ended. */
  async end(
    allotmentUuid: string,
    validTo?: string,
    auditUserUuid?: string,
  ): Promise<AccAllotmentV2> {
    const existing = await this.getByUuid(allotmentUuid);
    if (existing.status === "ended") {
      throw coded("CONFLICT", "Allotment is already ended");
    }
    const updated = await allotmentsRepository.update(
      allotmentUuid,
      applyAuditUser(
        {
          status: "ended",
          validTo: validTo ?? existing.validTo ?? todayIso(),
          auditUserUuid,
        },
        false,
      ),
    );
    return updated!;
  },

  async delete(allotmentUuid: string): Promise<void> {
    await this.getByUuid(allotmentUuid);
    const success = await allotmentsRepository.softDelete(allotmentUuid);
    if (!success) {
      throw new Error(`Failed to delete allotment: ${allotmentUuid}`);
    }
  },
};
