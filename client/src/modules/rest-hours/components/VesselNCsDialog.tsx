import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { NCReportDialog } from './NCReportDialog';
import type { NCReport, RestHoursCrewRecord } from '@shared/schema';
import { useV2Vessels } from '../hooks/useRestHoursV2Data';
import { restHoursApiV2 } from '../api/restHoursApiV2';
import { enumerateMonths } from '../utils/periodUtils';

interface VesselNCsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monthValue: string;
  monthValues?: string[]; // Optional multi-month period (quarter)
  dateRange?: { from: string; to: string }; // Optional custom date range (YYYY-MM-DD)
  complianceMode: 'Rest' | 'Work';
  opaMode: boolean;
  vesselIds?: string[];
}

interface CrewNCData {
  crewMemberId: string;
  crewMemberName: string;
  rank: string;
  vesselId: string;
  status: 'Open' | 'Closed';
  ncReport: NCReport | null;
  crewRecord: RestHoursCrewRecord;
}

interface VesselNCGroup {
  vesselId: string;
  vesselName: string;
  totalNCs: number;
  crewMembers: CrewNCData[];
}

export function VesselNCsDialog({
  open,
  onOpenChange,
  monthValue,
  monthValues,
  dateRange,
  complianceMode,
  opaMode,
  vesselIds = [],
}: VesselNCsDialogProps) {
  const [selectedCrewRecord, setSelectedCrewRecord] = useState<RestHoursCrewRecord | null>(null);
  const [ncReportDialogOpen, setNCReportDialogOpen] = useState(false);

  // Months covered by the selected period (single month, quarter, or custom range)
  const monthsInPeriod = useMemo(() => {
    if (dateRange) return enumerateMonths(dateRange.from, dateRange.to);
    if (monthValues && monthValues.length > 0) return monthValues;
    return [monthValue];
  }, [dateRange, monthValues, monthValue]);

  // Fetch crew records scoped to the selected vessels AND period.
  // Without a period filter, the server returns every record the vessel has
  // ever had, which causes NCs from other months to leak into this popup.
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

  // Get crew records that have NCs
  const crewRecordsWithNCs = useMemo(() => {
    return crewSummaries.filter(crew => crew.totalNCs > 0);
  }, [crewSummaries]);

  // Fetch NC reports and constrain to the selected vessels AND month.
  // The /nc-reports/all endpoint has no server-side month filter, so we filter
  // client-side on the months in the selected period to avoid mixing reports
  // from other months.
  const { data: allNCReports = [], isLoading: isLoadingNCs } = useQuery<NCReport[]>({
    queryKey: ['v2', 'rest-hours', 'nc-reports', 'all', { vesselIds, monthsInPeriod }],
    queryFn: async () => {
      const reports = await restHoursApiV2.ncReports.getAll();
      return reports.filter((r: any) =>
        (vesselIds.length === 0 || vesselIds.includes(r.vesselId) || vesselIds.includes(r.vesselRecordUuid)) &&
        monthsInPeriod.includes(r.monthValue)
      );
    },
    enabled: open && crewRecordsWithNCs.length > 0,
  });

  // Group NCs by vessel
  const vesselGroups = useMemo(() => {
    const groups = new Map<string, VesselNCGroup>();

    const ncReportsMap = new Map<string, NCReport>();
    allNCReports.forEach(report => {
      // Key by crew + vessel + month so multi-month periods and same-crew
      // cross-vessel cases each keep their own report distinct
      ncReportsMap.set(`${report.crewMemberId}-${report.vesselId}-${report.monthValue}`, report);
    });

    // Process each crew member with NCs
    crewRecordsWithNCs.forEach(crew => {
      const vesselId = crew.vesselId || '';
      const vesselName = vesselNameMap.get(vesselId) || vesselId;
      
      const ncReport = ncReportsMap.get(`${crew.crewMemberId}-${crew.vesselId}-${crew.monthValue}`) || null;

      // Get or create vessel group
      if (!groups.has(vesselId)) {
        groups.set(vesselId, {
          vesselId,
          vesselName,
          totalNCs: 0,
          crewMembers: [],
        });
      }

      const group = groups.get(vesselId)!;
      group.totalNCs += crew.totalNCs;
      group.crewMembers.push({
        crewMemberId: crew.crewMemberId,
        crewMemberName: crew.name,
        rank: crew.rank,
        vesselId: vesselId,
        status: (ncReport?.status as any) || 'Open',
        ncReport,
        crewRecord: crew,
      });
    });

    // Convert to array and sort by vessel name
    return Array.from(groups.values()).sort((a, b) => 
      a.vesselName.localeCompare(b.vesselName)
    );
  }, [crewRecordsWithNCs, allNCReports, vesselNameMap]);

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

  const handleViewReport = (crewRecord: RestHoursCrewRecord) => {
    setSelectedCrewRecord(crewRecord);
    setNCReportDialogOpen(true);
  };

  // Period label for the dialog title
  const periodLabel = dateRange
    ? `${dateRange.from} to ${dateRange.to}`
    : monthsInPeriod.length > 1
      ? `${formatMonth(monthsInPeriod[0])} to ${formatMonth(monthsInPeriod[monthsInPeriod.length - 1])}`
      : formatMonth(monthValue);

  const isLoading = isLoadingSummaries || isLoadingNCs;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              NCs - Vessel Count - {periodLabel}
            </DialogTitle>
            <DialogDescription className="sr-only">
              View non-conformity reports grouped by vessel with crew member details
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : vesselGroups.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No NCs found</div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-blue-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-semibold">Vessel</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold">Total NCs</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold">Rank</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold">Name</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold">Status</th>
                      <th className="px-4 py-2 text-center text-sm font-semibold">View Report</th>
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
                              <>
                                <td className="px-4 py-2 text-sm font-medium align-top" rowSpan={rowSpan}>
                                  {vessel.vesselName}
                                </td>
                                <td className="px-4 py-2 text-sm text-center align-top font-semibold" rowSpan={rowSpan}>
                                  {vessel.totalNCs}
                                </td>
                              </>
                            )}
                            <td className="px-4 py-2 text-sm">{crew.rank}</td>
                            <td className="px-4 py-2 text-sm">{crew.crewMemberName}</td>
                            <td className="px-4 py-2 text-sm">
                              <StatusBadge status={crew.status} />
                            </td>
                            <td className="px-4 py-2 text-center">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewReport(crew.crewRecord)}
                                data-testid={`button-view-report-${crew.crewMemberId}`}
                                className="text-xs"
                              >
                                View Report
                              </Button>
                            </td>
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

      {selectedCrewRecord && (
        <NCReportDialog
          open={ncReportDialogOpen}
          onOpenChange={setNCReportDialogOpen}
          crewRecord={selectedCrewRecord}
          vesselName={vesselNameMap.get(selectedCrewRecord.vesselId) || selectedCrewRecord.vesselId}
        />
      )}
    </>
  );
}
