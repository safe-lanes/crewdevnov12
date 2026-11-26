import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { rhVesselViolationCommentsV2 } from "../../../../shared/v2/rest-hours/schema";
import type {
  RhVesselViolationCommentV2,
  InsertRhVesselViolationCommentV2,
} from "../../../../shared/v2/rest-hours/types";
import { rhVesselCommentUuid } from "../utils/rhUuid";
import { insertOnNaturalKey } from "../utils/naturalKeyInsert";
import { captureChange } from "../../sync/changeCapture";
import { actorOf, capturedUpdate, inTx, lockByUuid } from "../../sync/capturedWrite";

export class VesselCommentsRepository {
  async findAll(filters?: {
    vesselId?: string;
    monthValue?: string;
  }): Promise<RhVesselViolationCommentV2[]> {
    const db = getDb();
    let conditions = [eq(rhVesselViolationCommentsV2.isDeleted, false)];

    if (filters?.vesselId) {
      conditions.push(eq(rhVesselViolationCommentsV2.vesselId, filters.vesselId));
    }
    if (filters?.monthValue) {
      conditions.push(eq(rhVesselViolationCommentsV2.monthValue, filters.monthValue));
    }

    const results = await db
      .select()
      .from(rhVesselViolationCommentsV2)
      .where(and(...conditions))
      .orderBy(desc(rhVesselViolationCommentsV2.createdAt));

    return results;
  }

  async findByUuid(vesselCommentUuid: string): Promise<RhVesselViolationCommentV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(rhVesselViolationCommentsV2)
      .where(
        and(
          eq(rhVesselViolationCommentsV2.vesselCommentUuid, vesselCommentUuid),
          eq(rhVesselViolationCommentsV2.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(
    data: Omit<InsertRhVesselViolationCommentV2, "vesselCommentUuid">, tx?: any
  ): Promise<RhVesselViolationCommentV2> {
    const uuid = rhVesselCommentUuid(data.vesselId, data.monthValue);
    return inTx(tx, async (db) => {
      const old = await lockByUuid(db, rhVesselViolationCommentsV2, "vesselCommentUuid", uuid);
      // Atomic create-or-update on (vessel_id, month_value); id derived from the key (RH-02).
      const row = await insertOnNaturalKey(db, rhVesselViolationCommentsV2, {
        uuidColumn: "vesselCommentUuid",
        uuid,
        keyColumns: ["vesselId", "monthValue"],
        values: data,
      });
      await captureChange(db, {
        table: rhVesselViolationCommentsV2, rowUuid: row.vesselCommentUuid, oldRow: old ?? null, newRow: row,
        actorUuid: actorOf(data),
      });
      return row;
    });
  }

  async update(
    vesselCommentUuid: string,
    data: Partial<InsertRhVesselViolationCommentV2>, tx?: any
  ): Promise<RhVesselViolationCommentV2 | undefined> {
    return capturedUpdate<RhVesselViolationCommentV2>(
      tx, rhVesselViolationCommentsV2, "vesselCommentUuid", vesselCommentUuid, { ...data, updatedAt: new Date() });
  }

  async softDelete(vesselCommentUuid: string, tx?: any): Promise<boolean> {
    const row = await capturedUpdate(
      tx, rhVesselViolationCommentsV2, "vesselCommentUuid", vesselCommentUuid, { isDeleted: true, updatedAt: new Date() });
    return !!row;
  }
}
