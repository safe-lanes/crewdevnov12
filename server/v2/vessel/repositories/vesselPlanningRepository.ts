import { eq, and, desc, isNull, sql, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "../../db";
import { vesselPlanningV2, vesselPlanningAttachmentsV2 } from "../../../../shared/v2/vessel/schema";
import { crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import { masterPorts, masterNationalities } from "../../../../shared/schema";
import { admCompanyRanksV2 } from "../../../../shared/v2/admin/schema";
import type { VesselPlanningV2, InsertVesselPlanningV2, VesselPlanningAttachmentsV2, InsertVesselPlanningAttachmentsV2 } from "../../../../shared/v2/vessel/schema";
import { v4 as uuidv4 } from "uuid";

function getRankSortIndex(rankStr: string, rankOrderMap: Map<string, number>): number {
  const normRank = (rankStr || "").toLowerCase().trim();
  const baseRank = normRank.split("_")[0];

  const aliases: Record<string, string[]> = {
    "master": ["master", "capt", "captain"],
    "chief officer": ["chief officer", "co", "c/o", "chief off"],
    "2nd officer": ["2nd officer", "2nd off", "2o", "2/o"],
    "3rd officer": ["3rd officer", "3rd off", "3o", "3/o"],
    "chief engineer": ["chief engineer", "ce", "c/e", "chief eng"],
    "2nd engineer": ["2nd engineer", "2nd eng", "2e", "2/e"],
    "3rd engineer": ["3rd engineer", "3rd eng", "3e", "3/e"],
    "4th engineer": ["4th engineer", "4th eng", "4e", "4/e"],
    "electro-technical officer": ["electro-technical officer", "eto"],
    "bosun": ["bosun", "bsn", "boatswain"],
    "able seaman": ["able seaman", "ab", "abs"],
    "ordinary seaman": ["ordinary seaman", "os"],
    "pumpman": ["pumpman", "pnm"],
    "oiler": ["oiler", "olr"],
    "wiper": ["wiper", "wpr"],
    "chief cook": ["chief cook", "cook", "ck"],
    "messman": ["messman", "msm"],
  };

  if (rankOrderMap.has(normRank)) return rankOrderMap.get(normRank)!;
  if (rankOrderMap.has(baseRank)) return rankOrderMap.get(baseRank)!;

  for (const [dbRankName, aliasList] of Object.entries(aliases)) {
    if (aliasList.includes(normRank) || aliasList.includes(baseRank)) {
      if (rankOrderMap.has(dbRankName)) {
        return rankOrderMap.get(dbRankName)!;
      }
    }
  }

  return 999;
}

export class VesselPlanningRepository {
  /**
   * Find all non-archived planning records for conflict detection
   * Returns minimal fields needed to check crew assignment overlaps
   */
  async findAllForConflictDetection(): Promise<any[]> {
    const db = getDb();
    
    const results = await db
      .select({
        crewMemberId: vesselPlanningV2.crewUuid,
        relieverCrewId: vesselPlanningV2.relieverCrewUuid,
        vesselUuid: vesselPlanningV2.vesselUuid,
        signOnDate: vesselPlanningV2.signOnDate,
        reliefDue: vesselPlanningV2.reliefDue,
        relieverSignOnDate: vesselPlanningV2.relieverSignOnDate,
        contractPeriodMonths: vesselPlanningV2.contractPeriodMonths,
        joiningStatus: vesselPlanningV2.joiningStatus,
      })
      .from(vesselPlanningV2)
      .where(
        and(
          eq(vesselPlanningV2.isDeleted, false),
          eq(vesselPlanningV2.isArchived, false)
        )
      );

    return results;
  }

  /**
   * Batch variant of findByVesselUuid — returns planning records for multiple
   * vessels in ONE query. Result is a flat array; callers group by vesselUuid.
   *
   * Intentionally lightweight: no attachment-count join, no dedup cleanup,
   * no sorting — only the columns needed for import slot matching.
   * The existing findByVesselUuid (singular) and all its callers are untouched.
   */
  async findByVesselUuidBatch(vesselUuids: string[]): Promise<any[]> {
    if (vesselUuids.length === 0) return [];
    const db = getDb();
    return db
      .select()
      .from(vesselPlanningV2)
      .where(
        and(
          inArray(vesselPlanningV2.vesselUuid, vesselUuids),
          eq(vesselPlanningV2.isDeleted, false),
        ),
      );
  }

  async findByVesselUuid(vesselUuid: string): Promise<any[]> {
    const db = getDb();
    const relieverCrew = alias(crewMembersV2, "reliever_crew");
    const signOffPort = alias(masterPorts, "sign_off_port");
    const joiningPort = alias(masterPorts, "joining_port");
    const crewNationality = alias(masterNationalities, "crew_nationality");
    const relieverNationalityTable = alias(masterNationalities, "reliever_nationality");
    
    const results = await db
      .select({
        planning: vesselPlanningV2,
        crewFirstName: crewMembersV2.firstName,
        crewFamilyName: crewMembersV2.familyName,
        crewEmpNo: crewMembersV2.empNo,
        crewNationalityName: crewNationality.nationality,
        relieverFirstName: relieverCrew.firstName,
        relieverFamilyName: relieverCrew.familyName,
        relieverNationalityName: relieverNationalityTable.nationality,
        signOffPortName: signOffPort.name,
        joiningPortName: joiningPort.name,
      })
      .from(vesselPlanningV2)
      .leftJoin(crewMembersV2, eq(vesselPlanningV2.crewUuid, crewMembersV2.crewUuid))
      .leftJoin(relieverCrew, eq(vesselPlanningV2.relieverCrewUuid, relieverCrew.crewUuid))
      .leftJoin(signOffPort, eq(vesselPlanningV2.signOffPortUuid, signOffPort.portUuid))
      .leftJoin(joiningPort, eq(vesselPlanningV2.joiningPortUuid, joiningPort.portUuid))
      .leftJoin(crewNationality, eq(crewMembersV2.nationalityUuid, crewNationality.natUuid))
      .leftJoin(relieverNationalityTable, eq(relieverCrew.nationalityUuid, relieverNationalityTable.natUuid))
      .where(
        and(
          eq(vesselPlanningV2.vesselUuid, vesselUuid),
          eq(vesselPlanningV2.isDeleted, false)
        )
      );

    // Auto-purge duplicate vacant position rows for the same vessel & rank
    const vacantRankMap = new Map<string, string[]>();
    results.forEach((row: any) => {
      const p = row.planning;
      if (!p.crewUuid && !p.relieverCrewUuid && !p.isDeleted) {
        const key = (p.rank || "").toLowerCase().trim();
        if (!vacantRankMap.has(key)) vacantRankMap.set(key, []);
        vacantRankMap.get(key)!.push(p.planUuid);
      }
    });

    const dupPlanUuidsToDelete: string[] = [];
    for (const [key, planUuids] of vacantRankMap.entries()) {
      if (planUuids.length > 1) {
        dupPlanUuidsToDelete.push(...planUuids.slice(1));
      }
    }

    if (dupPlanUuidsToDelete.length > 0) {
      await db
        .update(vesselPlanningV2)
        .set({ isDeleted: true, updatedAt: new Date() })
        .where(inArray(vesselPlanningV2.planUuid, dupPlanUuidsToDelete));
    }

    // Filter out deleted rows
    const validResults = results.filter((row: any) => !dupPlanUuidsToDelete.includes(row.planning.planUuid));

    const planUuids = validResults.map((row: any) => row.planning.planUuid).filter(Boolean);
    
    let countMap = new Map<string, number>();
    
    if (planUuids.length > 0) {
      const attachmentCounts = await db
        .select({
          planUuid: vesselPlanningAttachmentsV2.planUuid,
          count: sql<number>`count(*)::int`.as('count'),
        })
        .from(vesselPlanningAttachmentsV2)
        .where(
          and(
            inArray(vesselPlanningAttachmentsV2.planUuid, planUuids),
            eq(vesselPlanningAttachmentsV2.isDeleted, false)
          )
        )
        .groupBy(vesselPlanningAttachmentsV2.planUuid);
      
      countMap = new Map(attachmentCounts.map((ac: { planUuid: string; count: number }) => [ac.planUuid, ac.count]));
    }

    // Load company ranks to establish rank hierarchy sorting order
    const companyRanks = await db.select().from(admCompanyRanksV2).where(eq(admCompanyRanksV2.isDeleted, false));
    const rankOrderMap = new Map<string, number>();
    companyRanks.forEach((cr: any, idx: number) => {
      const rName = (cr.rank || "").toLowerCase().trim();
      if (rName && !rankOrderMap.has(rName)) {
        rankOrderMap.set(rName, idx);
      }
    });

    const mapped = validResults.map((row: any) => ({
      ...row.planning,
      crewMemberName: [row.crewFirstName, row.crewFamilyName].filter(Boolean).join(' ') || null,
      crewEmpNo: row.crewEmpNo,
      nationality: row.crewNationalityName || null,
      relieverCrewName: [row.relieverFirstName, row.relieverFamilyName].filter(Boolean).join(' ') || null,
      relieverNationality: row.relieverNationalityName || null,
      signOffPortName: row.signOffPortName || null,
      joiningPortName: row.joiningPortName || null,
      handoverAttachmentCount: countMap.get(row.planning.planUuid) || 0,
    }));

    // Sort mapped records by company rank hierarchy order & role suffix
    mapped.sort((a: any, b: any) => {
      const rA = (a.rank || "").toLowerCase().trim();
      const rB = (b.rank || "").toLowerCase().trim();

      const orderA = getRankSortIndex(rA, rankOrderMap);
      const orderB = getRankSortIndex(rB, rankOrderMap);

      if (orderA !== orderB) return orderA - orderB;

      const numA = parseInt(rA.split("_")[1] || "0", 10);
      const numB = parseInt(rB.split("_")[1] || "0", 10);
      return numA - numB;
    });

    return mapped;
  }

  async findByPlanUuid(planUuid: string): Promise<any | undefined> {
    const db = getDb();
    const relieverCrew = alias(crewMembersV2, "reliever_crew");
    const signOffPort = alias(masterPorts, "sign_off_port");
    const joiningPort = alias(masterPorts, "joining_port");
    const crewNationality = alias(masterNationalities, "crew_nationality");
    const relieverNationalityTable = alias(masterNationalities, "reliever_nationality");

    const results = await db
      .select({
        planning: vesselPlanningV2,
        crewFirstName: crewMembersV2.firstName,
        crewFamilyName: crewMembersV2.familyName,
        crewEmpNo: crewMembersV2.empNo,
        crewNationalityName: crewNationality.nationality,
        relieverFirstName: relieverCrew.firstName,
        relieverFamilyName: relieverCrew.familyName,
        relieverNationalityName: relieverNationalityTable.nationality,
        signOffPortName: signOffPort.name,
        joiningPortName: joiningPort.name,
      })
      .from(vesselPlanningV2)
      .leftJoin(crewMembersV2, eq(vesselPlanningV2.crewUuid, crewMembersV2.crewUuid))
      .leftJoin(relieverCrew, eq(vesselPlanningV2.relieverCrewUuid, relieverCrew.crewUuid))
      .leftJoin(signOffPort, eq(vesselPlanningV2.signOffPortUuid, signOffPort.portUuid))
      .leftJoin(joiningPort, eq(vesselPlanningV2.joiningPortUuid, joiningPort.portUuid))
      .leftJoin(crewNationality, eq(crewMembersV2.nationalityUuid, crewNationality.natUuid))
      .leftJoin(relieverNationalityTable, eq(relieverCrew.nationalityUuid, relieverNationalityTable.natUuid))
      .where(
        and(
          eq(vesselPlanningV2.planUuid, planUuid),
          eq(vesselPlanningV2.isDeleted, false)
        )
      )
      .limit(1);

    if (results.length === 0) return undefined;

    const row = results[0];
    const attachmentCounts = await db
      .select({
        planUuid: vesselPlanningAttachmentsV2.planUuid,
        count: sql<number>`count(*)::int`.as('count'),
      })
      .from(vesselPlanningAttachmentsV2)
      .where(
        and(
          eq(vesselPlanningAttachmentsV2.planUuid, planUuid),
          eq(vesselPlanningAttachmentsV2.isDeleted, false)
        )
      )
      .groupBy(vesselPlanningAttachmentsV2.planUuid);

    const handoverAttachmentCount = attachmentCounts.length > 0 ? attachmentCounts[0].count : 0;

    return {
      ...row.planning,
      crewMemberName: [row.crewFirstName, row.crewFamilyName].filter(Boolean).join(' ') || null,
      crewEmpNo: row.crewEmpNo,
      nationality: row.crewNationalityName || null,
      relieverCrewName: [row.relieverFirstName, row.relieverFamilyName].filter(Boolean).join(' ') || null,
      relieverNationality: row.relieverNationalityName || null,
      signOffPortName: row.signOffPortName || null,
      joiningPortName: row.joiningPortName || null,
      handoverAttachmentCount,
    };
  }

  async findPrimaryByVesselAndRank(
    vesselUuid: string,
    rankName?: string,
    excludePlanUuid?: string
  ): Promise<any | undefined> {
    const db = getDb();
    const conditions = [
      eq(vesselPlanningV2.vesselUuid, vesselUuid),
      eq(vesselPlanningV2.isDeleted, false),
      eq(vesselPlanningV2.isArchived, false),
    ];
    if (rankName) {
      conditions.push(eq(vesselPlanningV2.rank, rankName));
    }
    const results = await db
      .select()
      .from(vesselPlanningV2)
      .where(and(...conditions));
    if (excludePlanUuid) {
      return results.find((r: any) => r.planUuid !== excludePlanUuid);
    }
    return results[0];
  }

  async findSecondaryByVesselAndRank(
    vesselUuid: string,
    crewUuid?: string | null,
    relieverCrewUuid?: string | null,
    excludePlanUuid?: string,
    rankName?: string
  ): Promise<any | undefined> {
    const db = getDb();
    const conditions = [
      eq(vesselPlanningV2.vesselUuid, vesselUuid),
      eq(vesselPlanningV2.isDeleted, false),
    ];
    if (rankName) {
      conditions.push(eq(vesselPlanningV2.rank, rankName));
    }
    const results = await db
      .select()
      .from(vesselPlanningV2)
      .where(and(...conditions));
    if (excludePlanUuid) {
      return results.find((r: any) => r.planUuid !== excludePlanUuid);
    }
    return results[0];
  }

  async findByVesselAndRankName(
    vesselUuid: string,
    rankName?: string,
    excludePlanUuid?: string
  ): Promise<any | undefined> {
    return this.findPrimaryByVesselAndRank(vesselUuid, rankName, excludePlanUuid);
  }

  async findByVesselAndRank(
    vesselUuid: string,
    rankName?: string,
    excludePlanUuid?: string
  ): Promise<any | undefined> {
    return this.findPrimaryByVesselAndRank(vesselUuid, rankName, excludePlanUuid);
  }

  async findExistingRecord(
    vesselUuid: string,
    crewUuid?: string | null,
    relieverCrewUuid?: string | null,
    excludePlanUuid?: string,
    rank?: string
  ): Promise<any | undefined> {
    const db = getDb();
    const conditions = [
      eq(vesselPlanningV2.vesselUuid, vesselUuid),
      eq(vesselPlanningV2.isDeleted, false),
      eq(vesselPlanningV2.isArchived, false),
    ];
    if (rank) {
      conditions.push(eq(vesselPlanningV2.rank, rank));
    }
    const results = await db
      .select()
      .from(vesselPlanningV2)
      .where(and(...conditions));
    if (excludePlanUuid) {
      return results.find((r: any) => r.planUuid !== excludePlanUuid);
    }
    return results[0];
  }

  async create(data: Omit<InsertVesselPlanningV2, "planUuid">): Promise<VesselPlanningV2> {
    const db = getDb();
    const results = await db
      .insert(vesselPlanningV2)
      .values({
        planUuid: uuidv4(),
        ...data,
      })
      .returning();
    return results[0];
  }

  async update(planUuid: string, data: Partial<InsertVesselPlanningV2>): Promise<VesselPlanningV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(vesselPlanningV2)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(vesselPlanningV2.planUuid, planUuid),
          eq(vesselPlanningV2.isDeleted, false)
        )
      )
      .returning();
    return results[0];
  }

  async archive(planUuid: string, auditUserUuid?: string): Promise<VesselPlanningV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(vesselPlanningV2)
      .set({
        isArchived: true,
        updatedAt: new Date(),
        ...(auditUserUuid ? { updatedByUuid: auditUserUuid } : {}),
      })
      .where(
        and(
          eq(vesselPlanningV2.planUuid, planUuid),
          eq(vesselPlanningV2.isDeleted, false)
        )
      )
      .returning();
    return results[0];
  }

  async unarchive(planUuid: string): Promise<VesselPlanningV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(vesselPlanningV2)
      .set({
        isArchived: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(vesselPlanningV2.planUuid, planUuid),
          eq(vesselPlanningV2.isDeleted, false)
        )
      )
      .returning();
    return results[0];
  }

  async delete(planUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(vesselPlanningV2)
      .set({
        isDeleted: true,
        updatedAt: new Date(),
      })
      .where(eq(vesselPlanningV2.planUuid, planUuid))
      .returning();
    return results.length > 0;
  }

  async getAttachments(planUuid: string): Promise<VesselPlanningAttachmentsV2[]> {
    const db = getDb();
    return db
      .select()
      .from(vesselPlanningAttachmentsV2)
      .where(
        and(
          eq(vesselPlanningAttachmentsV2.planUuid, planUuid),
          eq(vesselPlanningAttachmentsV2.isDeleted, false)
        )
      )
      .orderBy(desc(vesselPlanningAttachmentsV2.createdAt));
  }

  async addAttachment(data: Omit<InsertVesselPlanningAttachmentsV2, "attUuid">): Promise<VesselPlanningAttachmentsV2> {
    const db = getDb();
    const results = await db
      .insert(vesselPlanningAttachmentsV2)
      .values({
        attUuid: uuidv4(),
        ...data,
      })
      .returning();
    return results[0];
  }

  async getAttachmentByUuid(attUuid: string): Promise<VesselPlanningAttachmentsV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(vesselPlanningAttachmentsV2)
      .where(
        and(
          eq(vesselPlanningAttachmentsV2.attUuid, attUuid),
          eq(vesselPlanningAttachmentsV2.isDeleted, false)
        )
      )
      .limit(1);
    return results[0];
  }

  async deleteAttachment(attUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(vesselPlanningAttachmentsV2)
      .set({
        isDeleted: true,
        updatedAt: new Date(),
      })
      .where(eq(vesselPlanningAttachmentsV2.attUuid, attUuid))
      .returning();
    return results.length > 0;
  }
}

