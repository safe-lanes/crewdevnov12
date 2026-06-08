import { eq, and, asc } from "drizzle-orm";
import { getDb } from "../../db";
import { testCasesV2 } from "../../../../shared/v2/test-cases/schema";
import type {
  TestCaseV2,
  InsertTestCaseV2,
} from "../../../../shared/v2/test-cases/schema";
import { v4 as uuidv4 } from "uuid";

export class TestCasesRepository {
  async findAll(filters?: { module?: string }): Promise<TestCaseV2[]> {
    const db = getDb();
    const conditions = [eq(testCasesV2.isDeleted, false)];
    if (filters?.module) {
      conditions.push(eq(testCasesV2.module, filters.module));
    }
    return db
      .select()
      .from(testCasesV2)
      .where(and(...conditions))
      .orderBy(asc(testCasesV2.module), asc(testCasesV2.sortOrder), asc(testCasesV2.id));
  }

  async findByUuid(tcUuid: string): Promise<TestCaseV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(testCasesV2)
      .where(and(eq(testCasesV2.tcUuid, tcUuid), eq(testCasesV2.isDeleted, false)));
    return results[0];
  }

  async create(data: InsertTestCaseV2): Promise<TestCaseV2> {
    const db = getDb();
    const results = await db
      .insert(testCasesV2)
      .values({ ...data, tcUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async update(
    tcUuid: string,
    data: Partial<InsertTestCaseV2>,
  ): Promise<TestCaseV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(testCasesV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(testCasesV2.tcUuid, tcUuid))
      .returning();
    return results[0];
  }

  async softDelete(tcUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(testCasesV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(testCasesV2.tcUuid, tcUuid))
      .returning();
    return results.length > 0;
  }
}
