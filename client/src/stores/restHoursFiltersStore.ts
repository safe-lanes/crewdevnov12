import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PeriodFilterValue {
  mode: 'year' | 'year-month' | 'year-quarter' | 'date-range';
  year?: number;
  month?: number;
  quarter?: 1 | 2 | 3 | 4;
  startDate?: string;
  endDate?: string;
}

interface RestHoursFiltersState {
  periodValue: PeriodFilterValue;
  complianceMode: 'Rest' | 'Work';
  opaMode: boolean;
  filterType: 'vessel' | 'fleet' | 'addGroup';
  selectedVessels: string[];
  planVesselId: string;
  fleetValue: string;
  addGroupValue: string;
  draftFilterType: 'vessel' | 'fleet' | 'addGroup';
  draftSelectedVessels: string[];
  draftPlanVesselId: string;
  draftFleetValue: string;
  draftAddGroupValue: string;
  
  setPeriodValue: (value: PeriodFilterValue) => void;
  setComplianceMode: (mode: 'Rest' | 'Work') => void;
  setOpaMode: (enabled: boolean) => void;
  setFilterType: (type: 'vessel' | 'fleet' | 'addGroup') => void;
  setSelectedVessels: (vessels: string[]) => void;
  setPlanVesselId: (vesselId: string) => void;
  toggleVessel: (vesselName: string) => void;
  setFleetValue: (value: string) => void;
  setAddGroupValue: (value: string) => void;
  setDraftFilterType: (type: 'vessel' | 'fleet' | 'addGroup') => void;
  setDraftSelectedVessels: (vessels: string[]) => void;
  setDraftPlanVesselId: (vesselId: string) => void;
  toggleDraftVessel: (vesselName: string) => void;
  setDraftFleetValue: (value: string) => void;
  setDraftAddGroupValue: (value: string) => void;
  applyFilters: () => void;
  syncDraftFromApplied: () => void;
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
  planVesselId: '',
  fleetValue: '',
  addGroupValue: '',
  draftFilterType: 'vessel' as const,
  draftSelectedVessels: [] as string[],
  draftPlanVesselId: '',
  draftFleetValue: '',
  draftAddGroupValue: '',
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
      
      setPlanVesselId: (vesselId: string) => set({ planVesselId: vesselId }),
      
      toggleVessel: (vesselName: string) => {
        const { selectedVessels } = get();
        const newValue = selectedVessels.includes(vesselName)
          ? selectedVessels.filter(v => v !== vesselName)
          : [...selectedVessels, vesselName];
        set({ selectedVessels: newValue });
      },
      
      setFleetValue: (value: string) => set({ fleetValue: value }),
      
      setAddGroupValue: (value: string) => set({ addGroupValue: value }),

      setDraftFilterType: (type) => set({ draftFilterType: type }),
      setDraftSelectedVessels: (vessels) => set({ draftSelectedVessels: vessels }),
      setDraftPlanVesselId: (vesselId) => set({ draftPlanVesselId: vesselId }),
      toggleDraftVessel: (vesselName) => {
        const { draftSelectedVessels } = get();
        set({ draftSelectedVessels: draftSelectedVessels.includes(vesselName)
          ? draftSelectedVessels.filter(v => v !== vesselName)
          : [...draftSelectedVessels, vesselName] });
      },
      setDraftFleetValue: (value) => set({ draftFleetValue: value }),
      setDraftAddGroupValue: (value) => set({ draftAddGroupValue: value }),
      applyFilters: () => {
        const { draftFilterType, draftSelectedVessels, draftPlanVesselId, draftFleetValue, draftAddGroupValue } = get();
        set({ filterType: draftFilterType, selectedVessels: draftSelectedVessels,
          planVesselId: draftPlanVesselId, fleetValue: draftFleetValue, addGroupValue: draftAddGroupValue });
      },
      syncDraftFromApplied: () => {
        const { filterType, selectedVessels, planVesselId, fleetValue, addGroupValue } = get();
        set({ draftFilterType: filterType, draftSelectedVessels: selectedVessels,
          draftPlanVesselId: planVesselId, draftFleetValue: fleetValue, draftAddGroupValue: addGroupValue });
      },
      
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
        planVesselId: state.planVesselId,
        fleetValue: state.fleetValue,
        addGroupValue: state.addGroupValue,
      }),
      onRehydrateStorage: () => (state) => { state?.syncDraftFromApplied(); },
    }
  )
);
