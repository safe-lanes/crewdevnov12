import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { rhVesselRecordsV2 } from "../../../../shared/v2/rest-hours/schema";
import type {
  RhVesselRecordV2,
  InsertRhVesselRecordV2,
} from "../../../../shared/v2/rest-hours/types";
import { v4 as uuidv4 } from "uuid";

export class VesselRecordsRepository {
  async findAll(filters?: {
    vesselId?: string;
    monthValue?: string;
  }): Promise<RhVesselRecordV2[]> {
    const db = getDb();
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

  async findByVesselId(vesselId: string): Promise<RhVesselRecordV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(rhVesselRecordsV2)
      .where(
        and(
          eq(rhVesselRecordsV2.vesselId, vesselId),
          eq(rhVesselRecordsV2.isDeleted, false)
        )
      )
      .orderBy(desc(rhVesselRecordsV2.createdAt));
    return results[0];
  }

  async create(
    data: Omit<InsertRhVesselRecordV2, "rhVesselUuid">
  ): Promise<RhVesselRecordV2> {
    const db = getDb();
    const results = await db
      .insert(rhVesselRecordsV2)
      .values({
        ...data,
        rhVesselUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async update(
    rhVesselUuid: string,
    data: Partial<InsertRhVesselRecordV2>
  ): Promise<RhVesselRecordV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(rhVesselRecordsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rhVesselRecordsV2.rhVesselUuid, rhVesselUuid))
      .returning();
    return results[0];
  }

  async softDelete(rhVesselUuid: string): Promise<boolean> {
    const db = getDb();
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
