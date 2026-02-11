import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { admCompanyTrainingsV2 } from "../../../../shared/v2/admin/schema";
import type { AdmCompanyTrainingV2, InsertAdmCompanyTrainingV2 } from "../../../../shared/v2/admin/types";
import { v4 as uuidv4 } from "uuid";

export class CompanyTrainingsRepository {
  async findAll(): Promise<AdmCompanyTrainingV2[]> {
    const db = getDb();
    return db
      .select()
      .from(admCompanyTrainingsV2)
      .where(eq(admCompanyTrainingsV2.isDeleted, false))
      .orderBy(desc(admCompanyTrainingsV2.createdAt));
  }

  async findById(id: number): Promise<AdmCompanyTrainingV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admCompanyTrainingsV2)
      .where(and(eq(admCompanyTrainingsV2.id, id), eq(admCompanyTrainingsV2.isDeleted, false)));
    return results[0];
  }

  async findByUuid(ctUuid: string): Promise<AdmCompanyTrainingV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admCompanyTrainingsV2)
      .where(and(eq(admCompanyTrainingsV2.ctUuid, ctUuid), eq(admCompanyTrainingsV2.isDeleted, false)));
    return results[0];
  }

  async findByMasterId(masterId: number): Promise<AdmCompanyTrainingV2[]> {
    const db = getDb();
    return db
      .select()
      .from(admCompanyTrainingsV2)
      .where(and(eq(admCompanyTrainingsV2.trainingMasterId, masterId), eq(admCompanyTrainingsV2.isDeleted, false)))
      .orderBy(desc(admCompanyTrainingsV2.createdAt));
  }

  async create(data: Omit<InsertAdmCompanyTrainingV2, "ctUuid">): Promise<AdmCompanyTrainingV2> {
    const db = getDb();
    const results = await db
      .insert(admCompanyTrainingsV2)
      .values({ ...data, ctUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async createFromMaster(masterId: number, trainingLabel: string, companyId: string): Promise<AdmCompanyTrainingV2> {
    const db = getDb();
    const results = await db
      .insert(admCompanyTrainingsV2)
      .values({
        ctUuid: uuidv4(),
        trainingMasterId: masterId,
        trainingLabel,
        companyId,
      })
      .returning();
    return results[0];
  }

  async updateById(id: number, data: Partial<InsertAdmCompanyTrainingV2>): Promise<AdmCompanyTrainingV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(admCompanyTrainingsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(admCompanyTrainingsV2.id, id), eq(admCompanyTrainingsV2.isDeleted, false)))
      .returning();
    return results[0];
  }

  async softDeleteById(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(admCompanyTrainingsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(admCompanyTrainingsV2.id, id), eq(admCompanyTrainingsV2.isDeleted, false)))
      .returning();
    return results.length > 0;
  }

  async deleteByMasterId(masterId: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(admCompanyTrainingsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(admCompanyTrainingsV2.trainingMasterId, masterId), eq(admCompanyTrainingsV2.isDeleted, false)))
      .returning();
    return results.length > 0;
  }

  async reorder(orders: Array<{ id: number; sortOrder: number }>): Promise<void> {
    const db = getDb();
    for (const order of orders) {
      await db
        .update(admCompanyTrainingsV2)
        .set({ sortOrder: order.sortOrder, updatedAt: new Date() })
        .where(eq(admCompanyTrainingsV2.id, order.id));
    }
  }
}
