import { eq, and, asc, isNull } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db";
import {
  accPortageBillsV2,
  accCalculationRunsV2,
  accWageLedgerV2,
} from "../../../../shared/v2/accounts/schema";
import type {
  AccPortageBillV2,
  InsertAccPortageBillV2,
  AccCalculationRunV2,
  InsertAccCalculationRunV2,
  AccWageLedgerV2,
  InsertAccWageLedgerV2,
} from "../../../../shared/v2/accounts/types";

/**
 * ONLY-WRITER RULE (docs/accounts-schema.md): this repository is the single
 * code path that writes acc_wage_ledger_v2 rows, and it is consumed
 * exclusively by the wage engine service. It is deliberately NOT exported
 * from server/v2/accounts/repositories/index.ts — controllers and other
 * services must never import it. Read-only ledger access for the API lives
 * in `ledgerQueries` (exported from the engine module).
 */
export class LedgerRepository {
  // --------------------------------------------------------------------
  // Portage bills
  // --------------------------------------------------------------------

  async findPortage(
    vesselUuid: string,
    period: string,
  ): Promise<AccPortageBillV2 | undefined> {
    const db = getDb();
    const rows = await db
      .select()
      .from(accPortageBillsV2)
      .where(
        and(
          eq(accPortageBillsV2.vesselUuid, vesselUuid),
          eq(accPortageBillsV2.period, period),
          eq(accPortageBillsV2.isDeleted, false),
        ),
      );
    return rows[0];
  }

  async createPortage(
    data: Omit<InsertAccPortageBillV2, "portageUuid">,
  ): Promise<AccPortageBillV2> {
    const db = getDb();
    const rows = await db
      .insert(accPortageBillsV2)
      .values({ ...data, portageUuid: uuidv4() })
      .returning();
    return rows[0];
  }

  // --------------------------------------------------------------------
  // Calculation runs
  // --------------------------------------------------------------------

  async createRun(
    data: Omit<InsertAccCalculationRunV2, "calcRunUuid">,
  ): Promise<AccCalculationRunV2> {
    const db = getDb();
    const rows = await db
      .insert(accCalculationRunsV2)
      .values({ ...data, calcRunUuid: uuidv4() })
      .returning();
    return rows[0];
  }

  // --------------------------------------------------------------------
  // Ledger line replacement (engine-only writes)
  // --------------------------------------------------------------------

  /**
   * Replace all non-adjustment lines of an UNLOCKED portage in one
   * transaction, and refresh the portage cached totals. Adjustment lines
   * (is_adjustment = true) are never touched by recalculation.
   */
  async replacePortageLines(
    portageUuid: string,
    lines: InsertAccWageLedgerV2[],
    portagePatch: Partial<InsertAccPortageBillV2>,
  ): Promise<void> {
    const db = getDb();
    await db.transaction(async (tx: ReturnType<typeof getDb>) => {
      await tx
        .delete(accWageLedgerV2)
        .where(
          and(
            eq(accWageLedgerV2.portageUuid, portageUuid),
            eq(accWageLedgerV2.isAdjustment, false),
          ),
        );
      if (lines.length > 0) {
        await tx.insert(accWageLedgerV2).values(lines);
      }
      await tx
        .update(accPortageBillsV2)
        .set({ ...portagePatch, updatedAt: new Date() })
        .where(eq(accPortageBillsV2.portageUuid, portageUuid));
    });
  }

  /**
   * Replace the preview (no-portage) lines of one engagement + period in one
   * transaction. Scope: portage_uuid IS NULL, is_adjustment = false.
   */
  async replacePreviewLines(
    engagementUuid: string,
    period: string,
    lines: InsertAccWageLedgerV2[],
  ): Promise<void> {
    const db = getDb();
    await db.transaction(async (tx: ReturnType<typeof getDb>) => {
      await tx
        .delete(accWageLedgerV2)
        .where(
          and(
            eq(accWageLedgerV2.engagementUuid, engagementUuid),
            eq(accWageLedgerV2.period, period),
            isNull(accWageLedgerV2.portageUuid),
            eq(accWageLedgerV2.isAdjustment, false),
          ),
        );
      if (lines.length > 0) {
        await tx.insert(accWageLedgerV2).values(lines);
      }
    });
  }

  /** Append post-lock adjustment lines (is_adjustment = true). */
  async insertAdjustmentLines(
    lines: InsertAccWageLedgerV2[],
  ): Promise<AccWageLedgerV2[]> {
    if (lines.length === 0) return [];
    const db = getDb();
    return db.insert(accWageLedgerV2).values(lines).returning();
  }

  // --------------------------------------------------------------------
  // Reads (exposed via ledgerQueries in engine/index.ts)
  // --------------------------------------------------------------------

  async findLinesByPortage(portageUuid: string): Promise<AccWageLedgerV2[]> {
    const db = getDb();
    return db
      .select()
      .from(accWageLedgerV2)
      .where(
        and(
          eq(accWageLedgerV2.portageUuid, portageUuid),
          eq(accWageLedgerV2.isDeleted, false),
        ),
      )
      .orderBy(
        asc(accWageLedgerV2.crewUuid),
        asc(accWageLedgerV2.periodFrom),
        asc(accWageLedgerV2.elementCode),
        asc(accWageLedgerV2.id),
      );
  }

  async findLinesByEngagementPeriod(
    engagementUuid: string,
    period: string,
  ): Promise<AccWageLedgerV2[]> {
    const db = getDb();
    return db
      .select()
      .from(accWageLedgerV2)
      .where(
        and(
          eq(accWageLedgerV2.engagementUuid, engagementUuid),
          eq(accWageLedgerV2.period, period),
          eq(accWageLedgerV2.isDeleted, false),
        ),
      )
      .orderBy(
        asc(accWageLedgerV2.periodFrom),
        asc(accWageLedgerV2.elementCode),
        asc(accWageLedgerV2.id),
      );
  }

  async findLineByUuid(
    ledgerUuid: string,
  ): Promise<AccWageLedgerV2 | undefined> {
    const db = getDb();
    const rows = await db
      .select()
      .from(accWageLedgerV2)
      .where(
        and(
          eq(accWageLedgerV2.ledgerUuid, ledgerUuid),
          eq(accWageLedgerV2.isDeleted, false),
        ),
      );
    return rows[0];
  }
}
