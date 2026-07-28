import { eq, and, inArray, isNotNull, sql, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db";
import {
  accEngagementsV2,
  accWageScalesV2,
  accEngagementPayElementsV2,
  accWageLedgerV2,
  accSettlementsV2,
  accPortageBillsV2,
} from "../../../../shared/v2/accounts/schema";
import { crewAssignments, crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import { admCompanyRanksV2, admAvailableRanksV2 } from "../../../../shared/v2/admin/schema";
import { masterVessels, masterVesselTypes } from "../../../../shared/schema";
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

  /** rank_id -> canonical sort_order from the Admin available-ranks master. */
  async findRankSortOrders(): Promise<Map<string, number>> {
    const db = getDb();
    const rows = await db
      .select({
        rankId: admAvailableRanksV2.rankId,
        sortOrder: admAvailableRanksV2.sortOrder,
      })
      .from(admAvailableRanksV2)
      .where(eq(admAvailableRanksV2.isDeleted, false));
    const map = new Map<string, number>();
    for (const r of rows as Array<{ rankId: string | null; sortOrder: number | null }>) {
      if (r.rankId != null && !map.has(r.rankId)) {
        map.set(r.rankId, r.sortOrder ?? 0);
      }
    }
    return map;
  }

  async findVesselType(vesselUuid: string): Promise<string | null> {
    const db = getDb();
    const rows = await db
      .select({ vesselType: masterVessels.vesselType })
      .from(masterVessels)
      .where(eq(masterVessels.vesselUuid, vesselUuid));
    return rows[0]?.vesselType ?? null;
  }

  /** Live vessel-type master rows (vt_uuid + display name) for canonical resolution. */
  async findVesselTypeMaster(): Promise<
    Array<{ vtUuid: string | null; vesselType: string | null }>
  > {
    const db = getDb();
    return db
      .select({
        vtUuid: masterVesselTypes.vtUuid,
        vesselType: masterVesselTypes.vesselType,
      })
      .from(masterVesselTypes)
      .where(eq(masterVesselTypes.isDeleted, false));
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

  // ---- Contracts list / detail (0181) -------------------------------------

  /**
   * Engagement list rows for the Contracts screen, newest start date first.
   * Optional vessel / status filters.
   */
  async findEngagementList(filters: {
    vesselUuid?: string;
    status?: string;
  }): Promise<AccEngagementV2[]> {
    const db = getDb();
    const conds = [eq(accEngagementsV2.isDeleted, false)];
    if (filters.vesselUuid) {
      conds.push(eq(accEngagementsV2.vesselUuid, filters.vesselUuid));
    }
    if (filters.status) {
      conds.push(eq(accEngagementsV2.status, filters.status));
    }
    return db
      .select()
      .from(accEngagementsV2)
      .where(and(...conds))
      .orderBy(desc(accEngagementsV2.startDate), desc(accEngagementsV2.id));
  }

  /** All live override rows (any mode, incl. timing-only) for one engagement. */
  async findOverridesByEngagement(
    engagementUuid: string,
  ): Promise<AccEngagementPayElementV2[]> {
    const db = getDb();
    return db
      .select()
      .from(accEngagementPayElementsV2)
      .where(
        and(
          eq(accEngagementPayElementsV2.engagementUuid, engagementUuid),
          eq(accEngagementPayElementsV2.isDeleted, false),
        ),
      )
      .orderBy(accEngagementPayElementsV2.id);
  }

  async findOverrideByUuid(
    epeUuid: string,
  ): Promise<AccEngagementPayElementV2 | undefined> {
    const db = getDb();
    const rows = await db
      .select()
      .from(accEngagementPayElementsV2)
      .where(
        and(
          eq(accEngagementPayElementsV2.epeUuid, epeUuid),
          eq(accEngagementPayElementsV2.isDeleted, false),
        ),
      );
    return rows[0];
  }

  async createOverride(data: {
    engagementUuid: string;
    payElementUuid: string;
    overrideMode: string;
    amount?: string | null;
    rate?: string | null;
    paymentTimingOverride?: string | null;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
    remarks?: string | null;
    createdByUuid?: string | null;
  }): Promise<AccEngagementPayElementV2> {
    const db = getDb();
    const rows = await db
      .insert(accEngagementPayElementsV2)
      .values({
        epeUuid: uuidv4(),
        engagementUuid: data.engagementUuid,
        payElementUuid: data.payElementUuid,
        overrideMode: data.overrideMode,
        amount: data.amount ?? null,
        rate: data.rate ?? null,
        paymentTimingOverride: data.paymentTimingOverride ?? null,
        effectiveFrom: data.effectiveFrom ?? null,
        effectiveTo: data.effectiveTo ?? null,
        remarks: data.remarks ?? null,
        createdByUuid: data.createdByUuid ?? null,
      })
      .returning();
    return rows[0];
  }

  async updateOverride(
    epeUuid: string,
    data: Partial<{
      payElementUuid: string;
      overrideMode: string;
      amount: string | null;
      rate: string | null;
      paymentTimingOverride: string | null;
      effectiveFrom: string | null;
      effectiveTo: string | null;
      remarks: string | null;
      isDeleted: boolean;
      updatedByUuid: string | null;
    }>,
  ): Promise<AccEngagementPayElementV2 | undefined> {
    const db = getDb();
    const rows = await db
      .update(accEngagementPayElementsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(accEngagementPayElementsV2.epeUuid, epeUuid))
      .returning();
    return rows[0];
  }

  /** Periods (of the given set) whose portage bill for the vessel is locked. */
  async findLockedPeriods(
    vesselUuid: string,
    periods: string[],
  ): Promise<Set<string>> {
    const set = new Set<string>();
    if (periods.length === 0) return set;
    const db = getDb();
    const rows = await db
      .select({
        period: accPortageBillsV2.period,
        status: accPortageBillsV2.status,
        isLocked: accPortageBillsV2.isLocked,
      })
      .from(accPortageBillsV2)
      .where(
        and(
          eq(accPortageBillsV2.vesselUuid, vesselUuid),
          inArray(accPortageBillsV2.period, periods),
          eq(accPortageBillsV2.isDeleted, false),
        ),
      );
    for (const r of rows as Array<{
      period: string;
      status: string;
      isLocked: boolean | null;
    }>) {
      if (r.isLocked || r.status === "locked") set.add(r.period);
    }
    return set;
  }

  /**
   * Latest updated_at/created_at across the vessel's engagements and their
   * override rows — used for the Step-2 stale-calculation indicator.
   */
  async findLatestInputChange(vesselUuid: string): Promise<Date | null> {
    const db = getDb();
    const rows = await db.execute(sql`
      SELECT GREATEST(
        (SELECT MAX(GREATEST(e.updated_at, e.created_at))
           FROM acc_engagements_v2 e
          WHERE e.vessel_uuid = ${vesselUuid}),
        (SELECT MAX(GREATEST(o.updated_at, o.created_at))
           FROM acc_engagement_pay_elements_v2 o
           JOIN acc_engagements_v2 e2 ON e2.engagement_uuid = o.engagement_uuid
          WHERE e2.vessel_uuid = ${vesselUuid})
      ) AS latest
    `);
    const latest = (rows.rows?.[0] as { latest?: Date | string | null } | undefined)
      ?.latest;
    if (!latest) return null;
    return latest instanceof Date ? latest : new Date(latest);
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
