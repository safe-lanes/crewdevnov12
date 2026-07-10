import { create } from 'zustand';
import type { PeriodFilterValue } from '@/components/filters/PeriodFilter';
import {
  EMPTY_MANAGEMENT_FILTERS,
  type ManagementFilters,
} from '@/modules/dashboard/ManagementFilterBar';

// Housekeeping: wipe stale persisted filters from the old localStorage-based version.
localStorage.removeItem('dashboard-filters');

const DEFAULT_PERIOD: PeriodFilterValue = { mode: 'year', year: new Date().getFullYear() };

interface DashboardFiltersState {
  period: PeriodFilterValue;
  filters: ManagementFilters;
  setPeriod: (period: PeriodFilterValue) => void;
  setFilters: (filters: ManagementFilters) => void;
  clearFilters: () => void;
}

export const useDashboardFiltersStore = create<DashboardFiltersState>()(
  (set) => ({
    period: DEFAULT_PERIOD,
    filters: EMPTY_MANAGEMENT_FILTERS,
    setPeriod: (period) => set({ period }),
    setFilters: (filters) => set({ filters }),
    clearFilters: () => set({ period: DEFAULT_PERIOD, filters: EMPTY_MANAGEMENT_FILTERS }),
  })
);
