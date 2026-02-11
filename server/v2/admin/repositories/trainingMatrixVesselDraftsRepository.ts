import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { admTrainingMatrixVesselDraftsV2 } from "../../../../shared/v2/admin/schema";
import type { AdmTrainingMatrixVesselDraftV2, InsertAdmTrainingMatrixVesselDraftV2 } from "../../../../shared/v2/admin/types";
import { v4 as uuidv4 } from "uuid";

export class TrainingMatrixVesselDraftsRepository {
  async findAll(): Promise<AdmTrainingMatrixVesselDraftV2[]> {
    const db = getDb();
    return db
      .select()
      .from(admTrainingMatrixVesselDraftsV2)
      .where(eq(admTrainingMatrixVesselDraftsV2.isDeleted, false))
      .orderBy(desc(admTrainingMatrixVesselDraftsV2.createdAt));
  }

  async findById(id: number): Promise<AdmTrainingMatrixVesselDraftV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admTrainingMatrixVesselDraftsV2)
      .where(and(eq(admTrainingMatrixVesselDraftsV2.id, id), eq(admTrainingMatrixVesselDraftsV2.isDeleted, false)));
    return results[0];
  }

  async findByUuid(tmvdUuid: string): Promise<AdmTrainingMatrixVesselDraftV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admTrainingMatrixVesselDraftsV2)
      .where(and(eq(admTrainingMatrixVesselDraftsV2.tmvdUuid, tmvdUuid), eq(admTrainingMatrixVesselDraftsV2.isDeleted, false)));
    return results[0];
  }

  async findByVesselId(vesselId: string): Promise<AdmTrainingMatrixVesselDraftV2[]> {
    const db = getDb();
    return db
      .select()
      .from(admTrainingMatrixVesselDraftsV2)
      .where(and(eq(admTrainingMatrixVesselDraftsV2.vesselId, vesselId), eq(admTrainingMatrixVesselDraftsV2.isDeleted, false)))
      .orderBy(desc(admTrainingMatrixVesselDraftsV2.createdAt));
  }

  async create(data: Omit<InsertAdmTrainingMatrixVesselDraftV2, "tmvdUuid">): Promise<AdmTrainingMatrixVesselDraftV2> {
    const db = getDb();
    const results = await db
      .insert(admTrainingMatrixVesselDraftsV2)
      .values({ ...data, tmvdUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async updateById(id: number, data: Partial<InsertAdmTrainingMatrixVesselDraftV2>): Promise<AdmTrainingMatrixVesselDraftV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(admTrainingMatrixVesselDraftsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(admTrainingMatrixVesselDraftsV2.id, id), eq(admTrainingMatrixVesselDraftsV2.isDeleted, false)))
      .returning();
    return results[0];
  }

  async softDeleteById(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(admTrainingMatrixVesselDraftsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(admTrainingMatrixVesselDraftsV2.id, id), eq(admTrainingMatrixVesselDraftsV2.isDeleted, false)))
      .returning();
    return results.length > 0;
  }

  async hardDeleteById(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .delete(admTrainingMatrixVesselDraftsV2)
      .where(eq(admTrainingMatrixVesselDraftsV2.id, id))
      .returning();
    return results.length > 0;
  }
}
