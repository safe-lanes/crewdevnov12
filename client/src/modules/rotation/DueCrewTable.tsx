import type { FC } from 'react';
import { useMemo, useRef, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import AgGridTable from '@/components/AgGrid/AgGridTable';
import type { ColDef, ICellRendererParams, IHeaderParams } from 'ag-grid-community';
import { format, addMonths, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';
import { useRankNormalization, addRankAliasesToMap } from '@/hooks/useRankNormalization';

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
          className="absolute h-6 z-10"
          style={{
            left: `${greenStartPct}%`,
            width: `${greenEndPct - greenStartPct}%`,
            top: '50%',
            transform: 'translateY(-50%)',
            backgroundColor: 'rgba(2, 169, 33, 0.6)',
          }}
        />
      )}
      
      {/* Yellow bar (Contract End to Range End) */}
      {yellowEndPct > greenEndPct && (
        <div
          className="absolute h-6 z-10"
          style={{
            left: `${greenEndPct}%`,
            width: `${yellowEndPct - greenEndPct}%`,
            top: '50%',
            transform: 'translateY(-50%)',
            backgroundColor: 'rgba(241, 205, 29, 0.6)',
          }}
        />
      )}
      
      {/* Pink bar (After Range End - overdue) */}
      {isOverdue && pinkEndPct > pinkStartPct && (
        <div
          className="absolute h-6 z-10"
          style={{
            left: `${pinkStartPct}%`,
            width: `${pinkEndPct - pinkStartPct}%`,
            top: '50%',
            transform: 'translateY(-50%)',
            backgroundColor: 'rgba(229, 78, 96, 0.6)',
          }}
        />
      )}
      
      {/* Today's vertical line (orange) */}
      <div
        className="absolute top-0 bottom-0 z-20"
        style={{
          left: `${todayPct}%`,
          width: '2px',
          backgroundColor: '#f59e0b',
        }}
      />
    </div>
  );
};

// Timeline Header Component - renders month labels
const TimelineHeaderComponent = (params: IHeaderParams) => {
  const { today, startDate, endDate, totalDays } = useMemo(() => getTimelineRange(), []);
  const monthsData = useMemo(() => getMonthsData(startDate, endDate, totalDays), [startDate, endDate, totalDays]);
  const todayPct = clamp((differenceInDays(today, startDate) / totalDays) * 100);
  
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
      {/* Today's vertical line (orange) in header */}
      <div
        className="absolute top-0 bottom-0 z-20"
        style={{
          left: `${todayPct}%`,
          width: '2px',
          backgroundColor: '#f59e0b',
        }}
      />
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
  const { filterCrewWithVariants, getCanonicalRankName } = useRankNormalization();
  
  const { data: rawCrewData = [], isLoading } = useDueCrew({
    filterType,
    selectedVessels,
    fleetValue,
    addGroupValue,
    dueInValue,
    rankValue,
  });
  
  // Fetch available ranks to get sortOrder
  const { data: availableRanks = [] } = useQuery<any[]>({
    queryKey: ['/api/available-ranks'],
  });
  
  // Create a map of rank name to sortOrder for sorting (includes aliases)
  const rankOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    availableRanks.forEach((rank: any) => {
      addRankAliasesToMap(map, rank.name, rank.sortOrder || 0);
    });
    return map;
  }, [availableRanks]);
  
  // Helper to get sortOrder with fallback for unknown ranks
  const getRankSortOrder = (rankName: string | null | undefined): number => {
    if (!rankName) return 999999;
    // First try exact match
    const exact = rankOrderMap.get(rankName);
    if (exact !== undefined) return exact;
    // Try base rank (strip suffix like _1, _2)
    const baseRank = rankName.split('_')[0];
    const base = rankOrderMap.get(baseRank);
    if (base !== undefined) return base;
    // Try canonical name (e.g., "2nd Officer" -> "Second Officer")
    const canonical = getCanonicalRankName(rankName);
    const canonicalOrder = rankOrderMap.get(canonical);
    if (canonicalOrder !== undefined) return canonicalOrder;
    // Fallback: unknown rank goes to end
    return 999999;
  };
  
  // Filter and sort crew data (exclude base ranks when variants exist)
  const crewData = useMemo(() => {
    const filtered = filterCrewWithVariants(rawCrewData, (crew: CrewMember) => crew.rank || '');
    return filtered.sort((a, b) => {
      const aOrder = getRankSortOrder(a.rank);
      const bOrder = getRankSortOrder(b.rank);
      if (aOrder !== bOrder) return aOrder - bOrder;
      // Secondary sort: if same sortOrder, sort by suffix number (e.g., _1 before _2)
      const aSuffix = a.rank?.includes('_') ? parseInt(a.rank.split('_')[1]) || 0 : 0;
      const bSuffix = b.rank?.includes('_') ? parseInt(b.rank.split('_')[1]) || 0 : 0;
      return aSuffix - bSuffix;
    });
  }, [rawCrewData, filterCrewWithVariants, rankOrderMap]);

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

  const containerRef = useRef<HTMLDivElement>(null);

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
    <div ref={containerRef} className="h-[calc(100vh-280px)] bg-white rounded-bl-lg border border-gray-200 overflow-hidden">
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
