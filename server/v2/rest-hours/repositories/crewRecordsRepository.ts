import { eq, and, desc, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { rhCrewRecordsV2 } from "../../../../shared/v2/rest-hours/schema";
import type {
  RhCrewRecordV2,
  InsertRhCrewRecordV2,
} from "../../../../shared/v2/rest-hours/types";
import { rhCrewMonthRankUuid } from "../utils/rhUuid";
import { insertOnNaturalKey } from "../utils/naturalKeyInsert";
import { captureChange } from "../../sync/changeCapture";
import { actorOf, capturedUpdate, inTx, lockByUuid } from "../../sync/capturedWrite";

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
    const uuid = rhCrewMonthRankUuid(data.vesselId, data.crewMemberId, data.monthValue, data.rank);
    return inTx(tx, async (db) => {
      // The row as it was (it may exist and be updated or revived): needed for the field diff.
      const old = await lockByUuid(db, rhCrewRecordsV2, "rhCrewRecordUuid", uuid);
      // Atomic create-or-update on (vessel_id, crew_member_id, month_value, rank); id derived from the key (RH-02).
      const row = await insertOnNaturalKey(db, rhCrewRecordsV2, {
        uuidColumn: "rhCrewRecordUuid",
        uuid,
        keyColumns: ["vesselId", "crewMemberId", "monthValue", "rank"],
        values: data,
      });
      await captureChange(db, {
        table: rhCrewRecordsV2, rowUuid: row.rhCrewRecordUuid, oldRow: old ?? null, newRow: row,
        actorUuid: actorOf(data),
      });
      return row;
    });
  }

  async update(
    rhCrewRecordUuid: string,
    data: Partial<InsertRhCrewRecordV2>, tx?: any): Promise<RhCrewRecordV2 | undefined> {
    return capturedUpdate<RhCrewRecordV2>(
      tx, rhCrewRecordsV2, "rhCrewRecordUuid", rhCrewRecordUuid, { ...data, updatedAt: new Date() });
  }

  async softDelete(rhCrewRecordUuid: string, tx?: any): Promise<boolean> {
    const row = await capturedUpdate(
      tx, rhCrewRecordsV2, "rhCrewRecordUuid", rhCrewRecordUuid, { isDeleted: true, updatedAt: new Date() });
    return !!row;
  }
}
