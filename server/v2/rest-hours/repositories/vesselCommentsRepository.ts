import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { rhVesselViolationCommentsV2 } from "../../../../shared/v2/rest-hours/schema";
import type {
  RhVesselViolationCommentV2,
  InsertRhVesselViolationCommentV2,
} from "../../../../shared/v2/rest-hours/types";
import { rhVesselCommentUuid } from "../utils/rhUuid";
import { insertOnNaturalKey } from "../utils/naturalKeyInsert";

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
    data: Omit<InsertRhVesselViolationCommentV2, "vesselCommentUuid">
  ): Promise<RhVesselViolationCommentV2> {
    const db = getDb();
    // Atomic create-or-update on (vessel_id, month_value); id derived from the key (RH-02).
    return insertOnNaturalKey(db, rhVesselViolationCommentsV2, {
      uuidColumn: "vesselCommentUuid",
      uuid: rhVesselCommentUuid(data.vesselId, data.monthValue),
      keyColumns: ["vesselId", "monthValue"],
      values: data,
    });
  }

  async update(
    vesselCommentUuid: string,
    data: Partial<InsertRhVesselViolationCommentV2>
  ): Promise<RhVesselViolationCommentV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(rhVesselViolationCommentsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rhVesselViolationCommentsV2.vesselCommentUuid, vesselCommentUuid))
      .returning();
    return results[0];
  }

  async softDelete(vesselCommentUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(rhVesselViolationCommentsV2)
      .set({
        isDeleted: true,
        updatedAt: new Date(),
      })
      .where(eq(rhVesselViolationCommentsV2.vesselCommentUuid, vesselCommentUuid))
      .returning();
    return results.length > 0;
  }
}
