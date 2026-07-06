import { eq, and, asc, isNull, sql } from "drizzle-orm";
import { getDb } from "../../db";
import {
  accWageScalesV2,
  accWageScaleLinesV2,
} from "../../../../shared/v2/accounts/schema";
import type {
  AccWageScaleV2,
  InsertAccWageScaleV2,
  AccWageScaleLineV2,
} from "../../../../shared/v2/accounts/types";
import { v4 as uuidv4 } from "uuid";

/** Shape accepted by the bulk line-upsert (uuid + scale set server-side). */
export type WageScaleLineInput = {
  rankId: string;
  nationalityUuid?: string | null;
  experienceMinMonths?: number | null;
  experienceMaxMonths?: number | null;
  payElementUuid: string;
  amount?: string | null;
  rate?: string | null;
  sortOrder?: number | null;
};

export class WageScalesRepository {
  async findAll(filters?: { status?: string }): Promise<AccWageScaleV2[]> {
    const db = getDb();
    const conditions = [eq(accWageScalesV2.isDeleted, false)];
    if (filters?.status) {
      conditions.push(eq(accWageScalesV2.status, filters.status));
    }
    return db
      .select()
      .from(accWageScalesV2)
      .where(and(...conditions))
      .orderBy(asc(accWageScalesV2.sortOrder), asc(accWageScalesV2.scaleName));
  }

