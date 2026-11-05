export interface CriteriaRow {
  id: string;
  criteria: string;
  required: string;
  resultFromDb: string;
  verified: string;
  hasInfo?: boolean;
  meetsCriterion?: string;
}

// A training row. `id` is its uuid, made by the browser when the row is
// added (PRD-02).
export interface TrainingRow {
  id: string;
  training: string;
  correspondingInDB: string;
  identifiedByUuid: string;
  category: string;
  status: string;
  completionDate: string;
  addedFromDB?: boolean;
}

// A comment. `id` is its uuid, made by the browser when it is added (PRD-02).
export interface Comment {
  id: string;
  user: string;
  text: string;
}

export interface Approver {
  id: string;
  date: string;
  approver: string;
  status: string;
  approval: string;
  comments: string;
  isFromPartA?: boolean;
  // The stored row uuid. A Part A approver's `id` is its user uuid, a manual
  // approver's `id` is its uuid.
  uuid?: string;
}

export interface CesTest {
  id: string;
  description: string;
  date: string;
  minScore: string;
  score: string;
  result: string;
  // The stored row uuid; `id` is the test position ("1", "2", ...).
  uuid?: string;
}
