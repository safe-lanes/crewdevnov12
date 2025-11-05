import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { RestHoursCrewRecord } from '@shared/schema';
import { filterViolations } from './violationFilters';

// Violation code descriptions mapping
const VIOLATION_CODE_DESCRIPTIONS: Record<number, string> = {
  1: "Minimum 10 hours of rest in any 24 hour period",
  2: "Minimum hours of rest in any 7 day period = 77",
  3: "Hours of rest may be divided into no more than two periods, one of which shall be at least six hours in length",
  4: "Interval between rest periods not to exceed 14 hours",
  5: "ILO Work - Maximum 14 hours of work in any 24 hour period",
  6: "ILO Work - Maximum 72 hours of work in any 7 day period",
  7: "OPA - Maximum 15 hours of work in any 24 hour period",
  8: "OPA - Maximum 36 hours of work in 72 hours",
};

interface ViolationDiagnostic {
  code: number;
  windowStart: string;
  reason: string;
  violatingRanges?: Array<{ startCell: number; endCell: number; startDay: number; monthName?: string }>;
}

interface ViolationsOverviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vesselId: string;
  vesselName: string;
  monthValue: string;
  complianceMode: 'Rest' | 'Work';
  opaMode: boolean;
  isPredicted?: boolean;
}

interface DailyRecord {
  day: number;
  dayOfWeek: string;
  hours: string[];
  isPlan: boolean;
  comments: string;
  violations: number[];
  violationDiagnostics?: ViolationDiagnostic[];
  hoursOfRest24hr: number;
  hoursOfWork24hr: number;
  anyPeriodRest24hr: number;
  anyPeriodWork24hr: number;
  anyPeriodRest7day: number;
  anyPeriodWork7day: number;
}

interface ViolationRecord {
  crewMemberId: string;
  crewMemberName: string;
  rank: string;
  day: number;
  filteredViolations: number[];
  filteredDiagnostics: ViolationDiagnostic[];
  comments: string;
}

