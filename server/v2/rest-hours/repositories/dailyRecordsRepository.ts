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

  // All rank-period records for a crew/vessel/month, ordered chronologically by
  // their applicability window (full-month / null window first). In the common
  // non-promotion case this returns a single record.
  async findAllByKey(
    crewMemberId: string,
    vesselId: string,
    monthYear: string
  ): Promise<RhDailyRecordV2[]> {
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
    return results.sort(
      (a: RhDailyRecordV2, b: RhDailyRecordV2) =>
        (a.applicableFrom ?? '').localeCompare(b.applicableFrom ?? '')
    );
  }

  // Single "active" record for a crew/vessel/month. With no split (the common
  // case) there is exactly one record and this is byte-identical to before. When
  // a promotion has split the month, the latest rank period is returned so legacy
  // single-record callers see the current rank. When `rank` is supplied and a
  // split exists, the record for that specific rank period is returned so each
  // rank row in the UI edits its own window.
  async findByKey(
    crewMemberId: string,
    vesselId: string,
    monthYear: string,
    rank?: string
  ): Promise<RhDailyRecordV2 | undefined> {
    const all = await this.findAllByKey(crewMemberId, vesselId, monthYear);
    if (all.length <= 1) return all[0];
    if (rank) {
      const byRank = all.filter((r: RhDailyRecordV2) => r.rank === rank);
      if (byRank.length > 0) return byRank[byRank.length - 1];
    }
    const fullMonth = all.find((r: RhDailyRecordV2) => !r.applicableFrom && !r.applicableTo);
    if (fullMonth) return fullMonth;
    return all[all.length - 1];
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
