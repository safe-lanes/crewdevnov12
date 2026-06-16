import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db";
import {
  CrewSeaServiceRepository,
  type CrewSeaServiceWithAttachments,
} from "../repositories";
import { crewMembersService } from "./crewMembersService";
import {
  crewSeaService,
  crewSeaServiceAttachments,
} from "../../../../shared/v2/crew-pool/schema";
import type {
  InsertCrewSeaService,
  CrewSeaService as CrewSeaServiceType,
  InsertCrewSeaServiceAttachment,
  CrewSeaServiceAttachment,
} from "../../../../shared/v2/crew-pool/types";
import { resolveVesselUuid, resolveVesselTypeUuid } from "./masterDataResolver";

const crewSeaServiceRepository = new CrewSeaServiceRepository();

// Helper to extract and apply audit user fields
function applyAuditUser<T extends object>(data: T, isCreate = false): T & { createdByUuid?: string | null; updatedByUuid?: string | null } {
  const auditUserUuid = (data as any).auditUserUuid || null;
  const result = { ...data } as any;
  delete result.auditUserUuid;
  if (isCreate) result.createdByUuid = auditUserUuid;
  result.updatedByUuid = auditUserUuid;
  return result;
}

// Build a UTC-midnight Date from a 1-based calendar y/m/d, rejecting overflow
// values (e.g. 30 Feb, month 13) instead of letting Date roll them over.
function buildUtcDay(year: number, month1: number, day: number): Date | null {
  if (isNaN(year) || isNaN(month1) || isNaN(day)) return null;
  const d = new Date(Date.UTC(year, month1 - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month1 - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return d;
}

// Parse a sea-service date string (ISO 8601 or dd/mm/yyyy) into a UTC-midnight
// Date. dd/mm/yyyy is checked first because `new Date("01/05/2025")` would
// otherwise be misread as the US m/d/y order. The calendar date is validated
// strictly (overflow dates are rejected). Returns null when unparseable.
function parseSeaDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;

  // dd/mm/yyyy
  const slash = s.split("/");
  if (slash.length === 3) {
    return buildUtcDay(
      parseInt(slash[2], 10),
      parseInt(slash[1], 10),
      parseInt(slash[0], 10)
    );
  }

  // ISO 8601 date or datetime — validate the leading calendar date strictly so
  // overflow values (e.g. 2025-02-30) are rejected rather than rolled over.
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return buildUtcDay(
      parseInt(iso[1], 10),
      parseInt(iso[2], 10),
      parseInt(iso[3], 10)
    );
  }
  return null;
}

// Canonical YYYY-MM-DD for a UTC-midnight Date (used for both storage and
// calendar-day comparisons regardless of the source format).
function toIsoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Outcome of deciding what a promotion split would do, BEFORE any write.
type SplitPlan =
  | { status: "skipped-invalid-input" }
  | { status: "already-split" }
  | {
      status: "create";
      crewUuid: string;
      newRank: string;
      splitIso: string;
      dayBeforeIso: string;
      // Date to set as the previous line's `toDate` when closing it. Normally
      // the day before the split, but clamped so it is never earlier than the
      // previous line's own `fromDate` (same-day sign-on + promotion case).
      closePreviousToIso: string;
      previous: CrewSeaServiceType | null;
    };

