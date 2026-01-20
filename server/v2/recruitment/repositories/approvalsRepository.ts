import { eq, and } from "drizzle-orm";
import { getDb } from "../../db";
import {
  candApprovals,
  candSuitability,
  candSuitabilityVesselTypes,
  candSuitabilityFleetGroups,
  candRecruitmentDecision,
  candAssignedGroups,
} from "../../../../shared/v2/recruitment/schema";
import type {
  CandApproval,
  InsertApproval,
  CandSuitability,
  InsertSuitability,
  CandSuitabilityVesselType,
  InsertSuitabilityVesselType,
  CandSuitabilityFleetGroup,
  InsertSuitabilityFleetGroup,
  CandRecruitmentDecision,
  InsertRecruitmentDecision,
  CandAssignedGroup,
  InsertAssignedGroup,
} from "../../../../shared/v2/recruitment/types";

export class ApprovalsRepository {
  async findByCandidateUuid(recCanUuid: string): Promise<CandApproval[]> {
    const db = getDb();
    return db.select().from(candApprovals).where(
      and(eq(candApprovals.recCanUuid, recCanUuid), eq(candApprovals.isDeleted, false))
    );
  }

  async findByUuid(approvalUuid: string): Promise<CandApproval | undefined> {
    const db = getDb();
    const results = await db.select().from(candApprovals).where(
      and(eq(candApprovals.approvalUuid, approvalUuid), eq(candApprovals.isDeleted, false))
    );
    return results[0];
  }

  async create(data: InsertApproval): Promise<CandApproval> {
    const db = getDb();
    const results = await db.insert(candApprovals).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertApproval>): Promise<CandApproval | undefined> {
    const db = getDb();
    const results = await db.update(candApprovals).set({ ...data, updatedAt: new Date() }).where(eq(candApprovals.id, id)).returning();
    return results[0];
  }

  async softDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db.update(candApprovals).set({ isDeleted: true, updatedAt: new Date() }).where(eq(candApprovals.id, id)).returning();
    return results.length > 0;
  }
}

export class SuitabilityRepository {
  async findByCandidateUuid(recCanUuid: string): Promise<CandSuitability | undefined> {
    const db = getDb();
    const results = await db.select().from(candSuitability).where(
      and(eq(candSuitability.recCanUuid, recCanUuid), eq(candSuitability.isDeleted, false))
    );
    return results[0];
  }

  async create(data: InsertSuitability): Promise<CandSuitability> {
    const db = getDb();
    const results = await db.insert(candSuitability).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertSuitability>): Promise<CandSuitability | undefined> {
    const db = getDb();
    const results = await db.update(candSuitability).set({ ...data, updatedAt: new Date() }).where(eq(candSuitability.id, id)).returning();
    return results[0];
  }

  async upsert(recCanUuid: string, data: Partial<InsertSuitability>): Promise<CandSuitability> {
    const existing = await this.findByCandidateUuid(recCanUuid);
    if (existing) {
      return (await this.update(existing.id, data))!;
    }
    return this.create({ ...data, recCanUuid } as InsertSuitability);
  }

  async findVesselTypes(suitUuid: string): Promise<CandSuitabilityVesselType[]> {
    const db = getDb();
    return db.select().from(candSuitabilityVesselTypes).where(
      and(eq(candSuitabilityVesselTypes.suitUuid, suitUuid), eq(candSuitabilityVesselTypes.isDeleted, false))
    );
  }

  async createVesselType(data: InsertSuitabilityVesselType): Promise<CandSuitabilityVesselType> {
    const db = getDb();
    const results = await db.insert(candSuitabilityVesselTypes).values(data).returning();
    return results[0];
  }

  async deleteVesselTypes(suitUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db.update(candSuitabilityVesselTypes).set({ isDeleted: true, updatedAt: new Date() }).where(eq(candSuitabilityVesselTypes.suitUuid, suitUuid)).returning();
    return results.length > 0;
  }

  async findFleetGroups(suitUuid: string): Promise<CandSuitabilityFleetGroup[]> {
    const db = getDb();
    return db.select().from(candSuitabilityFleetGroups).where(
      and(eq(candSuitabilityFleetGroups.suitUuid, suitUuid), eq(candSuitabilityFleetGroups.isDeleted, false))
    );
  }

  async createFleetGroup(data: InsertSuitabilityFleetGroup): Promise<CandSuitabilityFleetGroup> {
    const db = getDb();
    const results = await db.insert(candSuitabilityFleetGroups).values(data).returning();
    return results[0];
  }

  async deleteFleetGroups(suitUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db.update(candSuitabilityFleetGroups).set({ isDeleted: true, updatedAt: new Date() }).where(eq(candSuitabilityFleetGroups.suitUuid, suitUuid)).returning();
    return results.length > 0;
  }
}

export class RecruitmentDecisionRepository {
  async findByCandidateUuid(recCanUuid: string): Promise<CandRecruitmentDecision | undefined> {
    const db = getDb();
    const results = await db.select().from(candRecruitmentDecision).where(
      and(eq(candRecruitmentDecision.recCanUuid, recCanUuid), eq(candRecruitmentDecision.isDeleted, false))
    );
    return results[0];
  }

  async create(data: InsertRecruitmentDecision): Promise<CandRecruitmentDecision> {
    const db = getDb();
    const results = await db.insert(candRecruitmentDecision).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertRecruitmentDecision>): Promise<CandRecruitmentDecision | undefined> {
    const db = getDb();
    const results = await db.update(candRecruitmentDecision).set({ ...data, updatedAt: new Date() }).where(eq(candRecruitmentDecision.id, id)).returning();
    return results[0];
  }

  async upsert(recCanUuid: string, data: Partial<InsertRecruitmentDecision>): Promise<CandRecruitmentDecision> {
    const existing = await this.findByCandidateUuid(recCanUuid);
    if (existing) {
      return (await this.update(existing.id, data))!;
    }
    return this.create({ ...data, recCanUuid } as InsertRecruitmentDecision);
  }

  async findAssignedGroups(decisionUuid: string): Promise<CandAssignedGroup[]> {
    const db = getDb();
    return db.select().from(candAssignedGroups).where(
      and(eq(candAssignedGroups.decisionUuid, decisionUuid), eq(candAssignedGroups.isDeleted, false))
    );
  }

  async createAssignedGroup(data: InsertAssignedGroup): Promise<CandAssignedGroup> {
    const db = getDb();
    const results = await db.insert(candAssignedGroups).values(data).returning();
    return results[0];
  }

  async deleteAssignedGroups(decisionUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db.update(candAssignedGroups).set({ isDeleted: true, updatedAt: new Date() }).where(eq(candAssignedGroups.decisionUuid, decisionUuid)).returning();
    return results.length > 0;
  }
}

export const approvalsRepository = new ApprovalsRepository();
export const suitabilityRepository = new SuitabilityRepository();
export const recruitmentDecisionRepository = new RecruitmentDecisionRepository();
