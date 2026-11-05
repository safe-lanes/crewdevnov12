import type { Approver, CesTest, Comment, TrainingRow } from '@/components/promotion-review-parts/types';
import type { PromoChangeRow, PromoSectionKey } from '@shared/v2/promotions/promotionChanges';

// A promotion review's child lists in the shape the server saves them
// (PRD-02 / PRD-03): one list of rows per section, each row its uuid plus the
// section's fields. The form diffs the lists it has now against the lists as
// last loaded or saved, and sends only the difference.
export type PromoListSnapshot = Partial<Record<PromoSectionKey, PromoChangeRow[]>>;

export interface SelectedApprover {
  userUuid: string;
  displayName: string;
  // The stored row uuid, when the row is saved.
  uuid?: string;
}

// The form's child lists.
export interface PromoListState {
  cesTests: CesTest[];
  trainingNeeds: TrainingRow[];
  // Keyed by the training row's id (its uuid).
  trainingComments: Record<string, Comment[]>;
  // Keyed by criteria code; everything except A3 and A4.
  criteriaComments: Record<string, Comment[]>;
  a4Comments: Comment[];
  approvers: Approver[];
  selectedApprovers: SelectedApprover[];
}

export const PART_A_SECTIONS: readonly PromoSectionKey[] = ['cesTests', 'trainingNeeds', 'trainingComments', 'criteriaComments'];
export const APPROVER_SECTIONS: readonly PromoSectionKey[] = ['approvers', 'partAApprovers', 'selectedApprovers'];

const text = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

function approverRow(a: Approver, partA: boolean): PromoChangeRow {
  return {
    // A manual approver's id is its uuid; a Part A approver's id is its user.
    uuid: a.uuid || (partA ? undefined : a.id),
    ...(partA ? { approverId: a.id } : {}),
    date: a.date,
    approver: a.approver,
    status: a.status,
    approval: a.approval,
    comments: a.comments,
  };
}

// The rows of `sections` from the form's lists. With `persistedOnly`, rows the
// form does not save are left out: A4 comments without text and approvers
// without a name.
export function snapshotFromState(
  state: PromoListState,
  sections: readonly PromoSectionKey[],
  persistedOnly = true,
): PromoListSnapshot {
  const snapshot: PromoListSnapshot = {};
  const approvers = persistedOnly ? state.approvers.filter(a => a.approver?.trim()) : state.approvers;
  for (const section of sections) {
    switch (section) {
      case 'cesTests':
        snapshot.cesTests = state.cesTests.map(t => ({
          uuid: t.uuid,
          testId: text(t.id),
          description: t.description,
          date: t.date,
          minScore: t.minScore,
          score: t.score,
          result: t.result,
        }));
        break;
      case 'trainingNeeds':
        snapshot.trainingNeeds = state.trainingNeeds.map(t => ({
          uuid: t.id,
          training: t.training,
          correspondingInDB: t.correspondingInDB,
          identifiedByUuid: t.identifiedByUuid,
          category: t.category,
          status: t.status,
          completionDate: t.completionDate,
        }));
        break;
      case 'trainingComments':
        snapshot.trainingComments = Object.entries(state.trainingComments).flatMap(([trainingUuid, list]) =>
          (Array.isArray(list) ? list : []).map(c => ({ uuid: c.id, trainingUuid, user: c.user, text: c.text })));
        break;
      case 'criteriaComments': {
        const a4 = persistedOnly ? state.a4Comments.filter(c => c.text?.trim()) : state.a4Comments;
        snapshot.criteriaComments = [
          ...Object.entries(state.criteriaComments).flatMap(([criteriaCode, list]) =>
            (Array.isArray(list) ? list : []).map(c => ({ uuid: c.id, criteriaCode, user: c.user, text: c.text }))),
          ...a4.map(c => ({ uuid: c.id, criteriaCode: 'a4', user: c.user, text: c.text })),
        ];
        break;
      }
      case 'approvers':
        snapshot.approvers = approvers.filter(a => !a.isFromPartA).map(a => approverRow(a, false));
        break;
      case 'partAApprovers':
        snapshot.partAApprovers = approvers.filter(a => a.isFromPartA).map(a => approverRow(a, true));
        break;
      case 'selectedApprovers':
        snapshot.selectedApprovers = state.selectedApprovers.map(s => ({
          uuid: s.uuid,
          approverId: s.userUuid,
          approver: s.displayName,
        }));
        break;
    }
  }
  return snapshot;
}

function parseList(value: unknown, fallback: any): any {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

// The form's lists as the GET response holds them, every stored row included
// (also blank CES rows and nameless approvers), so the first save diffs
// against exactly what the server has.
export function stateFromResponse(review: Record<string, any>): PromoListState {
  const ces = parseList(review.cesTestsData, []);
  const comments = parseList(review.criteriaComments, {});
  const training = parseList(review.trainingNeeds, []);
  const approvals = parseList(review.approvalData, []);
  const selected = parseList(review.selectedApproversForSubmission, []);
  const { a3, a4, ...rest } = comments && typeof comments === 'object' ? comments : ({} as any);
  return {
    cesTests: Array.isArray(ces) ? ces : [],
    trainingNeeds: Array.isArray(training) ? training : [],
    trainingComments: a3 && typeof a3 === 'object' && !Array.isArray(a3) ? a3 : {},
    criteriaComments: rest,
    a4Comments: Array.isArray(a4) ? a4 : [],
    approvers: Array.isArray(approvals)
      ? approvals.map((a: Approver) => ({ ...a, isFromPartA: a.isFromPartA !== undefined ? a.isFromPartA : true }))
      : [],
    selectedApprovers: Array.isArray(selected)
      ? selected.map((s: any) => (typeof s === 'string'
        ? { userUuid: '', displayName: s }
        : { uuid: s.uuid, userUuid: s.userUuid || '', displayName: s.displayName || s.approver || '' }))
      : [],
  };
}
