import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AgCharts } from '@/lib/agCharts';
import type { AgChartOptions, AgChartInstance } from '@/lib/agCharts';
import { ChartToolbar, type ChartType } from '@/components/charts/ChartToolbar';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { NCOverviewDialog } from './NCOverviewDialog';

interface RankWiseNCsChartProps {
  vesselIds?: string[];
  monthValue?: string;
  onRenderToolbar?: (toolbar: JSX.Element) => void;
  complianceMode?: 'Rest' | 'Work';
  opaMode?: boolean;
}

interface NCByRank {
  rank: string;
  ncCount: number;
}

export const RankWiseNCsChart = ({ 
  vesselIds, 
  monthValue, 
  onRenderToolbar,
  complianceMode = 'Rest',
  opaMode = false,
}: RankWiseNCsChartProps) => {
  const chartRef = useRef<AgChartInstance | null>(null);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [showDrillDown, setShowDrillDown] = useState(false);
  const [selectedRank, setSelectedRank] = useState<string | null>(null);

  const queryParams = useMemo(() => {
    const params: Record<string, any> = {};
    if (monthValue) {
      params.monthValue = monthValue;
    }
    if (vesselIds && vesselIds.length > 0) {
      params.vesselIds = vesselIds;
    }
    return params;
  }, [vesselIds, monthValue]);

  const { data: ncsData = [], isLoading, error } = useQuery<NCByRank[]>({
    queryKey: ['/api/rest-hours-ncs-by-rank', queryParams],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (queryParams.monthValue) {
        params.append('monthValue', queryParams.monthValue);
      }
      if (queryParams.vesselIds && queryParams.vesselIds.length > 0) {
        queryParams.vesselIds.forEach((id: string) => params.append('vesselIds', id));
      }
      
      const url = `/api/rest-hours-ncs-by-rank${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      
      if (!res.ok) {
        throw new Error(`Failed to fetch NCs: ${res.statusText}`);
      }
      
      return await res.json();
    },
    enabled: !!monthValue,
  });

  const handleDownload = useCallback(() => {
    if (chartRef.current) {
      chartRef.current.download({
        fileName: 'rank_wise_ncs.png',
      });
    }
  }, []);

  const handleBarClick = useCallback((rank: string) => {
    setSelectedRank(rank);
    setShowDrillDown(true);
  }, []);

  const chartOptions = useMemo<AgChartOptions>(() => {
    const baseOptions: AgChartOptions = {
      data: ncsData,
      background: {
        fill: '#ffffff',
      },
      padding: {
        top: 10,
        right: 10,
        bottom: 30,
        left: 40,
      },
      listeners: {
        seriesNodeClick: (event: any) => {
          if (event.datum && event.datum.rank) {
            handleBarClick(event.datum.rank);
          }
        },
      } as any,
    };

    if (chartType === 'pie') {
      return {
        ...baseOptions,
        series: [
          {
            type: 'pie' as any,
            angleKey: 'ncCount',
            calloutLabelKey: 'rank',
            fills: ['#52baf3', '#3a9fd9', '#2a7db8', '#1a6d9f', '#0a5d86'],
            strokes: ['#3a9fd9', '#2a7db8', '#1a6d9f', '#0a5d86', '#004d73'],
            calloutLabel: {
              enabled: true,
              fontSize: 11,
              color: '#4b5563',
            },
            tooltip: {
              renderer: ({ datum }: any) => {
                return `<div class="ag-chart-tooltip-title" style="background-color: #52baf3; padding: 4px 8px; color: white; font-weight: bold;">
                  ${datum.rank}
                </div>
                <div class="ag-chart-tooltip-content" style="padding: 4px 8px;">
                  ${datum.ncCount} NC${datum.ncCount !== 1 ? 's' : ''}
                </div>`;
              },
            },
          } as any,
        ],
      } as AgChartOptions;
    }

    if (chartType === 'line') {
      return {
        ...baseOptions,
        series: [
          {
            type: 'line' as any,
            xKey: 'rank',
            yKey: 'ncCount',
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
                  ${datum.rank}
                </div>
                <div class="ag-chart-tooltip-content" style="padding: 4px 8px;">
                  ${datum.ncCount} NC${datum.ncCount !== 1 ? 's' : ''}
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
              text: 'Rank',
              enabled: false,
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
              text: 'NC Count',
              enabled: false,
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

    // Default: bar chart
    return {
      ...baseOptions,
      series: [
        {
          type: 'bar' as any,
          xKey: 'rank',
          yKey: 'ncCount',
          fill: '#52baf3',
          stroke: '#3a9fd9',
          strokeWidth: 1,
          tooltip: {
            renderer: ({ datum }: any) => {
              return `<div class="ag-chart-tooltip-title" style="background-color: #52baf3; padding: 4px 8px; color: white; font-weight: bold;">
                ${datum.rank}
              </div>
              <div class="ag-chart-tooltip-content" style="padding: 4px 8px;">
                ${datum.ncCount} NC${datum.ncCount !== 1 ? 's' : ''}
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
            text: 'Rank',
            enabled: false,
          },
          label: {
            fontSize: 11,
            color: '#4b5563',
            rotation: 0,
          },
          paddingInner: 0.2,
          paddingOuter: 0.3,
        },
        {
          type: 'number' as any,
          position: 'left',
          title: {
            text: 'NC Count',
            enabled: false,
          },
          label: {
            fontSize: 11,
            color: '#4b5563',
          },
          min: 0,
        },
      ],
    } as AgChartOptions;
  }, [ncsData, chartType, handleBarClick]);

  // Create toolbar element (memoized to prevent unnecessary re-renders)
  // Must be called before any early returns to maintain hook order
  const toolbar = useMemo(() => (
    <ChartToolbar 
      chartType={chartType}
      onChartTypeChange={setChartType}
      onDownload={handleDownload}
      onFullscreen={() => setShowFullscreen(true)}
      chartTitle="Rank Wise NCs"
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

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-sm text-red-500">Failed to load NCs data</div>
      </div>
    );
  }

  if (!monthValue) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-sm text-gray-500">Please select a period to view NCs</div>
      </div>
    );
  }

  if (ncsData.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-sm text-gray-500">No NCs found for the selected period</div>
      </div>
    );
  }

  return (
    <>
      <div className="w-full h-full min-h-0 flex flex-col">
        {/* Only render toolbar inline if onRenderToolbar is not provided */}
        {!onRenderToolbar && (
          <div className="flex justify-end mb-1">
            {toolbar}
          </div>
        )}
        <div className="flex-1 min-h-0">
          <AgCharts 
            ref={chartRef}
            options={chartOptions} 
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>

      {/* Fullscreen Dialog */}
      <Dialog open={showFullscreen} onOpenChange={setShowFullscreen}>
        <DialogContent className="max-w-6xl w-[90vw] h-[85vh] p-6">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Rank Wise NCs
              </h2>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                data-testid="button-download-fullscreen"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </button>
            </div>
            <div className="flex-1 min-h-0 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 p-4">
              <AgCharts 
                options={chartOptions} 
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Drill-down Dialog - Shows NCs for selected rank */}
      {selectedRank && monthValue && (
        <NCOverviewDialog
          open={showDrillDown}
          onOpenChange={setShowDrillDown}
          vesselId=""
          vesselName=""
          vesselIds={vesselIds}
          monthValue={monthValue}
          complianceMode={complianceMode}
          opaMode={opaMode}
          isPredicted={false}
          rankFilter={selectedRank}
        />
      )}
    </>
  );
};
