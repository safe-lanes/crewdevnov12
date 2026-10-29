// Save-draft change set for an appraisal (APD-16).
//
// The client sends only what the user changed since the form was loaded, and
// the server writes only that: untouched rows and fields are never rewritten,
// so a stale copy of the form cannot overwrite someone else's edits. Child rows
// are identified by their row uuid, never by list position.

import { v5 as uuidv5 } from "uuid";

export const SECTION_KEYS = [
  "trainings",
  "targets",
  "competenceAssessments",
  "behaviouralAssessments",
  "trainingNeeds",
  "recommendations",
  "appraiserComments",
  "seafarerComments",
  "officeReviews",
  "trainingFollowups",
] as const;

export type AppraisalSectionKey = (typeof SECTION_KEYS)[number];

// Part G (G1 office reviews, G2 training follow-ups) is office-owned: ship
// users may not write it.
export const PART_G_SECTIONS: readonly AppraisalSectionKey[] = ["officeReviews", "trainingFollowups"];

// The sections each stage submit saves, in one transaction with the stage
// status (APD-29). B1 trainings go with Stage 2 and 3 (Task #500), B1 targets
// with Stage 2. The stage request schemas are built from this list, so a
// section the service saves is never stripped by validation.
export const STAGE_SECTIONS = {
  stage1: ["trainings", "targets"],
  stage2: [
    "competenceAssessments",
    "behaviouralAssessments",
    "trainingNeeds",
    "recommendations",
    "appraiserComments",
    "seafarerComments",
    "trainings",
    "targets",
  ],
  stage3: ["officeReviews", "trainingFollowups", "trainings"],
} as const satisfies Record<"stage1" | "stage2" | "stage3", readonly AppraisalSectionKey[]>;

export type AppraisalStage = keyof typeof STAGE_SECTIONS;

// The editable fields of each section's rows, as the client names them.
export const SECTION_FIELDS: Record<AppraisalSectionKey, readonly string[]> = {
  // sourceTrainUuid ties an auto row to its D3 course (APD-42).
  trainings: ["training", "evaluation", "comment", "source", "sourceTrainUuid"],
  targets: ["targetSetting", "evaluation", "comment"],
  competenceAssessments: ["assessmentCriteria", "weight", "effectiveness", "comment"],
  behaviouralAssessments: ["assessmentCriteria", "weight", "effectiveness", "comment"],
  // addedFromDB is not sent: the server derives source from correspondingInDB (APD-44).
  trainingNeeds: ["training", "correspondingInDB", "identifiedByUuid", "comment"],
  recommendations: ["question", "answer", "comment"],
  appraiserComments: ["name", "rank", "comment"],
  seafarerComments: ["name", "rank", "comment"],
  // isAssigned is set by the server at Stage 2 only (APD-41).
  officeReviews: ["name", "position", "feedback", "userUuid"],
  trainingFollowups: ["training", "correspondingInDB", "identifiedByUuid", "category", "status", "targetDate", "comment"],
};

// Part A fields, stored on the main appraisal row (appraisal_results_v2).
export const PART_A_FIELDS = [
  "seafarersName",
  "seafarersRank",
  "nationality",
  "vessel",
  "signOn",
  "appraisalPeriodFrom",
  "appraisalPeriodTo",
  "personalityIndexCategory",
  "primaryAppraiser",
] as const;

// Every main-row field a save draft may change.
export const HEADER_FIELDS = [
  ...PART_A_FIELDS,
  "appraisalType",
  "appraisalDate",
  "competenceRating",
  "behavioralRating",
  "overallRating",
  "status",
] as const;

export type AppraisalHeaderField = (typeof HEADER_FIELDS)[number];

// A row of a section. An existing row carries its uuid and only the fields
// that changed; a new row carries its (client-generated) uuid and every field
// that is not empty.
export type AppraisalChangeRow = { uuid: string } & Record<string, unknown>;

export interface AppraisalSectionChanges {
  rows: AppraisalChangeRow[];
  // Uuids of rows the user removed.
  deleted?: string[];
}

export interface AppraisalChanges {
  header?: Partial<Record<AppraisalHeaderField, string | null>>;
  sections?: Partial<Record<AppraisalSectionKey, AppraisalSectionChanges>>;
}

function normalizeForCompare(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return String(v.getTime());
  return String(v);
}

// Field equality used to decide whether a value really changed. null,
// undefined and "" are the same (the server stores "" as null), and numbers
// equal their string form.
export function sameValue(a: unknown, b: unknown): boolean {
  return normalizeForCompare(a) === normalizeForCompare(b);
}

export function isEmptyChanges(changes: AppraisalChanges): boolean {
  return Object.keys(changes.header ?? {}).length === 0
    && Object.keys(changes.sections ?? {}).length === 0;
}

// Fixed namespace for B1 auto-row uuids. Never change it: stored rows depend on it.
const AUTO_TRAINING_ROW_NAMESPACE = "2b0e69a5-509a-4543-8e9a-4d4d753e70d1";

// The uuid of the B1 auto row for one course of one appraisal (APD-20). The
// form adds these rows itself, so every session that adds the row for the same
// course must give it the same uuid; a sync then merges the rows instead of
// keeping two. `courseKey` is the crew training's trainUuid (else its course
// id, else its name).
export function autoTrainingRowUuid(appraisalUuid: string, courseKey: string): string {
  return uuidv5(`${appraisalUuid}:${courseKey}`, AUTO_TRAINING_ROW_NAMESPACE);
}
