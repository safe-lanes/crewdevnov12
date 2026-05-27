import { useState, useMemo, useCallback, useEffect } from 'react';
import { usePermissions } from '@/contexts/PermissionsContext';
import { ColDef, ICellRendererParams, GridReadyEvent, GridApi, GridOptions } from 'ag-grid-community';
import { useQuery } from '@tanstack/react-query';
import AgGridTable from '@/components/AgGrid/AgGridTable';
import AgGridTableActions from '@/components/AgGrid/AgGridTableActions';
import { Button } from '@/components/ui/button';
import { Edit } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useVesselLookup } from '@/hooks/useVesselLookup';
import { useRankNormalization } from '@/hooks/useRankNormalization';
import { findNextPromotionRank, shouldShowInPromotionsTable } from './promotionUtils';
import { calculateChecklistProgressFromJson } from './checklistProgressUtils';
import { PromotionHierarchy } from '@shared/schema';
import { PromotionReviewForm } from './PromotionReviewForm';

const REFERENCE_DATA_STALE_TIME = 10 * 60 * 1000;
const REVIEW_DATA_STALE_TIME = 2 * 60 * 1000;

const PROMOTION_STATUS_BY_KEY: Record<string, 'Draft' | 'In Progress' | 'Submitted' | 'Approved' | 'Completed'> = {
  'draft': 'Draft',
  'in progress': 'In Progress',
  'submitted': 'Submitted',
  'for approval': 'Submitted',
  'approved': 'Approved',
  'completed': 'Completed',
};

const normalizePromotionStatus = (raw?: string | null): 'Draft' | 'In Progress' | 'Submitted' | 'Approved' | 'Completed' =>
  PROMOTION_STATUS_BY_KEY[(raw ?? '').trim().toLowerCase()] ?? 'In Progress';

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

