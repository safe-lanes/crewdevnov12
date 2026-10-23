// Appraisal workflow status order (APD-17).
//
// Status only moves forward: draft < preliminary < submitted < reviewed. Stage
// submission and save draft both follow this, so a stale copy of the form (or
// a replayed sync) can never move an appraisal back. Task #500 synonyms
// (`stage2_submitted`, `pending_review`, `stage3_submitted`) share the rank of
// their canonical status.
export const APPRAISAL_STATUS_ORDER: Readonly<Record<string, number>> = {
  draft: 0,
  preliminary: 1,
  submitted: 2,
  stage2_submitted: 2,
  pending_review: 2,
  reviewed: 3,
  stage3_submitted: 3,
};

export function normalizeAppraisalStatus(status: string | null | undefined): string {
  return (status ?? "").trim().toLowerCase();
}

// -1 for a value outside the workflow.
export function appraisalStatusRank(status: string | null | undefined): number {
  const key = normalizeAppraisalStatus(status);
  return Object.prototype.hasOwnProperty.call(APPRAISAL_STATUS_ORDER, key) ? APPRAISAL_STATUS_ORDER[key] : -1;
}

// True when moving from `current` to `requested` would go backwards. A value
// outside the workflow ranks lowest, so it can never replace a known status.
export function isAppraisalStatusRegression(
  current: string | null | undefined,
  requested: string | null | undefined,
): boolean {
  return appraisalStatusRank(requested) < appraisalStatusRank(current);
}
