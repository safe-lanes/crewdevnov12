import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { RestHoursCrewRecord } from '@shared/schema';
import { filterViolations } from '../violationFilters';
import type { ViolationDailyRecord } from '../types';
import { useV2Vessels } from '../hooks/useRestHoursV2Data';
import { restHoursApiV2 } from '../api/restHoursApiV2';

interface VesselViolationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monthValue: string;
  complianceMode: 'Rest' | 'Work';
  opaMode: boolean;
  vesselIds?: string[];
}

// Using ViolationDailyRecord from shared types
type DailyRecord = ViolationDailyRecord;

interface CrewViolationData {
  crewMemberId: string;
  crewMemberName: string;
  rank: string;
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
  complianceMode,
  opaMode,
  vesselIds = [],
}: VesselViolationsDialogProps) {
  
  // Fetch vessel records first to get UUIDs for the given month
  const [year, month] = monthValue.split('-');
  const { data: vesselRecords = [], isLoading: isLoadingVesselRecords } = useQuery<any[]>({
    queryKey: ['v2', 'rest-hours', 'vessel-records', vesselIds, monthValue],
    queryFn: async () => {
      const records = await restHoursApiV2.vesselRecords.getAll({ month, year });
      // Filter to only the requested vessel IDs if specified
      if (vesselIds.length > 0) {
        return records.filter((r: any) => vesselIds.includes(r.vesselUuid));
      }
      return records;
    },
    enabled: open,
  });

  // Get vessel record UUIDs for fetching crew records
  const vesselRecordUuids = useMemo(() => 
    vesselRecords.map((vr: any) => vr.uuid), 
    [vesselRecords]
  );

  // Fetch crew records for all vessel records
  const { data: crewSummaries = [], isLoading: isLoadingSummaries } = useQuery<any[]>({
    queryKey: ['v2', 'rest-hours', 'crew-records', vesselRecordUuids, complianceMode, opaMode],
    queryFn: async () => {
      const allCrewRecords: any[] = [];
      for (const vesselRecordUuid of vesselRecordUuids) {
        const records = await restHoursApiV2.crewRecords.getAll({ vesselId: vesselRecordUuid });
        allCrewRecords.push(...records);
      }
      return allCrewRecords;
    },
    enabled: open && vesselRecordUuids.length > 0,
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
    crewRecordsWithViolations.map(crew => crew.uuid),
    [crewRecordsWithViolations]
  );

  // Fetch daily records for crew with violations using V2 API
  const { data: allDailyRecords = [], isLoading: isLoadingDaily } = useQuery<any[]>({
    queryKey: ['v2', 'rest-hours', 'daily-records', crewMemberIdsWithViolations, monthValue],
    queryFn: async () => {
      const allRecords: any[] = [];
      for (const crewMemberId of crewMemberIdsWithViolations) {
        const records = await restHoursApiV2.dailyRecords.getAll({ crewMemberId });
        allRecords.push(...records);
      }
      return allRecords;
    },
    enabled: open && crewMemberIdsWithViolations.length > 0,
  });

  // Group violations by vessel
  const vesselGroups = useMemo(() => {
    const groups = new Map<string, VesselViolationGroup>();

    // Create a map of daily records for quick lookup by crew record UUID
    const dailyRecordsMap = new Map<string, DailyRecord[]>();
    
    allDailyRecords.forEach(record => {
      const crewMemberId = record.crewMemberId;
      if (!dailyRecordsMap.has(crewMemberId)) {
        dailyRecordsMap.set(crewMemberId, []);
      }
      dailyRecordsMap.get(crewMemberId)!.push(record);
    });

    // Process each crew member with violations
    crewRecordsWithViolations.forEach(crew => {
      const vesselRecord = vesselRecords.find((vr: any) => vr.uuid === (crew.vesselId || crew.vesselRecordUuid));
      const vesselId = vesselRecord?.vesselUuid || crew.vesselUuid || '';
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
      const dailyRecords = dailyRecordsMap.get(crew.uuid) || [];
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
        crewMemberId: crew.crewUuid || crew.uuid,
        crewMemberName: crew.crewName || crew.name,
        rank: crew.rankName || crew.rank,
        totalViolations: filteredViolationDays.length,
        violationDates: filteredViolationDays.sort((a, b) => a - b),
      });
    });

    // Convert to array and sort by vessel name
    return Array.from(groups.values()).sort((a, b) => 
      a.vesselName.localeCompare(b.vesselName)
    );
  }, [crewRecordsWithViolations, allDailyRecords, complianceMode, opaMode, vesselNameMap, vesselRecords]);

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

  // Format violation dates as "Nov: 3, 4, 6"
  const formatViolationDates = (days: number[]) => {
    const monthName = formatMonth(monthValue).split(' ')[0];
    return `${monthName}: ${days.join(', ')}`;
  };

  const isLoading = isLoadingVesselRecords || isLoadingSummaries || isLoadingDaily;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Violations - Vessel Count - {formatMonth(monthValue)}
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
                          <td className="px-4 py-2 text-sm">{formatViolationDates(crew.violationDates)}</td>
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
