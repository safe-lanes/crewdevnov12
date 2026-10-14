import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { frmSubjectStages } from "../../../shared/v2/forms-engine/subjectRegistry";
import type { SubjectStage } from "./contracts";

/**
 * Stage membership is always read from the persisted subject registry. A
 * subject with no rows is stage-less; the core does not invent stages.
 */
export async function loadPersistedSubjectStages(
  subjectType: string,
  executor: any = getDb(),
): Promise<readonly SubjectStage[]> {
  const rows = await executor
    .select({
      stageKey: frmSubjectStages.stageKey,
      label: frmSubjectStages.label,
      sortOrder: frmSubjectStages.sortOrder,
    })
    .from(frmSubjectStages)
    .where(eq(frmSubjectStages.subjectType, subjectType))
    .orderBy(asc(frmSubjectStages.sortOrder), asc(frmSubjectStages.stageKey));

  return rows;
}