  async findByUuid(scaleUuid: string): Promise<AccWageScaleV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(accWageScalesV2)
      .where(
        and(
          eq(accWageScalesV2.scaleUuid, scaleUuid),
          eq(accWageScalesV2.isDeleted, false),
        ),
      );
    return results[0];
  }

  /** Map of scaleUuid -> live line count, for list badges. */
  async lineCounts(): Promise<Record<string, number>> {
    const db = getDb();
    const rows = await db
      .select({
        scaleUuid: accWageScaleLinesV2.scaleUuid,
        count: sql<number>`count(*)::int`,
      })
      .from(accWageScaleLinesV2)
      .where(eq(accWageScaleLinesV2.isDeleted, false))
      .groupBy(accWageScaleLinesV2.scaleUuid);
    const map: Record<string, number> = {};
    for (const r of rows) map[r.scaleUuid] = Number(r.count);
    return map;
  }

  async findActiveByScope(
    vesselTypeUuid: string | null,
    vesselGroupUuid: string | null,
  ): Promise<AccWageScaleV2[]> {
    const db = getDb();
    return db
      .select()
      .from(accWageScalesV2)
      .where(
        and(
          eq(accWageScalesV2.isDeleted, false),
          eq(accWageScalesV2.status, "active"),
          vesselTypeUuid
            ? eq(accWageScalesV2.vesselTypeUuid, vesselTypeUuid)
            : isNull(accWageScalesV2.vesselTypeUuid),
          vesselGroupUuid
            ? eq(accWageScalesV2.vesselGroupUuid, vesselGroupUuid)
            : isNull(accWageScalesV2.vesselGroupUuid),
        ),
      );
  }

  async create(
    data: Omit<InsertAccWageScaleV2, "scaleUuid">,
  ): Promise<AccWageScaleV2> {
    const db = getDb();
    const results = await db
      .insert(accWageScalesV2)
      .values({ ...data, scaleUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async update(
    scaleUuid: string,
    data: Partial<InsertAccWageScaleV2>,
  ): Promise<AccWageScaleV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(accWageScalesV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(accWageScalesV2.scaleUuid, scaleUuid))
      .returning();
    return results[0];
  }

  async softDelete(scaleUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(accWageScalesV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(accWageScalesV2.scaleUuid, scaleUuid))
      .returning();
    return results.length > 0;
  }

  async findLinesByScale(scaleUuid: string): Promise<AccWageScaleLineV2[]> {
    const db = getDb();
    return db
      .select()
      .from(accWageScaleLinesV2)
      .where(
        and(
          eq(accWageScaleLinesV2.scaleUuid, scaleUuid),
          eq(accWageScaleLinesV2.isDeleted, false),
        ),
      )
      .orderBy(
        asc(accWageScaleLinesV2.sortOrder),
        asc(accWageScaleLinesV2.rankId),
      );
  }

  /**
   * Replace the entire line set for a draft scale. Lines are hard-deleted then
   * re-inserted (the matrix saves the whole grid, and the unique key spans
   * soft-deleted rows), all inside one transaction.
   */
  async replaceLines(
    scaleUuid: string,
    lines: WageScaleLineInput[],
    auditUserUuid?: string,
  ): Promise<AccWageScaleLineV2[]> {
    const db = getDb();
    return db.transaction(async (tx: any) => {
      await tx
        .delete(accWageScaleLinesV2)
        .where(eq(accWageScaleLinesV2.scaleUuid, scaleUuid));
      if (lines.length === 0) return [];
      const values = lines.map((l, idx) => ({
        scaleLineUuid: uuidv4(),
        scaleUuid,
        rankId: l.rankId,
        nationalityUuid: l.nationalityUuid ?? null,
        experienceMinMonths: l.experienceMinMonths ?? null,
        experienceMaxMonths: l.experienceMaxMonths ?? null,
        payElementUuid: l.payElementUuid,
        amount: l.amount ?? null,
        rate: l.rate ?? null,
        sortOrder: l.sortOrder ?? idx,
        createdByUuid: auditUserUuid ?? null,
        updatedByUuid: auditUserUuid ?? null,
      }));
      return tx.insert(accWageScaleLinesV2).values(values).returning();
    });
  }

  /**
   * Supersede an active scale in one transaction: create a new draft revision,
   * clone the original's live lines into it, and mark the original superseded.
   * Returns the freshly-created draft.
   */
  async supersedeInTransaction(
    original: AccWageScaleV2,
    effectiveTo: string,
    auditUserUuid?: string,
  ): Promise<AccWageScaleV2> {
    const db = getDb();
    return db.transaction(async (tx: any) => {
      const newUuid = uuidv4();
      const [newDraft] = await tx
        .insert(accWageScalesV2)
        .values({
          scaleUuid: newUuid,
          scaleName: `${original.scaleName} (revision)`,
          description: original.description,
          vesselTypeUuid: original.vesselTypeUuid,
          vesselGroupUuid: original.vesselGroupUuid,
          currency: original.currency,
          effectiveFrom: null,
          effectiveTo: null,
          status: "draft",
          createdByUuid: auditUserUuid ?? null,
          updatedByUuid: auditUserUuid ?? null,
        })
        .returning();

      const existing = await tx
        .select()
        .from(accWageScaleLinesV2)
        .where(
          and(
            eq(accWageScaleLinesV2.scaleUuid, original.scaleUuid),
            eq(accWageScaleLinesV2.isDeleted, false),
          ),
        );
      if (existing.length > 0) {
        await tx.insert(accWageScaleLinesV2).values(
          existing.map((l: AccWageScaleLineV2) => ({
            scaleLineUuid: uuidv4(),
            scaleUuid: newUuid,
            rankId: l.rankId,
            nationalityUuid: l.nationalityUuid,
            experienceMinMonths: l.experienceMinMonths,
            experienceMaxMonths: l.experienceMaxMonths,
            payElementUuid: l.payElementUuid,
            amount: l.amount,
            rate: l.rate,
            sortOrder: l.sortOrder,
            createdByUuid: auditUserUuid ?? null,
            updatedByUuid: auditUserUuid ?? null,
          })),
        );
      }

      await tx
        .update(accWageScalesV2)
        .set({
          status: "superseded",
          supersededByScaleUuid: newUuid,
          effectiveTo,
          updatedByUuid: auditUserUuid ?? null,
          updatedAt: new Date(),
        })
        .where(eq(accWageScalesV2.scaleUuid, original.scaleUuid));

      return newDraft;
    });
  }
}
