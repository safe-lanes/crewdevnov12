import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { RestHoursCrewRecord } from '@shared/schema';
import { filterViolations } from './violationFilters';

interface VesselViolationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monthValue: string;
  complianceMode: 'Rest' | 'Work';
  opaMode: boolean;
  vesselIds?: string[];
}

interface DailyRecord {
  day: number;
  dayOfWeek: string;
  hours: string[];
  isPlan: boolean;
  comments: string;
  violations: number[];
  violationDiagnostics?: any[];
  hoursOfRest24hr: number;
  hoursOfWork24hr: number;
  anyPeriodRest24hr: number;
  anyPeriodWork24hr: number;
  anyPeriodRest7day: number;
  anyPeriodWork7day: number;
}

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
  
  // Build query params
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    const validVesselIds = vesselIds.filter(id => id && id.trim() !== '');
    validVesselIds.forEach(id => params.append('vesselIds', id));
    params.append('monthValue', monthValue);
    params.append('complianceMode', complianceMode);
    params.append('opaMode', String(opaMode));
    return params;
  }, [vesselIds, monthValue, complianceMode, opaMode]);

  // Fetch crew records
  const { data: crewSummaries = [], isLoading: isLoadingSummaries } = useQuery<any[]>({
    queryKey: ['/api/rest-hours-crew-records', vesselIds, monthValue, complianceMode, opaMode],
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

  // Get crew IDs that have violations
  const crewIdsWithViolations = useMemo(() => {
    return crewSummaries
      .filter(crew => {
        const violationDatesField = crew.violationDates;
        return violationDatesField && violationDatesField !== '[]';
      })
      .map(crew => crew.crewMemberId);
  }, [crewSummaries]);

  // Fetch daily records for crew with violations
  const { data: allDailyRecords = [], isLoading: isLoadingDaily } = useQuery<any[]>({
    queryKey: ['/api/rest-hours-daily-records', crewIdsWithViolations, monthValue],
    queryFn: async () => {
      // Fetch all daily records (no filtering at API level since endpoint doesn't support it)
      const response = await fetch('/api/rest-hours-daily-records');
      if (!response.ok) throw new Error('Failed to fetch daily records');
      return response.json();
    },
    enabled: open && crewIdsWithViolations.length > 0,
  });

  // Group violations by vessel
  const vesselGroups = useMemo(() => {
    const groups = new Map<string, VesselViolationGroup>();

    // Filter crew summaries to only those with violations
    const crewWithViolations = crewSummaries.filter(crew => {
      const violationDatesField = crew.violationDates;
      return violationDatesField && violationDatesField !== '[]';
    });

    // Create a map of daily records for quick lookup
    const dailyRecordsMap = new Map<string, DailyRecord[]>();
    const filteredRecords = allDailyRecords.filter(record =>
      crewIdsWithViolations.includes(record.crewMemberId) && 
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

    // Process each crew member with violations
    crewWithViolations.forEach(crew => {
      const vesselId = crew.vesselId;
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
      const dailyRecords = dailyRecordsMap.get(crew.crewMemberId) || [];
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
        totalViolations: filteredViolationDays.length,
        violationDates: filteredViolationDays.sort((a, b) => a - b),
      });
    });

    // Convert to array and sort by vessel name
    return Array.from(groups.values()).sort((a, b) => 
      a.vesselName.localeCompare(b.vesselName)
    );
  }, [crewSummaries, allDailyRecords, monthValue, complianceMode, opaMode, vesselNameMap, crewIdsWithViolations]);

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

  const isLoading = isLoadingSummaries || isLoadingDaily;

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
