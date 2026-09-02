import { eq, and, desc, isNull, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db";
import { admFormVersionsV2, admFormsV2, admRankGroupsV2 } from "../../../../shared/v2/admin/schema";
import { RankGroupsRepository } from "../repositories/rankGroupsRepository";
import { FormsRepository } from "../repositories/formsRepository";
import { FormVersionsRepository } from "../repositories/formVersionsRepository";
import { applyAuditUser } from "../utils/auditUser";
import { copyFormVersionStructure, formStructureService } from "./formStructureService";
import type { AdmRankGroupV2, InsertAdmRankGroupV2 } from "../../../../shared/v2/admin/types";
import { getBaseRank } from "../../../../shared/crew-mapping";
import { formStructureRepository } from "../repositories/formStructureRepository";

const rankGroupsRepo = new RankGroupsRepository();
const formsRepo = new FormsRepository();
const formVersionsRepo = new FormVersionsRepository();

class CopyFormConfigurationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 400 | 404 | 409,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "CopyFormConfigurationError";
  }
}

function versionDateToday(): string {
  return new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).replace(/ /g, "-");
}

async function getCopySourcesForRankGroup(rankGroupId: number) {
  const target = await rankGroupsRepo.findById(rankGroupId);
  if (!target) throw new CopyFormConfigurationError(`Rank group not found: ${rankGroupId}`, 404);
  const groups = await rankGroupsRepo.findByFormId(target.formId, false);
  const versions = [];
  for (const group of groups) {
    const groupVersions = await formVersionsRepo.findByFormId(target.formId, group.id);
    for (const version of groupVersions.filter((item) => item.status === "draft" || item.status === "released")) {
      const counts = await formStructureRepository.getStructureSummary(version.fvUuid);
      if (group.id !== target.id && (counts.sections > 0 || counts.questions > 0 || counts.optionSets > 0 || counts.options > 0)) {
        versions.push({
          sourceRankGroupId: group.id,
          sourceRankGroupName: group.name,
          sourceFormVersionUuid: version.fvUuid,
          versionNo: version.versionNo,
          status: version.status,
          ...counts,
        });
      }
    }
  }
  const targetDraft = await formVersionsRepo.findDraftByRankGroupId(target.id);
  const targetReleased = await formVersionsRepo.findLatestReleasedByRankGroupId(target.id);
  const targetVersion = targetDraft ?? targetReleased;
  return {
    target: {
      rankGroupId: target.id,
      rankGroupName: target.name,
      formId: target.formId,
      draftVersionUuid: targetDraft?.fvUuid ?? null,
      draftVersionNo: targetDraft?.versionNo ?? null,
      releasedVersionNo: targetReleased?.versionNo ?? null,
      targetStatus: targetDraft ? "draft" : targetReleased ? "released" : "empty",
      ...(targetVersion ? await formStructureRepository.getStructureSummary(targetVersion.fvUuid) : {
        sections: 0,
        questions: 0,
        optionSets: 0,
        options: 0,
      }),
    },
    sources: versions,
  };
}

