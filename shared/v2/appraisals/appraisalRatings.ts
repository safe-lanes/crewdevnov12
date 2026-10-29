// The competence (Part C), behavioural (Part D) and overall ratings of an
// appraisal (APD-49). They are derived from the Part C/D rows: the server
// stores them from the rows it holds, never from a client, and the form shows
// the same numbers while it is being filled in.

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

// The rating each effectiveness counts for. Any other value counts its weight
// with a rating of 0.
const EFFECTIVENESS_RATING: Record<string, number> = {
  "5-exceeds-expectations": 5,
  "4-meets-expectations": 4,
  "3-somewhat-meets-expectations": 3,
  "2-below-expectations": 2,
  "1-significantly-below-expectations": 1,
};

// The weighted average of the rows that have an effectiveness and a weight, to
// one decimal place. null when no row counts.
export function sectionRating(rows: readonly RatedRow[] | null | undefined): string | null {
  let totalScore = 0;
  let totalWeight = 0;
  for (const row of rows ?? []) {
    const weight = Number(row?.weight);
    if (!row?.effectiveness || !weight) continue;
    const rating = EFFECTIVENESS_RATING[row.effectiveness] ?? 0;
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
}): AppraisalRatings {
  const competenceRating = sectionRating(sections.competenceAssessments);
  const behavioralRating = sectionRating(sections.behaviouralAssessments);

  const scores = [competenceRating, behavioralRating]
    .map(s => (s !== null ? parseFloat(s) : 0))
    .filter(score => score > 0);

  const overallRating = scores.length > 0
    ? (scores.reduce((sum, s) => sum + s, 0) / scores.length).toFixed(1)
    : null;

  return { competenceRating, behavioralRating, overallRating };
}
