import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AgCharts } from '@/lib/agCharts';
import type { AgChartOptions, AgChartInstance } from '@/lib/agCharts';
import { ChartToolbar, type ChartType } from '@/components/charts/ChartToolbar';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface PeriodicAnalysisChartProps {
  vesselIds?: string[];
  monthValue?: string;
  onRenderToolbar?: (toolbar: JSX.Element) => void;
  complianceMode?: 'Rest' | 'Work';
  opaMode?: boolean;
}

interface YearlyData {
  year: number;
  avgViolationDays: number;
  avgNCs: number;
}

export const PeriodicAnalysisChart = ({ 
  vesselIds, 
  monthValue,
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

  // Generate all month values for the last 4 years
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

  // Fetch crew summary data for all months in the last 4 years
  // For Years view, we ignore the period filter and fetch all months
  const { data: allCrewRecords = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/rest-hours-crew-records-yearly', vesselIds, complianceMode, opaMode, periodType, monthsToFetch],
    queryFn: async () => {
      // Fetch data for all months in parallel
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

      // Wait for all requests to complete
      const allResults = await Promise.all(fetchPromises);
      
      // Flatten the array of arrays into a single array
      return allResults.flat();
    },
    enabled: periodType === 'years', // Only fetch for Years view for now
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

  const handleDownload = useCallback(() => {
    if (chartRef.current) {
      chartRef.current.download({
        fileName: 'periodic_analysis.png',
      });
    }
  }, []);

  const chartOptions = useMemo<AgChartOptions>(() => {
    const baseOptions: AgChartOptions = {
      data: yearlyData,
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
            xKey: 'year',
            yKey: 'avgNCs',
            yName: 'NCs per Vessel',
            fill: '#ef4444', // Red
            strokeWidth: 0,
            tooltip: {
              renderer: ({ datum }: any) => {
                return `<div class="ag-chart-tooltip-title" style="background-color: #ef4444; padding: 4px 8px; color: white; font-weight: bold;">
                  ${datum.year}
                </div>
                <div class="ag-chart-tooltip-content" style="padding: 4px 8px;">
                  Avg NCs: ${datum.avgNCs}
                </div>`;
              },
            },
          } as any,
          {
            type: 'bar' as any,
            xKey: 'year',
            yKey: 'avgViolationDays',
            yName: 'Violations per Vessel',
            fill: '#52baf3', // Blue
            strokeWidth: 0,
            tooltip: {
              renderer: ({ datum }: any) => {
                return `<div class="ag-chart-tooltip-title" style="background-color: #52baf3; padding: 4px 8px; color: white; font-weight: bold;">
                  ${datum.year}
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
              text: 'Year',
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
          xKey: 'year',
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
                ${datum.year}
              </div>
              <div class="ag-chart-tooltip-content" style="padding: 4px 8px;">
                Avg NCs: ${datum.avgNCs}
              </div>`;
            },
          },
        } as any,
        {
          type: 'line' as any,
          xKey: 'year',
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
                ${datum.year}
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
            text: 'Year',
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
  }, [yearlyData, chartType]);

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

  if (yearlyData.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-sm text-gray-500">No data available</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-0 flex flex-col">
      {/* Period Type Radio Buttons - Inside card at top */}
      <div className="pt-2 pb-1 px-2">
        <RadioGroup 
          value={periodType} 
          onValueChange={(value: 'years' | 'quarters' | 'months') => setPeriodType(value)}
          className="flex items-center gap-3"
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
              disabled
            />
            <Label 
              htmlFor="period-quarters" 
              className="text-[10px] font-normal text-gray-400 dark:text-gray-600 cursor-not-allowed uppercase"
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
