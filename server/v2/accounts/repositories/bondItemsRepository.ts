import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { accBondItemsV2 } from "../../../../shared/v2/accounts/schema";
import type {
  AccBondItemV2,
  InsertAccBondItemV2,
} from "../../../../shared/v2/accounts/types";
import { v4 as uuidv4 } from "uuid";

export class BondItemsRepository {
  async findAll(filters?: {
    crewUuid?: string;
    status?: string;
  }): Promise<AccBondItemV2[]> {
    const db = getDb();
    const conditions = [eq(accBondItemsV2.isDeleted, false)];
    if (filters?.crewUuid) {
      conditions.push(eq(accBondItemsV2.crewUuid, filters.crewUuid));
    }
    if (filters?.status) {
      conditions.push(eq(accBondItemsV2.status, filters.status));
    }
    return db
      .select()
      .from(accBondItemsV2)
      .where(and(...conditions))
      .orderBy(desc(accBondItemsV2.createdAt));
  }

  async findByUuid(bondItemUuid: string): Promise<AccBondItemV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(accBondItemsV2)
      .where(
        and(
          eq(accBondItemsV2.bondItemUuid, bondItemUuid),
          eq(accBondItemsV2.isDeleted, false),
        ),
      );
    return results[0];
  }

  async create(
    data: Omit<InsertAccBondItemV2, "bondItemUuid">,
  ): Promise<AccBondItemV2> {
    const db = getDb();
    const results = await db
      .insert(accBondItemsV2)
      .values({ ...data, bondItemUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async update(
    bondItemUuid: string,
    data: Partial<InsertAccBondItemV2>,
  ): Promise<AccBondItemV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(accBondItemsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(accBondItemsV2.bondItemUuid, bondItemUuid))
      .returning();
    return results[0];
  }

  async softDelete(bondItemUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(accBondItemsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(accBondItemsV2.bondItemUuid, bondItemUuid))
      .returning();
    return results.length > 0;
  }
}
