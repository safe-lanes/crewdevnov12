export interface CriteriaRow {
  id: string;
  criteria: string;
  required: string;
  resultFromDb: string;
  verified: string;
  hasInfo?: boolean;
  meetsCriterion?: string;
}

export interface TrainingRow {
  id: string;
  training: string;
  correspondingInDB: string;
  category: string;
  status: string;
  completionDate: string;
}

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
}

export interface CesTest {
  id: string;
  description: string;
  date: string;
  minScore: string;
  score: string;
  result: string;
}
