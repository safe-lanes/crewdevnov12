import { useRef, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { RestHoursCrewRecord } from '@shared/schema';
import { RHRecordingForm } from './RHRecordingForm';
import { ViolationsDetailDialog } from './ViolationsDetailDialog';
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
  const isZero = percent === 0;
  // Grey for 0%, green for 100%, yellow for in-progress
  const bgColor = isZero ? '#9CA3AF' : isComplete ? '#22C55E' : '#EAB308';
  
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
  const value = params.value ?? 0;
  // Normalize to number to handle both numeric and string zeroes
  const isZero = Number(value) === 0;

  // Return empty div with preserved alignment for zero values
  if (isZero) {
    return <div className="flex items-center justify-center h-full py-2"></div>;
  }

  return (
    <div className="flex items-center justify-center h-full py-2">
      <span 
        className="px-3 py-1.5 rounded font-semibold min-w-[32px] text-center bg-pink-100 text-red-600" 
        style={{ fontSize: '13px' }}
      >
        {value}
      </span>
    </div>
  );
};

const PredictedBadgeRenderer = (params: ICellRendererParams) => {
  const value = params.value ?? 0;
  // Normalize to number to handle both numeric and string zeroes
  const isZero = Number(value) === 0;

  // Return empty div with preserved alignment for zero values
  if (isZero) {
    return <div className="flex items-center justify-center h-full py-2"></div>;
  }

  return (
    <div className="flex items-center justify-center h-full py-2">
      <span 
        className="px-3 py-1.5 rounded font-semibold min-w-[32px] text-center bg-gray-200 text-gray-700" 
        style={{ fontSize: '13px' }}
      >
        {value}
      </span>
    </div>
  );
};

