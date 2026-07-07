import { eq, and, desc, inArray, asc } from "drizzle-orm";
import { getDb } from "../../db";
import {
  accAdvancesV2,
  accWageLedgerV2,
} from "../../../../shared/v2/accounts/schema";
import type {
  AccAdvanceV2,
  InsertAccAdvanceV2,
} from "../../../../shared/v2/accounts/types";
import { v4 as uuidv4 } from "uuid";

export interface AdvanceRecoveryLine {
  sourceUuid: string | null;
  period: string;
  portageUuid: string | null;
  amount: string;
}

export class AdvancesRepository {
  async findAll(filters?: {
    crewUuid?: string;
    status?: string;
  }): Promise<AccAdvanceV2[]> {
    const db = getDb();
    const conditions = [eq(accAdvancesV2.isDeleted, false)];
    if (filters?.crewUuid) {
      conditions.push(eq(accAdvancesV2.crewUuid, filters.crewUuid));
    }
    if (filters?.status) {
      conditions.push(eq(accAdvancesV2.status, filters.status));
    }
    return db
      .select()
      .from(accAdvancesV2)
      .where(and(...conditions))
      .orderBy(desc(accAdvancesV2.createdAt));
  }

  async findByUuid(advanceUuid: string): Promise<AccAdvanceV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(accAdvancesV2)
      .where(
        and(
          eq(accAdvancesV2.advanceUuid, advanceUuid),
          eq(accAdvancesV2.isDeleted, false),
        ),
      );
    return results[0];
  }

  async create(
    data: Omit<InsertAccAdvanceV2, "advanceUuid">,
  ): Promise<AccAdvanceV2> {
    const db = getDb();
    const results = await db
      .insert(accAdvancesV2)
      .values({ ...data, advanceUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async update(
    advanceUuid: string,
    data: Partial<InsertAccAdvanceV2>,
  ): Promise<AccAdvanceV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(accAdvancesV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(accAdvancesV2.advanceUuid, advanceUuid))
      .returning();
    return results[0];
  }

  async softDelete(advanceUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(accAdvancesV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(accAdvancesV2.advanceUuid, advanceUuid))
      .returning();
    return results.length > 0;
  }

  /** Recovery ledger lines for the given advances (preview + portage). */
  async findRecoveryLines(
    advanceUuids: string[],
  ): Promise<AdvanceRecoveryLine[]> {
    if (advanceUuids.length === 0) return [];
    const db = getDb();
    return db
      .select({
        sourceUuid: accWageLedgerV2.sourceUuid,
        period: accWageLedgerV2.period,
        portageUuid: accWageLedgerV2.portageUuid,
        amount: accWageLedgerV2.amount,
      })
      .from(accWageLedgerV2)
      .where(
        and(
          eq(accWageLedgerV2.sourceType, "advance_recovery"),
          inArray(accWageLedgerV2.sourceUuid, advanceUuids),
          eq(accWageLedgerV2.isDeleted, false),
        ),
      )
      .orderBy(asc(accWageLedgerV2.period));
  }
}
