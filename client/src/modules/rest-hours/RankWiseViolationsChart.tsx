import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AgCharts } from '@/lib/agCharts';
import type { AgChartOptions } from '@/lib/agCharts';

interface RankWiseViolationsChartProps {
  vesselIds?: string[];
  monthValue?: string;
}

interface ViolationByRank {
  rank: string;
  violationDays: number;
}

export const RankWiseViolationsChart = ({ vesselIds, monthValue }: RankWiseViolationsChartProps) => {
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
      fill: 'transparent',
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
    <div className="w-full h-full min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 w-full">
        <AgCharts options={chartOptions} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
};
