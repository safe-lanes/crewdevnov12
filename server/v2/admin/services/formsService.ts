import { FormsRepository } from "../repositories/formsRepository";
import { FormVersionsRepository } from "../repositories/formVersionsRepository";
import { RankGroupsRepository } from "../repositories/rankGroupsRepository";
import { applyAuditUser } from "../utils/auditUser";
import { getDb } from "../../db";
import { copyFormVersionStructure } from "./formStructureService";
import { formStructureRepository } from "../repositories/formStructureRepository";
import { frmFormParts } from "../../../../shared/v2/forms-engine/schema";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { AdmFormV2, InsertAdmFormV2, AdmFormVersionV2, InsertAdmFormVersionV2, CreateCompanyFormV2Response } from "../../../../shared/v2/admin/types";
import { getBaseRank } from "../../../../shared/crew-mapping";
import { v4 as uuidv4 } from "uuid";

const formsRepo = new FormsRepository();
const formVersionsRepo = new FormVersionsRepository();
const rankGroupsRepo = new RankGroupsRepository();

export class CompanyFormArchivedError extends Error {
  readonly statusCode = 409;
  constructor(name: string) {
    super(`Company Form "${name}" is archived and is read-only.`);
    this.name = "CompanyFormArchivedError";
  }
}

export class CompanyFormNameConflictError extends Error {
  readonly statusCode = 409;
  constructor(name: string) {
    super(`A Company Form named "${name}" already exists. Rename the existing form or archive it before reusing this name.`);
    this.name = "CompanyFormNameConflictError";
  }
}

async function lockWritableForm(tx: any, formId: number) {
  const form = await formsRepo.lockById(formId, tx);
  if (!form) throw new Error(`Form not found: ${formId}`);
  if (form.category === "dynamic" && form.archivedAt) throw new CompanyFormArchivedError(form.name);
  return form;
}

