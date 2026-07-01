import { eq, and, asc } from "drizzle-orm";
import { getDb } from "../../db";
import { accPayElementsV2 } from "../../../../shared/v2/accounts/schema";
import type {
  AccPayElementV2,
  InsertAccPayElementV2,
} from "../../../../shared/v2/accounts/types";
import { v4 as uuidv4 } from "uuid";

export class PayElementsRepository {
  async findAll(filters?: {
    status?: string;
    type?: string;
  }): Promise<AccPayElementV2[]> {
    const db = getDb();
    const conditions = [eq(accPayElementsV2.isDeleted, false)];
    if (filters?.status) {
      conditions.push(eq(accPayElementsV2.status, filters.status));
    }
    if (filters?.type) {
      conditions.push(eq(accPayElementsV2.type, filters.type));
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
}
