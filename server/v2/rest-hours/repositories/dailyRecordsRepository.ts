import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { rhDailyRecordsV2 } from "../../../../shared/v2/rest-hours/schema";
import type {
  RhDailyRecordV2,
  InsertRhDailyRecordV2,
} from "../../../../shared/v2/rest-hours/types";
import { v4 as uuidv4 } from "uuid";

export class DailyRecordsRepository {
  async findAll(filters?: {
    vesselId?: string;
    crewMemberId?: string;
    monthYear?: string;
  }): Promise<RhDailyRecordV2[]> {
    const db = getDb();
    let conditions = [eq(rhDailyRecordsV2.isDeleted, false)];

    if (filters?.vesselId) {
      conditions.push(eq(rhDailyRecordsV2.vesselId, filters.vesselId));
    }
    if (filters?.crewMemberId) {
      conditions.push(eq(rhDailyRecordsV2.crewMemberId, filters.crewMemberId));
    }
    if (filters?.monthYear) {
      conditions.push(eq(rhDailyRecordsV2.monthYear, filters.monthYear));
    }

    const results = await db
      .select()
      .from(rhDailyRecordsV2)
      .where(and(...conditions))
      .orderBy(desc(rhDailyRecordsV2.createdAt));

    return results;
  }

  async findByUuid(rhDailyUuid: string): Promise<RhDailyRecordV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(rhDailyRecordsV2)
      .where(
        and(
          eq(rhDailyRecordsV2.rhDailyUuid, rhDailyUuid),
          eq(rhDailyRecordsV2.isDeleted, false)
        )
      );
    return results[0];
  }

  async findByKey(
    crewMemberId: string,
    vesselId: string,
    monthYear: string
  ): Promise<RhDailyRecordV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(rhDailyRecordsV2)
      .where(
        and(
          eq(rhDailyRecordsV2.crewMemberId, crewMemberId),
          eq(rhDailyRecordsV2.vesselId, vesselId),
          eq(rhDailyRecordsV2.monthYear, monthYear),
          eq(rhDailyRecordsV2.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(
    data: Omit<InsertRhDailyRecordV2, "rhDailyUuid">
  ): Promise<RhDailyRecordV2> {
    const db = getDb();
    const results = await db
      .insert(rhDailyRecordsV2)
      .values({
        ...data,
        rhDailyUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async update(
    rhDailyUuid: string,
    data: Partial<InsertRhDailyRecordV2>
  ): Promise<RhDailyRecordV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(rhDailyRecordsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rhDailyRecordsV2.rhDailyUuid, rhDailyUuid))
      .returning();
    return results[0];
  }

  async softDelete(rhDailyUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(rhDailyRecordsV2)
      .set({
        isDeleted: true,
        updatedAt: new Date(),
      })
      .where(eq(rhDailyRecordsV2.rhDailyUuid, rhDailyUuid))
      .returning();
    return results.length > 0;
  }
}
