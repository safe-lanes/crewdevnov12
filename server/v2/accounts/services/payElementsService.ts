import { PayElementsRepository } from "../repositories";
import type {
  AccPayElementV2,
  InsertAccPayElementV2,
} from "../../../../shared/v2/accounts/types";
import { applyAuditUser } from "./auditUtils";

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

function isUniqueViolation(e: any): boolean {
  return e?.code === "23505";
}

/** Enforce the conditional business rules on a fully-merged element state. */
async function validateBusinessRules(merged: Partial<AccPayElementV2>) {
  if (merged.calcMethod === "percentage_of_base") {
    if (!merged.percentageBaseElementUuid) {
      throw validationError(
        "A base pay element is required when calc method is percentage_of_base",
      );
    }
    if (
      merged.payElementUuid &&
      merged.percentageBaseElementUuid === merged.payElementUuid
    ) {
      throw validationError(
        "A pay element cannot use itself as its percentage base",
      );
    }
    const base = await payElementsRepository.findByUuid(
      merged.percentageBaseElementUuid,
    );
    if (!base) {
      throw validationError("The selected base pay element does not exist");
    }
  }
  if (merged.nationalityConditional === true) {
    const list = merged.applicableNationalityUuids;
    if (!list || list.length === 0) {
      throw validationError(
        "At least one applicable nationality is required for nationality-conditional elements",
      );
    }
  }
}

/**
 * Deactivation guard: blocked only by references from ACTIVE or DRAFT wage
 * scales (superseded-only references don't block a deactivate).
 */
async function assertNotReferencedByLiveScales(payElementUuid: string) {
  const scales = await payElementsRepository.findReferencingScales(
    payElementUuid,
    ["active", "draft"],
  );
  if (scales.length === 0) return;
  const err: any = new Error(
    `Referenced by active scale(s): ${scales.map((s) => s.scaleName).join(", ")}. Supersede the scale without this element, then deactivate.`,
  );
  err.code = "REFERENCED";
  err.references = { scales, engagementOverrides: 0 };
  throw err;
}

/** Block delete/deactivate when the element is referenced anywhere. */
async function assertNotReferenced(payElementUuid: string, action: string) {
  const [scales, engagementOverrides] = await Promise.all([
    payElementsRepository.findReferencingScales(payElementUuid),
    payElementsRepository.countReferencingEngagements(payElementUuid),
  ]);
  if (scales.length === 0 && engagementOverrides === 0) return;
  const parts: string[] = [];
  if (scales.length > 0) {
    parts.push(
      `${scales.length} wage scale(s): ${scales.map((s) => s.scaleName).join(", ")}`,
    );
  }
  if (engagementOverrides > 0) {
    parts.push(`${engagementOverrides} engagement override(s)`);
  }
  const err: any = new Error(
    `Cannot ${action} pay element: it is referenced by ${parts.join(" and ")}`,
  );
  err.code = "REFERENCED";
  err.references = { scales, engagementOverrides };
  throw err;
}

