import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { AgGridTable } from '@/components/AgGrid/AgGridTable';
import { ColDef } from 'ag-grid-community';
import { format } from 'date-fns';
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

export function ApprovalTable({ selectedVessels, selectedRanks, draftIdFilter, dateFrom, dateTo }: ApprovalTableProps) {
  const [selectedAssignments, setSelectedAssignments] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  
  const { data: proposals = [], isLoading, refetch } = useProposals({
    selectedVessels,
    selectedRanks,
    draftIdFilter,
    dateFrom,
    dateTo,
  });

  // Clear selected assignments when proposals data changes (filter changes or data refetch)
  useEffect(() => {
    setSelectedAssignments(new Set());
  }, [proposals]);

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

    // Deploy each selected assignment
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

    // Reject each selected assignment
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
      headerName: '',
      field: 'checkbox',
      width: 50,
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
    },
    {
      headerName: 'Vessel',
      field: 'vesselName',
      width: 150,
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
      field: 'crewName',
      width: 150,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      sortable: true,
      resizable: false,
    },
    {
      headerName: 'Draft ID',
      field: 'draftId',
      width: 140,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      sortable: true,
      resizable: false,
    },
    {
      headerName: 'Proposed By',
      field: 'proposedBy',
      width: 130,
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
      headerName: 'Joining Date',
      field: 'joiningDate',
      width: 130,
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
  ], [selectedAssignments]);

  if (isLoading) {
    return <div className="p-6 text-gray-600">Loading proposals...</div>;
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

      {/* Approval Table */}
      <div className="h-[calc(100vh-380px)] bg-white rounded-lg border border-gray-200 overflow-hidden">
        <AgGridTable
          rowData={proposals}
          columnDefs={columnDefs}
          context={{}}
          height="100%"
          enableExport={false}
          enableSideBar={false}
          enableStatusBar={false}
          gridOptions={{
            rowHeight: 48,
            headerHeight: 48,
            suppressMovableColumns: true,
            getRowId: (params: any) => `${params.data.planId}-${params.data.assignmentIndex}`,
          }}
        />
      </div>

      {/* Empty State */}
      {proposals.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No proposed assignments found. Create a rotation plan and propose it for approval.
        </div>
      )}
    </div>
  );
}