async function copyFormConfiguration(
  targetRankGroupId: number,
  sourceFormVersionUuid: string,
  confirmReplace: boolean,
  auditUserUuid: string | null = null,
) {
  const db = getDb();
  return db.transaction(async (tx: any) => {
    const targetRows = await tx
      .select()
      .from(admRankGroupsV2)
      .where(and(
        eq(admRankGroupsV2.id, targetRankGroupId),
        eq(admRankGroupsV2.isDeleted, false),
        isNull(admRankGroupsV2.archivedAt),
      ))
      .for("update");
    const targetGroup = targetRows[0];
    if (!targetGroup) {
      throw new CopyFormConfigurationError(`Rank group not found: ${targetRankGroupId}`, 404);
    }

    const sourceRows = await tx
      .select()
      .from(admFormVersionsV2)
      .where(and(
        eq(admFormVersionsV2.fvUuid, sourceFormVersionUuid),
        eq(admFormVersionsV2.isDeleted, false),
      ));
    const sourceVersion = sourceRows[0];
    if (!sourceVersion) {
      throw new CopyFormConfigurationError(`Source form version not found: ${sourceFormVersionUuid}`, 404);
    }
    if (sourceVersion.status !== "draft" && sourceVersion.status !== "released") {
      throw new CopyFormConfigurationError("Only draft or released form versions can be copied.", 400);
    }
    if (sourceVersion.formId !== targetGroup.formId) {
      throw new CopyFormConfigurationError("Source and target rank groups must belong to the same form.", 409);
    }
    if (sourceVersion.rankGroupId == null) {
      throw new CopyFormConfigurationError("The selected source version is not assigned to a rank group.", 400);
    }
    if (sourceVersion.rankGroupId === targetGroup.id) {
      throw new CopyFormConfigurationError("Choose a source from another rank group.", 400);
    }
    const sourceGroupRows = await tx
      .select({ id: admRankGroupsV2.id })
      .from(admRankGroupsV2)
      .where(and(
        eq(admRankGroupsV2.id, sourceVersion.rankGroupId),
        eq(admRankGroupsV2.formId, targetGroup.formId),
        eq(admRankGroupsV2.isDeleted, false),
        isNull(admRankGroupsV2.archivedAt),
      ))
      .limit(1);
    if (!sourceGroupRows[0]) {
      throw new CopyFormConfigurationError("The selected source rank group is no longer active.", 400);
    }
    const sourceCounts = await formStructureRepository.getStructureSummary(sourceVersion.fvUuid, tx);
    if (sourceCounts.sections === 0 && sourceCounts.questions === 0 && sourceCounts.optionSets === 0 && sourceCounts.options === 0) {
      throw new CopyFormConfigurationError("The selected source version has no configured content to copy.", 400);
    }

    const targetDraftRows = await tx
      .select()
      .from(admFormVersionsV2)
      .where(and(
        eq(admFormVersionsV2.formId, targetGroup.formId),
        eq(admFormVersionsV2.rankGroupId, targetGroup.id),
        eq(admFormVersionsV2.status, "draft"),
        eq(admFormVersionsV2.isDeleted, false),
      ))
      .orderBy(desc(admFormVersionsV2.createdAt))
      .limit(1);
    let targetVersion = targetDraftRows[0];
    if (!targetVersion) {
      const releasedRows = await tx
        .select()
        .from(admFormVersionsV2)
        .where(and(
          eq(admFormVersionsV2.formId, targetGroup.formId),
          eq(admFormVersionsV2.rankGroupId, targetGroup.id),
          eq(admFormVersionsV2.status, "released"),
          eq(admFormVersionsV2.isDeleted, false),
        ));
      if (releasedRows.length > 0) {
        throw new CopyFormConfigurationError(
          `Rank group "${targetGroup.name}" only has a released version. Create a draft before copying into it.`,
          409,
          { reason: "released_target_only" },
        );
      }
      const activeVersions = await tx
        .select({ versionNo: admFormVersionsV2.versionNo })
        .from(admFormVersionsV2)
        .where(and(
          eq(admFormVersionsV2.formId, targetGroup.formId),
          eq(admFormVersionsV2.rankGroupId, targetGroup.id),
          eq(admFormVersionsV2.isDeleted, false),
        ));
      const maxVersionNo = activeVersions.reduce((max: number, row: { versionNo: string }) => {
        const value = parseInt(row.versionNo, 10);
        return Number.isNaN(value) ? max : Math.max(max, value);
      }, 0);
      targetVersion = await formVersionsRepo.create(applyAuditUser({
        formId: targetGroup.formId,
        rankGroupId: targetGroup.id,
        versionNo: String(maxVersionNo + 1).padStart(2, "0"),
        versionDate: versionDateToday(),
        status: "draft",
        configuration: sourceVersion.configuration ?? null,
        sharedConfig: sourceVersion.sharedConfig ?? null,
        releasedAt: null,
        auditUserUuid,
      }, true), tx);
    } else {
      await tx
        .update(admFormVersionsV2)
        .set({
          configuration: sourceVersion.configuration ?? null,
          sharedConfig: sourceVersion.sharedConfig ?? null,
          updatedAt: new Date(),
          updatedByUuid: auditUserUuid,
        })
        .where(eq(admFormVersionsV2.fvUuid, targetVersion.fvUuid));
    }

    const discarded = await formStructureRepository.getStructureSummary(targetVersion.fvUuid, tx);
    const hasExistingContent = discarded.sections > 0 || discarded.questions > 0 || discarded.optionSets > 0 || discarded.options > 0;
    if (hasExistingContent && !confirmReplace) {
      throw new CopyFormConfigurationError(
        `Copying will replace ${discarded.sections} sections and ${discarded.questions} points in draft v${targetVersion.versionNo}. Confirm to continue.`,
        409,
        { reason: "confirmation_required", discarded, targetVersionUuid: targetVersion.fvUuid },
      );
    }
    await formStructureRepository.deleteStructure(targetVersion.fvUuid, tx);
    const copied = await copyFormVersionStructure(sourceVersion.fvUuid, targetVersion.fvUuid, tx);
    return {
      targetFormVersionUuid: targetVersion.fvUuid,
      targetVersionNo: targetVersion.versionNo,
      targetRankGroupId: targetGroup.id,
      targetRankGroupName: targetGroup.name,
      sourceFormVersionUuid: sourceVersion.fvUuid,
      sourceStatus: sourceVersion.status,
      sourceCounts,
      copied: {
        ...copied,
        optionSets: (await formStructureRepository.getStructureSummary(targetVersion.fvUuid, tx)).optionSets,
      },
      discarded,
    };
  });
}

