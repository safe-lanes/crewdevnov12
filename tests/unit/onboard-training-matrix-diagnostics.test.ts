import { describe, expect, it, vi } from "vitest";
import { logUndeterminedTrainingMatrixCells } from "../../server/v2/vessel/controllers/trainingMatrixDiagnostics";

const fixture = () => ({
  rows: [
    { courseUuid: "required-course-a", companyTrainingId: 10, companyId: "SA001" },
    { courseUuid: "required-course-b", companyTrainingId: 11, companyId: "SA002" },
  ],
  crew: [{
    assignmentUuid: "captured-assignment", contractRankUuid: null as string | null,
    matrixRevisionUuid: "saved-revision" as string | null,
    context: { contractRankLabel: "Not recorded" }, courses: [] as { courseUuid: string }[],
    issues: [] as { code: string; blocking?: boolean }[],
  }],
});
describe("compact matrix server-owned configuration diagnostics", () => {
  it("logs every missing-rank cell with the course, captured rank, vessel and exact assignment", () => {
    const snapshot = fixture(), before = structuredClone(snapshot), emit = vi.fn();
    expect(logUndeterminedTrainingMatrixCells("fixture-vessel", snapshot, emit)).toBe(2);
    expect(emit.mock.calls.map(([event]) => event.courseId)).toEqual(["required-course-a", "required-course-b"]);
    expect(emit.mock.calls[0][0]).toMatchObject({
      event: "training_matrix_requirement_undetermined", courseId: "required-course-a",
      companyTrainingId: 10, courseCode: "SA001", rank: null, rankLabel: "Not recorded",
      vessel: "fixture-vessel", assignment: "captured-assignment", reasonCodes: ["CAPTURED_RANK_MISSING"],
    });
    expect(Number.isFinite(Date.parse(emit.mock.calls[0][0].at))).toBe(true);
    expect(snapshot).toEqual(before);
  });
  it("does not log a known requirement or invent a fault for a genuinely not-required rank", () => {
    const snapshot = fixture(), emit = vi.fn();
    snapshot.crew[0].courses = [{ courseUuid: "required-course-a" }];
    expect(logUndeterminedTrainingMatrixCells("vessel", snapshot, emit)).toBe(1);
    expect(emit.mock.calls[0][0].courseId).toBe("required-course-b");
    snapshot.crew[0].contractRankUuid = "captured-rank";
    expect(logUndeterminedTrainingMatrixCells("vessel", snapshot, vi.fn())).toBe(0);
  });
  it.each(["MISSING_RANK", "MISSING_MATRIX", "INVALID_MATRIX", "MATRIX_COURSE_UNAVAILABLE",
    "INVALID_REQUIREMENT", "CALCULATION_FAILED"])("logs explicit applicability fault %s", code => {
    const snapshot = fixture(), emit = vi.fn();
    snapshot.crew[0].contractRankUuid = "captured-rank";
    snapshot.crew[0].issues = [{ code }];
    expect(logUndeterminedTrainingMatrixCells("vessel", snapshot, emit)).toBe(2);
    expect(emit.mock.calls[0][0].reasonCodes).toEqual([code]);
  });
  it("does not mistake another certificate's invalid dates or nonblocking warning for unknown applicability", () => {
    const snapshot = fixture(), emit = vi.fn();
    snapshot.crew[0].contractRankUuid = "captured-rank";
    snapshot.crew[0].issues = [{ code: "INVALID_CERTIFICATE_DATES" }, { code: "INVALID_MATRIX", blocking: false }];
    expect(logUndeterminedTrainingMatrixCells("vessel", snapshot, emit)).toBe(0);
    expect(emit).not.toHaveBeenCalled();
  });
  it("records missing revision and every repeat request rather than silently deduplicating faults", () => {
    const snapshot = fixture(), emit = vi.fn();
    snapshot.crew[0].contractRankUuid = "captured-rank";
    snapshot.crew[0].matrixRevisionUuid = null;
    expect(logUndeterminedTrainingMatrixCells("vessel", snapshot, emit)).toBe(2);
    expect(logUndeterminedTrainingMatrixCells("vessel", snapshot, emit)).toBe(2);
    expect(emit).toHaveBeenCalledTimes(4);
    expect(emit.mock.calls[0][0].reasonCodes).toEqual(["MATRIX_REVISION_MISSING"]);
  });
});
