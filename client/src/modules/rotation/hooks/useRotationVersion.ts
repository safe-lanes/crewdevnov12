import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useDeleteDraftV2 } from '../v2/hooks/useRotationV2';
import type { RotationPlan } from '@shared/schema';

const STORAGE_KEY = 'rotation_module_version';
const VERSION_CHANGE_EVENT = 'rotation_version_change';
const DEFAULT_VERSION = 'v1';

export type RotationVersion = 'v1' | 'v2';

export function useRotationVersion() {
  const [version, setVersionState] = useState<RotationVersion>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'v1' || stored === 'v2') {
        return stored;
      }
    } catch {}
    return DEFAULT_VERSION;
  });

  useEffect(() => {
    const handleVersionChange = (e: Event) => {
      const customEvent = e as CustomEvent<RotationVersion>;
      if (customEvent.detail) {
        setVersionState(customEvent.detail);
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const newVersion = e.newValue as RotationVersion;
        if (newVersion === 'v1' || newVersion === 'v2') {
          setVersionState(newVersion);
        }
      }
    };

    window.addEventListener(VERSION_CHANGE_EVENT, handleVersionChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener(VERSION_CHANGE_EVENT, handleVersionChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const setVersion = useCallback((newVersion: RotationVersion) => {
    try {
      localStorage.setItem(STORAGE_KEY, newVersion);
    } catch {}
    setVersionState(newVersion);
    window.dispatchEvent(new CustomEvent(VERSION_CHANGE_EVENT, { detail: newVersion }));
  }, []);

  const toggleVersion = useCallback(() => {
    setVersionState(prev => {
      const newVersion = prev === 'v1' ? 'v2' : 'v1';
      try {
        localStorage.setItem(STORAGE_KEY, newVersion);
      } catch {}
      window.dispatchEvent(new CustomEvent(VERSION_CHANGE_EVENT, { detail: newVersion }));
      return newVersion;
    });
  }, []);

  const isV2 = version === 'v2';

  return {
    version,
    setVersion,
    toggleVersion,
    isV2,
  };
}

export function getRotationVersion(): RotationVersion {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'v1' || stored === 'v2') {
      return stored;
    }
  } catch {}
  return DEFAULT_VERSION;
}

export function setRotationVersion(version: RotationVersion): void {
  try {
    localStorage.setItem(STORAGE_KEY, version);
    window.dispatchEvent(new CustomEvent(VERSION_CHANGE_EVENT, { detail: version }));
  } catch {}
}

export function useRotationPlans() {
  const { isV2 } = useRotationVersion();
  
  const v1Query = useQuery<RotationPlan[]>({
    queryKey: ['/api/rotation-plans'],
    enabled: !isV2,
  });
  
  const v2Query = useQuery({
    queryKey: ['/api/v2/rotation', 'drafts'],
    queryFn: async () => {
      const response = await fetch('/api/v2/rotation/drafts');
      if (!response.ok) throw new Error('Failed to fetch V2 drafts');
      return response.json();
    },
    enabled: isV2,
    staleTime: 60 * 1000,
  });
  
  const plans = useMemo(() => {
    if (isV2) {
      const v2Data = v2Query.data ?? [];
      return v2Data.map((draft: any, index: number) => ({
        id: index + 1,
        draftId: draft.draftId || `DRAFT-${draft.draftUuid?.substring(0, 8)}`,
        vessels: '[]',
        crew: '',
        planFromDate: draft.planFromDate || null,
        planToDate: draft.planToDate || null,
        createdBy: draft.createdByUuid || 'Unknown',
        planStatus: draft.planStatus || 'draft',
        lastEdited: draft.lastEdited || draft.createdAt || new Date().toISOString(),
        uuid: draft.draftUuid,
        _isV2: true,
      }));
    }
    return v1Query.data ?? [];
  }, [isV2, v1Query.data, v2Query.data]);
  
  return {
    data: plans,
    isLoading: isV2 ? v2Query.isLoading : v1Query.isLoading,
    isError: isV2 ? v2Query.isError : v1Query.isError,
    error: isV2 ? v2Query.error : v1Query.error,
    refetch: isV2 ? v2Query.refetch : v1Query.refetch,
    isV2,
  };
}

export function useDeleteRotationPlan() {
  const { isV2 } = useRotationVersion();
  const queryClient = useQueryClient();
  
  const v1Mutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/rotation-plans/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rotation-plans'] });
    },
  });
  
  const v2Mutation = useDeleteDraftV2();
  
  const deletePlan = useCallback((id: number | string) => {
    if (isV2 && typeof id === 'string') {
      return v2Mutation.mutateAsync(id);
    } else {
      return v1Mutation.mutateAsync(typeof id === 'number' ? id : parseInt(id));
    }
  }, [isV2, v1Mutation, v2Mutation]);
  
  return {
    deletePlan,
    isPending: isV2 ? v2Mutation.isPending : v1Mutation.isPending,
    isError: isV2 ? v2Mutation.isError : v1Mutation.isError,
    isV2,
  };
}

export function useCrewByRank(rank: string | null) {
  const { isV2 } = useRotationVersion();
  
  const v1Query = useQuery({
    queryKey: ['/api/crew-pool', 'by-rank', rank],
    queryFn: async () => {
      if (!rank) return [];
      const response = await fetch(`/api/crew-pool?rank=${encodeURIComponent(rank)}`);
      if (!response.ok) throw new Error('Failed to fetch crew');
      return response.json();
    },
    enabled: !isV2 && !!rank,
  });
  
  const v2Query = useQuery({
    queryKey: ['/api/v2/rotation', 'crew', 'by-rank', rank],
    queryFn: async () => {
      if (!rank) return [];
      const encodedRank = encodeURIComponent(rank);
      const response = await fetch(`/api/v2/rotation/crew/by-rank/${encodedRank}`);
      if (!response.ok) throw new Error('Failed to fetch V2 crew');
      return response.json();
    },
    enabled: isV2 && !!rank,
    staleTime: 60 * 1000,
  });
  
  const crew = useMemo(() => {
    if (isV2) {
      const v2Data = v2Query.data ?? [];
      return v2Data.map((member: any) => ({
        id: member.crewUuid,
        uuid: member.crewUuid,
        firstName: member.firstName || '',
        lastName: member.familyName || '',
        name: member.fullName || `${member.firstName || ''} ${member.familyName || ''}`.trim(),
        fullName: member.fullName || `${member.firstName || ''} ${member.familyName || ''}`.trim(),
        rank: member.presentRank || rank,
        rankId: null,
        status: member.status,
        crewId: member.employeeId || member.empNo,
        fileNo: member.empNo,
        nationality: null,
        vessel: null,
        vesselName: null,
      }));
    }
    return v1Query.data ?? [];
  }, [isV2, v1Query.data, v2Query.data, rank]);
  
  return {
    data: crew,
    isLoading: isV2 ? v2Query.isLoading : v1Query.isLoading,
    isError: isV2 ? v2Query.isError : v1Query.isError,
    error: isV2 ? v2Query.error : v1Query.error,
    isV2,
  };
}