async function lockWritableVersion(tx: any, versionId: number) {
  const initial = await formVersionsRepo.findById(versionId, tx);
  if (!initial) throw new Error(`Form version not found: ${versionId}`);
  const form = await lockWritableForm(tx, initial.formId);
  await tx.execute(sql`SELECT id FROM adm_form_versions_v2 WHERE id = ${versionId} FOR UPDATE`);
  const version = await formVersionsRepo.findById(versionId, tx);
  if (!version) throw new Error(`Form version not found: ${versionId}`);
  return { form, version };
}

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
  async getAll(includeArchivedCompanyForms = true): Promise<AdmFormV2[]> {
    return formsRepo.findAll(includeArchivedCompanyForms);
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

  async getPartsByFormId(id: number, versionUuid?: string) {
    const form = await formsRepo.findById(id);
    if (!form) throw new Error(`Form not found: ${id}`);
    if (versionUuid) {
      const version = await formVersionsRepo.findByUuid(versionUuid);
      if (!version || version.formId !== form.id) throw new Error(`Form version not found for form: ${versionUuid}`);
    }
    return getDb()
      .select({
        formPartUuid: frmFormParts.formPartUuid,
        formUuid: frmFormParts.formUuid,
        formVersionUuid: frmFormParts.formVersionUuid,
        partCode: frmFormParts.partCode,
        partTitle: frmFormParts.partTitle,
        partType: frmFormParts.partType,
        isOfficeOnly: frmFormParts.isOfficeOnly,
      })
      .from(frmFormParts)
      .where(and(
        eq(frmFormParts.formUuid, form.formUuid),
        versionUuid ? eq(frmFormParts.formVersionUuid, versionUuid) : isNull(frmFormParts.formVersionUuid),
        eq(frmFormParts.isDeleted, false),
      ))
      .orderBy(asc(frmFormParts.sortOrder), asc(frmFormParts.id));
  },

  async create(data: { name: string; description?: string | null; auditUserUuid?: string | null }): Promise<CreateCompanyFormV2Response> {
    const normalizedName = data.name.trim();
    if (!normalizedName) throw new Error("Company Form name is required");
    const duplicate = await formsRepo.findActiveDynamicNameConflict(normalizedName);
    if (duplicate) throw new CompanyFormNameConflictError(duplicate.name);

    const now = new Date();
    const date = `${String(now.getDate()).padStart(2, "0")}-${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][now.getMonth()]}-${now.getFullYear()}`;
    try {
      return await getDb().transaction(async (tx: any) => {
        const form = await formsRepo.create(applyAuditUser({
          name: normalizedName,
          description: data.description ?? null,
          category: "dynamic",
          rankGroup: "",
          versionNo: "01",
          versionDate: date,
          configuration: null,
          sharedConfig: null,
          isLockForm: true,
          auditUserUuid: data.auditUserUuid ?? null,
        } as Omit<InsertAdmFormV2, "formUuid">, true), tx);
        const version = await formVersionsRepo.create(applyAuditUser({
          formId: form.id,
          rankGroupId: null,
          versionNo: "01",
          versionDate: date,
          status: "draft",
          configuration: null,
          sharedConfig: null,
          releasedAt: null,
          auditUserUuid: data.auditUserUuid ?? null,
        }, true), tx);
        // GenericFormEditor requires a version-owned part before it can load
        // the initial draft. Keep this in the same transaction as both rows.
        await tx.insert(frmFormParts).values({
          formPartUuid: uuidv4(),
          formUuid: form.formUuid,
          formVersionUuid: version.fvUuid,
          partCode: "MAIN",
          partTitle: "Main Form",
          partType: "configurable",
          isOfficeOnly: false,
          sortOrder: 0,
          isDeleted: false,
          isSync: false,
        });
        return { form, version };
      });
    } catch (error: any) {
      if (error?.code === "23505" || error?.constraint === "uq_adm_forms_v2_active_dynamic_name") {
        const collision = await formsRepo.findActiveDynamicNameConflict(normalizedName);
        throw new CompanyFormNameConflictError(collision?.name ?? normalizedName);
      }
      throw error;
    }
  },

  async updateById(id: number, data: Partial<InsertAdmFormV2>): Promise<AdmFormV2> {
    if (data.name !== undefined) data = { ...data, name: data.name.trim() };
    let form: AdmFormV2 | undefined;
    try {
      form = await getDb().transaction(async (tx: any) => {
        const existing = await lockWritableForm(tx, id);
        if (existing.category === "dynamic" && data.name !== undefined) {
          const conflict = await formsRepo.findActiveDynamicNameConflict(data.name, id, tx);
          if (conflict) throw new CompanyFormNameConflictError(conflict.name);
        }
        const updated = await formsRepo.updateById(id, applyAuditUser(data), tx);
        if (!updated) throw new Error(`Form not found: ${id}`);
        return updated;
      });
    } catch (error: any) {
      if (error?.code === "23505") {
        const conflict = data.name ? await formsRepo.findActiveDynamicNameConflict(data.name, id) : undefined;
        if (conflict) throw new CompanyFormNameConflictError(conflict.name);
      }
      throw error;
    }
    if (!form) throw new Error(`Form not found: ${id}`);
    return form;
  },

  async update(formUuid: string, data: Partial<InsertAdmFormV2>): Promise<AdmFormV2> {
    if (data.name !== undefined) data = { ...data, name: data.name.trim() };
    const existing = await formsRepo.findByUuid(formUuid);
    if (!existing) throw new Error(`Form not found: ${formUuid}`);
    let form: AdmFormV2 | undefined;
    try {
      form = await getDb().transaction(async (tx: any) => {
        const locked = await lockWritableForm(tx, existing.id);
        if (locked.category === "dynamic" && data.name !== undefined) {
          const conflict = await formsRepo.findActiveDynamicNameConflict(data.name, existing.id, tx);
          if (conflict) throw new CompanyFormNameConflictError(conflict.name);
        }
        const updated = await formsRepo.update(formUuid, applyAuditUser(data), tx);
        if (!updated) throw new Error(`Form not found: ${formUuid}`);
        return updated;
      });
    } catch (error: any) {
      if (error?.code === "23505") {
        const conflict = data.name ? await formsRepo.findActiveDynamicNameConflict(data.name, existing.id) : undefined;
        if (conflict) throw new CompanyFormNameConflictError(conflict.name);
      }
      throw error;
    }
    if (!form) throw new Error(`Form not found: ${formUuid}`);
    return form;
  },

  async deleteById(id: number): Promise<boolean> {
    return getDb().transaction(async (tx: any) => {
      await lockWritableForm(tx, id);
      return formsRepo.softDeleteById(id, tx);
    });
  },

  async delete(formUuid: string): Promise<boolean> {
    const form = await formsRepo.findByUuid(formUuid);
    if (!form) return false;
    return getDb().transaction(async (tx: any) => {
      await lockWritableForm(tx, form.id);
      return formsRepo.softDelete(formUuid, tx);
    });
  },

  async archiveById(id: number, auditUserUuid: string | null = null): Promise<void> {
    const form = await formsRepo.findById(id);
    if (!form) throw new Error(`Form not found: ${id}`);
    if (form.category !== "dynamic") throw new Error("Only Company Forms can be archived at the form level.");
    if (form.archivedAt) return;
    const archived = await formsRepo.archiveDynamicById(id, auditUserUuid);
    if (!archived) {
      const current = await formsRepo.findById(id);
      if (!current) throw new Error(`Form not found: ${id}`);
      if (current.category !== "dynamic" || !current.archivedAt) throw new Error("Failed to archive Company Form");
    }
  },

  async getEligibleCompanyForms(): Promise<Array<{ form: AdmFormV2; version: AdmFormVersionV2 }>> {
    const forms = await formsRepo.findAll(false);
    const eligible: Array<{ form: AdmFormV2; version: AdmFormVersionV2 }> = [];
    for (const form of forms) {
      if (form.category !== "dynamic" || form.archivedAt) continue;
      const released = await formVersionsRepo.findLatestReleasedByFormId(form.id);
      if (released) eligible.push({ form, version: released });
    }
    return eligible;
  },

  async getFormForRank(rankLabel: string, category?: string): Promise<any> {
    const allForms = await formsRepo.findAll();
    const candidateForms = allForms.filter(f => {
      if (category && f.category !== category) return false;
      return true;
    });
    if (candidateForms.length === 0) return null;

    let matchedForm: typeof candidateForms[number] | null = null;
    let rankGroupConfig: any = null;
    let rankGroupName: string | null = null;
    let matchedReleasedVersion: { id: number; fvUuid: string } | null = null;

    const literal = rankLabel.toLowerCase();
    const baseRank = getBaseRank(rankLabel).toLowerCase();

    // Two-pass match: literal (case-insensitive exact) wins over base-rank
    // fallback. This preserves Task #362 precedence — admins who explicitly
    // listed a suffixed rank like "AB_3" keep their mapping even if another
    // active group covers the base "AB".
    type MatchPass = { label: string; predicate: (lowerRanks: string[]) => boolean };
    const passes: MatchPass[] = [
      { label: 'literal', predicate: (lr) => lr.includes(literal) },
    ];
    if (baseRank && baseRank !== literal) {
      passes.push({ label: 'base', predicate: (lr) => lr.includes(baseRank) });
    }

    passLoop:
    for (const pass of passes) {
      for (const form of candidateForms) {
        const activeRankGroups = await rankGroupsRepo.findByFormId(form.id, false);

        const matchingGroups: Array<{ id: number; name: string; configuration: string | null; rgUuid: string }> = [];
        for (const rg of activeRankGroups) {
          try {
            const ranks = JSON.parse(rg.ranks);
            if (!Array.isArray(ranks)) continue;
            const lowerRanks = ranks.map((r: unknown) => String(r).toLowerCase());
            if (pass.predicate(lowerRanks)) {
              matchingGroups.push({ id: rg.id, name: rg.name, configuration: rg.configuration, rgUuid: rg.rgUuid });
            }
          } catch (e) {}
        }

        if (matchingGroups.length === 0) continue;

        matchedForm = form;

        if (matchingGroups.length > 1) {
          console.warn(`⚠️ [V2 getFormForRank] Rank "${rankLabel}" (${pass.label} match) found in ${matchingGroups.length} ACTIVE rank groups under form "${form.name}" (id:${form.id}): ${matchingGroups.map(g => `"${g.name}" (id:${g.id}, hasConfig:${!!g.configuration})`).join(', ')}`);
        }

        let selectedGroup: typeof matchingGroups[number] | null = null;
        let latestReleasedVersion: Awaited<ReturnType<typeof formVersionsRepo.findLatestReleasedByRankGroupId>> | null = null;

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
            console.log(`✅ [V2 getFormForRank] Using latest released version ${latestReleasedVersion.versionNo} config for rank group "${selectedGroup.name}" (id:${selectedGroup.id}), form "${form.name}" (id:${form.id}), rank "${rankLabel}" (${pass.label} match)`);
          } catch (e) {
            console.warn(`⚠️ [V2 getFormForRank] Failed to parse version config, falling back to rank group config:`, e);
          }
        }

        if (!rankGroupConfig) {
          console.warn(`🚫 [V2 getFormForRank] No released form version for rank group "${selectedGroup.name}" (id:${selectedGroup.id}), form "${form.name}" (id:${form.id}), rank "${rankLabel}". Appraisal start blocked until a version is released.`);
        }

        break passLoop;
      }
    }

    if (!matchedForm) {
      console.log(`ℹ️ [V2 getFormForRank] No active rank groups found for rank "${rankLabel}" across ${candidateForms.length} form(s)`);
      // An unrelated form in the category is not a resolution for this rank.
      // The HTTP controller turns null into a clear 404 for API consumers.
      return null;
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

  async getVersionConfiguration(versionId: number): Promise<{ rankGroupName: string | null; rankGroupConfig: any | null; formVersionId: number; formVersionUuid: string; isLockForm: boolean }> {
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
    // Surface the parent form's lock-form flag so the editor can render the
    // correct lock/disabled UI for pinned (existing) appraisals.
    let isLockForm = false;
    try {
      const parent = await formsRepo.findById(version.formId);
      isLockForm = !!(parent as any)?.isLockForm;
    } catch {
      isLockForm = false;
    }
    return {
      rankGroupName,
      rankGroupConfig,
      formVersionId: version.id,
      formVersionUuid: version.fvUuid,
      isLockForm,
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
    if (form.category === "dynamic") {
      if (rankGroupId !== undefined) throw new Error("Company Forms do not use rank groups.");
      return formVersionsRepo.findByFormId(form.id, null);
    }
    return formVersionsRepo.findByFormId(form.id, rankGroupId);
  },

  async getVersions(formUuid: string, rankGroupId?: number): Promise<AdmFormVersionV2[]> {
    const form = await formsRepo.findByUuid(formUuid);
    if (!form) throw new Error(`Form not found: ${formUuid}`);
    if (form.category === "dynamic") {
      if (rankGroupId !== undefined) throw new Error("Company Forms do not use rank groups.");
      return formVersionsRepo.findByFormId(form.id, null);
    }
    return formVersionsRepo.findByFormId(form.id, rankGroupId);
  },

  async createVersionByFormId(formId: number, data: Omit<InsertAdmFormVersionV2, "fvUuid" | "formId">): Promise<AdmFormVersionV2> {
    return getDb().transaction(async (tx: any) => {
      const form = await lockWritableForm(tx, formId);
      const isCompanyForm = form.category === "dynamic";
      if (isCompanyForm && data.rankGroupId != null) {
        throw new Error("Company Forms cannot have rank-grouped versions.");
      }
      if (!isCompanyForm && !data.rankGroupId) {
        throw new Error("rankGroupId is required to create a version. Please select a rank group first.");
      }
      const rankGroupId = isCompanyForm ? null : data.rankGroupId!;
      const auditUserUuid = (data as any).auditUserUuid ?? null;
      const today = new Date();
      const todayStr = today.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).replace(/ /g, "-");
      const pickedVersionDate = isValidVersionDate(data.versionDate) ? data.versionDate! : todayStr;

      const existingDraft = isCompanyForm
        ? await formVersionsRepo.findDraftByFormId(form.id, tx)
        : await formVersionsRepo.findDraftByRankGroupId(rankGroupId!, tx);
      if (existingDraft) {
        const updated = await formVersionsRepo.updateById(
          existingDraft.id,
          applyAuditUser({
            configuration: data.configuration ?? null,
            sharedConfig: data.sharedConfig ?? null,
            versionDate: pickedVersionDate,
            auditUserUuid,
          }),
          tx,
        );
        if (!updated) throw new Error(`Form version not found: ${existingDraft.id}`);
        return updated;
      }
      const rgVersions = await formVersionsRepo.findByFormId(form.id, rankGroupId, tx);
      const maxVersionNo = rgVersions.reduce((max, v) => {
        const vNo = parseInt(v.versionNo, 10);
        return isNaN(vNo) ? max : Math.max(max, vNo);
      }, 0);
      const nextVersionNo = String(maxVersionNo + 1).padStart(2, "0");
      const sourceVersion = isCompanyForm
        ? await formVersionsRepo.findLatestReleasedByFormId(form.id, tx)
        : await formVersionsRepo.findLatestReleasedByRankGroupId(rankGroupId!, tx);
      const created = await formVersionsRepo.create(applyAuditUser({
        configuration: data.configuration ?? null,
        sharedConfig: data.sharedConfig ?? null,
        rankGroupId,
        formId: form.id,
        versionNo: nextVersionNo,
        versionDate: pickedVersionDate,
        status: "draft",
        releasedAt: null,
        auditUserUuid,
      }, true), tx);
      if (sourceVersion?.fvUuid) {
        await copyFormVersionStructure(sourceVersion.fvUuid, created.fvUuid, tx);
      } else {
        await formStructureRepository.initializePartsFromTemplates(form.formUuid, created.fvUuid, tx);
      }
      return created;
    });
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
    return getDb().transaction(async (tx: any) => {
      await lockWritableVersion(tx, id);
      const version = await formVersionsRepo.updateById(id, applyAuditUser(data), tx);
      if (!version) throw new Error(`Form version not found: ${id}`);
      return version;
    });
  },

  async releaseVersionById(id: number, auditUserUuid: string | null = null): Promise<AdmFormVersionV2> {
    return getDb().transaction(async (tx: any) => {
      const { form, version: existing } = await lockWritableVersion(tx, id);
      if (existing.status !== "draft") throw new Error("Only draft versions can be released.");
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
        auditUserUuid,
      }), tx);
      if (!version) throw new Error(`Form version not found: ${id}`);
      const allVersions = await formVersionsRepo.findByFormId(
        version.formId, form.category === "dynamic" ? null : undefined, tx,
      );
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
        }, tx);
      }
      return version;
    });
  },

  async deleteVersionById(id: number): Promise<boolean> {
    return getDb().transaction(async (tx: any) => {
      await lockWritableVersion(tx, id);
      return formVersionsRepo.softDeleteById(id, tx);
    });
  },
};
