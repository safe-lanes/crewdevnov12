import React, { useState, useMemo, useCallback } from 'react';
import { ColDef, ICellRendererParams, GridReadyEvent, GridApi } from 'ag-grid-community';
import { useQuery } from '@tanstack/react-query';
import AgGridTable from '@/components/AgGrid/AgGridTable';
import { Button } from '@/components/ui/button';
import { Edit } from 'lucide-react';
import { useVesselLookup } from '@/hooks/useVesselLookup';
import { useRankNormalization } from '@/hooks/useRankNormalization';
import { findNextPromotionRank, shouldShowInPromotionsTable } from './promotionUtils';
import { PromotionHierarchy } from '@shared/schema';
import { PromotionReviewForm } from './PromotionReviewForm';

// Helper function to calculate age from DOB
const calculateAge = (dob: string): number | null => {
  if (!dob || dob === '-') return null;
  
  let birthDate: Date | null = null;
  
  // Try parsing different date formats
  // Format 1: "08-Jul-1991" or "17-Jan-1973"
  if (dob.includes('-') && isNaN(Number(dob.split('-')[0])) === false && dob.split('-').length === 3) {
    const parts = dob.split('-');
    const day = parseInt(parts[0]);
    const monthMap: { [key: string]: number } = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    const month = monthMap[parts[1]];
    const year = parseInt(parts[2]);
    
    if (!isNaN(day) && month !== undefined && !isNaN(year)) {
      birthDate = new Date(year, month, day);
    }
  }
  
  // Format 2: ISO format "1973-01-17" or other standard formats
  if (!birthDate) {
    birthDate = new Date(dob);
  }
  
  // Check if valid date
  if (!birthDate || isNaN(birthDate.getTime())) {
    return null;
  }
  
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  // Adjust age if birthday hasn't occurred this year
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

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

// Edit button cell renderer (now accepts onEdit callback)
const EditButtonRenderer = (params: ICellRendererParams & { onEdit?: (data: any) => void }) => {
  const handleEditClick = () => {
    if (params.onEdit) {
      params.onEdit(params.data);
    }
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
  const [selectedPromotion, setSelectedPromotion] = useState<any | null>(null);
  
  // Vessel lookup for ID to name translation
  const { getVesselName } = useVesselLookup();
  
  // Rank normalization for role variants (e.g., 3rd Officer_1 → 3rd Officer)
  const { normalizeRank, isLoading: isLoadingRanks } = useRankNormalization();

  // Fetch crew members from crew pool API
  const { data: crewMembers = [], isLoading } = useQuery({
    queryKey: ['/api/crew-members'],
  });

  // Fetch promotion hierarchies
  const { data: hierarchies = [], isLoading: isLoadingHierarchies } = useQuery<PromotionHierarchy[]>({
    queryKey: ['/api/promotion-hierarchies'],
  });

  // Fetch forms to find Promotion Review Form
  const { data: formsData = [] } = useQuery<any[]>({
    queryKey: ['/api/forms'],
  });

  // Fetch all rank groups for age criteria lookup
  const { data: rankGroupsData = [] } = useQuery<any[]>({
    queryKey: ['/api/rank-groups'],
  });

  // Build lookup map from promotion rank -> age criteria (ageMin, ageMax)
  const ageRequirementsByRank = useMemo(() => {
    const map = new Map<string, { ageMin?: number; ageMax?: number }>();
    
    const promotionReviewForm = formsData.find((f: any) => f.name === 'Promotion Review Form');
    if (!promotionReviewForm) return map;
    
    const formRankGroups = rankGroupsData.filter((rg: any) => 
      rg.formId === promotionReviewForm.id && !rg.archivedAt
    );
    
    for (const rg of formRankGroups) {
      let ranks: string[] = [];
      try {
        ranks = typeof rg.ranks === 'string' ? JSON.parse(rg.ranks) : rg.ranks || [];
      } catch (e) {
        ranks = [];
      }
      
      let config: any = null;
      try {
        if (rg.configuration) {
          const parsed = typeof rg.configuration === 'string' ? JSON.parse(rg.configuration) : rg.configuration;
          config = parsed?.promotionA2 ?? parsed;
        }
      } catch (e) {
        config = null;
      }
      
      if (config && (config.ageMin || config.ageMax)) {
        for (const rank of ranks) {
          map.set(normalizeRank(rank), { ageMin: config.ageMin, ageMax: config.ageMax });
        }
      }
    }
    
    return map;
  }, [formsData, rankGroupsData, normalizeRank]);

  // Transform crew data to promotion table format with sample indicator data
  const promotionData = useMemo(() => {
    const members = Array.isArray(crewMembers) ? crewMembers : [];
    if (!members || members.length === 0) return [];

    return members
      .map((crew: any, index: number) => {
        // Get current rank (could be a role variant like "3rd Officer_1")
        const currentRank = crew.presentRank || crew.rank || '-';
        
        // Normalize the rank to parent rank (e.g., "3rd Officer_1" → "3rd Officer")
        // This is needed because promotion hierarchies use parent ranks only
        const normalizedRank = normalizeRank(currentRank);
        
        // Check if crew should be shown in promotions table using normalized parent rank
        if (!shouldShowInPromotionsTable(normalizedRank, hierarchies)) {
          return null; // Filter out crew without promotion path or at senior position
        }

        // Find next promotion rank using normalized parent rank
        const { nextRank } = findNextPromotionRank(normalizedRank, hierarchies);
        
        // Extract vessel ID from crew data (handle both string and object formats)
        let vesselId = crew.presentVessel || crew.vessel;
        if (typeof vesselId === 'object' && vesselId !== null) {
          vesselId = vesselId.id || vesselId.entryId || '';
        }
        
        // Get actual vessel name from vessel ID
        const vesselName = vesselId ? getVesselName(vesselId) : null;
        
        // Check if crew is on leave (case-insensitive check for various status formats)
        const status = crew.status || '';
        const isOnLeave = status.toLowerCase().includes('leave') || 
                          status.toLowerCase().includes('available') ||
                          !vesselId;
        const vesselLeave = isOnLeave ? 'On Leave' : (vesselName || vesselId || '-');
        
        // Calculate actual age from DOB
        const dobString = crew.dateOfBirth || crew.dob || '-';
        const calculatedAge = calculateAge(dobString);
        
        // Determine age status based on promotion rank requirements
        let ageStatus: 'met' | 'pending' | 'not-met' = 'pending';
        if (calculatedAge !== null && nextRank) {
          const normalizedNextRank = normalizeRank(nextRank);
          const ageReq = ageRequirementsByRank.get(normalizedNextRank);
          if (ageReq) {
            const meetsMin = !ageReq.ageMin || calculatedAge >= ageReq.ageMin;
            const meetsMax = !ageReq.ageMax || calculatedAge <= ageReq.ageMax;
            ageStatus = (meetsMin && meetsMax) ? 'met' : 'not-met';
          }
        }
        
        return {
          crewId: crew.employeeId || crew.id || '-',
          crewMemberId: crew.id, // Database ID for API calls
          name: `${crew.firstName || 'Unknown'} ${crew.middleInitial || ''} ${crew.familyName || ''}`.trim(),
          dob: dobString,
          ageValue: calculatedAge !== null ? calculatedAge : '-', // Numeric age for downstream use
          age: ageStatus, // Status indicator for Age column ('met', 'pending', 'not-met')
          nationality: crew.nationality || 'Unknown',
          currentRank: currentRank,
          promotionToRank: nextRank || '-',
          vesselLeave: vesselLeave,
          presentVessel: vesselId || null, // Vessel ID for vessel type lookup
          license: ['met', 'pending', 'met'][index % 3],
          sea: ['met', 'pending', 'met'][index % 3],
          reco: ['met', 'pending', 'met'][index % 3],
          promotionChecklist: [40, 75, 80, 60, 45, 90, 85, 50][index % 8],
          otherCriteria: ['met', 'pending', 'met'][index % 3],
          cesIndex: ['met', 'pending', 'not-met'][index % 3],
          trainDocs: ['met', 'pending', 'not-met'][index % 3],
          status: ['In Progress', 'For Approval', 'Approved'][index % 3],
        };
      })
      .filter(item => item !== null); // Remove filtered out crew members
  }, [crewMembers, hierarchies, getVesselName, normalizeRank, ageRequirementsByRank]);

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

  const handleEditPromotion = useCallback((data: any) => {
    setSelectedPromotion(data);
  }, []);

  const columnDefs: ColDef[] = useMemo(() => [
    {
      headerName: 'Crew ID',
      field: 'crewId',
      width: 110,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      sortable: true,
      resizable: false
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
      headerName: 'Next Promotion Rank',
      field: 'promotionToRank',
      width: 170,
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
      width: 100,
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
      width: 90,
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
      width: 90,
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
      width: 90,
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
      cellRendererParams: {
        onEdit: handleEditPromotion
      },
      sortable: false,
      resizable: false
    }
  ], [handleEditPromotion]);

  const handleGridReady = (event: GridReadyEvent) => {
    setGridApi(event.api);
  };

  const handleCloseForm = useCallback(() => {
    setSelectedPromotion(null);
  }, []);

  return (
    <div className="flex flex-col flex-1">
      <AgGridTable
        rowData={filteredData}
        columnDefs={columnDefs}
        onGridReady={handleGridReady}
        loading={isLoading || isLoadingHierarchies}
        fillAvailableHeight={true}
        bottomPadding={60}
        data-testid="promotions-table"
      />
      
      {/* Pagination info */}
      <div className="flex justify-between items-center px-4 py-2 text-sm text-gray-600">
        <div>
          {filteredData.length > 0 ? `0 to ${filteredData.length} of ${filteredData.length}` : '0 to 0 of 0'}
        </div>
        <div>
          Page {filteredData.length > 0 ? '1' : '0'} of {filteredData.length > 0 ? '1' : '0'}
        </div>
      </div>

      {/* Promotion Review Form Dialog */}
      {selectedPromotion && (
        <PromotionReviewForm
          promotionData={selectedPromotion}
          onClose={handleCloseForm}
        />
      )}
    </div>
  );
};
