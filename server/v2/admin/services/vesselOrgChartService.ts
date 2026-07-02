import { VesselOrgChartRepository } from "../repositories/vesselOrgChartRepository";
import { applyAuditUser } from "../utils/auditUser";
import type { AdmVesselOrgChartV2, InsertAdmVesselOrgChartV2 } from "../../../../shared/v2/admin/types";

const vesselOrgChartRepo = new VesselOrgChartRepository();

export interface RankScopeResult {
  rank: string;
  rankId: string;
  isRestricted: boolean;
  allowedRanks: string[];
  allowedRankIds: string[];
}

export const vesselOrgChartService = {
  async getAll(): Promise<AdmVesselOrgChartV2[]> {
    return vesselOrgChartRepo.findAll();
  },

  async saveAll(entries: (InsertAdmVesselOrgChartV2 & { auditUserUuid?: string | null })[]): Promise<AdmVesselOrgChartV2[]> {
    return vesselOrgChartRepo.saveAll(entries.map(entry => applyAuditUser(entry, true)));
  },

  /**
   * Resolves the set of ranks "at or under" the given rank in the Vessel Org
   * Chart hierarchy. Used to scope data (e.g. appraisals, promotions, vessel
   * crew) to what a rank is allowed to see: a rank sees itself plus every
   * rank reporting to it, transitively.
   *
   * `identifier` may be either a rank name (e.g. "Chief Officer", matching
   * `sessionStorage.crewDesignation`) or a rank_id (e.g. "R002").
   *
   * If the identifier has no match in the org chart (e.g. office/shore
   * staff, or a rank that hasn't been added to the chart), `isRestricted`
   * is false and callers should treat this as "unrestricted" / no-op.
   */
  async getRankScope(identifier: string): Promise<RankScopeResult> {
    const descendants = await vesselOrgChartRepo.findDescendantRanks(identifier);

    if (descendants.length === 0) {
      return {
        rank: identifier,
        rankId: identifier,
        isRestricted: false,
        allowedRanks: [],
        allowedRankIds: [],
      };
    }

    const [root] = descendants;
    return {
      rank: root.rank,
      rankId: root.rankId,
      isRestricted: true,
      allowedRanks: descendants.map((n) => n.rank),
      allowedRankIds: descendants.map((n) => n.rankId),
    };
  },
};
