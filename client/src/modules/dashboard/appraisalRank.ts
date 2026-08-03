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

/** "AB_2" → "AB", "3rd Officer_1" → "3rd Officer"; no suffix → unchanged. */
export function baseRank(rank: string): string {
  return rank.replace(/_\d+$/, "").trim();
}

const ORDINAL_WORDS: Record<string, string> = {
  first: "1st", second: "2nd", third: "3rd", fourth: "4th", fifth: "5th",
};

/**
 * Builds the lowercase(name or label) → label lookup from Rank Master rows.
 * Identical to the map the rank chart already uses for its Ranks filter.
 */
export function buildRankLabelMap(
  companyRanks: { rank?: string | null; label?: string | null }[],
): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of companyRanks) {
    const label = (r.label || "").trim();
    if (!label) continue;
    const name = (r.rank || "").trim();
    if (name) m.set(name.toLowerCase(), label);
    m.set(label.toLowerCase(), label);
  }
  return m;
}

/**
 * Chart/drill-down rank normalization:
 * 1. strip variant suffix ("AB_2" → "AB");
 * 2. resolve via Rank Master (name or label, case-insensitive) → master LABEL
 *    ("Third Engineer" → "3rd Engineer", "AB" → "AB");
 * 3. failing that, convert spelled ordinals and retry the master;
 * 4. otherwise return the base rank unchanged — rows are never skipped.
 */
export function canonicalRank(rank: string, labelMap: Map<string, string>): string {
  const base = baseRank(rank);
  if (!base) return base;
  const exact = labelMap.get(base.toLowerCase());
  if (exact) return exact;
  const converted = base.toLowerCase()
    .replace(/\b(first|second|third|fourth|fifth)\b/g, (w) => ORDINAL_WORDS[w]);
  return labelMap.get(converted) ?? base;
}
