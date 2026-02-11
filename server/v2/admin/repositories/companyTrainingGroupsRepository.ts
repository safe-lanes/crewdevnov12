import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { admCompanyTrainingGroupsV2 } from "../../../../shared/v2/admin/schema";
import type { AdmCompanyTrainingGroupV2, InsertAdmCompanyTrainingGroupV2 } from "../../../../shared/v2/admin/types";
import { v4 as uuidv4 } from "uuid";

export class CompanyTrainingGroupsRepository {
  async findAll(): Promise<AdmCompanyTrainingGroupV2[]> {
    const db = getDb();
    return db
      .select()
      .from(admCompanyTrainingGroupsV2)
      .where(eq(admCompanyTrainingGroupsV2.isDeleted, false))
      .orderBy(desc(admCompanyTrainingGroupsV2.createdAt));
  }

  async findById(id: number): Promise<AdmCompanyTrainingGroupV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admCompanyTrainingGroupsV2)
      .where(and(eq(admCompanyTrainingGroupsV2.id, id), eq(admCompanyTrainingGroupsV2.isDeleted, false)));
    return results[0];
  }

  async findByUuid(ctgUuid: string): Promise<AdmCompanyTrainingGroupV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admCompanyTrainingGroupsV2)
      .where(and(eq(admCompanyTrainingGroupsV2.ctgUuid, ctgUuid), eq(admCompanyTrainingGroupsV2.isDeleted, false)));
    return results[0];
  }

  async findByCode(code: string): Promise<AdmCompanyTrainingGroupV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admCompanyTrainingGroupsV2)
      .where(and(eq(admCompanyTrainingGroupsV2.code, code), eq(admCompanyTrainingGroupsV2.isDeleted, false)));
    return results[0];
  }

  async create(data: Omit<InsertAdmCompanyTrainingGroupV2, "ctgUuid">): Promise<AdmCompanyTrainingGroupV2> {
    const db = getDb();
    const results = await db
      .insert(admCompanyTrainingGroupsV2)
      .values({ ...data, ctgUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async updateById(id: number, data: Partial<InsertAdmCompanyTrainingGroupV2>): Promise<AdmCompanyTrainingGroupV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(admCompanyTrainingGroupsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(admCompanyTrainingGroupsV2.id, id), eq(admCompanyTrainingGroupsV2.isDeleted, false)))
      .returning();
    return results[0];
  }

  async updateByCode(code: string, data: Partial<InsertAdmCompanyTrainingGroupV2>): Promise<AdmCompanyTrainingGroupV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(admCompanyTrainingGroupsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(admCompanyTrainingGroupsV2.code, code), eq(admCompanyTrainingGroupsV2.isDeleted, false)))
      .returning();
    return results[0];
  }

  async softDeleteById(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(admCompanyTrainingGroupsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(admCompanyTrainingGroupsV2.id, id), eq(admCompanyTrainingGroupsV2.isDeleted, false)))
      .returning();
    return results.length > 0;
  }
}
