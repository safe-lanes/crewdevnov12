import { PromotionHierarchy } from '@shared/schema';
import { getBaseRank } from '@shared/crew-mapping';

function getBasePromotionPath(rankPath: unknown): string[] {
  let parsedPath: string[] = [];
  if (Array.isArray(rankPath)) {
    parsedPath = rankPath.filter((rank): rank is string => typeof rank === 'string');
  } else if (typeof rankPath === 'string') {
    try {
      const parsed = JSON.parse(rankPath);
      parsedPath = Array.isArray(parsed)
        ? parsed.filter((rank): rank is string => typeof rank === 'string')
        : [];
    } catch {
      parsedPath = [];
    }
  }
  const basePath: string[] = [];
  const seen = new Set<string>();
  for (const rank of parsedPath) {
    const baseRank = getBaseRank(rank).trim();
    const key = baseRank.toLowerCase();
    if (!baseRank || seen.has(key)) {
      continue;
    }
    seen.add(key);
    basePath.push(baseRank);
  }
  return basePath;
}

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
  const currentBaseRank = getBaseRank(currentRank).trim().toLowerCase();
  for (const hierarchy of hierarchies) {
    const basePath = getBasePromotionPath(hierarchy.rankPath);
    const currentIndex = basePath.findIndex(
      (rank) => rank.trim().toLowerCase() === currentBaseRank,
    );
    if (currentIndex === -1) {
      continue;
    }
    return {
      nextRank:
        currentIndex < basePath.length - 1
          ? basePath[currentIndex + 1]
          : null,
      hasPath: true,
    };
  }
  return {
    nextRank: null,
    hasPath: false,
  };
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
