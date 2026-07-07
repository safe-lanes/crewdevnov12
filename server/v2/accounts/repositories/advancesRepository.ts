import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { accAdvancesV2 } from "../../../../shared/v2/accounts/schema";
import type {
  AccAdvanceV2,
  InsertAccAdvanceV2,
} from "../../../../shared/v2/accounts/types";
import { v4 as uuidv4 } from "uuid";

export class AdvancesRepository {
  async findAll(filters?: {
    crewUuid?: string;
    status?: string;
  }): Promise<AccAdvanceV2[]> {
    const db = getDb();
    const conditions = [eq(accAdvancesV2.isDeleted, false)];
    if (filters?.crewUuid) {
      conditions.push(eq(accAdvancesV2.crewUuid, filters.crewUuid));
    }
    if (filters?.status) {
      conditions.push(eq(accAdvancesV2.status, filters.status));
    }
    return db
      .select()
      .from(accAdvancesV2)
      .where(and(...conditions))
      .orderBy(desc(accAdvancesV2.createdAt));
  }

  async findByUuid(advanceUuid: string): Promise<AccAdvanceV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(accAdvancesV2)
      .where(
        and(
          eq(accAdvancesV2.advanceUuid, advanceUuid),
          eq(accAdvancesV2.isDeleted, false),
        ),
      );
    return results[0];
  }

  async create(
    data: Omit<InsertAccAdvanceV2, "advanceUuid">,
  ): Promise<AccAdvanceV2> {
    const db = getDb();
    const results = await db
      .insert(accAdvancesV2)
      .values({ ...data, advanceUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async update(
    advanceUuid: string,
    data: Partial<InsertAccAdvanceV2>,
  ): Promise<AccAdvanceV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(accAdvancesV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(accAdvancesV2.advanceUuid, advanceUuid))
      .returning();
    return results[0];
  }

  async softDelete(advanceUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(accAdvancesV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(accAdvancesV2.advanceUuid, advanceUuid))
      .returning();
    return results.length > 0;
  }
}
