import { describe, expect, it } from "vitest";
import { buildAppraisalChanges, snapshotFromServer, type AppraisalSnapshot } from "@/modules/crewing/appraisalChanges";
import { PART_G_SECTIONS, autoTrainingRowUuid, isEmptyChanges, sameValue } from "@shared/v2/appraisals/appraisalChanges";

const T1 = "10000000-0000-4000-8000-000000000001";
const T2 = "10000000-0000-4000-8000-000000000002";
const G1 = "20000000-0000-4000-8000-000000000001";

function serverCopy(): AppraisalSnapshot {
  return snapshotFromServer(
    { appraisalType: "Annual", appraisalDate: "2026-10-01", competenceRating: "80.0", behavioralRating: null, overallRating: "80.0", status: "draft" },
    {
      seafarersName: "A. Seafarer",
      seafarersRank: "Master",
      vessel: "vessel-uuid",
      signOn: null,
      trainings: [
        { id: "1", uuid: T1, training: "Fire fighting", evaluation: "Good", comment: "", source: "manual" },
        { id: "2", uuid: T2, training: "First aid", evaluation: "", comment: "Due", source: "manual" },
      ],
      competenceAssessments: [{ id: "1", uuid: "c1", assessmentCriteria: "Leadership", weight: 20, effectiveness: "", comment: "" }],
      officeReviews: [{ id: "1", uuid: G1, name: "Office", position: "Manager", feedback: "Office note", userUuid: null, isAssigned: true }],
    },
  );
}

// The form as the user sees it right after load (what the save builds from).
function formCopy(base: AppraisalSnapshot): AppraisalSnapshot {
  return structuredClone({
    header: { ...base.header, signOn: "" },
    sections: base.sections,
  });
}

describe("appraisal save-draft change set (APD-16)", () => {
  it("is empty when nothing changed", () => {
    const base = serverCopy();
    expect(isEmptyChanges(buildAppraisalChanges(base, formCopy(base)))).toBe(true);
  });

  it("sends only the changed field of the changed row", () => {
    const base = serverCopy();
    const current = formCopy(base);
    current.sections.trainings![1].comment = "Done";

    expect(buildAppraisalChanges(base, current)).toEqual({
      sections: { trainings: { rows: [{ uuid: T2, comment: "Done" }] } },
    });
  });

  it("sends a new row with its non-empty fields and a removed row as a deleted uuid", () => {
    const base = serverCopy();
    const current = formCopy(base);
    current.sections.trainings!.splice(0, 1);
    current.sections.trainings!.push({ id: "999", uuid: "new-row", training: "ECDIS", evaluation: "", comment: null, source: "manual" });

    expect(buildAppraisalChanges(base, current).sections).toEqual({
      trainings: {
        rows: [{ uuid: "new-row", training: "ECDIS", source: "manual" }],
        deleted: [T1],
      },
    });
  });

  // APD-20: a B1 auto row has the same uuid in every session that adds it, so a
  // session sending it as new must not blank what another session saved in it.
  it("keeps false and 0 on a new row, which are values, not empty fields", () => {
    const base = serverCopy();
    const current = formCopy(base);
    current.sections.officeReviews!.push({ id: "n", uuid: "g1-new", name: "Manual", position: "", feedback: "", userUuid: "user-m", isAssigned: false });
    current.sections.competenceAssessments!.push({ id: "n", uuid: "c-new", assessmentCriteria: "Safety", weight: 0, effectiveness: "", comment: "" });

    expect(buildAppraisalChanges(base, current).sections).toEqual({
      officeReviews: { rows: [{ uuid: "g1-new", name: "Manual", userUuid: "user-m", isAssigned: false }] },
      competenceAssessments: { rows: [{ uuid: "c-new", assessmentCriteria: "Safety", weight: 0 }] },
    });
  });

  it("still lets a stored row's field be cleared", () => {
    const base = serverCopy();
    const current = formCopy(base);
    current.sections.trainings![1].comment = "";

    expect(buildAppraisalChanges(base, current).sections).toEqual({
      trainings: { rows: [{ uuid: T2, comment: "" }] },
    });
  });

  it("treats null, undefined and empty string as equal, and numbers as their string form", () => {
    const base = serverCopy();
    const current = formCopy(base);
    current.sections.competenceAssessments![0].weight = "20";
    current.sections.trainings![0].comment = null;
    delete current.sections.trainings![1].source;

    expect(isEmptyChanges(buildAppraisalChanges(base, current))).toBe(true);
    expect(sameValue(null, "")).toBe(true);
    expect(sameValue(false, null)).toBe(false);
  });

  it("never sends Part G when it is skipped, even if it changed", () => {
    const base = serverCopy();
    const current = formCopy(base);
    current.sections.officeReviews![0].feedback = "stale ship copy";
    current.sections.trainingFollowups = [{ id: "x", uuid: "g2-new", training: "Seeded" }];

    const changes = buildAppraisalChanges(base, current, { skipSections: PART_G_SECTIONS });
    expect(isEmptyChanges(changes)).toBe(true);
  });

  it("sends only header fields that changed", () => {
    const base = serverCopy();
    const current = formCopy(base);
    current.header.overallRating = "85.0";
    current.header.status = "draft";
    current.header.nationality = undefined;

    expect(buildAppraisalChanges(base, current).header).toEqual({ overallRating: "85.0" });
  });

  it("refuses a row without a uuid", () => {
    const base = serverCopy();
    const current = formCopy(base);
    current.sections.targets = [{ id: "1", targetSetting: "x" }];

    expect(() => buildAppraisalChanges(base, current)).toThrow(/targets row has no uuid/);
  });
});

describe("B1 auto-row uuid (APD-20)", () => {
  const A1 = "a0000000-0000-4000-8000-000000000001";
  const A2 = "a0000000-0000-4000-8000-000000000002";
  const AUTO_ROW_UUID_A1_TRAIN_1 = "52846c3d-c7c7-50c9-90c4-57d1fce60918";

  it("is the same every time for the same appraisal and course", () => {
    expect(autoTrainingRowUuid(A1, "train-1")).toBe(autoTrainingRowUuid(A1, "train-1"));
    expect(autoTrainingRowUuid(A1, "train-1")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("differs per appraisal and per course", () => {
    expect(autoTrainingRowUuid(A1, "train-1")).not.toBe(autoTrainingRowUuid(A2, "train-1"));
    expect(autoTrainingRowUuid(A1, "train-1")).not.toBe(autoTrainingRowUuid(A1, "train-2"));
  });

  it("never changes for a stored input (rows saved with it depend on it)", () => {
    expect(autoTrainingRowUuid(A1, "train-1")).toBe(AUTO_ROW_UUID_A1_TRAIN_1);
  });
});
