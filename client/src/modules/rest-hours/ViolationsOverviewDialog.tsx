import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useMemo, useState, useEffect } from 'react';
import type { RestHoursCrewRecord } from '@shared/schema';
import { filterViolations } from './violationFilters';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';

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
  rankFilter?: string; // Optional rank filter for drill-down
  vesselIds?: string[]; // Optional vessel IDs filter for chart drill-down
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
  vesselId: string;
  vesselName: string;
  day: number;
  filteredViolations: number[];
  filteredDiagnostics: ViolationDiagnostic[];
  comments: string;
}

// Helper function to normalize rank for comparison (strip suffixes like "_1", "_2", trim, lowercase)
function normalizeRank(rank: string | null | undefined): string {
  if (!rank) return '';
  // Remove suffix pattern like "_1", "_2", etc. and normalize case/whitespace
  return rank.replace(/_\d+$/, '').trim().toLowerCase();
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
  rankFilter,
  vesselIds,
}: ViolationsOverviewDialogProps) {
  const { toast } = useToast();
  const [vesselComment, setVesselComment] = useState('');

  // Fetch all crew records for this vessel (or multiple vessels if provided) and month to get crew list
  const queryParams = new URLSearchParams();
  
  // Use vesselIds array if provided and not empty, otherwise fall back to single vesselId if not empty
  // If both are empty, don't filter by vessel (fetch all vessels)
  let vesselIdsToUse: string[] = [];
  if (vesselIds && vesselIds.length > 0 && vesselIds.some(id => id && id.trim() !== '')) {
    vesselIdsToUse = vesselIds.filter(id => id && id.trim() !== '');
  } else if (vesselId && vesselId.trim() !== '') {
    vesselIdsToUse = [vesselId];
  }
  
  // Only add vessel filter if we have valid vessel IDs
  vesselIdsToUse.forEach(id => queryParams.append('vesselIds', id));
  
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

  // Fetch vessel master data for vessel names
  const { data: vesselMasterData = [] } = useQuery<any[]>({
    queryKey: ['/api/masters/014/data'],
    enabled: open,
  });

  // Create vessel name map
  const vesselNameMap = useMemo(() => {
    const map = new Map<string, string>();
    vesselMasterData.forEach(vessel => {
      map.set(vessel.entryId, vessel.vessel || vessel.name);
    });
    return map;
  }, [vesselMasterData]);

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

  // Fetch existing vessel comment (only for actual violations, not predicted, and single vessel view)
  const { data: vesselCommentData } = useQuery<{ comment: string } | null>({
    queryKey: ['/api/vessel-violation-comments', vesselId, monthValue],
    queryFn: async () => {
      const response = await fetch(`/api/vessel-violation-comments?vesselId=${vesselId}&monthValue=${monthValue}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch vessel comment');
      }
      return response.json();
    },
    enabled: open && !isPredicted && !rankFilter && vesselIdsToUse.length === 1 && vesselId !== '',
  });

  // Update local state when comment data is fetched
  useEffect(() => {
    if (vesselCommentData) {
      setVesselComment(vesselCommentData.comment || '');
    } else {
      setVesselComment('');
    }
  }, [vesselCommentData]);

  // Mutation to save vessel comment
  const saveCommentMutation = useMutation({
    mutationFn: async (comment: string) => {
      return apiRequest('POST', '/api/vessel-violation-comments', {
        vesselId,
        monthValue,
        comment,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vessel-violation-comments', vesselId, monthValue] });
      toast({
        title: 'Success',
        description: 'Vessel comment saved successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save vessel comment',
        variant: 'destructive',
      });
    },
  });

  const handleSaveComment = () => {
    saveCommentMutation.mutate(vesselComment);
  };

  const isLoading = isLoadingSummaries || isLoadingDaily;

  // Parse and aggregate all violations from all crew members using pre-calculated violation dates
  const violationRecords = useMemo(() => {
    const allViolations: ViolationRecord[] = [];

    // Filter crew summaries by vessel(s) if vessel filter is specified
    // If vesselIdsToUse is empty, include all vessels (no vessel filter)
    let vesselCrewSummaries = vesselIdsToUse.length > 0
      ? crewSummaries.filter(crew => vesselIdsToUse.includes(crew.vesselId))
      : crewSummaries;
    
    // Apply rank filter if provided (normalize both sides for comparison)
    if (rankFilter) {
      const normalizedRankFilter = normalizeRank(rankFilter);
      vesselCrewSummaries = vesselCrewSummaries.filter(crew => 
        normalizeRank(crew.rank) === normalizedRankFilter
      );
    }

    // Create a map of daily records for quick lookup
    const dailyRecordsMap = new Map<string, DailyRecord[]>();
    
    // Filter daily records by crew members that have violations and match vessel(s)+month
    const filteredRecords = allDailyRecords.filter(record =>
      crewIdsWithViolations.includes(record.crewMemberId) && 
      (vesselIdsToUse.length === 0 || vesselIdsToUse.includes(record.vesselId)) &&
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
            vesselId: crew.vesselId,
            vesselName: vesselNameMap.get(crew.vesselId) || crew.vesselId,
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
            vesselId: crew.vesselId,
            vesselName: vesselNameMap.get(crew.vesselId) || crew.vesselId,
            day: day,
            filteredViolations: [],
            filteredDiagnostics: [],
            comments: '',
          });
        }
      });
    });

    // Sort by vessel, then by rank, then by name, then by day
    // This ensures all rows for the same crew member are consecutive for rowspan to work correctly
    return allViolations.sort((a, b) => {
      if (a.vesselId !== b.vesselId) return a.vesselId.localeCompare(b.vesselId);
      if (a.rank !== b.rank) return a.rank.localeCompare(b.rank);
      if (a.crewMemberName !== b.crewMemberName) return a.crewMemberName.localeCompare(b.crewMemberName);
      return a.day - b.day;
    });
  }, [crewSummaries, allDailyRecords, vesselIdsToUse, monthValue, complianceMode, opaMode, isPredicted, rankFilter, vesselNameMap, crewIdsWithViolations]);

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
    violationRecords.forEach(record => {
      counts.set(record.crewMemberId, (counts.get(record.crewMemberId) || 0) + 1);
    });
    return counts;
  }, [violationRecords]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {isPredicted ? 'Predicted NCs' : 'Violations'} - {rankFilter ? rankFilter : vesselName} - {formatMonth(monthValue)}
          </DialogTitle>
          <DialogDescription className="sr-only">
            View detailed violation records for crew members
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : violationRecords.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No violations found</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-blue-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-semibold">Vessel</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold">Rank</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold">Name</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold">Date</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold">Violations</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold">Comments</th>
                  </tr>
                </thead>
                <tbody>
                  {violationRecords.map((record, index) => {
                    // Only show vessel, rank and name on the first row for each crew member
                    const isFirstRowForCrew = index === 0 || violationRecords[index - 1].crewMemberId !== record.crewMemberId;
                    const rowSpan = isFirstRowForCrew ? crewRowCounts.get(record.crewMemberId) || 1 : undefined;
                    
                    return (
                    <tr key={`${record.crewMemberId}-${record.day}-${index}`} className="border-t hover:bg-gray-50">
                      {isFirstRowForCrew && (
                        <td className="px-4 py-2 text-sm align-middle" rowSpan={rowSpan}>
                          {record.vesselName}
                        </td>
                      )}
                      {isFirstRowForCrew && (
                        <td className="px-4 py-2 text-sm align-middle" rowSpan={rowSpan}>
                          {record.rank}
                        </td>
                      )}
                      {isFirstRowForCrew && (
                        <td className="px-4 py-2 text-sm align-middle" rowSpan={rowSpan}>
                          {record.crewMemberName}
                        </td>
                      )}
                      <td className="px-4 py-2 text-sm">{formatDay(record.day, monthValue)}</td>
                      <td className="px-4 py-2 text-sm">
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
                      <td className="px-4 py-2 text-sm">{record.comments}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Vessel Comment Section - Only for actual violations and single vessel view */}
        {!isPredicted && !rankFilter && vesselIdsToUse.length === 1 && (
          <div className="mt-6 space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                Vessel Comment (Master/Chief Engineer)
              </label>
              <Button
                onClick={handleSaveComment}
                disabled={saveCommentMutation.isPending}
                size="sm"
                data-testid="button-save-vessel-comment"
              >
                {saveCommentMutation.isPending ? 'Saving...' : 'Save Comment'}
              </Button>
            </div>
            <Textarea
              value={vesselComment}
              onChange={(e) => setVesselComment(e.target.value)}
              placeholder="Enter corrective actions or notes regarding these violations..."
              className="min-h-[100px] resize-y"
              data-testid="textarea-vessel-comment"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
