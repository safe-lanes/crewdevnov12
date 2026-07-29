import { eq, and, inArray, lt, lte } from "drizzle-orm";
import { getDb } from "../../db";
import {
  accTenantConfigV2,
  accEngagementsV2,
  accEngagementPhasesV2,
  accEngagementPayElementsV2,
  accPayElementsV2,
  accWageScalesV2,
  accWageScaleLinesV2,
  accMonthlyTransactionsV2,
  accAllotmentsV2,
  accAdvancesV2,
  accWageLedgerV2,
  accSettlementsV2,
} from "../../../../shared/v2/accounts/schema";
import { crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import { masterNationalities } from "../../../../shared/schema";
import { promoExecutionLedgerV2 } from "../../../../shared/v2/promotions/schema";
import { admCompanyRanksV2 } from "../../../../shared/v2/admin/schema";
import type {
  AccTenantConfigV2,
  AccEngagementV2,
  AccEngagementPhaseV2,
  AccEngagementPayElementV2,
  AccPayElementV2,
  AccWageScaleV2,
  AccWageScaleLineV2,
  AccMonthlyTransactionV2,
  AccAllotmentV2,
  AccAdvanceV2,
  AccWageLedgerV2,
  AccSettlementV2,
} from "../../../../shared/v2/accounts/types";

export interface PromotionEvent {
  crewUuid: string;
  toRank: string;
  effectiveDate: string; // text in source table; validated by the engine
}

/**
 * Read-only data access for the wage calculation engine. All queries go
 * through getDb() (tenant context via AsyncLocalStorage).
 */
export class EngineReads {
  async getConfig(): Promise<AccTenantConfigV2 | undefined> {
    const db = getDb();
    const rows = await db
      .select()
      .from(accTenantConfigV2)
      .where(eq(accTenantConfigV2.isDeleted, false));
    return rows[0];
  }

  /** Engagements on a vessel whose date range overlaps the month. */
  async findEngagementsForVesselPeriod(
    vesselUuid: string,
    monthStart: string,
    monthEnd: string,
  ): Promise<AccEngagementV2[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(accEngagementsV2)
      .where(
        and(
          eq(accEngagementsV2.vesselUuid, vesselUuid),
          eq(accEngagementsV2.isDeleted, false),
          inArray(accEngagementsV2.status, ["active", "completed"]),
        ),
      );
    return rows.filter(
      (e: AccEngagementV2) =>
        e.startDate != null &&
        e.startDate <= monthEnd &&
        (e.endDate == null || e.endDate >= monthStart),
    );
  }

  async findEngagementByUuid(
    engagementUuid: string,
  ): Promise<AccEngagementV2 | undefined> {
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

  async findPhases(
    engagementUuids: string[],
  ): Promise<AccEngagementPhaseV2[]> {
    if (engagementUuids.length === 0) return [];
    const db = getDb();
    return db
      .select()
      .from(accEngagementPhasesV2)
      .where(
        and(
          inArray(accEngagementPhasesV2.engagementUuid, engagementUuids),
          eq(accEngagementPhasesV2.isDeleted, false),
        ),
      );
  }

  async findOverrides(
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
          eq(accEngagementPayElementsV2.isDeleted, false),
        ),
      );
  }

  async findActiveElements(): Promise<AccPayElementV2[]> {
    const db = getDb();
    return db
      .select()
      .from(accPayElementsV2)
      .where(
        and(
          eq(accPayElementsV2.isDeleted, false),
          eq(accPayElementsV2.status, "active"),
        ),
      );
  }

  async findScaleByUuid(
    scaleUuid: string,
  ): Promise<AccWageScaleV2 | undefined> {
    const db = getDb();
    const rows = await db
      .select()
      .from(accWageScalesV2)
      .where(
        and(
          eq(accWageScalesV2.scaleUuid, scaleUuid),
          eq(accWageScalesV2.isDeleted, false),
        ),
      );
    return rows[0];
  }

  async findScaleLines(scaleUuids: string[]): Promise<AccWageScaleLineV2[]> {
    if (scaleUuids.length === 0) return [];
    const db = getDb();
    return db
      .select()
      .from(accWageScaleLinesV2)
      .where(
        and(
          inArray(accWageScaleLinesV2.scaleUuid, scaleUuids),
          eq(accWageScaleLinesV2.isDeleted, false),
        ),
      );
  }

  async findAcceptedTxns(
    engagementUuids: string[],
    period: string,
  ): Promise<AccMonthlyTransactionV2[]> {
    if (engagementUuids.length === 0) return [];
    const db = getDb();
    return db
      .select()
      .from(accMonthlyTransactionsV2)
      .where(
        and(
          inArray(accMonthlyTransactionsV2.engagementUuid, engagementUuids),
          eq(accMonthlyTransactionsV2.period, period),
          eq(accMonthlyTransactionsV2.status, "accepted"),
          eq(accMonthlyTransactionsV2.isDeleted, false),
        ),
      );
  }

  async findActiveAllotments(crewUuids: string[]): Promise<AccAllotmentV2[]> {
    if (crewUuids.length === 0) return [];
    const db = getDb();
    return db
      .select()
      .from(accAllotmentsV2)
      .where(
        and(
          inArray(accAllotmentsV2.crewUuid, crewUuids),
          eq(accAllotmentsV2.status, "active"),
          eq(accAllotmentsV2.isDeleted, false),
        ),
      );
  }

  /**
   * Advances with a recovery potentially due in the given period: the
   * advance's period is its FIRST recovery month; recovery then continues
   * in later months until the clamp (min(recovery, outstanding), spec
   * Prompt 07 2b) exhausts the advance. Cancelled/closed advances never
   * post.
   */
  async findAdvanceRecoveries(
    crewUuids: string[],
    period: string,
  ): Promise<AccAdvanceV2[]> {
    if (crewUuids.length === 0) return [];
    const db = getDb();
    const rows = await db
      .select()
      .from(accAdvancesV2)
      .where(
        and(
          inArray(accAdvancesV2.crewUuid, crewUuids),
          lte(accAdvancesV2.period, period),
          inArray(accAdvancesV2.status, ["approved", "disbursed", "open"]),
          eq(accAdvancesV2.isDeleted, false),
        ),
      );
    return rows.filter(
      (a: AccAdvanceV2) =>
        a.recoveryAmount != null && Number(a.recoveryAmount) > 0,
    );
  }

  /**
   * Advance-recovery ledger lines posted in periods strictly BEFORE the
   * run period (clamp basis, spec Prompt 07 2b). Only earlier periods
   * count so re-running an unlocked middle month stays deterministic even
   * after later months have posted.
   */
  async findPriorRecoveryLines(
    crewUuids: string[],
    beforePeriod: string,
  ): Promise<
    Array<{
      sourceUuid: string | null;
      period: string;
      portageUuid: string | null;
      amount: string;
    }>
  > {
    if (crewUuids.length === 0) return [];
    const db = getDb();
    return db
      .select({
        sourceUuid: accWageLedgerV2.sourceUuid,
        period: accWageLedgerV2.period,
        portageUuid: accWageLedgerV2.portageUuid,
        amount: accWageLedgerV2.amount,
      })
      .from(accWageLedgerV2)
      .where(
        and(
          inArray(accWageLedgerV2.crewUuid, crewUuids),
          eq(accWageLedgerV2.sourceType, "advance_recovery"),
          lt(accWageLedgerV2.period, beforePeriod),
          eq(accWageLedgerV2.isDeleted, false),
        ),
      );
  }

  /** crew_uuid -> nationality_uuid (null when unknown). */
  async findCrewNationalities(
    crewUuids: string[],
  ): Promise<Map<string, string | null>> {
    const map = new Map<string, string | null>();
    if (crewUuids.length === 0) return map;
    const db = getDb();
    const rows = await db
      .select({
        crewUuid: crewMembersV2.crewUuid,
        nationalityUuid: crewMembersV2.nationalityUuid,
      })
      .from(crewMembersV2)
      .where(inArray(crewMembersV2.crewUuid, crewUuids));
    for (const r of rows) map.set(r.crewUuid, r.nationalityUuid ?? null);
    return map;
  }

  /** nat_uuid -> display name (nationality, falling back to country name). */
  async findNationalityNames(
    natUuids: string[],
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const distinct = Array.from(new Set(natUuids.filter(Boolean)));
    if (distinct.length === 0) return map;
    const db = getDb();
    const rows = await db
      .select({
        natUuid: masterNationalities.natUuid,
        nationality: masterNationalities.nationality,
        countryName: masterNationalities.countryName,
      })
      .from(masterNationalities)
      .where(inArray(masterNationalities.natUuid, distinct));
    for (const r of rows) {
      if (r.natUuid) map.set(r.natUuid, r.nationality || r.countryName || r.natUuid);
    }
    return map;
  }

  /** Ledger lines of an engagement in periods strictly before `period`. */
  async findLedgerLinesBefore(
    engagementUuid: string,
    period: string,
  ): Promise<AccWageLedgerV2[]> {
    const db = getDb();
    return db
      .select()
      .from(accWageLedgerV2)
      .where(
        and(
          eq(accWageLedgerV2.engagementUuid, engagementUuid),
          lt(accWageLedgerV2.period, period),
          eq(accWageLedgerV2.isDeleted, false),
        ),
      );
  }

  /** The (unique) settlement row for an engagement, if any. */
  async findSettlementForEngagement(
    engagementUuid: string,
  ): Promise<AccSettlementV2 | undefined> {
    const db = getDb();
    const rows = await db
      .select()
      .from(accSettlementsV2)
      .where(
        and(
          eq(accSettlementsV2.engagementUuid, engagementUuid),
          eq(accSettlementsV2.isDeleted, false),
        ),
      );
    return rows[0];
  }

  /**
   * All live engagements for the given crews. Used by the freeze guard to
   * resolve overlapping engagements of the same crew.
   */
  async findEngagementsByCrewUuids(
    crewUuids: string[],
  ): Promise<AccEngagementV2[]> {
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

  /**
   * Settlements in a re-run-freezing status (submitted/approved/paid/locked)
   * for any of the given engagements. Used by the engine's freeze guard.
   */
  async findFrozenSettlements(
    engagementUuids: string[],
  ): Promise<AccSettlementV2[]> {
    if (engagementUuids.length === 0) return [];
    const db = getDb();
    return db
      .select()
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
  }

  /** rankId (text) -> human-readable rank label (for engine warning messages). */
  async findRankNames(rankIds: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (rankIds.length === 0) return map;
    const db = getDb();
    const rows = await db
      .select({
        rankId: admCompanyRanksV2.rankId,
        rank: admCompanyRanksV2.rank,
      })
      .from(admCompanyRanksV2)
      .where(inArray(admCompanyRanksV2.rankId, rankIds));
    for (const r of rows) {
      if (r.rank) map.set(r.rankId, r.rank);
    }
    return map;
  }

  /** crew_uuid -> display name (for engine error messages). */
  async findCrewNames(crewUuids: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (crewUuids.length === 0) return map;
    const db = getDb();
    const rows = await db
      .select({
        crewUuid: crewMembersV2.crewUuid,
        firstName: crewMembersV2.firstName,
        middleName: crewMembersV2.middleName,
        familyName: crewMembersV2.familyName,
      })
      .from(crewMembersV2)
      .where(inArray(crewMembersV2.crewUuid, crewUuids));
    for (const r of rows) {
      const name = [r.firstName, r.middleName, r.familyName]
        .filter(Boolean)
        .join(" ");
      map.set(r.crewUuid, name || r.crewUuid);
    }
    return map;
  }

  /**
   * pay_element_uuid -> category, without a status filter — prior ledger
   * lines may reference elements that were deactivated since.
   */
  async findElementCategories(
    payElementUuids: string[],
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (payElementUuids.length === 0) return map;
    const db = getDb();
    const rows = await db
      .select({
        payElementUuid: accPayElementsV2.payElementUuid,
        category: accPayElementsV2.category,
      })
      .from(accPayElementsV2)
      .where(inArray(accPayElementsV2.payElementUuid, payElementUuids));
    for (const r of rows) map.set(r.payElementUuid, r.category);
    return map;
  }

  /** Promotion events per crew, from the promotions execution ledger. */
  async findPromotions(crewUuids: string[]): Promise<PromotionEvent[]> {
    if (crewUuids.length === 0) return [];
    const db = getDb();
    const rows = await db
      .select()
      .from(promoExecutionLedgerV2)
      .where(
        and(
          inArray(promoExecutionLedgerV2.crewUuid, crewUuids),
          eq(promoExecutionLedgerV2.isDeleted, false),
        ),
      );
    type PromoRow = typeof promoExecutionLedgerV2.$inferSelect;
    return rows
      .filter((r: PromoRow) => r.crewUuid != null && r.effectiveDate != null)
      .map((r: PromoRow) => ({
        crewUuid: r.crewUuid as string,
        toRank: r.toRank,
        effectiveDate: String(r.effectiveDate).slice(0, 10),
      }));
  }
}
