import { useMemo, useCallback } from 'react';
import { useExternalVessels } from './useExternalVessels';

interface VesselMasterEntry {
  id: number;
  entryId: string; // VSL-003
  name: string;    // MT Nordic Star
  description?: string;
  vesselType?: string;
  isActive?: boolean;
  isDeleted?: boolean;
}

export function useVesselLookup() {
  // Fetch vessels from external SAIL ERP API (all 11 vessels)
  const { data: externalVessels = [], isLoading } = useExternalVessels();

  // Normalize external vessels to match expected VesselMasterEntry format
  const vessels: VesselMasterEntry[] = useMemo(() => {
    return externalVessels.map((v: any, index: number) => ({
      id: index + 1,
      entryId: v.vuid || v.entryId || `VSL-${String(index + 1).padStart(3, '0')}`,
      name: v.vessel || v.name || 'Unknown Vessel',
      description: v.description,
      vesselType: v.vesselType,
      isActive: true,
      isDeleted: false,
    }));
  }, [externalVessels]);

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
