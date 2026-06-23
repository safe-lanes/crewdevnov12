import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { accPayrunsV2 } from "../../../../shared/v2/accounts/schema";
import type {
  AccPayrunV2,
  InsertAccPayrunV2,
} from "../../../../shared/v2/accounts/types";
import { v4 as uuidv4 } from "uuid";

export class PayrunsRepository {
  async findAll(filters?: {
    vesselUuid?: string;
    status?: string;
  }): Promise<AccPayrunV2[]> {
    const db = getDb();
    const conditions = [eq(accPayrunsV2.isDeleted, false)];
    if (filters?.vesselUuid) {
      conditions.push(eq(accPayrunsV2.vesselUuid, filters.vesselUuid));
    }
    if (filters?.status) {
      conditions.push(eq(accPayrunsV2.status, filters.status));
    }
    return db
      .select()
      .from(accPayrunsV2)
      .where(and(...conditions))
      .orderBy(desc(accPayrunsV2.updatedAt));
  }

  async findByUuid(payrunUuid: string): Promise<AccPayrunV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(accPayrunsV2)
      .where(
        and(
          eq(accPayrunsV2.payrunUuid, payrunUuid),
          eq(accPayrunsV2.isDeleted, false),
        ),
      );
    return results[0];
  }

  async create(
    data: Omit<InsertAccPayrunV2, "payrunUuid">,
  ): Promise<AccPayrunV2> {
    const db = getDb();
    const results = await db
      .insert(accPayrunsV2)
      .values({ ...data, payrunUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async update(
    payrunUuid: string,
    data: Partial<InsertAccPayrunV2>,
  ): Promise<AccPayrunV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(accPayrunsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(accPayrunsV2.payrunUuid, payrunUuid))
      .returning();
    return results[0];
  }

  async softDelete(payrunUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(accPayrunsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(accPayrunsV2.payrunUuid, payrunUuid))
      .returning();
    return results.length > 0;
  }
}