const ViolationsWithDatesRenderer = (params: ICellRendererParams) => {
  const value = params.value ?? 0;
  const violationDatesJson = params.data?.violationDates;
  
  let violationDates: number[] = [];
  try {
    if (violationDatesJson) {
      violationDates = JSON.parse(violationDatesJson);
    }
  } catch (e) {
    console.error('Failed to parse violation dates:', e);
  }
  
  // Format dates with ordinal suffixes (1st, 2nd, 3rd, etc.)
  const formatDate = (day: number): string => {
    const suffix = ['th', 'st', 'nd', 'rd'];
    const v = day % 100;
    return day + (suffix[(v - 20) % 10] || suffix[v] || suffix[0]);
  };

  const handleClick = () => {
    if (params.context && params.context.onViewViolations) {
      params.context.onViewViolations(params.data);
    }
  };

  // Normalize to number to handle both numeric and string zeroes
  const isZero = Number(value) === 0;

  // Return empty div with preserved alignment for zero values
  if (isZero) {
    return <div className="flex items-center justify-center h-full py-2"></div>;
  }

  // Show tooltip if we have violation dates
  if (violationDates.length > 0) {
    return (
      <div className="flex items-center justify-center h-full py-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span 
                className="px-3 py-1.5 rounded font-semibold min-w-[32px] text-center bg-pink-100 text-red-600 cursor-pointer hover:bg-pink-200 transition-colors" 
                style={{ fontSize: '13px' }}
                onClick={handleClick}
              >
                {value}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <div className="text-sm">
                <div className="font-semibold mb-1">Violation Dates:</div>
                <div className="text-xs">
                  {violationDates.map(formatDate).join(', ')}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full py-2">
      <span 
        className="px-3 py-1.5 rounded font-semibold min-w-[32px] text-center bg-pink-100 text-red-600 cursor-pointer hover:bg-pink-200 transition-colors" 
        style={{ fontSize: '13px' }}
        onClick={handleClick}
      >
        {value}
      </span>
    </div>
  );
};

const PredictedViolationsWithDatesRenderer = (params: ICellRendererParams) => {
  const value = params.value ?? 0;
  const predictedDatesJson = params.data?.predictedViolationDates;
  
  let predictedDates: number[] = [];
  try {
    if (predictedDatesJson) {
      predictedDates = JSON.parse(predictedDatesJson);
    }
  } catch (e) {
    console.error('Failed to parse predicted violation dates:', e);
  }
  
  // Format dates with ordinal suffixes (1st, 2nd, 3rd, etc.)
  const formatDate = (day: number): string => {
    const suffix = ['th', 'st', 'nd', 'rd'];
    const v = day % 100;
    return day + (suffix[(v - 20) % 10] || suffix[v] || suffix[0]);
  };

  // Click handler to open predicted violations detail dialog
  const handleClick = () => {
    if (params.context && params.context.onViewPredictedViolations) {
      params.context.onViewPredictedViolations(params.data);
    }
  };

  // Normalize to number to handle both numeric and string zeroes
  const isZero = Number(value) === 0;

  // Return empty div with preserved alignment for zero values
  if (isZero) {
    return <div className="flex items-center justify-center h-full py-2"></div>;
  }

  // Show tooltip if we have predicted violation dates
  if (predictedDates.length > 0) {
    return (
      <div className="flex items-center justify-center h-full py-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span 
                className="px-3 py-1.5 rounded font-semibold min-w-[32px] text-center bg-gray-200 text-gray-700 cursor-pointer hover:bg-gray-300 transition-colors" 
                style={{ fontSize: '13px' }}
                onClick={handleClick}
              >
                {value}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <div className="text-sm">
                <div className="font-semibold mb-1">Predicted Violation Dates:</div>
                <div className="text-xs">
                  {predictedDates.map(formatDate).join(', ')}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full py-2">
      <span 
        className="px-3 py-1.5 rounded font-semibold min-w-[32px] text-center bg-gray-200 text-gray-700 cursor-pointer hover:bg-gray-300 transition-colors" 
        style={{ fontSize: '13px' }}
        onClick={handleClick}
      >
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
  const [violationsDialogOpen, setViolationsDialogOpen] = useState(false);
  const [selectedViolationsRecord, setSelectedViolationsRecord] = useState<RestHoursCrewRecord | null>(null);
  const [predictedViolationsDialogOpen, setPredictedViolationsDialogOpen] = useState(false);
  const [selectedPredictedViolationsRecord, setSelectedPredictedViolationsRecord] = useState<RestHoursCrewRecord | null>(null);

  // Handler for opening the recording form
  const handleEditRecord = (record: RestHoursCrewRecord) => {
    setSelectedRecord(record);
    setFormOpen(true);
  };

  // Handler for opening the violations detail dialog
  const handleViewViolations = (record: RestHoursCrewRecord) => {
    setSelectedViolationsRecord(record);
    setViolationsDialogOpen(true);
  };

  // Handler for opening the predicted violations detail dialog
  const handleViewPredictedViolations = (record: RestHoursCrewRecord) => {
    setSelectedPredictedViolationsRecord(record);
    setPredictedViolationsDialogOpen(true);
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
  queryParams.append('complianceMode', complianceMode);
  queryParams.append('opaMode', String(opaMode));

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
      flex: 2,
      minWidth: 130,
      pinned: 'left',
      cellStyle: { fontWeight: 500, fontSize: '13px', display: 'flex', alignItems: 'center' } as any
    },
    {
      headerName: 'Name',
      field: 'name',
      flex: 2.5,
      minWidth: 150,
      cellStyle: { fontSize: '13px', display: 'flex', alignItems: 'center' } as any
    },
    {
      headerName: 'Month',
      field: 'month',
      flex: 1.5,
      minWidth: 100,
      cellStyle: { fontSize: '13px', display: 'flex', alignItems: 'center' } as any
    },
    {
      headerName: 'S.On/Off',
      field: 'signOnOffInfo',
      flex: 1.5,
      minWidth: 110,
      cellStyle: { fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center' } as any,
      headerTooltip: 'S.On or S.Off with Role'
    },
    {
      headerName: 'Status',
      field: 'recordingStatusPercent',
      flex: 2,
      minWidth: 150,
      cellRenderer: ProgressBarRenderer,
      headerTooltip: 'Recording Status',
      cellClass: 'ag-cell-center'
    },
    {
      headerName: 'Activity Conflicts',
      field: 'activityConflicting',
      flex: 1.5,
      minWidth: 110,
      cellRenderer: YesNoRenderer,
      headerTooltip: 'Activity conflicting with actual recording',
      cellClass: 'ag-cell-center'
    },
    {
      headerName: 'Violations',
      field: 'totalViolations',
      flex: 1.5,
      minWidth: 110,
      cellRenderer: ViolationsWithDatesRenderer,
      headerTooltip: 'Total Violations',
      cellClass: 'ag-cell-center'
    },
    {
      headerName: 'NCs',
      field: 'totalNCs',
      flex: 1,
      minWidth: 90,
      cellRenderer: BadgeRenderer,
      headerTooltip: 'Total NCs',
      cellClass: 'ag-cell-center'
    },
    {
      headerName: 'Pred. Violations',
      field: 'predictedViolations',
      flex: 1.5,
      minWidth: 110,
      cellRenderer: PredictedViolationsWithDatesRenderer,
      headerTooltip: 'Predicted Violations',
      cellClass: 'ag-cell-center'
    },
    {
      headerName: 'Pred. NCs',
      field: 'predictedNCs',
      flex: 1,
      minWidth: 100,
      cellRenderer: PredictedBadgeRenderer,
      headerTooltip: 'Predicted NCs',
      cellClass: 'ag-cell-center'
    },
    {
      headerName: 'Actions',
      flex: 1,
      minWidth: 80,
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
          context={{ onEditRecord: handleEditRecord, onViewViolations: handleViewViolations, onViewPredictedViolations: handleViewPredictedViolations }}
          animateRows={true}
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

      {selectedViolationsRecord && (
        <ViolationsDetailDialog
          key={`violations-${selectedViolationsRecord.crewMemberId}-${selectedViolationsRecord.vesselId}-${selectedViolationsRecord.monthValue}`}
          open={violationsDialogOpen}
          onOpenChange={setViolationsDialogOpen}
          crewMemberId={selectedViolationsRecord.crewMemberId}
          crewMemberName={selectedViolationsRecord.name}
          vesselId={selectedViolationsRecord.vesselId}
          monthValue={selectedViolationsRecord.monthValue}
          complianceMode={complianceMode}
          opaMode={opaMode}
          isPredicted={false}
        />
      )}

      {selectedPredictedViolationsRecord && (
        <ViolationsDetailDialog
          key={`predicted-violations-${selectedPredictedViolationsRecord.crewMemberId}-${selectedPredictedViolationsRecord.vesselId}-${selectedPredictedViolationsRecord.monthValue}`}
          open={predictedViolationsDialogOpen}
          onOpenChange={setPredictedViolationsDialogOpen}
          crewMemberId={selectedPredictedViolationsRecord.crewMemberId}
          crewMemberName={selectedPredictedViolationsRecord.name}
          vesselId={selectedPredictedViolationsRecord.vesselId}
          monthValue={selectedPredictedViolationsRecord.monthValue}
          complianceMode={complianceMode}
          opaMode={opaMode}
          isPredicted={true}
        />
      )}
    </>
  );
}
