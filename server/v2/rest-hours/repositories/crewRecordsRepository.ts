import { eq, and, desc, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { rhCrewRecordsV2 } from "../../../../shared/v2/rest-hours/schema";
import type {
  RhCrewRecordV2,
  InsertRhCrewRecordV2,
} from "../../../../shared/v2/rest-hours/types";
import { rhCrewMonthRankUuid } from "../utils/rhUuid";
import { insertOnNaturalKey } from "../utils/naturalKeyInsert";

export class CrewRecordsRepository {
  async findAll(filters?: {
    vesselId?: string;
    vesselIds?: string[];
    crewMemberId?: string;
    monthValue?: string;
    monthValues?: string[];
  }, tx?: any): Promise<RhCrewRecordV2[]> {
    const db = tx ?? getDb();
    let conditions = [eq(rhCrewRecordsV2.isDeleted, false)];

    if (filters?.vesselId) {
      conditions.push(eq(rhCrewRecordsV2.vesselId, filters.vesselId));
    }
    if (filters?.vesselIds && filters.vesselIds.length > 0) {
      conditions.push(inArray(rhCrewRecordsV2.vesselId, filters.vesselIds));
    }
    if (filters?.crewMemberId) {
      conditions.push(eq(rhCrewRecordsV2.crewMemberId, filters.crewMemberId));
    }
    if (filters?.monthValue) {
      conditions.push(eq(rhCrewRecordsV2.monthValue, filters.monthValue));
    }
    if (filters?.monthValues && filters.monthValues.length > 0) {
      conditions.push(inArray(rhCrewRecordsV2.monthValue, filters.monthValues));
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
    data: Omit<InsertRhCrewRecordV2, "rhCrewRecordUuid">, tx?: any): Promise<RhCrewRecordV2> {
    const db = tx ?? getDb();
    // Atomic create-or-update on (vessel_id, crew_member_id, month_value, rank); id derived from the key (RH-02).
    return insertOnNaturalKey(db, rhCrewRecordsV2, {
      uuidColumn: "rhCrewRecordUuid",
      uuid: rhCrewMonthRankUuid(data.vesselId, data.crewMemberId, data.monthValue, data.rank),
      keyColumns: ["vesselId", "crewMemberId", "monthValue", "rank"],
      values: data,
    });
  }

  async update(
    rhCrewRecordUuid: string,
    data: Partial<InsertRhCrewRecordV2>, tx?: any): Promise<RhCrewRecordV2 | undefined> {
    const db = tx ?? getDb();
    const results = await db
      .update(rhCrewRecordsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rhCrewRecordsV2.rhCrewRecordUuid, rhCrewRecordUuid))
      .returning();
    return results[0];
  }

  async softDelete(rhCrewRecordUuid: string, tx?: any): Promise<boolean> {
    const db = tx ?? getDb();
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
