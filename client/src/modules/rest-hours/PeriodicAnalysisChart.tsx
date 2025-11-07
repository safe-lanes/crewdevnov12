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

interface MonthlyData {
  month: string; // Format: "Jan 2024"
  monthValue: string; // Format: "YYYY-MM"
  avgViolationDays: number;
  avgNCs: number;
}

// Utility function to format month label from "YYYY-MM" to "Jan 25"
const formatMonthLabel = (monthValue: string): string => {
  const [year, month] = monthValue.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  const monthName = date.toLocaleDateString('en-US', { month: 'short' });
  const shortYear = year.slice(-2); // Get last 2 digits of year
  return `${monthName} ${shortYear}`;
};

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

  // Generate months for Monthly view based on period filter (same logic as quarterly)
  const monthlyMonthsToFetch = useMemo(() => {
    if (!periodFilter) return [];
    
    const months: string[] = [];
    
    if (periodFilter.mode === 'year-month') {
      // Show all 12 months of the selected year (ignore month selection)
      const year = periodFilter.year || currentYear;
      for (let month = 1; month <= 12; month++) {
        months.push(`${year}-${String(month).padStart(2, '0')}`);
      }
    } else if (periodFilter.mode === 'date-range' && periodFilter.dateFrom && periodFilter.dateTo) {
      // Show all months between start and end dates
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
  // For Months view: fetch months based on period filter
  const { data: allCrewRecords = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/rest-hours-crew-records-periodic', vesselIds, complianceMode, opaMode, periodType, monthsToFetch, quarterlyMonthsToFetch, monthlyMonthsToFetch],
    queryFn: async () => {
      // Determine which months to fetch based on period type
      let monthsToFetchList: string[];
      if (periodType === 'years') {
        monthsToFetchList = monthsToFetch;
      } else if (periodType === 'quarters') {
        monthsToFetchList = quarterlyMonthsToFetch;
      } else {
        monthsToFetchList = monthlyMonthsToFetch;
      }
      
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
    enabled: periodType === 'years' || 
             (periodType === 'quarters' && quarterlyMonthsToFetch.length > 0) ||
             (periodType === 'months' && monthlyMonthsToFetch.length > 0),
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
      
      // Skip years with no data
      if (records.length === 0) {
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
    if (periodType !== 'quarters') return [];

    // Helper function to get quarter number from month (1-12)
    const getQuarter = (month: number): number => {
      return Math.ceil(month / 3); // Q1: 1-3, Q2: 4-6, Q3: 7-9, Q4: 10-12
    };

    // Determine which quarters to generate based on period filter
    const allQuarters: { year: number; quarterNum: number; quarterKey: string }[] = [];
    
    if (periodFilter && periodFilter.mode === 'year-month') {
      const year = periodFilter.year || currentYear;
      // Generate all 4 quarters for the selected year
      for (let q = 1; q <= 4; q++) {
        allQuarters.push({
          year,
          quarterNum: q,
          quarterKey: `${year}-Q${q}`,
        });
      }
    } else if (periodFilter && periodFilter.mode === 'date-range' && periodFilter.dateFrom && periodFilter.dateTo) {
      const startDate = periodFilter.dateFrom;
      const endDate = periodFilter.dateTo;
      
      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth() + 1;
      const endYear = endDate.getFullYear();
      const endMonth = endDate.getMonth() + 1;
      
      const startQuarter = getQuarter(startMonth);
      const endQuarter = getQuarter(endMonth);
      
      // Generate all quarters between start and end
      for (let year = startYear; year <= endYear; year++) {
        const firstQ = year === startYear ? startQuarter : 1;
        const lastQ = year === endYear ? endQuarter : 4;
        
        for (let q = firstQ; q <= lastQ; q++) {
          allQuarters.push({
            year,
            quarterNum: q,
            quarterKey: `${year}-Q${q}`,
          });
        }
      }
    }

    if (allQuarters.length === 0) return [];

    // Group records by year and quarter
    const quarterGroups = new Map<string, any[]>(); // key: "2024-Q1"
    
    if (allCrewRecords) {
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
    }

    // Generate data for ALL quarters (use null for quarters without data)
    const results: QuarterlyData[] = allQuarters.map(({ year, quarterNum, quarterKey }) => {
      const records = quarterGroups.get(quarterKey) || [];
      
      // Filter out placeholder records (keep only real data)
      const realRecords = records.filter(r => 
        r.id != null || (r.totalViolations ?? 0) > 0 || (r.totalNCs ?? 0) > 0
      );
      
      // If no real data, return null values (will show gap in line chart)
      if (realRecords.length === 0) {
        return {
          quarter: `Q${quarterNum} ${year}`,
          year,
          quarterNum,
          avgViolationDays: null as any,
          avgNCs: null as any,
        };
      }

      // Calculate total violation days and NCs using only real records
      let totalViolationDays = 0;
      let totalNCs = 0;

      realRecords.forEach(record => {
        totalViolationDays += (record.totalViolations || 0);
        totalNCs += (record.totalNCs || 0);
      });

      // Calculate average per vessel per month using only real records
      const avgViolationDays = realRecords.length > 0 ? totalViolationDays / realRecords.length : 0;
      const avgNCs = realRecords.length > 0 ? totalNCs / realRecords.length : 0;

      return {
        quarter: `Q${quarterNum} ${year}`,
        year,
        quarterNum,
        avgViolationDays: parseFloat(avgViolationDays.toFixed(2)),
        avgNCs: parseFloat(avgNCs.toFixed(2)),
      };
    });

    return results;
  }, [allCrewRecords, periodType, periodFilter, currentYear]);

  // Calculate monthly data (no aggregation needed - just format the raw data)
  const monthlyData = useMemo<MonthlyData[]>(() => {
    if (periodType !== 'months') return [];
    
    // Generate all 12 months for the selected period
    const allMonths: string[] = [];
    
    if (periodFilter && periodFilter.mode === 'year-month') {
      const year = periodFilter.year || currentYear;
      for (let month = 1; month <= 12; month++) {
        allMonths.push(`${year}-${String(month).padStart(2, '0')}`);
      }
    } else if (periodFilter && periodFilter.mode === 'date-range' && periodFilter.dateFrom && periodFilter.dateTo) {
      const startDate = periodFilter.dateFrom;
      const endDate = periodFilter.dateTo;
      
      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth() + 1;
      const endYear = endDate.getFullYear();
      const endMonth = endDate.getMonth() + 1;
      
      let currentIterYear = startYear;
      let currentIterMonth = startMonth;
      
      while (currentIterYear < endYear || (currentIterYear === endYear && currentIterMonth <= endMonth)) {
        allMonths.push(`${currentIterYear}-${String(currentIterMonth).padStart(2, '0')}`);
        
        currentIterMonth++;
        if (currentIterMonth > 12) {
          currentIterMonth = 1;
          currentIterYear++;
        }
      }
    }

    if (allMonths.length === 0) return [];

    // Group records by month
    const monthGroups = new Map<string, any[]>();
    
    if (allCrewRecords) {
      allCrewRecords.forEach(record => {
        if (!record.monthValue) return;
        
        const monthKey = record.monthValue;
        
        if (!monthGroups.has(monthKey)) {
          monthGroups.set(monthKey, []);
        }
        monthGroups.get(monthKey)!.push(record);
      });
    }

    // Generate data for ALL months (use null for months without data)
    const results: MonthlyData[] = allMonths.map(monthValue => {
      const records = monthGroups.get(monthValue) || [];
      
      // Filter out placeholder records (keep only real data)
      const realRecords = records.filter(r => 
        r.id != null || (r.totalViolations ?? 0) > 0 || (r.totalNCs ?? 0) > 0
      );
      
      // If no real data, return null values (will show gap in line chart)
      if (realRecords.length === 0) {
        return {
          month: formatMonthLabel(monthValue),
          monthValue,
          avgViolationDays: null as any,
          avgNCs: null as any,
        };
      }

      // Calculate total violation days and NCs using only real records
      let totalViolationDays = 0;
      let totalNCs = 0;

      realRecords.forEach(record => {
        totalViolationDays += (record.totalViolations || 0);
        totalNCs += (record.totalNCs || 0);
      });

      // Calculate average per vessel per month using only real records
      const avgViolationDays = realRecords.length > 0 ? totalViolationDays / realRecords.length : 0;
      const avgNCs = realRecords.length > 0 ? totalNCs / realRecords.length : 0;

      return {
        month: formatMonthLabel(monthValue),
        monthValue,
        avgViolationDays: parseFloat(avgViolationDays.toFixed(2)),
        avgNCs: parseFloat(avgNCs.toFixed(2)),
      };
    });

    return results;
  }, [allCrewRecords, periodType, periodFilter, currentYear]);

  const handleDownload = useCallback(() => {
    if (chartRef.current) {
      chartRef.current.download({
        fileName: 'periodic_analysis.png',
      });
    }
  }, []);

  const chartOptions = useMemo<AgChartOptions>(() => {
    // Determine data and xKey based on period type
    let data: any[];
    let xKey: string;
    let xLabel: (datum: any) => string;
    let xAxisTitle: string;
    
    if (periodType === 'months') {
      data = monthlyData;
      xKey = 'month';
      xLabel = (datum: any) => datum.month;
      xAxisTitle = 'Month';
    } else if (periodType === 'quarters') {
      data = quarterlyData;
      xKey = 'quarter';
      xLabel = (datum: any) => datum.quarter;
      xAxisTitle = 'Quarter';
    } else {
      data = yearlyData;
      xKey = 'year';
      xLabel = (datum: any) => String(datum.year);
      xAxisTitle = 'Year';
    }
    
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
              text: xAxisTitle,
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
          connectMissingData: false, // Don't connect points across null values
          marker: {
            fill: '#ef4444',
            stroke: '#dc2626',
            strokeWidth: 1,
            size: 6,
          },
          tooltip: {
            renderer: ({ datum }: any) => {
              if (datum.avgNCs == null) return '';
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
          connectMissingData: false, // Don't connect points across null values
          marker: {
            fill: '#52baf3',
            stroke: '#3a9fd9',
            strokeWidth: 1,
            size: 6,
          },
          tooltip: {
            renderer: ({ datum }: any) => {
              if (datum.avgViolationDays == null) return '';
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
            text: xAxisTitle,
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
  }, [yearlyData, quarterlyData, monthlyData, periodType, chartType]);

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

  const hasData = periodType === 'months' 
    ? monthlyData.length > 0 
    : periodType === 'quarters' 
      ? quarterlyData.length > 0 
      : yearlyData.length > 0;
  
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
            />
            <Label 
              htmlFor="period-months" 
              className="text-[10px] font-normal text-[#4f5863] dark:text-neutral-300 cursor-pointer uppercase"
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