const ProgressBarRenderer = (params: ICellRendererParams & { onEdit?: (data: any) => void }) => {
  const progressData = params.data?.checklistProgressData;
  const meetsThreshold = progressData?.meetsThreshold ?? false;
  const percentage = progressData?.percentage ?? 0;
  
  const barColor = meetsThreshold ? 'bg-green-500' : 'bg-[#EAB308]';

  const handleClick = () => {
    if (params.onEdit) {
      params.onEdit({ ...params.data, initialSection: 'checklist' });
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div 
          className="flex items-center justify-center h-full px-2 cursor-pointer"
          data-testid={`progress-bar-tooltip-${params.data?.crewId}`}
          onClick={handleClick}
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
      case 'Draft': return 'bg-gray-100 text-gray-800';
      case 'In Progress': return 'bg-yellow-100 text-yellow-800';
      case 'Submitted': return 'bg-blue-100 text-blue-800';
      case 'Approved': return 'bg-green-100 text-green-800';
      case 'Completed': return 'bg-green-100 text-green-800';
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
  initialReviewUuid?: string | null;
  onInitialReviewConsumed?: () => void;
}

export const PromotionsTable: React.FC<PromotionsTableProps> = ({
  searchName,
  promotionToRank,
  vessel,
  vesselType,
  nationality,
  criteria,
  status,
  initialReviewUuid,
  onInitialReviewConsumed,
}) => {
  const { canEdit: canEditPerm, permissions } = usePermissions();
  const { toast } = useToast();
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [selectedPromotion, setSelectedPromotion] = useState<any | null>(null);
  
  const { getVesselName, getVessel } = useVesselLookup();
  
  const { normalizeRank, isLoading: isLoadingRanks } = useRankNormalization();

  const { data: crewMembers = [], isLoading } = useQuery({
    queryKey: ['/api/v2/crew-pool/crew/enriched'],
    staleTime: REVIEW_DATA_STALE_TIME,
  });

  const { data: hierarchies = [], isLoading: isLoadingHierarchies } = useQuery<PromotionHierarchy[]>({
    queryKey: ['/api/v2/admin/promotion-hierarchies'],
    staleTime: REFERENCE_DATA_STALE_TIME,
  });

  const { data: formsData = [], isLoading: isLoadingForms, isFetched: isFormsFetched } = useQuery<any[]>({
    queryKey: ['/api/v2/admin/forms'],
    staleTime: REFERENCE_DATA_STALE_TIME,
  });

  const { data: rankGroupsData = [], isLoading: isLoadingRankGroups, isFetched: isRankGroupsFetched } = useQuery<any[]>({
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

  const checklistConfigByRank = useMemo(() => {
    const map = new Map<string, { minChecklistVerifications: number; minChecklistCompletionPercent: number }>();

    const promotionReviewForm = formsData.find((f: any) => f.name === 'Promotion Review Form');
    if (!promotionReviewForm) return map;

    const formRankGroups = rankGroupsData.filter((rg: any) =>
      rg.formId === promotionReviewForm.id && !rg.archivedAt
    );

    for (const rg of formRankGroups) {
      let ranks: string[] = [];
      try {
        ranks = typeof rg.ranks === 'string' ? JSON.parse(rg.ranks) : rg.ranks || [];
      } catch {
        ranks = [];
      }

      let config: any = null;
      try {
        if (rg.configuration) {
          const parsed = typeof rg.configuration === 'string' ? JSON.parse(rg.configuration) : rg.configuration;
          config = parsed?.promotionA2 ?? parsed;
        }
      } catch {
        config = null;
      }

      if (config) {
        const minVer = Number(config.minChecklistVerifications);
        const minPct = Number(config.minChecklistCompletionPercent);
        const entry = {
          minChecklistVerifications: Number.isFinite(minVer) && minVer > 0 ? minVer : 1,
          minChecklistCompletionPercent: Number.isFinite(minPct) && minPct > 0 ? minPct : 100,
        };
        for (const rank of ranks) {
          map.set(normalizeRank(rank), entry);
        }
      }
    }

    return map;
  }, [formsData, rankGroupsData, normalizeRank]);

  const configuredRankSet = useMemo(() => {
    const set = new Set<string>();
    const promotionReviewForm = formsData.find((f: any) => f.name === 'Promotion Review Form');
    if (!promotionReviewForm) return set;
    const formRankGroups = rankGroupsData.filter((rg: any) =>
      rg.formId === promotionReviewForm.id && !rg.archivedAt
    );
    for (const rg of formRankGroups) {
      let ranks: string[] = [];
      try {
        ranks = typeof rg.ranks === 'string' ? JSON.parse(rg.ranks) : rg.ranks || [];
      } catch {
        ranks = [];
      }
      for (const r of ranks) set.add(normalizeRank(r));
    }
    return set;
  }, [formsData, rankGroupsData, normalizeRank]);

  const isRankGroupConfigured = useCallback((rank: string | undefined | null) => {
    if (!rank) return true;
    // Allow open while reference data is still loading / not yet fetched
    // to avoid false negatives on initial paint.
    if (isLoadingForms || isLoadingRankGroups) return true;
    if (!isFormsFetched || !isRankGroupsFetched) return true;
    return configuredRankSet.has(normalizeRank(rank));
  }, [isLoadingForms, isLoadingRankGroups, isFormsFetched, isRankGroupsFetched, configuredRankSet, normalizeRank]);

  const showMissingRankGroupToast = useCallback((rank: string | undefined | null) => {
    toast({
      title: 'No Promotion Rank Group Assigned',
      description: `No Promotion Review Form rank group has been configured for the rank "${rank ?? ''}" in Admin Module. Please configure a rank group in Admin > Forms Configuration > Promotion Review Form.`,
      variant: 'destructive',
    });
  }, [toast]);

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
    if (meets === 'no') return 'not-met';
    
    if (meets === 'pending') return 'pending';
    
    const verifiedStatus = review._parsedVerifiedStatus || {};
    if (Object.keys(verifiedStatus).length > 0 || Object.keys(meetsStatus).length > 0) return 'pending';
    
    return 'no-info';
  }, []);

  const computeParentCriteriaStatus = useCallback((review: any, parentId: string): 'met' | 'pending' | 'not-met' | 'no-info' => {
    if (!review) return 'no-info';
    
    const meetsStatus = review._parsedMeetsStatus || {};
    
    const normalize = (val: any) => typeof val === 'string' ? val.toLowerCase() : val;
    
    if (parentId === 'a2.7') {
      const cesTests = review._parsedCesTests || [];
      if (cesTests.length > 0) {
        const results = cesTests.map((t: any) => ((t.result || '') as string).trim().toLowerCase());
        const hasMissing = results.some((r: string) => r === '' || r === 'pending');
        if (hasMissing) return 'pending';
        if (results.every((r: string) => r === 'pass' || r === 'na' || r === 'n/a')) return 'met';
        return 'not-met';
      }
      
      const cesStatus = normalize(meetsStatus['a2.7']);
      if (cesStatus === 'yes') return 'met';
      if (cesStatus === 'no') return 'not-met';
      if (cesStatus === 'pending') return 'pending';
      return 'no-info';
    }
    
    if (parentId === 'a2.6') {
      const verifiedStatus = review._parsedVerifiedStatus || {};
      const childIds = Object.keys(verifiedStatus).filter(
        id => id.startsWith(parentId) && id.length > parentId.length
      );
      if (childIds.length > 0) {
        const childVerified = childIds.map(id => (normalize(verifiedStatus[id]) || ''));
        if (childVerified.some(v => v === '')) return 'pending';
        if (childVerified.some(v => v === 'yes')) return 'met';
        if (childVerified.every(v => v === 'na')) return 'met';
        return 'pending';
      }
      const parentVal = normalize(meetsStatus[parentId]);
      if (parentVal === 'yes' || parentVal === 'na') return 'met';
      if (parentVal === 'no') return 'not-met';
      if (parentVal === 'pending') return 'pending';
      return 'no-info';
    }

    const parentValue = normalize(meetsStatus[parentId]);
    if (parentValue === 'yes' || parentValue === 'na') return 'met';
    if (parentValue === 'no') return 'not-met';
    if (parentValue === 'pending') return 'pending';

    const childIds = Object.keys(meetsStatus).filter(
      id => id.startsWith(parentId) && id.length > parentId.length
    );

    if (childIds.length === 0) {
      if (Object.keys(meetsStatus).length > 0) return 'pending';
      return 'no-info';
    }

    const childStatuses = childIds.map(id => {
      const m = normalize(meetsStatus[id]) || '';
      if (m === 'yes' || m === 'na') return 'met';
      if (m === 'no') return 'not-met';
      return 'pending';
    });
    if (childStatuses.some(s => s === 'pending')) return 'pending';
    if (childStatuses.some(s => s === 'not-met')) return 'not-met';
    return 'met';
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
        
        let ageStatus: 'met' | 'pending' | 'not-met' = 'met';
        if (calculatedAge !== null && nextRank) {
          const normalizedNextRank = normalizeRank(nextRank);
          const ageReq = ageRequirementsByRank.get(normalizedNextRank);
          if (ageReq && (ageReq.ageMin || ageReq.ageMax)) {
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
        
        const checklistCfg = nextRank
          ? checklistConfigByRank.get(normalizeRank(nextRank))
          : undefined;
        const checklistProgressResult = calculateChecklistProgressFromJson(
          review?.checklistProgressData,
          checklistCfg?.minChecklistVerifications ?? 1,
          checklistCfg?.minChecklistCompletionPercent ?? 100
        );
        
        const otherCriteriaStatus = computeParentCriteriaStatus(review, 'a2.6');
        
        const cesIndexStatus = computeParentCriteriaStatus(review, 'a2.7');
        
        const trainDocsStatus = computeCriteriaStatus(review, 'a2.8');
        
        const reviewStatus = normalizePromotionStatus(review?.status);
        
        return {
          crewId: crew.employeeId || crew.empNo || '-',
          crewMemberId: crewId,
          promotionReviewId: review?.id || null,
          reviewUuid: review?.reviewUuid || null,
          name: `${crew.firstName || 'Unknown'} ${crew.middleName || ''} ${crew.familyName || ''}`.trim(),
          dob: dobString,
          ageValue: calculatedAge !== null ? calculatedAge : '-',
          age: ageStatus,
          nationality: crew.nationalityName || crew.nationality || 'Unknown',
          currentRank: currentRank,
          promotionToRank: nextRank || '-',
          vesselLeave: vesselLeave,
          presentVessel: crew.vesselUuid || null,
          vesselType: (crew.vesselUuid ? getVessel(crew.vesselUuid)?.vesselType : null) || null,
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
  }, [crewMembers, hierarchies, normalizeRank, ageRequirementsByRank, checklistConfigByRank, reviewLookup, computeCriteriaStatus, computeParentCriteriaStatus, getVessel]);

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
      
      const matchesVesselType = !vesselType || item.vesselType === vesselType;
      
      const criteriaFields = [
        item.license,
        item.age,
        item.sea,
        item.reco,
        item.otherCriteria,
        item.cesIndex,
        item.trainDocs,
      ];
      const checklistMet = item.checklistProgressData?.meetsThreshold === true;
      const isPendingLike = (s: string) => s === 'pending' || s === 'no-info';
      const anyPending = criteriaFields.some(isPendingLike) || !checklistMet;
      let matchesCriteria = true;
      if (criteria === 'met') {
        matchesCriteria = criteriaFields.every(s => s === 'met') && checklistMet;
      } else if (criteria === 'pending') {
        matchesCriteria = anyPending;
      } else if (criteria === 'not-met') {
        matchesCriteria =
          criteriaFields.some(s => s === 'not-met') && !anyPending;
      }

      return matchesName && matchesRank && matchesVessel && matchesVesselType && matchesNationality && matchesCriteria && matchesStatus;
    });
  }, [promotionData, searchName, promotionToRank, vessel, vesselType, nationality, criteria, status, getVesselName]);

  const handleEditPromotion = useCallback((data: any) => {
    if (!isRankGroupConfigured(data?.promotionToRank)) {
      showMissingRankGroupToast(data?.promotionToRank);
      return;
    }
    setSelectedPromotion(data);
  }, [isRankGroupConfigured, showMissingRankGroupToast]);

  const [consumedInitialReviewUuid, setConsumedInitialReviewUuid] = useState<string | null>(null);

  useEffect(() => {
    if (!initialReviewUuid) return;
    if (consumedInitialReviewUuid === initialReviewUuid) return;

    const reviews = Array.isArray(promotionReviews) ? promotionReviews : [];
    const review = reviews.find((r: any) => r?.reviewUuid === initialReviewUuid);
    if (!review) return;

    const projected = (promotionData || []).find(
      (row: any) =>
        row.crewMemberId === review.crewMemberId &&
        row.promotionToRank === review.promotionToRank,
    );

    const basePayload = projected ?? {
      crewId: review.crewMemberId,
      crewMemberId: review.crewMemberId,
      promotionReviewId: review.id ?? null,
      reviewUuid: review.reviewUuid,
      name: '',
      promotionToRank: review.promotionToRank,
      status: review.status || 'In Progress',
    };

    // Tag this opening as deep-linked so the form's Back arrow can use
    // history.back() and restore the dashboard drill-down popup the user
    // came from, instead of just unmounting onto the Promotions list.
    const payload = { ...basePayload, _openedFromDeepLink: true };

    if (!isRankGroupConfigured(payload.promotionToRank)) {
      showMissingRankGroupToast(payload.promotionToRank);
      setConsumedInitialReviewUuid(initialReviewUuid);
      onInitialReviewConsumed?.();
      return;
    }

    setSelectedPromotion(payload);
    setConsumedInitialReviewUuid(initialReviewUuid);
    onInitialReviewConsumed?.();
  }, [
    initialReviewUuid,
    consumedInitialReviewUuid,
    promotionReviews,
    promotionData,
    onInitialReviewConsumed,
    isRankGroupConfigured,
    showMissingRankGroupToast,
  ]);

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
      cellRendererParams: {
        onEdit: handleEditPromotion
      },
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
    ...((permissions.length === 0 || canEditPerm("Promotions All")) ? [{
      headerName: '',
      field: 'edit',
      width: 60,
      cellRenderer: EditButtonRenderer,
      cellRendererParams: {
        onEdit: handleEditPromotion
      },
      sortable: false,
      resizable: false
    }] : [])
  ], [handleEditPromotion, permissions, canEditPerm]);

  const handleGridReady = (event: GridReadyEvent) => {
    setGridApi(event.api);
  };

  const handleCloseForm = useCallback(() => {
    const wasDeepLinked = selectedPromotion?._openedFromDeepLink === true;
    setSelectedPromotion(null);
    // If the form was opened via a deep link from the dashboard drill-down
    // popup, walk one step back in history so the user lands on the dashboard
    // with the popup re-opened, rather than on the Promotions list.
    if (wasDeepLinked && typeof window !== 'undefined') {
      window.history.back();
    }
  }, [selectedPromotion]);

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
        enableStatusBar={false}
        fillAvailableHeight={true}
        bottomPadding={80}
        gridOptions={gridPerformanceOptions}
        className="vertical-headers-grid"
        data-testid="promotions-table"
      />

      <div
        className="bg-white border-t border-gray-200 px-4 py-3 flex justify-between items-center"
        style={{ marginTop: '-1px' }}
        data-testid="promotions-table-footer"
      >
        <div
          className="text-xs font-normal font-['Mulish',Helvetica] text-black"
          data-testid="text-promotions-row-count"
        >
          Rows: {filteredData.length}
        </div>
        <div>
          <AgGridTableActions
            gridApi={gridApi}
            exportFilename="promotions"
            showExportButtons={true}
            showFilterButtons={true}
            showGroupButtons={true}
            showSelectionButtons={false}
          />
        </div>
      </div>

      {selectedPromotion && (
        <PromotionReviewForm
          key={`${selectedPromotion.crewId}-${selectedPromotion.promotionToRank}-${selectedPromotion.initialSection || 'default'}`}
          promotionData={selectedPromotion}
          onClose={handleCloseForm}
        />
      )}
    </div>
  );
};