export class VesselPlanningAttachmentsRepository {
  async findByPlanUuid(planUuid: string): Promise<VesselPlanningAttachmentsV2[]> {
    const db = getDb();
    return db
      .select()
      .from(vesselPlanningAttachmentsV2)
      .where(
        and(
          eq(vesselPlanningAttachmentsV2.planUuid, planUuid),
          eq(vesselPlanningAttachmentsV2.isDeleted, false)
        )
      )
      .orderBy(desc(vesselPlanningAttachmentsV2.createdAt));
  }

  async create(data: Omit<InsertVesselPlanningAttachmentsV2, "attUuid"> & { attUuid?: string }): Promise<VesselPlanningAttachmentsV2> {
    const db = getDb();
    const results = await db
      .insert(vesselPlanningAttachmentsV2)
      .values({
        attUuid: data.attUuid || uuidv4(),
        ...data,
      })
      .returning();
    return results[0];
  }

  async findByUuid(attUuid: string): Promise<VesselPlanningAttachmentsV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(vesselPlanningAttachmentsV2)
      .where(
        and(
          eq(vesselPlanningAttachmentsV2.attUuid, attUuid),
          eq(vesselPlanningAttachmentsV2.isDeleted, false)
        )
      )
      .limit(1);
    return results[0];
  }

  async softDelete(attUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(vesselPlanningAttachmentsV2)
      .set({
        isDeleted: true,
        updatedAt: new Date(),
      })
      .where(eq(vesselPlanningAttachmentsV2.attUuid, attUuid))
      .returning();
    return results.length > 0;
  }
}

export const vesselPlanningRepository = new VesselPlanningRepository();
export const vesselPlanningAttachmentsRepository = new VesselPlanningAttachmentsRepository();
