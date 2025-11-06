import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { filterViolations } from './violationFilters';
import { NCReportDialog } from './NCReportDialog';
import type { RestHoursCrewRecord } from '@shared/schema';

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

interface NCOverviewDialogProps {
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

interface NCRecord {
  crewMemberId: string;
  crewMemberName: string;
  rank: string;
  rankSortOrder: number;
  day: number;
  filteredViolations: number[];
  filteredDiagnostics: ViolationDiagnostic[];
  comments: string;
}

export function NCOverviewDialog({
  open,
  onOpenChange,
  vesselId,
  vesselName,
  monthValue,
  complianceMode,
  opaMode,
  isPredicted = false,
}: NCOverviewDialogProps) {
  const [ncReportDialogOpen, setNCReportDialogOpen] = useState(false);
  const [selectedNCReportRecord, setSelectedNCReportRecord] = useState<RestHoursCrewRecord | null>(null);

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

  // Fetch available ranks for sorting
  const { data: availableRanks = [] } = useQuery<any[]>({
    queryKey: ['/api/available-ranks'],
    enabled: open,
  });

  // Get crew IDs that have NCs to fetch their daily records
  // NCs are based on violation days (3+ violations or Code 2), so we use crew with NCs > 0
  const crewIdsWithNCs = useMemo(() => {
    return crewSummaries
      .filter(crew => {
        const ncCount = isPredicted ? crew.predictedNCs : crew.totalNCs;
        return ncCount && ncCount > 0;
      })
      .map(crew => crew.crewMemberId);
  }, [crewSummaries, isPredicted]);

  // Fetch daily records only for crew members with NCs
  const { data: allDailyRecords = [], isLoading: isLoadingDaily } = useQuery<any[]>({
    queryKey: ['/api/rest-hours-daily-records'],
    queryFn: async () => {
      const response = await fetch('/api/rest-hours-daily-records');
      if (!response.ok) throw new Error('Failed to fetch daily records');
      return response.json();
    },
    enabled: open && crewIdsWithNCs.length > 0,
  });

  const isLoading = isLoadingSummaries || isLoadingDaily;

  // Create rank order map for sorting
  const rankOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    availableRanks.forEach(rank => {
      // Strip suffix from rank name for matching (e.g., "3rd Officer_1" → "3rd Officer")
      const baseName = rank.name.split('_')[0];
      if (!map.has(baseName)) {
        map.set(baseName, rank.sortOrder || 999);
      }
      // Also store the full name
      map.set(rank.name, rank.sortOrder || 999);
    });
    return map;
  }, [availableRanks]);

  // Parse and aggregate all NCs from all crew members using pre-calculated NC days
  const ncRecords = useMemo(() => {
    const allNCs: NCRecord[] = [];

    // Filter crew summaries to only those for this vessel
    const vesselCrewSummaries = crewSummaries.filter(crew => crew.vesselId === vesselId);

    // Create a map of daily records for quick lookup
    const dailyRecordsMap = new Map<string, DailyRecord[]>();
    
    // Filter daily records by crew members that have NCs and match vessel+month
    const filteredRecords = allDailyRecords.filter(record =>
      crewIdsWithNCs.includes(record.crewMemberId) && 
      record.vesselId === vesselId &&
      record.monthYear === monthValue
    );
    
    filteredRecords.forEach(recordContainer => {
        try {
          const dailyRecords: DailyRecord[] = JSON.parse(recordContainer.dailyRecords);
          dailyRecordsMap.set(recordContainer.crewMemberId, dailyRecords);
        } catch (e) {
          console.error('Failed to parse daily records:', e);
        }
      });

    vesselCrewSummaries.forEach(crew => {
      // Check if this crew member has NCs
      const ncCount = isPredicted ? crew.predictedNCs : crew.totalNCs;
      if (!ncCount || ncCount === 0) return;
      
      // Get violation dates (these are the days that contribute to the NC)
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

      // Get rank sort order (strip suffix for matching)
      const baseName = crew.rank.split('_')[0];
      const rankSortOrder = rankOrderMap.get(baseName) || rankOrderMap.get(crew.rank) || 999;

      // For each violation day (which contributes to the NC), find the corresponding daily record
      violationDays.forEach(day => {
        const dayRecord = dailyRecords.find(r => r.day === day && (isPredicted ? r.isPlan : !r.isPlan));
        
        if (dayRecord) {
          const violations = Array.isArray(dayRecord.violations) ? dayRecord.violations : [];
          const filteredViolations = filterViolations(violations, complianceMode, opaMode);
          const diagnostics = dayRecord.violationDiagnostics || [];
          const filteredDiagnostics = diagnostics.filter(d => filteredViolations.includes(d.code));

          allNCs.push({
            crewMemberId: crew.crewMemberId,
            crewMemberName: crew.name,
            rank: crew.rank,
            rankSortOrder,
            day: day,
            filteredViolations: filteredViolations.sort((a, b) => a - b),
            filteredDiagnostics,
            comments: dayRecord.comments || '',
          });
        } else {
          // If we can't find the daily record, still show the violation date
          allNCs.push({
            crewMemberId: crew.crewMemberId,
            crewMemberName: crew.name,
            rank: crew.rank,
            rankSortOrder,
            day: day,
            filteredViolations: [],
            filteredDiagnostics: [],
            comments: '',
          });
        }
      });
    });

    // Sort by rank order, then by name, then by date
    return allNCs.sort((a, b) => {
      if (a.rankSortOrder !== b.rankSortOrder) return a.rankSortOrder - b.rankSortOrder;
      if (a.crewMemberName !== b.crewMemberName) return a.crewMemberName.localeCompare(b.crewMemberName);
      return a.day - b.day;
    });
  }, [crewSummaries, allDailyRecords, availableRanks, rankOrderMap, vesselId, complianceMode, opaMode, isPredicted, crewIdsWithNCs]);

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

  // Calculate row count for each crew member (for rowSpan)
  const crewRowCounts = useMemo(() => {
    const counts = new Map<string, number>();
    ncRecords.forEach(record => {
      counts.set(record.crewMemberId, (counts.get(record.crewMemberId) || 0) + 1);
    });
    return counts;
  }, [ncRecords]);

  // Handler to open NC Report dialog
  const handleViewNCReport = (crewMemberId: string, rank: string, name: string) => {
    const crewSummary = crewSummaries.find(c => c.crewMemberId === crewMemberId && c.vesselId === vesselId);
    if (crewSummary) {
      setSelectedNCReportRecord(crewSummary);
      setNCReportDialogOpen(true);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {isPredicted ? 'Predicted Non-Conformities' : 'Non-Conformities'} - {vesselName} - {formatMonth(monthValue)}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : ncRecords.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No non-conformities found</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-[#52baf3] text-white">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-sm">Rank</th>
                    <th className="px-4 py-3 text-left font-medium text-sm">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-sm">Date</th>
                    <th className="px-4 py-3 text-left font-medium text-sm">Violations</th>
                    <th className="px-4 py-3 text-left font-medium text-sm">Comments</th>
                    <th className="px-4 py-3 text-center font-medium text-sm">View Report</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {ncRecords.map((record, index) => {
                    // Only show rank and name on the first row for each crew member
                    const isFirstRowForCrew = index === 0 || ncRecords[index - 1].crewMemberId !== record.crewMemberId;
                    const rowSpan = isFirstRowForCrew ? crewRowCounts.get(record.crewMemberId) || 1 : undefined;
                    
                    return (
                    <tr key={`${record.crewMemberId}-${record.day}-${index}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{isFirstRowForCrew ? record.rank : ''}</td>
                      <td className="px-4 py-3 text-sm">{isFirstRowForCrew ? record.crewMemberName : ''}</td>
                      <td className="px-4 py-3 text-sm">{formatDay(record.day, monthValue)}</td>
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
                      {isFirstRowForCrew && (
                        <td 
                          className="px-4 py-3 text-center align-middle" 
                          rowSpan={rowSpan}
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewNCReport(record.crewMemberId, record.rank, record.crewMemberName)}
                            data-testid={`button-view-nc-report-${record.crewMemberId}`}
                            className="text-xs"
                          >
                            View Report
                          </Button>
                        </td>
                      )}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedNCReportRecord && (
          <NCReportDialog
            key={`nc-report-${selectedNCReportRecord.crewMemberId}-${selectedNCReportRecord.vesselId}-${selectedNCReportRecord.monthValue}`}
            open={ncReportDialogOpen}
            onOpenChange={setNCReportDialogOpen}
            crewRecord={selectedNCReportRecord}
            vesselName={vesselName}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