export function ViolationsOverviewDialog({
  open,
  onOpenChange,
  vesselId,
  vesselName,
  monthValue,
  complianceMode,
  opaMode,
  isPredicted = false,
}: ViolationsOverviewDialogProps) {
  // Fetch all crew records for this vessel and month to get crew list
  const queryParams = new URLSearchParams();
  queryParams.append('vesselIds', vesselId);
  queryParams.append('monthValue', monthValue);
  queryParams.append('complianceMode', complianceMode);
  queryParams.append('opaMode', String(opaMode));

  const { data: crewSummaries = [], isLoading: isLoadingSummaries } = useQuery<any[]>({
    queryKey: ['/api/rest-hours-crew-records', queryParams.toString()],
    queryFn: async () => {
      const url = `/api/rest-hours-crew-records?${queryParams.toString()}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch crew records');
      return response.json();
    },
    enabled: open,
  });

  // Get crew IDs that have violations to fetch their daily records
  const crewIdsWithViolations = useMemo(() => {
    return crewSummaries
      .filter(crew => {
        const violationDatesField = isPredicted ? crew.predictedViolationDates : crew.violationDates;
        return violationDatesField && violationDatesField !== '[]';
      })
      .map(crew => crew.crewMemberId);
  }, [crewSummaries, isPredicted]);

  // Fetch daily records only for crew members with violations
  const { data: allDailyRecords = [], isLoading: isLoadingDaily } = useQuery<any[]>({
    queryKey: ['/api/rest-hours-daily-records'],
    queryFn: async () => {
      const response = await fetch('/api/rest-hours-daily-records');
      if (!response.ok) throw new Error('Failed to fetch daily records');
      return response.json();
    },
    enabled: open && crewIdsWithViolations.length > 0,
  });

  const isLoading = isLoadingSummaries || isLoadingDaily;

  // Parse and aggregate all violations from all crew members using pre-calculated violation dates
  const violationRecords = useMemo(() => {
    const allViolations: ViolationRecord[] = [];

    // Filter crew summaries to only those for this vessel
    const vesselCrewSummaries = crewSummaries.filter(crew => crew.vesselId === vesselId);

    console.log('[ViolationsDialog] Debug:', {
      isPredicted,
      vesselId,
      monthValue,
      crewSummariesCount: crewSummaries.length,
      vesselCrewCount: vesselCrewSummaries.length,
      allDailyRecordsCount: allDailyRecords.length,
      isLoadingDaily,
      crewIdsWithViolationsCount: crewIdsWithViolations.length
    });

    // Create a map of daily records for quick lookup
    const dailyRecordsMap = new Map<string, DailyRecord[]>();
    
    // Debug: Check what's in allDailyRecords
    if (allDailyRecords.length > 0) {
      const sampleRecord = allDailyRecords[0];
      console.log('[ViolationsDialog] Sample daily record:', {
        vesselId: sampleRecord.vesselId,
        monthValue: sampleRecord.monthValue,
        crewMemberId: sampleRecord.crewMemberId,
        hasDailyRecords: !!sampleRecord.dailyRecords
      });
      console.log('[ViolationsDialog] Looking for:', { vesselId, monthValue });
    }
    
    // Filter daily records by crew members that have violations (more reliable than vessel+month)
    const filteredRecords = allDailyRecords.filter(record =>
      crewIdsWithViolations.includes(record.crewMemberId) && record.vesselId === vesselId
    );
    console.log('[ViolationsDialog] Filtered daily records count:', filteredRecords.length);
    
    filteredRecords.forEach(recordContainer => {
        try {
          const dailyRecords: DailyRecord[] = JSON.parse(recordContainer.dailyRecords);
          dailyRecordsMap.set(recordContainer.crewMemberId, dailyRecords);
          console.log('[ViolationsDialog] Parsed daily records for crew:', recordContainer.crewMemberId, 'count:', dailyRecords.length);
        } catch (e) {
          console.error('Failed to parse daily records:', e);
        }
      });

    vesselCrewSummaries.forEach(crew => {
      // Use the pre-calculated violation dates from crew record
      const violationDatesField = isPredicted ? crew.predictedViolationDates : crew.violationDates;
      
      if (!violationDatesField) return;

      let violationDays: number[] = [];
      try {
        violationDays = JSON.parse(violationDatesField);
      } catch (e) {
        console.error('Failed to parse violation dates:', e);
        return;
      }

      // Get the daily records for this crew member
      const dailyRecords = dailyRecordsMap.get(crew.crewMemberId) || [];

      // For each day that has a violation, find the corresponding daily record
      violationDays.forEach(day => {
        const dayRecord = dailyRecords.find(r => r.day === day && (isPredicted ? r.isPlan : !r.isPlan));
        
        if (dayRecord) {
          const violations = Array.isArray(dayRecord.violations) ? dayRecord.violations : [];
          const filteredViolations = filterViolations(violations, complianceMode, opaMode);
          const diagnostics = dayRecord.violationDiagnostics || [];
          const filteredDiagnostics = diagnostics.filter(d => filteredViolations.includes(d.code));

          allViolations.push({
            crewMemberId: crew.crewMemberId,
            crewMemberName: crew.name,
            rank: crew.rank,
            day: day,
            filteredViolations: filteredViolations.sort((a, b) => a - b),
            filteredDiagnostics,
            comments: dayRecord.comments || '',
          });
        } else {
          // If we can't find the daily record, still show the violation date
          allViolations.push({
            crewMemberId: crew.crewMemberId,
            crewMemberName: crew.name,
            rank: crew.rank,
            day: day,
            filteredViolations: [],
            filteredDiagnostics: [],
            comments: '',
          });
        }
      });
    });

    // Sort by day, then by rank, then by name
    return allViolations.sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      if (a.rank !== b.rank) return a.rank.localeCompare(b.rank);
      return a.crewMemberName.localeCompare(b.crewMemberName);
    });
  }, [crewSummaries, allDailyRecords, vesselId, monthValue, complianceMode, opaMode, isPredicted]);

  // Format month for display
  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
  };

  // Format day for display
  const formatDay = (day: number, monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, day);
    return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {isPredicted ? 'Predicted Violations' : 'Violations'} - {vesselName} - {formatMonth(monthValue)}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : violationRecords.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No violations found</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-[#52baf3] text-white">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-sm">Date</th>
                    <th className="px-4 py-3 text-left font-medium text-sm">Rank</th>
                    <th className="px-4 py-3 text-left font-medium text-sm">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-sm">Violations</th>
                    <th className="px-4 py-3 text-left font-medium text-sm">Comments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {violationRecords.map((record, index) => (
                    <tr key={`${record.crewMemberId}-${record.day}-${index}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{formatDay(record.day, monthValue)}</td>
                      <td className="px-4 py-3 text-sm">{record.rank}</td>
                      <td className="px-4 py-3 text-sm">{record.crewMemberName}</td>
                      <td className="px-4 py-3 text-sm">
                        {record.filteredViolations.map((code, idx) => {
                          const diagnostic = record.filteredDiagnostics.find(d => d.code === code);
                          
                          // If no diagnostic available, just show the code
                          if (!diagnostic) {
                            return (
                              <span key={code}>
                                {code}{idx < record.filteredViolations.length - 1 ? ', ' : ''}
                              </span>
                            );
                          }
                          
                          // Show code with tooltip
                          return (
                            <TooltipProvider key={code}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span
                                    className="cursor-help underline decoration-dotted hover:bg-pink-100 px-0.5 rounded"
                                  >
                                    {code}{idx < record.filteredViolations.length - 1 ? ', ' : ''}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent 
                                  side="right" 
                                  align="start" 
                                  sideOffset={8}
                                  className="max-w-[220px] text-[11px] z-50 bg-white text-gray-900"
                                >
                                  <div className="space-y-0.5">
                                    <div className="leading-snug">{VIOLATION_CODE_DESCRIPTIONS[diagnostic.code]}</div>
                                    <div className="text-gray-600 leading-snug">{diagnostic.reason}</div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm">{record.comments}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
