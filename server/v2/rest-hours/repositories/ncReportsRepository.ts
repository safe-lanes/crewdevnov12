import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { rhNcReportsV2 } from "../../../../shared/v2/rest-hours/schema";
import type {
  RhNcReportV2,
  InsertRhNcReportV2,
} from "../../../../shared/v2/rest-hours/types";
import { v4 as uuidv4 } from "uuid";
import { ncReportUpdatePatch } from "../services/ncReportWorkflow";
import { captureChange } from "../../sync/changeCapture";
import { inTx } from "../../sync/capturedWrite";

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

  // Each write takes the caller's transaction (outerTx) so a request that writes
  // several rows stays one transaction; without one it opens its own.
  async create(
    data: Omit<InsertRhNcReportV2, "ncReportUuid">,
    outerTx?: any,
  ): Promise<RhNcReportV2> {
    return inTx(outerTx, async (tx: any) => {
      const [row] = await tx
        .insert(rhNcReportsV2)
        .values({
          ...data,
          ncReportUuid: uuidv4(),
        })
        .returning();
      await captureChange(tx, {
        table: rhNcReportsV2, rowUuid: row.ncReportUuid, oldRow: null, newRow: row,
        actorUuid: (data as any).createdByUuid ?? null,
      });
      return row;
    });
  }

  async update(
    ncReportUuid: string,
    data: Partial<InsertRhNcReportV2>,
    outerTx?: any,
  ): Promise<RhNcReportV2 | undefined> {
    return inTx(outerTx, async (tx: any) => {
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
      await captureChange(tx, {
        table: rhNcReportsV2, rowUuid: ncReportUuid, oldRow: current, newRow: updated,
        actorUuid: (data as any).updatedByUuid ?? null,
      });
      return updated;
    });
  }

  async softDelete(ncReportUuid: string, outerTx?: any): Promise<boolean> {
    return inTx(outerTx, async (tx: any) => {
      const [old] = await tx.select().from(rhNcReportsV2)
        .where(eq(rhNcReportsV2.ncReportUuid, ncReportUuid)).for("update");
      const results = await tx
        .update(rhNcReportsV2)
        .set({
          isDeleted: true,
          updatedAt: new Date(),
        })
        .where(eq(rhNcReportsV2.ncReportUuid, ncReportUuid))
        .returning();
      await captureChange(tx, {
        table: rhNcReportsV2, rowUuid: ncReportUuid, oldRow: old ?? null, newRow: results[0], actorUuid: null,
      });
      return results.length > 0;
    });
  }
}
