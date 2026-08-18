import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { RestHoursCrewRecord } from '@shared/schema';
import { filterViolations } from '../violationFilters';
import type { ViolationDailyRecord } from '../types';
import { useV2Vessels } from '../hooks/useRestHoursV2Data';
import { restHoursApiV2 } from '../api/restHoursApiV2';
import { enumerateMonths } from '../utils/periodUtils';

interface VesselViolationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monthValue: string;
  monthValues?: string[]; // Optional multi-month period (quarter)
  dateRange?: { from: string; to: string }; // Optional custom date range (YYYY-MM-DD)
  complianceMode: 'Rest' | 'Work';
  opaMode: boolean;
  vesselIds?: string[];
}

// Using ViolationDailyRecord from shared types
type DailyRecord = ViolationDailyRecord;

// Helper function to normalize rank for comparison (strip suffixes like "_1", "_2", trim, lowercase)
function normalizeRank(rank: string | null | undefined): string {
  if (!rank) return '';
  return rank.replace(/_\d+$/, '').trim().toLowerCase();
}

interface CrewViolationData {
  crewMemberId: string;
  crewMemberName: string;
  rank: string;
  monthValue: string;
  totalViolations: number;
  violationDates: number[];
}

interface VesselViolationGroup {
  vesselId: string;
  vesselName: string;
  crewMembers: CrewViolationData[];
}

