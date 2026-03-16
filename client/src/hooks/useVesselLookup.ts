import { useMemo, useCallback } from 'react';
import { useVesselsV2 } from './v2/useMasterDataV2';

interface VesselMasterEntry {
  id: number;
  entryId: string; // vesselUuid (e.g., 743cf9d1-841a-11ed-aa7c-7003bca91a86)
  name: string;    // MT Nordic Star
  description?: string;
  vesselType?: string;
  isActive?: boolean;
  isDeleted?: boolean;
}

export function useVesselLookup() {
  // Fetch vessels from local V2 masters API (tenant-aware, no external dependency)
  const { data: v2Vessels = [], isLoading } = useVesselsV2();

  // Normalize V2 vessels to match expected VesselMasterEntry format
  // V2 API returns: { vesselUuid, vessel, uuid (alias), name (alias), vtuid, ... }
  const vessels: VesselMasterEntry[] = useMemo(() => {
    return v2Vessels.map((v: any, index: number) => ({
      id: index + 1,
      entryId: v.vesselUuid || v.entryId || v.vuid || `VSL-${String(index + 1).padStart(3, '0')}`,
      name: v.vessel || v.name || 'Unknown Vessel',
      description: v.description,
      vesselType: v.vesselType,
      isActive: true,
      isDeleted: false,
    }));
  }, [v2Vessels]);

  // Create lookup maps for O(1) translation
  const { nameToId, idToName, vesselMap } = useMemo(() => {
    const nameToId = new Map<string, string>();
    const idToName = new Map<string, string>();
    const vesselMap = new Map<string, VesselMasterEntry>();

    vessels.forEach((vessel) => {
      if (vessel.name && vessel.entryId) {
        nameToId.set(vessel.name, vessel.entryId);
        idToName.set(vessel.entryId, vessel.name);
        vesselMap.set(vessel.entryId, vessel);
      }
    });

    return { nameToId, idToName, vesselMap };
  }, [vessels]);

  // Memoized lookup functions to prevent re-renders in consuming components
  const getVesselId = useCallback(
    (vesselName: string): string | undefined => nameToId.get(vesselName),
    [nameToId]
  );

  const getVesselName = useCallback(
    (vesselId: string): string | undefined => idToName.get(vesselId),
    [idToName]
  );

  const getVessel = useCallback(
    (vesselId: string): VesselMasterEntry | undefined => vesselMap.get(vesselId),
    [vesselMap]
  );

  const getVesselIds = useCallback(
    (vesselNames: string[]): string[] => {
      return vesselNames.map(name => nameToId.get(name)).filter((id): id is string => id !== undefined);
    },
    [nameToId]
  );

  const getVesselNames = useCallback(
    (vesselIds: string[]): string[] => {
      return vesselIds.map(id => idToName.get(id)).filter((name): name is string => name !== undefined);
    },
    [idToName]
  );

  return {
    vessels,
    isLoading,
    getVesselId,
    getVesselName,
    getVessel,
    getVesselIds,
    getVesselNames,
  };
}