// Decide what `splitForPromotion` would do WITHOUT writing anything. Shared by
// the live split (which then performs the writes) and the read-only
// `previewSplitForPromotion` used by the Phase 5 backfill dry-run, so the
// idempotency rule and the safe close-previous logic live in exactly one place.
async function resolveSplitPlan(params: {
  crewUuid: string;
  newRank: string;
  splitDate: string;
  oldRank?: string | null;
}): Promise<SplitPlan> {
  const crewUuid = (params.crewUuid ?? "").trim();
  const newRank = (params.newRank ?? "").trim();
  const splitDay = parseSeaDate(params.splitDate);
  if (!crewUuid || !newRank || !splitDay) {
    return { status: "skipped-invalid-input" };
  }

  const splitIso = toIsoDay(splitDay);

  const lines = await crewSeaServiceRepository.findByCrewUuidAndType(
    crewUuid,
    "company"
  );

  // Idempotency: a non-deleted new-rank Company line that already starts on,
  // or already covers, the split date means the split has already happened.
  const alreadySplit = lines.some((l) => {
    if ((l.rank ?? "").trim() !== newRank) return false;
    const from = parseSeaDate(l.fromDate);
    if (!from) return false;
    if (toIsoDay(from) === splitIso) return true;
    const to = parseSeaDate(l.toDate);
    const coversStart = from.getTime() <= splitDay.getTime();
    const coversEnd = !to || to.getTime() >= splitDay.getTime();
    return coversStart && coversEnd;
  });
  if (alreadySplit) {
    return { status: "already-split" };
  }

  // Previous-rank line to close: a Company line that started before the split
  // date and is still open (or ends on/after it). Prefer the old rank, then
  // the most recent such line.
  const sortByFromDesc = (a: CrewSeaServiceType, b: CrewSeaServiceType) =>
    (parseSeaDate(b.fromDate)?.getTime() ?? 0) -
    (parseSeaDate(a.fromDate)?.getTime() ?? 0);

  // Include lines that start ON the split date (`from <= splitDay`), not only
  // those strictly before it. When a crew signs on and is promoted on the same
  // day, the current line starts on the split date; excluding it would leave it
  // open (rendered as "currently on board") and force the new promoted line to
  // be created with no vessel to copy from.
  const openCandidates = lines.filter((l) => {
    const from = parseSeaDate(l.fromDate);
    if (!from || from.getTime() > splitDay.getTime()) return false;
    const to = parseSeaDate(l.toDate);
    return !to || to.getTime() >= splitDay.getTime();
  });

  const oldRank = (params.oldRank ?? "").trim();
  const previous =
    (oldRank
      ? openCandidates
          .filter((l) => (l.rank ?? "").trim() === oldRank)
          .sort(sortByFromDesc)[0]
      : undefined) ??
    [...openCandidates].sort(sortByFromDesc)[0] ??
    null;

  // Day immediately before the split date keeps the close-old / open-new
  // boundary exactly adjacent (no overlap, no gap).
  const dayBeforeIso = toIsoDay(
    new Date(splitDay.getTime() - 24 * 60 * 60 * 1000)
  );

  // When closing the previous line, never set its `toDate` earlier than its own
  // `fromDate`. For the same-day case (previous starts on the split date) this
  // clamps the close to the split date itself instead of the day before, which
  // would otherwise produce an invalid To-before-From line.
  const previousFrom = previous ? parseSeaDate(previous.fromDate) : null;
  const closePreviousToIso =
    previousFrom && previousFrom.getTime() >= splitDay.getTime()
      ? splitIso
      : dayBeforeIso;

  return {
    status: "create",
    crewUuid,
    newRank,
    splitIso,
    dayBeforeIso,
    closePreviousToIso,
    previous,
  };
}

export interface ExperienceMetrics {
  totalSeaTimeMonths: number;
  companySeaTimeMonths: number;
  externalSeaTimeMonths: number;
  rankExperienceMonths: number;
  vesselTypeExperience: Record<string, number>;
}

