import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { rhVesselRecordsV2 } from "../../../../shared/v2/rest-hours/schema";
import type {
  RhVesselRecordV2,
  InsertRhVesselRecordV2,
} from "../../../../shared/v2/rest-hours/types";
import { rhVesselMonthUuid } from "../utils/rhUuid";
import { insertOnNaturalKey } from "../utils/naturalKeyInsert";

export class VesselRecordsRepository {
  async findAll(filters?: {
    vesselId?: string;
    monthValue?: string;
  }, tx?: any): Promise<RhVesselRecordV2[]> {
    const db = tx ?? getDb();
    let conditions = [eq(rhVesselRecordsV2.isDeleted, false)];

    if (filters?.vesselId) {
      conditions.push(eq(rhVesselRecordsV2.vesselId, filters.vesselId));
    }
    if (filters?.monthValue) {
      conditions.push(eq(rhVesselRecordsV2.monthValue, filters.monthValue));
    }

    const results = await db
      .select()
      .from(rhVesselRecordsV2)
      .where(and(...conditions))
      .orderBy(desc(rhVesselRecordsV2.createdAt));

    return results;
  }

  async findByUuid(rhVesselUuid: string): Promise<RhVesselRecordV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(rhVesselRecordsV2)
      .where(
        and(
          eq(rhVesselRecordsV2.rhVesselUuid, rhVesselUuid),
          eq(rhVesselRecordsV2.isDeleted, false)
        )
      );
    return results[0];
  }

  async findByVesselId(vesselId: string, monthValue?: string): Promise<RhVesselRecordV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(rhVesselRecordsV2)
      .where(
        and(
          eq(rhVesselRecordsV2.vesselId, vesselId),
          eq(rhVesselRecordsV2.isDeleted, false),
          ...(monthValue ? [eq(rhVesselRecordsV2.monthValue, monthValue)] : [])
        )
      )
      .orderBy(desc(rhVesselRecordsV2.createdAt));
    return results[0];
  }

  async create(
    data: Omit<InsertRhVesselRecordV2, "rhVesselUuid">, tx?: any): Promise<RhVesselRecordV2> {
    const db = tx ?? getDb();
    // Atomic create-or-update on (vessel_id, month_value); id derived from the key (RH-02).
    return insertOnNaturalKey(db, rhVesselRecordsV2, {
      uuidColumn: "rhVesselUuid",
      uuid: rhVesselMonthUuid(data.vesselId, data.monthValue),
      keyColumns: ["vesselId", "monthValue"],
      values: data,
    });
  }

  async update(
    rhVesselUuid: string,
    data: Partial<InsertRhVesselRecordV2>, tx?: any): Promise<RhVesselRecordV2 | undefined> {
    const db = tx ?? getDb();
    const results = await db
      .update(rhVesselRecordsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rhVesselRecordsV2.rhVesselUuid, rhVesselUuid))
      .returning();
    return results[0];
  }

  async softDelete(rhVesselUuid: string, tx?: any): Promise<boolean> {
    const db = tx ?? getDb();
    const results = await db
      .update(rhVesselRecordsV2)
      .set({
        isDeleted: true,
        updatedAt: new Date(),
      })
      .where(eq(rhVesselRecordsV2.rhVesselUuid, rhVesselUuid))
      .returning();
    return results.length > 0;
  }
}
