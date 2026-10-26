import { TrainingMatrixVesselRevisionsRepository } from "../repositories/trainingMatrixVesselRevisionsRepository";
import { TrainingMatrixVesselDraftsRepository } from "../repositories/trainingMatrixVesselDraftsRepository";
import { applyAuditUser } from "../utils/auditUser";
import type { AdmTrainingMatrixVesselRevisionV2, InsertAdmTrainingMatrixVesselRevisionV2 } from "../../../../shared/v2/admin/types";
import { admTrainingMatrixVesselRevisionsV2 as revisions, admTrainingMatrixVesselDraftsV2 as drafts } from "../../../../shared/v2/admin/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { withMatrixLock, freezeMatrixEquivalents, nextMatrixRevision, MatrixPolicyError } from "./trainingMatrixEquivalents";

const tmVesselRevisionsRepo = new TrainingMatrixVesselRevisionsRepository();
const tmVesselDraftsRepo = new TrainingMatrixVesselDraftsRepository();

export const trainingMatrixVesselRevisionsService = {
  async getAll(): Promise<AdmTrainingMatrixVesselRevisionV2[]> {
    return tmVesselRevisionsRepo.findAll();
  },

  async getById(id: number): Promise<AdmTrainingMatrixVesselRevisionV2> {
    const record = await tmVesselRevisionsRepo.findById(id);
    if (!record) throw new Error(`Training matrix vessel revision not found: ${id}`);
    return record;
  },

  async getByVesselId(vesselId: string): Promise<AdmTrainingMatrixVesselRevisionV2[]> {
    return tmVesselRevisionsRepo.findByVesselId(vesselId);
  },

  async create(data: Omit<InsertAdmTrainingMatrixVesselRevisionV2, "tmvrUuid">): Promise<AdmTrainingMatrixVesselRevisionV2> {
    return withMatrixLock(data.vesselId, async tx => {
      const next = await nextMatrixRevision(tx, data.vesselId);
      if (data.revision && data.revision !== next)
        throw new MatrixPolicyError(409, "The next revision number has changed. Reload the matrix before publishing.");
      const [created] = await tx.insert(revisions).values({
        ...applyAuditUser(data, true), revision: next, tmvrUuid: randomUUID(),
      }).returning();
      await freezeMatrixEquivalents(tx, data.vesselId, created.tmvrUuid, (data as any).auditUserUuid);
      // Both publication entry points end the draft; future editing clones the
      // frozen revision rather than retaining a stale second policy.
      await tx.delete(drafts).where(eq(drafts.vesselId, data.vesselId));
      return created;
    });
  },

  async getNextRevision(vesselId: string): Promise<string> {
    return tmVesselRevisionsRepo.getNextRevision(vesselId);
  },

  async submit(data: { vesselId: string; revisionData: string; revisionDate: string; auditUserUuid?: string | null }): Promise<{
    success: boolean;
    revision: AdmTrainingMatrixVesselRevisionV2;
    metadata: { autoAssignedRevision: string; deletedDrafts: number };
  }> {
    return withMatrixLock(data.vesselId, async tx => {
      const autoAssignedRevision = await nextMatrixRevision(tx, data.vesselId);
      const [revision] = await tx.insert(revisions).values({
        ...applyAuditUser({ ...data, revision: autoAssignedRevision }, true), tmvrUuid: randomUUID(),
      }).returning();
      await freezeMatrixEquivalents(tx, data.vesselId, revision.tmvrUuid, data.auditUserUuid!);
      const deleted = await tx.delete(drafts).where(eq(drafts.vesselId, data.vesselId)).returning();
      return { success: true, revision, metadata: { autoAssignedRevision, deletedDrafts: deleted.length } };
    });
  },
};
