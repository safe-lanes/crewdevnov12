import { useQuery } from '@tanstack/react-query';
import { restHoursApiV2 } from '../api/restHoursApiV2';

export interface V2Vessel {
  id: number;
  vesselUuid: string | null;
  vessel: string | null;
  imoNumber: string | null;
  flag: string | null;
  vesselType: string | null;
}

export interface V2CrewMember {
  id: number;
  crewUuid: string;
  empNo: string;
  firstName: string | null;
  middleName: string | null;
  familyName: string | null;
  presentRank: string | null;
  status: string | null;
  isActive: boolean | null;
  uploadedPhoto: string | null;
  name: string;
  rank: string | null;
  crewMemberId: string;
}

export function useV2Vessels() {
  const query = useQuery<V2Vessel[]>({
    queryKey: ['v2', 'rest-hours', 'masters', 'vessels'],
    queryFn: () => restHoursApiV2.masters.getVessels(),
    staleTime: 5 * 60 * 1000,
  });

  const vessels = query.data ?? [];

  const vesselLookup = vessels.reduce((acc, v) => {
    if (v.vesselUuid) {
      acc[v.vesselUuid] = v.vessel ?? '';
    }
    return acc;
  }, {} as Record<string, string>);

  const getVesselName = (vesselUuid: string | null | undefined): string => {
    if (!vesselUuid) return '';
    return vesselLookup[vesselUuid] ?? vesselUuid;
  };

  return {
    vessels,
    vesselLookup,
    getVesselName,
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useV2CrewMembers(params?: { vesselUuid?: string; rank?: string }) {
  const query = useQuery<V2CrewMember[]>({
    queryKey: ['v2', 'rest-hours', 'masters', 'crew-members', params],
    queryFn: () => restHoursApiV2.masters.getCrewMembers(params),
    staleTime: 5 * 60 * 1000,
  });

  const crewMembers = query.data ?? [];

  const crewLookup = crewMembers.reduce((acc, c) => {
    acc[c.crewMemberId] = c.name;
    return acc;
  }, {} as Record<string, string>);

  const getCrewName = (crewMemberId: string | null | undefined): string => {
    if (!crewMemberId) return '';
    return crewLookup[crewMemberId] ?? crewMemberId;
  };

  return {
    crewMembers,
    crewLookup,
    getCrewName,
    isLoading: query.isLoading,
    error: query.error,
  };
}

export interface V2Group {
  id: number;
  fgUuid?: string | null;
  agUuid?: string | null;
  name: string | null;
  vessels: string | null;
}

export function parseGroupVesselNames(vessels: string | null | undefined): string[] {
  if (!vessels) return [];
  return Array.from(new Set(vessels.split(',').map(s => s.trim()).filter(Boolean)));
}

export function useV2FleetGroups() {
  const query = useQuery<V2Group[]>({
    queryKey: ['v2', 'rest-hours', 'masters', 'fleet-groups'],
    queryFn: () => restHoursApiV2.masters.getFleetGroups(),
    staleTime: 5 * 60 * 1000,
  });
  return { fleetGroups: query.data ?? [], isLoading: query.isLoading, error: query.error };
}

export function useV2AdditionalGroups() {
  const query = useQuery<V2Group[]>({
    queryKey: ['v2', 'rest-hours', 'masters', 'additional-groups'],
    queryFn: () => restHoursApiV2.masters.getAdditionalGroups(),
    staleTime: 5 * 60 * 1000,
  });
  return { additionalGroups: query.data ?? [], isLoading: query.isLoading, error: query.error };
}
