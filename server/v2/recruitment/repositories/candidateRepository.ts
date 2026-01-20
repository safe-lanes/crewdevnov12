import { eq, and } from "drizzle-orm";
import { getDb } from "../../db";
import {
  recruitmentCandidates,
  candVesselTypesApplied,
} from "../../../../shared/v2/recruitment/schema";
import type {
  RecruitmentCandidate,
  InsertCandidate,
  CandVesselTypeApplied,
  InsertVesselTypeApplied,
} from "../../../../shared/v2/recruitment/types";

export class CandidateRepository {
  async findAll(): Promise<RecruitmentCandidate[]> {
    const db = getDb();
    return db
      .select()
      .from(recruitmentCandidates)
      .where(eq(recruitmentCandidates.isDeleted, false));
  }

  async findById(id: string): Promise<RecruitmentCandidate | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(recruitmentCandidates)
      .where(
        and(
          eq(recruitmentCandidates.id, id),
          eq(recruitmentCandidates.isDeleted, false)
        )
      );
    return results[0];
  }

  async findByUuid(recCanUuid: string): Promise<RecruitmentCandidate | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(recruitmentCandidates)
      .where(
        and(
          eq(recruitmentCandidates.recCanUuid, recCanUuid),
          eq(recruitmentCandidates.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(data: InsertCandidate): Promise<RecruitmentCandidate> {
    const db = getDb();
    const results = await db
      .insert(recruitmentCandidates)
      .values(data)
      .returning();
    return results[0];
  }

  async update(
    id: string,
    data: Partial<InsertCandidate>
  ): Promise<RecruitmentCandidate | undefined> {
    const db = getDb();
    const results = await db
      .update(recruitmentCandidates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(recruitmentCandidates.id, id))
      .returning();
    return results[0];
  }

  async updateByUuid(
    recCanUuid: string,
    data: Partial<InsertCandidate>
  ): Promise<RecruitmentCandidate | undefined> {
    const db = getDb();
    const results = await db
      .update(recruitmentCandidates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(recruitmentCandidates.recCanUuid, recCanUuid))
      .returning();
    return results[0];
  }

  async softDelete(id: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(recruitmentCandidates)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(recruitmentCandidates.id, id))
      .returning();
    return results.length > 0;
  }

  async softDeleteByUuid(recCanUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(recruitmentCandidates)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(recruitmentCandidates.recCanUuid, recCanUuid))
      .returning();
    return results.length > 0;
  }
}

export class VesselTypesAppliedRepository {
  async findByCandidateUuid(recCanUuid: string): Promise<CandVesselTypeApplied[]> {
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

  async create(data: InsertVesselTypeApplied): Promise<CandVesselTypeApplied> {
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

  async deleteByCandidateUuid(recCanUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(candVesselTypesApplied)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(candVesselTypesApplied.recCanUuid, recCanUuid))
      .returning();
    return results.length > 0;
  }
}

export const candidateRepository = new CandidateRepository();
export const vesselTypesAppliedRepository = new VesselTypesAppliedRepository();