async function syncFormRankGroup(formId: number): Promise<void> {
  const activeGroups = await rankGroupsRepo.findByFormId(formId, false);
  const rankGroupNames = activeGroups.map(rg => rg.name).join(", ");
  await formsRepo.updateById(formId, { rankGroup: rankGroupNames || "" });
}

async function upsertDraftVersion(formId: number, rankGroupId: number, configuration: string, auditUserUuid: string | null = null): Promise<void> {
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
    await formVersionsRepo.updateById(existingDraft.id, applyAuditUser({ configuration, versionDate, auditUserUuid }));
    console.log(`✏️  [V2 DRAFT] Updated existing draft v${existingDraft.versionNo} for form ${formId}, rankGroup ${rankGroupId}`);
    return;
  }

  const rgVersions = await formVersionsRepo.findByFormId(formId, rankGroupId);
  const maxVersionNo = rgVersions.reduce((max, v) => {
    const vNo = parseInt(v.versionNo, 10);
    return isNaN(vNo) ? max : Math.max(max, vNo);
  }, 0);
  const nextVersionNo = String(maxVersionNo + 1).padStart(2, "0");

  const sourceVersion = await formVersionsRepo.findLatestReleasedByRankGroupId(rankGroupId);
  const db = getDb();
  await db.transaction(async (tx: any) => {
    const created = await formVersionsRepo.create(applyAuditUser({
      formId,
      rankGroupId,
      versionNo: nextVersionNo,
      versionDate,
      status: "draft",
      configuration,
      releasedAt: null,
      auditUserUuid,
    }, true), tx);
    if (sourceVersion?.fvUuid) {
      await copyFormVersionStructure(sourceVersion.fvUuid, created.fvUuid, tx);
    }
  });

  console.log(`✅ [V2 DRAFT] Created draft v${nextVersionNo} for form ${formId}, rankGroup ${rankGroupId}`);
}

