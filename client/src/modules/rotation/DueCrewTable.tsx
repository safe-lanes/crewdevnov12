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

// Custom Timeline Component
const TimelineView: React.FC<{ 
  rowData: CrewMember[]; 
  rowHeight: number;
  scrollTop: number;
}> = ({ rowData, rowHeight, scrollTop }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Calculate 7-month window (2 months before today + today + 5 months after today)
  const today = useMemo(() => new Date(), []);
  const startDate = useMemo(() => addMonths(today, -2), [today]);
  const endDate = useMemo(() => addMonths(today, 5), [today]);
  const totalDays = useMemo(() => differenceInDays(endDate, startDate), [startDate, endDate]);
  
  // Generate month headers
  const months = useMemo(() => {
    const result = [];
    let current = startOfMonth(startDate);
    while (current <= endOfMonth(endDate)) {
      result.push({
        label: format(current, 'MMM'),
        date: current,
      });
      current = addMonths(current, 1);
    }
    return result;
  }, [startDate, endDate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const headerHeight = 48; // Match AG Grid header height
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw month headers background - match AG Grid neutral styling
    ctx.fillStyle = '#f9fafb'; // Light gray background
    ctx.fillRect(0, 0, width, headerHeight);
    
    // Draw header bottom border
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, headerHeight);
    ctx.lineTo(width, headerHeight);
    ctx.stroke();
    
    // Draw month headers
    ctx.fillStyle = '#374151'; // Dark gray text
    ctx.font = '600 12px sans-serif';
    ctx.textAlign = 'center';
    
    months.forEach((month, idx) => {
      const x = (idx / months.length) * width + (width / months.length / 2);
      ctx.fillText(month.label, x, 30); // Adjusted vertical position for 48px header
    });
    
    // Draw "today" vertical line
    const todayX = ((differenceInDays(today, startDate) / totalDays) * width);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(todayX, headerHeight);
    ctx.lineTo(todayX, height);
    ctx.stroke();
    
    // Draw timeline bars for each crew member
    const visibleStartRow = Math.floor(scrollTop / rowHeight);
    const visibleEndRow = Math.min(
      Math.ceil((scrollTop + height - headerHeight) / rowHeight) + 1,
      rowData.length
    );
    
    for (let i = visibleStartRow; i < visibleEndRow; i++) {
      const crew = rowData[i];
      if (!crew) continue;
      
      const y = headerHeight + (i * rowHeight) - scrollTop;
      
      // Draw horizontal row divider line
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y + rowHeight);
      ctx.lineTo(width, y + rowHeight);
      ctx.stroke();
      
      // Parse dates
      const contractStart = new Date(crew.contractStartDate);
      const contractEnd = new Date(crew.contractEndDate);
      const rangeEnd = new Date(crew.rangeEndDate);
      
      // Calculate positions
      const greenStart = Math.max(0, ((differenceInDays(contractStart, startDate) / totalDays) * width));
      const greenEnd = Math.max(0, ((differenceInDays(contractEnd, startDate) / totalDays) * width));
      const yellowEnd = Math.max(0, ((differenceInDays(rangeEnd, startDate) / totalDays) * width));
      
      const barY = y + (rowHeight - 20) / 2;
      const barHeight = 20;
      
      // Draw green bar (Contract Start to Contract End)
      if (greenEnd > greenStart) {
        ctx.fillStyle = '#10b981';
        ctx.fillRect(greenStart, barY, greenEnd - greenStart, barHeight);
      }
      
      // Draw yellow bar (Contract End to Range End)
      if (yellowEnd > greenEnd) {
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(greenEnd, barY, yellowEnd - greenEnd, barHeight);
      }
      
      // Draw pink bar (After Range End) - only if overdue
      if (rangeEnd < today) {
        const pinkStart = yellowEnd;
        const pinkEnd = todayX;
        if (pinkEnd > pinkStart) {
          ctx.fillStyle = '#f472b6';
          ctx.fillRect(pinkStart, barY, pinkEnd - pinkStart, barHeight);
        }
      }
    }
  }, [rowData, scrollTop, rowHeight, months, today, startDate, endDate, totalDays]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={600}
      className="w-full h-full"
      style={{ display: 'block' }}
    />
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
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const gridApiRef = useRef<any>(null);
  
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
      resizable: true,
    },
    {
      headerName: 'Rank',
      field: 'rank',
      width: 120,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      sortable: true,
      resizable: true,
    },
    {
      headerName: 'Name',
      field: 'name',
      width: 180,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      sortable: true,
      resizable: true,
    },
    {
      headerName: 'Relief Due',
      field: 'reliefDue',
      width: 140,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      sortable: true,
      resizable: true,
      valueFormatter: (params) => {
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

  // Extract displayed rows from AG Grid (after sorting/filtering)
  const updateDisplayedRows = useCallback(() => {
    if (!gridApiRef.current) return;
    
    const displayedRows: CrewMember[] = [];
    gridApiRef.current.forEachNodeAfterFilterAndSort((node: any) => {
      if (node.data) {
        displayedRows.push(node.data);
      }
    });
    setDisplayedRowData(displayedRows);
  }, []);

  const handleGridReady = useCallback((event: any) => {
    gridApiRef.current = event.api;
    
    // Initial load - set displayed rows
    updateDisplayedRows();
    
    // Listen to body scroll events
    event.api.addEventListener('bodyScroll', () => {
      const verticalRange = event.api.getVerticalPixelRange();
      setGridScrollTop(verticalRange.top);
    });
    
    // Listen to sort changes
    event.api.addEventListener('sortChanged', () => {
      // Use requestAnimationFrame to ensure AG Grid's sort is complete
      requestAnimationFrame(() => {
        updateDisplayedRows();
      });
    });
    
    // Listen to filter changes
    event.api.addEventListener('filterChanged', () => {
      requestAnimationFrame(() => {
        updateDisplayedRows();
      });
    });
  }, [updateDisplayedRows]);
  
  // Update displayed rows when source data changes
  useEffect(() => {
    if (gridApiRef.current) {
      // Small delay to ensure AG Grid has processed the data
      const timeoutId = setTimeout(() => {
        updateDisplayedRows();
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [crewData, updateDisplayedRows]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96 bg-white rounded-lg border border-gray-200">
        <p className="text-gray-500 text-sm">Loading crew data...</p>
      </div>
    );
  }

  return (
    <div className="flex gap-0 h-[calc(100vh-280px)] bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Left section: AG Grid */}
      <div className="flex-none w-[620px] border-r border-gray-200">
        <AgGridTable
          rowData={crewData}
          columnDefs={columnDefs}
          context={{}}
          onGridReady={handleGridReady}
          height="100%"
          enableExport={false}
          enableSideBar={false}
          enableStatusBar={false}
          gridOptions={{
            rowHeight: 48,
            headerHeight: 48,
            suppressMovableColumns: true,
            getRowId: (params: any) => params.data.id,
          }}
        />
      </div>
      
      {/* Right section: Timeline */}
      <div 
        ref={timelineContainerRef}
        className="flex-1 overflow-hidden"
        style={{ overflow: 'hidden' }}
      >
        <TimelineView 
          rowData={displayedRowData} 
          rowHeight={48}
          scrollTop={gridScrollTop}
        />
      </div>
    </div>
  );
};
