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

    const ranksWithDisplayRole = sortedRanks.map((rank: any) => {
      const baseRank = rank.rank;
      const slotCount = rankSlotCounts.get(baseRank) || 1;
      let displayRole: string;
      if (slotCount === 1) {
        displayRole = baseRank;
      } else {
        displayRole = rank.role || baseRank;
      }
      return { ...rank, displayRole };
    });

    return ranksWithDisplayRole;
  },

  async syncVesselPlanningV2(vesselUuid: string, revisionData: string | any): Promise<number> {
    console.log(`[VESSEL PLANNING V2 SYNC] Starting sync for vessel: ${vesselUuid}`);

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

    console.log(`[VESSEL PLANNING V2 SYNC] Built rank mapping with ${rankIdMap.size} entries from ${allAvailableRanks.length} available ranks`);

    const existingPlanning = await vesselPlanningRepo.findByVesselUuid(vesselUuid);
    const existingRankIds = new Set(existingPlanning.map((p: any) => p.rankId));

    console.log(`[VESSEL PLANNING V2 SYNC] Found ${existingPlanning.length} existing planning record(s), ${existingRankIds.size} unique rank IDs: [${Array.from(existingRankIds).join(', ')}]`);

    let createdCount = 0;
    for (const rank of ranks) {
      const rawRankId = rank.rankId || rank.id;
      const rankName = rank.rank || rank.role;

      if (!rawRankId || rank.isRoleRow || !rank.actualManningFlag) {
        continue;
      }

      const mapped = rankIdMap.get(String(rawRankId)) || rankIdMap.get(rankName?.toLowerCase());

      if (!mapped) {
        console.warn(`[VESSEL PLANNING V2 SYNC] Could not map rankId "${rawRankId}" (rank: "${rankName}") to R-format, skipping`);
        continue;
      }

      if (existingRankIds.has(mapped.rankId)) {
        console.log(`[VESSEL PLANNING V2 SYNC] Skipping existing rank: ${mapped.label} (${mapped.rankId})`);
        continue;
      }

      try {
        await vesselPlanningRepo.create({
          vesselUuid: vesselUuid,
          rankId: mapped.rankId,
          rank: mapped.label,
          crewStatus: "primary",
          isArchived: false,
          isDeleted: false,
        });
        createdCount++;
        existingRankIds.add(mapped.rankId);
        console.log(`[VESSEL PLANNING V2 SYNC] Created planning record for: ${mapped.label} (${mapped.rankId})`);
      } catch (createError) {
        console.warn(`[VESSEL PLANNING V2 SYNC] Failed to create planning for ${mapped.rankId}:`, createError);
      }
    }

    console.log(`[VESSEL PLANNING V2 SYNC] Completed: created ${createdCount} new planning record(s) for vessel ${vesselUuid}`);
    return createdCount;
  },
};
