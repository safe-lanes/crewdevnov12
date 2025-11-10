import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { PeriodFilterValue } from '@/components/filters/PeriodFilter';

interface VesselStatusChartProps {
  vesselIds?: string[];
  periodFilter?: PeriodFilterValue;
  complianceMode?: 'Rest' | 'Work';
  opaMode?: boolean;
  onRenderToolbar?: (toolbar: JSX.Element | null) => void;
}

interface StatusBarProps {
  label: string;
  count: number;
  total: number;
}

const StatusBar = ({ label, count, total }: StatusBarProps) => {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
  const isZero = count === 0;
  
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-[180px] text-sm text-gray-700 dark:text-gray-300 font-medium flex-shrink-0">
        {label}:
      </div>
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 h-8 bg-gray-200 dark:bg-gray-700 rounded-md overflow-hidden relative">
          <div 
            className={`h-full transition-all duration-300 ${isZero ? 'bg-gray-300 dark:bg-gray-600' : 'bg-orange-400 dark:bg-orange-500'}`}
            style={{ width: `${percentage}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {percentage}% ({count}/{total})
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const VesselStatusChart = ({
  vesselIds,
  periodFilter,
  complianceMode = 'Rest',
  opaMode = false,
  onRenderToolbar,
}: VesselStatusChartProps) => {
  const [showFullscreen, setShowFullscreen] = useState(false);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // Generate month value from period filter
  const monthValue = useMemo(() => {
    if (!periodFilter) {
      return `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    }
    
    if (periodFilter.mode === 'year-month' && periodFilter.year && periodFilter.month) {
      return `${periodFilter.year}-${String(periodFilter.month).padStart(2, '0')}`;
    }
    
    return `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  }, [periodFilter, currentYear, currentMonth]);

  // Fetch all vessels from master data
  const { data: allVessels = [] } = useQuery<Array<{ id: number; entryId: string; name: string }>>({
    queryKey: ['/api/masters/014/data'],
    enabled: true,
  });

  // Fetch vessel records
  const { data: vesselRecords = [], isLoading, isError } = useQuery<any[]>({
    queryKey: ['/api/rest-hours-vessel-records', vesselIds, monthValue, complianceMode, opaMode],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (monthValue) {
        params.append('monthValue', monthValue);
      }
      if (vesselIds && vesselIds.length > 0) {
        vesselIds.forEach((id: string) => params.append('vesselIds', id));
      }
      params.append('complianceMode', complianceMode);
      params.append('opaMode', String(opaMode));
      
      const url = `/api/rest-hours-vessel-records?${params.toString()}`;
      const res = await fetch(url, { credentials: 'include' });
      
      if (!res.ok) {
        throw new Error(`Failed to fetch vessel records: ${res.statusText}`);
      }
      
      return await res.json();
    },
    enabled: !!monthValue,
  });

  // Calculate vessel status metrics (deduplicate by vesselId)
  const metrics = useMemo(() => {
    if (!vesselRecords || vesselRecords.length === 0) {
      return {
        totalVessels: 0,
        overdueVesselReview: 0,
        overdueOfficeResponse: 0,
        restHoursConflict: 0,
        incompleteData: 0,
      };
    }

    // Use Sets to track unique vessels for each metric
    const allVesselIds = new Set<string>();
    const overdueVesselReviewVessels = new Set<string>();
    const overdueVessels = new Set<string>();
    const conflictVessels = new Set<string>();
    const incompleteVessels = new Set<string>();

    vesselRecords.forEach(record => {
      const vesselId = record.vesselId;
      if (!vesselId) return; // Skip records without vesselId

      // Track all unique vessels in the dataset
      allVesselIds.add(vesselId);

      // Track vessels with overdue vessel review
      if (record.vesselReviewStatus === 'Overdue') {
        overdueVesselReviewVessels.add(vesselId);
      }

      // Track vessels with overdue office response
      if (record.officeReviewStatus === 'Overdue') {
        overdueVessels.add(vesselId);
      }

      // Track vessels with activity conflicts
      if (record.activityConflicting === true) {
        conflictVessels.add(vesselId);
      }

      // Track vessels with incomplete data (recording status < 100%)
      const recordingStatus = record.recordingStatus ?? 0;
      if (recordingStatus < 100) {
        incompleteVessels.add(vesselId);
      }
    });

    return {
      totalVessels: allVesselIds.size,
      overdueVesselReview: overdueVesselReviewVessels.size,
      overdueOfficeResponse: overdueVessels.size,
      restHoursConflict: conflictVessels.size,
      incompleteData: incompleteVessels.size,
    };
  }, [vesselRecords]);

  // Render toolbar
  useEffect(() => {
    const toolbar = (
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowFullscreen(true)}
          className="h-7 w-7 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
          title="View fullscreen"
          data-testid="button-fullscreen-chart"
        >
          <Maximize2 className="h-3.5 w-3.5 text-gray-600 dark:text-gray-400" />
        </Button>
      </div>
    );

    if (onRenderToolbar) {
      onRenderToolbar(toolbar);
    }

    return () => {
      if (onRenderToolbar) {
        onRenderToolbar(null);
      }
    };
  }, [onRenderToolbar, showFullscreen]);

  // Render content
  const renderContent = () => {
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
          <div className="text-sm text-red-500">Error loading data</div>
        </div>
      );
    }

    return (
      <div className="w-full h-full flex flex-col p-6 space-y-6">
        <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 text-center mb-2">
          No of Vessels with
        </h3>
        <div className="flex-1 flex flex-col justify-center space-y-4">
          <StatusBar 
            label="O/Due Vessel Review" 
            count={metrics.overdueVesselReview} 
            total={metrics.totalVessels} 
          />
          <StatusBar 
            label="O/Due Office Response" 
            count={metrics.overdueOfficeResponse} 
            total={metrics.totalVessels} 
          />
          <StatusBar 
            label="Rest Hours Conflict" 
            count={metrics.restHoursConflict} 
            total={metrics.totalVessels} 
          />
          <StatusBar 
            label="Incomplete Data" 
            count={metrics.incompleteData} 
            total={metrics.totalVessels} 
          />
        </div>
      </div>
    );
  };

  return (
    <>
      {renderContent()}

      {/* Fullscreen Dialog */}
      <Dialog open={showFullscreen} onOpenChange={setShowFullscreen}>
        <DialogContent className="max-w-4xl w-[80vw] h-[60vh] p-6">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Vessel Status Overview
              </h2>
            </div>
            <div className="flex-1 min-h-0 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
              {renderContent()}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
