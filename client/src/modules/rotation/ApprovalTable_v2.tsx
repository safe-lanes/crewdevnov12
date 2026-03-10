import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AgGridTable } from '@/components/AgGrid/AgGridTable';
import { ColDef } from 'ag-grid-community';
import { format, addMonths, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { useVesselLookup } from '@/hooks/useVesselLookup';
import { ComplianceMatrixDialog_v2 as ComplianceMatrixDialog } from '@/modules/vessel/ComplianceMatrixDialog_v2';
import { useDeployEntryV2, useRejectEntryV2 } from './hooks/useRotationV2';

// Hook to fetch V2 proposals from drafts with Proposed/Partially Approved status
const useProposalsV2 = (filters: {
  selectedVessels?: string[];
  selectedRanks?: string[];
  draftIdFilter?: string;
  dateFrom?: string;
  dateTo?: string;
  showArchived?: boolean;
}) => {
  const { getVesselIds } = useVesselLookup();
  const queryParams = new URLSearchParams();
  
  if (filters.selectedVessels && filters.selectedVessels.length > 0) {
    const vesselIds = getVesselIds(filters.selectedVessels);
    queryParams.append('vessels', JSON.stringify(vesselIds));
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
  
  if (filters.showArchived) {
    queryParams.append('archived', 'true');
  }
  
  return useQuery({
    queryKey: ['/api/v2/rotation/proposals', queryParams.toString()],
    queryFn: () => fetch(`/api/v2/rotation/proposals?${queryParams.toString()}`).then(res => res.json()),
  });
};

interface ApprovalTableV2Props {
  selectedVessels: string[];
  selectedRanks: string[];
  draftIdFilter: string;
  dateFrom: string;
  dateTo: string;
}

interface ProposalRowV2 {
  entryUuid: string;
  draftUuid: string;
  vessel: string;
  vesselUuid: string;
  rank: string;
  crewName: string;
  crewUuid: string | null;
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
  result?: string;
  archivedDate?: string;
}

const ApprovalTimelineViewV2: React.FC<{ 
  rowData: ProposalRowV2[]; 
  rowHeight: number;
  scrollTop: number;
  selectedAssignments: Set<string>;
  onToggleAssignment: (entryUuid: string) => void;
  showArchived?: boolean;
}> = ({ rowData, rowHeight, scrollTop, selectedAssignments, onToggleAssignment, showArchived = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  
  const checkboxColumnWidth = 50;
  
  const today = useMemo(() => new Date(), []);
  const startDate = useMemo(() => addMonths(today, -2), [today]);
  const endDate = useMemo(() => addMonths(today, 5), [today]);
  const totalDays = useMemo(() => differenceInDays(endDate, startDate), [startDate, endDate]);
  
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

  const timelineWidth = canvasSize.width - checkboxColumnWidth;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = timelineWidth;
    const height = canvasSize.height;
    const headerHeight = 48;
    
    ctx.clearRect(0, 0, width, height);
    
    ctx.fillStyle = '#52baf3';
    ctx.fillRect(0, 0, width, headerHeight);
    
    ctx.fillStyle = 'white';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    
    months.forEach((month, idx) => {
      const x = (idx / months.length) * width + (width / months.length / 2);
      ctx.fillText(month.label, x, 30);
    });
    
    const todayX = ((differenceInDays(today, startDate) / totalDays) * width);
    
    const visibleStartRow = Math.floor(scrollTop / rowHeight);
    const visibleEndRow = Math.min(
      Math.ceil((scrollTop + height - headerHeight) / rowHeight) + 1,
      rowData.length
    );
    
    for (let i = visibleStartRow; i < visibleEndRow; i++) {
      const proposal = rowData[i];
      if (!proposal) continue;
      
      const y = headerHeight + (i * rowHeight) - scrollTop;
      
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, y, width, rowHeight);
      
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y + rowHeight - 0.5);
      ctx.lineTo(width, y + rowHeight - 0.5);
      ctx.stroke();
      
      if (proposal.currentCrew) {
        const currentCrew = proposal.currentCrew;
        const contractStart = new Date(currentCrew.contractStartDate);
        const contractEnd = new Date(currentCrew.contractEndDate);
        const rangeEnd = new Date(currentCrew.rangeEndDate);
        
        const greenStart = Math.max(0, ((differenceInDays(contractStart, startDate) / totalDays) * width));
        const greenEnd = Math.max(0, ((differenceInDays(contractEnd, startDate) / totalDays) * width));
        const yellowEnd = Math.max(0, ((differenceInDays(rangeEnd, startDate) / totalDays) * width));
        
        const currentBarY = y + 6;
        const barHeight = 16;
        
        if (greenEnd > greenStart) {
          ctx.fillStyle = 'rgba(2, 169, 33, 0.5)';
          ctx.fillRect(greenStart, currentBarY, greenEnd - greenStart, barHeight);
        }
        
        if (yellowEnd > greenEnd) {
          ctx.fillStyle = 'rgba(241, 205, 29, 0.5)';
          ctx.fillRect(greenEnd, currentBarY, yellowEnd - greenEnd, barHeight);
        }
        
        if (rangeEnd < today) {
          const pinkStart = yellowEnd;
          const pinkEnd = todayX;
          if (pinkEnd > pinkStart) {
            ctx.fillStyle = 'rgba(229, 78, 96, 0.5)';
            ctx.fillRect(pinkStart, currentBarY, pinkEnd - pinkStart, barHeight);
          }
        }
        
        ctx.fillStyle = '#000000';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        const textX = Math.max(greenStart + 4, 4);
        if (textX < width - 50) {
          ctx.fillText(currentCrew.name, textX, currentBarY + 12);
        }
      }
      
      const joiningDate = new Date(proposal.joiningDate);
      const contractEndDate = addMonths(joiningDate, proposal.contractPeriod);
      
      const proposedStart = Math.max(0, ((differenceInDays(joiningDate, startDate) / totalDays) * width));
      const proposedEnd = Math.max(0, ((differenceInDays(contractEndDate, startDate) / totalDays) * width));
      
      const proposedBarY = y + 26;
      const barHeight = 16;
      
      if (proposedEnd > proposedStart) {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.6)';
        ctx.fillRect(proposedStart, proposedBarY, proposedEnd - proposedStart, barHeight);
      }
      
      ctx.fillStyle = '#000000';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      const textX = Math.max(proposedStart + 4, 4);
      if (textX < width - 50) {
        ctx.fillText(proposal.crewName, textX, proposedBarY + 12);
      }
    }
    
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(todayX, headerHeight);
    ctx.lineTo(todayX, height);
    ctx.stroke();
  }, [rowData, scrollTop, rowHeight, months, today, startDate, endDate, totalDays, canvasSize, timelineWidth]);

  return (
    <div ref={containerRef} className="w-full h-full flex">
      <div className="flex-1" style={{ width: timelineWidth }}>
        <canvas
          ref={canvasRef}
          width={timelineWidth}
          height={canvasSize.height}
          className="block"
        />
      </div>
      
      <div className="flex-none bg-white border-l border-gray-200" style={{ width: checkboxColumnWidth }}>
        <div className="h-[48px] bg-[#52baf3] border-b border-gray-200"></div>
        
        <div className="relative" style={{ height: canvasSize.height - 48 }}>
          {rowData.map((proposal, index) => {
            const key = proposal.entryUuid;
            const y = (index * rowHeight) - scrollTop;
            
            if (y + rowHeight < 0 || y > canvasSize.height - 48) {
              return null;
            }
            
            return (
              <div
                key={key}
                className="absolute flex items-center justify-center border-b border-gray-200"
                style={{
                  top: y,
                  left: 0,
                  width: checkboxColumnWidth,
                  height: rowHeight,
                }}
              >
                {!showArchived && (
                  <Checkbox
                    checked={selectedAssignments.has(key)}
                    onCheckedChange={() => onToggleAssignment(proposal.entryUuid)}
                    data-testid={`checkbox-assignment-v2-${key}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export function ApprovalTable_v2({ selectedVessels, selectedRanks, draftIdFilter, dateFrom, dateTo }: ApprovalTableV2Props) {
  const [selectedAssignments, setSelectedAssignments] = useState<Set<string>>(new Set());
  const [gridScrollTop, setGridScrollTop] = useState(0);
  const [displayedRowData, setDisplayedRowData] = useState<ProposalRowV2[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [complianceDialogOpen, setComplianceDialogOpen] = useState(false);
  const gridApiRef = useRef<any>(null);
  const { toast } = useToast();
  const { getVesselName } = useVesselLookup();
  
  // Use V2 proposals endpoint with filters
  const { data: proposalsData = [], isLoading } = useProposalsV2({
    selectedVessels,
    selectedRanks,
    draftIdFilter,
    dateFrom,
    dateTo,
    showArchived,
  });
  const deployMutation = useDeployEntryV2();
  const rejectMutation = useRejectEntryV2();

  // Map the proposals response to the component's expected format
  const proposals: ProposalRowV2[] = useMemo(() => {
    if (!Array.isArray(proposalsData)) return [];
    
    return proposalsData.map((proposal: any) => ({
      entryUuid: proposal.entryUuid || proposal.id?.toString() || '',
      draftUuid: proposal.draftUuid || '',
      vessel: proposal.vesselName || proposal.vessel || getVesselName(proposal.vesselUuid) || 'Unknown Vessel',
      vesselUuid: proposal.vesselUuid || '',
      rank: proposal.rank || '',
      crewName: proposal.crewName || 'Unknown',
      crewUuid: proposal.crewUuid || null,
      joiningDate: proposal.signOnDate || proposal.joiningDate || '',
      contractPeriod: proposal.contractPeriod || 6,
      draftId: proposal.draftUuid ? proposal.draftUuid.slice(0, 8) : '',
      proposedBy: proposal.proposedBy || 'Unknown',
      proposedDate: proposal.proposedDate || '',
      currentCrew: proposal.currentCrew || null,
      result: proposal.result || '',
      archivedDate: proposal.archivedDate || '',
    }));
  }, [proposalsData, getVesselName]);

  const handleDeploy = () => {
    if (selectedAssignments.size === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one assignment to deploy",
        variant: "destructive",
      });
      return;
    }

    selectedAssignments.forEach(entryUuid => {
      deployMutation.mutate(entryUuid, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['/api/v2/rotation'] });
          toast({
            title: "Success",
            description: "Assignment deployed successfully",
          });
          setSelectedAssignments(new Set());
        },
        onError: (error: any) => {
          toast({
            title: "Error",
            description: error.message || "Failed to deploy assignment",
            variant: "destructive",
          });
        },
      });
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

    selectedAssignments.forEach(entryUuid => {
      rejectMutation.mutate({ entryUuid, rejectionReason: 'Rejected by approver' }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['/api/v2/rotation'] });
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
    });
  };

  const isOneVesselSelected = selectedVessels.length === 1;
  
  const selectedCrewForCompliance = useMemo(() => {
    const selected: Array<{ rank: string; crewMemberId: string; crewName: string; joiningDate?: string }> = [];
    selectedAssignments.forEach(entryUuid => {
      const proposal = proposals.find(p => p.entryUuid === entryUuid);
      if (proposal && proposal.crewUuid) {
        selected.push({
          rank: proposal.rank,
          crewMemberId: proposal.crewUuid,
          crewName: proposal.crewName,
          joiningDate: proposal.joiningDate,
        });
      }
    });
    return selected;
  }, [selectedAssignments, proposals]);

  const selectedVesselId = useMemo(() => {
    if (selectedVessels.length !== 1) return null;
    return selectedVessels[0];
  }, [selectedVessels]);

  const handleCheckCompliance = () => {
    if (!isOneVesselSelected) {
      toast({
        title: "Vessel Selection Required",
        description: "Please select exactly 1 vessel from the dropdown to check compliance",
        variant: "destructive",
      });
      return;
    }
    
    if (selectedAssignments.size === 0) {
      toast({
        title: "Crew Selection Required",
        description: "Please check at least one proposed crew member to simulate compliance",
        variant: "destructive",
      });
      return;
    }
    
    setComplianceDialogOpen(true);
  };

  const toggleAssignment = (entryUuid: string) => {
    setSelectedAssignments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryUuid)) {
        newSet.delete(entryUuid);
      } else {
        newSet.add(entryUuid);
      }
      return newSet;
    });
  };

  const columnDefs: ColDef[] = useMemo(() => {
    const baseColumns: ColDef[] = [
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
    ];

    if (showArchived) {
      baseColumns.push(
        {
          headerName: 'Result',
          field: 'result',
          width: 100,
          cellStyle: (params) => {
            const baseStyle = { fontSize: '13px' };
            if (params.value === 'Deployed') {
              return { ...baseStyle, color: '#16a34a', fontWeight: 500 };
            } else if (params.value === 'Rejected') {
              return { ...baseStyle, color: '#dc2626', fontWeight: 500 };
            }
            return { ...baseStyle, color: '#4f5863' };
          },
          sortable: true,
          resizable: false,
        },
        {
          headerName: 'Archived Date',
          field: 'archivedDate',
          width: 140,
          cellStyle: { fontSize: '13px', color: '#4f5863' },
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
        }
      );
    }

    return baseColumns;
  }, [showArchived]);

  const updateDisplayedRows = useCallback(() => {
    if (!gridApiRef.current) return;
    
    const displayedRows: ProposalRowV2[] = [];
    gridApiRef.current.forEachNodeAfterFilterAndSort((node: any) => {
      if (node.data) {
        displayedRows.push(node.data);
      }
    });
    setDisplayedRowData(displayedRows);
  }, []);

  const handleGridReady = useCallback((event: any) => {
    gridApiRef.current = event.api;
    
    updateDisplayedRows();
    
    event.api.addEventListener('bodyScroll', () => {
      const verticalRange = event.api.getVerticalPixelRange();
      setGridScrollTop(verticalRange.top);
    });
    
    event.api.addEventListener('sortChanged', () => {
      requestAnimationFrame(() => {
        updateDisplayedRows();
      });
    });
    
    event.api.addEventListener('filterChanged', () => {
      requestAnimationFrame(() => {
        updateDisplayedRows();
      });
    });
  }, [updateDisplayedRows]);
  
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
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {!showArchived && (
            <>
              <Button
                onClick={handleDeploy}
                disabled={selectedAssignments.size === 0 || deployMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
                data-testid="button-deploy-v2"
              >
                {deployMutation.isPending ? "Deploying..." : "Deploy"}
              </Button>
              <Button
                onClick={handleReject}
                disabled={selectedAssignments.size === 0 || rejectMutation.isPending}
                variant="outline"
                className="border-red-500 text-red-500 hover:bg-red-50"
                data-testid="button-reject-v2"
              >
                {rejectMutation.isPending ? "Rejecting..." : "Reject"}
              </Button>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <Button
            onClick={handleCheckCompliance}
            disabled={!isOneVesselSelected}
            variant="outline"
            className={!isOneVesselSelected ? "opacity-50 cursor-not-allowed" : ""}
            data-testid="button-check-compliance-v2"
          >
            Check Compliance
          </Button>
          
          <div className="flex items-center gap-2 border border-gray-300 rounded-md px-3 py-2 bg-white">
            <Checkbox
              id="show-archived-v2"
              checked={showArchived}
              onCheckedChange={(checked) => {
                setShowArchived(checked === true);
                setSelectedAssignments(new Set());
              }}
              data-testid="checkbox-show-archived-v2"
            />
            <label 
              htmlFor="show-archived-v2" 
              className="text-sm text-gray-700 cursor-pointer select-none"
            >
              Show Archived
            </label>
          </div>
        </div>
      </div>

      <div className="flex gap-0 h-[calc(100vh-380px)] bg-white rounded-lg border border-gray-200 overflow-hidden">
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
              getRowId: (params: any) => {
                if (params.data?.entryUuid) {
                  return params.data.entryUuid;
                }
                if (params.node?.rowIndex !== undefined) {
                  return `row-${params.node.rowIndex}`;
                }
                return `fallback-${Math.random().toString(36).substring(7)}`;
              },
              overlayNoRowsTemplate: showArchived 
                ? '<span class="text-gray-500 text-sm">No archived assignments found.</span>'
                : '<span class="text-gray-500 text-sm">No proposed assignments found. Create a rotation plan and propose it for approval.</span>',
            }}
          />
        </div>
        
        <div className="flex-1 overflow-hidden">
          <ApprovalTimelineViewV2 
            rowData={displayedRowData} 
            rowHeight={48}
            scrollTop={gridScrollTop}
            selectedAssignments={selectedAssignments}
            onToggleAssignment={toggleAssignment}
            showArchived={showArchived}
          />
        </div>
      </div>

      <ComplianceMatrixDialog
        open={complianceDialogOpen}
        onOpenChange={setComplianceDialogOpen}
        vesselId={selectedVesselId || undefined}
        simulatedCrew={selectedCrewForCompliance}
      />
    </div>
  );
}

export default ApprovalTable_v2;
