import { eq, and, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db";
import {
  accPortageBillsV2,
  accPortageApprovalsV2,
  accCalculationRunsV2,
  accCtmV2,
} from "../../../../shared/v2/accounts/schema";
import type {
  AccPortageBillV2,
  InsertAccPortageBillV2,
  AccPortageApprovalV2,
  InsertAccPortageApprovalV2,
  AccCalculationRunV2,
} from "../../../../shared/v2/accounts/types";

/**
 * Portage bill lifecycle (status transitions, approvals). Ledger lines are
 * NOT touched here — those remain the engine's exclusive domain.
 */
export class PortageRepository {
  async findByVesselPeriod(
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

  async findByUuid(portageUuid: string): Promise<AccPortageBillV2 | undefined> {
    const db = getDb();
    const rows = await db
      .select()
      .from(accPortageBillsV2)
      .where(
        and(
          eq(accPortageBillsV2.portageUuid, portageUuid),
          eq(accPortageBillsV2.isDeleted, false),
        ),
      );
    return rows[0];
  }

  /** Create the vessel-month portage header (vessel submit before any run). */
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

  async updatePortage(
    portageUuid: string,
    data: Partial<InsertAccPortageBillV2>,
  ): Promise<AccPortageBillV2 | undefined> {
    const db = getDb();
    const rows = await db
      .update(accPortageBillsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(accPortageBillsV2.portageUuid, portageUuid))
      .returning();
    return rows[0];
  }

  async findApprovalsByPortage(
    portageUuid: string,
  ): Promise<AccPortageApprovalV2[]> {
    const db = getDb();
    return db
      .select()
      .from(accPortageApprovalsV2)
      .where(
        and(
          eq(accPortageApprovalsV2.portageUuid, portageUuid),
          eq(accPortageApprovalsV2.isDeleted, false),
        ),
      )
      .orderBy(accPortageApprovalsV2.id);
  }

  async findApprovalByUuid(
    pbApprovalUuid: string,
  ): Promise<AccPortageApprovalV2 | undefined> {
    const db = getDb();
    const rows = await db
      .select()
      .from(accPortageApprovalsV2)
      .where(
        and(
          eq(accPortageApprovalsV2.pbApprovalUuid, pbApprovalUuid),
          eq(accPortageApprovalsV2.isDeleted, false),
        ),
      );
    return rows[0];
  }

  /** Soft-delete every live approval row (used when re-submitting). */
  async softDeleteApprovals(portageUuid: string): Promise<void> {
    const db = getDb();
    await db
      .update(accPortageApprovalsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(
        and(
          eq(accPortageApprovalsV2.portageUuid, portageUuid),
          eq(accPortageApprovalsV2.isDeleted, false),
        ),
      );
  }

  async createApprovals(
    rows: Array<Omit<InsertAccPortageApprovalV2, "pbApprovalUuid">>,
  ): Promise<AccPortageApprovalV2[]> {
    if (rows.length === 0) return [];
    const db = getDb();
    return db
      .insert(accPortageApprovalsV2)
      .values(rows.map((r) => ({ ...r, pbApprovalUuid: uuidv4() })))
      .returning();
  }

  async updateApproval(
    pbApprovalUuid: string,
    data: Partial<InsertAccPortageApprovalV2>,
  ): Promise<AccPortageApprovalV2 | undefined> {
    const db = getDb();
    const rows = await db
      .update(accPortageApprovalsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(accPortageApprovalsV2.pbApprovalUuid, pbApprovalUuid))
      .returning();
    return rows[0];
  }

  /**
   * Apply one approver's decision atomically. All writes — the approval row,
   * the portage status transition, and (on auto-lock) the linked CTM lock —
   * happen in ONE transaction. The portage row is locked FOR UPDATE first so
   * concurrent decisions on the same portage serialize: the last approver's
   * transaction always sees every earlier decision and fires the terminal
   * transition exactly once.
   *
   * Terminal transition (every live approval Approved):
   * - autoLockOnApproval=true  → status 'locked', is_locked, locked_by,
   *   locked_date + linked CTM locked (single transaction).
   * - autoLockOnApproval=false → status 'approved' only; the month stays
   *   unlocked and editable until an explicit lock.
   *
   * Throws Error with .code = "NOT_FOUND" | "CONFLICT" on state violations
   * (re-checked inside the transaction, after acquiring the row lock).
   */
  async applyDecision(params: {
    pbApprovalUuid: string;
    decision: "Approved" | "Rejected";
    comments: string | null;
    auditUserUuid: string | null;
    autoLockOnApproval: boolean;
    /**
     * Server-derived identity of the caller (JWT principal id). When set,
     * the decision is identity-bound: a pre-assigned approver slot may only
     * be decided by that approver, an unassigned (free-text) slot is claimed
     * by the decider, and one caller can never satisfy two slots on the
     * same portage bill. Null only when auth is bypassed in dev.
     */
    deciderId: string | null;
  }): Promise<{
    portage: AccPortageBillV2;
    approvals: AccPortageApprovalV2[];
  }> {
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
        .from(accPortageApprovalsV2)
        .where(
          and(
            eq(accPortageApprovalsV2.pbApprovalUuid, params.pbApprovalUuid),
            eq(accPortageApprovalsV2.isDeleted, false),
          ),
        );
      const approval: AccPortageApprovalV2 | undefined = approvalRows[0];
      if (!approval) return fail("NOT_FOUND", "Approval row not found");

      // Serialize concurrent decisions on the same portage bill.
      const portageRows = await tx
        .select()
        .from(accPortageBillsV2)
        .where(
          and(
            eq(accPortageBillsV2.portageUuid, approval.portageUuid),
            eq(accPortageBillsV2.isDeleted, false),
          ),
        )
        .for("update");
      const portage: AccPortageBillV2 | undefined = portageRows[0];
      if (!portage) return fail("NOT_FOUND", "Portage bill not found");
      if (portage.status !== "office_review") {
        return fail(
          "CONFLICT",
          `Portage bill is not awaiting approval (status '${portage.status}')`,
        );
      }

      // Re-check the approval row now that the portage lock is held (a
      // concurrent decision on the same row may have won the race).
      const freshRows = await tx
        .select()
        .from(accPortageApprovalsV2)
        .where(
          and(
            eq(accPortageApprovalsV2.pbApprovalUuid, params.pbApprovalUuid),
            eq(accPortageApprovalsV2.isDeleted, false),
          ),
        );
      const fresh: AccPortageApprovalV2 | undefined = freshRows[0];
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
          .from(accPortageApprovalsV2)
          .where(
            and(
              eq(accPortageApprovalsV2.portageUuid, portage.portageUuid),
              eq(accPortageApprovalsV2.approverId, params.deciderId),
              eq(accPortageApprovalsV2.isDeleted, false),
            ),
          );
        const other = held.find(
          (a: AccPortageApprovalV2) =>
            a.pbApprovalUuid !== params.pbApprovalUuid,
        );
        if (other) {
          return fail(
            "FORBIDDEN",
            "You already hold another approver slot on this portage bill",
          );
        }
      }

      await tx
        .update(accPortageApprovalsV2)
        .set({
          approverId: fresh.approverId ?? params.deciderId ?? null,
          status: params.decision,
          comments: params.comments,
          date: new Date().toISOString().slice(0, 10),
          updatedByUuid: params.auditUserUuid,
          updatedAt: new Date(),
        })
        .where(eq(accPortageApprovalsV2.pbApprovalUuid, params.pbApprovalUuid));

      let updatedPortage: AccPortageBillV2 = portage;
      if (params.decision === "Rejected") {
        const rows = await tx
          .update(accPortageBillsV2)
          .set({
            status: "returned",
            updatedByUuid: params.auditUserUuid,
            updatedAt: new Date(),
          })
          .where(eq(accPortageBillsV2.portageUuid, portage.portageUuid))
          .returning();
        updatedPortage = rows[0];
      } else {
        const all: AccPortageApprovalV2[] = await tx
          .select()
          .from(accPortageApprovalsV2)
          .where(
            and(
              eq(accPortageApprovalsV2.portageUuid, portage.portageUuid),
              eq(accPortageApprovalsV2.isDeleted, false),
            ),
          );
        const allApproved =
          all.length > 0 &&
          all.every((a: AccPortageApprovalV2) => a.status === "Approved");
        if (allApproved) {
          if (params.autoLockOnApproval) {
            const rows = await tx
              .update(accPortageBillsV2)
              .set({
                status: "locked",
                isLocked: true,
                lockedByUuid: params.auditUserUuid,
                lockedDate: new Date().toISOString().slice(0, 10),
                updatedByUuid: params.auditUserUuid,
                updatedAt: new Date(),
              })
              .where(eq(accPortageBillsV2.portageUuid, portage.portageUuid))
              .returning();
            updatedPortage = rows[0];
            // Prompt 06: when the portage locks, the linked CTM locks too —
            // in the same transaction, so a failure rolls back everything.
            await tx
              .update(accCtmV2)
              .set({
                status: "locked",
                updatedByUuid: params.auditUserUuid,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(accCtmV2.vesselUuid, portage.vesselUuid),
                  eq(accCtmV2.period, portage.period),
                  eq(accCtmV2.isDeleted, false),
                ),
              );
          } else {
            const rows = await tx
              .update(accPortageBillsV2)
              .set({
                status: "approved",
                updatedByUuid: params.auditUserUuid,
                updatedAt: new Date(),
              })
              .where(eq(accPortageBillsV2.portageUuid, portage.portageUuid))
              .returning();
            updatedPortage = rows[0];
          }
        }
      }

      const approvals: AccPortageApprovalV2[] = await tx
        .select()
        .from(accPortageApprovalsV2)
        .where(
          and(
            eq(accPortageApprovalsV2.portageUuid, portage.portageUuid),
            eq(accPortageApprovalsV2.isDeleted, false),
          ),
        )
        .orderBy(accPortageApprovalsV2.id);
      return { portage: updatedPortage, approvals };
    });
  }

  async findLatestRun(
    portageUuid: string,
  ): Promise<AccCalculationRunV2 | undefined> {
    const db = getDb();
    const rows = await db
      .select()
      .from(accCalculationRunsV2)
      .where(eq(accCalculationRunsV2.portageUuid, portageUuid))
      .orderBy(desc(accCalculationRunsV2.id))
      .limit(1);
    return rows[0];
  }
}
