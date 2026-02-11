import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { admVesselRevisionsV2 } from "../../../../shared/v2/admin/schema";
import type { AdmVesselRevisionV2, InsertAdmVesselRevisionV2 } from "../../../../shared/v2/admin/types";
import { v4 as uuidv4 } from "uuid";

export class VesselRevisionsRepository {
  async findAll(): Promise<AdmVesselRevisionV2[]> {
    const db = getDb();
    return db
      .select()
      .from(admVesselRevisionsV2)
      .where(eq(admVesselRevisionsV2.isDeleted, false))
      .orderBy(desc(admVesselRevisionsV2.createdAt));
  }

  async findById(id: number): Promise<AdmVesselRevisionV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admVesselRevisionsV2)
      .where(and(eq(admVesselRevisionsV2.id, id), eq(admVesselRevisionsV2.isDeleted, false)));
    return results[0];
  }

  async findByUuid(vrUuid: string): Promise<AdmVesselRevisionV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admVesselRevisionsV2)
      .where(and(eq(admVesselRevisionsV2.vrUuid, vrUuid), eq(admVesselRevisionsV2.isDeleted, false)));
    return results[0];
  }

  async findByVesselId(vesselId: string): Promise<AdmVesselRevisionV2[]> {
    const db = getDb();
    return db
      .select()
      .from(admVesselRevisionsV2)
      .where(and(eq(admVesselRevisionsV2.vesselId, vesselId), eq(admVesselRevisionsV2.isDeleted, false)))
      .orderBy(desc(admVesselRevisionsV2.createdAt));
  }

  async create(data: Omit<InsertAdmVesselRevisionV2, "vrUuid">): Promise<AdmVesselRevisionV2> {
    const db = getDb();
    const results = await db
      .insert(admVesselRevisionsV2)
      .values({ ...data, vrUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async updateById(id: number, data: Partial<InsertAdmVesselRevisionV2>): Promise<AdmVesselRevisionV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(admVesselRevisionsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(admVesselRevisionsV2.id, id), eq(admVesselRevisionsV2.isDeleted, false)))
      .returning();
    return results[0];
  }

  async softDeleteById(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(admVesselRevisionsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(admVesselRevisionsV2.id, id), eq(admVesselRevisionsV2.isDeleted, false)))
      .returning();
    return results.length > 0;
  }

  async getNextRevision(vesselId: string): Promise<string> {
    const db = getDb();
    const revisions = await db
      .select()
      .from(admVesselRevisionsV2)
      .where(and(eq(admVesselRevisionsV2.vesselId, vesselId), eq(admVesselRevisionsV2.isDeleted, false)));

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
