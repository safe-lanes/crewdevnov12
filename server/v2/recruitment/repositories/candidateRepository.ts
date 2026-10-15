import { eq, and, asc, type SQL } from "drizzle-orm";
import { getDb } from "../../db";
import { lockRecruitmentNumbering, nextRecruitmentFileNumber } from "../services/candidateNumbering";
import {
  recruitmentCandidatesV2,
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
      .from(recruitmentCandidatesV2)
      .where(eq(recruitmentCandidatesV2.isDeleted, false));
  }

  async findById(id: number): Promise<RecruitmentCandidate | undefined> {
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

  async findByUuid(recCanUuid: string): Promise<RecruitmentCandidate | undefined> {
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

  async create(data: InsertCandidate): Promise<RecruitmentCandidate> {
    const db = getDb();
    if (data.fileNo || data.screeningDate) {
      return db.transaction(async (tx: any) => {
        await lockRecruitmentNumbering(tx);
        const fileNo = await nextRecruitmentFileNumber(tx);
        const [candidate] = await tx.insert(recruitmentCandidatesV2).values({ ...data, fileNo }).returning();
        return candidate;
      });
    }
    const results = await db
      .insert(recruitmentCandidatesV2)
      .values(data)
      .returning();
    return results[0];
  }

  async update(
    id: number,
    data: Partial<InsertCandidate>
  ): Promise<RecruitmentCandidate | undefined> {
    return this.updateWithSubmissionFields(eq(recruitmentCandidatesV2.id, id), data);
  }

  async updateByUuid(
    recCanUuid: string,
    data: Partial<InsertCandidate>
  ): Promise<RecruitmentCandidate | undefined> {
    return this.updateWithSubmissionFields(eq(recruitmentCandidatesV2.recCanUuid, recCanUuid), data);
  }

  private async updateWithSubmissionFields(
    condition: SQL,
    data: Partial<InsertCandidate>
  ): Promise<RecruitmentCandidate | undefined> {
    const db = getDb();
    return db.transaction(async (tx: any) => {
      const requestsNumber = Boolean(data.fileNo || data.screeningDate);
      // Acquire in the same order for every writer: numbering lock, then row lock.
      if (requestsNumber) await lockRecruitmentNumbering(tx);
      const [existing] = await tx.select().from(recruitmentCandidatesV2).where(condition).for("update");
      if (!existing) return undefined;
      const changes = { ...data, updatedAt: new Date() };
      if (existing.fileNo?.startsWith("R-")) {
        changes.fileNo = existing.fileNo;
      } else if (requestsNumber) {
        // Ignore stale/proposed browser numbers and allocate at the write boundary.
        changes.fileNo = await nextRecruitmentFileNumber(tx);
      } else {
        delete changes.fileNo;
      }
      if (existing.screeningDate) changes.screeningDate = existing.screeningDate;
      const [candidate] = await tx.update(recruitmentCandidatesV2).set(changes).where(condition).returning();
      return candidate;
    });
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

  async softDeleteByUuid(recCanUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(recruitmentCandidatesV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(recruitmentCandidatesV2.recCanUuid, recCanUuid))
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
      )
      .orderBy(asc(candVesselTypesApplied.sortOrder), asc(candVesselTypesApplied.createdAt));
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
