import { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

interface CompanyRank {
  id: string;
  rank: string;
  rankId: string;
  role: string | null;
  originalRankId: string | null;
  isRoleRow: boolean;
}

// Common rank name aliases to handle variations (e.g., "2nd Officer" vs "Second Officer")
// Keys are lowercase for lookup, values are canonical names from available_ranks
const RANK_ALIASES: Record<string, string> = {
  // Officers
  '2nd officer': 'Second Officer',
  '3rd officer': 'Third Officer',
  '2nd engineer': 'Second Engineer',
  '3rd engineer': 'Third Engineer',
  '4th engineer': 'Fourth Engineer',
  '5th engineer': 'Fifth Engineer',
  // Electrical Officer variants
  'e/o': 'Electrical Officer',
  'e.o': 'Electrical Officer',
  'e.o.': 'Electrical Officer',
  'eto': 'Electrical Officer',
  'elect. officer': 'Electrical Officer',
  // Bosun variants
  'boatswain': 'Bosun',
  'bosun/boatswain': 'Bosun',
  'bo\'sun': 'Bosun',
  // Cook variants
  'ch. cook': 'Chief Cook',
  'chief steward': 'Chief Cook',
  // Rating variants
  'asst. electrician': 'Electrician',
  'assistant electrician': 'Electrician',
  'jr. electrician': 'Electrician',
  'ab': 'Able Bodied Seaman',
  'a/b': 'Able Bodied Seaman',
  'a.b': 'Able Bodied Seaman',
  'os': 'Ordinary Seaman',
  'o/s': 'Ordinary Seaman',
  'o.s': 'Ordinary Seaman',
};

// Helper to populate a map with both canonical names and their aliases
export function addRankAliasesToMap(map: Map<string, number>, rankName: string, sortOrder: number): void {
  // Add the canonical name in multiple case variants
  map.set(rankName, sortOrder);
  map.set(rankName.toLowerCase(), sortOrder);
  map.set(rankName.toUpperCase(), sortOrder);
  
  // Add common aliases that map TO this canonical name
  const lowerName = rankName.toLowerCase();
  Object.entries(RANK_ALIASES).forEach(([alias, canonical]) => {
    if (canonical.toLowerCase() === lowerName) {
      // Add the alias in multiple case variants
      map.set(alias, sortOrder);
      map.set(alias.toUpperCase(), sortOrder);
      // Also add title case version (e.g., "2nd Officer")
      const titleCase = alias.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      map.set(titleCase, sortOrder);
    }
  });
}

export function useRankNormalization() {
  const { data: companyRanks = [], isLoading } = useQuery<CompanyRank[]>({
    queryKey: ['/api/company-ranks'],
  });

  const { roleToParentMap, rankIdToParentMap, ranksWithVariants } = useMemo(() => {
    const roleToParent = new Map<string, string>();
    const rankIdToParent = new Map<string, string>();
    const variantParentRanks = new Set<string>();

    companyRanks.forEach((cr) => {
      if (cr.isRoleRow && cr.role && cr.rank) {
        roleToParent.set(cr.role, cr.rank);
        roleToParent.set(cr.role.toLowerCase(), cr.rank);
        variantParentRanks.add(cr.rank);
        variantParentRanks.add(cr.rank.toLowerCase());
      }
      if (cr.rankId && cr.rank) {
        rankIdToParent.set(cr.rankId, cr.rank);
      }
    });

    return { 
      roleToParentMap: roleToParent, 
      rankIdToParentMap: rankIdToParent,
      ranksWithVariants: variantParentRanks 
    };
  }, [companyRanks]);

  const normalizeRank = (rankOrRole: string): string => {
    if (!rankOrRole) return rankOrRole;

    // First check if exact match exists in roleToParentMap (for role variants)
    if (roleToParentMap.has(rankOrRole)) {
      return roleToParentMap.get(rankOrRole)!;
    }

    if (roleToParentMap.has(rankOrRole.toLowerCase())) {
      return roleToParentMap.get(rankOrRole.toLowerCase())!;
    }

    // Strip position suffix (e.g., "3rd Officer_1" -> "3rd Officer")
    // This returns the Rank Label, NOT the Master Rank name
    let baseRank = rankOrRole;
    const suffixMatch = rankOrRole.match(/^(.+?)_\d+$/);
    if (suffixMatch) {
      baseRank = suffixMatch[1];
      // Check if the base rank is in roleToParentMap
      if (roleToParentMap.has(baseRank)) {
        return roleToParentMap.get(baseRank)!;
      }
      if (roleToParentMap.has(baseRank.toLowerCase())) {
        return roleToParentMap.get(baseRank.toLowerCase())!;
      }
    }

    // DO NOT apply RANK_ALIASES here - we want to keep Rank Labels (e.g., "3rd Officer")
    // as-is for filtering. RANK_ALIASES is only for internal sort order lookups.
    return baseRank;
  };

  const getParentRankByRankId = (rankId: string): string | undefined => {
    return rankIdToParentMap.get(rankId);
  };

  const isVariantRank = useCallback((rankName: string): boolean => {
    if (!rankName) return false;
    return rankName.includes('_') && /^.+_\d+$/.test(rankName);
  }, []);

  const isParentWithVariants = useCallback((rankName: string): boolean => {
    if (!rankName) return false;
    if (isVariantRank(rankName)) return false;
    return ranksWithVariants.has(rankName) || ranksWithVariants.has(rankName.toLowerCase());
  }, [ranksWithVariants, isVariantRank]);

  const filterCrewWithVariants = useCallback(<T extends { rank?: string; role?: string }>(
    items: T[],
    getRankName?: (item: T) => string
  ): T[] => {
    if (!Array.isArray(items)) {
      return [];
    }
    const extractRank = getRankName || ((item: T) => item.role || item.rank || '');
    
    const variantBaseRanks = new Set<string>();
    items.forEach(item => {
      const rankName = extractRank(item);
      if (isVariantRank(rankName)) {
        const baseRank = rankName.split('_')[0];
        variantBaseRanks.add(baseRank);
        variantBaseRanks.add(baseRank.toLowerCase());
      }
    });
    
    return items.filter(item => {
      const rankName = extractRank(item);
      if (isVariantRank(rankName)) return true;
      return !variantBaseRanks.has(rankName) && !variantBaseRanks.has(rankName?.toLowerCase());
    });
  }, [isVariantRank]);

  // Get canonical rank name using aliases (for sortOrder lookup)
  const getCanonicalRankName = useCallback((rankName: string | null | undefined): string => {
    if (!rankName) return '';
    // Strip variant suffix first (e.g., "Oiler_1" -> "Oiler")
    const baseRank = rankName.includes('_') ? rankName.split('_')[0] : rankName;
    // Check alias map (case-insensitive)
    const alias = RANK_ALIASES[baseRank.toLowerCase()];
    return alias || baseRank;
  }, []);

  return {
    normalizeRank,
    getParentRankByRankId,
    isLoading,
    companyRanks,
    isVariantRank,
    isParentWithVariants,
    filterCrewWithVariants,
    ranksWithVariants,
    getCanonicalRankName,
  };
}
