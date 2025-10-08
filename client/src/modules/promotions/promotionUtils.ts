import { PromotionHierarchy } from '@shared/schema';

/**
 * Finds the next promotion rank for a given current rank based on promotion hierarchies
 * @param currentRank - The crew member's current rank
 * @param hierarchies - Array of promotion hierarchies
 * @returns Object with nextRank (string or null) and hasPath (boolean)
 */
export function findNextPromotionRank(
  currentRank: string,
  hierarchies: PromotionHierarchy[]
): { nextRank: string | null; hasPath: boolean } {
  // Find the hierarchy that contains the current rank
  const hierarchy = hierarchies.find(h => h.rankPath.includes(currentRank));

  if (!hierarchy) {
    // No career path configured for this rank
    return { nextRank: null, hasPath: false };
  }

  // rankPath is stored junior→senior, so find current position
  const currentIndex = hierarchy.rankPath.indexOf(currentRank);

  // Check if there's a next rank (more senior position)
  if (currentIndex < hierarchy.rankPath.length - 1) {
    // Next rank exists (one position higher in the array)
    return { nextRank: hierarchy.rankPath[currentIndex + 1], hasPath: true };
  } else {
    // Already at senior position (top of the ladder)
    return { nextRank: null, hasPath: true };
  }
}

/**
 * Determines if a crew member should be shown in the promotions table
 * @param currentRank - The crew member's current rank
 * @param hierarchies - Array of promotion hierarchies
 * @returns true if crew member has a next promotion rank available
 */
export function shouldShowInPromotionsTable(
  currentRank: string,
  hierarchies: PromotionHierarchy[]
): boolean {
  const { nextRank, hasPath } = findNextPromotionRank(currentRank, hierarchies);
  // Only show crew members who have a configured path AND have a next rank
  return hasPath && nextRank !== null;
}
