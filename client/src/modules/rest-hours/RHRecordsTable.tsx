import { useRef, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { Edit, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { RestHoursVesselRecord } from '@shared/schema';
import { type ComplianceMode } from './violationFilters';
import { ViolationsOverviewDialog } from './ViolationsOverviewDialog';
import { NCOverviewDialog } from './NCOverviewDialog';

interface RHRecordsTableProps {
  selectedVessels: string[];
  selectedMonth: string;
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

const ViolationsRenderer = (params: ICellRendererParams) => {
  const violations = params.data?.totalViolations || 0;
  const crewCount = params.data?.crewWithViolations || 0;
  const crewDetailsJson = params.data?.crewWithViolationsDetails;
  const violationDatesJson = params.data?.violationDates;
  
  let crewDetails: { name: string; rank: string }[] = [];
  let violationDates: number[] = [];
  
  try {
    if (crewDetailsJson) {
      crewDetails = JSON.parse(crewDetailsJson);
    }
  } catch (e) {
    console.error('Failed to parse crew details:', e);
  }
  
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

  // Click handler to open violations detail dialog
  const handleClick = () => {
    if (params.context && params.context.onViewViolations) {
      params.context.onViewViolations(params.data);
    }
  };

  if (violations === 0) return null;

  return (
    <div className="flex items-center justify-center gap-3 h-full py-2">
      {violationDates.length > 0 ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span 
                className="px-3 py-1.5 rounded font-semibold bg-pink-100 text-red-600 min-w-[32px] text-center cursor-pointer hover:bg-pink-200 transition-colors" 
                style={{ fontSize: '13px' }}
                onClick={handleClick}
              >
                {violations}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <div className="text-sm">
                <div className="font-semibold mb-1">Violation Dates:</div>
                <div className="text-xs">
                  {violationDates.map(formatDate).join(', ')}
                </div>
                <div className="text-xs text-gray-500 mt-2 italic">
                  Click to add vessel comments
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <span 
          className="px-3 py-1.5 rounded font-semibold bg-pink-100 text-red-600 min-w-[32px] text-center cursor-pointer hover:bg-pink-200 transition-colors" 
          style={{ fontSize: '13px' }}
          onClick={handleClick}
        >
          {violations}
        </span>
      )}
      {crewDetails.length > 0 ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 cursor-help text-gray-700">
                <Users size={16} className="text-gray-600" />
                <span className="font-medium" style={{ fontSize: '13px' }}>
                  {crewCount}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <div className="text-sm">
                <div className="font-semibold mb-1">Crew with Violations:</div>
                {crewDetails.map((crew, index) => (
                  <div key={index} className="text-xs">
                    {crew.name} - {crew.rank}
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <div className="flex items-center gap-1 text-gray-700">
          <Users size={16} className="text-gray-600" />
          <span className="font-medium" style={{ fontSize: '13px' }}>
            {crewCount}
          </span>
        </div>
      )}
    </div>
  );
};

const NCsRenderer = (params: ICellRendererParams) => {
  const ncs = params.data?.totalNCs || 0;
  const crewCount = params.data?.crewWithNCs || 0;
  const crewDetailsJson = params.data?.crewWithNCsDetails;
  
  let crewDetails: { name: string; rank: string }[] = [];
  
  try {
    if (crewDetailsJson) {
      crewDetails = JSON.parse(crewDetailsJson);
    }
  } catch (e) {
    console.error('Failed to parse crew NCs details:', e);
  }

  // Click handler to open NCs detail dialog
  const handleClick = () => {
    if (params.context && params.context.onViewNCs) {
      params.context.onViewNCs(params.data);
    }
  };

  if (ncs === 0) return null;

  return (
    <div className="flex items-center justify-center gap-3 h-full py-2">
      <span 
        className="px-3 py-1.5 rounded font-semibold bg-pink-100 text-red-600 min-w-[32px] text-center cursor-pointer hover:bg-pink-200 transition-colors" 
        style={{ fontSize: '13px' }}
        onClick={handleClick}
      >
        {ncs}
      </span>
      {crewDetails.length > 0 ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 cursor-help text-gray-700">
                <Users size={16} className="text-gray-600" />
                <span className="font-medium" style={{ fontSize: '13px' }}>
                  {crewCount}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <div className="text-sm">
                <div className="font-semibold mb-1">Crew with NCs:</div>
                {crewDetails.map((crew, index) => (
                  <div key={index} className="text-xs">
                    {crew.name} - {crew.rank}
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <div className="flex items-center gap-1 text-gray-700">
          <Users size={16} className="text-gray-600" />
          <span className="font-medium" style={{ fontSize: '13px' }}>
            {crewCount}
          </span>
        </div>
      )}
    </div>
  );
};

const PredictedNCsRenderer = (params: ICellRendererParams) => {
  const predictedNCs = params.data?.predictedNCs || 0;
  const crewCount = params.data?.crewWithPredictedNCs || 0;
  const crewDetailsJson = params.data?.crewWithPredictedNCsDetails;
  
  let crewDetails: { name: string; rank: string }[] = [];
  
  try {
    if (crewDetailsJson) {
      crewDetails = JSON.parse(crewDetailsJson);
    }
  } catch (e) {
    console.error('Failed to parse crew predicted NCs details:', e);
  }

  // Click handler to open predicted NCs detail dialog
  const handleClick = () => {
    if (params.context && params.context.onViewPredictedNCs) {
      params.context.onViewPredictedNCs(params.data);
    }
  };

  if (predictedNCs === 0) return null;

  return (
    <div className="flex items-center justify-center gap-3 h-full py-2">
      <span 
        className="px-3 py-1.5 rounded font-semibold bg-gray-200 text-gray-700 min-w-[32px] text-center cursor-pointer hover:bg-gray-300 transition-colors" 
        style={{ fontSize: '13px' }}
        onClick={handleClick}
      >
        {predictedNCs}
      </span>
      {crewDetails.length > 0 ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 cursor-help text-gray-700">
                <Users size={16} className="text-gray-600" />
                <span className="font-medium" style={{ fontSize: '13px' }}>
                  {crewCount}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <div className="text-sm">
                <div className="font-semibold mb-1">Crew with Predicted NCs:</div>
                {crewDetails.map((crew, index) => (
                  <div key={index} className="text-xs">
                    {crew.name} - {crew.rank}
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <div className="flex items-center gap-1 text-gray-700">
          <Users size={16} className="text-gray-600" />
          <span className="font-medium" style={{ fontSize: '13px' }}>
            {crewCount}
          </span>
        </div>
      )}
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

const PredictedViolationsRenderer = (params: ICellRendererParams) => {
  const predictedViolations = params.data?.predictedViolations || 0;
  const crewCount = params.data?.crewWithPredictedViolations || 0;
  const crewDetailsJson = params.data?.crewWithPredictedViolationsDetails;
  const predictedDatesJson = params.data?.predictedViolationDates;
  
  let crewDetails: { name: string; rank: string }[] = [];
  let predictedDates: number[] = [];
  
  try {
    if (crewDetailsJson) {
      crewDetails = JSON.parse(crewDetailsJson);
    }
  } catch (e) {
    console.error('Failed to parse predicted crew details:', e);
  }
  
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

  if (predictedViolations === 0) return null;

  return (
    <div className="flex items-center justify-center gap-3 h-full py-2">
      {predictedDates.length > 0 ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span 
                className="px-3 py-1.5 rounded font-semibold bg-gray-200 text-gray-700 min-w-[32px] text-center cursor-pointer hover:bg-gray-300 transition-colors" 
                style={{ fontSize: '13px' }}
                onClick={handleClick}
              >
                {predictedViolations}
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
      ) : (
        <span 
          className="px-3 py-1.5 rounded font-semibold bg-gray-200 text-gray-700 min-w-[32px] text-center cursor-pointer hover:bg-gray-300 transition-colors" 
          style={{ fontSize: '13px' }}
          onClick={handleClick}
        >
          {predictedViolations}
        </span>
      )}
      {crewDetails.length > 0 ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 cursor-help text-gray-700">
                <Users size={16} className="text-gray-600" />
                <span className="font-medium" style={{ fontSize: '13px' }}>
                  {crewCount}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <div className="text-sm">
                <div className="font-semibold mb-1">Crew with Predicted Violations:</div>
                {crewDetails.map((crew, index) => (
                  <div key={index} className="text-xs">
                    {crew.name} - {crew.rank}
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <div className="flex items-center gap-1 text-gray-700">
          <Users size={16} className="text-gray-600" />
          <span className="font-medium" style={{ fontSize: '13px' }}>
            {crewCount}
          </span>
        </div>
      )}
    </div>
  );
};

const OfficeReviewRenderer = (params: ICellRendererParams) => {
  const status = params.value || 'Due';
  
  const getStatusStyles = () => {
    switch (status) {
      case 'Completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Due':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'Overdue':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  return (
    <div className="flex items-center justify-center h-full py-2">
      <span className={`px-4 py-1.5 rounded font-medium ${getStatusStyles()}`} style={{ fontSize: '13px' }}>
        {status}
      </span>
    </div>
  );
};


export function RHRecordsTable({ selectedVessels, selectedMonth, complianceMode, opaMode }: RHRecordsTableProps) {
  const gridRef = useRef<AgGridReact>(null);
  const [, setLocation] = useLocation();
  const [violationsDialogOpen, setViolationsDialogOpen] = useState(false);
  const [selectedViolationsRecord, setSelectedViolationsRecord] = useState<RestHoursVesselRecord | null>(null);
  const [predictedViolationsDialogOpen, setPredictedViolationsDialogOpen] = useState(false);
  const [selectedPredictedViolationsRecord, setSelectedPredictedViolationsRecord] = useState<RestHoursVesselRecord | null>(null);
  const [ncDialogOpen, setNcDialogOpen] = useState(false);
  const [selectedNcRecord, setSelectedNcRecord] = useState<RestHoursVesselRecord | null>(null);
  const [predictedNcDialogOpen, setPredictedNcDialogOpen] = useState(false);
  const [selectedPredictedNcRecord, setSelectedPredictedNcRecord] = useState<RestHoursVesselRecord | null>(null);

  // Build query params for backend
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    // Only pass month if it's a valid value (not "older" or empty)
    if (selectedMonth && selectedMonth !== 'older' && selectedMonth !== '') {
      params.append('monthValue', selectedMonth);
    }
    params.append('complianceMode', complianceMode);
    params.append('opaMode', String(opaMode));
    return params.toString();
  }, [selectedMonth, complianceMode, opaMode]);

  const { data: records = [], isLoading } = useQuery<RestHoursVesselRecord[]>({
    queryKey: ['/api/rest-hours-vessel-records', queryParams],
    queryFn: async () => {
      const url = queryParams 
        ? `/api/rest-hours-vessel-records?${queryParams}`
        : '/api/rest-hours-vessel-records';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch vessel records');
      return response.json();
    },
  });

  const filteredRecords = useMemo(() => {
    let filtered = records;

    // Apply client-side vessel filter
    if (selectedVessels.length > 0) {
      filtered = filtered.filter(r => selectedVessels.includes(r.vesselName));
    }

    return filtered;
  }, [records, selectedVessels]);

  // Handle navigation to vessel overview
  const handleEditRecord = (record: RestHoursVesselRecord) => {
    setLocation(`/rest-hours/vessel/${record.vesselId}/${record.monthValue}`);
  };

  // Handler for opening the violations detail dialog
  const handleViewViolations = (record: RestHoursVesselRecord) => {
    setSelectedViolationsRecord(record);
    setViolationsDialogOpen(true);
  };

  // Handler for opening the predicted violations detail dialog
  const handleViewPredictedViolations = (record: RestHoursVesselRecord) => {
    setSelectedPredictedViolationsRecord(record);
    setPredictedViolationsDialogOpen(true);
  };

  // Handler for opening the NCs detail dialog
  const handleViewNCs = (record: RestHoursVesselRecord) => {
    setSelectedNcRecord(record);
    setNcDialogOpen(true);
  };

  // Handler for opening the predicted NCs detail dialog
  const handleViewPredictedNCs = (record: RestHoursVesselRecord) => {
    setSelectedPredictedNcRecord(record);
    setPredictedNcDialogOpen(true);
  };

  // Actions renderer that uses callback instead of hooks
  const ActionsRenderer = (params: ICellRendererParams) => {
    const handleClick = () => {
      const record = params.data as RestHoursVesselRecord;
      if (record) {
        handleEditRecord(record);
      }
    };

    return (
      <div className="flex items-center justify-center gap-2 h-full">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-gray-100"
          onClick={handleClick}
          data-testid={`button-edit-${params.data?.id}`}
        >
          <Edit className="h-4 w-4 text-gray-600" />
        </Button>
      </div>
    );
  };

  const columnDefs = useMemo<ColDef[]>(() => [
    {
      headerName: 'Vessel',
      field: 'vesselName',
      flex: 2,
      minWidth: 140,
      pinned: 'left' as const,
      cellStyle: { fontWeight: 500, fontSize: '13px', display: 'flex', alignItems: 'center' } as any
    },
    {
      headerName: 'Month',
      field: 'month',
      flex: 1.5,
      minWidth: 100,
      cellStyle: { fontSize: '13px', display: 'flex', alignItems: 'center' } as any
    },
    {
      headerName: 'Total Crew',
      field: 'totalCrew',
      flex: 1,
      minWidth: 90,
      cellStyle: { fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center' } as any
    },
    {
      headerName: 'Status',
      field: 'recordingStatusPercent',
      flex: 2,
      minWidth: 150,
      cellRenderer: ProgressBarRenderer,
      headerTooltip: 'Recording Status'
    },
    {
      headerName: 'Activity Conflicts',
      field: 'activityConflicting',
      flex: 1.5,
      minWidth: 110,
      cellRenderer: YesNoRenderer,
      headerTooltip: 'Activity conflicting with actual recording'
    },
    {
      headerName: 'Violations / Crew',
      flex: 1.5,
      minWidth: 120,
      cellRenderer: ViolationsRenderer,
      valueGetter: (params) => params.data?.totalViolations,
      headerTooltip: 'Total violations / No. of crew involved'
    },
    {
      headerName: 'NCs / Crew',
      flex: 1.2,
      minWidth: 100,
      cellRenderer: NCsRenderer,
      valueGetter: (params) => params.data?.totalNCs,
      headerTooltip: 'Total NCs / No. of crew involved'
    },
    {
      headerName: 'Pred. Violations',
      field: 'predictedViolations',
      flex: 1.5,
      minWidth: 110,
      cellRenderer: PredictedViolationsRenderer,
      headerTooltip: 'Predicted Violations'
    },
    {
      headerName: 'Pred. NCs',
      field: 'predictedNCs',
      flex: 1.2,
      minWidth: 100,
      cellRenderer: PredictedNCsRenderer,
      headerTooltip: 'Predicted NCs / No. of crew involved'
    },
    {
      headerName: 'Office Review',
      field: 'officeReviewStatus',
      flex: 1.5,
      minWidth: 120,
      cellRenderer: OfficeReviewRenderer,
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
        Loading rest hours records...
      </div>
    );
  }

  return (
    <>
      <div className="ag-theme-alpine w-full" style={{ height: '600px' }}>
        <AgGridReact
          ref={gridRef}
          rowData={filteredRecords}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          context={{ 
            onViewViolations: handleViewViolations, 
            onViewPredictedViolations: handleViewPredictedViolations,
            onViewNCs: handleViewNCs,
            onViewPredictedNCs: handleViewPredictedNCs
          }}
          animateRows={true}
          pagination={true}
          paginationPageSize={20}
          domLayout="normal"
          rowHeight={56}
        />
      </div>

      {selectedViolationsRecord && (
        <ViolationsOverviewDialog
          key={`violations-${selectedViolationsRecord.vesselId}-${selectedViolationsRecord.monthValue}`}
          open={violationsDialogOpen}
          onOpenChange={setViolationsDialogOpen}
          vesselId={selectedViolationsRecord.vesselId}
          vesselName={selectedViolationsRecord.vesselName}
          monthValue={selectedViolationsRecord.monthValue}
          complianceMode={complianceMode}
          opaMode={opaMode}
          isPredicted={false}
        />
      )}

      {selectedPredictedViolationsRecord && (
        <ViolationsOverviewDialog
          key={`predicted-violations-${selectedPredictedViolationsRecord.vesselId}-${selectedPredictedViolationsRecord.monthValue}`}
          open={predictedViolationsDialogOpen}
          onOpenChange={setPredictedViolationsDialogOpen}
          vesselId={selectedPredictedViolationsRecord.vesselId}
          vesselName={selectedPredictedViolationsRecord.vesselName}
          monthValue={selectedPredictedViolationsRecord.monthValue}
          complianceMode={complianceMode}
          opaMode={opaMode}
          isPredicted={true}
        />
      )}

      {selectedNcRecord && (
        <NCOverviewDialog
          key={`ncs-${selectedNcRecord.vesselId}-${selectedNcRecord.monthValue}`}
          open={ncDialogOpen}
          onOpenChange={setNcDialogOpen}
          vesselId={selectedNcRecord.vesselId}
          vesselName={selectedNcRecord.vesselName}
          monthValue={selectedNcRecord.monthValue}
          complianceMode={complianceMode}
          opaMode={opaMode}
          isPredicted={false}
        />
      )}

      {selectedPredictedNcRecord && (
        <NCOverviewDialog
          key={`predicted-ncs-${selectedPredictedNcRecord.vesselId}-${selectedPredictedNcRecord.monthValue}`}
          open={predictedNcDialogOpen}
          onOpenChange={setPredictedNcDialogOpen}
          vesselId={selectedPredictedNcRecord.vesselId}
          vesselName={selectedPredictedNcRecord.vesselName}
          monthValue={selectedPredictedNcRecord.monthValue}
          complianceMode={complianceMode}
          opaMode={opaMode}
          isPredicted={true}
        />
      )}
    </>
  );
}
