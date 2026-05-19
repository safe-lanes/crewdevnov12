import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useMemo, useState, useEffect } from 'react';
import type { RestHoursCrewRecord } from '@shared/schema';
import { filterViolations } from '../violationFilters';
import { sortViolationCodes } from '../timelineCalculations';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { useV2Vessels } from '../hooks/useRestHoursV2Data';
import { restHoursApiV2 } from '../api/restHoursApiV2';

const VIOLATION_CODE_DESCRIPTIONS: Record<string, string> = {
  'A': "Minimum 10 hours of rest in any 24 hour period",
  'C': "Minimum hours of rest in any 7 day period = 77",
  'E': "1 period of 6 hrs Rest in any 24 hr Period",
  'F': "Hrs of rest (10) may be divided into no more than 2 periods",
  'G': "Interval between rest periods not to exceed 14 hours",
  'B': "ILO Work - Maximum 14 hours of work in any 24 hour period",
  'D': "ILO Work - Maximum 72 hours of work in any 7 day period",
  'I': "OPA - Maximum 15 hours of work in any 24 hour period",
  'H': "OPA - Maximum 36 hours of work in 72 hours",
};

interface ViolationDiagnostic {
  code: string;
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
  violations: string[];
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
  filteredViolations: string[];
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
    queryKey: ['v2', 'rest-hours', 'crew-records', { vesselIds: vesselIdsToUse, monthValue, complianceMode, opaMode }],
    queryFn: async () => {
      return restHoursApiV2.crewRecords.getAll({
        vesselId: vesselIdsToUse.length === 1 ? vesselIdsToUse[0] : undefined,
        monthValue,
        complianceMode,
        opaMode,
      });
    },
    enabled: open,
  });

  // Fetch vessel master data using V2 API
  const { vessels: v2Vessels } = useV2Vessels();

  const vesselMasterData = useMemo(() => v2Vessels.map(v => ({
    id: v.id,
    entryId: v.vesselUuid ?? '',
    name: v.vessel ?? '',
    vesselType: v.vesselType ?? '',
  })), [v2Vessels]);

  // Create vessel name map
  const vesselNameMap = useMemo(() => {
    const map = new Map<string, string>();
    vesselMasterData.forEach(vessel => {
      map.set(vessel.entryId, vessel.name);
    });
    return map;
  }, [vesselMasterData]);

  // Aggregate NC counts per (vesselId, crewMemberId) to match the vessel
  // aggregate rule in vesselRecordsService, which aggregates within each
  // vessel-month group. A crew with split assignments on the same vessel
  // (one actual-NC stint + one predicted-NC stint) should NOT be counted as
  // a Predicted NC; but cross-vessel transfers are counted independently
  // per vessel, matching how the tile sums across the selected vessels.
  const predictedNCKeys = useMemo(() => {
    if (!isPredicted) return null;
    const keyOf = (c: any) => `${c.vesselId}|${c.crewMemberId}`;
    const perKey = new Map<string, { totalNCs: number; predictedNCs: number }>();
    for (const crew of crewSummaries) {
      if (!crew.crewMemberId || !crew.vesselId) continue;
      const k = keyOf(crew);
      const prev = perKey.get(k) || { totalNCs: 0, predictedNCs: 0 };
      perKey.set(k, {
        totalNCs: prev.totalNCs + (crew.totalNCs ?? 0),
        predictedNCs: prev.predictedNCs + (crew.predictedNCs ?? 0),
      });
    }
    const qualifying = new Set<string>();
    Array.from(perKey.entries()).forEach(([k, agg]) => {
      if (agg.totalNCs === 0 && agg.predictedNCs > 0) qualifying.add(k);
    });
    return qualifying;
  }, [crewSummaries, isPredicted]);

  // Get crew IDs that have violations to fetch their daily records
  const crewIdsWithViolations = useMemo(() => {
    return crewSummaries
      .filter(crew => {
        const violationDatesField = isPredicted ? crew.predictedViolationDates : crew.violationDates;
        if (!violationDatesField || violationDatesField === '[]') return false;
        if (isPredicted) {
          return predictedNCKeys?.has(`${crew.vesselId}|${crew.crewMemberId}`) ?? false;
        }
        return true;
      })
      .map(crew => crew.crewMemberId);
  }, [crewSummaries, isPredicted, predictedNCKeys]);

  // Fetch daily records only for crew members with violations
  const { data: allDailyRecords = [], isLoading: isLoadingDaily } = useQuery<any[]>({
    queryKey: ['v2', 'rest-hours', 'daily-records', { crewIds: crewIdsWithViolations, vesselIds: vesselIdsToUse, monthValue }],
    queryFn: async () => {
      return restHoursApiV2.dailyRecords.getAll({
        vesselId: vesselIdsToUse.length === 1 ? vesselIdsToUse[0] : undefined,
        monthYear: monthValue,
      });
    },
    enabled: open && crewIdsWithViolations.length > 0,
  });

  const resolvedVesselId = vesselIdsToUse.length === 1 ? vesselIdsToUse[0] : '';

  const { data: vesselCommentData } = useQuery<{ comment: string } | null>({
    queryKey: ['v2', 'rest-hours', 'vessel-comments', resolvedVesselId, monthValue],
    queryFn: async () => {
      try {
        const comments = await restHoursApiV2.vesselComments.getAll({ vesselId: resolvedVesselId, monthValue });
        return comments && comments.length > 0 ? { comment: comments[0].comment } : null;
      } catch (error) {
        return null;
      }
    },
    enabled: open && !isPredicted && !rankFilter && vesselIdsToUse.length === 1 && resolvedVesselId !== '',
    staleTime: 0,
    refetchOnMount: 'always',
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
      return restHoursApiV2.vesselComments.create({
        vesselId: resolvedVesselId,
        monthValue,
        comment,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'rest-hours', 'vessel-comments'] });
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

      // For Predicted NCs, only render crew counted by the tile aggregate
      // (per-(vessel, crew) aggregation, matches vesselRecordsService).
      if (isPredicted && !predictedNCKeys?.has(`${crew.vesselId}|${crew.crewMemberId}`)) {
        return;
      }

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
            filteredViolations: sortViolationCodes(filteredViolations),
            filteredDiagnostics,
            comments: dayRecord.comments || '',
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
  }, [crewSummaries, allDailyRecords, vesselIdsToUse, monthValue, complianceMode, opaMode, isPredicted, rankFilter, vesselNameMap, crewIdsWithViolations, predictedNCKeys]);

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
            <div className="border rounded-lg overflow-hidden max-h-[60vh] overflow-y-auto">
              <table className="w-full border-collapse table-fixed">
                <thead className="bg-blue-50 sticky top-0 z-10">
                  <tr>
                    <th className="w-[15%] px-4 py-2 text-left text-sm font-semibold bg-blue-50 border-b border-blue-200">Vessel</th>
                    <th className="w-[12%] px-4 py-2 text-left text-sm font-semibold bg-blue-50 border-b border-blue-200">Rank</th>
                    <th className="w-[18%] px-4 py-2 text-left text-sm font-semibold bg-blue-50 border-b border-blue-200">Name</th>
                    <th className="w-[15%] px-4 py-2 text-left text-sm font-semibold bg-blue-50 border-b border-blue-200">Date</th>
                    <th className="w-[15%] px-4 py-2 text-left text-sm font-semibold bg-blue-50 border-b border-blue-200">Violations</th>
                    <th className="w-[25%] px-4 py-2 text-left text-sm font-semibold bg-blue-50 border-b border-blue-200">Comments</th>
                  </tr>
                </thead>
                <tbody>
                  {violationRecords.map((record, index) => {
                    const isFirstRowForCrew = index === 0 || violationRecords[index - 1].crewMemberId !== record.crewMemberId;
                    
                    return (
                    <tr key={`${record.crewMemberId}-${record.day}-${index}`} className={`hover:bg-gray-50 ${isFirstRowForCrew ? 'border-t-2 border-gray-300' : 'border-t border-gray-100'}`}>
                      <td className="px-4 py-2 text-sm">
                        {isFirstRowForCrew ? record.vesselName : ''}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {isFirstRowForCrew ? record.rank : ''}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {isFirstRowForCrew ? record.crewMemberName : ''}
                      </td>
                      <td className="px-4 py-2 text-sm">{formatDay(record.day, monthValue)}</td>
                      <td className="px-4 py-2 text-sm">
                        <TooltipProvider delayDuration={200}>
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
                                <Tooltip key={code}>
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
                                    className="max-w-[220px] text-[11px] bg-white text-gray-900"
                                  >
                                    <div className="space-y-0.5">
                                      <div className="leading-snug">{VIOLATION_CODE_DESCRIPTIONS[diagnostic.code]}</div>
                                      <div className="text-gray-600 leading-snug">{diagnostic.reason}</div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                          );
                        })}
                        </TooltipProvider>
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
