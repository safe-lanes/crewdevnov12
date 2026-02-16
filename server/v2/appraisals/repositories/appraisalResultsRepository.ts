import { eq, and, inArray, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { appraisalResultsV2 } from "../../../../shared/v2/appraisals/schema";
import type { AppraisalResultV2, InsertAppraisalResultV2 } from "../../../../shared/v2/appraisals/types";
import { v4 as uuidv4 } from "uuid";

export class AppraisalResultsRepository {
  async findAll(): Promise<AppraisalResultV2[]> {
    const db = getDb();
    return db
      .select()
      .from(appraisalResultsV2)
      .where(eq(appraisalResultsV2.isDeleted, false))
      .orderBy(desc(appraisalResultsV2.createdAt));
  }

  async findById(id: number): Promise<AppraisalResultV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(appraisalResultsV2)
      .where(and(eq(appraisalResultsV2.id, id), eq(appraisalResultsV2.isDeleted, false)));
    return results[0];
  }

  async findByAppraisalUuid(uuid: string): Promise<AppraisalResultV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(appraisalResultsV2)
      .where(and(eq(appraisalResultsV2.appraisalUuid, uuid), eq(appraisalResultsV2.isDeleted, false)));
    return results[0];
  }

  async findByCrewMemberId(crewMemberId: string): Promise<AppraisalResultV2[]> {
    const db = getDb();
    return db
      .select()
      .from(appraisalResultsV2)
      .where(and(eq(appraisalResultsV2.crewMemberId, crewMemberId), eq(appraisalResultsV2.isDeleted, false)))
      .orderBy(desc(appraisalResultsV2.createdAt));
  }

  async create(data: Omit<InsertAppraisalResultV2, "appraisalUuid">): Promise<AppraisalResultV2> {
    const db = getDb();
    const results = await db
      .insert(appraisalResultsV2)
      .values({ ...data, appraisalUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async createWithUuid(data: InsertAppraisalResultV2): Promise<AppraisalResultV2> {
    const db = getDb();
    const results = await db
      .insert(appraisalResultsV2)
      .values(data)
      .returning();
    return results[0];
  }

  async updateById(id: number, data: Partial<InsertAppraisalResultV2>): Promise<AppraisalResultV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(appraisalResultsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(appraisalResultsV2.id, id), eq(appraisalResultsV2.isDeleted, false)))
      .returning();
    return results[0];
  }

  async updateByAppraisalUuid(uuid: string, data: Partial<InsertAppraisalResultV2>): Promise<AppraisalResultV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(appraisalResultsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(appraisalResultsV2.appraisalUuid, uuid), eq(appraisalResultsV2.isDeleted, false)))
      .returning();
    return results[0];
  }

  async softDeleteById(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(appraisalResultsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(appraisalResultsV2.id, id), eq(appraisalResultsV2.isDeleted, false)))
      .returning();
    return results.length > 0;
  }
}
