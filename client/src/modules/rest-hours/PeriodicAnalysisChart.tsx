import { useState, useCallback, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AgCharts } from '@/lib/agCharts';
import type { AgChartOptions, AgChartInstance } from '@/lib/agCharts';
import { ChartToolbar, type ChartType } from '@/components/charts/ChartToolbar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface PeriodicAnalysisChartProps {
  vesselIds?: string[];
  year?: string;
  onRenderToolbar?: (toolbar: JSX.Element) => void;
  complianceMode?: 'Rest' | 'Work';
  opaMode?: boolean;
}

type TimePeriod = 'yearly' | 'quarterly' | 'monthly';

export function PeriodicAnalysisChart({
  vesselIds = [],
  year,
  onRenderToolbar,
  complianceMode = 'Rest',
  opaMode = false,
}: PeriodicAnalysisChartProps) {
  const [chartType, setChartType] = useState<ChartType>('line');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('yearly');
  const chartRef = useRef<AgChartInstance | null>(null);

  const queryParams = new URLSearchParams();
  queryParams.append('timePeriod', timePeriod);
  if (year && timePeriod !== 'yearly') {
    queryParams.append('year', year);
  }
  vesselIds.forEach(id => queryParams.append('vesselIds', id));
  queryParams.append('complianceMode', complianceMode);
  queryParams.append('opaMode', String(opaMode));

  const { data: periodicData = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/rest-hours-periodic-analysis', queryParams.toString()],
    queryFn: async () => {
      const url = `/api/rest-hours-periodic-analysis?${queryParams.toString()}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch periodic analysis');
      return response.json();
    },
  });

  const handleDownload = useCallback(() => {
    if (chartRef.current) {
      chartRef.current.download({
        fileName: 'periodic_analysis.png',
      });
    }
  }, []);

  const handleChartTypeChange = useCallback((type: ChartType) => {
    if (type === 'line' || type === 'bar') {
      setChartType(type);
    }
  }, []);

  const chartOptions = useMemo<AgChartOptions>(() => {
    const baseOptions: AgChartOptions = {
      data: periodicData,
      background: {
        fill: '#ffffff',
      },
      padding: {
        top: 20,
        right: 20,
        bottom: 40,
        left: 50,
      },
      legend: {
        enabled: true,
        position: 'bottom',
        spacing: 20,
        item: {
          marker: {
            shape: 'square',
            size: 12,
          },
          label: {
            fontSize: 11,
            color: '#4b5563',
          },
          paddingX: 16,
          paddingY: 8,
        },
      },
    };

    if (chartType === 'bar') {
      return {
        ...baseOptions,
        series: [
          {
            type: 'bar' as any,
            xKey: 'period',
            yKey: 'avgNCs',
            yName: 'NCs per Vessel',
            fill: '#52baf3',
            stroke: '#3a9fd9',
            strokeWidth: 1,
            tooltip: {
              renderer: ({ datum }: any) => {
                return `<div class="ag-chart-tooltip-title" style="background-color: #52baf3; padding: 4px 8px; color: white; font-weight: bold;">
                  ${datum.period}
                </div>
                <div class="ag-chart-tooltip-content" style="padding: 4px 8px;">
                  NCs per Vessel: ${datum.avgNCs}
                </div>`;
              },
            },
          } as any,
          {
            type: 'bar' as any,
            xKey: 'period',
            yKey: 'avgViolations',
            yName: 'Violations per Vessel',
            fill: '#ef4444',
            stroke: '#dc2626',
            strokeWidth: 1,
            tooltip: {
              renderer: ({ datum }: any) => {
                return `<div class="ag-chart-tooltip-title" style="background-color: #ef4444; padding: 4px 8px; color: white; font-weight: bold;">
                  ${datum.period}
                </div>
                <div class="ag-chart-tooltip-content" style="padding: 4px 8px;">
                  Violations per Vessel: ${datum.avgViolations}
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
              text: timePeriod === 'yearly' ? 'Year' : timePeriod === 'quarterly' ? 'Quarter' : 'Month',
              enabled: true,
              fontSize: 12,
              color: '#4b5563',
            },
            label: {
              fontSize: 11,
              color: '#4b5563',
              rotation: 0,
            },
          },
          {
            type: 'number' as any,
            position: 'left',
            title: {
              text: 'Average per Vessel per Month',
              enabled: true,
              fontSize: 12,
              color: '#4b5563',
            },
            label: {
              fontSize: 11,
              color: '#4b5563',
            },
            min: 0,
          },
        ],
      } as AgChartOptions;
    }

    return {
      ...baseOptions,
      series: [
        {
          type: 'line' as any,
          xKey: 'period',
          yKey: 'avgNCs',
          yName: 'NCs per Vessel',
          stroke: '#52baf3',
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
                ${datum.period}
              </div>
              <div class="ag-chart-tooltip-content" style="padding: 4px 8px;">
                NCs per Vessel: ${datum.avgNCs}
              </div>`;
            },
          },
        } as any,
        {
          type: 'line' as any,
          xKey: 'period',
          yKey: 'avgViolations',
          yName: 'Violations per Vessel',
          stroke: '#ef4444',
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
                ${datum.period}
              </div>
              <div class="ag-chart-tooltip-content" style="padding: 4px 8px;">
                Violations per Vessel: ${datum.avgViolations}
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
            text: timePeriod === 'yearly' ? 'Year' : timePeriod === 'quarterly' ? 'Quarter' : 'Month',
            enabled: true,
            fontSize: 12,
            color: '#4b5563',
          },
          label: {
            fontSize: 11,
            color: '#4b5563',
            rotation: 0,
          },
        },
        {
          type: 'number' as any,
          position: 'left',
          title: {
            text: 'Average per Vessel per Month',
            enabled: true,
            fontSize: 12,
            color: '#4b5563',
          },
          label: {
            fontSize: 11,
            color: '#4b5563',
          },
          min: 0,
        },
      ],
    } as AgChartOptions;
  }, [periodicData, chartType, timePeriod]);

  const toolbar = (
    <ChartToolbar
      chartType={chartType}
      onChartTypeChange={handleChartTypeChange}
      onDownload={handleDownload}
      availableTypes={['line', 'bar']}
      data-testid="toolbar-periodic-analysis"
    />
  );

  if (onRenderToolbar) {
    onRenderToolbar(toolbar);
  }

  return (
    <div className="w-full h-full min-h-0 flex flex-col">
      {!onRenderToolbar && (
        <div className="flex justify-end mb-1">
          {toolbar}
        </div>
      )}
      
      <div className="flex justify-center mb-2">
        <RadioGroup
          value={timePeriod}
          onValueChange={(value) => setTimePeriod(value as TimePeriod)}
          className="flex gap-6"
          data-testid="radio-group-time-period"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="yearly" id="yearly" data-testid="radio-yearly" />
            <Label htmlFor="yearly" className="text-sm font-normal cursor-pointer">
              Yearly
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="quarterly" id="quarterly" data-testid="radio-quarterly" />
            <Label htmlFor="quarterly" className="text-sm font-normal cursor-pointer">
              Quarterly
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="monthly" id="monthly" data-testid="radio-monthly" />
            <Label htmlFor="monthly" className="text-sm font-normal cursor-pointer">
              Monthly
            </Label>
          </div>
        </RadioGroup>
      </div>

      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-sm text-gray-500">Loading chart data...</div>
          </div>
        ) : (
          <AgCharts 
            ref={chartRef}
            options={chartOptions} 
            style={{ width: '100%', height: '100%' }}
          />
        )}
      </div>
    </div>
  );
}
