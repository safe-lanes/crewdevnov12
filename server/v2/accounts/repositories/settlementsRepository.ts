import { eq, and, isNotNull, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db";
import {
  accSettlementsV2,
  accSettlementAdjustmentsV2,
  accSettlementApprovalsV2,
  accEngagementsV2,
  accPayElementsV2,
  accCalculationRunsV2,
} from "../../../../shared/v2/accounts/schema";
import type {
  AccSettlementV2,
  InsertAccSettlementV2,
  AccSettlementAdjustmentV2,
  InsertAccSettlementAdjustmentV2,
  AccSettlementApprovalV2,
  InsertAccSettlementApprovalV2,
  AccEngagementV2,
  AccCalculationRunV2,
  InsertAccCalculationRunV2,
} from "../../../../shared/v2/accounts/types";

/**
 * Settlement lifecycle persistence (settlement row, adjustments, approvals).
 * Ledger lines are NOT touched here — the settlement is a projection; the
 * paid transition consumes balances via the settlement row columns only.
 */
export class SettlementsRepository {
  async findAll(): Promise<AccSettlementV2[]> {
    const db = getDb();
    return db
      .select()
      .from(accSettlementsV2)
      .where(eq(accSettlementsV2.isDeleted, false))
      .orderBy(accSettlementsV2.id);
  }

  async findByUuid(
    settlementUuid: string,
  ): Promise<AccSettlementV2 | undefined> {
    const db = getDb();
    const rows = await db
      .select()
      .from(accSettlementsV2)
      .where(
        and(
          eq(accSettlementsV2.settlementUuid, settlementUuid),
          eq(accSettlementsV2.isDeleted, false),
        ),
      );
    return rows[0];
  }

  async findByEngagement(
    engagementUuid: string,
  ): Promise<AccSettlementV2 | undefined> {
    const db = getDb();
    const rows = await db
      .select()
      .from(accSettlementsV2)
      .where(
        and(
          eq(accSettlementsV2.engagementUuid, engagementUuid),
          eq(accSettlementsV2.isDeleted, false),
        ),
      );
    return rows[0];
  }

  async create(
    data: Omit<InsertAccSettlementV2, "settlementUuid">,
  ): Promise<AccSettlementV2> {
    const db = getDb();
    const rows = await db
      .insert(accSettlementsV2)
      .values({ ...data, settlementUuid: uuidv4() })
      .returning();
    return rows[0];
  }

  async update(
    settlementUuid: string,
    data: Partial<InsertAccSettlementV2>,
  ): Promise<AccSettlementV2 | undefined> {
    const db = getDb();
    const rows = await db
      .update(accSettlementsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(accSettlementsV2.settlementUuid, settlementUuid))
      .returning();
    return rows[0];
  }

  // --------------------------------------------------------------------
  // Adjustments
  // --------------------------------------------------------------------

  async findAdjustmentsBySettlement(
    settlementUuid: string,
  ): Promise<AccSettlementAdjustmentV2[]> {
    const db = getDb();
    return db
      .select()
      .from(accSettlementAdjustmentsV2)
      .where(
        and(
          eq(accSettlementAdjustmentsV2.settlementUuid, settlementUuid),
          eq(accSettlementAdjustmentsV2.isDeleted, false),
        ),
      )
      .orderBy(accSettlementAdjustmentsV2.id);
  }

  async findAdjustmentByUuid(
    adjustmentUuid: string,
  ): Promise<AccSettlementAdjustmentV2 | undefined> {
    const db = getDb();
    const rows = await db
      .select()
      .from(accSettlementAdjustmentsV2)
      .where(
        and(
          eq(accSettlementAdjustmentsV2.adjustmentUuid, adjustmentUuid),
          eq(accSettlementAdjustmentsV2.isDeleted, false),
        ),
      );
    return rows[0];
  }

  async createAdjustment(
    data: Omit<InsertAccSettlementAdjustmentV2, "adjustmentUuid">,
  ): Promise<AccSettlementAdjustmentV2> {
    const db = getDb();
    const rows = await db
      .insert(accSettlementAdjustmentsV2)
      .values({ ...data, adjustmentUuid: uuidv4() })
      .returning();
    return rows[0];
  }

  async updateAdjustment(
    adjustmentUuid: string,
    data: Partial<InsertAccSettlementAdjustmentV2>,
  ): Promise<AccSettlementAdjustmentV2 | undefined> {
    const db = getDb();
    const rows = await db
      .update(accSettlementAdjustmentsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(accSettlementAdjustmentsV2.adjustmentUuid, adjustmentUuid))
      .returning();
    return rows[0];
  }

  // --------------------------------------------------------------------
  // Approvals (mirrors PortageRepository approvals)
  // --------------------------------------------------------------------

  async findApprovalsBySettlement(
    settlementUuid: string,
  ): Promise<AccSettlementApprovalV2[]> {
    const db = getDb();
    return db
      .select()
      .from(accSettlementApprovalsV2)
      .where(
        and(
          eq(accSettlementApprovalsV2.settlementUuid, settlementUuid),
          eq(accSettlementApprovalsV2.isDeleted, false),
        ),
      )
      .orderBy(accSettlementApprovalsV2.id);
  }

  async findApprovalByUuid(
    stApprovalUuid: string,
  ): Promise<AccSettlementApprovalV2 | undefined> {
    const db = getDb();
    const rows = await db
      .select()
      .from(accSettlementApprovalsV2)
      .where(
        and(
          eq(accSettlementApprovalsV2.stApprovalUuid, stApprovalUuid),
          eq(accSettlementApprovalsV2.isDeleted, false),
        ),
      );
    return rows[0];
  }

  async softDeleteApprovals(settlementUuid: string): Promise<void> {
    const db = getDb();
    await db
      .update(accSettlementApprovalsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(
        and(
          eq(accSettlementApprovalsV2.settlementUuid, settlementUuid),
          eq(accSettlementApprovalsV2.isDeleted, false),
        ),
      );
  }

  async createApprovals(
    rows: Array<Omit<InsertAccSettlementApprovalV2, "stApprovalUuid">>,
  ): Promise<AccSettlementApprovalV2[]> {
    if (rows.length === 0) return [];
    const db = getDb();
    return db
      .insert(accSettlementApprovalsV2)
      .values(rows.map((r) => ({ ...r, stApprovalUuid: uuidv4() })))
      .returning();
  }

  async updateApproval(
    stApprovalUuid: string,
    data: Partial<InsertAccSettlementApprovalV2>,
  ): Promise<AccSettlementApprovalV2 | undefined> {
    const db = getDb();
    const rows = await db
      .update(accSettlementApprovalsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(accSettlementApprovalsV2.stApprovalUuid, stApprovalUuid))
      .returning();
    return rows[0];
  }

  /**
   * Apply an approval decision atomically (mirrors PortageRepository.
   * applyDecision). Locks the parent settlement row FOR UPDATE so concurrent
   * decisions on the same settlement are serialized, then re-checks the
   * approval row and the identity-binding invariants under the lock.
   */
  async applyDecision(params: {
    stApprovalUuid: string;
    decision: "Approved" | "Rejected";
    comments: string | null;
    auditUserUuid: string | null;
    /**
     * Server-derived identity of the caller (JWT principal id). When set,
     * the decision is identity-bound: a pre-assigned approver slot may only
     * be decided by that approver, an unassigned (free-text) slot is claimed
     * by the decider, and one caller can never satisfy two slots on the
     * same settlement. Null only when auth is bypassed in dev.
     */
    deciderId: string | null;
  }): Promise<{ settlement: AccSettlementV2 }> {
    const db = getDb();
    const fail = (
      code: "NOT_FOUND" | "CONFLICT" | "FORBIDDEN",
      message: string,
    ): never => {
      const err = new Error(message) as Error & { code: string };
      err.code = code;
      throw err;
    };
    return db.transaction(async (tx: any) => {
      const approvalRows = await tx
        .select()
        .from(accSettlementApprovalsV2)
        .where(
          and(
            eq(accSettlementApprovalsV2.stApprovalUuid, params.stApprovalUuid),
            eq(accSettlementApprovalsV2.isDeleted, false),
          ),
        );
      const approval: AccSettlementApprovalV2 | undefined = approvalRows[0];
      if (!approval) return fail("NOT_FOUND", "Approval row not found");

      // Serialize concurrent decisions on the same settlement.
      const settlementRows = await tx
        .select()
        .from(accSettlementsV2)
        .where(
          and(
            eq(accSettlementsV2.settlementUuid, approval.settlementUuid),
            eq(accSettlementsV2.isDeleted, false),
          ),
        )
        .for("update");
      const settlement: AccSettlementV2 | undefined = settlementRows[0];
      if (!settlement) return fail("NOT_FOUND", "Settlement not found");
      if (settlement.status !== "submitted") {
        return fail(
          "CONFLICT",
          `Settlement is not awaiting approval (status '${settlement.status}')`,
        );
      }

      // Re-check the approval row now that the settlement lock is held (a
      // concurrent decision on the same row may have won the race).
      const freshRows = await tx
        .select()
        .from(accSettlementApprovalsV2)
        .where(
          and(
            eq(accSettlementApprovalsV2.stApprovalUuid, params.stApprovalUuid),
            eq(accSettlementApprovalsV2.isDeleted, false),
          ),
        );
      const fresh: AccSettlementApprovalV2 | undefined = freshRows[0];
      if (!fresh) return fail("NOT_FOUND", "Approval row not found");
      if (fresh.status !== "Pending") {
        return fail("CONFLICT", `Approval already ${fresh.status}`);
      }

      // Identity binding (segregation of duties).
      if (fresh.approverId) {
        if (!params.deciderId || fresh.approverId !== params.deciderId) {
          return fail(
            "FORBIDDEN",
            "This approval is assigned to a different approver",
          );
        }
      }
      if (params.deciderId) {
        const held = await tx
          .select()
          .from(accSettlementApprovalsV2)
          .where(
            and(
              eq(
                accSettlementApprovalsV2.settlementUuid,
                settlement.settlementUuid,
              ),
              eq(accSettlementApprovalsV2.approverId, params.deciderId),
              eq(accSettlementApprovalsV2.isDeleted, false),
            ),
          );
        const other = held.find(
          (a: AccSettlementApprovalV2) =>
            a.stApprovalUuid !== params.stApprovalUuid,
        );
        if (other) {
          return fail(
            "FORBIDDEN",
            "You already hold another approver slot on this settlement",
          );
        }
      }

      await tx
        .update(accSettlementApprovalsV2)
        .set({
          approverId: fresh.approverId ?? params.deciderId ?? null,
          status: params.decision,
          comments: params.comments,
          date: new Date().toISOString().slice(0, 10),
          updatedByUuid: params.auditUserUuid,
          updatedAt: new Date(),
        })
        .where(
          eq(accSettlementApprovalsV2.stApprovalUuid, params.stApprovalUuid),
        );

      let updatedSettlement: AccSettlementV2 = settlement;
      if (params.decision === "Rejected") {
        const rows = await tx
          .update(accSettlementsV2)
          .set({
            status: "draft",
            updatedByUuid: params.auditUserUuid,
            updatedAt: new Date(),
          })
          .where(
            eq(accSettlementsV2.settlementUuid, settlement.settlementUuid),
          )
          .returning();
        updatedSettlement = rows[0];
      } else {
        const all: AccSettlementApprovalV2[] = await tx
          .select()
          .from(accSettlementApprovalsV2)
          .where(
            and(
              eq(
                accSettlementApprovalsV2.settlementUuid,
                settlement.settlementUuid,
              ),
              eq(accSettlementApprovalsV2.isDeleted, false),
            ),
          );
        const allApproved =
          all.length > 0 &&
          all.every((a: AccSettlementApprovalV2) => a.status === "Approved");
        if (allApproved) {
          const rows = await tx
            .update(accSettlementsV2)
            .set({
              status: "approved",
              updatedByUuid: params.auditUserUuid,
              updatedAt: new Date(),
            })
            .where(
              eq(accSettlementsV2.settlementUuid, settlement.settlementUuid),
            )
            .returning();
          updatedSettlement = rows[0];
        }
      }
      return { settlement: updatedSettlement };
    });
  }

  /**
   * Audit-trail run row for a settlement compute (runType 'settlement').
   * Writes acc_calculation_runs_v2 only — never ledger lines (those stay
   * the engine's exclusive domain).
   */
  async createSettlementRun(
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
  // Supporting reads
  // --------------------------------------------------------------------

  /** Engagements that have an end_date (settlement-eligible universe). */
  async findEndedEngagements(): Promise<AccEngagementV2[]> {
    const db = getDb();
    return db
      .select()
      .from(accEngagementsV2)
      .where(
        and(
          eq(accEngagementsV2.isDeleted, false),
          isNotNull(accEngagementsV2.endDate),
          inArray(accEngagementsV2.status, ["active", "completed", "settled"]),
        ),
      )
      .orderBy(accEngagementsV2.id);
  }

  /** pay_element_uuid -> {code, name, category} (no status filter). */
  async findElementInfo(
    payElementUuids: string[],
  ): Promise<Map<string, { code: string; name: string; category: string }>> {
    const map = new Map<
      string,
      { code: string; name: string; category: string }
    >();
    if (payElementUuids.length === 0) return map;
    const db = getDb();
    const rows = await db
      .select({
        payElementUuid: accPayElementsV2.payElementUuid,
        code: accPayElementsV2.code,
        name: accPayElementsV2.name,
        category: accPayElementsV2.category,
      })
      .from(accPayElementsV2)
      .where(inArray(accPayElementsV2.payElementUuid, payElementUuids));
    for (const r of rows) {
      map.set(r.payElementUuid, {
        code: r.code,
        name: r.name,
        category: r.category,
      });
    }
    return map;
  }
}
