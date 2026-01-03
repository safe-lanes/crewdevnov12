/**
 * Shared utility for calculating Promotion Checklist A3 progress
 * Used by: PromotionChecklistForm (A3), PromotionReviewForm (A2.5), PromotionsTable (column)
 */

export interface ChecklistProgressResult {
  completedVerifications: number;
  totalRequired: number;
  percentage: number;
  thresholdPercent: number;
  meetsThreshold: boolean;
}

interface ChecklistVerification {
  id: string;
  verifierName: string;
  date: string;
}

interface AssessmentPoint {
  id: string;
  verifications: ChecklistVerification[];
}

interface ChecklistSection {
  id: string;
  assessmentPoints: AssessmentPoint[];
}

/**
 * Calculates the checklist progress based on stored sections and configuration
 * @param checklistSections - Parsed array of checklist sections (from checklistProgressData JSON)
 * @param minChecklistVerifications - Required number of verifications per assessment point
 * @param minChecklistCompletionPercent - Threshold percentage to consider checklist complete
 * @returns ChecklistProgressResult with all progress metrics
 */
export function calculateChecklistProgress(
  checklistSections: ChecklistSection[] | null | undefined,
  minChecklistVerifications: number = 0,
  minChecklistCompletionPercent: number = 100
): ChecklistProgressResult {
  const requiredPerPoint = minChecklistVerifications;
  const thresholdPercent = minChecklistCompletionPercent;
  
  let totalPoints = 0;
  let completedVerifications = 0;
  
  if (checklistSections && Array.isArray(checklistSections)) {
    checklistSections.forEach(section => {
      if (section.assessmentPoints && Array.isArray(section.assessmentPoints)) {
        section.assessmentPoints.forEach(point => {
          totalPoints++;
          const pointVerifications = Math.min(
            (point.verifications?.length ?? 0), 
            requiredPerPoint
          );
          completedVerifications += pointVerifications;
        });
      }
    });
  }
  
  const totalRequired = totalPoints * requiredPerPoint;
  const percentage = totalRequired > 0 ? Math.round((completedVerifications / totalRequired) * 100) : 0;
  const meetsThreshold = percentage >= thresholdPercent;
  
  return {
    completedVerifications,
    totalRequired,
    percentage,
    thresholdPercent,
    meetsThreshold,
  };
}

/**
 * Parses checklistProgressData JSON string to sections array
 * @param checklistProgressData - JSON string from database or null/undefined
 * @returns Parsed sections array or empty array
 */
export function parseChecklistProgressData(
  checklistProgressData: string | null | undefined
): ChecklistSection[] {
  if (!checklistProgressData) return [];
  
  try {
    const parsed = JSON.parse(checklistProgressData);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Convenience function that parses JSON and calculates progress in one call
 * @param checklistProgressData - JSON string from database
 * @param minChecklistVerifications - Required verifications per point
 * @param minChecklistCompletionPercent - Threshold percentage
 * @returns ChecklistProgressResult
 */
export function calculateChecklistProgressFromJson(
  checklistProgressData: string | null | undefined,
  minChecklistVerifications: number = 0,
  minChecklistCompletionPercent: number = 100
): ChecklistProgressResult {
  const sections = parseChecklistProgressData(checklistProgressData);
  return calculateChecklistProgress(sections, minChecklistVerifications, minChecklistCompletionPercent);
}
