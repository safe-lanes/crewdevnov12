import { eq, and, asc, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import {
  accPayElementsV2,
  accWageScaleLinesV2,
  accWageScalesV2,
  accEngagementPayElementsV2,
} from "../../../../shared/v2/accounts/schema";
import type {
  AccPayElementV2,
  InsertAccPayElementV2,
} from "../../../../shared/v2/accounts/types";
import { v4 as uuidv4 } from "uuid";

export class PayElementsRepository {
  async findAll(filters?: {
    status?: string;
    type?: string;
    category?: string;
  }): Promise<AccPayElementV2[]> {
    const db = getDb();
    const conditions = [eq(accPayElementsV2.isDeleted, false)];
    if (filters?.status) {
      conditions.push(eq(accPayElementsV2.status, filters.status));
    }
    if (filters?.type) {
      conditions.push(eq(accPayElementsV2.type, filters.type));
    }
    if (filters?.category) {
      conditions.push(eq(accPayElementsV2.category, filters.category));
    }
    return db
      .select()
      .from(accPayElementsV2)
      .where(and(...conditions))
      .orderBy(asc(accPayElementsV2.sortOrder), asc(accPayElementsV2.code));
  }

  async findByUuid(
    payElementUuid: string,
  ): Promise<AccPayElementV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(accPayElementsV2)
      .where(
        and(
          eq(accPayElementsV2.payElementUuid, payElementUuid),
          eq(accPayElementsV2.isDeleted, false),
        ),
      );
    return results[0];
  }

  async create(
    data: Omit<InsertAccPayElementV2, "payElementUuid">,
  ): Promise<AccPayElementV2> {
    const db = getDb();
    const results = await db
      .insert(accPayElementsV2)
      .values({ ...data, payElementUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async createMany(
    rows: Omit<InsertAccPayElementV2, "payElementUuid">[],
  ): Promise<AccPayElementV2[]> {
    const db = getDb();
    if (rows.length === 0) return [];
    const values = rows.map((r) => ({ ...r, payElementUuid: uuidv4() }));
    return db.insert(accPayElementsV2).values(values).returning();
  }

  /**
   * Seed helper: for each standard row, revive-and-reset a matching row by
   * `code` (including previously soft-deleted rows, which still occupy the
   * unique `code` constraint) or insert it when the code is absent. Idempotent
   * and collision-safe. Returns the resulting live rows.
   */
  async seedStandardElements(
    rows: Omit<InsertAccPayElementV2, "payElementUuid">[],
  ): Promise<AccPayElementV2[]> {
    const db = getDb();
    if (rows.length === 0) return [];
    const codes = rows.map((r) => r.code);
    const existing = await db
      .select()
      .from(accPayElementsV2)
      .where(inArray(accPayElementsV2.code, codes));
    const uuidByCode = new Map<string, string>();
    for (const e of existing) {
      uuidByCode.set(e.code, e.payElementUuid);
    }

    const result: AccPayElementV2[] = [];
    for (const row of rows) {
      const existingUuid = uuidByCode.get(row.code);
      if (existingUuid) {
        const [updated] = await db
          .update(accPayElementsV2)
          .set({
            ...(row as Partial<InsertAccPayElementV2>),
            isDeleted: false,
            updatedAt: new Date(),
          })
          .where(eq(accPayElementsV2.payElementUuid, existingUuid))
          .returning();
        result.push(updated);
      } else {
        const [created] = await db
          .insert(accPayElementsV2)
          .values({ ...row, payElementUuid: uuidv4() })
          .returning();
        result.push(created);
      }
    }
    return result;
  }

  async update(
    payElementUuid: string,
    data: Partial<InsertAccPayElementV2>,
  ): Promise<AccPayElementV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(accPayElementsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(accPayElementsV2.payElementUuid, payElementUuid))
      .returning();
    return results[0];
  }

  async softDelete(payElementUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(accPayElementsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(accPayElementsV2.payElementUuid, payElementUuid))
      .returning();
    return results.length > 0;
  }

  /**
   * Distinct wage scales that reference this element through a live line,
   * optionally restricted to the given scale statuses.
   */
  async findReferencingScales(
    payElementUuid: string,
    statuses?: string[],
  ): Promise<{ scaleUuid: string; scaleName: string }[]> {
    const db = getDb();
    const rows = await db
      .select({
        scaleUuid: accWageScalesV2.scaleUuid,
        scaleName: accWageScalesV2.scaleName,
      })
      .from(accWageScaleLinesV2)
      .innerJoin(
        accWageScalesV2,
        eq(accWageScaleLinesV2.scaleUuid, accWageScalesV2.scaleUuid),
      )
      .where(
        and(
          eq(accWageScaleLinesV2.payElementUuid, payElementUuid),
          eq(accWageScaleLinesV2.isDeleted, false),
          eq(accWageScalesV2.isDeleted, false),
          ...(statuses && statuses.length > 0
            ? [inArray(accWageScalesV2.status, statuses)]
            : []),
        ),
      );
    const seen = new Map<string, string>();
    for (const r of rows) seen.set(r.scaleUuid, r.scaleName);
    return Array.from(seen, ([scaleUuid, scaleName]) => ({
      scaleUuid,
      scaleName,
    }));
  }

  /** Count of engagement overrides that reference this element. */
  async countReferencingEngagements(payElementUuid: string): Promise<number> {
    const db = getDb();
    const rows = await db
      .select({ id: accEngagementPayElementsV2.id })
      .from(accEngagementPayElementsV2)
      .where(
        and(
          eq(accEngagementPayElementsV2.payElementUuid, payElementUuid),
          eq(accEngagementPayElementsV2.isDeleted, false),
        ),
      );
    return rows.length;
  }
}
