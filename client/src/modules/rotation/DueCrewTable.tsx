import type { FC } from 'react';
import { useMemo, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import AgGridTable from '@/components/AgGrid/AgGridTable';
import type { ColDef, ICellRendererParams, IHeaderParams } from 'ag-grid-community';
import { format, addMonths, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';

// Utility to clamp values between 0 and 100 for percentage positioning
const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

interface DueCrewTableProps {
  filterType: "vessel" | "fleet" | "addGroup";
  selectedVessels: string[];
  fleetValue: string;
  addGroupValue: string;
  dueInValue: string;
  rankValue: string;
}

interface CrewMember {
  id: string;
  vessel: string;
  rank: string;
  name: string;
  reliefDue: string;
  contractStartDate: string;
  contractEndDate: string;
  rangeStartDate: string;
  rangeEndDate: string;
  nationality: string;
}

// Calculate timeline date range (shared between header and cells)
const getTimelineRange = () => {
  const today = new Date();
  const startDate = addMonths(today, -2);
  const endDate = addMonths(today, 5);
  const totalDays = differenceInDays(endDate, startDate);
  return { today, startDate, endDate, totalDays };
};

// Generate month data for header
const getMonthsData = (startDate: Date, endDate: Date, totalDays: number) => {
  const result: { label: string; startRatio: number; endRatio: number }[] = [];
  let current = startOfMonth(startDate);
  const timelineEnd = endOfMonth(endDate);
  
  while (current <= timelineEnd) {
    const monthStart = current < startDate ? startDate : current;
    const monthEnd = endOfMonth(current) > endDate ? endDate : endOfMonth(current);
    
    const startRatio = differenceInDays(monthStart, startDate) / totalDays;
    const endRatio = differenceInDays(monthEnd, startDate) / totalDays;
    
    result.push({
      label: format(current, 'MMM'),
      startRatio,
      endRatio,
    });
    current = addMonths(current, 1);
  }
  return result;
};

// Timeline Cell Renderer - renders a single row's timeline bar
const TimelineCellRenderer = (params: ICellRendererParams<CrewMember>) => {
  const { today, startDate, totalDays } = useMemo(() => getTimelineRange(), []);
  const monthsData = useMemo(() => {
    const { startDate, endDate, totalDays } = getTimelineRange();
    return getMonthsData(startDate, endDate, totalDays);
  }, []);
  
  if (!params.data) return null;
  
  const crew = params.data;
  const contractStart = crew.contractStartDate ? new Date(crew.contractStartDate) : null;
  const contractEnd = crew.contractEndDate ? new Date(crew.contractEndDate) : null;
  const rangeEnd = crew.rangeEndDate ? new Date(crew.rangeEndDate) : null;
  
  // Debug: log data for first row
  if (params.node?.rowIndex === 0) {
    console.log('Timeline Debug:', {
      name: crew.name,
      contractStartDate: crew.contractStartDate,
      contractEndDate: crew.contractEndDate,
      rangeEndDate: crew.rangeEndDate,
      startDate: startDate.toISOString(),
      totalDays,
    });
  }
  
  // If no valid dates, show empty timeline
  if (!contractStart || !contractEnd || !rangeEnd) {
    return (
      <div className="relative w-full h-full bg-gray-50 flex items-center">
        <span className="text-xs text-gray-400 ml-2">No dates</span>
      </div>
    );
  }
  
  // Calculate positions as percentages (clamped to 0-100)
  const greenStartPct = clamp((differenceInDays(contractStart, startDate) / totalDays) * 100);
  const greenEndPct = clamp((differenceInDays(contractEnd, startDate) / totalDays) * 100);
  const yellowEndPct = clamp((differenceInDays(rangeEnd, startDate) / totalDays) * 100);
  const todayPct = clamp((differenceInDays(today, startDate) / totalDays) * 100);
  
  // Debug: log percentages for first row
  if (params.node?.rowIndex === 0) {
    console.log('Timeline Percentages:', { greenStartPct, greenEndPct, yellowEndPct, todayPct });
  }
  
  // Calculate pink bar if overdue
  const isOverdue = rangeEnd < today;
  const pinkStartPct = clamp(yellowEndPct);
  const pinkEndPct = clamp(todayPct);
  
  return (
    <div className="relative w-full h-full flex items-center" style={{ minHeight: '40px' }}>
      {/* Month separator lines */}
      {monthsData.map((month, idx) => (
        <div
          key={idx}
          className="absolute top-0 bottom-0 border-l border-gray-200"
          style={{ left: `${month.startRatio * 100}%` }}
        />
      ))}
      
      {/* Green bar (Contract Start to Contract End) */}
      {greenEndPct > greenStartPct && (
        <div
          className="absolute h-6 rounded-sm z-10"
          style={{
            left: `${greenStartPct}%`,
            width: `${greenEndPct - greenStartPct}%`,
            top: '50%',
            transform: 'translateY(-50%)',
            backgroundColor: '#02a921',
            opacity: 0.6,
          }}
        />
      )}
      
      {/* Yellow bar (Contract End to Range End) */}
      {yellowEndPct > greenEndPct && (
        <div
          className="absolute h-6 rounded-sm z-10"
          style={{
            left: `${greenEndPct}%`,
            width: `${yellowEndPct - greenEndPct}%`,
            top: '50%',
            transform: 'translateY(-50%)',
            backgroundColor: '#f1cd1d',
            opacity: 0.6,
          }}
        />
      )}
      
      {/* Pink bar (After Range End - overdue) */}
      {isOverdue && pinkEndPct > pinkStartPct && (
        <div
          className="absolute h-6 rounded-sm z-10"
          style={{
            left: `${pinkStartPct}%`,
            width: `${pinkEndPct - pinkStartPct}%`,
            top: '50%',
            transform: 'translateY(-50%)',
            backgroundColor: '#e54e60',
            opacity: 0.6,
          }}
        />
      )}
      
      {/* Today line */}
      <div
        className="absolute z-20"
        style={{
          left: `${todayPct}%`,
          top: 0,
          bottom: 0,
          width: '3px',
          backgroundColor: '#fbbf24',
        }}
      />
    </div>
  );
};

// Timeline Header Component - renders month labels
const TimelineHeaderComponent = (params: IHeaderParams) => {
  const { startDate, endDate, totalDays } = useMemo(() => getTimelineRange(), []);
  const monthsData = useMemo(() => getMonthsData(startDate, endDate, totalDays), [startDate, endDate, totalDays]);
  
  return (
    <div className="relative w-full h-full bg-[#52baf3] flex items-center">
      {monthsData.map((month, idx) => {
        const widthPct = (month.endRatio - month.startRatio) * 100;
        return (
          <div
            key={idx}
            className="h-full flex items-center justify-center text-white text-xs font-medium border-l border-white/30 first:border-l-0"
            style={{
              width: `${widthPct}%`,
              minWidth: 0,
            }}
          >
            {month.label}
          </div>
        );
      })}
    </div>
  );
};

// Hook to fetch due crew data
const useDueCrew = (filters: any) => {
  const queryParams = new URLSearchParams();
  
  queryParams.append('filterType', filters.filterType);
  
  if (filters.filterType === 'vessel' && filters.selectedVessels.length > 0) {
    filters.selectedVessels.forEach((v: string) => queryParams.append('vessels', v));
  } else if (filters.filterType === 'fleet' && filters.fleetValue) {
    queryParams.append('fleet', filters.fleetValue);
  } else if (filters.filterType === 'addGroup' && filters.addGroupValue) {
    queryParams.append('addGroup', filters.addGroupValue);
  }
  
  if (filters.dueInValue) {
    queryParams.append('dueIn', filters.dueInValue);
  }
  
  if (filters.rankValue) {
    queryParams.append('rank', filters.rankValue);
  }
  
  return useQuery({
    queryKey: ['/api/rotation/due-crew', queryParams.toString()],
    queryFn: () => fetch(`/api/rotation/due-crew?${queryParams.toString()}`).then(res => res.json()),
  });
};

export const DueCrewTable: FC<DueCrewTableProps> = ({
  filterType,
  selectedVessels,
  fleetValue,
  addGroupValue,
  dueInValue,
  rankValue,
}) => {
  const gridApiRef = useRef<any>(null);
  
  const { data: crewData = [], isLoading } = useDueCrew({
    filterType,
    selectedVessels,
    fleetValue,
    addGroupValue,
    dueInValue,
    rankValue,
  });

  // Column definitions with timeline as a pinned right column
  const columnDefs = useMemo((): ColDef<CrewMember>[] => {
    const baseCellStyle = { fontSize: '13px', color: '#4f5863' };
    
    return [
      {
        headerName: 'Vessel',
        field: 'vessel',
        width: 180,
        cellStyle: baseCellStyle,
        sortable: true,
        resizable: false,
      },
      {
        headerName: 'Rank',
        field: 'rank',
        width: 120,
        cellStyle: baseCellStyle,
        sortable: true,
        resizable: false,
      },
      {
        headerName: 'Name',
        field: 'name',
        width: 180,
        cellStyle: baseCellStyle,
        sortable: true,
        resizable: false,
      },
      {
        headerName: 'Relief Due',
        field: 'reliefDue',
        width: 140,
        cellStyle: baseCellStyle,
        sortable: true,
        resizable: false,
        valueFormatter: (params) => {
          if (!params.colDef || !params.data) return '';
          if (!params.value) return '';
          try {
            const date = new Date(params.value);
            return format(date, 'dd-MMM-yyyy');
          } catch {
            return params.value;
          }
        },
      },
      {
        headerName: '',
        colId: 'timeline',
        field: 'timeline' as keyof CrewMember,
        flex: 1,
        minWidth: 400,
        pinned: 'right',
        sortable: false,
        resizable: false,
        cellRenderer: TimelineCellRenderer,
        headerComponent: TimelineHeaderComponent,
        cellStyle: { padding: '0', overflow: 'visible' },
        headerClass: 'timeline-header',
        cellClass: 'timeline-cell',
      },
    ];
  }, []);

  // Grid options with pagination
  const gridOptionsConfig = useMemo(() => ({
    rowHeight: 48,
    headerHeight: 48,
    suppressMovableColumns: true,
    domLayout: 'normal' as const,
    pagination: true,
    paginationPageSize: 50,
    paginationPageSizeSelector: [25, 50, 100],
    getRowId: (params: any) => {
      if (params.data?.id) return params.data.id.toString();
      if (params.node?.rowIndex !== undefined) return `row-${params.node.rowIndex}`;
      return `fallback-${Math.random().toString(36).substring(7)}`;
    },
  }), []);

  const handleGridReady = useCallback((event: any) => {
    gridApiRef.current = event.api;
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96 bg-white rounded-lg border border-gray-200">
        <p className="text-gray-500 text-sm">Loading crew data...</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-280px)] bg-white rounded-bl-lg border border-gray-200 overflow-hidden">
      <AgGridTable
        rowData={crewData}
        columnDefs={columnDefs}
        context={{}}
        onGridReady={handleGridReady}
        height="100%"
        enableExport={false}
        enableSideBar={false}
        enableStatusBar={false}
        gridOptions={gridOptionsConfig}
      />
    </div>
  );
};
