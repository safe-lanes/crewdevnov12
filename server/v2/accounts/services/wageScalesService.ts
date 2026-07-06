import {
  WageScalesRepository,
  CbaReferenceRepository,
  PayElementsRepository,
  type WageScaleLineInput,
} from "../repositories";
import type {
  AccWageScaleV2,
  AccWageScaleLineV2,
  InsertAccWageScaleV2,
} from "../../../../shared/v2/accounts/types";
import { applyAuditUser } from "./auditUtils";

const wageScalesRepository = new WageScalesRepository();
const cbaReferenceRepository = new CbaReferenceRepository();
const payElementsRepository = new PayElementsRepository();

function validationError(message: string): Error {
  const err: any = new Error(message);
  err.code = "VALIDATION";
  return err;
}

function conflictError(message: string): Error {
  const err: any = new Error(message);
  err.code = "CONFLICT";
  return err;
}

/** A CBA floor violation for a single scale line. */
export type FloorViolation = {
  scaleLineUuid: string;
  rankId: string;
  payElementUuid: string;
  elementCode: string | null;
  elementName: string | null;
  scaleAmount: number;
  cbaName: string | null;
  cbaMinimum: number;
  deficit: number;
  currency: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);

/** True when a date string falls within an inclusive, possibly-open window. */
function inWindow(
  ref: string,
  from: string | null,
  to: string | null,
): boolean {
  if (from && ref < from) return false;
  if (to && ref > to) return false;
  return true;
}

/** True when two inclusive, possibly-open date windows overlap. */
function windowsOverlap(
  aFrom: string | null,
  aTo: string | null,
  bFrom: string | null,
  bTo: string | null,
): boolean {
  if (aTo && bFrom && aTo < bFrom) return false;
  if (bTo && aFrom && bTo < aFrom) return false;
  return true;
}

