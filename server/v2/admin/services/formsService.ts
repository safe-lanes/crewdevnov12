import { FormsRepository } from "../repositories/formsRepository";
import { FormVersionsRepository } from "../repositories/formVersionsRepository";
import { RankGroupsRepository } from "../repositories/rankGroupsRepository";
import { applyAuditUser } from "../utils/auditUser";
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
    return formsRepo.create(applyAuditUser(data, true));
  },

  async updateById(id: number, data: Partial<InsertAdmFormV2>): Promise<AdmFormV2> {
    const form = await formsRepo.updateById(id, applyAuditUser(data));
    if (!form) throw new Error(`Form not found: ${id}`);
    return form;
  },

  async update(formUuid: string, data: Partial<InsertAdmFormV2>): Promise<AdmFormV2> {
    const form = await formsRepo.update(formUuid, applyAuditUser(data));
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
    const candidateForms = allForms.filter(f => {
      if (category && f.category !== category) return false;
      return true;
    });
    if (candidateForms.length === 0) return null;

    let matchedForm = null;
    let rankGroupConfig = null;
    let rankGroupName = null;

    for (const form of candidateForms) {
      const activeRankGroups = await rankGroupsRepo.findByFormId(form.id, false);

      const matchingGroups: Array<{ id: number; name: string; configuration: string | null; rgUuid: string }> = [];
      for (const rg of activeRankGroups) {
        try {
          const ranks = JSON.parse(rg.ranks);
          if (Array.isArray(ranks) && ranks.includes(rankLabel)) {
            matchingGroups.push({ id: rg.id, name: rg.name, configuration: rg.configuration, rgUuid: rg.rgUuid });
          }
        } catch (e) {}
      }

      if (matchingGroups.length === 0) continue;

      matchedForm = form;

      if (matchingGroups.length > 1) {
        console.warn(`⚠️ [V2 getFormForRank] Rank "${rankLabel}" found in ${matchingGroups.length} ACTIVE rank groups under form "${form.name}" (id:${form.id}): ${matchingGroups.map(g => `"${g.name}" (id:${g.id}, hasConfig:${!!g.configuration})`).join(', ')}`);
      }

      let selectedGroup = null;
      let latestReleasedVersion = null;

      const sortedGroups = matchingGroups.sort((a, b) => a.id - b.id);

      for (const group of sortedGroups) {
        const releasedVersion = await formVersionsRepo.findLatestReleasedByRankGroupId(group.id);
        if (releasedVersion?.configuration) {
          selectedGroup = group;
          latestReleasedVersion = releasedVersion;
          break;
        }
      }

      if (!selectedGroup) {
        const groupsWithConfig = sortedGroups.filter(g => g.configuration);
        selectedGroup = groupsWithConfig.length > 0 ? groupsWithConfig[0] : sortedGroups[0];
      }

      rankGroupName = selectedGroup.name;

      if (latestReleasedVersion?.configuration) {
        try {
          rankGroupConfig = typeof latestReleasedVersion.configuration === 'string'
            ? JSON.parse(latestReleasedVersion.configuration)
            : latestReleasedVersion.configuration;
          console.log(`✅ [V2 getFormForRank] Using latest released version ${latestReleasedVersion.versionNo} config for rank group "${selectedGroup.name}" (id:${selectedGroup.id}), form "${form.name}" (id:${form.id}), rank "${rankLabel}"`);
        } catch (e) {
          console.warn(`⚠️ [V2 getFormForRank] Failed to parse version config, falling back to rank group config:`, e);
        }
      }

      if (!rankGroupConfig) {
        console.log(`ℹ️ [V2 getFormForRank] No released form version found for rank group "${selectedGroup.name}" (id:${selectedGroup.id}), form "${form.name}" (id:${form.id}), rank "${rankLabel}". Runtime form will use defaults until a version is released.`);
      }

      break;
    }

    if (!matchedForm) {
      console.log(`ℹ️ [V2 getFormForRank] No active rank groups found for rank "${rankLabel}" across ${candidateForms.length} form(s)`);
      return { ...candidateForms[0], rankGroupName: null, rankGroupConfig: null };
    }

    return { ...matchedForm, rankGroupName, rankGroupConfig };
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
    const requestedStatus = (data.status ?? "draft").toLowerCase();
    const existingDraft = await formVersionsRepo.findDraftByRankGroupId(data.rankGroupId);
    if (existingDraft) {
      if (requestedStatus === "draft") {
        const updated = await formVersionsRepo.updateById(
          existingDraft.id,
          applyAuditUser({ configuration: data.configuration ?? null, sharedConfig: data.sharedConfig ?? null }),
        );
        if (!updated) throw new Error(`Form version not found: ${existingDraft.id}`);
        return updated;
      }
      throw new Error("A draft already exists for this rank group. Release or discard it before creating another draft.");
    }
    const rgVersions = await formVersionsRepo.findByFormId(form.id, data.rankGroupId);
    const maxVersionNo = rgVersions.reduce((max, v) => {
      const vNo = parseInt(v.versionNo, 10);
      return isNaN(vNo) ? max : Math.max(max, vNo);
    }, 0);
    const nextVersionNo = String(maxVersionNo + 1).padStart(2, "0");
    return formVersionsRepo.create(applyAuditUser({
      ...data,
      formId: form.id,
      versionNo: nextVersionNo,
      status: "draft",
    }, true));
  },

  async createVersion(formUuid: string, data: Omit<InsertAdmFormVersionV2, "fvUuid" | "formId">): Promise<AdmFormVersionV2> {
    const form = await formsRepo.findByUuid(formUuid);
    if (!form) throw new Error(`Form not found: ${formUuid}`);
    return this.createVersionByFormId(form.id, data);
  },

  async getVersionById(id: number): Promise<AdmFormVersionV2> {
    const version = await formVersionsRepo.findById(id);
    if (!version) throw new Error(`Form version not found: ${id}`);
    return version;
  },

  async updateVersionById(id: number, data: Partial<InsertAdmFormVersionV2>): Promise<AdmFormVersionV2> {
    const version = await formVersionsRepo.updateById(id, applyAuditUser(data));
    if (!version) throw new Error(`Form version not found: ${id}`);
    return version;
  },

  async releaseVersionById(id: number): Promise<AdmFormVersionV2> {
    const existing = await formVersionsRepo.findById(id);
    if (!existing) throw new Error(`Form version not found: ${id}`);
    if (existing.status !== "draft") {
      throw new Error("Only draft versions can be released.");
    }
    const now = new Date();
    const versionDate = now.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).replace(/ /g, "-");
    const version = await formVersionsRepo.updateById(id, applyAuditUser({
      status: "released",
      versionDate,
      releasedAt: now,
    }));
    if (!version) throw new Error(`Form version not found: ${id}`);

    try {
      const allVersions = await formVersionsRepo.findByFormId(version.formId);
      const released = allVersions.filter(v => v.status === "released");
      if (released.length > 0) {
        const latest = released.reduce((max, v) => {
          const vNo = parseInt(v.versionNo, 10);
          const maxNo = parseInt(max.versionNo, 10);
          if (isNaN(vNo)) return max;
          if (isNaN(maxNo)) return v;
          return vNo > maxNo ? v : max;
        }, released[0]);
        await formsRepo.updateById(version.formId, {
          versionNo: latest.versionNo,
          versionDate: latest.versionDate,
        });
      }
    } catch (err) {
      console.error(`⚠️ [V2 RELEASE] Failed to sync parent form version for form ${version.formId}:`, err);
    }

    return version;
  },

  async deleteVersionById(id: number): Promise<boolean> {
    return formVersionsRepo.softDeleteById(id);
  },
};
