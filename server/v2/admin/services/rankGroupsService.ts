import { eq, and, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db";
import { admFormVersionsV2, admRankGroupsV2 } from "../../../../shared/v2/admin/schema";
import { RankGroupsRepository } from "../repositories/rankGroupsRepository";
import { FormsRepository } from "../repositories/formsRepository";
import { FormVersionsRepository } from "../repositories/formVersionsRepository";
import { applyAuditUser } from "../utils/auditUser";
import type { AdmRankGroupV2, InsertAdmRankGroupV2 } from "../../../../shared/v2/admin/types";

const rankGroupsRepo = new RankGroupsRepository();
const formsRepo = new FormsRepository();
const formVersionsRepo = new FormVersionsRepository();

async function syncFormRankGroup(formId: number): Promise<void> {
  const activeGroups = await rankGroupsRepo.findByFormId(formId, false);
  const rankGroupNames = activeGroups.map(rg => rg.name).join(", ");
  await formsRepo.updateById(formId, { rankGroup: rankGroupNames || "" });
}

async function upsertDraftVersion(formId: number, rankGroupId: number, configuration: string): Promise<void> {
  const form = await formsRepo.findById(formId);
  if (!form) throw new Error(`Form not found: ${formId}`);

  const now = new Date();
  const versionDate = now.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).replace(/ /g, "-");

  const existingDraft = await formVersionsRepo.findDraftByRankGroupId(rankGroupId);
  if (existingDraft) {
    await formVersionsRepo.updateById(existingDraft.id, applyAuditUser({ configuration, versionDate }));
    console.log(`✏️  [V2 DRAFT] Updated existing draft v${existingDraft.versionNo} for form ${formId}, rankGroup ${rankGroupId}`);
    return;
  }

  const rgVersions = await formVersionsRepo.findByFormId(formId, rankGroupId);
  const maxVersionNo = rgVersions.reduce((max, v) => {
    const vNo = parseInt(v.versionNo, 10);
    return isNaN(vNo) ? max : Math.max(max, vNo);
  }, 0);
  const nextVersionNo = String(maxVersionNo + 1).padStart(2, "0");

  await formVersionsRepo.create(applyAuditUser({
    formId,
    rankGroupId,
    versionNo: nextVersionNo,
    versionDate,
    status: "draft",
    configuration,
    releasedAt: null,
  }, true));

  console.log(`✅ [V2 DRAFT] Created draft v${nextVersionNo} for form ${formId}, rankGroup ${rankGroupId}`);
}

