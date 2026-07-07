import { eq, and, asc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db";
import { accCtmV2, accCtmLinesV2 } from "../../../../shared/v2/accounts/schema";
import type {
  AccCtmV2,
  InsertAccCtmV2,
  AccCtmLineV2,
  InsertAccCtmLineV2,
} from "../../../../shared/v2/accounts/types";

/** CTM (cash-to-master) header + lines per vessel-month. */
export class CtmRepository {
  async findByVesselPeriod(
    vesselUuid: string,
    period: string,
  ): Promise<AccCtmV2 | undefined> {
    const db = getDb();
    const rows = await db
      .select()
      .from(accCtmV2)
      .where(
        and(
          eq(accCtmV2.vesselUuid, vesselUuid),
          eq(accCtmV2.period, period),
          eq(accCtmV2.isDeleted, false),
        ),
      );
    return rows[0];
  }

  async findByUuid(ctmUuid: string): Promise<AccCtmV2 | undefined> {
    const db = getDb();
    const rows = await db
      .select()
      .from(accCtmV2)
      .where(and(eq(accCtmV2.ctmUuid, ctmUuid), eq(accCtmV2.isDeleted, false)));
    return rows[0];
  }

  async create(data: Omit<InsertAccCtmV2, "ctmUuid">): Promise<AccCtmV2> {
    const db = getDb();
    const rows = await db
      .insert(accCtmV2)
      .values({ ...data, ctmUuid: uuidv4() })
      .returning();
    return rows[0];
  }

  async update(
    ctmUuid: string,
    data: Partial<InsertAccCtmV2>,
  ): Promise<AccCtmV2 | undefined> {
    const db = getDb();
    const rows = await db
      .update(accCtmV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(accCtmV2.ctmUuid, ctmUuid))
      .returning();
    return rows[0];
  }

  async findLines(ctmUuid: string): Promise<AccCtmLineV2[]> {
    const db = getDb();
    return db
      .select()
      .from(accCtmLinesV2)
      .where(
        and(
          eq(accCtmLinesV2.ctmUuid, ctmUuid),
          eq(accCtmLinesV2.isDeleted, false),
        ),
      )
      .orderBy(asc(accCtmLinesV2.lineDate), asc(accCtmLinesV2.id));
  }

  async findLineByUuid(
    ctmLineUuid: string,
  ): Promise<AccCtmLineV2 | undefined> {
    const db = getDb();
    const rows = await db
      .select()
      .from(accCtmLinesV2)
      .where(
        and(
          eq(accCtmLinesV2.ctmLineUuid, ctmLineUuid),
          eq(accCtmLinesV2.isDeleted, false),
        ),
      );
    return rows[0];
  }

  async createLine(
    data: Omit<InsertAccCtmLineV2, "ctmLineUuid">,
  ): Promise<AccCtmLineV2> {
    const db = getDb();
    const rows = await db
      .insert(accCtmLinesV2)
      .values({ ...data, ctmLineUuid: uuidv4() })
      .returning();
    return rows[0];
  }

  async updateLine(
    ctmLineUuid: string,
    data: Partial<InsertAccCtmLineV2>,
  ): Promise<AccCtmLineV2 | undefined> {
    const db = getDb();
    const rows = await db
      .update(accCtmLinesV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(accCtmLinesV2.ctmLineUuid, ctmLineUuid))
      .returning();
    return rows[0];
  }

  async softDeleteLine(ctmLineUuid: string): Promise<boolean> {
    const db = getDb();
    const rows = await db
      .update(accCtmLinesV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(accCtmLinesV2.ctmLineUuid, ctmLineUuid))
      .returning();
    return rows.length > 0;
  }
}
