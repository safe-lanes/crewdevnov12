import React, { useState, useMemo, useCallback } from 'react';
import { ColDef, ICellRendererParams, GridReadyEvent, GridApi, GridOptions } from 'ag-grid-community';
import { useQuery } from '@tanstack/react-query';
import AgGridTable from '@/components/AgGrid/AgGridTable';
import { Button } from '@/components/ui/button';
import { Edit } from 'lucide-react';
import { useVesselLookup } from '@/hooks/useVesselLookup';
import { useRankNormalization } from '@/hooks/useRankNormalization';
import { findNextPromotionRank, shouldShowInPromotionsTable } from './promotionUtils';
import { PromotionHierarchy } from '@shared/schema';
import { PromotionReviewForm } from './PromotionReviewForm';

// Stale time constants for React Query caching (in milliseconds)
const REFERENCE_DATA_STALE_TIME = 10 * 60 * 1000; // 10 minutes for slow-changing data
const REVIEW_DATA_STALE_TIME = 2 * 60 * 1000; // 2 minutes for promotion reviews

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
// Green = 'met' (Yes in form), Yellow = 'pending' or 'not-met' (No/Pending in form), Grey = 'no-info' (no data)
const StatusIndicatorRenderer = (params: ICellRendererParams) => {
  const status = params.value;
  
  const getColorClass = () => {
    switch (status) {
      case 'met': return 'bg-green-500';       // Green: Yes/Met
      case 'pending': return 'bg-yellow-500';   // Yellow: Pending
      case 'not-met': return 'bg-yellow-500';   // Yellow: No/Not Met
      case 'no-info': return 'bg-gray-400';     // Grey: No information
      default: return 'bg-gray-400';            // Grey: Default for missing data
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
        data-testid={`button-edit-${params.data?.crewId}`}
      >
        <Edit className="h-4 w-4 text-gray-600" />
      </Button>
    </div>
  );
};

interface PromotionsTableProps {
  searchName: string;
  promotionToRank: string;
  vessel: string;
  vesselType: string;
  nationality: string;
  criteria: string;
  status: string;
}

export const PromotionsTable: React.FC<PromotionsTableProps> = ({
  searchName,
  promotionToRank,
  vessel,
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
    staleTime: REVIEW_DATA_STALE_TIME,
  });

  // Fetch promotion hierarchies (reference data - slow changing)
  const { data: hierarchies = [], isLoading: isLoadingHierarchies } = useQuery<PromotionHierarchy[]>({
    queryKey: ['/api/promotion-hierarchies'],
    staleTime: REFERENCE_DATA_STALE_TIME,
  });

  // Fetch forms to find Promotion Review Form (reference data - slow changing)
  const { data: formsData = [] } = useQuery<any[]>({
    queryKey: ['/api/forms'],
    staleTime: REFERENCE_DATA_STALE_TIME,
  });

  // Fetch all rank groups for age criteria lookup (reference data - slow changing)
  const { data: rankGroupsData = [] } = useQuery<any[]>({
    queryKey: ['/api/rank-groups'],
    staleTime: REFERENCE_DATA_STALE_TIME,
  });

  // Fetch all promotion reviews to map criteria status to table columns
  const { data: promotionReviews = [] } = useQuery<any[]>({
    queryKey: ['/api/promotion-reviews'],
    staleTime: REVIEW_DATA_STALE_TIME,
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

  // Build lookup map from crewMemberId + promotionToRank -> promotion review
  // Pre-parse JSON fields once to avoid repeated parsing in cell renderers
  const reviewLookup = useMemo(() => {
    const map = new Map<string, any>();
    for (const review of promotionReviews) {
      const key = `${review.crewMemberId}__${review.promotionToRank}`;
      
      // Pre-parse criteriaMeetsStatus
      let parsedMeetsStatus: Record<string, string> = {};
      try {
        parsedMeetsStatus = review.criteriaMeetsStatus 
          ? (typeof review.criteriaMeetsStatus === 'string' 
              ? JSON.parse(review.criteriaMeetsStatus) 
              : review.criteriaMeetsStatus)
          : {};
      } catch (e) {
        parsedMeetsStatus = {};
      }
      
      // Pre-parse criteriaVerifiedStatus
      let parsedVerifiedStatus: Record<string, string> = {};
      try {
        parsedVerifiedStatus = review.criteriaVerifiedStatus 
          ? (typeof review.criteriaVerifiedStatus === 'string' 
              ? JSON.parse(review.criteriaVerifiedStatus) 
              : review.criteriaVerifiedStatus)
          : {};
      } catch (e) {
        parsedVerifiedStatus = {};
      }
      
      // Pre-parse cesTestsData
      let parsedCesTests: any[] = [];
      try {
        parsedCesTests = review.cesTestsData 
          ? (typeof review.cesTestsData === 'string' 
              ? JSON.parse(review.cesTestsData) 
              : review.cesTestsData)
          : [];
      } catch (e) {
        parsedCesTests = [];
      }
      
      // Store review with pre-parsed fields
      map.set(key, {
        ...review,
        _parsedMeetsStatus: parsedMeetsStatus,
        _parsedVerifiedStatus: parsedVerifiedStatus,
        _parsedCesTests: parsedCesTests,
      });
    }
    return map;
  }, [promotionReviews]);

  // Helper to compute criteria status from review data using pre-parsed criteriaMeetsStatus
  // Returns: 'met' (Green), 'pending' (Yellow), 'not-met' (Yellow), 'no-info' (Grey)
  const computeCriteriaStatus = useCallback((review: any, criteriaId: string): 'met' | 'pending' | 'not-met' | 'no-info' => {
    if (!review) return 'no-info';
    
    // Use pre-parsed data (no JSON.parse per call)
    const meetsStatus = review._parsedMeetsStatus || {};
    const meets = meetsStatus[criteriaId];
    
    // Map stored values to return status per user spec:
    // 'yes' → met (Green), 'no' or 'pending' → pending (Yellow)
    if (meets === 'yes') return 'met';
    if (meets === 'no' || meets === 'pending') return 'pending';
    
    // Fallback: Check pre-parsed verifiedStatus if criteriaMeetsStatus not available
    const verifiedStatus = review._parsedVerifiedStatus || {};
    const verified = verifiedStatus[criteriaId];
    if (verified === 'yes') return 'met';
    if (verified === 'na') return 'met';
    if (Object.keys(verifiedStatus).length > 0 || Object.keys(meetsStatus).length > 0) return 'pending';
    
    return 'no-info';
  }, []);

  // Helper to compute parent criteria status (a2.3, a2.6, a2.7) from children using pre-parsed criteriaMeetsStatus
  const computeParentCriteriaStatus = useCallback((review: any, parentId: string): 'met' | 'pending' | 'not-met' | 'no-info' => {
    if (!review) return 'no-info';
    
    // Use pre-parsed data (no JSON.parse per call)
    const meetsStatus = review._parsedMeetsStatus || {};
    
    // For CES tests (a2.7), check the computed status first
    if (parentId === 'a2.7') {
      const cesStatus = meetsStatus['a2.7'];
      if (cesStatus === 'yes') return 'met';
      // Per user spec: 'No' or 'Pending' → Yellow dot, so both map to 'pending'
      if (cesStatus === 'no' || cesStatus === 'pending') return 'pending';
      
      // Fallback: Check pre-parsed cesTestsData directly if no computed status
      const cesTests = review._parsedCesTests || [];
      
      if (cesTests.length === 0) return 'no-info';
      
      const results = cesTests.map((t: any) => t.result || '');
      // All Pass/NA → met (Green), otherwise → pending (Yellow)
      if (results.every((r: string) => r === 'Pass' || r === 'NA')) return 'met';
      return 'pending';
    }
    
    // For other parent criteria (a2.3, a2.6), check children in meetsStatus
    const childIds = Object.keys(meetsStatus).filter(
      id => id.startsWith(parentId) && id.length > parentId.length
    );
    
    // If no children in meetsStatus, check if parent itself has a value
    if (childIds.length === 0) {
      const parentValue = meetsStatus[parentId];
      if (parentValue === 'yes') return 'met';
      // Per user spec: 'No' or 'Pending' → Yellow dot
      if (parentValue === 'no' || parentValue === 'pending') return 'pending';
      
      // Check if any data exists in the review
      if (Object.keys(meetsStatus).length > 0) return 'pending';
      return 'no-info';
    }
    
    const childValues = childIds.map(id => meetsStatus[id] || '');
    // If all children are 'yes', parent is met (Green)
    if (childValues.every(v => v === 'yes')) return 'met';
    // Otherwise → pending (Yellow) per user spec
    return 'pending';
  }, []);

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
        
        // Look up promotion review for this crew member and target rank
        const reviewKey = `${crew.id}__${nextRank}`;
        const review = reviewLookup.get(reviewKey);
        
        // Compute status for each criteria column from review data
        // License (A2.1): Single criterion - check verified status
        const licenseStatus = computeCriteriaStatus(review, 'a2.1');
        
        // Sea Experience (A2.3): Parent criterion - check all children (a2.3a, a2.3b, a2.3c, a2.3d)
        const seaStatus = computeParentCriteriaStatus(review, 'a2.3');
        
        // Recommendations (A2.4): Single criterion - check verified status
        const recoStatus = computeCriteriaStatus(review, 'a2.4');
        
        // Promotion Checklist (A2.5): Progress percentage from checklistProgress field
        let checklistProgress = 0;
        if (review?.checklistProgress !== undefined && review?.checklistProgress !== null) {
          checklistProgress = typeof review.checklistProgress === 'number' 
            ? review.checklistProgress 
            : parseInt(review.checklistProgress) || 0;
        }
        
        // Other Criteria (A2.6): Parent criterion - check all children (a2.6a, a2.6b)
        const otherCriteriaStatus = computeParentCriteriaStatus(review, 'a2.6');
        
        // CES Index (A2.7): Check cesTestsData for test results
        const cesIndexStatus = computeParentCriteriaStatus(review, 'a2.7');
        
        // Training & Docs (A2.8): Single criterion - check verified status
        const trainDocsStatus = computeCriteriaStatus(review, 'a2.8');
        
        // Determine overall review status
        const reviewStatus = review?.status || 'In Progress';
        
        return {
          crewId: crew.employeeId || crew.id || '-',
          crewMemberId: crew.id, // Database ID for API calls
          promotionReviewId: review?.id || null, // Persisted promotion review ID from database
          name: `${crew.firstName || 'Unknown'} ${crew.middleInitial || ''} ${crew.familyName || ''}`.trim(),
          dob: dobString,
          ageValue: calculatedAge !== null ? calculatedAge : '-', // Numeric age for downstream use
          age: ageStatus, // Status indicator for Age column ('met', 'pending', 'not-met')
          nationality: crew.nationality || 'Unknown',
          currentRank: currentRank,
          promotionToRank: nextRank || '-',
          vesselLeave: vesselLeave,
          presentVessel: vesselId || null, // Vessel ID for vessel type lookup
          license: licenseStatus,
          sea: seaStatus,
          reco: recoStatus,
          promotionChecklist: checklistProgress,
          otherCriteria: otherCriteriaStatus,
          cesIndex: cesIndexStatus,
          trainDocs: trainDocsStatus,
          status: reviewStatus,
        };
      })
      .filter(item => item !== null); // Remove filtered out crew members
  }, [crewMembers, hierarchies, getVesselName, normalizeRank, ageRequirementsByRank, reviewLookup, computeCriteriaStatus, computeParentCriteriaStatus]);

  // Filter data based on filters
  const filteredData = useMemo(() => {
    return promotionData.filter(item => {
      const matchesName = !searchName || item.name.toLowerCase().includes(searchName.toLowerCase());
      const matchesRank = !promotionToRank || item.promotionToRank === promotionToRank;
      // Match vessel by ID or by name (using getVesselName lookup)
      const selectedVesselName = vessel ? getVesselName(vessel) : null;
      const matchesVessel = !vessel || 
        item.presentVessel === vessel || 
        (selectedVesselName && item.vesselLeave === selectedVesselName);
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

      return matchesName && matchesRank && matchesVessel && matchesVesselType && matchesNationality && matchesCriteria && matchesStatus;
    });
  }, [promotionData, searchName, promotionToRank, vessel, vesselType, nationality, criteria, status, getVesselName]);

  const handleEditPromotion = useCallback((data: any) => {
    setSelectedPromotion(data);
  }, []);

  const columnDefs: ColDef[] = useMemo(() => [
    {
      headerName: 'Crew ID',
      field: 'crewId',
      minWidth: 110,
      flex: 1,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      sortable: true,
      resizable: true,
      hide: true
    },
    {
      headerName: 'Name',
      field: 'name',
      minWidth: 150,
      flex: 2,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      sortable: true,
      resizable: true
    },
    {
      headerName: 'DOB',
      field: 'dob',
      minWidth: 100,
      flex: 1,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      sortable: true,
      resizable: true,
      hide: true
    },
    {
      headerName: 'Nationality',
      field: 'nationality',
      minWidth: 100,
      flex: 1.5,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      sortable: true,
      resizable: true
    },
    {
      headerName: 'Next Promotion Rank',
      field: 'promotionToRank',
      minWidth: 140,
      flex: 2,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      sortable: true,
      resizable: true
    },
    {
      headerName: 'Vessel/ Leave',
      field: 'vesselLeave',
      minWidth: 110,
      flex: 1.5,
      cellStyle: (params) => ({
        fontSize: '13px',
        color: params.value === 'On Leave' ? '#3b82f6' : '#4f5863'
      }),
      sortable: true,
      resizable: true
    },
    {
      headerName: 'License',
      field: 'license',
      width: 55,
      cellRenderer: StatusIndicatorRenderer,
      sortable: true,
      resizable: false,
      wrapHeaderText: false,
      autoHeaderHeight: false,
      headerClass: 'vertical-header'
    },
    {
      headerName: 'Age',
      field: 'age',
      width: 55,
      cellRenderer: StatusIndicatorRenderer,
      sortable: true,
      resizable: false,
      wrapHeaderText: false,
      autoHeaderHeight: false,
      headerClass: 'vertical-header'
    },
    {
      headerName: 'Service',
      field: 'sea',
      width: 55,
      cellRenderer: StatusIndicatorRenderer,
      sortable: true,
      resizable: false,
      wrapHeaderText: false,
      autoHeaderHeight: false,
      headerClass: 'vertical-header'
    },
    {
      headerName: 'Recom.',
      field: 'reco',
      width: 55,
      cellRenderer: StatusIndicatorRenderer,
      sortable: true,
      resizable: false,
      wrapHeaderText: false,
      autoHeaderHeight: false,
      headerClass: 'vertical-header'
    },
    {
      headerName: 'Promotion Checklist',
      field: 'promotionChecklist',
      minWidth: 120,
      flex: 1.5,
      cellRenderer: ProgressBarRenderer,
      sortable: true,
      resizable: true
    },
    {
      headerName: 'Other',
      field: 'otherCriteria',
      width: 55,
      cellRenderer: StatusIndicatorRenderer,
      sortable: true,
      resizable: false,
      wrapHeaderText: false,
      autoHeaderHeight: false,
      headerClass: 'vertical-header'
    },
    {
      headerName: 'CES',
      field: 'cesIndex',
      width: 55,
      cellRenderer: StatusIndicatorRenderer,
      sortable: true,
      resizable: false,
      wrapHeaderText: false,
      autoHeaderHeight: false,
      headerClass: 'vertical-header'
    },
    {
      headerName: 'Train',
      field: 'trainDocs',
      width: 55,
      cellRenderer: StatusIndicatorRenderer,
      sortable: true,
      resizable: false,
      wrapHeaderText: false,
      autoHeaderHeight: false,
      headerClass: 'vertical-header'
    },
    {
      headerName: 'Status',
      field: 'status',
      minWidth: 100,
      flex: 1,
      cellRenderer: StatusBadgeRenderer,
      sortable: true,
      resizable: true
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

  // AG Grid performance options - memoized to prevent reference changes
  const gridPerformanceOptions: Partial<GridOptions> = useMemo(() => ({
    suppressAnimationFrame: true, // Reduces layout thrashing
    rowBuffer: 10, // Reduced from default 20 for 30+ row tables
    debounceVerticalScrollbar: true, // Smoother scrolling
    headerHeight: 60, // Taller header to accommodate vertical text columns
  }), []);

  return (
    <div className="flex flex-col flex-1">
      <AgGridTable
        rowData={filteredData}
        columnDefs={columnDefs}
        onGridReady={handleGridReady}
        loading={isLoading || isLoadingHierarchies}
        fillAvailableHeight={true}
        bottomPadding={60}
        gridOptions={gridPerformanceOptions}
        className="vertical-headers-grid"
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
