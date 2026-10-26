import { TrainingMatrixVesselDraftsRepository } from "../repositories/trainingMatrixVesselDraftsRepository";
import { applyAuditUser } from "../utils/auditUser";
import type { AdmTrainingMatrixVesselDraftV2, InsertAdmTrainingMatrixVesselDraftV2 } from "../../../../shared/v2/admin/types";
import { admTrainingMatrixVesselDraftsV2 as table } from "../../../../shared/v2/admin/schema";
import { and, eq, desc } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { withMatrixLock, inheritMatrixEquivalents, MatrixPolicyError, nextMatrixRevision } from "./trainingMatrixEquivalents";

const tmVesselDraftsRepo = new TrainingMatrixVesselDraftsRepository();

export const trainingMatrixVesselDraftsService = {
  async getAll(): Promise<AdmTrainingMatrixVesselDraftV2[]> {
    return tmVesselDraftsRepo.findAll();
  },

  async getById(id: number): Promise<AdmTrainingMatrixVesselDraftV2> {
    const record = await tmVesselDraftsRepo.findById(id);
    if (!record) throw new Error(`Training matrix vessel draft not found: ${id}`);
    return record;
  },

  async getByVesselId(vesselId: string): Promise<AdmTrainingMatrixVesselDraftV2[]> {
    return tmVesselDraftsRepo.findByVesselId(vesselId);
  },

  async create(data: Omit<InsertAdmTrainingMatrixVesselDraftV2, "tmvdUuid">): Promise<AdmTrainingMatrixVesselDraftV2> {
    return this.upsert(data);
  },

  async updateById(id: number, data: Partial<InsertAdmTrainingMatrixVesselDraftV2>): Promise<AdmTrainingMatrixVesselDraftV2> {
    const existing = await this.getById(id);
    if (data.vesselId && data.vesselId !== existing.vesselId)
      throw new MatrixPolicyError(400, "A draft cannot be moved to another vessel.");
    return withMatrixLock(existing.vesselId, async tx => {
      const [updated] = await tx.update(table).set(applyAuditUser(data))
        .where(and(eq(table.id, id), eq(table.isDeleted, false))).returning();
      if (!updated) throw new MatrixPolicyError(409, "This draft changed. Reload it before saving.");
      return updated;
    });
  },

  async deleteById(id: number): Promise<boolean> {
    const existing = await this.getById(id);
    return withMatrixLock(existing.vesselId, async tx => {
      const rows = await tx.update(table).set({ isDeleted: true, updatedAt: new Date() })
        .where(and(eq(table.id, id), eq(table.isDeleted, false))).returning();
      return rows.length > 0;
    });
  },

  async upsert(data: Omit<InsertAdmTrainingMatrixVesselDraftV2, "tmvdUuid">): Promise<AdmTrainingMatrixVesselDraftV2> {
    return withMatrixLock(data.vesselId, async tx => {
      const existing = await tx.select().from(table)
        .where(and(eq(table.vesselId, data.vesselId), eq(table.isDeleted, false)))
        .orderBy(desc(table.updatedAt), desc(table.id)).limit(1);
      if (existing[0]) {
        const [updated] = await tx.update(table).set(applyAuditUser(data))
          .where(eq(table.id, existing[0].id)).returning();
        return updated;
      }
      const [created] = await tx.insert(table).values({ ...applyAuditUser(data, true),
        revision: await nextMatrixRevision(tx, data.vesselId), tmvdUuid: randomUUID() }).returning();
      await inheritMatrixEquivalents(tx, data.vesselId, created.tmvdUuid, (data as any).auditUserUuid);
      return created;
    });
  },
};
