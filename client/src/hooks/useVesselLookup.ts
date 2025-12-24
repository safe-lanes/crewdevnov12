import { useMemo } from 'react';
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

  return {
    vessels,
    isLoading,
    // Translate vessel name → vessel ID
    getVesselId: (vesselName: string): string | undefined => nameToId.get(vesselName),
    // Translate vessel ID → vessel name
    getVesselName: (vesselId: string): string | undefined => idToName.get(vesselId),
    // Get full vessel entry by ID
    getVessel: (vesselId: string): VesselMasterEntry | undefined => vesselMap.get(vesselId),
    // Translate array of names to IDs
    getVesselIds: (vesselNames: string[]): string[] => {
      return vesselNames.map(name => nameToId.get(name)).filter((id): id is string => id !== undefined);
    },
    // Translate array of IDs to names
    getVesselNames: (vesselIds: string[]): string[] => {
      return vesselIds.map(id => idToName.get(id)).filter((name): name is string => name !== undefined);
    },
  };
}
