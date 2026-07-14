import { eq, and, inArray, isNotNull } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db";
import {
  accEngagementsV2,
  accWageScalesV2,
  accEngagementPayElementsV2,
  accWageLedgerV2,
  accSettlementsV2,
} from "../../../../shared/v2/accounts/schema";
import { crewAssignments, crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import { admCompanyRanksV2 } from "../../../../shared/v2/admin/schema";
import { masterVessels } from "../../../../shared/schema";
import type {
  AccEngagementV2,
  InsertAccEngagementV2,
  AccWageScaleV2,
  AccEngagementPayElementV2,
} from "../../../../shared/v2/accounts/types";

export type CrewAssignmentRow = typeof crewAssignments.$inferSelect;

export class EngagementsRepository {
  async findByUuid(engagementUuid: string): Promise<AccEngagementV2 | undefined> {
    const db = getDb();
    const rows = await db
      .select()
      .from(accEngagementsV2)
      .where(
        and(
          eq(accEngagementsV2.engagementUuid, engagementUuid),
          eq(accEngagementsV2.isDeleted, false),
        ),
      );
    return rows[0];
  }

  async findByAssignmentUuids(
    assignmentUuids: string[],
  ): Promise<AccEngagementV2[]> {
    if (assignmentUuids.length === 0) return [];
    const db = getDb();
    return db
      .select()
      .from(accEngagementsV2)
      .where(
        and(
          inArray(accEngagementsV2.assignmentUuid, assignmentUuids),
          eq(accEngagementsV2.isDeleted, false),
        ),
      );
  }

  async create(
    data: Omit<InsertAccEngagementV2, "engagementUuid">,
  ): Promise<AccEngagementV2> {
    const db = getDb();
    const rows = await db
      .insert(accEngagementsV2)
      .values({ ...data, engagementUuid: uuidv4() })
      .returning();
    return rows[0];
  }

  async update(
    engagementUuid: string,
    data: Partial<InsertAccEngagementV2>,
  ): Promise<AccEngagementV2 | undefined> {
    const db = getDb();
    const rows = await db
      .update(accEngagementsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(accEngagementsV2.engagementUuid, engagementUuid),
          eq(accEngagementsV2.isDeleted, false),
        ),
      )
      .returning();
    return rows[0];
  }

  async findByUuids(engagementUuids: string[]): Promise<AccEngagementV2[]> {
    if (engagementUuids.length === 0) return [];
    const db = getDb();
    return db
      .select()
      .from(accEngagementsV2)
      .where(
        and(
          inArray(accEngagementsV2.engagementUuid, engagementUuids),
          eq(accEngagementsV2.isDeleted, false),
        ),
      );
  }

  /** All live engagements of the given crew (any vessel, any status). */
  async findByCrewUuids(crewUuids: string[]): Promise<AccEngagementV2[]> {
    if (crewUuids.length === 0) return [];
    const db = getDb();
    return db
      .select()
      .from(accEngagementsV2)
      .where(
        and(
          inArray(accEngagementsV2.crewUuid, crewUuids),
          eq(accEngagementsV2.isDeleted, false),
        ),
      );
  }

  /** All live engagements in an overlap-relevant status (audit universe). */
  async findOverlapCandidates(): Promise<AccEngagementV2[]> {
    const db = getDb();
    return db
      .select()
      .from(accEngagementsV2)
      .where(
        and(
          inArray(accEngagementsV2.status, ["draft", "active", "completed"]),
          eq(accEngagementsV2.isDeleted, false),
        ),
      );
  }

  /** vessel_uuid -> vessel name (for audit display). */
  async findVesselNames(vesselUuids: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (vesselUuids.length === 0) return map;
    const db = getDb();
    const rows = await db
      .select({
        vesselUuid: masterVessels.vesselUuid,
        vessel: masterVessels.vessel,
      })
      .from(masterVessels)
      .where(inArray(masterVessels.vesselUuid, vesselUuids));
    for (const r of rows) {
      if (r.vesselUuid) map.set(r.vesselUuid, r.vessel ?? r.vesselUuid);
    }
    return map;
  }

  /** Live assignment-derived engagements of one vessel (any status). */
  async findAssignmentDerivedByVessel(
    vesselUuid: string,
  ): Promise<AccEngagementV2[]> {
    const db = getDb();
    return db
      .select()
      .from(accEngagementsV2)
      .where(
        and(
          eq(accEngagementsV2.vesselUuid, vesselUuid),
          isNotNull(accEngagementsV2.assignmentUuid),
          eq(accEngagementsV2.isDeleted, false),
        ),
      );
  }

  /** engagement_uuid -> count of live ledger lines (wage history). */
  async countLedgerLinesByEngagements(
    engagementUuids: string[],
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (engagementUuids.length === 0) return map;
    const db = getDb();
    const rows = await db
      .select({ engagementUuid: accWageLedgerV2.engagementUuid })
      .from(accWageLedgerV2)
      .where(
        and(
          inArray(accWageLedgerV2.engagementUuid, engagementUuids),
          eq(accWageLedgerV2.isDeleted, false),
        ),
      );
    for (const r of rows as Array<{ engagementUuid: string }>) {
      map.set(r.engagementUuid, (map.get(r.engagementUuid) ?? 0) + 1);
    }
    return map;
  }

  /** Engagements frozen by a settlement in submitted or later status. */
  async findFrozenSettlementEngagements(
    engagementUuids: string[],
  ): Promise<Set<string>> {
    const set = new Set<string>();
    if (engagementUuids.length === 0) return set;
    const db = getDb();
    const rows = await db
      .select({ engagementUuid: accSettlementsV2.engagementUuid })
      .from(accSettlementsV2)
      .where(
        and(
          inArray(accSettlementsV2.engagementUuid, engagementUuids),
          inArray(accSettlementsV2.status, [
            "submitted",
            "approved",
            "paid",
            "locked",
          ]),
          eq(accSettlementsV2.isDeleted, false),
        ),
      );
    for (const r of rows as Array<{ engagementUuid: string }>) {
      set.add(r.engagementUuid);
    }
    return set;
  }

  // ---- Sync inputs -------------------------------------------------------

  async findAssignmentsForVessel(
    vesselUuid: string,
  ): Promise<CrewAssignmentRow[]> {
    const db = getDb();
    return db
      .select()
      .from(crewAssignments)
      .where(
        and(
          eq(crewAssignments.vesselUuid, vesselUuid),
          eq(crewAssignments.isDeleted, false),
        ),
      );
  }

  /** crew_uuid -> present_rank for the given crew. */
  async findCrewRanks(crewUuids: string[]): Promise<Map<string, string | null>> {
    const map = new Map<string, string | null>();
    if (crewUuids.length === 0) return map;
    const db = getDb();
    const rows = await db
      .select({
        crewUuid: crewMembersV2.crewUuid,
        presentRank: crewMembersV2.presentRank,
      })
      .from(crewMembersV2)
      .where(inArray(crewMembersV2.crewUuid, crewUuids));
    for (const r of rows) map.set(r.crewUuid, r.presentRank ?? null);
    return map;
  }

  /** All live company ranks (rank name + rank code) for rank normalization. */
  async findCompanyRanks(): Promise<Array<{ rank: string; rankId: string }>> {
    const db = getDb();
    return db
      .select({
        rank: admCompanyRanksV2.rank,
        rankId: admCompanyRanksV2.rankId,
      })
      .from(admCompanyRanksV2)
      .where(eq(admCompanyRanksV2.isDeleted, false));
  }

  async findVesselType(vesselUuid: string): Promise<string | null> {
    const db = getDb();
    const rows = await db
      .select({ vesselType: masterVessels.vesselType })
      .from(masterVessels)
      .where(eq(masterVessels.vesselUuid, vesselUuid));
    return rows[0]?.vesselType ?? null;
  }

  async findActiveScales(): Promise<AccWageScaleV2[]> {
    const db = getDb();
    return db
      .select()
      .from(accWageScalesV2)
      .where(
        and(
          eq(accWageScalesV2.status, "active"),
          eq(accWageScalesV2.isDeleted, false),
        ),
      );
  }

  // ---- Review screen inputs ---------------------------------------------

  /** crew_uuid -> display name + present rank. */
  async findCrewInfo(
    crewUuids: string[],
  ): Promise<Map<string, { name: string; presentRank: string | null }>> {
    const map = new Map<string, { name: string; presentRank: string | null }>();
    if (crewUuids.length === 0) return map;
    const db = getDb();
    const rows = await db
      .select({
        crewUuid: crewMembersV2.crewUuid,
        firstName: crewMembersV2.firstName,
        middleName: crewMembersV2.middleName,
        familyName: crewMembersV2.familyName,
        presentRank: crewMembersV2.presentRank,
      })
      .from(crewMembersV2)
      .where(inArray(crewMembersV2.crewUuid, crewUuids));
    for (const r of rows) {
      const name = [r.firstName, r.middleName, r.familyName]
        .filter(Boolean)
        .join(" ");
      map.set(r.crewUuid, { name, presentRank: r.presentRank ?? null });
    }
    return map;
  }

  /** scale_uuid -> scale_name. */
  async findScaleNames(scaleUuids: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (scaleUuids.length === 0) return map;
    const db = getDb();
    const rows = await db
      .select({
        scaleUuid: accWageScalesV2.scaleUuid,
        scaleName: accWageScalesV2.scaleName,
      })
      .from(accWageScalesV2)
      .where(inArray(accWageScalesV2.scaleUuid, scaleUuids));
    for (const r of rows) map.set(r.scaleUuid, r.scaleName);
    return map;
  }

  // ---- Payment-timing override rows (engagement flags) -------------------

  /** Live timing-override rows for the given engagements. */
  async findTimingOverrides(
    engagementUuids: string[],
  ): Promise<AccEngagementPayElementV2[]> {
    if (engagementUuids.length === 0) return [];
    const db = getDb();
    return db
      .select()
      .from(accEngagementPayElementsV2)
      .where(
        and(
          inArray(accEngagementPayElementsV2.engagementUuid, engagementUuids),
          isNotNull(accEngagementPayElementsV2.paymentTimingOverride),
          eq(accEngagementPayElementsV2.isDeleted, false),
        ),
      );
  }

  /** The timing-only override row (amount/rate NULL) for one element, if any. */
  async findTimingOnlyRow(
    engagementUuid: string,
    payElementUuid: string,
  ): Promise<AccEngagementPayElementV2 | undefined> {
    const db = getDb();
    const rows = await db
      .select()
      .from(accEngagementPayElementsV2)
      .where(
        and(
          eq(accEngagementPayElementsV2.engagementUuid, engagementUuid),
          eq(accEngagementPayElementsV2.payElementUuid, payElementUuid),
          isNotNull(accEngagementPayElementsV2.paymentTimingOverride),
          eq(accEngagementPayElementsV2.isDeleted, false),
        ),
      );
    return rows.find(
      (r: AccEngagementPayElementV2) => r.amount == null && r.rate == null,
    );
  }

  async createTimingOverride(data: {
    engagementUuid: string;
    payElementUuid: string;
    paymentTimingOverride: string;
    createdByUuid?: string | null;
  }): Promise<AccEngagementPayElementV2> {
    const db = getDb();
    const rows = await db
      .insert(accEngagementPayElementsV2)
      .values({
        epeUuid: uuidv4(),
        engagementUuid: data.engagementUuid,
        payElementUuid: data.payElementUuid,
        overrideMode: "replace_scale_value",
        amount: null,
        rate: null,
        paymentTimingOverride: data.paymentTimingOverride,
        createdByUuid: data.createdByUuid ?? null,
      })
      .returning();
    return rows[0];
  }

  async updateTimingOverride(
    epeUuid: string,
    data: { paymentTimingOverride?: string; isDeleted?: boolean; updatedByUuid?: string | null },
  ): Promise<AccEngagementPayElementV2 | undefined> {
    const db = getDb();
    const rows = await db
      .update(accEngagementPayElementsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(accEngagementPayElementsV2.epeUuid, epeUuid))
      .returning();
    return rows[0];
  }
}
