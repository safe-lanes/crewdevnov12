import { useMemo, useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ChartToolbar } from '@/components/charts/ChartToolbar';
import type { PeriodFilterValue } from '@/components/filters/PeriodFilter';
import { ViolationsOverviewDialog } from './ViolationsOverviewDialog';
import { NCOverviewDialog } from './NCOverviewDialog';

interface VesselAnalysisChartProps {
  vesselIds?: string[];
  periodFilter?: PeriodFilterValue;
  complianceMode?: 'Rest' | 'Work';
  opaMode?: boolean;
  onRenderToolbar?: (toolbar: JSX.Element) => void;
}

interface VesselMonthData {
  vesselId: string;
  vesselName: string;
  monthlyData: {
    [month: string]: {
      violations: number;
      ncs: number;
    };
  };
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export const VesselAnalysisChart = ({
  vesselIds,
  periodFilter,
  complianceMode = 'Rest',
  opaMode = false,
  onRenderToolbar,
}: VesselAnalysisChartProps) => {
  const [mode, setMode] = useState<'violations' | 'ncs'>('ncs');
  const [showFullscreen, setShowFullscreen] = useState(false);
  const currentYear = new Date().getFullYear();

  // Get selected year from period filter
  const selectedYear = useMemo(() => {
    if (!periodFilter) return currentYear;
    
    if (periodFilter.mode === 'year-month') {
      return periodFilter.year || currentYear;
    } else if (periodFilter.mode === 'date-range' && periodFilter.dateFrom) {
      return periodFilter.dateFrom.getFullYear();
    }
    
    return currentYear;
  }, [periodFilter, currentYear]);

  // Generate all 12 months for the selected year
  const monthsToFetch = useMemo(() => {
    const months: string[] = [];
    for (let i = 1; i <= 12; i++) {
      months.push(`${selectedYear}-${String(i).padStart(2, '0')}`);
    }
    return months;
  }, [selectedYear]);

  // Fetch vessel master data
  const { data: allVessels = [] } = useQuery<Array<{ id: number; entryId: string; name: string }>>({
    queryKey: ['/api/masters/014/data'],
    enabled: true,
  });

  // Create vessel ID to name map
  const vesselNameMap = useMemo(() => {
    const map = new Map<string, string>();
    allVessels.forEach(vessel => {
      map.set(vessel.entryId, vessel.name);
    });
    return map;
  }, [allVessels]);

  // Fetch crew records data for all months
  const { data: allCrewRecords = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/rest-hours-crew-records-vessel-analysis', vesselIds, complianceMode, opaMode, monthsToFetch],
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

  // Aggregate data by vessel and month
  const vesselData = useMemo<VesselMonthData[]>(() => {
    // Start with ALL vessels from master data (so vessels with zero data still appear)
    const vesselsToShow = vesselIds && vesselIds.length > 0 
      ? vesselIds  // Use filtered vessels if vessel filter is active
      : allVessels.map(v => v.entryId); // Otherwise show all vessels
    
    // Filter out placeholder records
    const realRecords = allCrewRecords.filter(r => 
      r.id != null || (r.totalViolations ?? 0) > 0 || (r.totalNCs ?? 0) > 0
    );

    // Build map of actual data from crew records
    const dataMap = new Map<string, { [monthKey: string]: { violations: number; ncs: number } }>();

    realRecords.forEach(record => {
      if (!record.vesselId) return;

      if (!dataMap.has(record.vesselId)) {
        dataMap.set(record.vesselId, {});
      }

      const vesselMonthData = dataMap.get(record.vesselId)!;
      const monthKey = record.monthValue || record.month; // monthValue format: YYYY-MM

      if (!monthKey) return;

      if (!vesselMonthData[monthKey]) {
        vesselMonthData[monthKey] = {
          violations: 0,
          ncs: 0,
        };
      }

      // Aggregate violations and NCs per vessel per month
      vesselMonthData[monthKey].violations += (record.totalViolations || 0);
      vesselMonthData[monthKey].ncs += (record.totalNCs || 0);
    });

    // Build final array: include ALL vessels (even those with no data)
    const result: VesselMonthData[] = vesselsToShow.map(vesselId => {
      return {
        vesselId,
        vesselName: vesselNameMap.get(vesselId) || vesselId,
        monthlyData: dataMap.get(vesselId) || {}, // Empty object if no data
      };
    });

    // Sort alphabetically by vessel name
    return result.sort((a, b) => a.vesselName.localeCompare(b.vesselName));
  }, [allCrewRecords, vesselNameMap, allVessels, vesselIds]);

  // Memoize toolbar element
  const toolbar = useMemo(() => {
    return (
      <ChartToolbar
        chartTitle="Vessel Analysis"
        onFullscreen={() => setShowFullscreen(true)}
      />
    );
  }, []);

  // Call onRenderToolbar in effect to avoid render-phase updates
  useEffect(() => {
    if (onRenderToolbar) {
      onRenderToolbar(toolbar);
    }
    
    // Cleanup: reset toolbar on unmount
    return () => {
      if (onRenderToolbar) {
        onRenderToolbar(<div />);
      }
    };
  }, [toolbar, onRenderToolbar]);

  // Render table content (shared between regular and fullscreen views)
  const renderTable = () => (
    <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white dark:bg-gray-800 border-b border-r border-gray-300 dark:border-gray-600 px-3 py-1.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">
                {/* Empty header for vessel names */}
              </th>
              {MONTHS.map((month, index) => (
                <th
                  key={month}
                  className="border-b border-gray-300 dark:border-gray-600 px-1.5 py-1.5 text-center text-xs font-semibold text-gray-700 dark:text-gray-300"
                  data-testid={`header-${month.toLowerCase()}`}
                >
                  {month}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vesselData.length === 0 ? (
              <tr>
                <td colSpan={13} className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
                  No data available
                </td>
              </tr>
            ) : (
              vesselData.map((vessel) => (
                <tr key={vessel.vesselId} data-testid={`row-vessel-${vessel.vesselId}`}>
                  <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 border-r border-b border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {vessel.vesselName}
                  </td>
                  {MONTHS.map((month, index) => {
                    const monthIndex = index + 1;
                    const monthKey = `${selectedYear}-${String(monthIndex).padStart(2, '0')}`;
                    const data = vessel.monthlyData[monthKey];
                    const value = mode === 'violations' 
                      ? (data?.violations || 0) 
                      : (data?.ncs || 0);

                    return (
                      <td
                        key={month}
                        className="border-b border-gray-200 dark:border-gray-700 px-1.5 py-1.5 text-center"
                        data-testid={`cell-${vessel.vesselId}-${month.toLowerCase()}`}
                      >
                        <div className="flex items-center justify-center">
                          {value === 0 ? (
                            <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                              <span className="text-white text-[10px] font-semibold">
                                {value}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
    </table>
  );

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-sm text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <div className="w-full h-full flex flex-col">
        {/* Header and Toggle Switch */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            GROUP & VESSEL ANALYSIS
          </h3>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${mode === 'ncs' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
              NCs
            </span>
            <Switch
              checked={mode === 'violations'}
              onCheckedChange={(checked) => setMode(checked ? 'violations' : 'ncs')}
              data-testid="toggle-switch"
            />
            <span className={`text-sm font-medium ${mode === 'violations' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
              Violations
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {renderTable()}
        </div>
      </div>

      {/* Fullscreen Dialog */}
      <Dialog open={showFullscreen} onOpenChange={setShowFullscreen}>
        <DialogContent className="max-w-[95vw] h-[95vh] flex flex-col p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Vessel Analysis - {mode === 'violations' ? 'Violations' : 'NCs'}
            </h2>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-medium ${mode === 'ncs' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                NCs
              </span>
              <Switch
                checked={mode === 'violations'}
                onCheckedChange={(checked) => setMode(checked ? 'violations' : 'ncs')}
              />
              <span className={`text-sm font-medium ${mode === 'violations' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                Violations
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            {renderTable()}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
