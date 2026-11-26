import { eq, and, desc, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { admVesselRevisionsV2 } from "../../../../shared/v2/admin/schema";
import type { AdmVesselRevisionV2, InsertAdmVesselRevisionV2 } from "../../../../shared/v2/admin/types";
import { v4 as uuidv4 } from "uuid";
import { capturedInsert, capturedUpdate, inTx } from "../../sync/capturedWrite";

export class VesselRevisionsRepository {
  async findAll(): Promise<AdmVesselRevisionV2[]> {
    const db = getDb();
    return db
      .select()
      .from(admVesselRevisionsV2)
      .where(eq(admVesselRevisionsV2.isDeleted, false))
      .orderBy(desc(admVesselRevisionsV2.createdAt));
  }

  async findById(id: number): Promise<AdmVesselRevisionV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admVesselRevisionsV2)
      .where(and(eq(admVesselRevisionsV2.id, id), eq(admVesselRevisionsV2.isDeleted, false)));
    return results[0];
  }

  async findByUuid(vrUuid: string): Promise<AdmVesselRevisionV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admVesselRevisionsV2)
      .where(and(eq(admVesselRevisionsV2.vrUuid, vrUuid), eq(admVesselRevisionsV2.isDeleted, false)));
    return results[0];
  }

  async findByVesselId(vesselId: string): Promise<AdmVesselRevisionV2[]> {
    const db = getDb();
    return db
      .select()
      .from(admVesselRevisionsV2)
      .where(and(eq(admVesselRevisionsV2.vesselId, vesselId), eq(admVesselRevisionsV2.isDeleted, false)))
      .orderBy(desc(admVesselRevisionsV2.createdAt));
  }

  // Writes go through the capture helpers (SYN-02): adm_vessel_revisions_v2 syncs
  // office to ship, so a write that is not captured would never reach the ship.
  async create(data: Omit<InsertAdmVesselRevisionV2, "vrUuid">): Promise<AdmVesselRevisionV2> {
    return capturedInsert<AdmVesselRevisionV2>(null, admVesselRevisionsV2, "vrUuid", {
      ...data,
      vrUuid: uuidv4(),
    });
  }

  async updateById(id: number, data: Partial<InsertAdmVesselRevisionV2>): Promise<AdmVesselRevisionV2 | undefined> {
    const current = await this.findById(id);
    if (!current) return undefined;
    return capturedUpdate<AdmVesselRevisionV2>(
      null, admVesselRevisionsV2, "vrUuid", current.vrUuid,
      { ...data, updatedAt: new Date() }, undefined, eq(admVesselRevisionsV2.isDeleted, false),
    );
  }

  async softDeleteById(id: number): Promise<boolean> {
    const current = await this.findById(id);
    if (!current) return false;
    const row = await capturedUpdate<AdmVesselRevisionV2>(
      null, admVesselRevisionsV2, "vrUuid", current.vrUuid,
      { isDeleted: true, updatedAt: new Date() }, undefined, eq(admVesselRevisionsV2.isDeleted, false),
    );
    return !!row;
  }

  // Import rollback: soft delete the revisions an import created (they used to be
  // hard deleted, which no other side could ever learn about). One transaction.
  async softDeleteByIds(ids: number[], actorUuid?: string | null): Promise<number> {
    if (ids.length === 0) return 0;
    return inTx(null, async (tx: any) => {
      const rows = await tx.select().from(admVesselRevisionsV2)
        .where(and(inArray(admVesselRevisionsV2.id, ids), eq(admVesselRevisionsV2.isDeleted, false)));
      for (const row of rows) {
        await capturedUpdate(tx, admVesselRevisionsV2, "vrUuid", row.vrUuid,
          { isDeleted: true, updatedAt: new Date(), ...(actorUuid ? { updatedByUuid: actorUuid } : {}) }, actorUuid ?? null);
      }
      return rows.length;
    });
  }

  async getNextRevision(vesselId: string): Promise<string> {
    const db = getDb();
    const revisions = await db
      .select()
      .from(admVesselRevisionsV2)
      .where(and(eq(admVesselRevisionsV2.vesselId, vesselId), eq(admVesselRevisionsV2.isDeleted, false)));

    if (revisions.length === 0) {
      return "R0";
    }

    let maxNum = -1;
    for (const rev of revisions) {
      const match = rev.revision.match(/^R(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }

    return `R${maxNum + 1}`;
  }
}