export const payElementsService = {
  async getAll(filters?: {
    status?: string;
    type?: string;
    category?: string;
  }): Promise<AccPayElementV2[]> {
    return payElementsRepository.findAll(filters);
  },

  async getByUuid(payElementUuid: string): Promise<AccPayElementV2> {
    const record = await payElementsRepository.findByUuid(payElementUuid);
    if (!record) {
      throw new Error(`Pay element not found: ${payElementUuid}`);
    }
    return record;
  },

  async create(
    data: Omit<InsertAccPayElementV2, "payElementUuid"> & {
      auditUserUuid?: string;
    },
  ): Promise<AccPayElementV2> {
    if (!data.code) throw validationError("Pay element code is required");
    if (!data.name) throw validationError("Pay element name is required");
    if (!data.type) throw validationError("Pay element type is required");
    await validateBusinessRules(data as Partial<AccPayElementV2>);
    const dataWithAudit = applyAuditUser(data, true);
    try {
      return await payElementsRepository.create(dataWithAudit);
    } catch (e: any) {
      if (isUniqueViolation(e)) {
        throw conflictError(
          `A pay element with code "${data.code}" already exists`,
        );
      }
      throw e;
    }
  },

  async update(
    payElementUuid: string,
    data: Partial<InsertAccPayElementV2> & { auditUserUuid?: string },
  ): Promise<AccPayElementV2> {
    const existing = await this.getByUuid(payElementUuid);
    const merged = { ...existing, ...data } as Partial<AccPayElementV2>;
    await validateBusinessRules(merged);
    if (data.status === "inactive" && existing.status !== "inactive") {
      await assertNotReferencedByLiveScales(payElementUuid);
    }
    const dataWithAudit = applyAuditUser(data, false);
    let updated: AccPayElementV2 | undefined;
    try {
      updated = await payElementsRepository.update(
        payElementUuid,
        dataWithAudit,
      );
    } catch (e: any) {
      if (isUniqueViolation(e)) {
        throw conflictError(
          `A pay element with code "${data.code}" already exists`,
        );
      }
      throw e;
    }
    if (!updated) {
      throw new Error(`Failed to update pay element: ${payElementUuid}`);
    }
    return updated;
  },

  async delete(payElementUuid: string): Promise<void> {
    await this.getByUuid(payElementUuid);
    await assertNotReferenced(payElementUuid, "delete");
    const success = await payElementsRepository.softDelete(payElementUuid);
    if (!success) {
      throw new Error(`Failed to delete pay element: ${payElementUuid}`);
    }
  },

  /** One-click seed of a standard maritime element set into an empty library. */
  async seedStandard(auditUserUuid?: string): Promise<AccPayElementV2[]> {
    const existing = await payElementsRepository.findAll();
    if (existing.length > 0) {
      throw conflictError(
        "Standard elements can only be loaded into an empty library",
      );
    }
    const rows = STANDARD_ELEMENTS.map((e, idx) =>
      applyAuditUser({ ...e, sortOrder: idx, auditUserUuid }, true),
    );
    return payElementsRepository.seedStandardElements(rows);
  },
};

/** Reasonable default maritime pay element library (admin-editable). */
const STANDARD_ELEMENTS: Omit<InsertAccPayElementV2, "payElementUuid">[] = [
  {
    code: "BASIC",
    name: "Basic Wage",
    type: "earning",
    category: "basic",
    calcMethod: "scale_lookup",
    prorate: true,
    paymentTiming: "paid_on_board",
  },
  {
    code: "GOT",
    name: "Guaranteed Overtime",
    type: "earning",
    category: "overtime_fixed",
    calcMethod: "scale_lookup",
    prorate: true,
    paymentTiming: "paid_on_board",
  },
  {
    code: "OT",
    name: "Variable Overtime",
    type: "earning",
    category: "overtime_variable",
    calcMethod: "rate_times_qty",
    paymentTiming: "paid_on_board",
  },
  {
    code: "LEAVE",
    name: "Leave Pay",
    type: "earning",
    category: "basic",
    calcMethod: "scale_lookup",
    prorate: true,
    paymentTiming: "payable_at_settlement",
  },
  {
    code: "SENIORITY",
    name: "Seniority Bonus",
    type: "earning",
    category: "bonus",
    calcMethod: "scale_lookup",
    paymentTiming: "paid_on_board",
  },
  {
    code: "SUBS",
    name: "Subsistence Allowance",
    type: "earning",
    category: "allowance",
    calcMethod: "fixed_amount",
    paymentTiming: "paid_on_board",
  },
  {
    code: "UNION",
    name: "Union Dues",
    type: "deduction",
    category: "statutory",
    calcMethod: "fixed_amount",
    paymentTiming: "paid_on_board",
  },
  {
    code: "ALLOT",
    name: "Allotment",
    type: "deduction",
    category: "allotment",
    calcMethod: "manual_entry",
    paymentTiming: "paid_on_board",
  },
  {
    code: "ADVANCE",
    name: "Advance Recovery",
    type: "deduction",
    category: "advance_recovery",
    calcMethod: "manual_entry",
    paymentTiming: "paid_on_board",
  },
  {
    code: "BOND",
    name: "Bond / Slop Chest",
    type: "deduction",
    category: "bond_slop_chest",
    calcMethod: "manual_entry",
    paymentTiming: "paid_on_board",
  },
  {
    code: "PF",
    name: "Provident Fund (Employer)",
    type: "employer_contribution",
    category: "statutory",
    calcMethod: "fixed_amount",
    paymentTiming: "remitted_to_fund",
  },
];
