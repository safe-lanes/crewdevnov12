import { describe, expect, it } from "vitest";
import { buildB1AutoRows, type B1TrainingRow, type D3TrainingCourse } from "@/modules/crewing/b1AutoTrainings";
import { buildAppraisalChanges, snapshotFromServer } from "@/modules/crewing/appraisalChanges";
import { autoTrainingRowUuid } from "@shared/v2/appraisals/appraisalChanges";

// APD-42: B1 auto rows are matched to their D3 course by the stored link, not
// by name, so reopening a draft never changes or drops a row on its own.

const APPRAISAL = "a0000000-0000-4000-8000-000000000042";
const OUT = "2020-01-01";
const IN = "2026-03-01";

function course(trainUuid: string, name: string, issued = IN): D3TrainingCourse {
  return { trainUuid, trainingCourse: name, issued };
}

// A row as the GET response returns it (ids are positions).
function stored(id: number, fields: Partial<B1TrainingRow>): B1TrainingRow {
  return { id: String(id), uuid: `row-${id}`, training: "Fire fighting", evaluation: "", comment: "", source: "auto", sourceTrainUuid: null, ...fields };
}

// The comment state the form loads with the rows.
function loadedComments(rows: B1TrainingRow[]): Record<string, string | null> {
  return Object.fromEntries(rows.filter((r) => r.comment).map((r) => [r.id, r.comment!]));
}

function rebuild(courses: D3TrainingCourse[], rows: B1TrainingRow[], comments = loadedComments(rows)) {
  return buildB1AutoRows({ appraisalUuid: APPRAISAL, courses, inWindow: (c) => c.issued !== OUT, rows, comments });
}

// What Save Draft would send right after the form opened.
function changesOnOpen(courses: D3TrainingCourse[], rows: B1TrainingRow[]) {
  const base = snapshotFromServer({}, { trainings: rows });
  const current = { header: base.header, sections: { ...base.sections, trainings: rebuild(courses, rows).rows } };
  return buildAppraisalChanges(base, current);
}

describe("B1 auto rows keep their D3 course (APD-42)", () => {
  it("reopening a linked draft changes nothing", () => {
    const rows = [
      stored(1, { training: "Fire fighting", evaluation: "Good", comment: "keep me", sourceTrainUuid: "train-a" }),
      stored(2, { training: "First aid", evaluation: "Fair", sourceTrainUuid: "train-b" }),
      stored(3, { training: "Bridge watch", evaluation: "Good", source: "manual" }),
    ];
    const courses = [course("train-a", "Fire fighting"), course("train-b", "First aid")];

    const out = rebuild(courses, rows).rows;
    expect(out.map((r) => [r.uuid, r.evaluation, r.comment])).toEqual([
      ["row-1", "Good", "keep me"], ["row-2", "Fair", ""], ["row-3", "Good", ""],
    ]);
    expect(changesOnOpen(courses, rows)).toEqual({});
  });

  it("a renamed course keeps its evaluation and comment; only the new name is sent", () => {
    const rows = [stored(1, { evaluation: "Good", comment: "keep me", sourceTrainUuid: "train-a" })];
    const courses = [course("train-a", "Fire fighting (advanced)")];

    expect(rebuild(courses, rows).rows[0]).toMatchObject({ uuid: "row-1", training: "Fire fighting (advanced)", evaluation: "Good", comment: "keep me" });
    expect(changesOnOpen(courses, rows)).toEqual({
      sections: { trainings: { rows: [{ uuid: "row-1", training: "Fire fighting (advanced)" }] } },
    });
  });

  it("a renamed course whose row predates the link is found by its APD-20 uuid", () => {
    const uuid = autoTrainingRowUuid(APPRAISAL, "train-a");
    const rows = [stored(1, { uuid, evaluation: "Good", comment: "keep me" })];
    const courses = [course("train-a", "Fire fighting (advanced)")];

    expect(changesOnOpen(courses, rows)).toEqual({
      sections: { trainings: { rows: [{ uuid, training: "Fire fighting (advanced)", sourceTrainUuid: "train-a" }] } },
    });
  });

  it("two courses with the same name keep their own rows", () => {
    const uuidA = autoTrainingRowUuid(APPRAISAL, "train-a");
    const uuidC = autoTrainingRowUuid(APPRAISAL, "train-c");
    const rows = [stored(1, { uuid: uuidA, evaluation: "Good" }), stored(2, { uuid: uuidC, evaluation: "Fair" })];
    const courses = [course("train-a", "Fire fighting"), course("train-c", "Fire fighting")];

    expect(rebuild(courses, rows).rows.map((r) => [r.uuid, r.evaluation])).toEqual([[uuidA, "Good"], [uuidC, "Fair"]]);
    // Only the one-time link fill; nothing deleted.
    expect(changesOnOpen(courses, rows)).toEqual({
      sections: { trainings: { rows: [{ uuid: uuidA, sourceTrainUuid: "train-a" }, { uuid: uuidC, sourceTrainUuid: "train-c" }] } },
    });
  });

  it("a row from before APD-20 is still found by name, then linked", () => {
    const rows = [stored(1, { uuid: "legacy-1", evaluation: "Good" })];
    const courses = [course("train-a", "Fire fighting")];

    expect(changesOnOpen(courses, rows)).toEqual({
      sections: { trainings: { rows: [{ uuid: "legacy-1", sourceTrainUuid: "train-a" }] } },
    });
  });

  it("never gives a course a row that belongs to another course", () => {
    const rows = [
      stored(1, { evaluation: "Good", sourceTrainUuid: "train-x" }),
      stored(2, { uuid: autoTrainingRowUuid(APPRAISAL, "train-y"), evaluation: "Fair" }),
    ];
    // X and Y share A's name but have left the window.
    const courses = [course("train-a", "Fire fighting"), course("train-x", "Fire fighting", OUT), course("train-y", "Fire fighting", OUT)];

    const out = rebuild(courses, rows).rows;
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ uuid: autoTrainingRowUuid(APPRAISAL, "train-a"), evaluation: "", sourceTrainUuid: "train-a" });
  });

  it("a rebuild in the same session gives the same rows", () => {
    const rows = [stored(1, { uuid: "legacy-1", evaluation: "Good", comment: "c" }), stored(2, { training: "Extra", source: "manual" })];
    const courses = [course("train-a", "Fire fighting")];

    const first = rebuild(courses, rows);
    const second = rebuild(courses, first.rows, { "auto:train-a": "c" });
    expect(second.rows).toEqual(first.rows);
  });

  it("prefers the live comment state over the row's comment", () => {
    const rows = [stored(1, { comment: "saved", sourceTrainUuid: "train-a" })];
    const courses = [course("train-a", "Fire fighting")];

    expect(rebuild(courses, rows, { "auto:train-a": "typed" }).rows[0].comment).toBe("typed");
    expect(rebuild(courses, rows, { "1": null }).rows[0].comment).toBe("");
  });
});

