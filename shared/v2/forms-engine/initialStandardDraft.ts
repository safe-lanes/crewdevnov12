/** This opt-in must never include legacy Appraisal/Promotion or Company Forms. */
export function supportsInitialStandardDraft(category: unknown): boolean {
  return category === "briefing" || category === "debriefing" || category === "interview";
}
