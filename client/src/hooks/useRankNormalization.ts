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

    if (roleToParentMap.has(rankOrRole)) {
      return roleToParentMap.get(rankOrRole)!;
    }

    if (roleToParentMap.has(rankOrRole.toLowerCase())) {
      return roleToParentMap.get(rankOrRole.toLowerCase())!;
    }

    const suffixMatch = rankOrRole.match(/^(.+?)_\d+$/);
    if (suffixMatch) {
      const baseRank = suffixMatch[1];
      if (roleToParentMap.has(rankOrRole)) {
        return roleToParentMap.get(rankOrRole)!;
      }
      return baseRank;
    }

    return rankOrRole;
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

  return {
    normalizeRank,
    getParentRankByRankId,
    isLoading,
    companyRanks,
    isVariantRank,
    isParentWithVariants,
    filterCrewWithVariants,
    ranksWithVariants,
  };
}
