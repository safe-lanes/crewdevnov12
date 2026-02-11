import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { admVesselDraftsV2 } from "../../../../shared/v2/admin/schema";
import type { AdmVesselDraftV2, InsertAdmVesselDraftV2 } from "../../../../shared/v2/admin/types";
import { v4 as uuidv4 } from "uuid";

export class VesselDraftsRepository {
  async findAll(): Promise<AdmVesselDraftV2[]> {
    const db = getDb();
    return db
      .select()
      .from(admVesselDraftsV2)
      .where(eq(admVesselDraftsV2.isDeleted, false))
      .orderBy(desc(admVesselDraftsV2.createdAt));
  }

  async findById(id: number): Promise<AdmVesselDraftV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admVesselDraftsV2)
      .where(and(eq(admVesselDraftsV2.id, id), eq(admVesselDraftsV2.isDeleted, false)));
    return results[0];
  }

  async findByUuid(vdUuid: string): Promise<AdmVesselDraftV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admVesselDraftsV2)
      .where(and(eq(admVesselDraftsV2.vdUuid, vdUuid), eq(admVesselDraftsV2.isDeleted, false)));
    return results[0];
  }

  async findByVesselId(vesselId: string): Promise<AdmVesselDraftV2[]> {
    const db = getDb();
    return db
      .select()
      .from(admVesselDraftsV2)
      .where(and(eq(admVesselDraftsV2.vesselId, vesselId), eq(admVesselDraftsV2.isDeleted, false)))
      .orderBy(desc(admVesselDraftsV2.createdAt));
  }

  async create(data: Omit<InsertAdmVesselDraftV2, "vdUuid">): Promise<AdmVesselDraftV2> {
    const db = getDb();
    const results = await db
      .insert(admVesselDraftsV2)
      .values({ ...data, vdUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async updateById(id: number, data: Partial<InsertAdmVesselDraftV2>): Promise<AdmVesselDraftV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(admVesselDraftsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(admVesselDraftsV2.id, id), eq(admVesselDraftsV2.isDeleted, false)))
      .returning();
    return results[0];
  }

  async softDeleteById(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(admVesselDraftsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(admVesselDraftsV2.id, id), eq(admVesselDraftsV2.isDeleted, false)))
      .returning();
    return results.length > 0;
  }

  async hardDeleteById(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .delete(admVesselDraftsV2)
      .where(eq(admVesselDraftsV2.id, id))
      .returning();
    return results.length > 0;
  }
}
