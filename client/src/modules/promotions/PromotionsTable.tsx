import React, { useState, useMemo, useCallback } from 'react';
import { ColDef, ICellRendererParams, GridReadyEvent, GridApi } from 'ag-grid-community';
import { useQuery } from '@tanstack/react-query';
import AgGridTable from '@/components/AgGrid/AgGridTable';
import { Button } from '@/components/ui/button';
import { Edit } from 'lucide-react';

// Status indicator cell renderer (green/yellow/gray circles)
const StatusIndicatorRenderer = (params: ICellRendererParams) => {
  const status = params.value; // 'met', 'pending', 'not-met'
  
  const getColorClass = () => {
    switch (status) {
      case 'met': return 'bg-green-500';
      case 'pending': return 'bg-yellow-500';
      case 'not-met': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="flex items-center justify-center h-full">
      <div className={`w-3 h-3 rounded-full ${getColorClass()}`} />
    </div>
  );
};

// Progress bar cell renderer for Promotion Checklist
const ProgressBarRenderer = (params: ICellRendererParams) => {
  const percentage = params.value || 0; // 0-100
  
  const getBarColor = () => {
    if (percentage >= 75) return 'bg-green-500';
    if (percentage >= 40) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  return (
    <div className="flex items-center justify-center h-full px-2">
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${getBarColor()}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// Status badge cell renderer
const StatusBadgeRenderer = (params: ICellRendererParams) => {
  const status = params.value;
  
  const getBadgeClass = () => {
    switch (status) {
      case 'In Progress': return 'bg-yellow-100 text-yellow-800';
      case 'For Approval': return 'bg-blue-100 text-blue-800';
      case 'Approved': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="flex items-center justify-center h-full">
      <span className={`px-2 py-1 rounded text-xs font-medium ${getBadgeClass()}`}>
        {status}
      </span>
    </div>
  );
};

// Edit button cell renderer
const EditButtonRenderer = (params: ICellRendererParams) => {
  const handleEditClick = () => {
    console.log('Edit clicked for:', params.data);
    // Will open promotion form later
  };

  return (
    <div className="flex items-center justify-center h-full">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 hover:bg-gray-100"
        onClick={handleEditClick}
        data-testid={`button-edit-${params.data.crewId}`}
      >
        <Edit className="h-4 w-4 text-gray-600" />
      </Button>
    </div>
  );
};

interface PromotionsTableProps {
  searchName: string;
  promotionToRank: string;
  vesselType: string;
  nationality: string;
  criteria: string;
  status: string;
}

export const PromotionsTable: React.FC<PromotionsTableProps> = ({
  searchName,
  promotionToRank,
  vesselType,
  nationality,
  criteria,
  status
}) => {
  const [gridApi, setGridApi] = useState<GridApi | null>(null);

  // Fetch crew members from crew pool API
  const { data: crewMembers = [], isLoading } = useQuery({
    queryKey: ['/api/crew-members'],
  });

  // Transform crew data to promotion table format with sample indicator data
  const promotionData = useMemo(() => {
    const members = Array.isArray(crewMembers) ? crewMembers : [];
    if (!members || members.length === 0) return [];

    return members.slice(0, 10).map((crew: any, index: number) => ({
      crewId: crew.id || `2025-${String(index + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 20)).padStart(2, '0')}`,
      name: `${crew.firstName || 'Unknown'} ${crew.middleInitial || ''} ${crew.familyName || ''}`.trim(),
      dob: crew.dob || '1985-01-01',
      nationality: crew.nationality || 'Unknown',
      promotionToRank: ['Master', 'Chief Engineer', 'Chief Mate', 'Able Seaman', 'Second Officer', 'Bosun', 'Electrician', 'Third Engineer'][index % 8],
      vesselLeave: crew.currentVessel || (index % 3 === 0 ? 'On Leave' : `MT Sail ${['One', 'Two', 'Three', 'Five', 'Seven'][index % 5]}`),
      license: ['met', 'pending', 'met'][index % 3],
      age: ['met', 'met', 'pending'][index % 3],
      sea: ['met', 'pending', 'met'][index % 3],
      reco: ['met', 'pending', 'met'][index % 3],
      promotionChecklist: [40, 75, 80, 60, 45, 90, 85, 50][index % 8],
      otherCriteria: ['met', 'pending', 'met'][index % 3],
      cesIndex: ['met', 'pending', 'not-met'][index % 3],
      trainDocs: ['met', 'pending', 'not-met'][index % 3],
      status: ['In Progress', 'For Approval', 'Approved'][index % 3],
    }));
  }, [crewMembers]);

  // Filter data based on filters
  const filteredData = useMemo(() => {
    return promotionData.filter(item => {
      const matchesName = !searchName || item.name.toLowerCase().includes(searchName.toLowerCase());
      const matchesRank = !promotionToRank || item.promotionToRank === promotionToRank;
      const matchesNationality = !nationality || item.nationality === nationality;
      const matchesStatus = !status || item.status === status;
      
      // Vessel type filtering - bypass filtering as we don't have vessel type data in promotion records yet
      const matchesVesselType = true;
      
      // Criteria filtering - check if any criteria indicator matches the selected criteria status
      const matchesCriteria = !criteria || 
        item.license === criteria || 
        item.age === criteria || 
        item.sea === criteria || 
        item.reco === criteria || 
        item.otherCriteria === criteria || 
        item.cesIndex === criteria || 
        item.trainDocs === criteria;

      return matchesName && matchesRank && matchesVesselType && matchesNationality && matchesCriteria && matchesStatus;
    });
  }, [promotionData, searchName, promotionToRank, vesselType, nationality, criteria, status]);

  const columnDefs: ColDef[] = useMemo(() => [
    {
      headerName: 'Crew ID',
      field: 'crewId',
      width: 110,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      sortable: true,
      resizable: false,
      pinned: 'left'
    },
    {
      headerName: 'Name',
      field: 'name',
      width: 180,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      sortable: true,
      resizable: false
    },
    {
      headerName: 'DOB',
      field: 'dob',
      width: 110,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      sortable: true,
      resizable: false
    },
    {
      headerName: 'Nationality',
      field: 'nationality',
      width: 110,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      sortable: true,
      resizable: false
    },
    {
      headerName: 'Promotion To Rank',
      field: 'promotionToRank',
      width: 150,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      sortable: true,
      resizable: false
    },
    {
      headerName: 'Vessel/ Leave',
      field: 'vesselLeave',
      width: 130,
      cellStyle: (params) => ({
        fontSize: '13px',
        color: params.value === 'On Leave' ? '#3b82f6' : '#4f5863'
      }),
      sortable: true,
      resizable: false
    },
    {
      headerName: 'License',
      field: 'license',
      width: 85,
      cellRenderer: StatusIndicatorRenderer,
      sortable: true,
      resizable: false,
      wrapHeaderText: false,
      autoHeaderHeight: false,
      headerClass: 'ag-header-cell-text'
    },
    {
      headerName: 'Age',
      field: 'age',
      width: 75,
      cellRenderer: StatusIndicatorRenderer,
      sortable: true,
      resizable: false,
      wrapHeaderText: false,
      autoHeaderHeight: false,
      headerClass: 'ag-header-cell-text'
    },
    {
      headerName: 'Sea',
      field: 'sea',
      width: 75,
      cellRenderer: StatusIndicatorRenderer,
      sortable: true,
      resizable: false,
      wrapHeaderText: false,
      autoHeaderHeight: false,
      headerClass: 'ag-header-cell-text'
    },
    {
      headerName: 'Reco',
      field: 'reco',
      width: 75,
      cellRenderer: StatusIndicatorRenderer,
      sortable: true,
      resizable: false,
      wrapHeaderText: false,
      autoHeaderHeight: false,
      headerClass: 'ag-header-cell-text'
    },
    {
      headerName: 'Promotion Checklist',
      field: 'promotionChecklist',
      width: 140,
      cellRenderer: ProgressBarRenderer,
      sortable: true,
      resizable: false
    },
    {
      headerName: 'Other Criteria',
      field: 'otherCriteria',
      width: 110,
      cellRenderer: StatusIndicatorRenderer,
      sortable: true,
      resizable: false
    },
    {
      headerName: 'CES Index',
      field: 'cesIndex',
      width: 95,
      cellRenderer: StatusIndicatorRenderer,
      sortable: true,
      resizable: false
    },
    {
      headerName: 'Train. & Docs.',
      field: 'trainDocs',
      width: 120,
      cellRenderer: StatusIndicatorRenderer,
      sortable: true,
      resizable: false
    },
    {
      headerName: 'Status',
      field: 'status',
      width: 120,
      cellRenderer: StatusBadgeRenderer,
      sortable: true,
      resizable: false
    },
    {
      headerName: '',
      field: 'edit',
      width: 60,
      cellRenderer: EditButtonRenderer,
      sortable: false,
      resizable: false,
      pinned: 'right'
    }
  ], []);

  const handleGridReady = (event: GridReadyEvent) => {
    setGridApi(event.api);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1">
        <AgGridTable
          rowData={filteredData}
          columnDefs={columnDefs}
          onGridReady={handleGridReady}
          loading={isLoading}
          height="calc(100vh - 320px)"
          data-testid="promotions-table"
        />
      </div>
      
      {/* Pagination info */}
      <div className="flex justify-between items-center px-4 py-2 text-sm text-gray-600">
        <div>
          {filteredData.length > 0 ? `0 to ${filteredData.length} of ${filteredData.length}` : '0 to 0 of 0'}
        </div>
        <div>
          Page {filteredData.length > 0 ? '1' : '0'} of {filteredData.length > 0 ? '1' : '0'}
        </div>
      </div>
    </div>
  );
};
