import type { PeriodFilterValue } from '@/components/filters/PeriodFilter';

export interface RestHoursFilters {
  // Period filter
  periodMode?: 'year-month' | 'year-quarter' | 'date-range';
  year?: number;
  month?: number;
  quarter?: 1 | 2 | 3 | 4;
  dateFrom?: string; // ISO date string
  dateTo?: string; // ISO date string
  
  // Vessel/fleet filters
  filterType?: 'vessel' | 'fleet' | 'addGroup';
  vesselIds?: string[];
  fleetGroup?: string;
  addGroup?: string;
  
  // Compliance filters
  complianceMode?: 'Rest' | 'Work';
  opaMode?: boolean;
}

export function serializeRestHoursFilters(filters: RestHoursFilters): string {
  const params = new URLSearchParams();
  
  // Period parameters
  if (filters.periodMode) {
    params.append('periodMode', filters.periodMode);
  }
  if (filters.year !== undefined) {
    params.append('year', String(filters.year));
  }
  if (filters.month !== undefined) {
    params.append('month', String(filters.month));
  }
  if (filters.quarter !== undefined) {
    params.append('quarter', String(filters.quarter));
  }
  if (filters.dateFrom) {
    params.append('dateFrom', filters.dateFrom);
  }
  if (filters.dateTo) {
    params.append('dateTo', filters.dateTo);
  }
  
  // Filter type
  if (filters.filterType) {
    params.append('filterType', filters.filterType);
  }
  
  // Vessel IDs (multiple)
  if (filters.vesselIds && filters.vesselIds.length > 0) {
    filters.vesselIds.forEach(id => params.append('vessel', id));
  }
  
  // Fleet group
  if (filters.fleetGroup) {
    params.append('fleet', filters.fleetGroup);
  }
  
  // Additional group
  if (filters.addGroup) {
    params.append('addGroup', filters.addGroup);
  }
  
  // Compliance mode
  if (filters.complianceMode) {
    params.append('compliance', filters.complianceMode);
  }
  
  // OPA mode
  if (filters.opaMode !== undefined) {
    params.append('opa', String(filters.opaMode));
  }
  
  return params.toString();
}

export function parseRestHoursFilters(search: string): RestHoursFilters {
  const params = new URLSearchParams(search);
  const filters: RestHoursFilters = {};
  
  // Period parameters
  const periodMode = params.get('periodMode');
  if (periodMode === 'year-month' || periodMode === 'year-quarter' || periodMode === 'date-range') {
    filters.periodMode = periodMode;
  }
  
  const year = params.get('year');
  if (year) {
    const yearNum = parseInt(year, 10);
    if (!isNaN(yearNum)) {
      filters.year = yearNum;
    }
  }
  
  const month = params.get('month');
  if (month) {
    const monthNum = parseInt(month, 10);
    if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
      filters.month = monthNum;
    }
  }
  
  const quarter = params.get('quarter');
  if (quarter) {
    const quarterNum = parseInt(quarter, 10);
    if (!isNaN(quarterNum) && quarterNum >= 1 && quarterNum <= 4) {
      filters.quarter = quarterNum as 1 | 2 | 3 | 4;
    }
  }
  
  const dateFrom = params.get('dateFrom');
  if (dateFrom) {
    filters.dateFrom = dateFrom;
  }
  
  const dateTo = params.get('dateTo');
  if (dateTo) {
    filters.dateTo = dateTo;
  }
  
  // Filter type
  const filterType = params.get('filterType');
  if (filterType === 'vessel' || filterType === 'fleet' || filterType === 'addGroup') {
    filters.filterType = filterType;
  }
  
  // Vessel IDs (can be multiple)
  const vesselIds = params.getAll('vessel');
  if (vesselIds.length > 0) {
    filters.vesselIds = vesselIds;
  }
  
  // Fleet group
  const fleet = params.get('fleet');
  if (fleet) {
    filters.fleetGroup = fleet;
  }
  
  // Additional group
  const addGroup = params.get('addGroup');
  if (addGroup) {
    filters.addGroup = addGroup;
  }
  
  // Compliance mode
  const compliance = params.get('compliance');
  if (compliance === 'Rest' || compliance === 'Work') {
    filters.complianceMode = compliance;
  }
  
  // OPA mode
  const opa = params.get('opa');
  if (opa !== null) {
    filters.opaMode = opa === 'true';
  }
  
  return filters;
}

export function periodFilterToPart(periodFilter: PeriodFilterValue): Partial<RestHoursFilters> {
  const part: Partial<RestHoursFilters> = {
    periodMode: periodFilter.mode,
  };
  
  if (periodFilter.year !== undefined) {
    part.year = periodFilter.year;
  }
  if (periodFilter.month !== undefined) {
    part.month = periodFilter.month;
  }
  if (periodFilter.quarter !== undefined) {
    part.quarter = periodFilter.quarter;
  }
  if (periodFilter.dateFrom) {
    // Convert Date to ISO string
    part.dateFrom = periodFilter.dateFrom.toISOString().split('T')[0];
  }
  if (periodFilter.dateTo) {
    // Convert Date to ISO string
    part.dateTo = periodFilter.dateTo.toISOString().split('T')[0];
  }
  
  return part;
}

export function partToPeriodFilter(part: Partial<RestHoursFilters>): PeriodFilterValue | undefined {
  if (!part.periodMode) {
    return undefined;
  }
  
  const result: PeriodFilterValue = {
    mode: part.periodMode,
    year: part.year,
    month: part.month,
    quarter: part.quarter,
    dateFrom: part.dateFrom ? new Date(part.dateFrom) : undefined,
    dateTo: part.dateTo ? new Date(part.dateTo) : undefined,
  };
  
  return result;
}
