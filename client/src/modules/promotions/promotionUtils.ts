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

  // rankPath is stored junior→senior (index 0 = most junior, last index = most senior)
  // So we move towards the last index to get more senior ranks
  const currentIndex = hierarchy.rankPath.indexOf(currentRank);

  // Check if there's a next rank (more senior position)
  if (currentIndex < hierarchy.rankPath.length - 1) {
    // Next rank exists (one position higher index = more senior)
    return { nextRank: hierarchy.rankPath[currentIndex + 1], hasPath: true };
  } else {
    // Already at senior position (last index = top of the ladder)
    return { nextRank: null, hasPath: true };
  }
}

/**
 * Finds the rank a crew member would have held immediately before being
 * promoted INTO the given rank (the inverse of findNextPromotionRank).
 * Used to label historical/executed promotion rows with their "from" rank.
 * @param toRank - The rank that was promoted into
 * @param hierarchies - Array of promotion hierarchies
 * @returns The previous (more junior) rank, or null if none/unknown
 */
export function findPreviousPromotionRank(
  toRank: string,
  hierarchies: PromotionHierarchy[]
): string | null {
  const hierarchy = hierarchies.find(h => h.rankPath.includes(toRank));
  if (!hierarchy) return null;
  const idx = hierarchy.rankPath.indexOf(toRank);
  // rankPath is junior→senior, so the previous rank is one index lower.
  return idx > 0 ? hierarchy.rankPath[idx - 1] : null;
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
