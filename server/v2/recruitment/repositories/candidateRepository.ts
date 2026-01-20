import { eq, and } from "drizzle-orm";
import { getDb } from "../../db";
import {
  recruitmentCandidatesV2,
  candVesselTypesApplied,
} from "../../../../shared/v2/recruitment/schema";
import type {
  CandidateV2,
  InsertCandidateV2,
  VesselTypesApplied,
  InsertVesselTypesApplied,
} from "../../../../shared/v2/recruitment/types";

export class CandidateRepository {
  async findAll(): Promise<CandidateV2[]> {
    const db = getDb();
    return db
      .select()
      .from(recruitmentCandidatesV2)
      .where(eq(recruitmentCandidatesV2.isDeleted, false));
  }

  async findById(id: number): Promise<CandidateV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(recruitmentCandidatesV2)
      .where(
        and(
          eq(recruitmentCandidatesV2.id, id),
          eq(recruitmentCandidatesV2.isDeleted, false)
        )
      );
    return results[0];
  }

  async findByUuid(recCanUuid: string): Promise<CandidateV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(recruitmentCandidatesV2)
      .where(
        and(
          eq(recruitmentCandidatesV2.recCanUuid, recCanUuid),
          eq(recruitmentCandidatesV2.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(data: InsertCandidateV2): Promise<CandidateV2> {
    const db = getDb();
    const results = await db
      .insert(recruitmentCandidatesV2)
      .values(data)
      .returning();
    return results[0];
  }

  async update(
    id: number,
    data: Partial<InsertCandidateV2>
  ): Promise<CandidateV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(recruitmentCandidatesV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(recruitmentCandidatesV2.id, id))
      .returning();
    return results[0];
  }

  async softDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(recruitmentCandidatesV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(recruitmentCandidatesV2.id, id))
      .returning();
    return results.length > 0;
  }
}

export class VesselTypesAppliedRepository {
  async findByCandidateUuid(recCanUuid: string): Promise<VesselTypesApplied[]> {
    const db = getDb();
    return db
      .select()
      .from(candVesselTypesApplied)
      .where(
        and(
          eq(candVesselTypesApplied.recCanUuid, recCanUuid),
          eq(candVesselTypesApplied.isDeleted, false)
        )
      );
  }

  async create(data: InsertVesselTypesApplied): Promise<VesselTypesApplied> {
    const db = getDb();
    const results = await db
      .insert(candVesselTypesApplied)
      .values(data)
      .returning();
    return results[0];
  }

  async softDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(candVesselTypesApplied)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(candVesselTypesApplied.id, id))
      .returning();
    return results.length > 0;
  }
}

export const candidateRepository = new CandidateRepository();
export const vesselTypesAppliedRepository = new VesselTypesAppliedRepository();
