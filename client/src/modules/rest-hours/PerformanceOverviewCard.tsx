import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SemiCircularGauge } from '@/components/charts/SemiCircularGauge';
import type { PeriodFilterValue } from '@/components/filters/PeriodFilter';

interface PerformanceOverviewCardProps {
  vesselIds?: string[];
  monthValue?: string;
  periodFilter?: PeriodFilterValue;
  complianceMode?: 'Rest' | 'Work';
  opaMode?: boolean;
}

export const PerformanceOverviewCard = ({
  vesselIds,
  monthValue,
  periodFilter,
  complianceMode = 'Rest',
  opaMode = false,
}: PerformanceOverviewCardProps) => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // Generate months to fetch based on period filter
  const monthsToFetch = useMemo(() => {
    const months: string[] = [];
    
    if (!periodFilter) {
      // Default to current month if no filter
      months.push(`${currentYear}-${String(currentMonth).padStart(2, '0')}`);
      return months;
    }
    
    if (periodFilter.mode === 'year-month') {
      const year = periodFilter.year || currentYear;
      const month = periodFilter.month || currentMonth;
      months.push(`${year}-${String(month).padStart(2, '0')}`);
    } else if (periodFilter.mode === 'date-range' && periodFilter.dateFrom && periodFilter.dateTo) {
      const startDate = periodFilter.dateFrom;
      const endDate = periodFilter.dateTo;
      
      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth() + 1;
      const endYear = endDate.getFullYear();
      const endMonth = endDate.getMonth() + 1;
      
      let currentIterYear = startYear;
      let currentIterMonth = startMonth;
      
      while (currentIterYear < endYear || (currentIterYear === endYear && currentIterMonth <= endMonth)) {
        months.push(`${currentIterYear}-${String(currentIterMonth).padStart(2, '0')}`);
        
        currentIterMonth++;
        if (currentIterMonth > 12) {
          currentIterMonth = 1;
          currentIterYear++;
        }
      }
    }
    
    return months;
  }, [periodFilter, currentYear, currentMonth]);

  // Fetch total vessels count from master data
  const { data: allVessels = [] } = useQuery<Array<{ id: number; entryId: string; name: string }>>({
    queryKey: ['/api/masters/014/data'],
    enabled: true,
  });

  // Calculate total vessels based on filter
  const totalVesselsInFleet = useMemo(() => {
    if (vesselIds && vesselIds.length > 0) {
      return vesselIds.length;
    }
    return allVessels.length;
  }, [vesselIds, allVessels]);

  // Fetch crew records data
  const { data: allCrewRecords = [], isLoading, isError, error } = useQuery<any[]>({
    queryKey: ['/api/rest-hours-crew-records-performance', vesselIds, complianceMode, opaMode, monthsToFetch],
    queryFn: async () => {
      if (monthsToFetch.length === 0) return [];
      
      const fetchPromises = monthsToFetch.map(async (month) => {
        const params = new URLSearchParams();
        params.append('monthValue', month);
        if (vesselIds && vesselIds.length > 0) {
          vesselIds.forEach((id: string) => params.append('vesselIds', id));
        }
        params.append('complianceMode', complianceMode);
        params.append('opaMode', String(opaMode));
        
        const url = `/api/rest-hours-crew-records?${params.toString()}`;
        const res = await fetch(url, { credentials: 'include' });
        
        if (!res.ok) {
          throw new Error(`Failed to fetch crew records for ${month}: ${res.statusText}`);
        }
        
        return await res.json();
      });

      const allResults = await Promise.all(fetchPromises);
      return allResults.flat();
    },
    enabled: monthsToFetch.length > 0,
  });

  // Calculate performance metrics
  const metrics = useMemo(() => {
    // Use total vessels from fleet, not just vessels with data
    const totalVessels = totalVesselsInFleet;

    if (!allCrewRecords || allCrewRecords.length === 0) {
      return {
        totalViolations: 0,
        significantNCs: 0,
        predictedNCs: 0,
        vesselsWithViolations: 0,
        vesselsWithNCs: 0,
        totalVessels,
        violationsPercentage: 0,
        ncsPercentage: 0,
      };
    }

    // Filter out placeholder records
    const realRecords = allCrewRecords.filter(r => 
      r.id != null || (r.totalViolations ?? 0) > 0 || (r.totalNCs ?? 0) > 0
    );

    if (realRecords.length === 0) {
      return {
        totalViolations: 0,
        significantNCs: 0,
        predictedNCs: 0,
        vesselsWithViolations: 0,
        vesselsWithNCs: 0,
        totalVessels,
        violationsPercentage: 0,
        ncsPercentage: 0,
      };
    }

    let totalViolations = 0;
    let significantNCs = 0;
    let predictedNCs = 0;
    const vesselsWithViolationsSet = new Set<string>();
    const vesselsWithNCsSet = new Set<string>();

    realRecords.forEach(record => {
      totalViolations += (record.totalViolations || 0);
      significantNCs += (record.totalNCs || 0);
      predictedNCs += (record.predictedViolations || 0);
      
      if (record.vesselId) {
        if ((record.totalViolations || 0) > 0) {
          vesselsWithViolationsSet.add(record.vesselId);
        }
        
        if ((record.totalNCs || 0) > 0) {
          vesselsWithNCsSet.add(record.vesselId);
        }
      }
    });

    const vesselsWithViolations = vesselsWithViolationsSet.size;
    const vesselsWithNCs = vesselsWithNCsSet.size;
    
    const violationsPercentage = totalVessels > 0 ? (vesselsWithViolations / totalVessels) * 100 : 0;
    const ncsPercentage = totalVessels > 0 ? (vesselsWithNCs / totalVessels) * 100 : 0;

    return {
      totalViolations,
      significantNCs,
      predictedNCs,
      vesselsWithViolations,
      vesselsWithNCs,
      totalVessels,
      violationsPercentage,
      ncsPercentage,
    };
  }, [allCrewRecords, totalVesselsInFleet]);

  // Helper function to get color based on percentage
  const getColorForPercentage = (percentage: number): string => {
    if (percentage < 25) return '#10b981'; // Green
    if (percentage <= 75) return '#f59e0b'; // Orange
    return '#ef4444'; // Red
  };

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-sm text-red-500">Error loading data: {error instanceof Error ? error.message : 'Unknown error'}</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col p-4 space-y-4">
      {/* Row 1: Text Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Violations</div>
          <div className="text-3xl font-bold text-gray-800 dark:text-gray-200" data-testid="metric-total-violations">
            {metrics.totalViolations}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">NCs</div>
          <div className="text-3xl font-bold text-gray-800 dark:text-gray-200" data-testid="metric-significant-ncs">
            {metrics.significantNCs}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Predicted NCs</div>
          <div className="text-3xl font-bold text-gray-800 dark:text-gray-200" data-testid="metric-predicted-ncs">
            {metrics.predictedNCs}
          </div>
        </div>
      </div>

      {/* Row 2: Semi-Circular Gauge Charts */}
      <div className="flex-1 grid grid-cols-2 gap-4">
        <div className="flex flex-col">
          <div className="text-xs text-center text-gray-600 dark:text-gray-400 mb-2 font-medium min-h-[32px] flex items-center justify-center">
            No of Vessels with Violations
          </div>
          <div className="flex-1 flex items-center justify-center" data-testid="chart-vessels-violations">
            <SemiCircularGauge
              value={metrics.vesselsWithViolations}
              max={metrics.totalVessels || 1}
              color={getColorForPercentage(metrics.violationsPercentage)}
              label="Vessels"
            />
          </div>
        </div>

        <div className="flex flex-col">
          <div className="text-xs text-center text-gray-600 dark:text-gray-400 mb-2 font-medium min-h-[32px] flex items-center justify-center">
            No of Vessels with NCs
          </div>
          <div className="flex-1 flex items-center justify-center" data-testid="chart-vessels-ncs">
            <SemiCircularGauge
              value={metrics.vesselsWithNCs}
              max={metrics.totalVessels || 1}
              color={getColorForPercentage(metrics.ncsPercentage)}
              label="Vessels"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
