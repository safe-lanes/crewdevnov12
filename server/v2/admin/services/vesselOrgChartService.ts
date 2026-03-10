import { VesselOrgChartRepository } from "../repositories/vesselOrgChartRepository";
import { applyAuditUser } from "../utils/auditUser";
import type { AdmVesselOrgChartV2, InsertAdmVesselOrgChartV2 } from "../../../../shared/v2/admin/types";

const vesselOrgChartRepo = new VesselOrgChartRepository();

export const vesselOrgChartService = {
  async getAll(): Promise<AdmVesselOrgChartV2[]> {
    return vesselOrgChartRepo.findAll();
  },

  async saveAll(entries: InsertAdmVesselOrgChartV2[]): Promise<AdmVesselOrgChartV2[]> {
    return vesselOrgChartRepo.saveAll(entries.map(entry => applyAuditUser(entry, true)));
  },
};
