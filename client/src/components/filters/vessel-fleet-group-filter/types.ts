import type { ReactNode } from 'react';

export type FilterMode = 'vessel' | 'fleet' | 'addGroup';

export interface VesselOption {
  id: string | number;
  vesselId: string;
  name: string;
}

export interface FleetOption {
  id: string | number;
  value: string;
  label: string;
}

export interface GroupOption {
  id: string | number;
  value: string;
  label: string;
}

export interface VesselFleetGroupFilterProps {
  mode: FilterMode;
  onModeChange: (mode: FilterMode) => void;
  
  vessels: VesselOption[];
  selectedVessels: string[];
  onToggleVessel: (vesselId: string) => void;
  vesselsLoading?: boolean;
  vesselPlaceholder?: string;
  
  fleets: FleetOption[];
  selectedFleet: string;
  onFleetChange: (value: string) => void;
  fleetPlaceholder?: string;
  
  groups: GroupOption[];
  selectedGroup: string;
  onGroupChange: (value: string) => void;
  groupPlaceholder?: string;
  
  showFilters: boolean;
  onToggleFilters: () => void;
  onClear: () => void;
  
  showFilterToggle?: boolean;
  showClearButton?: boolean;
  className?: string;
  testIdPrefix?: string;
  
  additionalFilters?: ReactNode;
}

export interface VesselFleetGroupFilterState {
  mode: FilterMode;
  selectedVessels: string[];
  selectedFleet: string;
  selectedGroup: string;
  showFilters: boolean;
}

export const createInitialState = (): VesselFleetGroupFilterState => ({
  mode: 'vessel',
  selectedVessels: [],
  selectedFleet: '',
  selectedGroup: '',
  showFilters: true,
});
