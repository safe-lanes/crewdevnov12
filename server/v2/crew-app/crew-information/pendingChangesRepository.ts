import { eq, and, desc, isNull } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db";
import { appCrewPendingChanges, appCrewAppSettings } from "../../../../shared/v2/crew-app/schema";
import type { AppCrewPendingChange } from "../../../../shared/v2/crew-app/types";

export interface StageChangeInput {
  domain: string;
  crewUuid: string;
  section: string;
  action: "create" | "update" | "delete";
  targetUuid?: string | null;
  payload: unknown;
}

export class PendingChangesRepository {
  /**
   * Insert-or-amend: if the crew member already has an open ('pending') edit
   * for the same section+target, that row's payload is replaced instead of
   * stacking a second pending row for the same slot — keeps the review queue
   * to one row per open edit.
   */
  async stage(input: StageChangeInput): Promise<AppCrewPendingChange> {
    const db = getDb();
    const existing = await db
      .select()
      .from(appCrewPendingChanges)
      .where(and(
        eq(appCrewPendingChanges.crewUuid, input.crewUuid),
        eq(appCrewPendingChanges.domain, input.domain),
        eq(appCrewPendingChanges.section, input.section),
        eq(appCrewPendingChanges.action, input.action),
        input.targetUuid ? eq(appCrewPendingChanges.targetUuid, input.targetUuid) : isNull(appCrewPendingChanges.targetUuid),
        eq(appCrewPendingChanges.status, "pending"),
        eq(appCrewPendingChanges.isDeleted, false),
      ));

    if (existing[0]) {
      const [updated] = await db
        .update(appCrewPendingChanges)
        .set({ payload: JSON.stringify(input.payload ?? {}), updatedByUuid: input.crewUuid, updatedAt: new Date() })
        .where(eq(appCrewPendingChanges.pendingUuid, existing[0].pendingUuid))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(appCrewPendingChanges)
      .values({
        pendingUuid: uuidv4(),
        domain: input.domain,
        crewUuid: input.crewUuid,
        section: input.section,
        action: input.action,
        targetUuid: input.targetUuid ?? null,
        payload: JSON.stringify(input.payload ?? {}),
        stagedAttachments: "[]",
        status: "pending",
        createdByUuid: input.crewUuid,
        updatedByUuid: input.crewUuid,
      })
      .returning();
    return created;
  }

  async findByUuid(pendingUuid: string): Promise<AppCrewPendingChange | undefined> {
    const db = getDb();
    const result = await db.select().from(appCrewPendingChanges)
      .where(and(eq(appCrewPendingChanges.pendingUuid, pendingUuid), eq(appCrewPendingChanges.isDeleted, false)));
    return result[0];
  }

  /** All open (pending) rows for one crew member — used to overlay status onto getInformation()/collectionHandler responses. */
  async listOpenForCrew(crewUuid: string, domain: string): Promise<AppCrewPendingChange[]> {
    const db = getDb();
    return db.select().from(appCrewPendingChanges)
      .where(and(
        eq(appCrewPendingChanges.crewUuid, crewUuid),
        eq(appCrewPendingChanges.domain, domain),
        eq(appCrewPendingChanges.status, "pending"),
        eq(appCrewPendingChanges.isDeleted, false),
      ))
      .orderBy(desc(appCrewPendingChanges.createdAt));
  }

  /** Recent submissions (any status) for one crew member — for a "my submissions" view on the mobile app. */
  async listRecentForCrew(crewUuid: string, domain: string, limit = 20): Promise<AppCrewPendingChange[]> {
    const db = getDb();
    return db.select().from(appCrewPendingChanges)
      .where(and(
        eq(appCrewPendingChanges.crewUuid, crewUuid),
        eq(appCrewPendingChanges.domain, domain),
        eq(appCrewPendingChanges.isDeleted, false),
      ))
      .orderBy(desc(appCrewPendingChanges.createdAt))
      .limit(limit);
  }

  async listForOffice(filters: { status?: string; section?: string; crewUuid?: string }): Promise<AppCrewPendingChange[]> {
    const db = getDb();
    const conditions = [eq(appCrewPendingChanges.isDeleted, false)];
    if (filters.status) conditions.push(eq(appCrewPendingChanges.status, filters.status));
    if (filters.section) conditions.push(eq(appCrewPendingChanges.section, filters.section));
    if (filters.crewUuid) conditions.push(eq(appCrewPendingChanges.crewUuid, filters.crewUuid));
    return db.select().from(appCrewPendingChanges).where(and(...conditions)).orderBy(desc(appCrewPendingChanges.createdAt));
  }

  /** Appends one staged attachment (assigned its own attUuid) to a still-pending 'create' row. */
  async appendStagedAttachment(pendingUuid: string, attachment: Record<string, unknown>): Promise<{ row: AppCrewPendingChange; attUuid: string }> {
    const db = getDb();
    const row = await this.findByUuid(pendingUuid);
    if (!row) throw Object.assign(new Error("Pending change not found"), { status: 404 });
    const attUuid = uuidv4();
    const current: unknown[] = JSON.parse(row.stagedAttachments || "[]");
    current.push({ ...attachment, attUuid, createdAt: new Date().toISOString() });
    const [updated] = await db
      .update(appCrewPendingChanges)
      .set({ stagedAttachments: JSON.stringify(current), updatedAt: new Date() })
      .where(eq(appCrewPendingChanges.pendingUuid, pendingUuid))
      .returning();
    return { row: updated, attUuid };
  }

  /** Removes one staged attachment by attUuid and returns it (so the caller can delete the underlying stored file), or undefined if not found. */
  async removeStagedAttachment(pendingUuid: string, attUuid: string): Promise<any | undefined> {
    const db = getDb();
    const row = await this.findByUuid(pendingUuid);
    if (!row) throw Object.assign(new Error("Pending change not found"), { status: 404 });
    const current: any[] = JSON.parse(row.stagedAttachments || "[]");
    const removed = current.find((a) => a.attUuid === attUuid);
    const next = current.filter((a) => a.attUuid !== attUuid);
    await db
      .update(appCrewPendingChanges)
      .set({ stagedAttachments: JSON.stringify(next), updatedAt: new Date() })
      .where(eq(appCrewPendingChanges.pendingUuid, pendingUuid));
    return removed;
  }

  async markApproved(pendingUuid: string, reviewer: { uuid: string; name: string | null }): Promise<AppCrewPendingChange> {
    const db = getDb();
    const [updated] = await db
      .update(appCrewPendingChanges)
      .set({
        status: "approved",
        reviewedByUuid: reviewer.uuid,
        reviewedByName: reviewer.name,
        reviewedAt: new Date(),
        updatedByUuid: reviewer.uuid,
        updatedAt: new Date(),
      })
      .where(eq(appCrewPendingChanges.pendingUuid, pendingUuid))
      .returning();
    return updated;
  }

  async markRejected(pendingUuid: string, reviewer: { uuid: string; name: string | null }, reason: string): Promise<AppCrewPendingChange> {
    const db = getDb();
    const [updated] = await db
      .update(appCrewPendingChanges)
      .set({
        status: "rejected",
        rejectionReason: reason,
        reviewedByUuid: reviewer.uuid,
        reviewedByName: reviewer.name,
        reviewedAt: new Date(),
        updatedByUuid: reviewer.uuid,
        updatedAt: new Date(),
      })
      .where(eq(appCrewPendingChanges.pendingUuid, pendingUuid))
      .returning();
    return updated;
  }

  async getSettings(domain: string): Promise<{ requireOfficeVerification: boolean } | undefined> {
    const db = getDb();
    const result = await db.select().from(appCrewAppSettings)
      .where(and(eq(appCrewAppSettings.domain, domain), eq(appCrewAppSettings.isDeleted, false)));
    return result[0];
  }
}

export const pendingChangesRepository = new PendingChangesRepository();
