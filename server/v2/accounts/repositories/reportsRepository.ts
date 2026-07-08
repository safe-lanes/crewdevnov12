import { inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { accPayElementsV2 } from "../../../../shared/v2/accounts/schema";
import { crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";

export interface ReportElementInfo {
  code: string;
  name: string;
  type: string;
  category: string;
  glCode: string | null;
}

export interface ReportCrewInfo {
  name: string;
  presentRank: string | null;
  nationalityUuid: string | null;
}

/** Read-only lookups for the Reports layer (display enrichment only). */
export class ReportsRepository {
  /**
   * pay_element_uuid -> report display info, without a status filter —
   * ledger lines may reference elements deactivated since posting.
   */
  async findElementsByUuids(
    payElementUuids: string[],
  ): Promise<Map<string, ReportElementInfo>> {
    const map = new Map<string, ReportElementInfo>();
    if (payElementUuids.length === 0) return map;
    const db = getDb();
    const rows = await db
      .select({
        payElementUuid: accPayElementsV2.payElementUuid,
        code: accPayElementsV2.code,
        name: accPayElementsV2.name,
        type: accPayElementsV2.type,
        category: accPayElementsV2.category,
        glCode: accPayElementsV2.glCode,
      })
      .from(accPayElementsV2)
      .where(inArray(accPayElementsV2.payElementUuid, payElementUuids));
    for (const r of rows) {
      map.set(r.payElementUuid, {
        code: r.code,
        name: r.name,
        type: r.type,
        category: r.category,
        glCode: r.glCode ?? null,
      });
    }
    return map;
  }

  /** crew_uuid -> display name, present rank, nationality. */
  async findCrewDetails(
    crewUuids: string[],
  ): Promise<Map<string, ReportCrewInfo>> {
    const map = new Map<string, ReportCrewInfo>();
    if (crewUuids.length === 0) return map;
    const db = getDb();
    const rows = await db
      .select({
        crewUuid: crewMembersV2.crewUuid,
        firstName: crewMembersV2.firstName,
        middleName: crewMembersV2.middleName,
        familyName: crewMembersV2.familyName,
        presentRank: crewMembersV2.presentRank,
        nationalityUuid: crewMembersV2.nationalityUuid,
      })
      .from(crewMembersV2)
      .where(inArray(crewMembersV2.crewUuid, crewUuids));
    for (const r of rows) {
      const name = [r.firstName, r.middleName, r.familyName]
        .filter(Boolean)
        .join(" ");
      map.set(r.crewUuid, {
        name: name || r.crewUuid,
        presentRank: r.presentRank ?? null,
        nationalityUuid: r.nationalityUuid ?? null,
      });
    }
    return map;
  }
}
