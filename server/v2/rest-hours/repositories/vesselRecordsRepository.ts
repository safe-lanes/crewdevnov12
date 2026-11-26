import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { rhVesselRecordsV2 } from "../../../../shared/v2/rest-hours/schema";
import type {
  RhVesselRecordV2,
  InsertRhVesselRecordV2,
} from "../../../../shared/v2/rest-hours/types";
import { rhVesselMonthUuid } from "../utils/rhUuid";
import { insertOnNaturalKey } from "../utils/naturalKeyInsert";
import { captureChange } from "../../sync/changeCapture";

// Runs fn on the caller's transaction, or opens one, so a write and its sync
// capture always commit or roll back together.
async function inTx<T>(tx: any, fn: (db: any) => Promise<T>): Promise<T> {
  return tx ? fn(tx) : getDb().transaction(fn);
}

async function lockRow(db: any, rhVesselUuid: string): Promise<RhVesselRecordV2 | undefined> {
  const [row] = await db.select().from(rhVesselRecordsV2)
    .where(eq(rhVesselRecordsV2.rhVesselUuid, rhVesselUuid)).for("update");
  return row;
}

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
    const rhVesselUuid = rhVesselMonthUuid(data.vesselId, data.monthValue);
    return inTx(tx, async (db) => {
      // The row as it was (it may exist and be updated or revived): needed for the field diff.
      const old = await lockRow(db, rhVesselUuid);
      // Atomic create-or-update on (vessel_id, month_value); id derived from the key (RH-02).
      const row = await insertOnNaturalKey(db, rhVesselRecordsV2, {
        uuidColumn: "rhVesselUuid",
        uuid: rhVesselUuid,
        keyColumns: ["vesselId", "monthValue"],
        values: data,
      });
      await captureChange(db, {
        table: rhVesselRecordsV2, rowUuid: row.rhVesselUuid, oldRow: old ?? null, newRow: row,
        actorUuid: (data as any).updatedByUuid ?? (data as any).createdByUuid ?? null,
      });
      return row;
    });
  }

  async update(
    rhVesselUuid: string,
    data: Partial<InsertRhVesselRecordV2>, tx?: any): Promise<RhVesselRecordV2 | undefined> {
    return inTx(tx, async (db) => {
      const old = await lockRow(db, rhVesselUuid);
      const results = await db
        .update(rhVesselRecordsV2)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(rhVesselRecordsV2.rhVesselUuid, rhVesselUuid))
        .returning();
      await captureChange(db, {
        table: rhVesselRecordsV2, rowUuid: rhVesselUuid, oldRow: old ?? null, newRow: results[0],
        actorUuid: (data as any).updatedByUuid ?? null,
      });
      return results[0];
    });
  }

  async softDelete(rhVesselUuid: string, tx?: any): Promise<boolean> {
    return inTx(tx, async (db) => {
      const old = await lockRow(db, rhVesselUuid);
      const results = await db
        .update(rhVesselRecordsV2)
        .set({
          isDeleted: true,
          updatedAt: new Date(),
        })
        .where(eq(rhVesselRecordsV2.rhVesselUuid, rhVesselUuid))
        .returning();
      await captureChange(db, {
        table: rhVesselRecordsV2, rowUuid: rhVesselUuid, oldRow: old ?? null, newRow: results[0], actorUuid: null,
      });
      return results.length > 0;
    });
  }
}
