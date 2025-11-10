import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { NCReportDialog } from './NCReportDialog';
import type { NCReport, RestHoursCrewRecord } from '@shared/schema';

interface VesselNCsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monthValue: string;
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
  complianceMode,
  opaMode,
  vesselIds = [],
}: VesselNCsDialogProps) {
  const [selectedCrewRecord, setSelectedCrewRecord] = useState<RestHoursCrewRecord | null>(null);
  const [ncReportDialogOpen, setNCReportDialogOpen] = useState(false);

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
      const response = await fetch(url, { credentials: 'include' });
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

  // Get crew IDs that have NCs
  const crewIdsWithNCs = useMemo(() => {
    return crewSummaries
      .filter(crew => crew.totalNCs > 0)
      .map(crew => crew.crewMemberId);
  }, [crewSummaries]);

  // Fetch NC reports for crew with NCs
  const { data: allNCReports = [], isLoading: isLoadingNCs } = useQuery<NCReport[]>({
    queryKey: ['/api/nc-reports'],
    queryFn: async () => {
      const response = await fetch('/api/nc-reports', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch NC reports');
      return response.json();
    },
    enabled: open && crewIdsWithNCs.length > 0,
  });

  // Group NCs by vessel
  const vesselGroups = useMemo(() => {
    const groups = new Map<string, VesselNCGroup>();

    // Filter crew summaries to only those with NCs
    const crewWithNCs = crewSummaries.filter(crew => crew.totalNCs > 0);

    // Create NC reports map for quick lookup
    const ncReportsMap = new Map<string, NCReport>();
    allNCReports
      .filter(report => report.monthValue === monthValue)
      .forEach(report => {
        const key = `${report.crewMemberId}-${report.vesselId}-${report.monthValue}`;
        ncReportsMap.set(key, report);
      });

    // Process each crew member with NCs
    crewWithNCs.forEach(crew => {
      const vesselId = crew.vesselId;
      const vesselName = vesselNameMap.get(vesselId) || vesselId;
      const ncReportKey = `${crew.crewMemberId}-${crew.vesselId}-${monthValue}`;
      const ncReport = ncReportsMap.get(ncReportKey) || null;

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
        vesselId: crew.vesselId,
        status: (ncReport?.status as any) || 'Open',
        ncReport,
        crewRecord: crew,
      });
    });

    // Convert to array and sort by vessel name
    return Array.from(groups.values()).sort((a, b) => 
      a.vesselName.localeCompare(b.vesselName)
    );
  }, [crewSummaries, allNCReports, monthValue, vesselNameMap]);

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

  const isLoading = isLoadingSummaries || isLoadingNCs;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              NCs - Vessel Count - {formatMonth(monthValue)}
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
                      <th className="px-4 py-2 text-left text-sm font-semibold">View Report</th>
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
                            <td className="px-4 py-2 text-sm">
                              <Button
                                variant="link"
                                size="sm"
                                className="p-0 h-auto text-blue-600 hover:text-blue-800"
                                onClick={() => handleViewReport(crew.crewRecord)}
                                data-testid={`button-view-report-${crew.crewMemberId}`}
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