// Transactionally creates a new released form-version, soft-deletes ALL
// lingering drafts for the rank group, and mirrors the configuration back to
// adm_rank_groups_v2. A SELECT … FOR UPDATE on the rank-group row serializes
// concurrent saves so versionNo allocation is race-safe.
async function releaseAndMirrorConfiguration(
  rankGroupId: number,
  configuration: string,
): Promise<{ formId: number; rankGroupName: string; versionNo: string }> {
  const db = getDb();
  return db.transaction(async (tx: any) => {
    const lockedRows = await tx.execute(sql`
      SELECT id, form_id, name
      FROM ${admRankGroupsV2}
      WHERE id = ${rankGroupId} AND is_deleted = false
      FOR UPDATE
    `);
    const locked = (lockedRows.rows ?? lockedRows)[0];
    if (!locked) throw new Error(`Rank group not found: ${rankGroupId}`);
    const formId = Number(locked.form_id);
    const rankGroupName = String(locked.name);

    const now = new Date();
    const versionDate = now.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).replace(/ /g, "-");

    const existingVersions = await tx
      .select({ versionNo: admFormVersionsV2.versionNo })
      .from(admFormVersionsV2)
      .where(and(
        eq(admFormVersionsV2.formId, formId),
        eq(admFormVersionsV2.rankGroupId, rankGroupId),
      ));
    const maxVersionNo = existingVersions.reduce((max: number, v: { versionNo: string }) => {
      const vNo = parseInt(v.versionNo, 10);
      return isNaN(vNo) ? max : Math.max(max, vNo);
    }, 0);
    const nextVersionNo = String(maxVersionNo + 1).padStart(2, "0");

    await tx
      .insert(admFormVersionsV2)
      .values(applyAuditUser({
        fvUuid: uuidv4(),
        formId,
        rankGroupId,
        versionNo: nextVersionNo,
        versionDate,
        status: "released",
        configuration,
        releasedAt: now,
      }, true));

    const deletedDrafts = await tx
      .update(admFormVersionsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(
        eq(admFormVersionsV2.rankGroupId, rankGroupId),
        eq(admFormVersionsV2.status, "draft"),
        eq(admFormVersionsV2.isDeleted, false),
      ))
      .returning({ id: admFormVersionsV2.id, versionNo: admFormVersionsV2.versionNo });
    if (deletedDrafts.length > 0) {
      console.log(`🧹 [V2 RELEASE] Removed ${deletedDrafts.length} lingering draft(s) [${deletedDrafts.map((d: any) => `v${d.versionNo}`).join(", ")}] for form ${formId}, rankGroup ${rankGroupId}`);
    }

    await tx
      .update(admRankGroupsV2)
      .set(applyAuditUser({ configuration, updatedAt: new Date() }))
      .where(and(eq(admRankGroupsV2.id, rankGroupId), eq(admRankGroupsV2.isDeleted, false)));

    console.log(`✅ [V2 RELEASE] Created released v${nextVersionNo} for form ${formId}, rankGroup ${rankGroupId} ("${rankGroupName}")`);
    return { formId, rankGroupName, versionNo: nextVersionNo };
  });
}

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

    const result = await rankGroupsRepo.create(applyAuditUser(data, true));
    await syncFormRankGroup(data.formId);
    return result;
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

    const result = await rankGroupsRepo.updateById(id, applyAuditUser(data));
    if (!result) throw new Error(`Rank group not found: ${id}`);
    if (data.name || data.ranks) await syncFormRankGroup(existing.formId);
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

    const result = await rankGroupsRepo.update(rgUuid, applyAuditUser(data));
    if (!result) throw new Error(`Rank group not found: ${rgUuid}`);
    if (data.name || data.ranks) await syncFormRankGroup(existing.formId);
    return result;
  },

  async updateConfigurationById(id: number, configuration: string): Promise<AdmRankGroupV2> {
    console.log(`📝 [V2 CONFIG SAVE] Saving draft configuration for rank group id=${id}, config length=${configuration.length}`);
    // Per spec: draft path must NOT write to adm_rank_groups_v2.configuration.
    // Released form versions are the sole source of truth for runtime.
    const existing = await rankGroupsRepo.findById(id);
    if (!existing) throw new Error(`Rank group not found: ${id}`);
    await upsertDraftVersion(existing.formId, id, configuration);
    console.log(`✅ [V2 CONFIG SAVE] Draft saved for rank group "${existing.name}" (id=${id}, formId=${existing.formId})`);
    return existing;
  },

  async updateConfiguration(rgUuid: string, configuration: string): Promise<AdmRankGroupV2> {
    const existing = await rankGroupsRepo.findByUuid(rgUuid);
    if (!existing) throw new Error(`Rank group not found: ${rgUuid}`);
    await upsertDraftVersion(existing.formId, existing.id, configuration);
    return existing;
  },

  // Used by the Promotion Review Form editor while it does not yet support
  // the full draft → release lifecycle. Saves the supplied configuration as a
  // brand-new released form-version AND mirrors it back onto
  // adm_rank_groups_v2.configuration so legacy runtime readers keep working.
  // A future task will switch the Promotion editor to the appraisal-style
  // draft list and remove the legacy snapshot.
  async releaseConfigurationById(id: number, configuration: string): Promise<AdmRankGroupV2> {
    console.log(`📝 [V2 RELEASE SAVE] Releasing configuration for rank group id=${id}, config length=${configuration.length}`);
    await releaseAndMirrorConfiguration(id, configuration);
    const updated = await rankGroupsRepo.findById(id);
    if (!updated) throw new Error(`Rank group not found: ${id}`);
    return updated;
  },

  async archiveById(id: number): Promise<AdmRankGroupV2> {
    const existing = await rankGroupsRepo.findById(id);
    if (!existing) throw new Error(`Rank group not found: ${id}`);
    const result = await rankGroupsRepo.archiveById(id);
    if (!result) throw new Error(`Rank group not found: ${id}`);
    await syncFormRankGroup(existing.formId);
    return result;
  },

  async archive(rgUuid: string): Promise<AdmRankGroupV2> {
    const existing = await rankGroupsRepo.findByUuid(rgUuid);
    if (!existing) throw new Error(`Rank group not found: ${rgUuid}`);
    const result = await rankGroupsRepo.archive(rgUuid);
    if (!result) throw new Error(`Rank group not found: ${rgUuid}`);
    await syncFormRankGroup(existing.formId);
    return result;
  },

  async unarchiveById(id: number): Promise<AdmRankGroupV2> {
    const existing = await rankGroupsRepo.findById(id);
    if (!existing) throw new Error(`Rank group not found: ${id}`);
    const result = await rankGroupsRepo.unarchiveById(id);
    if (!result) throw new Error(`Rank group not found: ${id}`);
    await syncFormRankGroup(existing.formId);
    return result;
  },

  async unarchive(rgUuid: string): Promise<AdmRankGroupV2> {
    const existing = await rankGroupsRepo.findByUuid(rgUuid);
    if (!existing) throw new Error(`Rank group not found: ${rgUuid}`);
    const result = await rankGroupsRepo.unarchive(rgUuid);
    if (!result) throw new Error(`Rank group not found: ${rgUuid}`);
    await syncFormRankGroup(existing.formId);
    return result;
  },

  async deleteById(id: number): Promise<boolean> {
    const existing = await rankGroupsRepo.findById(id);
    const deleted = await rankGroupsRepo.softDeleteById(id);
    if (deleted && existing) await syncFormRankGroup(existing.formId);
    return deleted;
  },

  async delete(rgUuid: string): Promise<boolean> {
    const existing = await rankGroupsRepo.findByUuid(rgUuid);
    const deleted = await rankGroupsRepo.softDelete(rgUuid);
    if (deleted && existing) await syncFormRankGroup(existing.formId);
    return deleted;
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
