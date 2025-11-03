import { useRef, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RestHoursCrewRecord } from '@shared/schema';
import { RHRecordingForm } from './RHRecordingForm';
import { type ComplianceMode } from './violationFilters';

interface RHCrewRecordsTableProps {
  vesselId?: string;
  monthValue?: string;
  selectedRanks?: string[];
  searchText?: string;
  complianceMode: ComplianceMode;
  opaMode: boolean;
}

const ProgressBarRenderer = (params: ICellRendererParams) => {
  const percent = params.value || 0;
  const isComplete = percent === 100;
  const bgColor = isComplete ? '#22C55E' : '#EAB308';
  
  return (
    <div className="flex items-center h-full w-full px-3 py-2 group relative">
      <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
        <span className="bg-gray-900 text-white px-2 py-1 rounded text-xs font-medium whitespace-nowrap">
          {percent}%
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
        <div
          className="h-2 rounded-full transition-all duration-300"
          style={{ width: `${percent}%`, backgroundColor: bgColor }}
        />
      </div>
    </div>
  );
};

const YesNoRenderer = (params: ICellRendererParams) => {
  const value = params.value;
  if (value == null) return null;

  const isYes = value === true || value === 'Yes';
  return (
    <div className="flex items-center justify-center h-full py-2">
      <span className={`px-3 py-1.5 rounded font-medium ${
        isYes 
          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' 
          : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      }`} style={{ fontSize: '13px' }}>
        {isYes ? 'Yes' : 'No'}
      </span>
    </div>
  );
};

const BadgeRenderer = (params: ICellRendererParams) => {
  const value = params.value;
  if (!value || value === 0) return null;

  return (
    <div className="flex items-center justify-center h-full py-2">
      <span className="px-3 py-1.5 rounded font-semibold bg-pink-100 text-red-600 min-w-[32px] text-center" style={{ fontSize: '13px' }}>
        {value}
      </span>
    </div>
  );
};

const ActionsRenderer = (params: ICellRendererParams) => {
  const handleEdit = () => {
    if (params.context && params.context.onEditRecord) {
      params.context.onEditRecord(params.data);
    }
  };

  return (
    <div className="flex items-center justify-center gap-2 h-full">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 hover:bg-gray-100"
        onClick={handleEdit}
        data-testid={`button-edit-crew-${params.data?.id}`}
      >
        <Edit className="h-4 w-4 text-gray-600" />
      </Button>
    </div>
  );
};

export function RHCrewRecordsTable({ vesselId, monthValue, selectedRanks, searchText, complianceMode, opaMode }: RHCrewRecordsTableProps) {
  const gridRef = useRef<AgGridReact>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<RestHoursCrewRecord | null>(null);

  // Handler for opening the recording form
  const handleEditRecord = (record: RestHoursCrewRecord) => {
    setSelectedRecord(record);
    setFormOpen(true);
  };

  // Fetch available ranks to get sortOrder
  const { data: availableRanks = [] } = useQuery<any[]>({
    queryKey: ['/api/available-ranks'],
  });

  // Create a map of rank name to sortOrder for sorting
  const rankOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    availableRanks.forEach((rank: any) => {
      map.set(rank.name, rank.sortOrder || 0);
    });
    return map;
  }, [availableRanks]);

  // Build query params
  const queryParams = new URLSearchParams();
  if (vesselId) queryParams.append('vesselIds', vesselId);
  if (monthValue) queryParams.append('monthValue', monthValue);
  if (selectedRanks && selectedRanks.length > 0) {
    selectedRanks.forEach(rank => queryParams.append('ranks', rank));
  }
  if (searchText) queryParams.append('search', searchText);

  const { data: rawRecords = [], isLoading } = useQuery<RestHoursCrewRecord[]>({
    queryKey: ['/api/rest-hours-crew-records', queryParams.toString()],
    queryFn: async () => {
      const url = queryParams.toString() 
        ? `/api/rest-hours-crew-records?${queryParams.toString()}`
        : '/api/rest-hours-crew-records';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch crew records');
      return response.json();
    },
  });

  // Sort records by rank order
  const records = useMemo(() => {
    return [...rawRecords].sort((a, b) => {
      // Strip suffix from rank name (e.g., "3rd Officer_1" -> "3rd Officer")
      const aRankBase = a.rank?.split('_')[0] || a.rank;
      const bRankBase = b.rank?.split('_')[0] || b.rank;
      const aOrder = rankOrderMap.get(aRankBase) ?? 999;
      const bOrder = rankOrderMap.get(bRankBase) ?? 999;
      return aOrder - bOrder;
    });
  }, [rawRecords, rankOrderMap]);

  const columnDefs: ColDef[] = useMemo(() => [
    {
      headerName: 'Rank',
      field: 'rank',
      width: 170,
      pinned: 'left',
      cellStyle: { fontWeight: 500, fontSize: '13px', display: 'flex', alignItems: 'center' }
    },
    {
      headerName: 'Name',
      field: 'name',
      width: 200,
      cellStyle: { fontSize: '13px', display: 'flex', alignItems: 'center' }
    },
    {
      headerName: 'Month',
      field: 'month',
      width: 130,
      cellStyle: { fontSize: '13px', display: 'flex', alignItems: 'center' }
    },
    {
      headerName: 'S.On or S.Off with Role',
      field: 'signOnOffInfo',
      width: 150,
      cellStyle: { fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center' }
    },
    {
      headerName: 'Recording Status',
      field: 'recordingStatusPercent',
      width: 200,
      cellRenderer: ProgressBarRenderer,
    },
    {
      headerName: 'Activity conflicting with actual recording',
      field: 'activityConflicting',
      width: 140,
      cellRenderer: YesNoRenderer,
      headerTooltip: 'Indicates conflicts between recorded hours and variable tasks'
    },
    {
      headerName: 'Total Violations',
      field: 'totalViolations',
      width: 140,
      cellRenderer: BadgeRenderer,
    },
    {
      headerName: 'Total NCs',
      field: 'totalNCs',
      width: 120,
      cellRenderer: BadgeRenderer,
    },
    {
      headerName: 'Predicted Violations',
      field: 'predictedViolations',
      width: 150,
      cellStyle: { textAlign: 'center', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center' }
    },
    {
      headerName: 'Predicted NCs',
      field: 'predictedNCs',
      width: 140,
      cellStyle: { textAlign: 'center', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center' }
    },
    {
      headerName: 'Actions',
      width: 100,
      cellRenderer: ActionsRenderer,
      pinned: 'right',
      sortable: false,
      filter: false,
    }
  ], []);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    wrapHeaderText: true,
    autoHeaderHeight: true,
  }), []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        Loading crew records...
      </div>
    );
  }

  return (
    <>
      <div className="ag-theme-alpine w-full" style={{ height: '600px' }}>
        <AgGridReact
          ref={gridRef}
          rowData={records}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          context={{ onEditRecord: handleEditRecord }}
          animateRows={true}
          rowSelection="single"
          pagination={true}
          paginationPageSize={20}
          domLayout="normal"
          rowHeight={56}
        />
      </div>

      {selectedRecord && (
        <RHRecordingForm
          key={`${selectedRecord.crewMemberId}-${selectedRecord.vesselId}-${selectedRecord.monthValue}`}
          open={formOpen}
          onOpenChange={setFormOpen}
          crewMemberId={selectedRecord.crewMemberId}
          crewMemberName={selectedRecord.name}
          vesselId={selectedRecord.vesselId}
          rank={selectedRecord.rank}
          monthValue={selectedRecord.monthValue}
        />
      )}
    </>
  );
}
