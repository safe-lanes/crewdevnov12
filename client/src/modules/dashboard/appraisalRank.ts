export interface AppraisalRowLike {
  seafarersRank?: string | null;
  appraisalData?: string | null;
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
