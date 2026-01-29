import { useQuery } from '@tanstack/react-query';
import { useRotationVersion } from './useRotationVersion';
import { rotationApiV2, RotationCrewV2 } from '../v2/api/rotationApiV2';
import { useRankNormalization } from '@/hooks/useRankNormalization';

interface CrewMemberLegacy {
  id: string;
  name: string;
  rank: string;
  pool?: string;
  crewPool?: string;
  manningAgent?: string;
  shipType?: string;
  nationality?: string;
  travelStatus?: string;
  higherCert?: string;
  performance?: string;
  nextAvailability?: string | null;
  experience: {
    company: number;
    rank: number;
    tankers: number;
    oow: number;
    endorsements: string;
  };
}

function mapV2CrewToLegacy(crew: RotationCrewV2): CrewMemberLegacy {
  return {
    id: crew.crewUuid,
    name: crew.fullName || `${crew.firstName} ${crew.familyName}`.trim(),
    rank: crew.presentRank,
    pool: undefined,
    crewPool: undefined,
    manningAgent: undefined,
    shipType: undefined,
    nationality: undefined,
    travelStatus: undefined,
    higherCert: undefined,
    performance: undefined,
    nextAvailability: crew.nextAvailability,
    experience: {
      company: 0,
      rank: 0,
      tankers: 0,
      oow: 0,
      endorsements: '',
    },
  };
}

export function useCrewByRank(rank: string | null) {
  const { isV2 } = useRotationVersion();
  const { normalizeRank } = useRankNormalization();
  const normalizedRank = rank ? normalizeRank(rank) : null;

  const v1Query = useQuery<CrewMemberLegacy[]>({
    queryKey: [`/api/crew-members/by-rank/${normalizedRank}`],
    enabled: !isV2 && !!normalizedRank,
  });

  const v2Query = useQuery<RotationCrewV2[]>({
    queryKey: ['/api/v2/rotation', 'crew', 'by-rank', normalizedRank],
    queryFn: () => normalizedRank ? rotationApiV2.getCrewByRank(normalizedRank) : Promise.resolve([]),
    enabled: isV2 && !!normalizedRank,
  });

  if (isV2) {
    return {
      data: (v2Query.data || []).map(mapV2CrewToLegacy),
      isLoading: v2Query.isLoading,
      isError: v2Query.isError,
      error: v2Query.error,
      isV2: true,
      rawV2Data: v2Query.data,
    };
  }

  return {
    data: v1Query.data || [],
    isLoading: v1Query.isLoading,
    isError: v1Query.isError,
    error: v1Query.error,
    isV2: false,
    rawV2Data: undefined,
  };
}
