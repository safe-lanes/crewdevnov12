import { eq, and, asc } from "drizzle-orm";
import { getDb } from "../../db";
import {
  accAllotmentsV2,
  accWageLedgerV2,
} from "../../../../shared/v2/accounts/schema";
import type {
  AccAllotmentV2,
  InsertAccAllotmentV2,
} from "../../../../shared/v2/accounts/types";
import { v4 as uuidv4 } from "uuid";

function withCurrentStatus(
  record: AccAllotmentV2,
  today = new Date().toISOString().slice(0, 10),
): AccAllotmentV2 {
  if (
    (record.status === "active" || record.status === "suspended") &&
    record.validTo &&
    record.validTo < today
  ) {
    return { ...record, status: "ended" };
  }

  return record;
}

export class AllotmentsRepository {
  async findAll(filters?: {
    crewUuid?: string;
    status?: string;
  }): Promise<AccAllotmentV2[]> {
    const db = getDb();
    const conditions = [eq(accAllotmentsV2.isDeleted, false)];
    if (filters?.crewUuid) {
      conditions.push(eq(accAllotmentsV2.crewUuid, filters.crewUuid));
    }
    const rows: AccAllotmentV2[] = await db
      .select()
      .from(accAllotmentsV2)
      .where(and(...conditions))
      .orderBy(asc(accAllotmentsV2.priority));

    const today = new Date().toISOString().slice(0, 10);
    const records = rows.map((row) => withCurrentStatus(row, today));

    return filters?.status
      ? records.filter((row) => row.status === filters.status)
      : records;
  }

  async findByUuid(
    allotmentUuid: string,
  ): Promise<AccAllotmentV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(accAllotmentsV2)
      .where(
        and(
          eq(accAllotmentsV2.allotmentUuid, allotmentUuid),
          eq(accAllotmentsV2.isDeleted, false),
        ),
      );
    return results[0] ? withCurrentStatus(results[0]) : undefined;
  }

  async create(
    data: Omit<InsertAccAllotmentV2, "allotmentUuid">,
  ): Promise<AccAllotmentV2> {
    const db = getDb();
    const results = await db
      .insert(accAllotmentsV2)
      .values({ ...data, allotmentUuid: uuidv4() })
      .returning();
    return withCurrentStatus(results[0]);
  }

  async update(
    allotmentUuid: string,
    data: Partial<InsertAccAllotmentV2>,
  ): Promise<AccAllotmentV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(accAllotmentsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(accAllotmentsV2.allotmentUuid, allotmentUuid))
      .returning();
    return results[0] ? withCurrentStatus(results[0]) : undefined;
  }

  async softDelete(allotmentUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(accAllotmentsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(accAllotmentsV2.allotmentUuid, allotmentUuid))
      .returning();
    return results.length > 0;
  }

  /** Allotment uuids that have a ledger line in the given period. */
  async findPostedAllotmentUuids(period: string): Promise<Set<string>> {
    const db = getDb();
    const rows = await db
      .selectDistinct({ sourceUuid: accWageLedgerV2.sourceUuid })
      .from(accWageLedgerV2)
      .where(
        and(
          eq(accWageLedgerV2.sourceType, "allotment"),
          eq(accWageLedgerV2.period, period),
          eq(accWageLedgerV2.isDeleted, false),
        ),
      );
    return new Set(
      rows
        .map((r: { sourceUuid: string | null }) => r.sourceUuid)
        .filter((u: string | null): u is string => u != null),
    );
  }
}