// Transactionally creates a new released form-version, soft-deletes ALL
// lingering drafts for the rank group, and mirrors the configuration back to
// adm_rank_groups_v2. A SELECT … FOR UPDATE on the rank-group row serializes
// concurrent saves so versionNo allocation is race-safe.
async function releaseAndMirrorConfiguration(
  rankGroupId: number,
  configuration: string,
  auditUserUuid: string | null = null,
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
    const formRows = await tx
      .select({ formUuid: admFormsV2.formUuid })
      .from(admFormsV2)
      .where(and(eq(admFormsV2.id, formId), eq(admFormsV2.isDeleted, false)));
    const form = formRows[0];
    if (!form) throw new Error(`Form not found: ${formId}`);
    if (await formStructureService.hasStructureForForm(form.formUuid, tx)) {
      throw new Error(
        "Cannot create a direct released version because this form has configurable structure. Create a draft so structure can be copied before release.",
      );
    }

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
        auditUserUuid,
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
      .set(applyAuditUser({ configuration, auditUserUuid }))
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
  async getCopySources(rankGroupId: number) {
    return getCopySourcesForRankGroup(rankGroupId);
  },

  async copyFormConfiguration(
    targetRankGroupId: number,
    sourceFormVersionUuid: string,
    confirmReplace: boolean,
    auditUserUuid: string | null = null,
  ) {
    return copyFormConfiguration(targetRankGroupId, sourceFormVersionUuid, confirmReplace, auditUserUuid);
  },

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
    const literal = rankLabel.toLowerCase();
    const baseRank = getBaseRank(rankLabel).toLowerCase();

    const matchGroup = (predicate: (rank: string) => boolean) => {
      for (const group of activeGroups) {
        let ranks: string[] = [];
        try {
          ranks = typeof group.ranks === "string" ? JSON.parse(group.ranks) : group.ranks;
        } catch (e) { ranks = []; }
        if (ranks.some(r => predicate(r.toLowerCase()))) {
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
      return null;
    };

    // Prefer an exact (literal) match so admins who explicitly listed a
    // suffixed rank (e.g. "AB_1") keep their current behavior.
    const literalMatch = matchGroup(r => r === literal);
    if (literalMatch) return literalMatch;

    // Fall back to base-rank match: crew "AB_1" matches a group containing "AB".
    if (baseRank && baseRank !== literal) {
      const baseMatch = matchGroup(r => r === baseRank);
      if (baseMatch) return baseMatch;
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

  async updateConfigurationById(id: number, configuration: string, auditUserUuid: string | null = null): Promise<AdmRankGroupV2> {
    console.log(`📝 [V2 CONFIG SAVE] Saving draft configuration for rank group id=${id}, config length=${configuration.length}`);
    // Per spec: draft path must NOT write to adm_rank_groups_v2.configuration.
    // Released form versions are the sole source of truth for runtime.
    const existing = await rankGroupsRepo.findById(id);
    if (!existing) throw new Error(`Rank group not found: ${id}`);
    await upsertDraftVersion(existing.formId, id, configuration, auditUserUuid);
    console.log(`✅ [V2 CONFIG SAVE] Draft saved for rank group "${existing.name}" (id=${id}, formId=${existing.formId})`);
    return existing;
  },

  async updateConfiguration(rgUuid: string, configuration: string, auditUserUuid: string | null = null): Promise<AdmRankGroupV2> {
    const existing = await rankGroupsRepo.findByUuid(rgUuid);
    if (!existing) throw new Error(`Rank group not found: ${rgUuid}`);
    await upsertDraftVersion(existing.formId, existing.id, configuration, auditUserUuid);
    return existing;
  },

  // Used by the Promotion Review Form editor while it does not yet support
  // the full draft → release lifecycle. Saves the supplied configuration as a
  // brand-new released form-version AND mirrors it back onto
  // adm_rank_groups_v2.configuration so legacy runtime readers keep working.
  // A future task will switch the Promotion editor to the appraisal-style
  // draft list and remove the legacy snapshot.
  async releaseConfigurationById(id: number, configuration: string, auditUserUuid: string | null = null): Promise<AdmRankGroupV2> {
    console.log(`📝 [V2 RELEASE SAVE] Releasing configuration for rank group id=${id}, config length=${configuration.length}`);
    await releaseAndMirrorConfiguration(id, configuration, auditUserUuid);
    const updated = await rankGroupsRepo.findById(id);
    if (!updated) throw new Error(`Rank group not found: ${id}`);
    return updated;
  },

  async archiveById(id: number, auditUserUuid: string | null = null): Promise<AdmRankGroupV2> {
    const existing = await rankGroupsRepo.findById(id);
    if (!existing) throw new Error(`Rank group not found: ${id}`);
    const result = await rankGroupsRepo.archiveById(id, auditUserUuid);
    if (!result) throw new Error(`Rank group not found: ${id}`);
    await syncFormRankGroup(existing.formId);
    return result;
  },

  async archive(rgUuid: string, auditUserUuid: string | null = null): Promise<AdmRankGroupV2> {
    const existing = await rankGroupsRepo.findByUuid(rgUuid);
    if (!existing) throw new Error(`Rank group not found: ${rgUuid}`);
    const result = await rankGroupsRepo.archive(rgUuid, auditUserUuid);
    if (!result) throw new Error(`Rank group not found: ${rgUuid}`);
    await syncFormRankGroup(existing.formId);
    return result;
  },

  async unarchiveById(id: number, auditUserUuid: string | null = null): Promise<AdmRankGroupV2> {
    const existing = await rankGroupsRepo.findById(id);
    if (!existing) throw new Error(`Rank group not found: ${id}`);
    const result = await rankGroupsRepo.unarchiveById(id, auditUserUuid);
    if (!result) throw new Error(`Rank group not found: ${id}`);
    await syncFormRankGroup(existing.formId);
    return result;
  },

  async unarchive(rgUuid: string, auditUserUuid: string | null = null): Promise<AdmRankGroupV2> {
    const existing = await rankGroupsRepo.findByUuid(rgUuid);
    if (!existing) throw new Error(`Rank group not found: ${rgUuid}`);
    const result = await rankGroupsRepo.unarchive(rgUuid, auditUserUuid);
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
