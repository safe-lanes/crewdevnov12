import { useState, useMemo, useCallback } from 'react';
import { ColDef, ICellRendererParams, GridReadyEvent, GridApi, GridOptions } from 'ag-grid-community';
import { useQuery } from '@tanstack/react-query';
import AgGridTable from '@/components/AgGrid/AgGridTable';
import { Button } from '@/components/ui/button';
import { Edit } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useVesselLookup } from '@/hooks/useVesselLookup';
import { useRankNormalization } from '@/hooks/useRankNormalization';
import { findNextPromotionRank, shouldShowInPromotionsTable } from '../../promotionUtils';
import { calculateChecklistProgressFromJson } from '../../checklistProgressUtils';
import { PromotionHierarchy } from '@shared/schema';
import { PromotionReviewForm_v2 } from './PromotionReviewForm_v2';

const REFERENCE_DATA_STALE_TIME = 10 * 60 * 1000;
const REVIEW_DATA_STALE_TIME = 2 * 60 * 1000;

const calculateAge = (dob: string): number | null => {
  if (!dob || dob === '-') return null;
  
  let birthDate: Date | null = null;
  
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
  
  if (!birthDate) {
    birthDate = new Date(dob);
  }
  
  if (!birthDate || isNaN(birthDate.getTime())) {
    return null;
  }
  
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

const StatusIndicatorRenderer = (params: ICellRendererParams) => {
  const status = params.value;
  
  const getColorClass = () => {
    switch (status) {
      case 'met': return 'bg-green-500';
      case 'pending': return 'bg-yellow-500';
      case 'not-met': return 'bg-yellow-500';
      case 'no-info': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="flex items-center justify-center h-full">
      <div className={`w-3 h-3 rounded-full ${getColorClass()}`} />
    </div>
  );
};

const ProgressBarRenderer = (params: ICellRendererParams) => {
  const progressData = params.data?.checklistProgressData;
  const meetsThreshold = progressData?.meetsThreshold ?? false;
  const percentage = progressData?.percentage ?? 0;
  
  const barColor = meetsThreshold ? 'bg-green-500' : 'bg-[#EAB308]';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div 
          className="flex items-center justify-center h-full px-2 cursor-pointer"
          data-testid={`progress-bar-tooltip-${params.data?.crewId}`}
        >
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${barColor}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{percentage}% ({progressData?.completedVerifications ?? 0}/{progressData?.totalRequired ?? 0} Verifications)</p>
      </TooltipContent>
    </Tooltip>
  );
};

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

export const PromotionsTable_v2: React.FC<PromotionsTableProps> = ({
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
  
  const { getVesselName } = useVesselLookup();
  
  const { normalizeRank, isLoading: isLoadingRanks } = useRankNormalization();

  const { data: crewMembers = [], isLoading } = useQuery({
    queryKey: ['/api/v2/crew-pool/crew/enriched'],
    staleTime: REVIEW_DATA_STALE_TIME,
  });

  const { data: hierarchies = [], isLoading: isLoadingHierarchies } = useQuery<PromotionHierarchy[]>({
    queryKey: ['/api/v2/admin/promotion-hierarchies'],
    staleTime: REFERENCE_DATA_STALE_TIME,
  });

  const { data: formsData = [] } = useQuery<any[]>({
    queryKey: ['/api/v2/admin/forms'],
    staleTime: REFERENCE_DATA_STALE_TIME,
  });

  const { data: rankGroupsData = [] } = useQuery<any[]>({
    queryKey: ['/api/v2/admin/rank-groups'],
    staleTime: REFERENCE_DATA_STALE_TIME,
  });

  const { data: promotionReviews = [] } = useQuery<any[]>({
    queryKey: ['/api/v2/promotions/reviews'],
    staleTime: REVIEW_DATA_STALE_TIME,
  });

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

  const reviewLookup = useMemo(() => {
    const map = new Map<string, any>();
    for (const review of promotionReviews) {
      const key = `${review.crewMemberId}__${review.promotionToRank}`;
      
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
      
      map.set(key, {
        ...review,
        _parsedMeetsStatus: parsedMeetsStatus,
        _parsedVerifiedStatus: parsedVerifiedStatus,
        _parsedCesTests: parsedCesTests,
      });
    }
    return map;
  }, [promotionReviews]);

  const computeCriteriaStatus = useCallback((review: any, criteriaId: string): 'met' | 'pending' | 'not-met' | 'no-info' => {
    if (!review) return 'no-info';
    
    const meetsStatus = review._parsedMeetsStatus || {};
    const meetsRaw = meetsStatus[criteriaId];
    const meets = typeof meetsRaw === 'string' ? meetsRaw.toLowerCase() : meetsRaw;
    
    if (meets === 'yes') return 'met';
    if (meets === 'no' || meets === 'pending') return 'pending';
    
    const verifiedStatus = review._parsedVerifiedStatus || {};
    const verified = verifiedStatus[criteriaId];
    if (verified === 'yes') return 'met';
    if (verified === 'na') return 'met';
    if (Object.keys(verifiedStatus).length > 0 || Object.keys(meetsStatus).length > 0) return 'pending';
    
    return 'no-info';
  }, []);

  const computeParentCriteriaStatus = useCallback((review: any, parentId: string): 'met' | 'pending' | 'not-met' | 'no-info' => {
    if (!review) return 'no-info';
    
    const meetsStatus = review._parsedMeetsStatus || {};
    
    const normalize = (val: any) => typeof val === 'string' ? val.toLowerCase() : val;
    
    if (parentId === 'a2.7') {
      const cesStatus = normalize(meetsStatus['a2.7']);
      if (cesStatus === 'yes') return 'met';
      if (cesStatus === 'no' || cesStatus === 'pending') return 'pending';
      
      const cesTests = review._parsedCesTests || [];
      
      if (cesTests.length === 0) return 'no-info';
      
      const results = cesTests.map((t: any) => t.result || '');
      if (results.every((r: string) => r === 'Pass' || r === 'NA')) return 'met';
      return 'pending';
    }
    
    const childIds = Object.keys(meetsStatus).filter(
      id => id.startsWith(parentId) && id.length > parentId.length
    );
    
    if (childIds.length === 0) {
      const parentValue = normalize(meetsStatus[parentId]);
      if (parentValue === 'yes') return 'met';
      if (parentValue === 'no' || parentValue === 'pending') return 'pending';
      
      if (Object.keys(meetsStatus).length > 0) return 'pending';
      return 'no-info';
    }
    
    const childValues = childIds.map(id => normalize(meetsStatus[id]) || '');
    if (childValues.every(v => v === 'yes')) return 'met';
    return 'pending';
  }, []);

  const promotionData = useMemo(() => {
    const members = Array.isArray(crewMembers) ? crewMembers : [];
    if (!members || members.length === 0) return [];

    return members
      .map((crew: any, index: number) => {
        const currentRank = crew.presentRank || crew.rank || '-';
        
        const normalizedRank = normalizeRank(currentRank);
        
        if (!shouldShowInPromotionsTable(normalizedRank, hierarchies)) {
          return null;
        }

        const { nextRank } = findNextPromotionRank(normalizedRank, hierarchies);
        
        const vesselLeave = crew.vesselName ? crew.vesselName : 'On Leave';
        
        const dobString = crew.dob || crew.dateOfBirth || '-';
        const calculatedAge = calculateAge(dobString);
        
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
        
        const crewId = crew.empNo || crew.id;
        const reviewKey = `${crewId}__${nextRank}`;
        const review = reviewLookup.get(reviewKey);
        
        const licenseStatus = computeCriteriaStatus(review, 'a2.1');
        
        const seaStatus = computeParentCriteriaStatus(review, 'a2.3');
        
        const recoStatus = computeCriteriaStatus(review, 'a2.4');
        
        const checklistProgressResult = calculateChecklistProgressFromJson(
          review?.checklistProgressData,
          0,
          100
        );
        
        const otherCriteriaStatus = computeParentCriteriaStatus(review, 'a2.6');
        
        const cesIndexStatus = computeParentCriteriaStatus(review, 'a2.7');
        
        const trainDocsStatus = computeCriteriaStatus(review, 'a2.8');
        
        const reviewStatus = review?.status || 'In Progress';
        
        return {
          crewId: crew.employeeId || crew.empNo || '-',
          crewMemberId: crewId,
          promotionReviewId: review?.id || null,
          name: `${crew.firstName || 'Unknown'} ${crew.middleName || ''} ${crew.familyName || ''}`.trim(),
          dob: dobString,
          ageValue: calculatedAge !== null ? calculatedAge : '-',
          age: ageStatus,
          nationality: crew.nationalityName || crew.nationality || 'Unknown',
          currentRank: currentRank,
          promotionToRank: nextRank || '-',
          vesselLeave: vesselLeave,
          presentVessel: crew.vesselUuid || null,
          license: licenseStatus,
          sea: seaStatus,
          reco: recoStatus,
          promotionChecklist: checklistProgressResult.percentage,
          checklistProgressData: checklistProgressResult,
          otherCriteria: otherCriteriaStatus,
          cesIndex: cesIndexStatus,
          trainDocs: trainDocsStatus,
          status: reviewStatus,
        };
      })
      .filter(item => item !== null);
  }, [crewMembers, hierarchies, normalizeRank, ageRequirementsByRank, reviewLookup, computeCriteriaStatus, computeParentCriteriaStatus]);

  const filteredData = useMemo(() => {
    return promotionData.filter(item => {
      const matchesName = !searchName || item.name.toLowerCase().includes(searchName.toLowerCase());
      const matchesRank = !promotionToRank || item.promotionToRank === promotionToRank;
      const selectedVesselName = vessel ? getVesselName(vessel) : null;
      const matchesVessel = !vessel || 
        item.presentVessel === vessel || 
        (selectedVesselName && item.vesselLeave === selectedVesselName);
      const matchesNationality = !nationality || item.nationality === nationality;
      const matchesStatus = !status || item.status === status;
      
      const matchesVesselType = true;
      
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

  const gridPerformanceOptions: Partial<GridOptions> = useMemo(() => ({
    suppressAnimationFrame: true,
    rowBuffer: 10,
    debounceVerticalScrollbar: true,
    headerHeight: 60,
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
        data-testid="promotions-v2-table"
      />
      
      <div className="flex justify-between items-center px-4 py-2 text-sm text-gray-600">
        <div>
          {filteredData.length > 0 ? `0 to ${filteredData.length} of ${filteredData.length}` : '0 to 0 of 0'}
        </div>
        <div>
          Page {filteredData.length > 0 ? '1' : '0'} of {filteredData.length > 0 ? '1' : '0'}
        </div>
      </div>

      {selectedPromotion && (
        <PromotionReviewForm_v2
          promotionData={selectedPromotion}
          onClose={handleCloseForm}
        />
      )}
    </div>
  );
};
