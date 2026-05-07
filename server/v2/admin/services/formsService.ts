import { FormsRepository } from "../repositories/formsRepository";
import { FormVersionsRepository } from "../repositories/formVersionsRepository";
import { RankGroupsRepository } from "../repositories/rankGroupsRepository";
import { applyAuditUser } from "../utils/auditUser";
import type { AdmFormV2, InsertAdmFormV2, AdmFormVersionV2, InsertAdmFormVersionV2 } from "../../../../shared/v2/admin/types";

const formsRepo = new FormsRepository();
const formVersionsRepo = new FormVersionsRepository();
const rankGroupsRepo = new RankGroupsRepository();

// DD-MMM-YYYY (e.g. 07-May-2026). Reject anything that isn't a real calendar date.
const VERSION_DATE_RE = /^(\d{2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{4})$/;
function isValidVersionDate(value: string | null | undefined): value is string {
  if (!value || typeof value !== "string") return false;
  const m = VERSION_DATE_RE.exec(value);
  if (!m) return false;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const day = parseInt(m[1], 10);
  const monthIdx = months.indexOf(m[2]);
  const year = parseInt(m[3], 10);
  const d = new Date(Date.UTC(year, monthIdx, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === monthIdx && d.getUTCDate() === day;
}

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
    let matchedReleasedVersion: { id: number; fvUuid: string } | null = null;

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
          matchedReleasedVersion = { id: latestReleasedVersion.id, fvUuid: latestReleasedVersion.fvUuid };
          console.log(`✅ [V2 getFormForRank] Using latest released version ${latestReleasedVersion.versionNo} config for rank group "${selectedGroup.name}" (id:${selectedGroup.id}), form "${form.name}" (id:${form.id}), rank "${rankLabel}"`);
        } catch (e) {
          console.warn(`⚠️ [V2 getFormForRank] Failed to parse version config, falling back to rank group config:`, e);
        }
      }

      if (!rankGroupConfig) {
        console.warn(`🚫 [V2 getFormForRank] No released form version for rank group "${selectedGroup.name}" (id:${selectedGroup.id}), form "${form.name}" (id:${form.id}), rank "${rankLabel}". Appraisal start blocked until a version is released.`);
      }

      break;
    }

    if (!matchedForm) {
      console.log(`ℹ️ [V2 getFormForRank] No active rank groups found for rank "${rankLabel}" across ${candidateForms.length} form(s)`);
      return {
        ...candidateForms[0],
        rankGroupName: null,
        rankGroupConfig: null,
        noReleasedVersion: true,
        noReleasedVersionReason: `No active rank group covers rank "${rankLabel}".`,
      };
    }

    if (!rankGroupConfig) {
      return {
        ...matchedForm,
        rankGroupName,
        rankGroupConfig: null,
        formVersionId: null,
        formVersionUuid: null,
        noReleasedVersion: true,
        noReleasedVersionReason: `No released form version exists for rank group "${rankGroupName}". Release a draft before starting an appraisal.`,
      };
    }

    return {
      ...matchedForm,
      rankGroupName,
      rankGroupConfig,
      formVersionId: matchedReleasedVersion?.id ?? null,
      formVersionUuid: matchedReleasedVersion?.fvUuid ?? null,
      noReleasedVersion: false,
    };
  },

  async getVersionConfiguration(versionId: number): Promise<{ rankGroupName: string | null; rankGroupConfig: any | null; formVersionId: number; formVersionUuid: string }> {
    // Include soft-deleted versions: appraisals pinned to a version that was
    // later deleted in the Form Editor must still resolve their frozen config.
    const version = await formVersionsRepo.findByIdIncludingDeleted(versionId);
    if (!version) throw new Error(`Form version not found: ${versionId}`);
    let rankGroupName: string | null = null;
    if (version.rankGroupId != null) {
      const rg = await rankGroupsRepo.findById(version.rankGroupId);
      rankGroupName = rg?.name ?? null;
    }
    let rankGroupConfig: any = null;
    if (version.configuration) {
      try {
        rankGroupConfig = typeof version.configuration === "string"
          ? JSON.parse(version.configuration)
          : version.configuration;
      } catch (e) {
        console.warn(`⚠️ [V2 getVersionConfiguration] Failed to parse configuration for version id ${versionId}:`, e);
      }
    }
    return {
      rankGroupName,
      rankGroupConfig,
      formVersionId: version.id,
      formVersionUuid: version.fvUuid,
    };
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
    // Server-controlled metadata: ignore client-supplied versionNo / releasedAt / status.
    // All new versions are drafts; release happens via releaseVersionById.
    // versionDate IS honored when supplied (admin-picked date); falls back to today.
    const today = new Date();
    const todayStr = today.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).replace(/ /g, "-");
    const pickedVersionDate = isValidVersionDate(data.versionDate) ? data.versionDate! : todayStr;

    const existingDraft = await formVersionsRepo.findDraftByRankGroupId(data.rankGroupId);
    if (existingDraft) {
      const updated = await formVersionsRepo.updateById(
        existingDraft.id,
        applyAuditUser({
          configuration: data.configuration ?? null,
          sharedConfig: data.sharedConfig ?? null,
          versionDate: pickedVersionDate,
        }),
      );
      if (!updated) throw new Error(`Form version not found: ${existingDraft.id}`);
      return updated;
    }
    const rgVersions = await formVersionsRepo.findByFormId(form.id, data.rankGroupId);
    const maxVersionNo = rgVersions.reduce((max, v) => {
      const vNo = parseInt(v.versionNo, 10);
      return isNaN(vNo) ? max : Math.max(max, vNo);
    }, 0);
    const nextVersionNo = String(maxVersionNo + 1).padStart(2, "0");
    return formVersionsRepo.create(applyAuditUser({
      configuration: data.configuration ?? null,
      sharedConfig: data.sharedConfig ?? null,
      rankGroupId: data.rankGroupId,
      formId: form.id,
      versionNo: nextVersionNo,
      versionDate: pickedVersionDate,
      status: "draft",
      releasedAt: null,
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
    // Preserve the draft's versionDate (admin-picked at Save Draft time).
    // Fall back to today only if the draft somehow lacks a valid date.
    const now = new Date();
    const todayStr = now.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).replace(/ /g, "-");
    const versionDate = isValidVersionDate(existing.versionDate) ? existing.versionDate! : todayStr;
    const version = await formVersionsRepo.updateById(id, applyAuditUser({
      status: "released",
      versionDate,
      releasedAt: now,
    }));
    if (!version) throw new Error(`Form version not found: ${id}`);

    // Parent form metadata MUST stay in sync with the latest released version.
    // Errors here propagate so the API surfaces a 500 rather than returning success
    // with a divergent parent record.
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

    return version;
  },

  async deleteVersionById(id: number): Promise<boolean> {
    return formVersionsRepo.softDeleteById(id);
  },
};
