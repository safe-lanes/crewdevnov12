import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import {
  accMonthlyTransactionsV2,
  accPortageBillsV2,
} from "../../../../shared/v2/accounts/schema";
import type {
  AccMonthlyTransactionV2,
  InsertAccMonthlyTransactionV2,
  AccPortageBillV2,
} from "../../../../shared/v2/accounts/types";
import { v4 as uuidv4 } from "uuid";

export class MonthlyTransactionsRepository {
  async findAll(filters?: {
    vesselUuid?: string;
    period?: string;
    crewUuid?: string;
    engagementUuid?: string;
    status?: string;
    origin?: string;
  }): Promise<AccMonthlyTransactionV2[]> {
    const db = getDb();
    const conditions = [eq(accMonthlyTransactionsV2.isDeleted, false)];
    if (filters?.vesselUuid) {
      conditions.push(eq(accMonthlyTransactionsV2.vesselUuid, filters.vesselUuid));
    }
    if (filters?.origin) {
      conditions.push(eq(accMonthlyTransactionsV2.origin, filters.origin));
    }
    if (filters?.period) {
      conditions.push(eq(accMonthlyTransactionsV2.period, filters.period));
    }
    if (filters?.crewUuid) {
      conditions.push(eq(accMonthlyTransactionsV2.crewUuid, filters.crewUuid));
    }
    if (filters?.engagementUuid) {
      conditions.push(
        eq(accMonthlyTransactionsV2.engagementUuid, filters.engagementUuid),
      );
    }
    if (filters?.status) {
      conditions.push(eq(accMonthlyTransactionsV2.status, filters.status));
    }
    return db
      .select()
      .from(accMonthlyTransactionsV2)
      .where(and(...conditions))
      .orderBy(desc(accMonthlyTransactionsV2.createdAt));
  }

  async findByUuid(txnUuid: string): Promise<AccMonthlyTransactionV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(accMonthlyTransactionsV2)
      .where(
        and(
          eq(accMonthlyTransactionsV2.txnUuid, txnUuid),
          eq(accMonthlyTransactionsV2.isDeleted, false),
        ),
      );
    return results[0];
  }

  /** Read-only portage lookup for the lock guard (no ledger writes here). */
  async findPortage(
    vesselUuid: string,
    period: string,
  ): Promise<AccPortageBillV2 | undefined> {
    const db = getDb();
    const rows = await db
      .select()
      .from(accPortageBillsV2)
      .where(
        and(
          eq(accPortageBillsV2.vesselUuid, vesselUuid),
          eq(accPortageBillsV2.period, period),
          eq(accPortageBillsV2.isDeleted, false),
        ),
      );
    return rows[0];
  }

  async create(
    data: Omit<InsertAccMonthlyTransactionV2, "txnUuid">,
  ): Promise<AccMonthlyTransactionV2> {
    const db = getDb();
    const results = await db
      .insert(accMonthlyTransactionsV2)
      .values({ ...data, txnUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async update(
    txnUuid: string,
    data: Partial<InsertAccMonthlyTransactionV2>,
  ): Promise<AccMonthlyTransactionV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(accMonthlyTransactionsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(accMonthlyTransactionsV2.txnUuid, txnUuid))
      .returning();
    return results[0];
  }

  /** Live transaction linked to a CTM line (advance dual-record). */
  async findByCtmLine(
    ctmLineUuid: string,
  ): Promise<AccMonthlyTransactionV2 | undefined> {
    const db = getDb();
    const rows = await db
      .select()
      .from(accMonthlyTransactionsV2)
      .where(
        and(
          eq(accMonthlyTransactionsV2.ctmLineUuid, ctmLineUuid),
          eq(accMonthlyTransactionsV2.isDeleted, false),
        ),
      );
    return rows[0];
  }

  /**
   * Bulk vessel-origin status flip for the submit/return lifecycle
   * (e.g. draft → submitted on vessel submit; submitted → draft on office
   * return, stamping the office comment on the reverted rows).
   */
  async flipVesselStatus(
    vesselUuid: string,
    period: string,
    fromStatus: string,
    toStatus: string,
    opts?: { reviewComment?: string | null; auditUserUuid?: string },
  ): Promise<AccMonthlyTransactionV2[]> {
    const db = getDb();
    return db
      .update(accMonthlyTransactionsV2)
      .set({
        status: toStatus,
        ...(opts?.reviewComment !== undefined
          ? { reviewComment: opts.reviewComment }
          : {}),
        updatedByUuid: opts?.auditUserUuid ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(accMonthlyTransactionsV2.vesselUuid, vesselUuid),
          eq(accMonthlyTransactionsV2.period, period),
          eq(accMonthlyTransactionsV2.origin, "vessel"),
          eq(accMonthlyTransactionsV2.status, fromStatus),
          eq(accMonthlyTransactionsV2.isDeleted, false),
        ),
      )
      .returning();
  }

  async softDelete(txnUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(accMonthlyTransactionsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(accMonthlyTransactionsV2.txnUuid, txnUuid))
      .returning();
    return results.length > 0;
  }
}
