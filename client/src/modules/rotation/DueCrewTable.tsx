import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import AgGridTable from '@/components/AgGrid/AgGridTable';
import { ColDef } from 'ag-grid-community';
import { format, addMonths, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';

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

// Custom Timeline Component - Split into header, body, and footer sections
const TimelineView: React.FC<{ 
  rowData: CrewMember[]; 
  rowHeight: number;
  scrollTop: number;
  headerHeight: number;
  paginationHeight: number;
}> = ({ rowData, rowHeight, scrollTop, headerHeight, paginationHeight }) => {
  const headerCanvasRef = useRef<HTMLCanvasElement>(null);
  const bodyCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, bodyHeight: 400 });
  
  // Calculate 7-month window (2 months before today + today + 5 months after today)
  const today = useMemo(() => new Date(), []);
  const startDate = useMemo(() => addMonths(today, -2), [today]);
  const endDate = useMemo(() => addMonths(today, 5), [today]);
  const totalDays = useMemo(() => differenceInDays(endDate, startDate), [startDate, endDate]);
  
  // Resize canvas to match container - batch state updates to prevent re-render loops
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const newWidth = Math.max(100, rect.width);
        // Body height = container height - header - pagination footer
        const newBodyHeight = Math.max(100, rect.height - headerHeight - paginationHeight);
        
        setDimensions(prev => {
          // Only update if values actually changed (avoid unnecessary re-renders)
          if (Math.abs(prev.width - newWidth) > 1 || Math.abs(prev.bodyHeight - newBodyHeight) > 1) {
            return { width: newWidth, bodyHeight: newBodyHeight };
          }
          return prev;
        });
      }
    };
    
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [headerHeight, paginationHeight]);
  
  const containerWidth = dimensions.width;
  const bodyHeight = dimensions.bodyHeight;
  
  // Generate month headers with day-based positioning (using stable totalDays)
  const monthsData = useMemo(() => {
    const result: { label: string; startRatio: number; endRatio: number; }[] = [];
    let current = startOfMonth(startDate);
    const timelineEnd = endOfMonth(endDate);
    
    while (current <= timelineEnd) {
      const monthStart = current < startDate ? startDate : current;
      const monthEnd = endOfMonth(current) > endDate ? endDate : endOfMonth(current);
      
      // Store ratios instead of pixel positions (stable across width changes)
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
  }, [startDate, endDate, totalDays]);

  // Draw header canvas
  useEffect(() => {
    const canvas = headerCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = containerWidth;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, headerHeight);
    
    // Draw month headers background - match AG Grid blue styling
    ctx.fillStyle = '#52baf3';
    ctx.fillRect(0, 0, width, headerHeight);
    
    // Draw month headers with day-based positioning
    ctx.fillStyle = 'white';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    
    monthsData.forEach((month) => {
      const startX = month.startRatio * width;
      const endX = month.endRatio * width;
      const centerX = (startX + endX) / 2;
      ctx.fillText(month.label, centerX, headerHeight / 2 + 4);
      
      // Draw vertical separator at month start
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(startX, 0);
      ctx.lineTo(startX, headerHeight);
      ctx.stroke();
    });
  }, [monthsData, containerWidth, headerHeight]);

  // Draw body canvas with timeline bars
  useEffect(() => {
    const canvas = bodyCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = containerWidth;
    const height = bodyHeight;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Fill white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    // Calculate today's X position
    const todayX = (differenceInDays(today, startDate) / totalDays) * width;
    
    // Draw vertical month separator lines in body
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    monthsData.forEach((month) => {
      const startX = month.startRatio * width;
      ctx.beginPath();
      ctx.moveTo(startX, 0);
      ctx.lineTo(startX, height);
      ctx.stroke();
    });
    
    // Draw timeline bars for each crew member
    for (let i = 0; i < rowData.length; i++) {
      const crew = rowData[i];
      if (!crew) continue;
      
      const y = (i * rowHeight) - scrollTop;
      
      // Skip rows outside visible area
      if (y + rowHeight < 0 || y > height) continue;
      
      // Draw row background (white)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, y, width, rowHeight);
      
      // Draw horizontal row divider line at bottom of row
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y + rowHeight - 0.5);
      ctx.lineTo(width, y + rowHeight - 0.5);
      ctx.stroke();
      
      // Parse dates
      const contractStart = new Date(crew.contractStartDate);
      const contractEnd = new Date(crew.contractEndDate);
      const rangeEnd = new Date(crew.rangeEndDate);
      
      // Calculate positions
      const greenStart = Math.max(0, (differenceInDays(contractStart, startDate) / totalDays) * width);
      const greenEnd = Math.max(0, (differenceInDays(contractEnd, startDate) / totalDays) * width);
      const yellowEnd = Math.max(0, (differenceInDays(rangeEnd, startDate) / totalDays) * width);
      
      const barY = y + (rowHeight - 20) / 2;
      const barHeight = 20;
      
      // Draw green bar (Contract Start to Contract End)
      if (greenEnd > greenStart) {
        ctx.fillStyle = 'rgba(2, 169, 33, 0.5)';
        ctx.fillRect(greenStart, barY, greenEnd - greenStart, barHeight);
      }
      
      // Draw yellow bar (Contract End to Range End)
      if (yellowEnd > greenEnd) {
        ctx.fillStyle = 'rgba(241, 205, 29, 0.5)';
        ctx.fillRect(greenEnd, barY, yellowEnd - greenEnd, barHeight);
      }
      
      // Draw pink bar (After Range End) - only if overdue
      if (rangeEnd < today) {
        const pinkStart = yellowEnd;
        const pinkEnd = todayX;
        if (pinkEnd > pinkStart) {
          ctx.fillStyle = 'rgba(229, 78, 96, 0.5)';
          ctx.fillRect(pinkStart, barY, pinkEnd - pinkStart, barHeight);
        }
      }
    }
    
    // Draw "today" vertical line on top of all bars
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(todayX, 0);
    ctx.lineTo(todayX, height);
    ctx.stroke();
  }, [rowData, scrollTop, rowHeight, monthsData, today, startDate, totalDays, containerWidth, bodyHeight]);

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col">
      {/* Header section - fixed height matching AG Grid header */}
      <div className="flex-none" style={{ height: headerHeight }}>
        <canvas
          ref={headerCanvasRef}
          width={containerWidth}
          height={headerHeight}
          className="block"
        />
      </div>
      
      {/* Body section - flexible height for timeline bars */}
      <div className="flex-1 overflow-hidden" style={{ height: bodyHeight }}>
        <canvas
          ref={bodyCanvasRef}
          width={containerWidth}
          height={bodyHeight}
          className="block"
        />
      </div>
      
      {/* Footer section - fixed height matching AG Grid pagination */}
      <div className="flex-none bg-gray-50 border-t border-gray-200" style={{ height: paginationHeight }} />
    </div>
  );
};

