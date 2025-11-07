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
    enabled: !!monthValue,
  });

  const chartOptions = useMemo<AgChartOptions>(() => ({
    data: violationsData,
    series: [
      {
        type: 'column' as any,
        xKey: 'rank',
        yKey: 'violationDays',
        fill: '#ef4444',
        stroke: '#dc2626',
        strokeWidth: 1,
        tooltip: {
          renderer: ({ datum }: any) => ({
            title: datum.rank,
            content: `${datum.violationDays} violation day${datum.violationDays !== 1 ? 's' : ''}`,
          }),
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
    <div className="w-full h-full">
      <AgCharts options={chartOptions} />
    </div>
  );
};
