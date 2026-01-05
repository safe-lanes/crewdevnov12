import { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addRankAliasesToMap } from './useRankNormalization';

interface VesselRank {
  id: string;
  rank: string;
  role?: string;
  sortOrder: number;
  isRoleRow?: boolean;
}

interface AvailableRank {
  id: number;
  name: string;
  sortOrder: number;
}

export function useRankOrdering(vesselId: string | null | undefined) {
  const { data: availableRanks = [] } = useQuery<AvailableRank[]>({
    queryKey: ['/api/available-ranks'],
  });

  const { data: vesselRanks = [], isLoading: isLoadingVessel, isFetched: isVesselFetched } = useQuery<VesselRank[]>({
    queryKey: ['/api/vessel-revisions/ranks', vesselId],
    queryFn: vesselId
      ? () => fetch(`/api/vessel-revisions/ranks/${vesselId}`).then(res => res.json())
      : undefined,
    enabled: !!vesselId,
  });
  
  // Loading state: only track vessel-specific query (not global availableRanks refetches)
  // True if vessel is specified but ranks haven't been fetched yet
  const isLoading = !!vesselId && !isVesselFetched && isLoadingVessel;

  const rankOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    
    availableRanks.forEach((rank) => {
      if (rank.sortOrder !== undefined) {
        addRankAliasesToMap(map, rank.name, rank.sortOrder);
      }
    });

    vesselRanks.forEach((vr) => {
      const sortOrder = vr.sortOrder;
      if (sortOrder === undefined) return;

      if (vr.rank) {
        addRankAliasesToMap(map, vr.rank, sortOrder);
      }

      if (vr.role) {
        map.set(vr.role, sortOrder);
        map.set(vr.role.toLowerCase(), sortOrder);

        const baseRank = vr.role.includes('_') ? vr.role.split('_')[0] : vr.role;
        if (baseRank && !map.has(baseRank)) {
          map.set(baseRank, sortOrder);
          map.set(baseRank.toLowerCase(), sortOrder);
        }
      }
    });

    return map;
  }, [availableRanks, vesselRanks]);

  const getSortOrder = useCallback(
    (rankName: string | null | undefined): number => {
      if (!rankName) return 999999;

      if (rankOrderMap.has(rankName)) {
        return rankOrderMap.get(rankName)!;
      }
      if (rankOrderMap.has(rankName.toLowerCase())) {
        return rankOrderMap.get(rankName.toLowerCase())!;
      }

      const baseRank = rankName.includes('_') ? rankName.split('_')[0] : null;
      if (baseRank) {
        if (rankOrderMap.has(baseRank)) {
          return rankOrderMap.get(baseRank)!;
        }
        if (rankOrderMap.has(baseRank.toLowerCase())) {
          return rankOrderMap.get(baseRank.toLowerCase())!;
        }
      }

      return 999999;
    },
    [rankOrderMap]
  );

  const sortCrewByRank = useCallback(
    <T extends { rank?: string | null }>(crewArray: T[]): T[] => {
      return [...crewArray].sort((a, b) => {
        const aOrder = getSortOrder(a.rank);
        const bOrder = getSortOrder(b.rank);
        if (aOrder !== bOrder) return aOrder - bOrder;

        const aSuffix = a.rank?.includes('_') ? parseInt(a.rank.split('_')[1]) || 0 : 0;
        const bSuffix = b.rank?.includes('_') ? parseInt(b.rank.split('_')[1]) || 0 : 0;
        return aSuffix - bSuffix;
      });
    },
    [getSortOrder]
  );

  return {
    getSortOrder,
    sortCrewByRank,
    rankOrderMap,
    isLoading,
  };
}
