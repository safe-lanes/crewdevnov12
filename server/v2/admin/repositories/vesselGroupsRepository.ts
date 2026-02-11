import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { admVesselGroupsV2 } from "../../../../shared/v2/admin/schema";
import type { AdmVesselGroupV2, InsertAdmVesselGroupV2 } from "../../../../shared/v2/admin/types";
import { v4 as uuidv4 } from "uuid";

export class VesselGroupsRepository {
  async findAll(): Promise<AdmVesselGroupV2[]> {
    const db = getDb();
    return db
      .select()
      .from(admVesselGroupsV2)
      .where(eq(admVesselGroupsV2.isDeleted, false))
      .orderBy(desc(admVesselGroupsV2.createdAt));
  }

  async findById(id: number): Promise<AdmVesselGroupV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admVesselGroupsV2)
      .where(and(eq(admVesselGroupsV2.id, id), eq(admVesselGroupsV2.isDeleted, false)));
    return results[0];
  }

  async findByUuid(vgUuid: string): Promise<AdmVesselGroupV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admVesselGroupsV2)
      .where(and(eq(admVesselGroupsV2.vgUuid, vgUuid), eq(admVesselGroupsV2.isDeleted, false)));
    return results[0];
  }

  async create(data: Omit<InsertAdmVesselGroupV2, "vgUuid">): Promise<AdmVesselGroupV2> {
    const db = getDb();
    const results = await db
      .insert(admVesselGroupsV2)
      .values({ ...data, vgUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async updateById(id: number, data: Partial<InsertAdmVesselGroupV2>): Promise<AdmVesselGroupV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(admVesselGroupsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(admVesselGroupsV2.id, id), eq(admVesselGroupsV2.isDeleted, false)))
      .returning();
    return results[0];
  }

  async softDeleteById(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(admVesselGroupsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(admVesselGroupsV2.id, id), eq(admVesselGroupsV2.isDeleted, false)))
      .returning();
    return results.length > 0;
  }
}
