import { eq, and, asc, isNull, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db";
import {
  accPortageBillsV2,
  accCalculationRunsV2,
  accWageLedgerV2,
  accSettlementsV2,
} from "../../../../shared/v2/accounts/schema";
import type {
  AccPortageBillV2,
  InsertAccPortageBillV2,
  AccCalculationRunV2,
  InsertAccCalculationRunV2,
  AccWageLedgerV2,
  InsertAccWageLedgerV2,
} from "../../../../shared/v2/accounts/types";

/** 409-mapped error for lock races caught inside the write transaction. */
function lockConflict(message: string): Error {
  const err = new Error(message) as Error & { code: string };
  err.code = "CONFLICT";
  return err;
}

/**
 * In-transaction settlement freeze re-check (FOR UPDATE): a settlement
 * submitted/approved/paid/locked between the caller's pre-check and this
 * write must refuse the line replacement (check-then-write race).
 */
async function assertNoFrozenSettlementsTx(
  tx: ReturnType<typeof getDb>,
  engagementUuids: string[],
): Promise<void> {
  if (engagementUuids.length === 0) return;
  const frozen = await tx
    .select()
    .from(accSettlementsV2)
    .where(
      and(
        inArray(accSettlementsV2.engagementUuid, engagementUuids),
        inArray(accSettlementsV2.status, [
          "submitted",
          "approved",
          "paid",
          "locked",
        ]),
        eq(accSettlementsV2.isDeleted, false),
      ),
    )
    .for("update");
  if (frozen.length > 0) {
    const s = frozen[0];
    throw lockConflict(
      `Settlement ${s.settlementUuid} (${s.status}) froze engagement ${s.engagementUuid} while the calculation was running; no lines were replaced`,
    );
  }
}

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

  /** Patch a run row (status lifecycle: running -> completed | failed). */
  async updateRun(
    calcRunUuid: string,
    patch: Partial<InsertAccCalculationRunV2>,
  ): Promise<AccCalculationRunV2 | undefined> {
    const db = getDb();
    const rows = await db
      .update(accCalculationRunsV2)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(accCalculationRunsV2.calcRunUuid, calcRunUuid))
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
   *
   * The lock state is re-verified INSIDE the transaction (row locked with
   * FOR UPDATE) so a lock committed between the caller's check and this
   * write cannot be overwritten (check-then-write race).
   */
  async replacePortageLines(
    portageUuid: string,
    lines: InsertAccWageLedgerV2[],
    portagePatch: Partial<InsertAccPortageBillV2>,
    opts?: {
      /**
       * Engagement-scoped replacement (settlement skip): when given, ONLY
       * these engagements' non-adjustment lines are deleted before insert —
       * other engagements' lines (e.g. frozen/settled) are preserved
       * exactly as-is. When omitted, all non-adjustment lines are replaced
       * (legacy full-replacement behavior).
       */
      replaceEngagementUuids?: string[];
      /**
       * Recompute cached portage totals from the FULL post-replacement
       * ledger (preserved + fresh lines, adjustments included in the input;
       * the callback decides what to count). Runs inside the transaction.
       */
      computeTotals?: (
        fullLedgerLines: AccWageLedgerV2[],
      ) => Partial<InsertAccPortageBillV2>;
    },
  ): Promise<void> {
    const db = getDb();
    await db.transaction(async (tx: ReturnType<typeof getDb>) => {
      const portageRows = await tx
        .select()
        .from(accPortageBillsV2)
        .where(eq(accPortageBillsV2.portageUuid, portageUuid))
        .for("update");
      const portage = portageRows[0];
      if (!portage) {
        throw lockConflict(`Portage bill ${portageUuid} no longer exists`);
      }
      if (portage.isLocked || portage.status === "locked") {
        throw lockConflict(
          `Portage bill ${portageUuid} was locked while the calculation was running; no lines were replaced`,
        );
      }
      const replaceScope = opts?.replaceEngagementUuids;
      await assertNoFrozenSettlementsTx(
        tx,
        Array.from(
          new Set([
            ...lines.map((l) => l.engagementUuid),
            ...(replaceScope ?? []),
          ]),
        ),
      );
      if (replaceScope === undefined) {
        await tx
          .delete(accWageLedgerV2)
          .where(
            and(
              eq(accWageLedgerV2.portageUuid, portageUuid),
              eq(accWageLedgerV2.isAdjustment, false),
            ),
          );
      } else if (replaceScope.length > 0) {
        await tx
          .delete(accWageLedgerV2)
          .where(
            and(
              eq(accWageLedgerV2.portageUuid, portageUuid),
              eq(accWageLedgerV2.isAdjustment, false),
              inArray(accWageLedgerV2.engagementUuid, replaceScope),
            ),
          );
      }

      // Also clean up any unattached preview lines (portage_uuid IS NULL) for
      // the same engagements + period.  A prior single-engagement preview run
      // (runForEngagement before a portage existed) may have left preview lines
      // behind; without this cleanup, the fresh portage-attached lines we are
      // about to insert would coexist with them — the reverse-order variant of
      // the duplicate-lines defect.
      const previewCleanupScope =
        replaceScope !== undefined
          ? replaceScope
          : [...new Set(lines.map((l) => l.engagementUuid))];
      if (previewCleanupScope.length > 0) {
        await tx
          .delete(accWageLedgerV2)
          .where(
            and(
              isNull(accWageLedgerV2.portageUuid),
              eq(accWageLedgerV2.isAdjustment, false),
              inArray(accWageLedgerV2.engagementUuid, previewCleanupScope),
              eq(accWageLedgerV2.period, portage.period),
            ),
          );
      }

      if (lines.length > 0) {
        await tx.insert(accWageLedgerV2).values(lines);
      }
      let patch = portagePatch;
      if (opts?.computeTotals) {
        const fullLines = (await tx
          .select()
          .from(accWageLedgerV2)
          .where(
            and(
              eq(accWageLedgerV2.portageUuid, portageUuid),
              eq(accWageLedgerV2.isDeleted, false),
            ),
          )) as AccWageLedgerV2[];
        patch = { ...portagePatch, ...opts.computeTotals(fullLines) };
      }
      await tx
        .update(accPortageBillsV2)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(accPortageBillsV2.portageUuid, portageUuid));
    });
  }

  /**
   * Replace the preview (no-portage) lines of one engagement + period in one
   * transaction. Scope: portage_uuid IS NULL, is_adjustment = false.
   *
   * When `lockGuard.vesselUuid` is given, the vessel's portage bill for the
   * period is re-checked (FOR UPDATE) inside the transaction — a period
   * locked after the caller's check refuses the preview write too.
   */
  async replacePreviewLines(
    engagementUuid: string,
    period: string,
    lines: InsertAccWageLedgerV2[],
    lockGuard?: { vesselUuid: string },
  ): Promise<void> {
    const db = getDb();
    await db.transaction(async (tx: ReturnType<typeof getDb>) => {
      if (lockGuard) {
        const portageRows = await tx
          .select()
          .from(accPortageBillsV2)
          .where(
            and(
              eq(accPortageBillsV2.vesselUuid, lockGuard.vesselUuid),
              eq(accPortageBillsV2.period, period),
              eq(accPortageBillsV2.isDeleted, false),
            ),
          )
          .for("update");
        const portage = portageRows[0];
        if (portage && (portage.isLocked || portage.status === "locked")) {
          throw lockConflict(
            `Portage bill for vessel ${lockGuard.vesselUuid} period ${period} was locked while the calculation was running; no lines were replaced`,
          );
        }
      }
      await assertNoFrozenSettlementsTx(tx, [engagementUuid]);
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

  async findLinesByVesselPeriod(
    vesselUuid: string,
    period: string,
  ): Promise<AccWageLedgerV2[]> {
    const db = getDb();
    return db
      .select()
      .from(accWageLedgerV2)
      .where(
        and(
          eq(accWageLedgerV2.vesselUuid, vesselUuid),
          eq(accWageLedgerV2.period, period),
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

  /** All ledger lines of one period across vessels (fleet reports). */
  async findLinesByPeriod(period: string): Promise<AccWageLedgerV2[]> {
    const db = getDb();
    return db
      .select()
      .from(accWageLedgerV2)
      .where(
        and(
          eq(accWageLedgerV2.period, period),
          eq(accWageLedgerV2.isDeleted, false),
        ),
      )
      .orderBy(
        asc(accWageLedgerV2.vesselUuid),
        asc(accWageLedgerV2.crewUuid),
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
