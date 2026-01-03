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
 * Result of parsing checklistProgressData JSON which may contain pre-calculated progress
 */
export interface ParsedChecklistData {
  sections: ChecklistSection[];
  preCalculatedProgress: ChecklistProgressResult | null;
}

/**
 * Parses checklistProgressData JSON string to sections array
 * Handles both legacy format (array of sections) and new format (object with sections + progress)
 * @param checklistProgressData - JSON string from database or null/undefined
 * @returns Parsed sections array or empty array
 */
export function parseChecklistProgressData(
  checklistProgressData: string | null | undefined
): ChecklistSection[] {
  if (!checklistProgressData) return [];
  
  try {
    const parsed = JSON.parse(checklistProgressData);
    // New format: { sections: [...], progress: {...} }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.sections) {
      return Array.isArray(parsed.sections) ? parsed.sections : [];
    }
    // Legacy format: direct array of sections
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Parses checklistProgressData and extracts pre-calculated progress if available
 * @param checklistProgressData - JSON string from database
 * @returns Object with sections and optional pre-calculated progress
 */
export function parseChecklistDataWithProgress(
  checklistProgressData: string | null | undefined
): ParsedChecklistData {
  if (!checklistProgressData) {
    return { sections: [], preCalculatedProgress: null };
  }
  
  try {
    const parsed = JSON.parse(checklistProgressData);
    // New format: { sections: [...], progress: {...} }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const sections = Array.isArray(parsed.sections) ? parsed.sections : [];
      const preCalculatedProgress = parsed.progress ? {
        completedVerifications: parsed.progress.completedVerifications ?? 0,
        totalRequired: parsed.progress.totalRequired ?? 0,
        percentage: parsed.progress.percentage ?? 0,
        thresholdPercent: parsed.progress.thresholdPercent ?? parsed.progress.requiredPerPoint ?? 100,
        meetsThreshold: parsed.progress.meetsThreshold ?? (parsed.progress.percentage >= (parsed.progress.thresholdPercent ?? 100)),
      } : null;
      return { sections, preCalculatedProgress };
    }
    // Legacy format: direct array of sections
    return { 
      sections: Array.isArray(parsed) ? parsed : [], 
      preCalculatedProgress: null 
    };
  } catch {
    return { sections: [], preCalculatedProgress: null };
  }
}

/**
 * Convenience function that parses JSON and returns progress
 * Uses pre-calculated values if available (new format), otherwise calculates from sections (legacy)
 * @param checklistProgressData - JSON string from database
 * @param minChecklistVerifications - Required verifications per point (used for legacy format)
 * @param minChecklistCompletionPercent - Threshold percentage (used for legacy format)
 * @returns ChecklistProgressResult
 */
export function calculateChecklistProgressFromJson(
  checklistProgressData: string | null | undefined,
  minChecklistVerifications: number = 1,
  minChecklistCompletionPercent: number = 100
): ChecklistProgressResult {
  const { sections, preCalculatedProgress } = parseChecklistDataWithProgress(checklistProgressData);
  
  // If we have pre-calculated progress (new format), use it directly
  if (preCalculatedProgress) {
    return preCalculatedProgress;
  }
  
  // Otherwise, calculate from sections (legacy format)
  return calculateChecklistProgress(sections, minChecklistVerifications, minChecklistCompletionPercent);
}
