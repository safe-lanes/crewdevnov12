import { autoTrainingRowUuid } from "@shared/v2/appraisals/appraisalChanges";

// A crew's Crew Pool D3 training course, as /api/v2/crew-pool/crew/:id/training returns it.
export interface D3TrainingCourse {
  trainUuid?: string;
  courseId?: string;
  courseName?: string | null;
  trainingCourse?: string | null;
  issued?: string | null;
  expiry?: string | null;
}

// A Part B1 row as the form holds it.
export interface B1TrainingRow {
  id: string;
  uuid?: string;
  training: string;
  evaluation: string;
  comment?: string;
  source?: string;
  // The D3 course of an auto row (APD-42). Null on manual rows and on auto
  // rows saved before the link was stored.
  sourceTrainUuid?: string | null;
}

// Where an auto row's comment state comes from, so it can be re-keyed to the
// row's id after a rebuild.
export interface AutoCommentReassignment {
  newId: string;
  priorId?: string;
}

const normalizeName = (s?: string | null) => (s || "").toString().trim().toLowerCase();

function courseName(c: D3TrainingCourse): string {
  return (c.trainingCourse || c.courseName || c.courseId || "Training").toString();
}

function courseKey(c: D3TrainingCourse): string {
  return c.trainUuid || c.courseId || courseName(c);
}

// Rebuilds Part B1 from the D3 courses: one auto row per course in the window,
// then the manual rows.
//
// Each course is paired with the row it already has, so the row keeps its
// uuid, evaluation and comment. Rows were matched by name until APD-42, so a
// renamed course, or two courses with the same name, lost their values on the
// next save. A row now belongs to a course by, in order:
//   1. the same `auto:` id (a rebuild within this session),
//   2. the stored link, sourceTrainUuid = the course's trainUuid,
//   3. the course's computed uuid (an APD-20 row saved before the link existed).
// Only courses left without a row then fall back to the name, and only onto
// rows with no link whose uuid belongs to no D3 course (rows from before
// APD-20). A row is given to one course at most, and a row linked to one
// course is never given to another.
//
// A manual row named like a course in the window is dropped, so the course is
// shown once. Its evaluation and comment move to the course's auto row when
// that row has none of its own.
export function buildB1AutoRows(input: {
  appraisalUuid: string;
  courses: D3TrainingCourse[];
  inWindow: (course: D3TrainingCourse) => boolean;
  rows: B1TrainingRow[];
  comments: Record<string, string | null>;
}): { rows: B1TrainingRow[]; commentReassignments: AutoCommentReassignment[] } {
  const { appraisalUuid, courses, inWindow, rows, comments } = input;

  const autoCourses = courses.filter(inWindow).map((course) => {
    const key = courseKey(course);
    return { course, name: courseName(course), id: `auto:${key}`, uuid: autoTrainingRowUuid(appraisalUuid, key) };
  });

  const existingAutoRows = rows.filter((r) => r.source === "auto");
  const autoNames = new Set(autoCourses.map((c) => normalizeName(c.name)));
  const manualRows = rows.filter((r) => r.source !== "auto" && !autoNames.has(normalizeName(r.training)));
  const droppedManualRows = rows.filter((r) => r.source !== "auto" && autoNames.has(normalizeName(r.training)));

  const claimed = new Set<B1TrainingRow>();
  const priors = new Map<string, B1TrainingRow>();
  const claim = (id: string, row: B1TrainingRow | undefined) => {
    if (!row) return;
    claimed.add(row);
    priors.set(id, row);
  };

  // Exact matches first, for every course, so a name match can never take a
  // row that another course owns.
  for (const c of autoCourses) {
    const free = existingAutoRows.filter((r) => !claimed.has(r)
      && (!r.sourceTrainUuid || r.sourceTrainUuid === c.course.trainUuid));
    claim(c.id, free.find((r) => r.id === c.id)
      || (c.course.trainUuid ? free.find((r) => r.sourceTrainUuid === c.course.trainUuid) : undefined)
      || free.find((r) => r.uuid === c.uuid));
  }

  // The uuids every D3 course would give its row, in the window or not.
  const courseUuids = new Set(courses.map((c) => autoTrainingRowUuid(appraisalUuid, courseKey(c))));
  for (const c of autoCourses) {
    if (priors.has(c.id)) continue;
    claim(c.id, existingAutoRows.find((r) => !claimed.has(r)
      && !r.sourceTrainUuid
      && !(r.uuid && courseUuids.has(r.uuid))
      && normalizeName(r.training) === normalizeName(c.name)));
  }

  const usedManual = new Set<B1TrainingRow>();
  const commentReassignments: AutoCommentReassignment[] = [];
  const autoRows = autoCourses.map((c) => {
    const prior = priors.get(c.id);
    const manual = droppedManualRows.find((r) => !usedManual.has(r) && normalizeName(r.training) === normalizeName(c.name));
    if (manual) usedManual.add(manual);

    // The comment, preferring live comment state so a just-typed (or
    // deleted) comment is never dropped: state under the row's id, state
    // under the prior row's id, the prior row's comment; then the dropped
    // manual row's state and comment. A null state is a deleted comment.
    let comment: string;
    let commentFrom = prior?.id;
    if (c.id in comments) {
      comment = comments[c.id] ?? "";
    } else if (prior && prior.id in comments) {
      comment = comments[prior.id] ?? "";
    } else if (prior?.comment) {
      comment = prior.comment;
    } else if (manual && manual.id in comments) {
      comment = comments[manual.id] ?? "";
      commentFrom = manual.id;
    } else {
      comment = manual?.comment || "";
      if (manual?.comment) commentFrom = manual.id;
    }
    commentReassignments.push({ newId: c.id, priorId: commentFrom });

    return {
      id: c.id,
      // A stored row keeps its uuid, so a save updates that row. A new row's
      // uuid comes from the appraisal and course, so two sessions that add it
      // save one row, not two (APD-20).
      uuid: prior?.uuid ?? c.uuid,
      training: c.name,
      evaluation: prior?.evaluation || manual?.evaluation || "",
      comment,
      source: "auto",
      sourceTrainUuid: c.course.trainUuid || prior?.sourceTrainUuid || undefined,
    };
  });

  return { rows: [...autoRows, ...manualRows], commentReassignments };
}
