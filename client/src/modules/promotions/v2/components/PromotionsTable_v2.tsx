import { useState, useMemo, useCallback } from 'react';
import { ColDef, ICellRendererParams, GridApi } from 'ag-grid-community';
import { useQuery } from '@tanstack/react-query';
import AgGridTable from '@/components/AgGrid/AgGridTable';
import { Button } from '@/components/ui/button';
import { Edit } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useVesselLookup } from '@/hooks/useVesselLookup';
import { useRankNormalization } from '@/hooks/useRankNormalization';
import { findNextPromotionRank, shouldShowInPromotionsTable } from '../../promotionUtils';
import { calculateChecklistProgressFromJson } from '../../checklistProgressUtils';
import { PromotionReviewForm } from '../../PromotionReviewForm';

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
  if (!birthDate) birthDate = new Date(dob);
  if (!birthDate || isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
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
      <div className={`w-3 h-3 rounded-full ${getColorClass()}`} data-testid={`status-indicator-${params.colDef?.field}`} />
    </div>
  );
};

const FormStatusRenderer = (params: ICellRendererParams) => {
  const status = params.value;
  const getBadgeClass = () => {
    switch (status) {
      case 'In Progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'For Approval': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'Approved': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };
  return (
    <div className="flex items-center justify-center h-full">
      <span className={`px-2 py-1 rounded text-xs font-medium ${getBadgeClass()}`}>{status}</span>
    </div>
  );
};

const EditButtonRenderer = (params: ICellRendererParams & { onEdit?: (data: any) => void }) => {
  const handleEditClick = () => {
    if (params.onEdit) params.onEdit(params.data);
  };
  return (
    <div className="flex items-center justify-center h-full">
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-gray-100" onClick={handleEditClick} data-testid={`button-edit-${params.data?.crewId}`}>
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
  searchName, promotionToRank, vessel, vesselType, nationality, criteria, status
}) => {
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [selectedPromotion, setSelectedPromotion] = useState<any | null>(null);

  const { getVesselName } = useVesselLookup();
  const { normalizeRank, isLoading: isLoadingRanks } = useRankNormalization();

  const { data: crewMembers = [], isLoading } = useQuery({
    queryKey: ['/api/crew-members'],
    staleTime: REVIEW_DATA_STALE_TIME,
  });

  const { data: hierarchies = [], isLoading: isLoadingHierarchies } = useQuery<any[]>({
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
    queryKey: ['/api/v2/promotions', 'reviews'],
    queryFn: async () => {
      const res = await fetch('/api/v2/promotions/reviews');
      if (!res.ok) throw new Error('Failed to fetch V2 promotion reviews');
      return res.json();
    },
    staleTime: REVIEW_DATA_STALE_TIME,
  });

  const ageRequirementsByRank = useMemo(() => {
    const map = new Map<string, { ageMin?: number; ageMax?: number }>();
    const promotionReviewForm = formsData.find((f: any) => f.name === 'Promotion Review Form');
    if (!promotionReviewForm) return map;
    const formRankGroups = rankGroupsData.filter((rg: any) => rg.formId === promotionReviewForm.id && !rg.archivedAt);
    for (const rg of formRankGroups) {
      let ranks: string[] = [];
      try { ranks = typeof rg.ranks === 'string' ? JSON.parse(rg.ranks) : rg.ranks || []; } catch (e) { ranks = []; }
      let config: any = null;
      try {
        if (rg.configuration) {
          const parsed = typeof rg.configuration === 'string' ? JSON.parse(rg.configuration) : rg.configuration;
          config = parsed?.promotionA2 ?? parsed;
        }
      } catch (e) { config = null; }
      if (config && (config.ageMin || config.ageMax)) {
        for (const rank of ranks) { map.set(normalizeRank(rank), { ageMin: config.ageMin, ageMax: config.ageMax }); }
      }
    }
    return map;
  }, [formsData, rankGroupsData, normalizeRank]);

  const reviewMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const review of promotionReviews) {
      const key = `${review.crewMemberId}__${review.promotionToRank}`;
      let criteriaVerifiedStatus: Record<string, string> = {};
      let criteriaMeetsStatus: Record<string, string> = {};
      let cesTestsData: any[] = [];
      let criteriaComments: Record<string, any[]> = {};
      let trainingNeeds: any[] = [];
      let approvalData: any[] = [];
      let selectedApproversForSubmission: string[] = [];
      let checklistProgressData: any = {};
      try { criteriaVerifiedStatus = JSON.parse(review.criteriaVerifiedStatus || '{}'); } catch {}
      try { criteriaMeetsStatus = JSON.parse(review.criteriaMeetsStatus || '{}'); } catch {}
      try { cesTestsData = JSON.parse(review.cesTestsData || '[]'); } catch {}
      try { criteriaComments = JSON.parse(review.criteriaComments || '{}'); } catch {}
      try { trainingNeeds = JSON.parse(review.trainingNeeds || '[]'); } catch {}
      try { approvalData = JSON.parse(review.approvalData || '[]'); } catch {}
      try { selectedApproversForSubmission = JSON.parse(review.selectedApproversForSubmission || '[]'); } catch {}
      try { checklistProgressData = JSON.parse(review.checklistProgressData || '{}'); } catch {}
      map.set(key, {
        ...review,
        parsedCriteriaVerifiedStatus: criteriaVerifiedStatus,
        parsedCriteriaMeetsStatus: criteriaMeetsStatus,
        parsedCesTestsData: cesTestsData,
        parsedCriteriaComments: criteriaComments,
        parsedTrainingNeeds: trainingNeeds,
        parsedApprovalData: approvalData,
        parsedSelectedApproversForSubmission: selectedApproversForSubmission,
        parsedChecklistProgressData: checklistProgressData,
      });
    }
    return map;
  }, [promotionReviews]);

  const rowData = useMemo(() => {
    if (isLoading || isLoadingHierarchies || isLoadingRanks) return [];
    const rows: any[] = [];
    for (const crew of crewMembers as any[]) {
      const currentRank = crew.presentRank || '';
      if (!shouldShowInPromotionsTable(currentRank, hierarchies)) continue;
      const nextRank = findNextPromotionRank(currentRank, hierarchies);
      if (!nextRank) continue;
      const key = `${crew.id}__${nextRank}`;
      const review = reviewMap.get(key);
      const age = calculateAge(crew.dateOfBirth || '');
      const ageReq = ageRequirementsByRank.get(normalizeRank(nextRank));
      let ageStatus = 'no-info';
      if (age !== null && ageReq) {
        const meetsMin = !ageReq.ageMin || age >= ageReq.ageMin;
        const meetsMax = !ageReq.ageMax || age <= ageReq.ageMax;
        ageStatus = (meetsMin && meetsMax) ? 'met' : 'not-met';
      }

      const getVerifiedStatus = (code: string) => {
        if (!review) return 'no-info';
        const vs = review.parsedCriteriaVerifiedStatus?.[code];
        if (vs === 'yes') return 'met';
        if (vs === 'no') return 'not-met';
        if (vs === 'na') return 'met';
        return 'no-info';
      };

      const getMeetsStatus = (code: string) => {
        if (!review) return 'no-info';
        const ms = review.parsedCriteriaMeetsStatus?.[code];
        if (ms === 'yes') return 'met';
        if (ms === 'no') return 'not-met';
        if (ms === 'pending') return 'pending';
        return 'no-info';
      };

      let checklistStatus = 'no-info';
      if (review) {
        const progress = calculateChecklistProgressFromJson(review.checklistProgressData || '{}');
        if (progress.total > 0) {
          checklistStatus = progress.completed === progress.total ? 'met' : 'pending';
        }
      }

      let cesStatus = 'no-info';
      if (review && review.parsedCesTestsData?.length > 0) {
        const allPassed = review.parsedCesTestsData.every((t: any) => t.result?.toLowerCase() === 'pass');
        cesStatus = allPassed ? 'met' : 'not-met';
      }

      let trainingStatus = 'no-info';
      if (review && review.parsedTrainingNeeds?.length > 0) {
        const allComplete = review.parsedTrainingNeeds.every((n: any) => n.status?.toLowerCase() === 'completed');
        trainingStatus = allComplete ? 'met' : 'pending';
      }

      rows.push({
        crewId: crew.id,
        crewName: `${crew.lastName || ''}, ${crew.firstName || ''}`.trim(),
        presentRank: currentRank,
        promotionToRank: nextRank,
        vessel: getVesselName(crew.vessel) || crew.vessel || '-',
        vesselType: crew.vesselType || '-',
        nationality: crew.nationality || '-',
        age: age ?? '-',
        formStatus: review?.status || 'In Progress',
        a2_1_HigherLicense: getVerifiedStatus('a2.1'),
        a2_2_Age: ageStatus,
        a2_3a_RankExp: getMeetsStatus('a2.3a'),
        a2_3b_VesselTypeExp: getMeetsStatus('a2.3b'),
        a2_3c_CompanyService: getMeetsStatus('a2.3c'),
        a2_3d_TankerExp: getMeetsStatus('a2.3d'),
        a2_4_Recommendations: getVerifiedStatus('a2.4'),
        a2_5_Checklist: checklistStatus,
        a2_6_Other: getVerifiedStatus('a2.6'),
        a2_7_CESTests: cesStatus,
        a2_8_Training: trainingStatus,
        reviewData: review,
        reviewUuid: review?.reviewUuid,
      });
    }
    return rows;
  }, [crewMembers, hierarchies, reviewMap, isLoading, isLoadingHierarchies, isLoadingRanks, getVesselName, normalizeRank, ageRequirementsByRank]);

  const filteredRowData = useMemo(() => {
    let result = rowData;
    if (searchName) result = result.filter(r => r.crewName.toLowerCase().includes(searchName.toLowerCase()));
    if (promotionToRank) result = result.filter(r => r.promotionToRank === promotionToRank);
    if (vessel) result = result.filter(r => r.vessel === vessel || r.vessel === getVesselName(vessel));
    if (vesselType) result = result.filter(r => r.vesselType === vesselType);
    if (nationality) result = result.filter(r => r.nationality === nationality);
    if (status) result = result.filter(r => r.formStatus === status);
    if (criteria) {
      result = result.filter(r => {
        const statuses = [r.a2_1_HigherLicense, r.a2_2_Age, r.a2_3a_RankExp, r.a2_3b_VesselTypeExp, r.a2_3c_CompanyService, r.a2_3d_TankerExp, r.a2_4_Recommendations, r.a2_5_Checklist, r.a2_6_Other, r.a2_7_CESTests, r.a2_8_Training];
        if (criteria === 'met') return statuses.every(s => s === 'met' || s === 'no-info');
        if (criteria === 'pending') return statuses.some(s => s === 'pending');
        if (criteria === 'not-met') return statuses.some(s => s === 'not-met');
        return true;
      });
    }
    return result;
  }, [rowData, searchName, promotionToRank, vessel, vesselType, nationality, criteria, status, getVesselName]);

  const handleEdit = useCallback((data: any) => { setSelectedPromotion(data); }, []);
  const handleCloseForm = useCallback(() => { setSelectedPromotion(null); }, []);

  const columnDefs: ColDef[] = useMemo(() => [
    { field: 'crewId', headerName: 'Crew ID', width: 90, pinned: 'left' as const },
    { field: 'crewName', headerName: 'Name', width: 160, pinned: 'left' as const },
    { field: 'presentRank', headerName: 'Present Rank', width: 120 },
    { field: 'promotionToRank', headerName: 'Promotion to', width: 120 },
    { field: 'vessel', headerName: 'Vessel', width: 130 },
    { field: 'vesselType', headerName: 'Vessel Type', width: 120 },
    { field: 'nationality', headerName: 'Nationality', width: 100 },
    { field: 'age', headerName: 'Age', width: 60 },
    {
      headerName: 'A2 Criteria',
      children: [
        { field: 'a2_1_HigherLicense', headerName: 'A2.1', width: 55, cellRenderer: StatusIndicatorRenderer, headerTooltip: 'Higher License' },
        { field: 'a2_2_Age', headerName: 'A2.2', width: 55, cellRenderer: StatusIndicatorRenderer, headerTooltip: 'Age' },
        { field: 'a2_3a_RankExp', headerName: 'A2.3a', width: 60, cellRenderer: StatusIndicatorRenderer, headerTooltip: 'Rank Experience' },
        { field: 'a2_3b_VesselTypeExp', headerName: 'A2.3b', width: 60, cellRenderer: StatusIndicatorRenderer, headerTooltip: 'Vessel Type Experience' },
        { field: 'a2_3c_CompanyService', headerName: 'A2.3c', width: 60, cellRenderer: StatusIndicatorRenderer, headerTooltip: 'Company Service' },
        { field: 'a2_3d_TankerExp', headerName: 'A2.3d', width: 60, cellRenderer: StatusIndicatorRenderer, headerTooltip: 'Tanker Experience' },
        { field: 'a2_4_Recommendations', headerName: 'A2.4', width: 55, cellRenderer: StatusIndicatorRenderer, headerTooltip: 'Recommendations' },
        { field: 'a2_5_Checklist', headerName: 'A2.5', width: 55, cellRenderer: StatusIndicatorRenderer, headerTooltip: 'Checklist' },
        { field: 'a2_6_Other', headerName: 'A2.6', width: 55, cellRenderer: StatusIndicatorRenderer, headerTooltip: 'Other' },
        { field: 'a2_7_CESTests', headerName: 'A2.7', width: 55, cellRenderer: StatusIndicatorRenderer, headerTooltip: 'CES/Lang Tests' },
        { field: 'a2_8_Training', headerName: 'A2.8', width: 55, cellRenderer: StatusIndicatorRenderer, headerTooltip: 'Training' },
      ],
    },
    { field: 'formStatus', headerName: 'Status', width: 110, cellRenderer: FormStatusRenderer },
    {
      headerName: '',
      width: 50,
      cellRenderer: (params: ICellRendererParams) => EditButtonRenderer({ ...params, onEdit: handleEdit }),
      pinned: 'right' as const,
      sortable: false,
      filter: false,
    },
  ], [handleEdit]);

  if (isLoading || isLoadingHierarchies) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-promotions-v2">
        <div className="text-muted-foreground">Loading promotion data...</div>
      </div>
    );
  }

  return (
    <>
      <AgGridTable
        rowData={filteredRowData}
        columnDefs={columnDefs}
        onGridReady={(params) => setGridApi(params.api)}
        defaultColDef={{ sortable: true, filter: true, resizable: true }}
        pagination={true}
        paginationPageSize={50}
        domLayout="autoHeight"
        suppressRowClickSelection={true}
        data-testid="promotions-grid-v2"
      />
      {selectedPromotion && (
        <PromotionReviewForm
          crewMemberId={selectedPromotion.crewId}
          promotionToRank={selectedPromotion.promotionToRank}
          crewName={selectedPromotion.crewName}
          onClose={handleCloseForm}
          reviewData={selectedPromotion.reviewData}
        />
      )}
    </>
  );
};
