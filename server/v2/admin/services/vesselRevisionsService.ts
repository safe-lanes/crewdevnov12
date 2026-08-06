import { getDb } from "../../db";
import { VesselRevisionsRepository } from "../repositories/vesselRevisionsRepository";
import { VesselDraftsRepository } from "../repositories/vesselDraftsRepository";
import { AvailableRanksRepository } from "../repositories/availableRanksRepository";
import { CompanyRanksRepository } from "../repositories/companyRanksRepository";
import { VesselPlanningRepository } from "../../vessel/repositories/vesselPlanningRepository";
import { applyAuditUser } from "../utils/auditUser";
import type { AdmVesselRevisionV2, InsertAdmVesselRevisionV2 } from "../../../../shared/v2/admin/types";

const vesselRevisionsRepo = new VesselRevisionsRepository();
const vesselDraftsRepo = new VesselDraftsRepository();
const availableRanksRepo = new AvailableRanksRepository();
const companyRanksRepo = new CompanyRanksRepository();
const vesselPlanningRepo = new VesselPlanningRepository();

export const vesselRevisionsService = {
  async getAll(): Promise<AdmVesselRevisionV2[]> {
    return vesselRevisionsRepo.findAll();
  },

  async getById(id: number): Promise<AdmVesselRevisionV2> {
    const record = await vesselRevisionsRepo.findById(id);
    if (!record) throw new Error(`Vessel revision not found: ${id}`);
    return record;
  },

  async getByVesselId(vesselId: string): Promise<AdmVesselRevisionV2[]> {
    return vesselRevisionsRepo.findByVesselId(vesselId);
  },

  async create(data: Omit<InsertAdmVesselRevisionV2, "vrUuid">): Promise<AdmVesselRevisionV2> {
    return vesselRevisionsRepo.create(applyAuditUser(data, true));
  },

  async getNextRevision(vesselId: string): Promise<string> {
    return vesselRevisionsRepo.getNextRevision(vesselId);
  },

  async submit(data: { vesselId: string; revisionData: string; revisionDate: string }): Promise<{
    success: boolean;
    revision: AdmVesselRevisionV2;
    metadata: { autoAssignedRevision: string; deletedDrafts: number; createdPlanningRecords: number };
  }> {
    const autoAssignedRevision = await vesselRevisionsRepo.getNextRevision(data.vesselId);

    const revision = await vesselRevisionsRepo.create(applyAuditUser({
      vesselId: data.vesselId,
      revision: autoAssignedRevision,
      revisionDate: data.revisionDate,
      revisionData: data.revisionData,
    }, true));

    const existingDrafts = await vesselDraftsRepo.findByVesselId(data.vesselId);
    let deletedDrafts = 0;
    for (const draft of existingDrafts) {
      const deleted = await vesselDraftsRepo.hardDeleteById(draft.id);
      if (deleted) deletedDrafts++;
    }

    let createdPlanningRecords = 0;
    try {
      createdPlanningRecords = await this.syncVesselPlanningV2(data.vesselId, data.revisionData);
    } catch (syncError) {
      console.error(`[VESSEL REVISION V2] Failed to sync vessel_planning_v2:`, syncError);
    }

    return {
      success: true,
      revision,
      metadata: { autoAssignedRevision, deletedDrafts, createdPlanningRecords },
    };
  },

  async getRanksByVesselId(vesselId: string): Promise<any[]> {
    const revisions = await vesselRevisionsRepo.findByVesselId(vesselId);

    if (revisions.length === 0) {
      return [];
    }

    const latestRevision = revisions[0];
    const rankData = typeof latestRevision.revisionData === 'string'
      ? JSON.parse(latestRevision.revisionData)
      : latestRevision.revisionData;

    const availableRanks = await availableRanksRepo.findAll();
    const availableRanksMapById = new Map<string, any>();
    for (const ar of availableRanks) {
      availableRanksMapById.set(String(ar.id), ar);
      if (ar.rankId) {
        availableRanksMapById.set(ar.rankId, ar);
      }
    }

    const companyRanks = await companyRanksRepo.findAll();
    const companyRanksMapById = new Map(companyRanks.map((cr: any) => [cr.id, cr]));

    const mergedRankData = rankData.map((vesselRank: any) => {
      const companyRank: any = companyRanksMapById.get(vesselRank.id);
      const availableRank: any = availableRanksMapById.get(String(vesselRank.id)) ||
        availableRanksMapById.get(vesselRank.rankId);

      let effectiveSortOrder = vesselRank.sortOrder ?? 0;
      if (vesselRank.isRoleRow && vesselRank.originalRankId) {
        const parentAvailableRank: any = availableRanksMapById.get(String(vesselRank.originalRankId));
        effectiveSortOrder = parentAvailableRank?.sortOrder ?? vesselRank.sortOrder ?? 0;
      } else if (availableRank) {
        effectiveSortOrder = availableRank.sortOrder ?? vesselRank.sortOrder ?? 0;
      }

      if (companyRank || availableRank) {
        return {
          ...vesselRank,
          sortOrder: effectiveSortOrder,
          officer: companyRank?.officer ?? vesselRank.officer ?? false,
          rating: companyRank?.rating ?? vesselRank.rating ?? false,
          seniorOfficer: companyRank?.seniorOfficer ?? vesselRank.seniorOfficer ?? false,
          deckOfficer: companyRank?.deckOfficer ?? vesselRank.deckOfficer ?? false,
          engOfficer: companyRank?.engOfficer ?? vesselRank.engOfficer ?? false,
          pettyOfficer: companyRank?.pettyOfficer ?? vesselRank.pettyOfficer ?? false,
          deckRating: companyRank?.deckRating ?? vesselRank.deckRating ?? false,
          engineRating: companyRank?.engineRating ?? vesselRank.engineRating ?? false,
          generalRating: companyRank?.generalRating ?? vesselRank.generalRating ?? false,
          cateringRating: companyRank?.cateringRating ?? vesselRank.cateringRating ?? false,
          safetyOfficer: vesselRank.safetyOfficer ?? companyRank?.safetyOfficer ?? false,
          sso: vesselRank.sso ?? companyRank?.sso ?? false,
          medicalOfficer: vesselRank.medicalOfficer ?? companyRank?.medicalOfficer ?? false,
          navigatingOfficer: vesselRank.navigatingOfficer ?? companyRank?.navigatingOfficer ?? false,
          emtOfficer: vesselRank.emtOfficer ?? companyRank?.emtOfficer ?? false,
        };
      }
      return { ...vesselRank, sortOrder: effectiveSortOrder };
    });

    const activeRanks = mergedRankData.filter((rank: any) => rank.actualManningFlag);

    const sortedRanks = activeRanks.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));

    const rankSlotCounts = new Map<string, number>();
    sortedRanks.forEach((rank: any) => {
      const baseRank = rank.rank;
      rankSlotCounts.set(baseRank, (rankSlotCounts.get(baseRank) || 0) + 1);
    });

    const ranksWithDisplayRole = sortedRanks
      .filter((rank: any) => {
        const baseRank = rank.rank;
        const slotCount = rankSlotCounts.get(baseRank) || 1;
        if (slotCount > 1 && !rank.role) {
          return false;
        }
        return true;
      })
      .map((rank: any) => {
        const displayRole = rank.role || rank.rank;
        return { ...rank, displayRole };
      });

    return ranksWithDisplayRole;
  },

  async syncVesselPlanningV2(vesselUuid: string, revisionData: string | any): Promise<number> {
    console.log(`[VESSEL PLANNING V2 SYNC] Starting sync for vessel: ${vesselUuid}`);

    const db = getDb();
    const parsedData = typeof revisionData === 'string' ? JSON.parse(revisionData) : revisionData;
    const ranks = Array.isArray(parsedData) ? parsedData : [];

    console.log(`[VESSEL PLANNING V2 SYNC] Found ${ranks.length} rank(s) in revision data`);

    const allAvailableRanks = await availableRanksRepo.findAll();
    const rankIdMap = new Map<string, { rankId: string; label: string }>();
    for (const ar of allAvailableRanks) {
      if (ar.rankId && ar.label) {
        rankIdMap.set(String(ar.id), { rankId: ar.rankId, label: ar.label });
        rankIdMap.set(`S${ar.id}`, { rankId: ar.rankId, label: ar.label });
        rankIdMap.set(ar.rankId, { rankId: ar.rankId, label: ar.label });
        if (ar.name) {
          rankIdMap.set(ar.name.toLowerCase(), { rankId: ar.rankId, label: ar.label });
        }
      }
    }

    // 1. Fetch existing planning records
    const existingPlanning = await vesselPlanningRepo.findByVesselUuid(vesselUuid);

    // Group existing planning records by normalized rank string (e.g. "ab_1", "ab_2", "master")
    const existingByRankMap = new Map<string, any[]>();
    for (const p of existingPlanning) {
      const key = (p.rank || "").toLowerCase().trim();
      if (!existingByRankMap.has(key)) existingByRankMap.set(key, []);
      existingByRankMap.get(key)!.push(p);
    }

    // 2. Clean up duplicate vacant position rows for the same rank/role
    for (const [rankKey, records] of existingByRankMap.entries()) {
      if (records.length > 1) {
        // Separate assigned records from vacant records
        const vacantRecords = records.filter((p: any) => !p.crewUuid && !p.relieverCrewUuid);
        const assignedCount = records.length - vacantRecords.length;
        const keepVacantCount = assignedCount > 0 ? 0 : 1;
        for (let i = keepVacantCount; i < vacantRecords.length; i++) {
          const dupVacant = vacantRecords[i];
          await db
            .update(vesselPlanningV2)
            .set({ isDeleted: true, updatedAt: new Date() })
            .where(eq(vesselPlanningV2.planUuid, dupVacant.planUuid));
          console.log(`[VESSEL PLANNING V2 SYNC] Removed duplicate vacant planning row for ${dupVacant.rank} (${dupVacant.planUuid})`);
        }
      }
    }

    // Filter active ranks from revision (actualManningFlag === true)
    const activeRanks = ranks.filter((r: any) => r.actualManningFlag === true);

    let createdCount = 0;
    const processedRolesInThisSync = new Set<string>();

    for (const rankObj of activeRanks) {
      const displayRole = (rankObj.role || rankObj.rank || "").trim();
      if (!displayRole) continue;

      const roleKey = displayRole.toLowerCase();
      if (processedRolesInThisSync.has(roleKey)) {
        continue;
      }
      processedRolesInThisSync.add(roleKey);

      // Check if active position slot already exists for this displayRole
      const existingSlots = existingByRankMap.get(roleKey) || [];
      const activeExisting = existingSlots.filter((p: any) => !p.isDeleted);

      if (activeExisting.length > 0) {
        continue;
      }

      // Resolve rankId
      const baseRankName = (rankObj.rank || displayRole).split("_")[0].toLowerCase();
      const rawRankId = rankObj.rankId || rankObj.id;
      const mapped = rankIdMap.get(String(rawRankId)) || rankIdMap.get(baseRankName);
      const targetRankId = mapped?.rankId || "R000";

      try {
        await vesselPlanningRepo.create({
          vesselUuid: vesselUuid,
          rankId: targetRankId,
          rank: displayRole,
          crewStatus: "primary",
          isArchived: false,
          isDeleted: false,
        });
        createdCount++;
        console.log(`[VESSEL PLANNING V2 SYNC] Created planning record for: ${displayRole} (${targetRankId})`);
      } catch (createError) {
        console.warn(`[VESSEL PLANNING V2 SYNC] Failed to create planning for ${displayRole}:`, createError);
      }
    }

    console.log(`[VESSEL PLANNING V2 SYNC] Completed: created ${createdCount} new planning record(s) for vessel ${vesselUuid}`);
    return createdCount;
  },
};
