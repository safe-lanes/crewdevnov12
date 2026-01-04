import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PeriodFilterValue {
  mode: 'year-month' | 'year-quarter' | 'year' | 'date-range';
  year?: number;
  month?: number;
  quarter?: number;
  startDate?: string;
  endDate?: string;
}

interface RestHoursFiltersState {
  periodValue: PeriodFilterValue;
  complianceMode: 'Rest' | 'Work';
  opaMode: boolean;
  filterType: 'vessel' | 'fleet' | 'addGroup';
  selectedVessels: string[];
  selectedVessel: string;
  fleetValue: string;
  addGroupValue: string;
  
  setPeriodValue: (value: PeriodFilterValue) => void;
  setComplianceMode: (mode: 'Rest' | 'Work') => void;
  setOpaMode: (enabled: boolean) => void;
  setFilterType: (type: 'vessel' | 'fleet' | 'addGroup') => void;
  setSelectedVessels: (vessels: string[]) => void;
  setSelectedVessel: (vessel: string) => void;
  toggleVessel: (vesselName: string) => void;
  setFleetValue: (value: string) => void;
  setAddGroupValue: (value: string) => void;
  resetFilters: () => void;
}

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

const initialState = {
  periodValue: {
    mode: 'year-month' as const,
    year: currentYear,
    month: currentMonth,
  },
  complianceMode: 'Rest' as const,
  opaMode: false,
  filterType: 'vessel' as const,
  selectedVessels: [] as string[],
  selectedVessel: '',
  fleetValue: '',
  addGroupValue: '',
};

export const useRestHoursFiltersStore = create<RestHoursFiltersState>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      setPeriodValue: (value: PeriodFilterValue) => set({ periodValue: value }),
      
      setComplianceMode: (mode: 'Rest' | 'Work') => set({ complianceMode: mode }),
      
      setOpaMode: (enabled: boolean) => set({ opaMode: enabled }),
      
      setFilterType: (type: 'vessel' | 'fleet' | 'addGroup') => set({ filterType: type }),
      
      setSelectedVessels: (vessels: string[]) => set({ selectedVessels: vessels }),
      
      setSelectedVessel: (vessel: string) => set({ selectedVessel: vessel }),
      
      toggleVessel: (vesselName: string) => {
        const { selectedVessels } = get();
        const newValue = selectedVessels.includes(vesselName)
          ? selectedVessels.filter(v => v !== vesselName)
          : [...selectedVessels, vesselName];
        set({ selectedVessels: newValue });
      },
      
      setFleetValue: (value: string) => set({ fleetValue: value }),
      
      setAddGroupValue: (value: string) => set({ addGroupValue: value }),
      
      resetFilters: () => set(initialState),
    }),
    {
      name: 'rh-filters',
      partialize: (state) => ({
        periodValue: state.periodValue,
        complianceMode: state.complianceMode,
        opaMode: state.opaMode,
        filterType: state.filterType,
        selectedVessels: state.selectedVessels,
        selectedVessel: state.selectedVessel,
        fleetValue: state.fleetValue,
        addGroupValue: state.addGroupValue,
      }),
    }
  )
);
