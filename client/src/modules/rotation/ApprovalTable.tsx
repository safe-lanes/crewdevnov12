import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { AgGridTable } from '@/components/AgGrid/AgGridTable';
import { ColDef } from 'ag-grid-community';
import { format, addMonths, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

// Hook to fetch proposed assignments
const useProposals = (filters: any) => {
  const queryParams = new URLSearchParams();
  
  if (filters.selectedVessels && filters.selectedVessels.length > 0) {
    queryParams.append('vessels', JSON.stringify(filters.selectedVessels));
  }
  
  if (filters.selectedRanks && filters.selectedRanks.length > 0) {
    queryParams.append('ranks', JSON.stringify(filters.selectedRanks));
  }
  
  if (filters.draftIdFilter) {
    queryParams.append('draftId', filters.draftIdFilter);
  }
  
  if (filters.dateFrom) {
    queryParams.append('dateFrom', filters.dateFrom);
  }
  
  if (filters.dateTo) {
    queryParams.append('dateTo', filters.dateTo);
  }
  
  return useQuery({
    queryKey: ['/api/rotation/proposals', queryParams.toString()],
    queryFn: () => fetch(`/api/rotation/proposals?${queryParams.toString()}`).then(res => res.json()),
  });
};

interface ApprovalTableProps {
  selectedVessels: string[];
  selectedRanks: string[];
  draftIdFilter: string;
  dateFrom: string;
  dateTo: string;
}

interface ProposalRow {
  planId: number;
  assignmentIndex: number;
  vessel: string;
  vesselId: string;
  rank: string;
  crewName: string;
  crewId: string;
  joiningDate: string;
  contractPeriod: number;
  draftId: string;
  proposedBy: string;
  proposedDate: string;
  currentCrew?: {
    id: string;
    name: string;
    contractStartDate: string;
    contractEndDate: string;
    rangeStartDate: string;
    rangeEndDate: string;
  } | null;
}

// Timeline View Component
const ApprovalTimelineView: React.FC<{ 
  rowData: ProposalRow[]; 
  rowHeight: number;
  scrollTop: number;
}> = ({ rowData, rowHeight, scrollTop }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  
  // Calculate 7-month window (2 months before today + today + 5 months after today)
  const today = useMemo(() => new Date(), []);
  const startDate = useMemo(() => addMonths(today, -2), [today]);
  const endDate = useMemo(() => addMonths(today, 5), [today]);
  const totalDays = useMemo(() => differenceInDays(endDate, startDate), [startDate, endDate]);
  
  // Resize canvas to match container
  useEffect(() => {
    const updateCanvasSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCanvasSize({ width: rect.width, height: rect.height });
      }
    };
    
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);
  
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

    const width = canvasSize.width;
    const height = canvasSize.height;
    const headerHeight = 48;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw month headers background
    ctx.fillStyle = '#52baf3';
    ctx.fillRect(0, 0, width, headerHeight);
    
    // Draw month headers
    ctx.fillStyle = 'white';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    
    months.forEach((month, idx) => {
      const x = (idx / months.length) * width + (width / months.length / 2);
      ctx.fillText(month.label, x, 30);
    });
    
    // Calculate today's X position
    const todayX = ((differenceInDays(today, startDate) / totalDays) * width);
    
    // Draw timeline bars for each proposal
    const visibleStartRow = Math.floor(scrollTop / rowHeight);
    const visibleEndRow = Math.min(
      Math.ceil((scrollTop + height - headerHeight) / rowHeight) + 1,
      rowData.length
    );
    
    for (let i = visibleStartRow; i < visibleEndRow; i++) {
      const proposal = rowData[i];
      if (!proposal) continue;
      
      const y = headerHeight + (i * rowHeight) - scrollTop;
      
      // Draw row background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, y, width, rowHeight);
      
      // Draw horizontal row divider
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y + rowHeight - 0.5);
      ctx.lineTo(width, y + rowHeight - 0.5);
      ctx.stroke();
      
      // Draw current crew timeline (if exists) in top half of row
      if (proposal.currentCrew) {
        const currentCrew = proposal.currentCrew;
        const contractStart = new Date(currentCrew.contractStartDate);
        const contractEnd = new Date(currentCrew.contractEndDate);
        const rangeEnd = new Date(currentCrew.rangeEndDate);
        
        const greenStart = Math.max(0, ((differenceInDays(contractStart, startDate) / totalDays) * width));
        const greenEnd = Math.max(0, ((differenceInDays(contractEnd, startDate) / totalDays) * width));
        const yellowEnd = Math.max(0, ((differenceInDays(rangeEnd, startDate) / totalDays) * width));
        
        const currentBarY = y + 6; // Top half of row
        const barHeight = 16;
        
        // Green bar (Contract)
        if (greenEnd > greenStart) {
          ctx.fillStyle = 'rgba(2, 169, 33, 0.5)';
          ctx.fillRect(greenStart, currentBarY, greenEnd - greenStart, barHeight);
        }
        
        // Yellow bar (Grace period)
        if (yellowEnd > greenEnd) {
          ctx.fillStyle = 'rgba(241, 205, 29, 0.5)';
          ctx.fillRect(greenEnd, currentBarY, yellowEnd - greenEnd, barHeight);
        }
        
        // Pink bar (Overdue) - only if overdue
        if (rangeEnd < today) {
          const pinkStart = yellowEnd;
          const pinkEnd = todayX;
          if (pinkEnd > pinkStart) {
            ctx.fillStyle = 'rgba(229, 78, 96, 0.5)';
            ctx.fillRect(pinkStart, currentBarY, pinkEnd - pinkStart, barHeight);
          }
        }
        
        // Draw current crew name on bar
        ctx.fillStyle = '#000000';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        const textX = Math.max(greenStart + 4, 4);
        if (textX < width - 50) {
          ctx.fillText(currentCrew.name, textX, currentBarY + 12);
        }
      }
      
      // Draw proposed crew timeline in bottom half of row
      const joiningDate = new Date(proposal.joiningDate);
      const contractEndDate = addMonths(joiningDate, proposal.contractPeriod);
      
      const proposedStart = Math.max(0, ((differenceInDays(joiningDate, startDate) / totalDays) * width));
      const proposedEnd = Math.max(0, ((differenceInDays(contractEndDate, startDate) / totalDays) * width));
      
      const proposedBarY = y + 26; // Bottom half of row
      const barHeight = 16;
      
      // Blue bar for proposed assignment
      if (proposedEnd > proposedStart) {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.6)'; // Blue for proposed
        ctx.fillRect(proposedStart, proposedBarY, proposedEnd - proposedStart, barHeight);
      }
      
      // Draw proposed crew name on bar
      ctx.fillStyle = '#000000';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      const textX = Math.max(proposedStart + 4, 4);
      if (textX < width - 50) {
        ctx.fillText(proposal.crewName, textX, proposedBarY + 12);
      }
    }
    
    // Draw "today" vertical line on top of all bars
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(todayX, headerHeight);
    ctx.lineTo(todayX, height);
    ctx.stroke();
  }, [rowData, scrollTop, rowHeight, months, today, startDate, endDate, totalDays, canvasSize]);

  return (
    <div ref={containerRef} className="w-full h-full">
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="block"
      />
    </div>
  );
};

