import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { admTrainingMatrixVesselRevisionsV2 } from "../../../../shared/v2/admin/schema";
import type { AdmTrainingMatrixVesselRevisionV2, InsertAdmTrainingMatrixVesselRevisionV2 } from "../../../../shared/v2/admin/types";
import { v4 as uuidv4 } from "uuid";

export class TrainingMatrixVesselRevisionsRepository {
  async findAll(): Promise<AdmTrainingMatrixVesselRevisionV2[]> {
    const db = getDb();
    return db
      .select()
      .from(admTrainingMatrixVesselRevisionsV2)
      .where(eq(admTrainingMatrixVesselRevisionsV2.isDeleted, false))
      .orderBy(desc(admTrainingMatrixVesselRevisionsV2.createdAt));
  }

  async findById(id: number): Promise<AdmTrainingMatrixVesselRevisionV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admTrainingMatrixVesselRevisionsV2)
      .where(and(eq(admTrainingMatrixVesselRevisionsV2.id, id), eq(admTrainingMatrixVesselRevisionsV2.isDeleted, false)));
    return results[0];
  }

  async findByUuid(tmvrUuid: string): Promise<AdmTrainingMatrixVesselRevisionV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admTrainingMatrixVesselRevisionsV2)
      .where(and(eq(admTrainingMatrixVesselRevisionsV2.tmvrUuid, tmvrUuid), eq(admTrainingMatrixVesselRevisionsV2.isDeleted, false)));
    return results[0];
  }

  async findByVesselId(vesselId: string): Promise<AdmTrainingMatrixVesselRevisionV2[]> {
    const db = getDb();
    return db
      .select()
      .from(admTrainingMatrixVesselRevisionsV2)
      .where(and(eq(admTrainingMatrixVesselRevisionsV2.vesselId, vesselId), eq(admTrainingMatrixVesselRevisionsV2.isDeleted, false)))
      .orderBy(desc(admTrainingMatrixVesselRevisionsV2.createdAt));
  }

  async create(data: Omit<InsertAdmTrainingMatrixVesselRevisionV2, "tmvrUuid">): Promise<AdmTrainingMatrixVesselRevisionV2> {
    const db = getDb();
    const results = await db
      .insert(admTrainingMatrixVesselRevisionsV2)
      .values({ ...data, tmvrUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async updateById(id: number, data: Partial<InsertAdmTrainingMatrixVesselRevisionV2>): Promise<AdmTrainingMatrixVesselRevisionV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(admTrainingMatrixVesselRevisionsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(admTrainingMatrixVesselRevisionsV2.id, id), eq(admTrainingMatrixVesselRevisionsV2.isDeleted, false)))
      .returning();
    return results[0];
  }

  async softDeleteById(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(admTrainingMatrixVesselRevisionsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(admTrainingMatrixVesselRevisionsV2.id, id), eq(admTrainingMatrixVesselRevisionsV2.isDeleted, false)))
      .returning();
    return results.length > 0;
  }

  async getNextRevision(vesselId: string): Promise<string> {
    const db = getDb();
    const revisions = await db
      .select()
      .from(admTrainingMatrixVesselRevisionsV2)
      .where(and(eq(admTrainingMatrixVesselRevisionsV2.vesselId, vesselId), eq(admTrainingMatrixVesselRevisionsV2.isDeleted, false)));

    if (revisions.length === 0) {
      return "R0";
    }

    let maxNum = -1;
    for (const rev of revisions) {
      const match = rev.revision.match(/^R(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }

    return `R${maxNum + 1}`;
  }
}
