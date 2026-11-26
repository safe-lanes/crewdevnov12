import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { rhOfficeViolationCommentsV2 } from "../../../../shared/v2/rest-hours/schema";
import type {
  RhOfficeViolationCommentV2,
  InsertRhOfficeViolationCommentV2,
} from "../../../../shared/v2/rest-hours/types";
import { rhOfficeCommentUuid } from "../utils/rhUuid";
import { insertOnNaturalKey } from "../utils/naturalKeyInsert";
import { captureChange } from "../../sync/changeCapture";
import { actorOf, capturedUpdate, inTx, lockByUuid } from "../../sync/capturedWrite";

export class OfficeCommentsRepository {
  async findAll(filters?: {
    vesselId?: string;
    monthValue?: string;
  }): Promise<RhOfficeViolationCommentV2[]> {
    const db = getDb();
    let conditions = [eq(rhOfficeViolationCommentsV2.isDeleted, false)];

    if (filters?.vesselId) {
      conditions.push(eq(rhOfficeViolationCommentsV2.vesselId, filters.vesselId));
    }
    if (filters?.monthValue) {
      conditions.push(eq(rhOfficeViolationCommentsV2.monthValue, filters.monthValue));
    }

    const results = await db
      .select()
      .from(rhOfficeViolationCommentsV2)
      .where(and(...conditions))
      .orderBy(desc(rhOfficeViolationCommentsV2.createdAt));

    return results;
  }

  async findByUuid(officeCommentUuid: string): Promise<RhOfficeViolationCommentV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(rhOfficeViolationCommentsV2)
      .where(
        and(
          eq(rhOfficeViolationCommentsV2.officeCommentUuid, officeCommentUuid),
          eq(rhOfficeViolationCommentsV2.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(
    data: Omit<InsertRhOfficeViolationCommentV2, "officeCommentUuid">, tx?: any
  ): Promise<RhOfficeViolationCommentV2> {
    const uuid = rhOfficeCommentUuid(data.vesselId, data.monthValue);
    return inTx(tx, async (db) => {
      const old = await lockByUuid(db, rhOfficeViolationCommentsV2, "officeCommentUuid", uuid);
      // Atomic create-or-update on (vessel_id, month_value); id derived from the key (RH-02).
      const row = await insertOnNaturalKey(db, rhOfficeViolationCommentsV2, {
        uuidColumn: "officeCommentUuid",
        uuid,
        keyColumns: ["vesselId", "monthValue"],
        values: data,
      });
      await captureChange(db, {
        table: rhOfficeViolationCommentsV2, rowUuid: row.officeCommentUuid, oldRow: old ?? null, newRow: row,
        actorUuid: actorOf(data),
      });
      return row;
    });
  }

  async update(
    officeCommentUuid: string,
    data: Partial<InsertRhOfficeViolationCommentV2>, tx?: any
  ): Promise<RhOfficeViolationCommentV2 | undefined> {
    return capturedUpdate<RhOfficeViolationCommentV2>(
      tx, rhOfficeViolationCommentsV2, "officeCommentUuid", officeCommentUuid, { ...data, updatedAt: new Date() });
  }

  async softDelete(officeCommentUuid: string, tx?: any): Promise<boolean> {
    const row = await capturedUpdate(
      tx, rhOfficeViolationCommentsV2, "officeCommentUuid", officeCommentUuid, { isDeleted: true, updatedAt: new Date() });
    return !!row;
  }
}
