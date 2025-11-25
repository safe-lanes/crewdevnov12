import { useMemo } from 'react';
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

  const { roleToParentMap, rankIdToParentMap } = useMemo(() => {
    const roleToParent = new Map<string, string>();
    const rankIdToParent = new Map<string, string>();

    companyRanks.forEach((cr) => {
      if (cr.isRoleRow && cr.role && cr.rank) {
        roleToParent.set(cr.role, cr.rank);
        roleToParent.set(cr.role.toLowerCase(), cr.rank);
      }
      if (cr.rankId && cr.rank) {
        rankIdToParent.set(cr.rankId, cr.rank);
      }
    });

    return { roleToParentMap: roleToParent, rankIdToParentMap: rankIdToParent };
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

  return {
    normalizeRank,
    getParentRankByRankId,
    isLoading,
    companyRanks,
  };
}
