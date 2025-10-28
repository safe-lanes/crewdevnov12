import { useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RestHoursVesselRecord } from '@shared/schema';

interface RHRecordsTableProps {
  selectedVessels: string[];
  selectedMonth: string;
}

const ProgressBarRenderer = (params: ICellRendererParams) => {
  const percent = params.value || 0;
  const isComplete = percent === 100;
  const bgColor = isComplete ? '#22C55E' : '#EAB308';
  
  return (
    <div className="flex items-center h-full w-full px-3 py-2">
      <div className="w-full bg-gray-200 rounded-full h-6 dark:bg-gray-700">
        <div
          className="h-6 rounded-full flex items-center justify-center font-medium text-white"
          style={{ width: `${percent}%`, backgroundColor: bgColor, fontSize: '13px' }}
        >
          {percent > 10 && `${percent}%`}
        </div>
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
          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
      }`} style={{ fontSize: '13px' }}>
        {isYes ? 'Yes' : 'No'}
      </span>
    </div>
  );
};

const ViolationsRenderer = (params: ICellRendererParams) => {
  const violations = params.data?.totalViolations || 0;
  const crewCount = params.data?.crewWithViolations || 0;

  if (violations === 0) return null;

  return (
    <div className="flex items-center justify-center gap-3 h-full py-2">
      <span className="px-3 py-1.5 rounded font-semibold bg-pink-100 text-red-600 min-w-[32px] text-center" style={{ fontSize: '13px' }}>
        {violations}
      </span>
      <span className="px-3 py-1.5 rounded font-medium bg-gray-200 text-gray-700 min-w-[32px] text-center" style={{ fontSize: '13px' }}>
        {crewCount}
      </span>
    </div>
  );
};

const NCsRenderer = (params: ICellRendererParams) => {
  const ncs = params.data?.totalNCs || 0;
  const crewCount = params.data?.crewWithNCs || 0;

  if (ncs === 0) return null;

  return (
    <div className="flex items-center justify-center gap-3 h-full py-2">
      <span className="px-3 py-1.5 rounded font-semibold bg-pink-100 text-red-600 min-w-[32px] text-center" style={{ fontSize: '13px' }}>
        {ncs}
      </span>
      <span className="px-3 py-1.5 rounded font-medium bg-gray-200 text-gray-700 min-w-[32px] text-center" style={{ fontSize: '13px' }}>
        {crewCount}
      </span>
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

const ActionsRenderer = (params: ICellRendererParams) => {
  const handleEdit = () => {
    console.log('Edit clicked for record:', params.data);
  };

  return (
    <div className="flex items-center justify-center gap-2 h-full">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 hover:bg-blue-100"
        onClick={handleEdit}
        data-testid={`button-edit-${params.data?.id}`}
      >
        <Pencil className="h-4 w-4 text-blue-600" />
      </Button>
    </div>
  );
};

export function RHRecordsTable({ selectedVessels, selectedMonth }: RHRecordsTableProps) {
  const gridRef = useRef<AgGridReact>(null);

  const { data: records = [], isLoading } = useQuery<RestHoursVesselRecord[]>({
    queryKey: ['/api/rest-hours-vessel-records'],
  });

  const filteredRecords = useMemo(() => {
    let filtered = records;

    // Only filter by month if it's a valid month value (not "older" or empty)
    if (selectedMonth && selectedMonth !== 'older' && selectedMonth !== '') {
      filtered = filtered.filter(r => r.monthValue === selectedMonth);
    }

    if (selectedVessels.length > 0) {
      filtered = filtered.filter(r => selectedVessels.includes(r.vesselName));
    }

    return filtered;
  }, [records, selectedVessels, selectedMonth]);

  const columnDefs: ColDef[] = useMemo(() => [
    {
      headerName: 'Vessel',
      field: 'vesselName',
      width: 170,
      pinned: 'left',
      cellStyle: { fontWeight: 500, fontSize: '13px' }
    },
    {
      headerName: 'Month',
      field: 'month',
      width: 130,
      cellStyle: { fontSize: '13px' }
    },
    {
      headerName: 'Total Crew',
      field: 'totalCrew',
      width: 120,
      cellStyle: { textAlign: 'center', fontSize: '13px' }
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
      headerName: 'Total violations/ No. of crew involved',
      width: 160,
      cellRenderer: ViolationsRenderer,
      valueGetter: (params) => params.data?.totalViolations,
    },
    {
      headerName: 'Total NCs/ No. of crew involved',
      width: 140,
      cellRenderer: NCsRenderer,
      valueGetter: (params) => params.data?.totalNCs,
    },
    {
      headerName: 'Predicted Violations',
      field: 'predictedViolations',
      width: 150,
      cellStyle: { textAlign: 'center', fontSize: '13px' }
    },
    {
      headerName: 'Predicted NCs',
      field: 'predictedNCs',
      width: 140,
      cellStyle: { textAlign: 'center', fontSize: '13px' }
    },
    {
      headerName: 'Office Review',
      field: 'officeReviewStatus',
      width: 150,
      cellRenderer: OfficeReviewRenderer,
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
        Loading rest hours records...
      </div>
    );
  }

  return (
    <div className="ag-theme-alpine w-full" style={{ height: '600px' }}>
      <AgGridReact
        ref={gridRef}
        rowData={filteredRecords}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        animateRows={true}
        rowSelection="single"
        pagination={true}
        paginationPageSize={20}
        domLayout="normal"
        rowHeight={56}
      />
    </div>
  );
}
