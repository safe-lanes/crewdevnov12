import { eq, and, asc } from "drizzle-orm";
import { getDb } from "../../db";
import { accPayrunEntriesV2 } from "../../../../shared/v2/accounts/schema";
import type {
  AccPayrunEntryV2,
  InsertAccPayrunEntryV2,
} from "../../../../shared/v2/accounts/types";
import { v4 as uuidv4 } from "uuid";

export class PayrunEntriesRepository {
  async findByPayrun(payrunUuid: string): Promise<AccPayrunEntryV2[]> {
    const db = getDb();
    return db
      .select()
      .from(accPayrunEntriesV2)
      .where(
        and(
          eq(accPayrunEntriesV2.payrunUuid, payrunUuid),
          eq(accPayrunEntriesV2.isDeleted, false),
        ),
      )
      .orderBy(asc(accPayrunEntriesV2.sortOrder));
  }

  async findByUuid(
    payrunEntryUuid: string,
  ): Promise<AccPayrunEntryV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(accPayrunEntriesV2)
      .where(
        and(
          eq(accPayrunEntriesV2.payrunEntryUuid, payrunEntryUuid),
          eq(accPayrunEntriesV2.isDeleted, false),
        ),
      );
    return results[0];
  }

  async create(
    data: Omit<InsertAccPayrunEntryV2, "payrunEntryUuid">,
  ): Promise<AccPayrunEntryV2> {
    const db = getDb();
    const results = await db
      .insert(accPayrunEntriesV2)
      .values({ ...data, payrunEntryUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async update(
    payrunEntryUuid: string,
    data: Partial<InsertAccPayrunEntryV2>,
  ): Promise<AccPayrunEntryV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(accPayrunEntriesV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(accPayrunEntriesV2.payrunEntryUuid, payrunEntryUuid))
      .returning();
    return results[0];
  }

  async softDelete(payrunEntryUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(accPayrunEntriesV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(accPayrunEntriesV2.payrunEntryUuid, payrunEntryUuid))
      .returning();
    return results.length > 0;
  }

  async softDeleteByPayrun(payrunUuid: string): Promise<void> {
    const db = getDb();
    await db
      .update(accPayrunEntriesV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(
        and(
          eq(accPayrunEntriesV2.payrunUuid, payrunUuid),
          eq(accPayrunEntriesV2.isDeleted, false),
        ),
      );
  }
}
