import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { rhNcReportsV2 } from "../../../../shared/v2/rest-hours/schema";
import type {
  RhNcReportV2,
  InsertRhNcReportV2,
} from "../../../../shared/v2/rest-hours/types";
import { v4 as uuidv4 } from "uuid";
import { ncReportUpdatePatch } from "../services/ncReportWorkflow";

export class NcReportsRepository {
  async findAll(filters?: {
    vesselId?: string;
    crewMemberId?: string;
    monthValue?: string;
  }): Promise<RhNcReportV2[]> {
    const db = getDb();
    let conditions = [eq(rhNcReportsV2.isDeleted, false)];

    if (filters?.vesselId) {
      conditions.push(eq(rhNcReportsV2.vesselId, filters.vesselId));
    }
    if (filters?.crewMemberId) {
      conditions.push(eq(rhNcReportsV2.crewMemberId, filters.crewMemberId));
    }
    if (filters?.monthValue) {
      conditions.push(eq(rhNcReportsV2.monthValue, filters.monthValue));
    }

    const results = await db
      .select()
      .from(rhNcReportsV2)
      .where(and(...conditions))
      .orderBy(desc(rhNcReportsV2.createdAt));

    return results;
  }

  async findByUuid(ncReportUuid: string): Promise<RhNcReportV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(rhNcReportsV2)
      .where(
        and(
          eq(rhNcReportsV2.ncReportUuid, ncReportUuid),
          eq(rhNcReportsV2.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(
    data: Omit<InsertRhNcReportV2, "ncReportUuid">
  ): Promise<RhNcReportV2> {
    const db = getDb();
    const results = await db
      .insert(rhNcReportsV2)
      .values({
        ...data,
        ncReportUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async update(
    ncReportUuid: string,
    data: Partial<InsertRhNcReportV2>
  ): Promise<RhNcReportV2 | undefined> {
    const db = getDb();
    return db.transaction(async (tx: any) => {
      const identity = and(
        eq(rhNcReportsV2.ncReportUuid, ncReportUuid),
        eq(rhNcReportsV2.isDeleted, false),
      );
      // Serialize saves and submissions of this exact report. A prior service
      // read cannot protect against a submission committed by another tab.
      const [current] = await tx.select().from(rhNcReportsV2).where(identity).for("update");
      if (!current) return undefined;
      const patch = ncReportUpdatePatch(current, data);
      const [updated] = await tx.update(rhNcReportsV2)
        .set({ ...patch, updatedAt: new Date() })
        .where(identity)
        .returning();
      return updated;
    });
  }

  async softDelete(ncReportUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(rhNcReportsV2)
      .set({
        isDeleted: true,
        updatedAt: new Date(),
      })
      .where(eq(rhNcReportsV2.ncReportUuid, ncReportUuid))
      .returning();
    return results.length > 0;
  }
}
