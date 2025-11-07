import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AgCharts } from '@/lib/agCharts';
import type { AgChartOptions, AgChartInstance } from '@/lib/agCharts';
import { ChartToolbar } from '@/components/charts/ChartToolbar';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface RankWiseViolationsChartProps {
  vesselIds?: string[];
  monthValue?: string;
}

interface ViolationByRank {
  rank: string;
  violationDays: number;
}

export const RankWiseViolationsChart = ({ vesselIds, monthValue }: RankWiseViolationsChartProps) => {
  const chartRef = useRef<AgChartInstance | null>(null);
  const [showFullscreen, setShowFullscreen] = useState(false);

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

  const { data: violationsData = [], isLoading, error } = useQuery<ViolationByRank[]>({
    queryKey: ['/api/rest-hours-violations-by-rank', queryParams],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (queryParams.monthValue) {
        params.append('monthValue', queryParams.monthValue);
      }
      if (queryParams.vesselIds && queryParams.vesselIds.length > 0) {
        queryParams.vesselIds.forEach((id: string) => params.append('vesselIds', id));
      }
      
      const url = `/api/rest-hours-violations-by-rank${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      
      if (!res.ok) {
        throw new Error(`Failed to fetch violations: ${res.statusText}`);
      }
      
      return await res.json();
    },
    enabled: !!monthValue,
  });

  const handleDownload = () => {
    if (chartRef.current) {
      chartRef.current.download({
        fileName: 'rank_wise_violations.png',
      });
    }
  };

  const chartOptions = useMemo<AgChartOptions>(() => ({
    data: violationsData,
    series: [
      {
        type: 'bar' as any,
        xKey: 'rank',
        yKey: 'violationDays',
        fill: '#52baf3',
        stroke: '#3a9fd9',
        strokeWidth: 1,
        tooltip: {
          renderer: ({ datum }: any) => {
            return `<div class="ag-chart-tooltip-title" style="background-color: #52baf3; padding: 4px 8px; color: white; font-weight: bold;">
              ${datum.rank}
            </div>
            <div class="ag-chart-tooltip-content" style="padding: 4px 8px;">
              ${datum.violationDays} violation day${datum.violationDays !== 1 ? 's' : ''}
            </div>`;
          },
        },
      },
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
          text: 'Violation Days',
          enabled: false,
        },
        label: {
          fontSize: 11,
          color: '#4b5563',
        },
        min: 0,
      },
    ],
    background: {
      fill: '#ffffff',
    },
    padding: {
      top: 10,
      right: 10,
      bottom: 30,
      left: 40,
    },
  } as AgChartOptions), [violationsData]);

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
        <div className="text-sm text-red-500">Failed to load violations data</div>
      </div>
    );
  }

  if (!monthValue) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-sm text-gray-500">Please select a period to view violations</div>
      </div>
    );
  }

  if (violationsData.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-sm text-gray-500">No violations found for the selected period</div>
      </div>
    );
  }

  return (
    <>
      <div className="w-full h-full min-h-0 flex flex-col relative">
        {/* Toolbar positioned in top-right corner */}
        <div className="absolute top-3 right-3 z-10">
          <ChartToolbar 
            onDownload={handleDownload}
            onFullscreen={() => setShowFullscreen(true)}
            chartTitle="Rank Wise Violations"
          />
        </div>
        
        <div className="flex-1 min-h-0 w-full">
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
                Rank Wise Violations
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
    </>
  );
};