describe("a manual row named like a D3 course (APD-42)", () => {
  it("moves its evaluation and comment into the course's new auto row", () => {
    const rows = [stored(3, { uuid: "manual-1", training: " fire FIGHTING ", evaluation: "Fair", comment: "manual note", source: "manual" })];
    const courses = [course("train-a", "Fire fighting")];
    const uuid = autoTrainingRowUuid(APPRAISAL, "train-a");

    const out = rebuild(courses, rows);
    expect(out.rows).toEqual([{
      id: "auto:train-a", uuid, training: "Fire fighting", evaluation: "Fair", comment: "manual note",
      source: "auto", sourceTrainUuid: "train-a",
    }]);
    // The comment state follows the row to its auto id.
    expect(out.commentReassignments).toEqual([{ newId: "auto:train-a", priorId: "3" }]);
    expect(changesOnOpen(courses, rows)).toEqual({
      sections: { trainings: {
        rows: [{ uuid, training: "Fire fighting", evaluation: "Fair", comment: "manual note", source: "auto", sourceTrainUuid: "train-a" }],
        deleted: ["manual-1"],
      } },
    });
  });

  it("never overwrites the auto row's own values", () => {
    const rows = [
      stored(1, { evaluation: "Good", comment: "auto note", sourceTrainUuid: "train-a" }),
      stored(2, { uuid: "manual-1", evaluation: "Fair", comment: "manual note", source: "manual" }),
    ];
    const courses = [course("train-a", "Fire fighting")];

    const out = rebuild(courses, rows);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]).toMatchObject({ uuid: "row-1", evaluation: "Good", comment: "auto note" });
    expect(out.commentReassignments).toEqual([{ newId: "auto:train-a", priorId: "1" }]);
  });

  it("fills only what the auto row is missing", () => {
    const rows = [
      stored(1, { evaluation: "", comment: "auto note", sourceTrainUuid: "train-a" }),
      stored(2, { uuid: "manual-1", evaluation: "Fair", comment: "manual note", source: "manual" }),
    ];

    expect(rebuild([course("train-a", "Fire fighting")], rows).rows[0]).toMatchObject({ evaluation: "Fair", comment: "auto note" });
  });
});
