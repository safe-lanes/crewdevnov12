import { eq, and, inArray, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { appraisalResultsV2 } from "../../../../shared/v2/appraisals/schema";
import type { AppraisalResultV2, InsertAppraisalResultV2 } from "../../../../shared/v2/appraisals/types";
import { v4 as uuidv4 } from "uuid";

// A transaction (tx) or the default connection.
type Executor = any;

export class AppraisalResultsRepository {
  async findAll(): Promise<AppraisalResultV2[]> {
    const db = getDb();
    return db
      .select()
      .from(appraisalResultsV2)
      .where(eq(appraisalResultsV2.isDeleted, false))
      .orderBy(desc(appraisalResultsV2.createdAt));
  }

  async findByAppraisalUuid(uuid: string): Promise<AppraisalResultV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(appraisalResultsV2)
      .where(and(eq(appraisalResultsV2.appraisalUuid, uuid), eq(appraisalResultsV2.isDeleted, false)));
    return results[0];
  }

  // Soft-deleted rows included: the appraisal_uuid unique constraint covers
  // them too, so a create must know a deleted appraisal already owns the id.
  async findByAppraisalUuidIncludingDeleted(uuid: string, executor: Executor = getDb()): Promise<AppraisalResultV2 | undefined> {
    const results = await executor
      .select()
      .from(appraisalResultsV2)
      .where(eq(appraisalResultsV2.appraisalUuid, uuid));
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

  // Historic data inconsistency: some appraisals store crew_member_id as the
  // crew's emp_no, others as the crew_uuid. Callers that already know all the
  // candidate identifiers for a crew member can use this method to fetch every
  // matching appraisal in one query. Pass only portable keys (emp_no,
  // crew_uuid), never a serial id: serial ids differ between ship and shore.
  async findByCrewMemberIds(crewMemberIds: string[]): Promise<AppraisalResultV2[]> {
    if (crewMemberIds.length === 0) return [];
    const db = getDb();
    return db
      .select()
      .from(appraisalResultsV2)
      .where(and(
        inArray(appraisalResultsV2.crewMemberId, crewMemberIds),
        eq(appraisalResultsV2.isDeleted, false),
      ))
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

  // Idempotent create: returns undefined when a row with this appraisal_uuid
  // already exists (a retried or replayed create), and inserts nothing.
  async createIfAbsent(data: InsertAppraisalResultV2, executor: Executor = getDb()): Promise<AppraisalResultV2 | undefined> {
    const results = await executor
      .insert(appraisalResultsV2)
      .values(data)
      .onConflictDoNothing({ target: appraisalResultsV2.appraisalUuid })
      .returning();
    return results[0];
  }

  async updateByAppraisalUuid(
    uuid: string,
    data: Partial<InsertAppraisalResultV2>,
    executor: Executor = getDb(),
  ): Promise<AppraisalResultV2 | undefined> {
    const results = await executor
      .update(appraisalResultsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(appraisalResultsV2.appraisalUuid, uuid), eq(appraisalResultsV2.isDeleted, false)))
      .returning();
    return results[0];
  }

  async softDeleteByAppraisalUuid(uuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(appraisalResultsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(appraisalResultsV2.appraisalUuid, uuid), eq(appraisalResultsV2.isDeleted, false)))
      .returning();
    return results.length > 0;
  }
}
