import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { rhCrewRecordsV2 } from "../../../../shared/v2/rest-hours/schema";
import type {
  RhCrewRecordV2,
  InsertRhCrewRecordV2,
} from "../../../../shared/v2/rest-hours/types";
import { v4 as uuidv4 } from "uuid";

export class CrewRecordsRepository {
  async findAll(filters?: {
    vesselId?: string;
    crewMemberId?: string;
    monthValue?: string;
  }): Promise<RhCrewRecordV2[]> {
    const db = getDb();
    let conditions = [eq(rhCrewRecordsV2.isDeleted, false)];

    if (filters?.vesselId) {
      conditions.push(eq(rhCrewRecordsV2.vesselId, filters.vesselId));
    }
    if (filters?.crewMemberId) {
      conditions.push(eq(rhCrewRecordsV2.crewMemberId, filters.crewMemberId));
    }
    if (filters?.monthValue) {
      conditions.push(eq(rhCrewRecordsV2.monthValue, filters.monthValue));
    }

    const results = await db
      .select()
      .from(rhCrewRecordsV2)
      .where(and(...conditions))
      .orderBy(desc(rhCrewRecordsV2.createdAt));

    return results;
  }

  async findByUuid(rhCrewRecordUuid: string): Promise<RhCrewRecordV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(rhCrewRecordsV2)
      .where(
        and(
          eq(rhCrewRecordsV2.rhCrewRecordUuid, rhCrewRecordUuid),
          eq(rhCrewRecordsV2.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(
    data: Omit<InsertRhCrewRecordV2, "rhCrewRecordUuid">
  ): Promise<RhCrewRecordV2> {
    const db = getDb();
    const results = await db
      .insert(rhCrewRecordsV2)
      .values({
        ...data,
        rhCrewRecordUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async update(
    rhCrewRecordUuid: string,
    data: Partial<InsertRhCrewRecordV2>
  ): Promise<RhCrewRecordV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(rhCrewRecordsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rhCrewRecordsV2.rhCrewRecordUuid, rhCrewRecordUuid))
      .returning();
    return results[0];
  }

  async softDelete(rhCrewRecordUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(rhCrewRecordsV2)
      .set({
        isDeleted: true,
        updatedAt: new Date(),
      })
      .where(eq(rhCrewRecordsV2.rhCrewRecordUuid, rhCrewRecordUuid))
      .returning();
    return results.length > 0;
  }
}