export function ApprovalTable({ selectedVessels, selectedRanks, draftIdFilter, dateFrom, dateTo }: ApprovalTableProps) {
  const [selectedAssignments, setSelectedAssignments] = useState<Set<string>>(new Set());
  const [gridScrollTop, setGridScrollTop] = useState(0);
  const [displayedRowData, setDisplayedRowData] = useState<ProposalRow[]>([]);
  const gridApiRef = useRef<any>(null);
  const { toast } = useToast();
  
  const { data: proposals = [], isLoading, refetch } = useProposals({
    selectedVessels,
    selectedRanks,
    draftIdFilter,
    dateFrom,
    dateTo,
  });

  // Deploy mutation
  const deployMutation = useMutation({
    mutationFn: async ({ planId, assignmentIndex }: { planId: number; assignmentIndex: number }) => {
      return await apiRequest('POST', '/api/rotation/proposals/deploy', {
        planId,
        assignmentIndex,
        deployedBy: 'Current User'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rotation/proposals'] });
      toast({
        title: "Success",
        description: "Assignment deployed successfully",
      });
      setSelectedAssignments(new Set());
    },
    onError: (error: any) => {
      if (error.message?.includes('conflicts')) {
        toast({
          title: "Conflict Detected",
          description: "This crew member is already assigned to another vessel during this period",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to deploy assignment",
          variant: "destructive",
        });
      }
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ planId, assignmentIndex }: { planId: number; assignmentIndex: number }) => {
      return await apiRequest('POST', '/api/rotation/proposals/reject', {
        planId,
        assignmentIndex,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rotation/proposals'] });
      toast({
        title: "Success",
        description: "Assignment rejected successfully",
      });
      setSelectedAssignments(new Set());
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject assignment",
        variant: "destructive",
      });
    },
  });

  const handleDeploy = () => {
    if (selectedAssignments.size === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one assignment to deploy",
        variant: "destructive",
      });
      return;
    }

    selectedAssignments.forEach(key => {
      const [planId, assignmentIndex] = key.split('-').map(Number);
      deployMutation.mutate({ planId, assignmentIndex });
    });
  };

  const handleReject = () => {
    if (selectedAssignments.size === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one assignment to reject",
        variant: "destructive",
      });
      return;
    }

    selectedAssignments.forEach(key => {
      const [planId, assignmentIndex] = key.split('-').map(Number);
      rejectMutation.mutate({ planId, assignmentIndex });
    });
  };

  const toggleAssignment = (planId: number, assignmentIndex: number) => {
    const key = `${planId}-${assignmentIndex}`;
    setSelectedAssignments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

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
      headerName: 'Proposed Date',
      field: 'proposedDate',
      width: 140,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      sortable: true,
      resizable: false,
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
    {
      headerName: 'Draft ID',
      field: 'draftId',
      width: 140,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      sortable: true,
      resizable: false,
      hide: true, // Hidden by default, accessible via horizontal scroll
    },
    {
      headerName: 'Proposed By',
      field: 'proposedBy',
      width: 130,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      sortable: true,
      resizable: false,
      hide: true, // Hidden by default, accessible via horizontal scroll
    },
    {
      headerName: '',
      field: 'checkbox',
      width: 60,
      cellRenderer: (params: any) => {
        const key = `${params.data.planId}-${params.data.assignmentIndex}`;
        return (
          <div className="flex items-center justify-center h-full">
            <Checkbox
              checked={selectedAssignments.has(key)}
              onCheckedChange={() => toggleAssignment(params.data.planId, params.data.assignmentIndex)}
              data-testid={`checkbox-assignment-${key}`}
            />
          </div>
        );
      },
      sortable: false,
      resizable: false,
      pinned: 'right',
    },
  ], [selectedAssignments]);

  // Extract displayed rows from AG Grid (after sorting/filtering)
  const updateDisplayedRows = useCallback(() => {
    if (!gridApiRef.current) return;
    
    const displayedRows: ProposalRow[] = [];
    gridApiRef.current.forEachNodeAfterFilterAndSort((node: any) => {
      if (node.data) {
        displayedRows.push(node.data);
      }
    });
    setDisplayedRowData(displayedRows);
  }, []);

  const handleGridReady = useCallback((event: any) => {
    gridApiRef.current = event.api;
    
    // Initial load
    updateDisplayedRows();
    
    // Listen to body scroll events
    event.api.addEventListener('bodyScroll', () => {
      const verticalRange = event.api.getVerticalPixelRange();
      setGridScrollTop(verticalRange.top);
    });
    
    // Listen to sort changes
    event.api.addEventListener('sortChanged', () => {
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
      const timeoutId = setTimeout(() => {
        updateDisplayedRows();
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [proposals, updateDisplayedRows]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96 bg-white rounded-lg border border-gray-200">
        <p className="text-gray-500 text-sm">Loading proposals...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={handleDeploy}
          disabled={selectedAssignments.size === 0 || deployMutation.isPending}
          className="bg-green-600 hover:bg-green-700"
          data-testid="button-deploy"
        >
          {deployMutation.isPending ? "Deploying..." : "Deploy"}
        </Button>
        <Button
          onClick={handleReject}
          disabled={selectedAssignments.size === 0 || rejectMutation.isPending}
          variant="outline"
          className="border-red-500 text-red-500 hover:bg-red-50"
          data-testid="button-reject"
        >
          {rejectMutation.isPending ? "Rejecting..." : "Reject"}
        </Button>
      </div>

      {/* Hybrid Table: AG Grid + Timeline - Always visible */}
      <div className="flex gap-0 h-[calc(100vh-380px)] bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Left section: AG Grid (40%) */}
        <div className="flex-none w-[40%] border-r border-gray-200">
          <AgGridTable
            rowData={proposals}
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
              getRowId: (params: any) => `${params.data.planId}-${params.data.assignmentIndex}`,
              overlayNoRowsTemplate: '<span class="text-gray-500 text-sm">No proposed assignments found. Create a rotation plan and propose it for approval.</span>',
            }}
          />
        </div>
        
        {/* Right section: Timeline (60%) */}
        <div className="flex-1 overflow-hidden">
          <ApprovalTimelineView 
            rowData={displayedRowData} 
            rowHeight={48}
            scrollTop={gridScrollTop}
          />
        </div>
      </div>
    </div>
  );
}
