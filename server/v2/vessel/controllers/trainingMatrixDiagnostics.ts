/**
 * Presentation diagnostics only. Missing applicability is blank in the compact
 * matrix; keep each formerly-undetermined cell discoverable in application logs.
 * Never infer a rank from its label or change a compliance result.
 */
type DiagnosticCrew = {
  assignmentUuid: string;
  contractRankUuid: string | null;
  matrixRevisionUuid: string | null;
  context: { contractRankLabel: string };
  courses: readonly { courseUuid: string }[];
  issues: readonly { code: string; blocking?: boolean }[];
};
type DiagnosticRow = { courseUuid: string; companyTrainingId: number; companyId: string | null };
export type TrainingMatrixDiagnostic = {
  event: "training_matrix_requirement_undetermined";
  at: string;
  courseId: string;
  companyTrainingId: number;
  courseCode: string | null;
  rank: string | null;
  rankLabel: string;
  vessel: string;
  assignment: string;
  reasonCodes: string[];
};
const applicabilityFailures = new Set(["MISSING_RANK", "MISSING_MATRIX", "INVALID_MATRIX",
  "MATRIX_COURSE_UNAVAILABLE", "INVALID_REQUIREMENT", "CALCULATION_FAILED"]);

export function logUndeterminedTrainingMatrixCells(
  vessel: string,
  snapshot: { rows: readonly DiagnosticRow[]; crew: readonly DiagnosticCrew[] },
  emit: (entry: TrainingMatrixDiagnostic) => void = entry => console.warn(JSON.stringify(entry)),
): number {
  let occurrences = 0;
  const at = new Date().toISOString();
  for (const crew of snapshot.crew) {
    const failures = crew.issues.filter(issue => issue.blocking !== false && applicabilityFailures.has(issue.code));
    if (crew.contractRankUuid && crew.matrixRevisionUuid && !failures.length) continue;
    const knownCourses = new Set(crew.courses.map(course => course.courseUuid));
    for (const row of snapshot.rows) {
      if (knownCourses.has(row.courseUuid)) continue;
      emit({
        event: "training_matrix_requirement_undetermined", at,
        courseId: row.courseUuid, companyTrainingId: row.companyTrainingId, courseCode: row.companyId,
        rank: crew.contractRankUuid, rankLabel: crew.context.contractRankLabel,
        vessel, assignment: crew.assignmentUuid,
        reasonCodes: [...new Set([
          ...(!crew.contractRankUuid ? ["CAPTURED_RANK_MISSING"] : []),
          ...(!crew.matrixRevisionUuid ? ["MATRIX_REVISION_MISSING"] : []),
          ...failures.map(issue => issue.code),
        ])],
      });
      occurrences++;
    }
  }
  return occurrences;
}
