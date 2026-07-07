export interface AppraisalRowLike {
  seafarersRank?: string | null;
  appraisalData?: string | null;
  stageStatuses?: string | null;
  appraisalPeriodTo?: string | null;
}

/**
 * Pulls the rank off an appraisal row. The dashboard chart and its drill-down
 * popup must use the exact same logic so the popup's row list matches the
 * bar's count/average. Top-level `seafarersRank` wins; otherwise the value is
 * parsed out of the JSON `appraisalData` blob.
 */
export function extractRank(row: AppraisalRowLike): string {
  const top = (row.seafarersRank || "").trim();
  if (top) return top;
  const raw = row.appraisalData;
  if (!raw || typeof raw !== "string") return "";
  try {
    const parsed = JSON.parse(raw);
    const r = parsed?.seafarersRank;
    return typeof r === "string" ? r.trim() : "";
  } catch {
    return "";
  }
}

/**
 * Pulls the "Appraisal Period To" date off an appraisal row. Like extractRank,
 * the chart and its drill-down must use the same logic. Top-level
 * `appraisalPeriodTo` wins; otherwise it is parsed out of the JSON
 * `appraisalData` blob. Returns "" when absent.
 */
export function extractAppraisalPeriodTo(row: AppraisalRowLike): string {
  const top = (row.appraisalPeriodTo || "").trim();
  if (top) return top;
  const raw = row.appraisalData;
  if (!raw || typeof raw !== "string") return "";
  try {
    const parsed = JSON.parse(raw);
    const r = parsed?.appraisalPeriodTo;
    return typeof r === "string" ? r.trim() : "";
  } catch {
    return "";
  }
}

/**
 * True only when Stage 2 of the appraisal has been submitted.
 * Stage 3 / reviewed records also qualify because Stage 2 remains completed.
 */
export function isStage2Submitted(row: AppraisalRowLike): boolean {
  if (!row.stageStatuses) return false;
  try {
    const parsed = JSON.parse(row.stageStatuses);
    return parsed?.stage2?.status === "completed";
  } catch {
    return false;
  }
}