export const crewSeaServiceService = {
  async getAll(crewUuid: string): Promise<CrewSeaServiceWithAttachments[]> {
    await crewMembersService.getByUuid(crewUuid);
    return crewSeaServiceRepository.findByCrewUuidWithAttachments(crewUuid);
  },

  async getByType(
    crewUuid: string,
    serviceType: string
  ): Promise<CrewSeaServiceType[]> {
    await crewMembersService.getByUuid(crewUuid);
    return crewSeaServiceRepository.findByCrewUuidAndType(
      crewUuid,
      serviceType
    );
  },

  async getByUuid(seaUuid: string): Promise<CrewSeaServiceType> {
    const service = await crewSeaServiceRepository.findByUuid(seaUuid);
    if (!service) {
      throw new Error(`Sea service record not found: ${seaUuid}`);
    }
    return service;
  },

  async create(
    crewUuid: string,
    data: Omit<InsertCrewSeaService, "seaUuid" | "crewUuid"> & { vessel?: string; vesselType?: string }
  ): Promise<CrewSeaServiceType> {
    await crewMembersService.getByUuid(crewUuid);

    if (data.fromDate && data.toDate) {
      const fromDate = new Date(data.fromDate);
      const toDate = new Date(data.toDate);
      if (fromDate > toDate) {
        throw new Error("From date cannot be after to date");
      }
    }

    // Resolve master data UUIDs and apply audit user
    const resolvedData = await this.resolveMasterDataFields(data);
    const dataWithAudit = applyAuditUser(resolvedData, true);

    return crewSeaServiceRepository.create({ ...dataWithAudit, crewUuid });
  },

  async update(
    seaUuid: string,
    data: Partial<InsertCrewSeaService> & { vessel?: string; vesselType?: string }
  ): Promise<CrewSeaServiceType> {
    await this.getByUuid(seaUuid);

    if (data.fromDate && data.toDate) {
      const fromDate = new Date(data.fromDate);
      const toDate = new Date(data.toDate);
      if (fromDate > toDate) {
        throw new Error("From date cannot be after to date");
      }
    }

    // Resolve master data UUIDs and apply audit user
    const resolvedData = await this.resolveMasterDataFields(data);
    const dataWithAudit = applyAuditUser(resolvedData, false);

    const updated = await crewSeaServiceRepository.update(seaUuid, dataWithAudit);
    if (!updated) {
      throw new Error(`Failed to update sea service record: ${seaUuid}`);
    }
    return updated;
  },

  /**
   * Resolve vessel and vesselType to UUIDs
   * - For company sea service (E1): resolve both vesselUuid and vesselTypeUuid
   * - For external sea service (E2): resolve only vesselTypeUuid (vessel is free entry)
   */
  async resolveMasterDataFields<T extends Record<string, any>>(
    data: T
  ): Promise<Omit<T, 'vessel' | 'vesselType'>> {
    const { vessel, vesselType, ...rest } = data;
    const result = { ...rest } as any;

    // For company sea service (E1), resolve vessel to UUID
    // For external (E2), vessel is free entry so skip resolution
    const isCompanyService = data.serviceType === 'company';
    
    if (isCompanyService) {
      const vesselInput = data.vesselUuid || vessel;
      if (vesselInput) {
        const vesselUuid = await resolveVesselUuid(vesselInput);
        if (!vesselUuid) {
          throw new Error(`Invalid vessel: "${vesselInput}". Not found in master_vessels table.`);
        }
        result.vesselUuid = vesselUuid;
      }
    }

    // Resolve vesselType for both E1 and E2
    const vesselTypeInput = data.vesselTypeUuid || vesselType;
    if (vesselTypeInput) {
      const vesselTypeUuid = await resolveVesselTypeUuid(vesselTypeInput);
      if (!vesselTypeUuid) {
        throw new Error(`Invalid vessel type: "${vesselTypeInput}". Not found in master_vessel_types table.`);
      }
      result.vesselTypeUuid = vesselTypeUuid;
    }

    return result;
  },

  async delete(seaUuid: string): Promise<void> {
    await this.getByUuid(seaUuid);
    const success = await crewSeaServiceRepository.softDelete(seaUuid);
    if (!success) {
      throw new Error(`Failed to delete sea service record: ${seaUuid}`);
    }
  },

  async getAttachments(seaUuid: string): Promise<CrewSeaServiceAttachment[]> {
    await this.getByUuid(seaUuid);
    return crewSeaServiceRepository.findAttachmentsBySeaUuid(seaUuid);
  },

  async addAttachment(
    seaUuid: string,
    file: Omit<InsertCrewSeaServiceAttachment, "attUuid" | "seaUuid">
  ): Promise<CrewSeaServiceAttachment> {
    await this.getByUuid(seaUuid);

    if (!file.fileName || !file.filePath) {
      throw new Error("File name and path are required");
    }

    return crewSeaServiceRepository.addAttachment({ ...file, seaUuid });
  },

  async removeAttachment(attUuid: string): Promise<void> {
    const success =
      await crewSeaServiceRepository.softDeleteAttachment(attUuid);
    if (!success) {
      throw new Error(`Failed to remove attachment: ${attUuid}`);
    }
  },

  async getTotalExperience(crewUuid: string) {
    const services = await this.getAll(crewUuid);

    let totalDays = 0;
    for (const service of services) {
      if (service.fromDate && service.toDate) {
        const start = new Date(service.fromDate);
        const end = new Date(service.toDate);
        totalDays += Math.ceil(
          (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
        );
      }
    }

    return {
      totalDays,
      totalMonths: Math.floor(totalDays / 30),
      totalYears: Math.floor(totalDays / 365),
      serviceCount: services.length,
    };
  },

  async getExperienceByType(crewUuid: string, serviceType: string) {
    const services = await this.getByType(crewUuid, serviceType);

    let totalDays = 0;
    for (const service of services) {
      if (service.fromDate && service.toDate) {
        const start = new Date(service.fromDate);
        const end = new Date(service.toDate);
        totalDays += Math.ceil(
          (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
        );
      }
    }

    return {
      serviceType,
      totalDays,
      totalMonths: Math.floor(totalDays / 30),
      totalYears: Math.floor(totalDays / 365),
      serviceCount: services.length,
    };
  },

  /**
   * Calculate experience metrics from sea service records
   * Used by: Officer Matrix, Oil Major Compliance Engine
   */
  calculateExperienceMetrics(
    seaServiceRecords: CrewSeaServiceType[],
    currentRank: string
  ): ExperienceMetrics {
    let companySeaTimeMonths = 0;
    let externalSeaTimeMonths = 0;
    let rankExperienceMonths = 0;
    const vesselTypeExperience: Record<string, number> = {};

    for (const service of seaServiceRecords) {
      const months = this.calculatePeriodMonths(service.fromDate, service.toDate);

      const isCompanyService = service.serviceType === "company";
      if (isCompanyService) {
        companySeaTimeMonths += months;
      } else {
        externalSeaTimeMonths += months;
      }

      if (service.rank === currentRank) {
        rankExperienceMonths += months;
      }

      if (service.vesselTypeUuid) {
        vesselTypeExperience[service.vesselTypeUuid] =
          (vesselTypeExperience[service.vesselTypeUuid] || 0) + months;
      }
    }

    return {
      totalSeaTimeMonths: companySeaTimeMonths + externalSeaTimeMonths,
      companySeaTimeMonths,
      externalSeaTimeMonths,
      rankExperienceMonths,
      vesselTypeExperience,
    };
  },

  /**
   * Calculate period in months between two dates
   */
  calculatePeriodMonths(
    fromDate: string | Date | null | undefined,
    toDate: string | Date | null | undefined
  ): number {
    if (!fromDate) return 0;
    try {
      const from = new Date(fromDate);
      // For active contracts (no toDate), calculate from fromDate to today
      const to = toDate ? new Date(toDate) : new Date();
      const diffTime = to.getTime() - from.getTime();
      return Math.max(0, diffTime / (1000 * 60 * 60 * 24 * 30.44));
    } catch {
      return 0;
    }
  },

  /**
   * Get all sea service for a crew member with experience metrics
   */
  async getAllWithMetrics(
    crewUuid: string,
    currentRank: string
  ): Promise<{
    records: CrewSeaServiceWithAttachments[];
    metrics: ExperienceMetrics;
  }> {
    const records = await this.getAll(crewUuid);
    const metrics = this.calculateExperienceMetrics(records, currentRank);
    return { records, metrics };
  },

  /**
   * Reconcile sea service with attachments - handles add/update/delete in one transaction
   */
  async reconcileWithAttachments(
    crewUuid: string,
    items: Array<{
      seaUuid?: string;
      isDeleted?: boolean;
      data: Omit<InsertCrewSeaService, "seaUuid" | "crewUuid"> & { vessel?: string; vesselType?: string };
      attachments?: Array<{
        attUuid?: string;
        isNew?: boolean;
        fileName: string;
        filePath?: string;
        fileData?: string;
      }>;
    }>
  ): Promise<CrewSeaServiceType[]> {
    const db = getDb();
    await crewMembersService.getByUuid(crewUuid);

    // Pre-resolve all vessel and vesselType UUIDs before transaction
    const resolvedItems = await Promise.all(
      items.map(async (item) => {
        if (item.isDeleted) return item;
        const resolvedData = await this.resolveMasterDataFields(item.data);
        return { ...item, data: resolvedData };
      })
    );

    return db.transaction(async (tx: any) => {
      const results: CrewSeaServiceType[] = [];
      const now = new Date();

      for (const item of resolvedItems) {
        if (item.isDeleted && item.seaUuid) {
          await tx
            .update(crewSeaService)
            .set({ isDeleted: true, updatedAt: now })
            .where(eq(crewSeaService.seaUuid, item.seaUuid));
          continue;
        }

        let seaUuid: string;

        if (item.seaUuid) {
          const [updated] = await tx
            .update(crewSeaService)
            .set({ ...item.data, updatedAt: now })
            .where(eq(crewSeaService.seaUuid, item.seaUuid))
            .returning();
          seaUuid = item.seaUuid;
          results.push(updated);
        } else {
          seaUuid = uuidv4();
          const [created] = await tx
            .insert(crewSeaService)
            .values({
              ...item.data,
              seaUuid,
              crewUuid,
              createdAt: now,
              updatedAt: now,
            })
            .returning();
          results.push(created);
        }

        if (item.attachments) {
          for (const att of item.attachments) {
            if (att.isNew && (att.filePath || att.fileData)) {
              await tx.insert(crewSeaServiceAttachments).values({
                attUuid: uuidv4(),
                seaUuid,
                fileName: att.fileName,
                filePath: att.filePath || null,
                fileData: att.fileData || null,
                createdAt: now,
                updatedAt: now,
              });
            }
          }
        }
      }

      return results;
    });
  },

  /**
   * Split a crew member's Company sea-service history when a promotion takes
   * effect: close the previous-rank line the day before the split date and open
   * a new Company line for the new rank starting on the split date.
   *
   * - Split date = Part C Date of Promotion (on-board) or Sign-On date (prior
   *   joining); the caller passes the correct value.
   * - "Years in Rank" restarts automatically because rank experience is summed
   *   per `rank`, so the new line begins accruing from the split date. "Years
   *   with Operator" is unaffected because it is calendar tenure from the
   *   earliest Company `fromDate`, which the later new line does not change.
   * - Idempotent (Phase 5 backfill reuses this same path): if a non-deleted
   *   Company line for the new rank already starts on — or already covers — the
   *   split date, nothing is changed. The previous line is only closed when it
   *   is still open or ends on/after the split date, so a manually-set earlier
   *   end date is never shortened and no overlap/gap is introduced.
   */
  async splitForPromotion(params: {
    crewUuid: string;
    newRank: string;
    splitDate: string;
    oldRank?: string | null;
    auditUserUuid?: string | null;
  }): Promise<{
    created: boolean;
    closedPreviousUuid: string | null;
    status: "created" | "already-split" | "skipped-invalid-input";
  }> {
    const plan = await resolveSplitPlan(params);
    if (plan.status === "skipped-invalid-input") {
      return { created: false, closedPreviousUuid: null, status: "skipped-invalid-input" };
    }
    if (plan.status === "already-split") {
      return { created: false, closedPreviousUuid: null, status: "already-split" };
    }

    const auditUserUuid = params.auditUserUuid ?? null;
    const { crewUuid, newRank, splitIso, closePreviousToIso, previous } = plan;

    const db = getDb();
    return db.transaction(async (tx: any) => {
      const now = new Date();
      let closedPreviousUuid: string | null = null;

      if (previous) {
        await tx
          .update(crewSeaService)
          .set({ toDate: closePreviousToIso, updatedAt: now, updatedByUuid: auditUserUuid })
          .where(eq(crewSeaService.seaUuid, previous.seaUuid));
        closedPreviousUuid = previous.seaUuid;
      }

      await tx.insert(crewSeaService).values({
        seaUuid: uuidv4(),
        crewUuid,
        serviceType: "company",
        rank: newRank,
        fromDate: splitIso,
        toDate: null,
        vesselUuid: previous?.vesselUuid ?? null,
        vesselName: previous?.vesselName ?? null,
        vesselTypeUuid: previous?.vesselTypeUuid ?? null,
        deadweight: previous?.deadweight ?? null,
        engineTypePower: previous?.engineTypePower ?? null,
        ownerOperator: previous?.ownerOperator ?? null,
        experienceCategories: previous?.experienceCategories ?? null,
        createdByUuid: auditUserUuid,
        updatedByUuid: auditUserUuid,
        createdAt: now,
        updatedAt: now,
      });

      return { created: true, closedPreviousUuid, status: "created" as const };
    });
  },

  /**
   * Read-only preview of `splitForPromotion`: reports what the split WOULD do
   * against the current state without writing anything. Used by the Phase 5
   * backfill dry-run so the summary reflects the same line-level idempotency
   * rule as the live path.
   */
  async previewSplitForPromotion(params: {
    crewUuid: string;
    newRank: string;
    splitDate: string;
    oldRank?: string | null;
  }): Promise<"would-create" | "already-split" | "skipped-invalid-input"> {
    const plan = await resolveSplitPlan(params);
    return plan.status === "create" ? "would-create" : plan.status;
  },
};