export const wageScalesService = {
  async getAll(filters?: {
    status?: string;
  }): Promise<(AccWageScaleV2 & { lineCount: number })[]> {
    const [scales, counts] = await Promise.all([
      wageScalesRepository.findAll(filters),
      wageScalesRepository.lineCounts(),
    ]);
    return scales.map((s) => ({ ...s, lineCount: counts[s.scaleUuid] ?? 0 }));
  },

  async getByUuidOrThrow(scaleUuid: string): Promise<AccWageScaleV2> {
    const record = await wageScalesRepository.findByUuid(scaleUuid);
    if (!record) {
      throw new Error(`Wage scale not found: ${scaleUuid}`);
    }
    return record;
  },

  async getDetail(scaleUuid: string): Promise<{
    scale: AccWageScaleV2;
    lines: AccWageScaleLineV2[];
  }> {
    const scale = await this.getByUuidOrThrow(scaleUuid);
    const lines = await wageScalesRepository.findLinesByScale(scaleUuid);
    return { scale, lines };
  },

  async create(
    data: Omit<InsertAccWageScaleV2, "scaleUuid"> & { auditUserUuid?: string },
  ): Promise<AccWageScaleV2> {
    if (!data.scaleName) throw validationError("Scale name is required");
    if (!data.currency) throw validationError("Currency is required");
    const dataWithAudit = applyAuditUser({ ...data, status: "draft" }, true);
    return wageScalesRepository.create(dataWithAudit);
  },

  async update(
    scaleUuid: string,
    data: Partial<InsertAccWageScaleV2> & { auditUserUuid?: string },
  ): Promise<AccWageScaleV2> {
    const scale = await this.getByUuidOrThrow(scaleUuid);
    if (scale.status !== "draft") {
      throw validationError("Only draft scales can be edited");
    }
    const dataWithAudit = applyAuditUser(data, false);
    const updated = await wageScalesRepository.update(scaleUuid, dataWithAudit);
    if (!updated) throw new Error(`Failed to update wage scale: ${scaleUuid}`);
    return updated;
  },

  async delete(scaleUuid: string): Promise<void> {
    const scale = await this.getByUuidOrThrow(scaleUuid);
    if (scale.status !== "draft") {
      throw validationError("Only draft scales can be deleted");
    }
    const success = await wageScalesRepository.softDelete(scaleUuid);
    if (!success) throw new Error(`Failed to delete wage scale: ${scaleUuid}`);
  },

  async replaceLines(
    scaleUuid: string,
    lines: WageScaleLineInput[],
    auditUserUuid?: string,
  ): Promise<AccWageScaleLineV2[]> {
    const scale = await this.getByUuidOrThrow(scaleUuid);
    if (scale.status !== "draft") {
      throw validationError("Scale lines are immutable once the scale is active");
    }
    // Reject references to non-existent pay elements up front.
    const elements = await payElementsRepository.findAll();
    const validUuids = new Set(elements.map((e) => e.payElementUuid));
    // Detect duplicate cells before hitting the unique index (matrix paste / bug).
    const seen = new Set<string>();
    for (const line of lines) {
      if (!validUuids.has(line.payElementUuid)) {
        throw validationError(
          `A line references an unknown pay element: ${line.payElementUuid}`,
        );
      }
      const key = [
        line.rankId,
        line.nationalityUuid ?? "",
        line.experienceMinMonths ?? "",
        line.payElementUuid,
      ].join("|");
      if (seen.has(key)) {
        throw validationError(
          `Duplicate line for rank ${line.rankId} and the same pay element (nationality/experience). Each rank + pay element + nationality + experience combination must be unique.`,
        );
      }
      seen.add(key);
    }
    return wageScalesRepository.replaceLines(scaleUuid, lines, auditUserUuid);
  },

  /** Compare each live line to the strongest applicable CBA minimum. */
  async floorCheck(scaleUuid: string): Promise<FloorViolation[]> {
    const scale = await this.getByUuidOrThrow(scaleUuid);
    const [lines, cbaRows, payElements] = await Promise.all([
      wageScalesRepository.findLinesByScale(scaleUuid),
      cbaReferenceRepository.findAll(),
      payElementsRepository.findAll(),
    ]);
    const peMap = new Map(payElements.map((p) => [p.payElementUuid, p]));
    const ref = scale.effectiveFrom ?? today();
    const violations: FloorViolation[] = [];

    for (const line of lines) {
      if (line.amount == null) continue;
      const scaleAmount = Number(line.amount);
      if (Number.isNaN(scaleAmount)) continue;
      const pe = peMap.get(line.payElementUuid);

      let bestMin: number | null = null;
      let bestCba: (typeof cbaRows)[number] | null = null;
      for (const cba of cbaRows) {
        if (cba.currency && scale.currency && cba.currency !== scale.currency)
          continue;
        if (cba.rankId && cba.rankId !== line.rankId) continue;
        const elementMatch = cba.payElementUuid
          ? cba.payElementUuid === line.payElementUuid
          : !!(cba.category && pe && cba.category === pe.category);
        if (!elementMatch) continue;
        if (!inWindow(ref, cba.effectiveFrom, cba.effectiveTo)) continue;
        if (cba.minimumAmount == null) continue;
        const min = Number(cba.minimumAmount);
        if (Number.isNaN(min)) continue;
        if (bestMin == null || min > bestMin) {
          bestMin = min;
          bestCba = cba;
        }
      }

      if (bestMin != null && scaleAmount < bestMin) {
        violations.push({
          scaleLineUuid: line.scaleLineUuid,
          rankId: line.rankId,
          payElementUuid: line.payElementUuid,
          elementCode: pe?.code ?? null,
          elementName: pe?.name ?? null,
          scaleAmount,
          cbaName: bestCba?.cbaName ?? null,
          cbaMinimum: bestMin,
          deficit: Number((bestMin - scaleAmount).toFixed(2)),
          currency: scale.currency ?? null,
        });
      }
    }
    return violations;
  },

  async activate(
    scaleUuid: string,
    opts: { acknowledge?: boolean; auditUserUuid?: string },
  ): Promise<{ scale: AccWageScaleV2; violations: FloorViolation[] }> {
    const scale = await this.getByUuidOrThrow(scaleUuid);
    if (scale.status !== "draft") {
      throw validationError("Only draft scales can be activated");
    }
    const lines = await wageScalesRepository.findLinesByScale(scaleUuid);
    if (lines.length === 0) {
      throw validationError("Cannot activate a scale with no lines");
    }

    // NOTE: the DB partial-unique index guards one active scale per non-null
    // scope, but treats NULLs as distinct — so two fleet-wide (both scope
    // columns NULL) scales can race past this check. Acceptable for a low-
    // concurrency admin screen; the overlap check below is the primary guard.
    const activeSameScope = await wageScalesRepository.findActiveByScope(
      scale.vesselTypeUuid,
      scale.vesselGroupUuid,
    );
    const overlapping = activeSameScope.filter(
      (s) =>
        s.scaleUuid !== scaleUuid &&
        windowsOverlap(
          s.effectiveFrom,
          s.effectiveTo,
          scale.effectiveFrom,
          scale.effectiveTo,
        ),
    );
    if (overlapping.length > 0) {
      throw conflictError(
        "An active scale already exists for this vessel type/group with an overlapping effectivity period",
      );
    }

    const violations = await this.floorCheck(scaleUuid);
    if (violations.length > 0 && !opts.acknowledge) {
      const err: any = new Error(
        "Scale has lines below CBA minimums; acknowledge to activate anyway",
      );
      err.code = "FLOOR_VIOLATIONS";
      err.violations = violations;
      throw err;
    }

    const patch: Record<string, unknown> = { status: "active" };
    if (violations.length > 0 && opts.acknowledge) {
      patch.floorAckByUuid = opts.auditUserUuid ?? null;
      patch.floorAckAt = today();
      patch.floorViolations = violations;
    }

    try {
      const updated = await wageScalesRepository.update(
        scaleUuid,
        applyAuditUser({ ...patch, auditUserUuid: opts.auditUserUuid }, false),
      );
      if (!updated) throw new Error(`Failed to activate wage scale: ${scaleUuid}`);
      return { scale: updated, violations };
    } catch (e: any) {
      if (e?.code === "23505") {
        throw conflictError(
          "An active scale already exists for this vessel type/group",
        );
      }
      throw e;
    }
  },

  /** Clone an active scale into a new draft and mark the original superseded. */
  async supersede(
    scaleUuid: string,
    opts: { effectiveTo?: string; auditUserUuid?: string },
  ): Promise<AccWageScaleV2> {
    const scale = await this.getByUuidOrThrow(scaleUuid);
    if (scale.status !== "active") {
      throw validationError("Only active scales can be superseded");
    }
    return wageScalesRepository.supersedeInTransaction(
      scale,
      opts.effectiveTo ?? today(),
      opts.auditUserUuid,
    );
  },
};
