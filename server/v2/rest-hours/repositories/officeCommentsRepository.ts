import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { rhOfficeViolationCommentsV2 } from "../../../../shared/v2/rest-hours/schema";
import type {
  RhOfficeViolationCommentV2,
  InsertRhOfficeViolationCommentV2,
} from "../../../../shared/v2/rest-hours/types";
import { v4 as uuidv4 } from "uuid";

export class OfficeCommentsRepository {
  async findAll(filters?: {
    vesselId?: string;
    monthValue?: string;
  }): Promise<RhOfficeViolationCommentV2[]> {
    const db = getDb();
    let conditions = [eq(rhOfficeViolationCommentsV2.isDeleted, false)];

    if (filters?.vesselId) {
      conditions.push(eq(rhOfficeViolationCommentsV2.vesselId, filters.vesselId));
    }
    if (filters?.monthValue) {
      conditions.push(eq(rhOfficeViolationCommentsV2.monthValue, filters.monthValue));
    }

    const results = await db
      .select()
      .from(rhOfficeViolationCommentsV2)
      .where(and(...conditions))
      .orderBy(desc(rhOfficeViolationCommentsV2.createdAt));

    return results;
  }

  async findByUuid(officeCommentUuid: string): Promise<RhOfficeViolationCommentV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(rhOfficeViolationCommentsV2)
      .where(
        and(
          eq(rhOfficeViolationCommentsV2.officeCommentUuid, officeCommentUuid),
          eq(rhOfficeViolationCommentsV2.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(
    data: Omit<InsertRhOfficeViolationCommentV2, "officeCommentUuid">
  ): Promise<RhOfficeViolationCommentV2> {
    const db = getDb();
    const results = await db
      .insert(rhOfficeViolationCommentsV2)
      .values({
        ...data,
        officeCommentUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async update(
    officeCommentUuid: string,
    data: Partial<InsertRhOfficeViolationCommentV2>
  ): Promise<RhOfficeViolationCommentV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(rhOfficeViolationCommentsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rhOfficeViolationCommentsV2.officeCommentUuid, officeCommentUuid))
      .returning();
    return results[0];
  }

  async softDelete(officeCommentUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(rhOfficeViolationCommentsV2)
      .set({
        isDeleted: true,
        updatedAt: new Date(),
      })
      .where(eq(rhOfficeViolationCommentsV2.officeCommentUuid, officeCommentUuid))
      .returning();
    return results.length > 0;
  }
}
