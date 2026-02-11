import { eq, and, desc, isNull } from "drizzle-orm";
import { getDb } from "../../db";
import { admRankGroupsV2 } from "../../../../shared/v2/admin/schema";
import type { AdmRankGroupV2, InsertAdmRankGroupV2 } from "../../../../shared/v2/admin/types";
import { v4 as uuidv4 } from "uuid";

export class RankGroupsRepository {
  async findAll(): Promise<AdmRankGroupV2[]> {
    const db = getDb();
    return db
      .select()
      .from(admRankGroupsV2)
      .where(eq(admRankGroupsV2.isDeleted, false))
      .orderBy(desc(admRankGroupsV2.createdAt));
  }

  async findByFormId(formId: number, includeArchived: boolean = true): Promise<AdmRankGroupV2[]> {
    const db = getDb();
    const conditions = [
      eq(admRankGroupsV2.formId, formId),
      eq(admRankGroupsV2.isDeleted, false),
    ];
    if (!includeArchived) {
      conditions.push(isNull(admRankGroupsV2.archivedAt));
    }
    return db
      .select()
      .from(admRankGroupsV2)
      .where(and(...conditions))
      .orderBy(desc(admRankGroupsV2.createdAt));
  }

  async findById(id: number): Promise<AdmRankGroupV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admRankGroupsV2)
      .where(and(eq(admRankGroupsV2.id, id), eq(admRankGroupsV2.isDeleted, false)));
    return results[0];
  }

  async findByUuid(rgUuid: string): Promise<AdmRankGroupV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admRankGroupsV2)
      .where(and(eq(admRankGroupsV2.rgUuid, rgUuid), eq(admRankGroupsV2.isDeleted, false)));
    return results[0];
  }

  async create(data: Omit<InsertAdmRankGroupV2, "rgUuid">): Promise<AdmRankGroupV2> {
    const db = getDb();
    const results = await db
      .insert(admRankGroupsV2)
      .values({ ...data, rgUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async updateById(id: number, data: Partial<InsertAdmRankGroupV2>): Promise<AdmRankGroupV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(admRankGroupsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(admRankGroupsV2.id, id), eq(admRankGroupsV2.isDeleted, false)))
      .returning();
    return results[0];
  }

  async update(rgUuid: string, data: Partial<InsertAdmRankGroupV2>): Promise<AdmRankGroupV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(admRankGroupsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(admRankGroupsV2.rgUuid, rgUuid), eq(admRankGroupsV2.isDeleted, false)))
      .returning();
    return results[0];
  }

  async archiveById(id: number): Promise<AdmRankGroupV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(admRankGroupsV2)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(admRankGroupsV2.id, id), eq(admRankGroupsV2.isDeleted, false)))
      .returning();
    return results[0];
  }

  async archive(rgUuid: string): Promise<AdmRankGroupV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(admRankGroupsV2)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(admRankGroupsV2.rgUuid, rgUuid), eq(admRankGroupsV2.isDeleted, false)))
      .returning();
    return results[0];
  }

  async unarchiveById(id: number): Promise<AdmRankGroupV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(admRankGroupsV2)
      .set({ archivedAt: null, updatedAt: new Date() })
      .where(and(eq(admRankGroupsV2.id, id), eq(admRankGroupsV2.isDeleted, false)))
      .returning();
    return results[0];
  }

  async unarchive(rgUuid: string): Promise<AdmRankGroupV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(admRankGroupsV2)
      .set({ archivedAt: null, updatedAt: new Date() })
      .where(and(eq(admRankGroupsV2.rgUuid, rgUuid), eq(admRankGroupsV2.isDeleted, false)))
      .returning();
    return results[0];
  }

  async softDeleteById(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(admRankGroupsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(admRankGroupsV2.id, id), eq(admRankGroupsV2.isDeleted, false)))
      .returning();
    return results.length > 0;
  }

  async softDelete(rgUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(admRankGroupsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(admRankGroupsV2.rgUuid, rgUuid), eq(admRankGroupsV2.isDeleted, false)))
      .returning();
    return results.length > 0;
  }
}
