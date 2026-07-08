import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PeriodFilterValue } from '@/components/filters/PeriodFilter';
import {
  EMPTY_MANAGEMENT_FILTERS,
  type ManagementFilters,
} from '@/modules/dashboard/ManagementFilterBar';

const DEFAULT_PERIOD: PeriodFilterValue = { mode: 'year', year: new Date().getFullYear() };

interface DashboardFiltersState {
  period: PeriodFilterValue;
  filters: ManagementFilters;
  setPeriod: (period: PeriodFilterValue) => void;
  setFilters: (filters: ManagementFilters) => void;
  clearFilters: () => void;
}

export const useDashboardFiltersStore = create<DashboardFiltersState>()(
  persist(
    (set) => ({
      period: DEFAULT_PERIOD,
      filters: EMPTY_MANAGEMENT_FILTERS,
      setPeriod: (period) => set({ period }),
      setFilters: (filters) => set({ filters }),
      clearFilters: () => set({ period: DEFAULT_PERIOD, filters: EMPTY_MANAGEMENT_FILTERS }),
    }),
    {
      name: 'dashboard-filters',
      partialize: (state) => ({
        period: state.period,
        filters: state.filters,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.period?.mode === 'date-range') {
          if (state.period.dateFrom && typeof state.period.dateFrom === 'string') {
            state.period.dateFrom = new Date(state.period.dateFrom);
          }
          if (state.period.dateTo && typeof state.period.dateTo === 'string') {
            state.period.dateTo = new Date(state.period.dateTo);
          }
        }
      },
    }
  )
);
