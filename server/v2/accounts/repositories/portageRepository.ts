import { eq, and, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db";
import {
  accPortageBillsV2,
  accPortageApprovalsV2,
  accCalculationRunsV2,
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
