import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type FilterType = 'vessel' | 'fleet' | 'addGroup';

interface DrugsAlcoholFiltersState {
  // applied (what actually filters the tables)
  filterType: FilterType;
  selectedVessels: string[];
  fleetValue: string;
  addGroupValue: string;
  summaryVessel: string;
  // draft (what the user is editing before pressing Apply)
  draftFilterType: FilterType;
  draftSelectedVessels: string[];
  draftFleetValue: string;
  draftAddGroupValue: string;
  draftSummaryVessel: string;

  toggleDraftVessel: (vesselName: string) => void;
  setDraftSelectedVessels: (vessels: string[]) => void;
  selectDraftFleet: (value: string) => void;
  selectDraftAddGroup: (value: string) => void;
  setDraftFilterType: (type: FilterType) => void;
  setDraftSummaryVessel: (vesselId: string) => void;
  clearDraftFilters: () => void;
  applyFilters: () => void;
  applySummary: () => void;
  syncDraftFromApplied: () => void;
}

const initialState = {
  filterType: 'vessel' as FilterType,
  selectedVessels: [] as string[],
  fleetValue: '',
  addGroupValue: '',
  summaryVessel: '',
  draftFilterType: 'vessel' as FilterType,
  draftSelectedVessels: [] as string[],
  draftFleetValue: '',
  draftAddGroupValue: '',
  draftSummaryVessel: '',
};

export const useDrugsAlcoholFiltersStore = create<DrugsAlcoholFiltersState>()(
  persist(
    (set, get) => ({
      ...initialState,

      toggleDraftVessel: (vesselName) => {
        const { draftSelectedVessels } = get();
        set({
          draftSelectedVessels: draftSelectedVessels.includes(vesselName)
            ? draftSelectedVessels.filter((v) => v !== vesselName)
            : [...draftSelectedVessels, vesselName],
          draftFilterType: 'vessel',
          draftFleetValue: '',
          draftAddGroupValue: '',
        });
      },
      setDraftSelectedVessels: (vessels) =>
        set({
          draftSelectedVessels: vessels,
          draftFilterType: 'vessel',
          draftFleetValue: '',
          draftAddGroupValue: '',
        }),
      selectDraftFleet: (value) =>
        set({
          draftFleetValue: value,
          draftFilterType: 'fleet',
          draftSelectedVessels: [],
          draftAddGroupValue: '',
        }),
      selectDraftAddGroup: (value) =>
        set({
          draftAddGroupValue: value,
          draftFilterType: 'addGroup',
          draftSelectedVessels: [],
          draftFleetValue: '',
        }),
      setDraftFilterType: (type) => set({ draftFilterType: type }),
      setDraftSummaryVessel: (vesselId) => set({ draftSummaryVessel: vesselId }),
      clearDraftFilters: () =>
        set({
          draftFilterType: 'vessel',
          draftSelectedVessels: [],
          draftFleetValue: '',
          draftAddGroupValue: '',
        }),
      applyFilters: () => {
        const { draftFilterType, draftSelectedVessels, draftFleetValue, draftAddGroupValue } = get();
        set({
          filterType: draftFilterType,
          selectedVessels: draftSelectedVessels,
          fleetValue: draftFleetValue,
          addGroupValue: draftAddGroupValue,
        });
      },
      applySummary: () => {
        const { draftSummaryVessel } = get();
        set({ summaryVessel: draftSummaryVessel });
      },
      syncDraftFromApplied: () => {
        const { filterType, selectedVessels, fleetValue, addGroupValue, summaryVessel } = get();
        set({
          draftFilterType: filterType,
          draftSelectedVessels: selectedVessels,
          draftFleetValue: fleetValue,
          draftAddGroupValue: addGroupValue,
          draftSummaryVessel: summaryVessel,
        });
      },
    }),
    {
      name: 'da-filters',
      partialize: (state) => ({
        filterType: state.filterType,
        selectedVessels: state.selectedVessels,
        fleetValue: state.fleetValue,
        addGroupValue: state.addGroupValue,
        summaryVessel: state.summaryVessel,
      }),
      onRehydrateStorage: () => (state) => {
        state?.syncDraftFromApplied();
      },
    }
  )
);