export const DueCrewTable: React.FC<DueCrewTableProps> = ({
  filterType,
  selectedVessels,
  fleetValue,
  addGroupValue,
  dueInValue,
  rankValue,
}) => {
  const [gridScrollTop, setGridScrollTop] = useState(0);
  const [displayedRowData, setDisplayedRowData] = useState<CrewMember[]>([]);
  const [paginationHeight, setPaginationHeight] = useState(48); // Default pagination height
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const gridApiRef = useRef<any>(null);
  const gridBodyRef = useRef<HTMLElement | null>(null);
  
  const HEADER_HEIGHT = 48; // AG Grid header height
  
  const { data: crewData = [], isLoading } = useDueCrew({
    filterType,
    selectedVessels,
    fleetValue,
    addGroupValue,
    dueInValue,
    rankValue,
  });

  const columnDefs: ColDef[] = useMemo(() => [
    {
      headerName: 'Vessel',
      field: 'vessel',
      width: 180,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      sortable: true,
      resizable: false,
    },
    {
      headerName: 'Rank',
      field: 'rank',
      width: 120,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      sortable: true,
      resizable: false,
    },
    {
      headerName: 'Name',
      field: 'name',
      width: 180,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      sortable: true,
      resizable: false,
    },
    {
      headerName: 'Relief Due',
      field: 'reliefDue',
      width: 140,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      sortable: true,
      resizable: false,
      valueFormatter: (params) => {
        // Defensive guard for AG Grid initialization
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
  ], []);

  // Memoize gridOptions to prevent recreating on each render (avoids infinite loops)
  const gridOptionsConfig = useMemo(() => ({
    rowHeight: 48,
    headerHeight: 48,
    suppressMovableColumns: true,
    suppressHorizontalScroll: true,
    domLayout: 'normal' as const,
    alwaysShowVerticalScroll: true,
    pagination: true,
    paginationPageSize: 50,
    paginationPageSizeSelector: [25, 50, 100],
    getRowId: (params: any) => {
      if (params.data?.id) return params.data.id.toString();
      if (params.node?.rowIndex !== undefined) return `row-${params.node.rowIndex}`;
      return `fallback-${Math.random().toString(36).substring(7)}`;
    },
  }), []);

  // Extract displayed rows from AG Grid (after sorting/filtering/pagination)
  const updateDisplayedRows = useCallback(() => {
    if (!gridApiRef.current || gridApiRef.current.isDestroyed()) return;
    
    const displayedRows: CrewMember[] = [];
    const api = gridApiRef.current;
    
    // With pagination enabled, get only rows on the current page
    if (api.paginationGetPageSize) {
      const pageSize = api.paginationGetPageSize();
      const currentPage = api.paginationGetCurrentPage();
      const startRow = currentPage * pageSize;
      const endRow = startRow + pageSize;
      
      let rowIndex = 0;
      api.forEachNodeAfterFilterAndSort((node: any) => {
        if (node.data && rowIndex >= startRow && rowIndex < endRow) {
          displayedRows.push(node.data);
        }
        rowIndex++;
      });
    } else {
      // Fallback for non-paginated grids
      api.forEachNodeAfterFilterAndSort((node: any) => {
        if (node.data) {
          displayedRows.push(node.data);
        }
      });
    }
    setDisplayedRowData(displayedRows);
  }, []);

  const handleGridReady = useCallback((event: any) => {
    gridApiRef.current = event.api;
    
    // Get reference to the grid body viewport for scroll sync (scoped to this grid container)
    // Also measure the pagination panel height
    setTimeout(() => {
      if (gridContainerRef.current) {
        const gridElement = gridContainerRef.current.querySelector('.ag-body-viewport');
        if (gridElement) {
          gridBodyRef.current = gridElement as HTMLElement;
        }
        
        // Measure pagination panel height
        const paginationPanel = gridContainerRef.current.querySelector('.ag-paging-panel');
        if (paginationPanel) {
          const panelHeight = paginationPanel.getBoundingClientRect().height;
          setPaginationHeight(panelHeight > 0 ? panelHeight : 48);
        }
      }
    }, 100);
    
    // Initial load - set displayed rows
    updateDisplayedRows();
    
    // Listen to body scroll events
    event.api.addEventListener('bodyScroll', () => {
      if (event.api.isDestroyed()) return;
      const verticalRange = event.api.getVerticalPixelRange();
      setGridScrollTop(verticalRange.top);
    });
    
    // Listen to sort changes
    event.api.addEventListener('sortChanged', () => {
      if (event.api.isDestroyed()) return;
      // Use requestAnimationFrame to ensure AG Grid's sort is complete
      requestAnimationFrame(() => {
        updateDisplayedRows();
      });
    });
    
    // Listen to filter changes
    event.api.addEventListener('filterChanged', () => {
      if (event.api.isDestroyed()) return;
      requestAnimationFrame(() => {
        updateDisplayedRows();
      });
    });
    
    // Listen to pagination changes
    event.api.addEventListener('paginationChanged', () => {
      if (event.api.isDestroyed()) return;
      requestAnimationFrame(() => {
        updateDisplayedRows();
        setGridScrollTop(0); // Reset scroll when page changes
      });
    });
  }, [updateDisplayedRows]);
  
  // Update displayed rows when source data changes
  useEffect(() => {
    if (gridApiRef.current && !gridApiRef.current.isDestroyed()) {
      // Small delay to ensure AG Grid has processed the data
      const timeoutId = setTimeout(() => {
        updateDisplayedRows();
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [crewData, updateDisplayedRows]);
  
  // Handle wheel events on timeline container to sync with grid
  const handleTimelineWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    
    // Primary approach: directly manipulate the grid body scroll position
    if (gridBodyRef.current) {
      gridBodyRef.current.scrollTop += e.deltaY;
    } else if (gridApiRef.current && !gridApiRef.current.isDestroyed()) {
      // Fallback: use AG Grid API to scroll by row
      const rowHeight = 48;
      const rowsToScroll = Math.round(e.deltaY / rowHeight);
      const verticalRange = gridApiRef.current.getVerticalPixelRange();
      const currentTopRow = Math.floor(verticalRange.top / rowHeight);
      const targetRow = Math.max(0, currentTopRow + rowsToScroll);
      gridApiRef.current.ensureIndexVisible(targetRow, 'top');
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96 bg-white rounded-lg border border-gray-200">
        <p className="text-gray-500 text-sm">Loading crew data...</p>
      </div>
    );
  }

  return (
    <div className="flex gap-0 h-[calc(100vh-280px)] bg-white rounded-bl-lg border border-gray-200 overflow-hidden">
      {/* Left section: AG Grid */}
      <div ref={gridContainerRef} className="flex-none w-[620px] h-full border-r border-gray-200 overflow-hidden">
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
      
      {/* Right section: Timeline */}
      <div 
        ref={timelineContainerRef}
        className="flex-1 overflow-hidden"
        style={{ overflow: 'hidden' }}
        onWheel={handleTimelineWheel}
      >
        <TimelineView 
          rowData={displayedRowData} 
          rowHeight={48}
          scrollTop={gridScrollTop}
          headerHeight={HEADER_HEIGHT}
          paginationHeight={paginationHeight}
        />
      </div>
    </div>
  );
};