export function VesselViolationsDialog({
  open,
  onOpenChange,
  monthValue,
  monthValues,
  dateRange,
  complianceMode,
  opaMode,
  vesselIds = [],
}: VesselViolationsDialogProps) {

  // Months covered by the selected period (single month, quarter, or custom range)
  const monthsInPeriod = useMemo(() => {
    if (dateRange) return enumerateMonths(dateRange.from, dateRange.to);
    if (monthValues && monthValues.length > 0) return monthValues;
    return [monthValue];
  }, [dateRange, monthValues, monthValue]);

  // Fetch crew records scoped to the selected vessels AND period.
  // Without a period filter, the server returns every record the vessel has
  // ever had, which leaks violations from other months into this popup.
  const { data: crewSummaries = [], isLoading: isLoadingSummaries } = useQuery<any[]>({
    queryKey: ['v2', 'rest-hours', 'crew-records', { vesselIds, monthValue, monthValues, dateRange, complianceMode, opaMode }],
    queryFn: async () => {
      return restHoursApiV2.crewRecords.getAll({
        vesselId: vesselIds.length > 0 ? vesselIds : undefined,
        monthValue: !dateRange && !(monthValues && monthValues.length > 0) ? monthValue : undefined,
        monthValues: !dateRange && monthValues && monthValues.length > 0 ? monthValues : undefined,
        dateFrom: dateRange?.from,
        dateTo: dateRange?.to,
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

  // Get crew records with violations (using uuid instead of crewMemberId for V2)
  const crewRecordsWithViolations = useMemo(() => {
    return crewSummaries.filter(crew => {
      const violationDatesField = crew.violationDates;
      return violationDatesField && violationDatesField !== '[]';
    });
  }, [crewSummaries]);

  const crewMemberIdsWithViolations = useMemo(() => 
    crewRecordsWithViolations.map(crew => crew.crewMemberId),
    [crewRecordsWithViolations]
  );

  // Fetch daily records for the months in the selected period.
  // Fetching per month (instead of per crew across all months) keeps every
  // grid attributable to its own month — no cross-month overwrites.
  const { data: allDailyRecords = [], isLoading: isLoadingDaily } = useQuery<any[]>({
    queryKey: ['v2', 'rest-hours', 'daily-records', crewMemberIdsWithViolations, monthsInPeriod],
    queryFn: async () => {
      const perMonth = await Promise.all(
        monthsInPeriod.map(monthYear => restHoursApiV2.dailyRecords.getAll({ monthYear }))
      );
      return perMonth.flat();
    },
    enabled: open && crewMemberIdsWithViolations.length > 0,
  });

  // Group violations by vessel
  const vesselGroups = useMemo(() => {
    const groups = new Map<string, VesselViolationGroup>();

    const dailyRecordsMap = new Map<string, DailyRecord[]>();
    
    allDailyRecords.forEach(recordContainer => {
      try {
        const dailyRecords: DailyRecord[] = JSON.parse(recordContainer.dailyRecords);
        // Key by crew + vessel + rank + month so multiple grids per crew
        // (other vessels, promotion-split rank rows, or other months) never
        // overwrite each other.
        const mapKey = `${recordContainer.crewMemberId}-${recordContainer.vesselId}-${normalizeRank(recordContainer.rank)}-${recordContainer.monthYear}`;
        dailyRecordsMap.set(mapKey, dailyRecords);
      } catch (e) {
        console.error('Failed to parse dailyRecords for crew:', recordContainer.crewMemberId, e);
      }
    });

    // Process each crew member with violations
    crewRecordsWithViolations.forEach(crew => {
      const vesselId = crew.vesselId || '';
      const vesselName = vesselNameMap.get(vesselId) || vesselId;

      // Parse violation dates
      let violationDays: number[] = [];
      try {
        violationDays = JSON.parse(crew.violationDates || '[]');
      } catch (e) {
        console.error('Failed to parse violation dates:', e);
        return;
      }

      // Filter violations based on compliance mode and OPA mode
      const dailyRecords = dailyRecordsMap.get(`${crew.crewMemberId}-${crew.vesselId}-${normalizeRank(crew.rank)}-${crew.monthValue}`) || [];
      const filteredViolationDays: number[] = [];

      violationDays.forEach(day => {
        const dayRecord = dailyRecords.find(r => r.day === day && !r.isPlan);
        if (dayRecord) {
          const violations = Array.isArray(dayRecord.violations) ? dayRecord.violations : [];
          const filteredViolations = filterViolations(violations, complianceMode, opaMode);
          if (filteredViolations.length > 0) {
            filteredViolationDays.push(day);
          }
        }
      });

      // Skip crew members with no violations after filtering
      if (filteredViolationDays.length === 0) {
        return;
      }

      // Get or create vessel group
      if (!groups.has(vesselId)) {
        groups.set(vesselId, {
          vesselId,
          vesselName,
          crewMembers: [],
        });
      }

      const group = groups.get(vesselId)!;
      group.crewMembers.push({
        crewMemberId: crew.crewMemberId,
        crewMemberName: crew.name,
        rank: crew.rank,
        monthValue: crew.monthValue,
        totalViolations: filteredViolationDays.length,
        violationDates: filteredViolationDays.sort((a, b) => a - b),
      });
    });

    // Convert to array and sort by vessel name
    return Array.from(groups.values()).sort((a, b) => 
      a.vesselName.localeCompare(b.vesselName)
    );
  }, [crewRecordsWithViolations, allDailyRecords, complianceMode, opaMode, vesselNameMap]);

  // Calculate row count for each vessel (for rowSpan)
  const vesselRowCounts = useMemo(() => {
    const counts = new Map<string, number>();
    vesselGroups.forEach(vessel => {
      counts.set(vessel.vesselId, vessel.crewMembers.length);
    });
    return counts;
  }, [vesselGroups]);

  // Format month for display
  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  // Format violation dates as "Nov: 3, 4, 6" using the row's own month
  const formatViolationDates = (days: number[], rowMonthValue: string) => {
    const monthName = formatMonth(rowMonthValue || monthValue).split(' ')[0];
    return `${monthName}: ${days.join(', ')}`;
  };

  // Period label for the dialog title
  const periodLabel = dateRange
    ? `${dateRange.from} to ${dateRange.to}`
    : monthsInPeriod.length > 1
      ? `${formatMonth(monthsInPeriod[0])} to ${formatMonth(monthsInPeriod[monthsInPeriod.length - 1])}`
      : formatMonth(monthValue);

  const isLoading = isLoadingSummaries || isLoadingDaily;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Violations - Vessel Count - {periodLabel}
          </DialogTitle>
          <DialogDescription className="sr-only">
            View violations grouped by vessel with crew member details
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : vesselGroups.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No violations found</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-blue-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-semibold">Vessel</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold">Rank</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold">Name</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold">Total Violations</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold">Violation Dates</th>
                  </tr>
                </thead>
                <tbody>
                  {vesselGroups.map((vessel) => 
                    vessel.crewMembers.map((crew, crewIndex) => {
                      const isFirstRowForVessel = crewIndex === 0;
                      const rowSpan = isFirstRowForVessel ? vesselRowCounts.get(vessel.vesselId) || 1 : undefined;

                      return (
                        <tr key={`${vessel.vesselId}-${crew.crewMemberId}`} className="border-t hover:bg-gray-50">
                          {isFirstRowForVessel && (
                            <td className="px-4 py-2 text-sm font-medium align-top" rowSpan={rowSpan}>
                              {vessel.vesselName}
                            </td>
                          )}
                          <td className="px-4 py-2 text-sm">{crew.rank}</td>
                          <td className="px-4 py-2 text-sm">{crew.crewMemberName}</td>
                          <td className="px-4 py-2 text-sm text-center">{crew.totalViolations}</td>
                          <td className="px-4 py-2 text-sm">{formatViolationDates(crew.violationDates, crew.monthValue)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
