import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { admCompanyRanksV2 } from "../../../../shared/v2/admin/schema";
import type { AdmCompanyRankV2, InsertAdmCompanyRankV2 } from "../../../../shared/v2/admin/types";
import { v4 as uuidv4 } from "uuid";

export class CompanyRanksRepository {
  async findAll(): Promise<AdmCompanyRankV2[]> {
    const db = getDb();
    return db
      .select()
      .from(admCompanyRanksV2)
      .where(eq(admCompanyRanksV2.isDeleted, false))
      .orderBy(desc(admCompanyRanksV2.createdAt));
  }

  async findById(id: string): Promise<AdmCompanyRankV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admCompanyRanksV2)
      .where(and(eq(admCompanyRanksV2.id, id), eq(admCompanyRanksV2.isDeleted, false)));
    return results[0];
  }

  async findByUuid(crUuid: string): Promise<AdmCompanyRankV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admCompanyRanksV2)
      .where(and(eq(admCompanyRanksV2.crUuid, crUuid), eq(admCompanyRanksV2.isDeleted, false)));
    return results[0];
  }

  async findByName(rankName: string): Promise<AdmCompanyRankV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admCompanyRanksV2)
      .where(and(eq(admCompanyRanksV2.rank, rankName), eq(admCompanyRanksV2.isDeleted, false)));
    return results[0];
  }

  async create(data: Omit<InsertAdmCompanyRankV2, "crUuid">): Promise<AdmCompanyRankV2> {
    const db = getDb();
    const results = await db
      .insert(admCompanyRanksV2)
      .values({ ...data, crUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async updateById(id: string, data: Partial<InsertAdmCompanyRankV2>): Promise<AdmCompanyRankV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(admCompanyRanksV2)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(admCompanyRanksV2.id, id), eq(admCompanyRanksV2.isDeleted, false)))
      .returning();
    return results[0];
  }

  async softDeleteById(id: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(admCompanyRanksV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(admCompanyRanksV2.id, id), eq(admCompanyRanksV2.isDeleted, false)))
      .returning();
    return results.length > 0;
  }

  async saveAll(ranks: InsertAdmCompanyRankV2[]): Promise<AdmCompanyRankV2[]> {
    const db = getDb();
    await db.delete(admCompanyRanksV2);
    const ranksWithUuids = ranks.map(rank => ({
      ...rank,
      crUuid: rank.crUuid || uuidv4(),
    }));
    const results = await db
      .insert(admCompanyRanksV2)
      .values(ranksWithUuids)
      .returning();
    return results;
  }
}
