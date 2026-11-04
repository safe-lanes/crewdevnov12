// The competence (Part C), behavioural (Part D) and overall ratings of an
// appraisal (APD-49). They are derived from the Part C/D rows: the server
// stores them from the rows it holds, never from a client, and the form shows
// the same numbers while it is being filled in.

import { getEffectivenessScore, type EffectivenessOption } from "../../appraisal-effectiveness";

// A Part C/D row, as the form holds it or as it is stored.
export interface RatedRow {
  weight?: number | string | null;
  effectiveness?: string | null;
}

export interface AppraisalRatings {
  competenceRating: string | null;
  behavioralRating: string | null;
  overallRating: string | null;
}

// The weighted average of the rows that have an effectiveness and a weight, to
// one decimal place. null when no row counts. Each effectiveness counts for
// the score its form version's `options` give it, or the fixed 1–5 scale when
// the version has none (null); any other value counts its weight with 0.
export function sectionRating(
  rows: readonly RatedRow[] | null | undefined,
  options: readonly EffectivenessOption[] | null = null,
): string | null {
  let totalScore = 0;
  let totalWeight = 0;
  for (const row of rows ?? []) {
    const weight = Number(row?.weight);
    if (!row?.effectiveness || !weight) continue;
    const rating = getEffectivenessScore(row.effectiveness, options);
    totalScore += (rating * weight) / 100;
    totalWeight += weight;
  }
  return totalWeight > 0 ? (totalScore * 100 / totalWeight).toFixed(1) : null;
}

// The ratings stored on the appraisal. The overall averages only the sections
// with a real rating (> 0): hidden, unrated or zero-scoring sections are left out.
export function appraisalRatings(sections: {
  competenceAssessments?: readonly RatedRow[] | null;
  behaviouralAssessments?: readonly RatedRow[] | null;
}, options: readonly EffectivenessOption[] | null = null): AppraisalRatings {
  const competenceRating = sectionRating(sections.competenceAssessments, options);
  const behavioralRating = sectionRating(sections.behaviouralAssessments, options);

  const scores = [competenceRating, behavioralRating]
    .map(s => (s !== null ? parseFloat(s) : 0))
    .filter(score => score > 0);

  const overallRating = scores.length > 0
    ? (scores.reduce((sum, s) => sum + s, 0) / scores.length).toFixed(1)
    : null;

  return { competenceRating, behavioralRating, overallRating };
}
