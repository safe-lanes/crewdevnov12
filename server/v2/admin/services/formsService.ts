import { FormsRepository } from "../repositories/formsRepository";
import { FormVersionsRepository } from "../repositories/formVersionsRepository";
import { RankGroupsRepository } from "../repositories/rankGroupsRepository";
import type { AdmFormV2, InsertAdmFormV2, AdmFormVersionV2, InsertAdmFormVersionV2 } from "../../../../shared/v2/admin/types";

const formsRepo = new FormsRepository();
const formVersionsRepo = new FormVersionsRepository();
const rankGroupsRepo = new RankGroupsRepository();

export const formsService = {
  async getAll(): Promise<AdmFormV2[]> {
    return formsRepo.findAll();
  },

  async getById(id: number): Promise<AdmFormV2> {
    const form = await formsRepo.findById(id);
    if (!form) throw new Error(`Form not found: ${id}`);
    return form;
  },

  async getByUuid(formUuid: string): Promise<AdmFormV2> {
    const form = await formsRepo.findByUuid(formUuid);
    if (!form) throw new Error(`Form not found: ${formUuid}`);
    return form;
  },

  async create(data: Omit<InsertAdmFormV2, "formUuid">): Promise<AdmFormV2> {
    return formsRepo.create(data);
  },

  async updateById(id: number, data: Partial<InsertAdmFormV2>): Promise<AdmFormV2> {
    const form = await formsRepo.updateById(id, data);
    if (!form) throw new Error(`Form not found: ${id}`);
    return form;
  },

  async update(formUuid: string, data: Partial<InsertAdmFormV2>): Promise<AdmFormV2> {
    const form = await formsRepo.update(formUuid, data);
    if (!form) throw new Error(`Form not found: ${formUuid}`);
    return form;
  },

  async deleteById(id: number): Promise<boolean> {
    return formsRepo.softDeleteById(id);
  },

  async delete(formUuid: string): Promise<boolean> {
    return formsRepo.softDelete(formUuid);
  },

  async getFormForRank(rankLabel: string, category?: string): Promise<any> {
    const allForms = await formsRepo.findAll();
    const form = allForms.find(f => {
      if (category && f.category !== category) return false;
      return true;
    });
    if (!form) return null;

    const activeRankGroups = await rankGroupsRepo.findByFormId(form.id, false);
    let rankGroupConfig = null;
    let rankGroupName = null;

    const matchingGroups: Array<{ id: number; name: string; configuration: string | null; rgUuid: string }> = [];
    for (const rg of activeRankGroups) {
      try {
        const ranks = JSON.parse(rg.ranks);
        if (Array.isArray(ranks) && ranks.includes(rankLabel)) {
          matchingGroups.push({ id: rg.id, name: rg.name, configuration: rg.configuration, rgUuid: rg.rgUuid });
        }
      } catch (e) {}
    }

    if (matchingGroups.length > 0) {
      const groupsWithConfig = matchingGroups.filter(g => g.configuration);
      const groupsWithoutConfig = matchingGroups.filter(g => !g.configuration);

      let selectedGroup;
      if (groupsWithConfig.length > 0) {
        selectedGroup = groupsWithConfig.sort((a, b) => a.id - b.id)[0];
        rankGroupConfig = JSON.parse(selectedGroup.configuration!);
      } else {
        selectedGroup = groupsWithoutConfig.sort((a, b) => a.id - b.id)[0];
      }
      rankGroupName = selectedGroup.name;
    }

    return { ...form, rankGroupName, rankGroupConfig };
  },

  async cleanupDuplicates(): Promise<{ message: string; kept?: number; deletedCount?: number; totalOriginal?: number }> {
    const allForms = await formsRepo.findAll();
    const duplicates = allForms.filter(f => f.name === "Crew Appraisal Form");
    if (duplicates.length <= 1) {
      return { message: "No duplicates found" };
    }
    const formToKeep = duplicates.reduce((prev, curr) => prev.id < curr.id ? prev : curr);
    let deletedCount = 0;
    for (const form of duplicates) {
      if (form.id !== formToKeep.id) {
        const success = await formsRepo.softDeleteById(form.id);
        if (success) deletedCount++;
      }
    }
    return { message: "Cleanup completed", kept: formToKeep.id, deletedCount, totalOriginal: duplicates.length };
  },

  async getVersionsByFormId(formId: number, rankGroupId?: number): Promise<AdmFormVersionV2[]> {
    const form = await formsRepo.findById(formId);
    if (!form) throw new Error(`Form not found: ${formId}`);
    return formVersionsRepo.findByFormId(form.id, rankGroupId);
  },

  async getVersions(formUuid: string, rankGroupId?: number): Promise<AdmFormVersionV2[]> {
    const form = await formsRepo.findByUuid(formUuid);
    if (!form) throw new Error(`Form not found: ${formUuid}`);
    return formVersionsRepo.findByFormId(form.id, rankGroupId);
  },

  async createVersionByFormId(formId: number, data: Omit<InsertAdmFormVersionV2, "fvUuid" | "formId">): Promise<AdmFormVersionV2> {
    const form = await formsRepo.findById(formId);
    if (!form) throw new Error(`Form not found: ${formId}`);
    if (!data.rankGroupId) {
      throw new Error("rankGroupId is required to create a version. Please select a rank group first.");
    }
    return formVersionsRepo.create({ ...data, formId: form.id });
  },

  async createVersion(formUuid: string, data: Omit<InsertAdmFormVersionV2, "fvUuid" | "formId">): Promise<AdmFormVersionV2> {
    const form = await formsRepo.findByUuid(formUuid);
    if (!form) throw new Error(`Form not found: ${formUuid}`);
    if (!data.rankGroupId) {
      throw new Error("rankGroupId is required to create a version. Please select a rank group first.");
    }
    return formVersionsRepo.create({ ...data, formId: form.id });
  },
};
