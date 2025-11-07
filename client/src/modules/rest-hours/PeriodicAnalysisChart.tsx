import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AgCharts } from '@/lib/agCharts';
import type { AgChartOptions, AgChartInstance } from '@/lib/agCharts';
import { ChartToolbar, type ChartType } from '@/components/charts/ChartToolbar';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { PeriodFilterValue } from '@/components/filters/PeriodFilter';

interface PeriodicAnalysisChartProps {
  vesselIds?: string[];
  monthValue?: string;
  periodFilter?: PeriodFilterValue;
  onRenderToolbar?: (toolbar: JSX.Element) => void;
  complianceMode?: 'Rest' | 'Work';
  opaMode?: boolean;
}

interface YearlyData {
  year: number;
  avgViolationDays: number;
  avgNCs: number;
}

interface QuarterlyData {
  quarter: string; // Format: "Q1 2024"
  year: number;
  quarterNum: number; // 1-4
  avgViolationDays: number;
  avgNCs: number;
}

export const PeriodicAnalysisChart = ({ 
  vesselIds, 
  monthValue,
  periodFilter,
  onRenderToolbar,
  complianceMode = 'Rest',
  opaMode = false,
}: PeriodicAnalysisChartProps) => {
  const chartRef = useRef<AgChartInstance | null>(null);
  const [chartType, setChartType] = useState<ChartType>('line');
  const [periodType, setPeriodType] = useState<'years' | 'quarters' | 'months'>('years');

  // For Years view, we ignore the monthValue prop and fetch data for last 4 years
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-12
  
  const yearsToFetch = useMemo(() => {
    return [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
  }, [currentYear]);

  // Generate all month values for the last 4 years (for Years view)
  const monthsToFetch = useMemo(() => {
    const months: string[] = [];
    yearsToFetch.forEach(year => {
      const endMonth = year === currentYear ? currentMonth : 12;
      for (let month = 1; month <= endMonth; month++) {
        months.push(`${year}-${String(month).padStart(2, '0')}`);
      }
    });
    return months;
  }, [yearsToFetch, currentYear, currentMonth]);

  // Generate months for Quarterly view based on period filter
  const quarterlyMonthsToFetch = useMemo(() => {
    if (!periodFilter) return [];
    
    const months: string[] = [];
    
    if (periodFilter.mode === 'year-month') {
      // Show all 4 quarters of the selected year (ignore month/quarter selection)
      const year = periodFilter.year || currentYear;
      for (let month = 1; month <= 12; month++) {
        months.push(`${year}-${String(month).padStart(2, '0')}`);
      }
    } else if (periodFilter.mode === 'date-range' && periodFilter.dateFrom && periodFilter.dateTo) {
      // Calculate quarters between start and end dates
      const startDate = periodFilter.dateFrom;
      const endDate = periodFilter.dateTo;
      
      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth() + 1; // 1-12
      const endYear = endDate.getFullYear();
      const endMonth = endDate.getMonth() + 1; // 1-12
      
      // Generate all months between start and end
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
  }, [periodFilter, currentYear]);

  // Fetch crew summary data
  // For Years view: fetch last 4 years
  // For Quarters view: fetch months based on period filter
  const { data: allCrewRecords = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/rest-hours-crew-records-periodic', vesselIds, complianceMode, opaMode, periodType, monthsToFetch, quarterlyMonthsToFetch],
    queryFn: async () => {
      // Determine which months to fetch based on period type
      const monthsToFetchList = periodType === 'years' ? monthsToFetch : quarterlyMonthsToFetch;
      
      if (monthsToFetchList.length === 0) return [];
      
      // Fetch data for all months in parallel
      const fetchPromises = monthsToFetchList.map(async (month) => {
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

      // Wait for all requests to complete
      const allResults = await Promise.all(fetchPromises);
      
      // Flatten the array of arrays into a single array
      return allResults.flat();
    },
    enabled: periodType === 'years' || (periodType === 'quarters' && quarterlyMonthsToFetch.length > 0),
  });

  // Calculate yearly aggregates
  const yearlyData = useMemo<YearlyData[]>(() => {
    if (!allCrewRecords || allCrewRecords.length === 0) return [];

    // Group records by year
    const yearGroups = new Map<number, any[]>();
    
    allCrewRecords.forEach(record => {
      if (!record.monthValue) return;
      
      const year = parseInt(record.monthValue.split('-')[0]);
      
      // Only include data from the last 4 years
      if (!yearsToFetch.includes(year)) return;
      
      if (!yearGroups.has(year)) {
        yearGroups.set(year, []);
      }
      yearGroups.get(year)!.push(record);
    });

    // Calculate averages for each year
    const results: YearlyData[] = [];
    
    yearsToFetch.forEach(year => {
      const records = yearGroups.get(year) || [];
      
      if (records.length === 0) {
        results.push({
          year,
          avgViolationDays: 0,
          avgNCs: 0,
        });
        return;
      }

      // Calculate total violation days and NCs
      let totalViolationDays = 0;
      let totalNCs = 0;

      records.forEach(record => {
        totalViolationDays += (record.totalViolations || 0);
        totalNCs += (record.totalNCs || 0);
      });

      // Calculate average per vessel per month
      // records.length represents vessel-months (number of vessel-month combinations)
      const avgViolationDays = records.length > 0 ? totalViolationDays / records.length : 0;
      const avgNCs = records.length > 0 ? totalNCs / records.length : 0;

      results.push({
        year,
        avgViolationDays: parseFloat(avgViolationDays.toFixed(2)),
        avgNCs: parseFloat(avgNCs.toFixed(2)),
      });
    });

    // Sort by year ascending
    return results.sort((a, b) => a.year - b.year);
  }, [allCrewRecords, yearsToFetch]);

  // Calculate quarterly aggregates
  const quarterlyData = useMemo<QuarterlyData[]>(() => {
    if (!allCrewRecords || allCrewRecords.length === 0 || periodType !== 'quarters') return [];

    // Helper function to get quarter number from month (1-12)
    const getQuarter = (month: number): number => {
      return Math.ceil(month / 3); // Q1: 1-3, Q2: 4-6, Q3: 7-9, Q4: 10-12
    };

    // Group records by year and quarter
    const quarterGroups = new Map<string, any[]>(); // key: "2024-Q1"
    
    allCrewRecords.forEach(record => {
      if (!record.monthValue) return;
      
      const [yearStr, monthStr] = record.monthValue.split('-');
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);
      const quarterNum = getQuarter(month);
      const quarterKey = `${year}-Q${quarterNum}`;
      
      if (!quarterGroups.has(quarterKey)) {
        quarterGroups.set(quarterKey, []);
      }
      quarterGroups.get(quarterKey)!.push(record);
    });

    // Calculate averages for each quarter
    const results: QuarterlyData[] = [];
    
    quarterGroups.forEach((records, quarterKey) => {
      const [yearStr, quarterStr] = quarterKey.split('-');
      const year = parseInt(yearStr);
      const quarterNum = parseInt(quarterStr.replace('Q', ''));
      
      // Calculate total violation days and NCs
      // Same methodology as yearly view: sum all vessel-month totals and divide by count
      let totalViolationDays = 0;
      let totalNCs = 0;

      records.forEach(record => {
        totalViolationDays += (record.totalViolations || 0);
        totalNCs += (record.totalNCs || 0);
      });

      // Calculate average per vessel per month
      // records.length represents vessel-months (number of vessel-month combinations)
      // This matches the yearly aggregation methodology
      const avgViolationDays = records.length > 0 ? totalViolationDays / records.length : 0;
      const avgNCs = records.length > 0 ? totalNCs / records.length : 0;

      results.push({
        quarter: `Q${quarterNum} ${year}`,
        year,
        quarterNum,
        avgViolationDays: parseFloat(avgViolationDays.toFixed(2)),
        avgNCs: parseFloat(avgNCs.toFixed(2)),
      });
    });

    // Sort by year and quarter ascending
    return results.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.quarterNum - b.quarterNum;
    });
  }, [allCrewRecords, periodType]);

  const handleDownload = useCallback(() => {
    if (chartRef.current) {
      chartRef.current.download({
        fileName: 'periodic_analysis.png',
      });
    }
  }, []);

  const chartOptions = useMemo<AgChartOptions>(() => {
    // Determine data and xKey based on period type
    const data = periodType === 'quarters' ? quarterlyData : yearlyData;
    const xKey = periodType === 'quarters' ? 'quarter' : 'year';
    const xLabel = (datum: any) => periodType === 'quarters' ? datum.quarter : String(datum.year);
    
    const baseOptions: AgChartOptions = {
      data,
      background: {
        fill: '#ffffff',
      },
      padding: {
        top: 10,
        right: 10,
        bottom: 30,
        left: 40,
      },
    };

    if (chartType === 'bar') {
      // Column chart for Periodic Analysis
      return {
        ...baseOptions,
        series: [
          {
            type: 'bar' as any,
            xKey,
            yKey: 'avgNCs',
            yName: 'NCs per Vessel',
            fill: '#ef4444', // Red
            strokeWidth: 0,
            tooltip: {
              renderer: ({ datum }: any) => {
                return `<div class="ag-chart-tooltip-title" style="background-color: #ef4444; padding: 4px 8px; color: white; font-weight: bold;">
                  ${xLabel(datum)}
                </div>
                <div class="ag-chart-tooltip-content" style="padding: 4px 8px;">
                  Avg NCs: ${datum.avgNCs}
                </div>`;
              },
            },
          } as any,
          {
            type: 'bar' as any,
            xKey,
            yKey: 'avgViolationDays',
            yName: 'Violations per Vessel',
            fill: '#52baf3', // Blue
            strokeWidth: 0,
            tooltip: {
              renderer: ({ datum }: any) => {
                return `<div class="ag-chart-tooltip-title" style="background-color: #52baf3; padding: 4px 8px; color: white; font-weight: bold;">
                  ${xLabel(datum)}
                </div>
                <div class="ag-chart-tooltip-content" style="padding: 4px 8px;">
                  Avg Violations: ${datum.avgViolationDays}
                </div>`;
              },
            },
          } as any,
        ],
        axes: [
          {
            type: 'category' as any,
            position: 'bottom',
            title: {
              text: periodType === 'quarters' ? 'Quarter' : 'Year',
              enabled: false,
            },
            label: {
              fontSize: 11,
              color: '#4b5563',
            },
          } as any,
          {
            type: 'number' as any,
            position: 'left',
            title: {
              text: 'Average per Vessel per Month',
              enabled: false,
            },
            label: {
              fontSize: 11,
              color: '#4b5563',
            },
          } as any,
        ],
        legend: {
          enabled: true,
          position: 'bottom',
        },
      } as AgChartOptions;
    }

    // Default: Line chart
    return {
      ...baseOptions,
      series: [
        {
          type: 'line' as any,
          xKey,
          yKey: 'avgNCs',
          yName: 'NCs per Vessel',
          stroke: '#ef4444', // Red
          strokeWidth: 2,
          marker: {
            fill: '#ef4444',
            stroke: '#dc2626',
            strokeWidth: 1,
            size: 6,
          },
          tooltip: {
            renderer: ({ datum }: any) => {
              return `<div class="ag-chart-tooltip-title" style="background-color: #ef4444; padding: 4px 8px; color: white; font-weight: bold;">
                ${xLabel(datum)}
              </div>
              <div class="ag-chart-tooltip-content" style="padding: 4px 8px;">
                Avg NCs: ${datum.avgNCs}
              </div>`;
            },
          },
        } as any,
        {
          type: 'line' as any,
          xKey,
          yKey: 'avgViolationDays',
          yName: 'Violations per Vessel',
          stroke: '#52baf3', // Blue
          strokeWidth: 2,
          marker: {
            fill: '#52baf3',
            stroke: '#3a9fd9',
            strokeWidth: 1,
            size: 6,
          },
          tooltip: {
            renderer: ({ datum }: any) => {
              return `<div class="ag-chart-tooltip-title" style="background-color: #52baf3; padding: 4px 8px; color: white; font-weight: bold;">
                ${xLabel(datum)}
              </div>
              <div class="ag-chart-tooltip-content" style="padding: 4px 8px;">
                Avg Violations: ${datum.avgViolationDays}
              </div>`;
            },
          },
        } as any,
      ],
      axes: [
        {
          type: 'category' as any,
          position: 'bottom',
          title: {
            text: periodType === 'quarters' ? 'Quarter' : 'Year',
            enabled: false,
          },
          label: {
            fontSize: 11,
            color: '#4b5563',
          },
        } as any,
        {
          type: 'number' as any,
          position: 'left',
          title: {
            text: 'Average per Vessel per Month',
            enabled: false,
          },
          label: {
            fontSize: 11,
            color: '#4b5563',
          },
        } as any,
      ],
      legend: {
        enabled: true,
        position: 'bottom',
      },
    } as AgChartOptions;
  }, [yearlyData, quarterlyData, periodType, chartType]);

  // Create toolbar element (memoized to prevent unnecessary re-renders)
  // Only include ChartToolbar - period radio buttons are now inside the card
  const toolbar = useMemo(() => (
    <ChartToolbar
      chartType={chartType}
      onChartTypeChange={setChartType}
      onDownload={handleDownload}
      showChartTypeSelector={true}
    />
  ), [chartType, handleDownload]);

  // Call onRenderToolbar in useEffect to avoid infinite loops
  useEffect(() => {
    if (onRenderToolbar) {
      onRenderToolbar(toolbar);
    }
  }, [onRenderToolbar, toolbar]);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    );
  }

  const hasData = periodType === 'quarters' ? quarterlyData.length > 0 : yearlyData.length > 0;
  
  if (!hasData) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-sm text-gray-500">No data available</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-0 flex flex-col">
      {/* Period Type Radio Buttons - Inside card at top */}
      <div className="pt-1 pb-0 px-2">
        <RadioGroup 
          value={periodType} 
          onValueChange={(value: 'years' | 'quarters' | 'months') => setPeriodType(value)}
          className="flex items-center justify-center gap-3"
        >
          <div className="flex items-center gap-1.5">
            <RadioGroupItem 
              value="years" 
              id="period-years"
              className="h-3 w-3"
            />
            <Label 
              htmlFor="period-years" 
              className="text-[10px] font-normal text-[#4f5863] dark:text-neutral-300 cursor-pointer uppercase"
            >
              Yearly
            </Label>
          </div>
          <div className="flex items-center gap-1.5">
            <RadioGroupItem 
              value="quarters" 
              id="period-quarters"
              className="h-3 w-3"
            />
            <Label 
              htmlFor="period-quarters" 
              className="text-[10px] font-normal text-[#4f5863] dark:text-neutral-300 cursor-pointer uppercase"
            >
              Quarterly
            </Label>
          </div>
          <div className="flex items-center gap-1.5">
            <RadioGroupItem 
              value="months" 
              id="period-months"
              className="h-3 w-3"
              disabled
            />
            <Label 
              htmlFor="period-months" 
              className="text-[10px] font-normal text-gray-400 dark:text-gray-600 cursor-not-allowed uppercase"
            >
              Monthly
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Chart Area */}
      <div className="flex-1 min-h-0">
        <AgCharts 
          ref={chartRef}
          options={chartOptions} 
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
};
