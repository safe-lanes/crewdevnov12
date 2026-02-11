import { CompanyTrainingRequirementsRepository } from "../repositories/companyTrainingRequirementsRepository";
import type { AdmCompanyTrainingRequirementV2 } from "../../../../shared/v2/admin/types";

const companyTrainingRequirementsRepo = new CompanyTrainingRequirementsRepository();

export const companyTrainingRequirementsService = {
  async getAll(): Promise<AdmCompanyTrainingRequirementV2[]> {
    return companyTrainingRequirementsRepo.findAll();
  },

  async upsertBatch(requirements: Array<{ companyTrainingId: number; rankId: number; status: string | null }>): Promise<void> {
    for (const req of requirements) {
      if (typeof req.companyTrainingId !== "number" || isNaN(req.companyTrainingId)) {
        throw new Error(`Invalid companyTrainingId: ${req.companyTrainingId}`);
      }
      if (typeof req.rankId !== "number" || isNaN(req.rankId)) {
        throw new Error(`Invalid rankId: ${req.rankId}`);
      }
      if (req.status !== null && req.status !== "M" && req.status !== "R") {
        throw new Error(`Invalid status: ${req.status}. Must be M, R, or null`);
      }
    }
    return companyTrainingRequirementsRepo.upsertBatch(requirements);
  },
};
