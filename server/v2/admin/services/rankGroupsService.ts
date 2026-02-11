import { RankGroupsRepository } from "../repositories/rankGroupsRepository";
import { FormsRepository } from "../repositories/formsRepository";
import type { AdmRankGroupV2, InsertAdmRankGroupV2 } from "../../../../shared/v2/admin/types";

const rankGroupsRepo = new RankGroupsRepository();
const formsRepo = new FormsRepository();

function checkRankConflicts(
  activeGroups: AdmRankGroupV2[],
  newRanks: string[],
  excludeId?: number
): Record<string, string> {
  const conflicts: Record<string, string> = {};
  for (const group of activeGroups) {
    if (excludeId && group.id === excludeId) continue;
    let groupRanks: string[] = [];
    try {
      groupRanks = typeof group.ranks === "string" ? JSON.parse(group.ranks) : group.ranks;
    } catch (e) {
      groupRanks = [];
    }
    for (const rank of newRanks) {
      if (groupRanks.includes(rank)) {
        conflicts[rank] = group.name;
      }
    }
  }
  return conflicts;
}

export const rankGroupsService = {
  async getAll(): Promise<AdmRankGroupV2[]> {
    return rankGroupsRepo.findAll();
  },

  async getByFormId(formId: number, includeArchived: boolean = true): Promise<AdmRankGroupV2[]> {
    return rankGroupsRepo.findByFormId(formId, includeArchived);
  },

  async getByFormUuid(formUuid: string, includeArchived: boolean = true): Promise<AdmRankGroupV2[]> {
    const form = await formsRepo.findByUuid(formUuid);
    if (!form) throw new Error(`Form not found: ${formUuid}`);
    return rankGroupsRepo.findByFormId(form.id, includeArchived);
  },

  async getById(id: number): Promise<AdmRankGroupV2> {
    const rg = await rankGroupsRepo.findById(id);
    if (!rg) throw new Error(`Rank group not found: ${id}`);
    return rg;
  },

  async getByUuid(rgUuid: string): Promise<AdmRankGroupV2> {
    const rg = await rankGroupsRepo.findByUuid(rgUuid);
    if (!rg) throw new Error(`Rank group not found: ${rgUuid}`);
    return rg;
  },

  async checkAssignment(rankLabel: string, formName: string): Promise<any> {
    const allForms = await formsRepo.findAll();
    const form = allForms.find(f => f.name === formName);
    if (!form) return { hasAssignment: false };

    const activeGroups = await rankGroupsRepo.findByFormId(form.id, false);
    for (const group of activeGroups) {
      let ranks: string[] = [];
      try {
        ranks = typeof group.ranks === "string" ? JSON.parse(group.ranks) : group.ranks;
      } catch (e) { ranks = []; }
      if (ranks.some(r => r.toLowerCase() === rankLabel.toLowerCase())) {
        return {
          hasAssignment: true,
          rankGroupId: group.id,
          rankGroupUuid: group.rgUuid,
          rankGroupName: group.name,
          formId: form.id,
          formUuid: form.formUuid,
          formName: form.name,
        };
      }
    }
    return { hasAssignment: false };
  },

  async create(data: Omit<InsertAdmRankGroupV2, "rgUuid">): Promise<AdmRankGroupV2> {
    let newRanks: string[] = [];
    try {
      newRanks = typeof data.ranks === "string" ? JSON.parse(data.ranks) : data.ranks;
    } catch (e) { newRanks = []; }

    const activeGroups = await rankGroupsRepo.findByFormId(data.formId, false);
    const conflicts = checkRankConflicts(activeGroups, newRanks);
    if (Object.keys(conflicts).length > 0) {
      const details = Object.entries(conflicts).map(([rank, group]) => `${rank} (${group})`).join(", ");
      throw new Error(`The following ranks are already assigned to other active rank groups: ${details}`);
    }

    return rankGroupsRepo.create(data);
  },

  async updateById(id: number, data: Partial<InsertAdmRankGroupV2>): Promise<AdmRankGroupV2> {
    const existing = await rankGroupsRepo.findById(id);
    if (!existing) throw new Error(`Rank group not found: ${id}`);

    if (data.ranks) {
      let newRanks: string[] = [];
      try {
        newRanks = typeof data.ranks === "string" ? JSON.parse(data.ranks) : data.ranks;
      } catch (e) { newRanks = []; }

      const activeGroups = await rankGroupsRepo.findByFormId(existing.formId, false);
      const conflicts = checkRankConflicts(activeGroups, newRanks, id);
      if (Object.keys(conflicts).length > 0) {
        const details = Object.entries(conflicts).map(([rank, group]) => `${rank} (${group})`).join(", ");
        throw new Error(`The following ranks are already assigned to other active rank groups: ${details}`);
      }
    }

    const result = await rankGroupsRepo.updateById(id, data);
    if (!result) throw new Error(`Rank group not found: ${id}`);
    return result;
  },

  async update(rgUuid: string, data: Partial<InsertAdmRankGroupV2>): Promise<AdmRankGroupV2> {
    const existing = await rankGroupsRepo.findByUuid(rgUuid);
    if (!existing) throw new Error(`Rank group not found: ${rgUuid}`);

    if (data.ranks) {
      let newRanks: string[] = [];
      try {
        newRanks = typeof data.ranks === "string" ? JSON.parse(data.ranks) : data.ranks;
      } catch (e) { newRanks = []; }

      const activeGroups = await rankGroupsRepo.findByFormId(existing.formId, false);
      const conflicts = checkRankConflicts(activeGroups, newRanks, existing.id);
      if (Object.keys(conflicts).length > 0) {
        const details = Object.entries(conflicts).map(([rank, group]) => `${rank} (${group})`).join(", ");
        throw new Error(`The following ranks are already assigned to other active rank groups: ${details}`);
      }
    }

    const result = await rankGroupsRepo.update(rgUuid, data);
    if (!result) throw new Error(`Rank group not found: ${rgUuid}`);
    return result;
  },

  async updateConfigurationById(id: number, configuration: string): Promise<AdmRankGroupV2> {
    const result = await rankGroupsRepo.updateById(id, { configuration });
    if (!result) throw new Error(`Rank group not found: ${id}`);
    return result;
  },

  async updateConfiguration(rgUuid: string, configuration: string): Promise<AdmRankGroupV2> {
    const result = await rankGroupsRepo.update(rgUuid, { configuration });
    if (!result) throw new Error(`Rank group not found: ${rgUuid}`);
    return result;
  },

  async archiveById(id: number): Promise<AdmRankGroupV2> {
    const result = await rankGroupsRepo.archiveById(id);
    if (!result) throw new Error(`Rank group not found: ${id}`);
    return result;
  },

  async archive(rgUuid: string): Promise<AdmRankGroupV2> {
    const result = await rankGroupsRepo.archive(rgUuid);
    if (!result) throw new Error(`Rank group not found: ${rgUuid}`);
    return result;
  },

  async unarchiveById(id: number): Promise<AdmRankGroupV2> {
    const result = await rankGroupsRepo.unarchiveById(id);
    if (!result) throw new Error(`Rank group not found: ${id}`);
    return result;
  },

  async unarchive(rgUuid: string): Promise<AdmRankGroupV2> {
    const result = await rankGroupsRepo.unarchive(rgUuid);
    if (!result) throw new Error(`Rank group not found: ${rgUuid}`);
    return result;
  },

  async deleteById(id: number): Promise<boolean> {
    return rankGroupsRepo.softDeleteById(id);
  },

  async delete(rgUuid: string): Promise<boolean> {
    return rankGroupsRepo.softDelete(rgUuid);
  },

  async getRankConflictsByFormId(formId: number, excludeGroupId?: number): Promise<Record<string, string>> {
    const form = await formsRepo.findById(formId);
    if (!form) throw new Error(`Form not found: ${formId}`);

    const activeGroups = await rankGroupsRepo.findByFormId(form.id, false);
    const rankToGroupMap: Record<string, string> = {};

    for (const group of activeGroups) {
      if (excludeGroupId && group.id === excludeGroupId) continue;
      let ranks: string[] = [];
      try {
        ranks = typeof group.ranks === "string" ? JSON.parse(group.ranks) : group.ranks;
      } catch (e) { ranks = []; }
      for (const rank of ranks) {
        rankToGroupMap[rank] = group.name;
      }
    }
    return rankToGroupMap;
  },

  async getRankConflicts(formUuid: string, excludeGroupUuid?: string): Promise<Record<string, string>> {
    const form = await formsRepo.findByUuid(formUuid);
    if (!form) throw new Error(`Form not found: ${formUuid}`);

    const activeGroups = await rankGroupsRepo.findByFormId(form.id, false);
    const rankToGroupMap: Record<string, string> = {};

    for (const group of activeGroups) {
      if (excludeGroupUuid && group.rgUuid === excludeGroupUuid) continue;
      let ranks: string[] = [];
      try {
        ranks = typeof group.ranks === "string" ? JSON.parse(group.ranks) : group.ranks;
      } catch (e) { ranks = []; }
      for (const rank of ranks) {
        rankToGroupMap[rank] = group.name;
      }
    }
    return rankToGroupMap;
  },
};
