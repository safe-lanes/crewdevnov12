import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { admFormVersionsV2 } from "../../../../shared/v2/admin/schema";
import type { AdmFormVersionV2, InsertAdmFormVersionV2 } from "../../../../shared/v2/admin/types";
import { v4 as uuidv4 } from "uuid";

export class FormVersionsRepository {
  async findByFormId(formId: number, rankGroupId?: number): Promise<AdmFormVersionV2[]> {
    const db = getDb();
    const conditions = [
      eq(admFormVersionsV2.formId, formId),
      eq(admFormVersionsV2.isDeleted, false),
    ];
    if (rankGroupId !== undefined) {
      conditions.push(eq(admFormVersionsV2.rankGroupId, rankGroupId));
    }
    return db
      .select()
      .from(admFormVersionsV2)
      .where(and(...conditions))
      .orderBy(desc(admFormVersionsV2.createdAt));
  }

  async findById(id: number): Promise<AdmFormVersionV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admFormVersionsV2)
      .where(and(eq(admFormVersionsV2.id, id), eq(admFormVersionsV2.isDeleted, false)));
    return results[0];
  }

  async findByUuid(fvUuid: string): Promise<AdmFormVersionV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admFormVersionsV2)
      .where(and(eq(admFormVersionsV2.fvUuid, fvUuid), eq(admFormVersionsV2.isDeleted, false)));
    return results[0];
  }

  async create(data: Omit<InsertAdmFormVersionV2, "fvUuid">): Promise<AdmFormVersionV2> {
    const db = getDb();
    const results = await db
      .insert(admFormVersionsV2)
      .values({ ...data, fvUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async updateById(id: number, data: Partial<InsertAdmFormVersionV2>): Promise<AdmFormVersionV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(admFormVersionsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(admFormVersionsV2.id, id), eq(admFormVersionsV2.isDeleted, false)))
      .returning();
    return results[0];
  }

  async update(fvUuid: string, data: Partial<InsertAdmFormVersionV2>): Promise<AdmFormVersionV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(admFormVersionsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(admFormVersionsV2.fvUuid, fvUuid), eq(admFormVersionsV2.isDeleted, false)))
      .returning();
    return results[0];
  }

  async softDeleteById(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(admFormVersionsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(admFormVersionsV2.id, id), eq(admFormVersionsV2.isDeleted, false)))
      .returning();
    return results.length > 0;
  }

  async findLatestReleasedByRankGroupId(rankGroupId: number): Promise<AdmFormVersionV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admFormVersionsV2)
      .where(and(
        eq(admFormVersionsV2.rankGroupId, rankGroupId),
        eq(admFormVersionsV2.status, 'released'),
        eq(admFormVersionsV2.isDeleted, false),
      ))
      .orderBy(desc(admFormVersionsV2.createdAt))
      .limit(1);
    return results[0];
  }

  async softDelete(fvUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(admFormVersionsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(admFormVersionsV2.fvUuid, fvUuid), eq(admFormVersionsV2.isDeleted, false)))
      .returning();
    return results.length > 0;
  }
}
