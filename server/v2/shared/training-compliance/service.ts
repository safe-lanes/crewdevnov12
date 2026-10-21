import { getDb } from "../../db";
import { calculateTrainingCompliance, incompleteTrainingCheck } from "./calculator";
import { readCanonicalReliever, readSavedTrainingMatrix, readTrainingCertificates,
  type RelieverCheckRequest } from "./reader";
import type { ComplianceResult } from "./types";

/**
 * Server-internal only. Future HTTP callers must authorize the assignment before
 * calling; this function introduces no route, grant, attachment URL or UI.
 * One tenant connection, one repeatable snapshot, PostgreSQL-enforced read-only.
 */
export async function calculateRelieverTrainingCompliance(request: RelieverCheckRequest): Promise<ComplianceResult> {
  const context: { assignmentUuid: string; vesselUuid: string | null } =
    { assignmentUuid: request.assignmentUuid, vesselUuid: null };
  try {
    return await getDb().transaction((db: ReturnType<typeof getDb>) => readRelieverTrainingCompliance(db, request),
      { isolationLevel: "repeatable read", accessMode: "read only" });
  } catch {
    return incompleteTrainingCheck(context, [{ code: "CALCULATION_FAILED",
      message: "The training check could not finish. Retry it; if it fails again, contact your office." }]);
  }
}

/** Same calculation inside an already opened tenant read-only snapshot. */
export async function readRelieverTrainingCompliance(db: ReturnType<typeof getDb>,
  request: RelieverCheckRequest): Promise<ComplianceResult> {
  const canonical = await readCanonicalReliever(db, request);
  if (!canonical) return incompleteTrainingCheck({ assignmentUuid: request.assignmentUuid, vesselUuid: null },
    [{ code: "ASSIGNMENT_UNAVAILABLE", message: "The linked reliever assignment is unavailable. Reload Planning and retry the training check." }]);
  const { matrix, issues } = await readSavedTrainingMatrix(db, canonical, request.matrixRevisionUuid);
  if (canonical.contractRankUuid && !canonical.rankRowId) issues.push({ code: "MISSING_RANK",
    message: "The captured contract rank is unavailable in the rank master. Ask the office to review it and retry." });
  return calculateTrainingCompliance({ ...canonical, matrix,
    certificates: await readTrainingCertificates(db, canonical.crewUuid), issues });
}
