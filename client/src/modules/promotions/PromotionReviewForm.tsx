import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { BaseSubmoduleForm, FormSection } from '@/components/BaseSubmoduleForm';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Info, Plus, Edit, Trash2, ChevronDown } from 'lucide-react';
import { z } from 'zod';
import { PromotionChecklistForm } from './PromotionChecklistForm';
import { TrainingCourseSelectionDialog } from '@/modules/crew-pool/TrainingCourseSelectionDialog';
import type { TrainingCourseTemplate } from '@/utils/data/trainingCourseTemplates';
import type { Form, RankGroup, CrewDashboardSummary, PromotionReview } from '@shared/schema';
import type { PromotionA2Config } from '@shared/schema';

type PromotionReviewResponse = PromotionReview & {
  selectedApproversForSubmission?: string | null;
  b2VesselTypes?: string[];
  b2FleetGroups?: string[];
};
import { useRankNormalization } from '@/hooks/useRankNormalization';
import { useVesselTypesV2, useUsersV2, useFleetGroupsV2 } from '@/hooks/v2/useMasterDataV2';
import { getVesselTypesForDropdown } from '@/utils/data/vesselTypes';
import type { LicenseRecord } from '@/utils/data/licenseDceTemplates';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/contexts/PermissionsContext';
import { calculateChecklistProgressFromJson } from '@/modules/promotions/checklistProgressUtils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';

import {
  CriteriaRow,
  TrainingRow,
  Comment,
  Approver,
  CesTest,
  PartACriteriaTable,
  PartACesTests,
  PartATrainingNeeds,
  PartBApproval,
  PartCExecution,
} from '@/components/promotion-review-parts';

interface PromotionReviewFormProps {
  promotionData: any;
  onClose: () => void;
}

const promotionReviewSchema = z.object({
  partANotes: z.string().optional(),
  partBNotes: z.string().optional(),
  partCNotes: z.string().optional(),
});

type PromotionReviewFormData = z.infer<typeof promotionReviewSchema>;

const getCurrentUserDisplay = (): string => {
  const userName = sessionStorage.getItem('crewUserName') || 'Current User';
  const designation = sessionStorage.getItem('crewDesignation') || 'Staff';
  return `${userName}, ${designation}`;
};

export const PromotionReviewForm: React.FC<PromotionReviewFormProps> = ({
  promotionData,
  onClose,
}) => {
  const { toast } = useToast();
  const { permissions, canView } = usePermissions();

  const pmSectionMenuMap: Record<string, string> = {
    a: 'PM Criteria Review',
    b: 'PM Approval',
    c: 'PM Execution',
  };

  const canViewSection = useCallback((sectionId: string): boolean => {
    const menuName = pmSectionMenuMap[sectionId];
    if (!menuName) return true;
    if (permissions.length === 0) return true;
    return canView(menuName);
  }, [permissions, canView]);

  const allSections = [
    { id: 'a', title: 'Part A: Promotion Criteria Review', letter: 'A' },
    { id: 'b', title: 'Part B: Approval', letter: 'B' },
    { id: 'c', title: 'Part C: Execution', letter: 'C' },
  ];

  const sections = useMemo(() =>
    allSections.filter(s => canViewSection(s.id)),
    [permissions]
  );

  const { data: formsData } = useQuery<Form[]>({
    queryKey: ['/api/v2/admin/forms'],
  });

  const { data: rankGroupsData } = useQuery<RankGroup[]>({
    queryKey: ['/api/v2/admin/rank-groups'],
  });

  const { data: licenseEntriesData } = useQuery<any[]>({
    queryKey: ['/api/v2/masters/licenses-dce'],
  });

  const { data: vesselMasterData } = useQuery<any[]>({
    queryKey: ['/api/v2/masters/vessels'],
  });

  const { data: companyTrainingsData = [], isLoading: isLoadingDbTrainings, isError: isErrorDbTrainings } = useQuery<Array<{ id: number; trainingLabel: string }>>({
    queryKey: ['/api/v2/admin/company-trainings'],
    retry: false,
  });

  const dbTrainings = useMemo(
    () => companyTrainingsData.map(t => ({ id: t.id.toString(), name: t.trainingLabel })),
    [companyTrainingsData]
  );

  const vesselOptions = useMemo(() => {
    if (!vesselMasterData) return [];
    return vesselMasterData.map((vessel: any) => ({
      id: String(vessel.id || vessel.vesselId || vessel.nuid),
      name: vessel.name || vessel.vesselName || 'Unknown Vessel',
    }));
  }, [vesselMasterData]);

  const [currentUserDisplay, setCurrentUserDisplay] = useState(() => getCurrentUserDisplay());

  useEffect(() => {
    const updateCurrentUser = () => {
      setCurrentUserDisplay(getCurrentUserDisplay());
    };
    window.addEventListener('storage', updateCurrentUser);
    window.addEventListener('crewUserUpdated', updateCurrentUser);
    return () => {
      window.removeEventListener('storage', updateCurrentUser);
      window.removeEventListener('crewUserUpdated', updateCurrentUser);
    };
  }, []);

  const crewMemberId = promotionData?.crewMemberId ?? '';
  const promotionToRank = promotionData?.promotionToRank ?? '';

  const { data: crewMemberData } = useQuery<any>({
    queryKey: [`/api/v2/crew-pool/crew/by-emp-no/${crewMemberId}`],
    enabled: !!crewMemberId,
  });

  const { data: dashboardData } = useQuery<CrewDashboardSummary>({
    queryKey: [`/api/v2/crew-pool/crew/by-emp-no/${crewMemberId}/dashboard`],
    enabled: !!crewMemberId,
  });

  const { data: vesselTypesV2Data, isLoading: isLoadingVesselTypesV2 } = useVesselTypesV2();
  const { data: fleetGroupsV2Data, isLoading: isLoadingFleetGroupsV2 } = useFleetGroupsV2();
  const { normalizeRank } = useRankNormalization();

  const { data: usersV2Data, isLoading: isLoadingUsers } = useUsersV2();
  
  const approverMasterData = useMemo(() => {
    const users = usersV2Data || [];
    if (users.length > 0) {
      const seen = new Set<string>();
      return users
        .filter((user: any) => user.userType?.toLowerCase() === 'office')
        .map((user: any) => ({
          userUuid: user.userUuid || user.uuid,
          displayName: user.displayName || `${user.fullname || user.userName}, ${user.designation || ''}`,
        }))
        .filter((item: { userUuid: string; displayName: string }) => {
          if (!item.userUuid || !item.displayName?.trim()) return false;
          if (seen.has(item.userUuid)) return false;
          seen.add(item.userUuid);
          return true;
        });
    }
    return [];
  }, [usersV2Data]);
  
  const [selectedApproversForSubmission, setSelectedApproversForSubmission] = useState<{ userUuid: string; displayName: string }[]>([]);

  const presentRank = crewMemberData?.presentRank ?? '';

  // Query key starts with '/api/v2/appraisals' so it gets invalidated automatically
  // by the existing appraisal save/update/submit mutations (which already invalidate
  // ['/api/v2/appraisals']). Default fetcher uses queryKey[0] as the URL, so we
  // supply an explicit queryFn that builds the URL from the structured key parts.
  const { data: promotionRecommendationsData } = useQuery<{ count: number; rank: string; crewMemberId: string }>({
    queryKey: ['/api/v2/appraisals', 'crew', crewMemberId, 'promotion-recommendations', presentRank],
    enabled: !!crewMemberId,
    queryFn: async () => {
      const url = `/api/v2/appraisals/crew/${crewMemberId}/promotion-recommendations?rank=${encodeURIComponent(presentRank || '')}`;
      const res = await apiRequest('GET', url);
      return res.json();
    },
  });

  const a2_4_recommendationsResult = useMemo(() => {
    if (promotionRecommendationsData?.count !== undefined) {
      return String(promotionRecommendationsData.count);
    }
    return '';
  }, [promotionRecommendationsData]);

  const [savedReviewUuid, setSavedReviewUuid] = useState<string | null>(null);
  const [savedReviewId, setSavedReviewId] = useState<number | null>(
    promotionData?.promotionReviewId ?? null
  );
  const [isSubmittingForApproval, setIsSubmittingForApproval] = useState(false);

  const { data: existingReviewData, isLoading: isLoadingReview } = useQuery<PromotionReviewResponse>({
    queryKey: [`/api/v2/promotions/reviews/crew/${crewMemberId}/rank/${encodeURIComponent(promotionToRank)}`],
    enabled: !!crewMemberId && !!promotionToRank,
    retry: false,
  });

  const effectiveReviewUuid = savedReviewUuid ?? existingReviewData?.reviewUuid ?? null;

  type SaveMutationAction = 'draft' | 'submit-b' | 'submit-c';
  type SaveMutationVariables = { data: any; action: SaveMutationAction };

  const saveMutation = useMutation({
    mutationFn: async ({ data }: SaveMutationVariables) => {
      const endpoint = effectiveReviewUuid
        ? `/api/v2/promotions/reviews/${effectiveReviewUuid}`
        : '/api/v2/promotions/reviews';
      const method = effectiveReviewUuid ? 'PATCH' : 'POST';
      const response = await apiRequest(method, endpoint, data);
      return response;
    },
    onSuccess: (data: any, variables: SaveMutationVariables) => {
      if (data?.reviewUuid) {
        setSavedReviewUuid(data.reviewUuid);
      }
      if (data?.id) {
        setSavedReviewId(data.id);
      }
      if (variables.action === 'submit-b') {
        toast({
          title: "Part B Submitted",
          description: "Approval submitted successfully.",
        });
      } else if (variables.action === 'submit-c') {
        toast({
          title: "Part C Submitted",
          description: "Form submitted successfully.",
        });
      } else {
        toast({
          title: "Draft Saved",
          description: "Your promotion review progress has been saved.",
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/v2/promotions/reviews'] });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/v2/promotions/reviews/crew/${crewMemberId}/rank/${encodeURIComponent(promotionToRank)}`] 
      });
    },
    onError: (error: any, variables: SaveMutationVariables) => {
      const isSubmit = variables.action === 'submit-b' || variables.action === 'submit-c';
      toast({
        title: isSubmit ? "Submit Failed" : "Save Failed",
        description: error.message || (isSubmit ? "Failed to submit" : "Failed to save draft"),
        variant: "destructive",
      });
    },
  });

  const [selectedVesselTypeForA2_3b, setSelectedVesselTypeForA2_3b] = useState<string>('');

  const parseRanksArray = useCallback((ranks: unknown): string[] => {
    if (Array.isArray(ranks)) return ranks;
    if (typeof ranks === 'string') {
      try {
        const parsed = JSON.parse(ranks);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }, []);

  const rankGroupLookupResult = useMemo<{ attempted: boolean; found: boolean; targetRank: string | null }>(() => {
    if (!promotionData?.promotionToRank || !formsData || !rankGroupsData) {
      return { attempted: false, found: false, targetRank: null };
    }
    const promotionReviewForm = formsData.find(f => f.name === 'Promotion Review Form');
    if (!promotionReviewForm) {
      return { attempted: true, found: false, targetRank: promotionData.promotionToRank };
    }
    const formRankGroups = rankGroupsData.filter(rg => 
      rg.formId === promotionReviewForm.id && !rg.archivedAt
    );
    const targetRank = promotionData.promotionToRank;
    const normalizedTarget = normalizeRank(targetRank);
    const matchingRankGroup = formRankGroups.find(rg => {
      const groupRanks = parseRanksArray(rg.ranks);
      return groupRanks.some((rank: string) => {
        const normalizedGroupRank = normalizeRank(rank);
        return normalizedGroupRank === normalizedTarget;
      });
    });
    return {
      attempted: true,
      found: !!matchingRankGroup,
      targetRank,
    };
  }, [promotionData?.promotionToRank, formsData, rankGroupsData, normalizeRank, parseRanksArray]);

  // Resolve the matching rank group for the target promotion rank.
  const matchingRankGroupForA2 = useMemo<{ formId: number; rankGroupId: number; configuration: string | null } | null>(() => {
    if (!promotionData?.promotionToRank || !formsData || !rankGroupsData) return null;
    const promotionReviewForm = formsData.find(f => f.name === 'Promotion Review Form');
    if (!promotionReviewForm) return null;
    const formRankGroups = rankGroupsData.filter(rg =>
      rg.formId === promotionReviewForm.id && !rg.archivedAt
    );
    const normalizedTarget = normalizeRank(promotionData.promotionToRank);
    const matching = formRankGroups.find(rg => {
      const groupRanks = parseRanksArray(rg.ranks);
      return groupRanks.some((rank: string) => normalizeRank(rank) === normalizedTarget);
    });
    if (!matching) return null;
    return { formId: promotionReviewForm.id, rankGroupId: matching.id, configuration: matching.configuration ?? null };
  }, [promotionData?.promotionToRank, formsData, rankGroupsData, normalizeRank, parseRanksArray]);

  // Fetch versions for the matched form so we can prefer the latest released
  // form-version over the legacy adm_rank_groups_v2.configuration column.
  const { data: a2FormVersions = [] } = useQuery<Array<{ id: number; rankGroupId: number | null; versionNo: string; status: string; configuration: string | null; releasedAt: string | null }>>({
    queryKey: [`/api/v2/admin/forms/${matchingRankGroupForA2?.formId}/versions`],
    enabled: !!matchingRankGroupForA2?.formId,
  });

  const a2Config = useMemo<PromotionA2Config | null>(() => {
    if (!matchingRankGroupForA2) return null;
    const extractKnown = (parsed: any): any | null => {
      const promotionConfig = parsed?.promotionA2 ?? parsed;
      if (promotionConfig && typeof promotionConfig === 'object') {
        const knownFields = ['higherLicenseIds', 'ageMin', 'ageMax', 'experienceMonths',
          'minRecommendations', 'minChecklistVerifications', 'minChecklistCompletionPercent',
          'otherCriteria', 'cesTests'];
        if (knownFields.some(field => field in promotionConfig)) return promotionConfig;
      }
      return null;
    };

    // 1. Latest released form-version for this rank group (preferred).
    const released = a2FormVersions.filter(v =>
      v.rankGroupId === matchingRankGroupForA2.rankGroupId && v.status === 'released' && v.configuration
    );
    if (released.length > 0) {
      const latest = released.reduce((max, v) => {
        const vNo = parseInt(v.versionNo, 10);
        const maxNo = parseInt(max.versionNo, 10);
        if (!isNaN(vNo) && !isNaN(maxNo) && vNo !== maxNo) return vNo > maxNo ? v : max;
        const vAt = v.releasedAt ? new Date(v.releasedAt).getTime() : 0;
        const maxAt = max.releasedAt ? new Date(max.releasedAt).getTime() : 0;
        return vAt > maxAt ? v : max;
      }, released[0]);
      try {
        const parsed = typeof latest.configuration === 'string' ? JSON.parse(latest.configuration!) : latest.configuration;
        const known = extractKnown(parsed);
        if (known) return known;
      } catch { /* fall through to legacy */ }
    }

    // 2. Legacy adm_rank_groups_v2.configuration fallback.
    const legacyConfig = matchingRankGroupForA2.configuration;
    if (!legacyConfig) return null;
    try {
      const parsed = typeof legacyConfig === 'string' ? JSON.parse(legacyConfig) : legacyConfig;
      return extractKnown(parsed);
    } catch {
      return null;
    }
  }, [matchingRankGroupForA2, a2FormVersions]);

  const licenseDataByEntryId = useMemo(() => {
    if (!licenseEntriesData) return {};
    const map: Record<string, { name: string; entryId: string }> = {};
    licenseEntriesData.forEach((entry: any) => {
      const entryId = entry.entryId || entry.entry_id || entry.nuid;
      if (entryId && entry.name) {
        map[entryId] = { name: entry.name, entryId };
      }
    });
    return map;
  }, [licenseEntriesData]);

  const requiredLicenseDisplay = useMemo(() => {
    if (!a2Config?.higherLicenseIds?.length) return '';
    const names = a2Config.higherLicenseIds
      .map(id => licenseDataByEntryId[id]?.name || `License ID ${id}`)
      .filter(Boolean);
    return names.join(', ') || '';
  }, [a2Config?.higherLicenseIds, licenseDataByEntryId]);

  const requiredAgeDisplay = useMemo(() => {
    if (!a2Config?.ageMin && !a2Config?.ageMax) return '';
    if (a2Config.ageMin && a2Config.ageMax) {
      return `${a2Config.ageMin}-${a2Config.ageMax} Years`;
    } else if (a2Config.ageMin) {
      return `>= ${a2Config.ageMin} Years`;
    } else if (a2Config.ageMax) {
      return `<= ${a2Config.ageMax} Years`;
    }
    return '';
  }, [a2Config?.ageMin, a2Config?.ageMax]);

  const a2_1_licenseResult = useMemo(() => {
    if (!crewMemberData && !dashboardData) return '';
    let licenses: LicenseRecord[] = [];
    const rawLicenses = (dashboardData as any)?.licenses || (crewMemberData as any)?.licenses;
    if (Array.isArray(rawLicenses)) {
      licenses = rawLicenses;
    } else if (typeof rawLicenses === 'string' && rawLicenses.trim()) {
      try {
        licenses = JSON.parse(rawLicenses);
      } catch {
        licenses = [];
      }
    }
    if (!a2Config?.higherLicenseIds?.length) {
      const cocLicense = licenses.find((lic: LicenseRecord) => 
        lic.certificateDocument?.toLowerCase().includes('coc') || 
        lic.certificateDocument?.toLowerCase().includes('certificate of competency')
      );
      return cocLicense ? 'Yes' : 'No';
    }
    const requiredEntryIds = a2Config.higherLicenseIds;
    const hasAnyLicense = requiredEntryIds.some(requiredEntryId => {
      const requiredLower = requiredEntryId.toLowerCase();
      const licenseData = licenseDataByEntryId[requiredEntryId];
      const requiredNameLower = licenseData?.name?.toLowerCase() || '';
      return licenses.some((lic: LicenseRecord) => {
        const crewLicenseId = lic.licenseId?.toLowerCase() || '';
        const certDoc = lic.certificateDocument?.toLowerCase() || '';
        return crewLicenseId === requiredLower ||
               (requiredNameLower && certDoc.includes(requiredNameLower)) ||
               (requiredNameLower && requiredNameLower.includes(certDoc));
      });
    });
    return hasAnyLicense ? 'Yes' : 'No';
  }, [crewMemberData, dashboardData, a2Config?.higherLicenseIds, licenseDataByEntryId]);

  const a2_2_ageResult = useMemo(() => {
    const dobValue = crewMemberData?.dob || crewMemberData?.dateOfBirth;
    if (!dobValue) return '';
    const dob = new Date(dobValue);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return `${age} Years`;
  }, [crewMemberData?.dob, crewMemberData?.dateOfBirth]);

  const a2_3a_rankExperienceResult = useMemo(() => {
    if (dashboardData?.experience?.rank == null) return '';
    const rankYears = dashboardData.experience.rank;
    const rankMonths = Math.round(rankYears * 12);
    return `${rankMonths} Months`;
  }, [dashboardData]);

  const vesselTypeOptions = useMemo(() => {
    if (vesselTypesV2Data && vesselTypesV2Data.length > 0) {
      return vesselTypesV2Data.map((vt: any) => vt.name || vt.vesselType || String(vt));
    }
    return getVesselTypesForDropdown();
  }, [vesselTypesV2Data]);

  const b2VesselTypeOptions = useMemo(() => {
    const raw = (vesselTypesV2Data as any)?.vesseltypes
      || (vesselTypesV2Data as any)?.vesselTypes
      || vesselTypesV2Data
      || [];
    const list = Array.isArray(raw) ? raw : [];
    if (list.length > 0) {
      return list
        .map((vt: any) => vt.vesselType || vt.name || (typeof vt === 'string' ? vt : ''))
        .filter(Boolean);
    }
    if (isLoadingVesselTypesV2) return [];
    return getVesselTypesForDropdown();
  }, [vesselTypesV2Data, isLoadingVesselTypesV2]);

  const b2FleetGroupOptions = useMemo(() => {
    const raw = (fleetGroupsV2Data as any)?.fleetGroups || fleetGroupsV2Data || [];
    const list = Array.isArray(raw) ? raw : [];
    const seen = new Set<string>();
    const result: string[] = [];
    list.forEach((f: any) => {
      const name = (f?.name || f?.fleetGroup || (typeof f === 'string' ? f : ''))?.trim();
      if (name && !seen.has(name)) {
        seen.add(name);
        result.push(name);
      }
    });
    return result;
  }, [fleetGroupsV2Data]);

  const a2_3b_vesselTypeExperienceResult = useMemo(() => {
    if (!selectedVesselTypeForA2_3b) return '';
    if (!dashboardData?.rankExperienceByVesselType) return '0 Months';
    let months: number | undefined;
    const experienceMap = dashboardData.rankExperienceByVesselType;
    if (experienceMap[selectedVesselTypeForA2_3b] !== undefined) {
      months = experienceMap[selectedVesselTypeForA2_3b];
    } else {
      const selectedLower = selectedVesselTypeForA2_3b.toLowerCase();
      const matchingKey = Object.keys(experienceMap).find(key => 
        key.toLowerCase().includes(selectedLower) || selectedLower.includes(key.toLowerCase())
      );
      if (matchingKey) {
        months = experienceMap[matchingKey];
      }
    }
    if (months === undefined || months === 0) return '0 Months';
    return `${Math.round(months)} Months`;
  }, [selectedVesselTypeForA2_3b, dashboardData?.rankExperienceByVesselType]);

  const a2_3c_companyServiceResult = useMemo(() => {
    if (dashboardData?.experience?.company == null) return '';
    const companyYears = dashboardData.experience.company;
    const companyMonths = Math.round(companyYears * 12);
    return `${companyMonths} Months`;
  }, [dashboardData]);

  const a2_3d_tankerExperienceResult = useMemo(() => {
    if (dashboardData?.experience?.tankers == null) return '';
    const tankerYears = dashboardData.experience.tankers;
    const tankerMonths = Math.round(tankerYears * 12);
    return `${tankerMonths} Months`;
  }, [dashboardData]);

  const [criteriaData, setCriteriaData] = useState<CriteriaRow[]>([]);

  useEffect(() => {
    
    const baseCriteria: CriteriaRow[] = [
      { 
        id: 'a2.1', 
        criteria: 'A2.1 Higher License Criteria?', 
        required: requiredLicenseDisplay || '', 
        resultFromDb: a2_1_licenseResult, 
        verified: '', 
        hasInfo: true 
      },
      { 
        id: 'a2.2', 
        criteria: 'A2.2 Age Criteria?', 
        required: requiredAgeDisplay || '', 
        resultFromDb: a2_2_ageResult, 
        verified: '', 
        hasInfo: true 
      },
      { id: 'a2.3', criteria: 'A2.3 Experience & Sea Service Criteria?', required: '', resultFromDb: '', verified: '', hasInfo: true },
      { 
        id: 'a2.3a', 
        criteria: 'A2.3a  Minimum Rank Experience (Vessel)?', 
        required: a2Config?.experienceMonths?.rankVessel ? `${a2Config.experienceMonths.rankVessel} Months` : '', 
        resultFromDb: a2_3a_rankExperienceResult, 
        verified: '', 
        hasInfo: false 
      },
      { 
        id: 'a2.3b', 
        criteria: 'A2.3b  Minimum Rank Experience (Vessel Type)?', 
        required: a2Config?.experienceMonths?.rankVesselType ? `${a2Config.experienceMonths.rankVesselType} Months` : '', 
        resultFromDb: a2_3b_vesselTypeExperienceResult, 
        verified: '', 
        hasInfo: false 
      },
      { 
        id: 'a2.3c', 
        criteria: 'A2.3c  Company Service?', 
        required: a2Config?.experienceMonths?.companyService ? `${a2Config.experienceMonths.companyService} Months` : '', 
        resultFromDb: a2_3c_companyServiceResult, 
        verified: '', 
        hasInfo: false 
      },
      { 
        id: 'a2.3d', 
        criteria: 'A2.3d  Minimum Tanker Experience?', 
        required: a2Config?.experienceMonths?.tankerExperience ? `${a2Config.experienceMonths.tankerExperience} Months` : '', 
        resultFromDb: a2_3d_tankerExperienceResult, 
        verified: '', 
        hasInfo: false 
      },
      { 
        id: 'a2.4', 
        criteria: 'A2.4 Recommendations Criteria?', 
        required: a2Config?.minRecommendations ? String(a2Config.minRecommendations) : '', 
        resultFromDb: a2_4_recommendationsResult, 
        verified: '', 
        hasInfo: true 
      },
      { 
        id: 'a2.5a', 
        criteria: 'A2.5a Promotion Checklist Completed?', 
        required: a2Config?.minChecklistCompletionPercent != null ? `${a2Config.minChecklistCompletionPercent}%` : '', 
        resultFromDb: (() => {
          if (existingReviewData?.checklistProgressData) {
            try {
              const prog = calculateChecklistProgressFromJson(
                existingReviewData.checklistProgressData,
                a2Config?.minChecklistVerifications ?? 1,
                a2Config?.minChecklistCompletionPercent ?? 85
              );
              if (prog.totalRequired > 0) return `${prog.percentage}%`;
            } catch {}
          }
          return '';
        })(), 
        verified: '', 
        hasInfo: true 
      },
      { id: 'a2.6', criteria: 'A2.6 Other Criteria?', required: '', resultFromDb: '', verified: '', hasInfo: true },
    ];

    if (a2Config?.otherCriteria?.length) {
      a2Config.otherCriteria.forEach((item, index) => {
        const letter = String.fromCharCode(97 + index);
        baseCriteria.push({
          id: `a2.6${letter}`,
          criteria: `A2.6${letter}  ${item.label || `Other Criteria ${index + 1}`}?`,
          required: item.requirement || '',
          resultFromDb: '',
          verified: '',
          hasInfo: false,
        });
      });
    }

    baseCriteria.push(
      { id: 'a2.7', criteria: 'A2.7 CES / Language Tests Criteria?', required: '', resultFromDb: '', verified: '', hasInfo: true },
      { id: 'a2.8', criteria: 'A2.8 Training & Other Documents Verification?', required: '', resultFromDb: '', verified: '', hasInfo: true }
    );

    let savedVerifiedStatus: Record<string, string> = {};
    if (existingReviewData?.criteriaVerifiedStatus) {
      try {
        savedVerifiedStatus = typeof existingReviewData.criteriaVerifiedStatus === 'string'
          ? JSON.parse(existingReviewData.criteriaVerifiedStatus)
          : existingReviewData.criteriaVerifiedStatus;
      } catch {}
    }

    setCriteriaData(prev => {
      const existingVerifiedMap = new Map(prev.map(row => [row.id, row.verified]));
      return baseCriteria.map(row => ({
        ...row,
        verified: existingVerifiedMap.get(row.id) || savedVerifiedStatus[row.id] || row.verified,
      }));
    });
  }, [a2Config, requiredLicenseDisplay, requiredAgeDisplay, a2_1_licenseResult, a2_2_ageResult, a2_3a_rankExperienceResult, a2_3b_vesselTypeExperienceResult, a2_3c_companyServiceResult, a2_3d_tankerExperienceResult, a2_4_recommendationsResult, existingReviewData?.criteriaVerifiedStatus, existingReviewData?.checklistProgressData]);

  const [cesTests, setCesTests] = useState<CesTest[]>([]);

  useEffect(() => {
    if (cesTests.length > 0) {
      const results = cesTests.map(t => t.result || '');
      const allPassOrNa = results.every(r => {
        const rl = r.trim().toLowerCase();
        return rl === 'pass' || rl === 'na' || rl === 'n/a';
      });
      const cesResult = allPassOrNa ? 'Pass' : '';
      setCriteriaData(prev => prev.map(row =>
        row.id === 'a2.7' ? { ...row, resultFromDb: cesResult } : row
      ));
    }
  }, [cesTests]);

  useEffect(() => {
    setCesTests(prev => {
      if (a2Config?.cesTests?.length) {
        const existingValuesMap = new Map(prev.map(test => [test.id, { date: test.date, score: test.score, result: test.result }]));
        return a2Config.cesTests.map((test, index) => {
          const id = String(index + 1);
          const existing = existingValuesMap.get(id);
          return {
            id,
            description: test.description || '',
            date: existing?.date || '',
            minScore: test.minScore ? String(test.minScore) : '',
            score: existing?.score || '',
            result: existing?.result || '',
          };
        });
      } else {
        // No admin A2.7 configuration for this rank group — render no sub-rows.
        return [];
      }
    });
  }, [a2Config]);

  const [criteriaComments, setCriteriaComments] = useState<Record<string, Comment[]>>({});
  const [newCriteriaComment, setNewCriteriaComment] = useState<Record<string, string>>({});
  const [editingCriteriaComment, setEditingCriteriaComment] = useState<string | null>(null);

  const [trainingNeeds, setTrainingNeeds] = useState<TrainingRow[]>([]);
  const [isTrainingDialogOpen, setIsTrainingDialogOpen] = useState(false);

  const [trainingComments, setTrainingComments] = useState<Record<string, Comment[]>>({});
  const [newTrainingComment, setNewTrainingComment] = useState<Record<string, string>>({});
  const [editingTrainingComment, setEditingTrainingComment] = useState<string | null>(null);
  const [editingTrainingCommentId, setEditingTrainingCommentId] = useState<string | null>(null);

  const [comments, setComments] = useState<Comment[]>([]);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  
  const commentsRef = useRef<Comment[]>([]);
  
  const hasLoadedA4Ref = useRef<boolean>(false);
  
  useEffect(() => {
    commentsRef.current = comments;
  }, [comments]);

  const [approvers, setApprovers] = useState<Approver[]>([]);

  const nextApproverIdRef = useRef(3);
  const nextCesTestIdRef = useRef(2);
  const nextCommentIdRef = useRef(3);
  const nextTrainingIdRef = useRef(1);

  const [vesselTypes, setVesselTypes] = useState<string[]>([]);
  const [vesselClasses, setVesselClasses] = useState<string[]>([]);

  const [promotionConfirmed, setPromotionConfirmed] = useState<string>('');
  const [vesselAssigned, setVesselAssigned] = useState<string>('');
  const [promotionDate, setPromotionDate] = useState<string>('');
  const [promotionTiming, setPromotionTiming] = useState<string>('');

  const [showChecklistForm, setShowChecklistForm] = useState(promotionData?.initialSection === 'checklist');

  const defaultValues: PromotionReviewFormData = {
    partANotes: '',
    partBNotes: '',
    partCNotes: '',
  };

  useEffect(() => {
    if (existingReviewData) {
      setSavedReviewId(existingReviewData.id);
      
      if (existingReviewData.selectedVesselTypeForA2_3b) {
        setSelectedVesselTypeForA2_3b(existingReviewData.selectedVesselTypeForA2_3b);
      }
      
      if (existingReviewData.criteriaVerifiedStatus) {
        try {
          const verifiedStatus = typeof existingReviewData.criteriaVerifiedStatus === 'string' 
            ? JSON.parse(existingReviewData.criteriaVerifiedStatus) 
            : existingReviewData.criteriaVerifiedStatus;
          setCriteriaData(prev => prev.map(row => ({
            ...row,
            verified: verifiedStatus[row.id] || row.verified
          })));
        } catch {}
      }
      
      if (existingReviewData.cesTestsData) {
        try {
          const cesData = typeof existingReviewData.cesTestsData === 'string'
            ? JSON.parse(existingReviewData.cesTestsData)
            : existingReviewData.cesTestsData;
          if (Array.isArray(cesData) && cesData.length > 0) {
            // Drop any persisted entries that are entirely blank — these are
            // historical placeholder rows from before A2.7 admin config was
            // respected, and should not reappear when there is no admin config.
            const filtered = cesData.filter((t: any) =>
              t && (
                (t.description && String(t.description).trim()) ||
                (t.date && String(t.date).trim()) ||
                (t.minScore && String(t.minScore).trim()) ||
                (t.score && String(t.score).trim()) ||
                (t.result && String(t.result).trim())
              )
            );
            if (filtered.length > 0) {
              setCesTests(filtered);
            }
          }
        } catch {}
      }
      
      if (existingReviewData.criteriaComments) {
        try {
          const commentData = typeof existingReviewData.criteriaComments === 'string'
            ? JSON.parse(existingReviewData.criteriaComments)
            : existingReviewData.criteriaComments;
          
          if (commentData.hasOwnProperty('a4') && Array.isArray(commentData.a4)) {
            setComments(commentData.a4);
            hasLoadedA4Ref.current = true;
            if (commentData.a4.length > 0) {
              const maxId = Math.max(...commentData.a4.map((c: Comment) => parseInt(c.id) || 0));
              nextCommentIdRef.current = maxId + 1;
            } else {
              nextCommentIdRef.current = 1;
            }
          } else {
            setComments([]);
            hasLoadedA4Ref.current = true;
            nextCommentIdRef.current = 1;
          }
          
          if (commentData.hasOwnProperty('a3') && typeof commentData.a3 === 'object') {
            setTrainingComments(commentData.a3);
          }
          
          const { a3, a4, ...restComments } = commentData;
          setCriteriaComments(restComments);
        } catch {
          setComments([]);
          hasLoadedA4Ref.current = true;
          nextCommentIdRef.current = 1;
        }
      } else {
        setComments([]);
        hasLoadedA4Ref.current = true;
        nextCommentIdRef.current = 1;
      }
      
      if (existingReviewData.trainingNeeds) {
        try {
          const training = typeof existingReviewData.trainingNeeds === 'string'
            ? JSON.parse(existingReviewData.trainingNeeds)
            : existingReviewData.trainingNeeds;
          if (Array.isArray(training) && training.length > 0) {
            setTrainingNeeds(training);
            const maxId = training.reduce((max: number, t: TrainingRow) => {
              const n = parseInt(t.id, 10);
              return Number.isFinite(n) && n > max ? n : max;
            }, 0);
            nextTrainingIdRef.current = maxId + 1;
          }
        } catch {}
      }
      
      if (existingReviewData.approvalData) {
        try {
          const approvalData = typeof existingReviewData.approvalData === 'string'
            ? JSON.parse(existingReviewData.approvalData)
            : existingReviewData.approvalData;
          if (Array.isArray(approvalData) && approvalData.length > 0) {
            const approversWithFlag = approvalData.map((a: Approver) => ({
              ...a,
              isFromPartA: a.isFromPartA !== undefined ? a.isFromPartA : true
            }));
            setApprovers(approversWithFlag);
          }
        } catch {}
      }
      
      if ((existingReviewData as any).selectedApproversForSubmission) {
        try {
          const selectedApprovers = typeof (existingReviewData as any).selectedApproversForSubmission === 'string'
            ? JSON.parse((existingReviewData as any).selectedApproversForSubmission)
            : (existingReviewData as any).selectedApproversForSubmission;
          if (Array.isArray(selectedApprovers)) {
            const normalized = selectedApprovers.map((item: any) => {
              if (typeof item === 'string') {
                const match = approverMasterData.find(
                  (a: { userUuid: string; displayName: string }) => a.displayName === item
                );
                return { userUuid: match?.userUuid || '', displayName: item };
              }
              return { userUuid: item.userUuid || '', displayName: item.displayName || item.approver || '' };
            });
            setSelectedApproversForSubmission(normalized);
          }
        } catch {}
      }
      
      if (existingReviewData.promotionConfirmed) {
        setPromotionConfirmed(existingReviewData.promotionConfirmed);
      }
      if (existingReviewData.vesselAssigned) {
        setVesselAssigned(existingReviewData.vesselAssigned);
      }
      if (existingReviewData.promotionDate) {
        setPromotionDate(existingReviewData.promotionDate);
      }
      if (existingReviewData.promotionTiming) {
        setPromotionTiming(existingReviewData.promotionTiming);
      }

      const b2vt = existingReviewData.b2VesselTypes;
      if (Array.isArray(b2vt)) {
        setVesselTypes(b2vt.filter((v): v is string => typeof v === 'string' && v.trim().length > 0));
      }
      const b2fg = existingReviewData.b2FleetGroups;
      if (Array.isArray(b2fg)) {
        setVesselClasses(b2fg.filter((v): v is string => typeof v === 'string' && v.trim().length > 0));
      }
    }
  }, [existingReviewData]);

  useEffect(() => {
    if (approverMasterData.length === 0) return;
    setSelectedApproversForSubmission(prev => {
      const hasEmpty = prev.some(a => !a.userUuid);
      if (!hasEmpty) return prev;
      return prev.map(a => {
        if (a.userUuid) return a;
        const match = approverMasterData.find(m => m.displayName === a.displayName);
        return match ? { userUuid: match.userUuid, displayName: a.displayName } : a;
      });
    });
  }, [approverMasterData]);

  useEffect(() => {
    if (!isLoadingReview && !existingReviewData && !hasLoadedA4Ref.current) {
      hasLoadedA4Ref.current = true;
      const user = getCurrentUserDisplay();
      const defaultComments: Comment[] = [
        { id: '1', user, text: 'Shows good aptitude for senior roles. Candidate has the right credentials and experience.' },
        { id: '2', user, text: 'Pending completion of minimum rank experience and COC Master license.' },
      ];
      setComments(defaultComments);
      nextCommentIdRef.current = 3;
    }
  }, [isLoadingReview, existingReviewData]);

  const collectFormData = useCallback((formData: PromotionReviewFormData, scope: 'a' | 'b' | 'c' | 'full' = 'full') => {
    const includeA = scope === 'a' || scope === 'full';
    const includeB = scope === 'b' || scope === 'full';
    const includeC = scope === 'c' || scope === 'full';
    const criteriaVerifiedStatus: Record<string, string> = {};
    const criteriaMeetsStatus: Record<string, string> = {};
    
    const computeMeetsStatus = (required: string, result: string, verified: string): string => {
      if (!required && !result) {
        if (verified === 'yes') return 'yes';
        if (verified === 'no') return 'no';
        return 'na';
      }
      if (!required || !result) return 'pending';
      
      const resultLower = result.trim().toLowerCase();
      if (resultLower === 'yes') return 'yes';
      if (resultLower === 'no') return 'no';
      
      const rangeMatch = required.match(/(\d+)\s*-\s*(\d+)/);
      if (rangeMatch) {
        const min = parseFloat(rangeMatch[1]);
        const max = parseFloat(rangeMatch[2]);
        const actualValue = parseFloat(result);
        if (!isNaN(min) && !isNaN(max) && !isNaN(actualValue)) {
          return (actualValue >= min && actualValue <= max) ? 'yes' : 'no';
        }
      }
      
      const reqNum = parseFloat(required);
      const resNum = parseFloat(result);
      if (!isNaN(reqNum) && !isNaN(resNum)) {
        return resNum >= reqNum ? 'yes' : 'no';
      }
      
      return required.trim().toLowerCase() === result.trim().toLowerCase() ? 'yes' : 'no';
    };
    
    criteriaData.forEach(row => {
      criteriaVerifiedStatus[row.id] = row.verified;
      criteriaMeetsStatus[row.id] = computeMeetsStatus(row.required, row.resultFromDb, row.verified);
    });
    
    const parentIds = ['a2.3', 'a2.6'];
    parentIds.forEach(parentId => {
      const childIds = Object.keys(criteriaMeetsStatus).filter(
        id => id.startsWith(parentId) && id.length > parentId.length
      );
      if (childIds.length > 0) {
        const childMeetsValues = childIds.map(id => criteriaMeetsStatus[id]);
        if (parentId === 'a2.6') {
          const childVerifiedValues = childIds.map(id => criteriaVerifiedStatus[id] || '');
          const hasBlank = childVerifiedValues.some(v => v === '' || v === undefined);
          if (hasBlank) {
            criteriaMeetsStatus[parentId] = 'pending';
          } else if (childVerifiedValues.some(v => v === 'yes')) {
            criteriaMeetsStatus[parentId] = 'yes';
          } else if (childVerifiedValues.every(v => v === 'na')) {
            criteriaMeetsStatus[parentId] = 'na';
          } else {
            criteriaMeetsStatus[parentId] = 'pending';
          }
        } else if (childMeetsValues.some(v => v === 'yes')) {
          criteriaMeetsStatus[parentId] = 'yes';
        } else {
          criteriaMeetsStatus[parentId] = 'pending';
        }
      }
    });
    
    const a2_5a_status = criteriaMeetsStatus['a2.5a'];
    if (a2_5a_status === 'yes') {
      criteriaMeetsStatus['a2.5'] = 'yes';
    } else {
      criteriaMeetsStatus['a2.5'] = 'pending';
    }
    
    if (cesTests.length > 0) {
      const results = cesTests.map(t => (t.result || '').trim().toLowerCase());
      if (results.every(r => r === 'pass' || r === 'na' || r === 'n/a')) {
        criteriaMeetsStatus['a2.7'] = 'yes';
      } else {
        criteriaMeetsStatus['a2.7'] = 'pending';
      }
    } else {
      criteriaMeetsStatus['a2.7'] = 'pending';
    }

    const existingStatusRaw = existingReviewData?.status;
    const existingStatusNormalized = typeof existingStatusRaw === 'string'
      ? existingStatusRaw.trim().toLowerCase().replace(/\s+/g, '_')
      : '';
    const isExistingReview = !!effectiveReviewUuid;
    const shouldDowngradeFromInProgress = existingStatusNormalized === 'in_progress';
    const sendStatusAsDraft = !isExistingReview || shouldDowngradeFromInProgress;

    return {
      crewMemberId: promotionData?.crewMemberId,
      promotionToRank: promotionData?.promotionToRank,
      ...(sendStatusAsDraft ? { status: 'draft' } : {}),
      selectedVesselTypeForA2_3b: includeA ? (selectedVesselTypeForA2_3b || null) : undefined,
      criteriaVerifiedStatus: includeA ? JSON.stringify(criteriaVerifiedStatus) : undefined,
      criteriaMeetsStatus: includeA ? JSON.stringify(criteriaMeetsStatus) : undefined,
      cesTestsData: includeA ? JSON.stringify(cesTests) : undefined,
      criteriaComments: includeA ? JSON.stringify({ ...criteriaComments, a3: trainingComments, a4: commentsRef.current.filter(c => c.text?.trim()) }) : undefined,
      trainingNeeds: includeA ? JSON.stringify(trainingNeeds) : undefined,
      partANotes: includeA ? (formData.partANotes || null) : undefined,
      approvalData: includeB ? JSON.stringify(approvers) : undefined as string | undefined,
      selectedApproversForSubmission: includeB ? JSON.stringify(selectedApproversForSubmission) : undefined as string | undefined,
      b2VesselTypes: includeB ? vesselTypes : undefined,
      b2FleetGroups: includeB ? vesselClasses : undefined,
      partBNotes: includeB ? (formData.partBNotes || null) : undefined,
      promotionConfirmed: includeC ? promotionConfirmed : undefined,
      vesselAssigned: includeC ? vesselAssigned : undefined,
      promotionDate: includeC ? promotionDate : undefined,
      promotionTiming: includeC ? promotionTiming : undefined,
      partCNotes: includeC ? (formData.partCNotes || null) : undefined,
    };
  }, [criteriaData, cesTests, criteriaComments, trainingComments, trainingNeeds, approvers, promotionConfirmed, vesselAssigned, promotionDate, promotionTiming, selectedVesselTypeForA2_3b, promotionData, selectedApproversForSubmission, existingReviewData, vesselTypes, vesselClasses, effectiveReviewUuid]);

  const handleSaveDraftA = useCallback(() => {
    const reviewData = collectFormData({
      partANotes: '',
      partBNotes: '',
      partCNotes: '',
    }, 'a');
    saveMutation.mutate({ data: reviewData, action: 'draft' });
  }, [collectFormData, saveMutation]);

  const handleSaveDraftB = useCallback(() => {
    const reviewData = collectFormData({
      partANotes: '',
      partBNotes: '',
      partCNotes: '',
    }, 'b');
    saveMutation.mutate({ data: reviewData, action: 'draft' });
  }, [collectFormData, saveMutation]);

  const handleSaveDraftC = useCallback(() => {
    const reviewData = collectFormData({
      partANotes: '',
      partBNotes: '',
      partCNotes: '',
    }, 'c');
    saveMutation.mutate({ data: reviewData, action: 'draft' });
  }, [collectFormData, saveMutation]);

  const handleSubmitPartB = useCallback(() => {
    const reviewData = collectFormData({
      partANotes: '',
      partBNotes: '',
      partCNotes: '',
    }, 'b');
    reviewData.status = 'approved';
    saveMutation.mutate({ data: reviewData, action: 'submit-b' });
  }, [collectFormData, saveMutation]);

  const handleSubmitPartC = useCallback(() => {
    const reviewData = collectFormData({
      partANotes: '',
      partBNotes: '',
      partCNotes: '',
    }, 'c');
    reviewData.status = 'completed';
    saveMutation.mutate({ data: reviewData, action: 'submit-c' });
  }, [collectFormData, saveMutation]);

  const handleSubmit = (data: PromotionReviewFormData) => {
    const reviewData = collectFormData(data, 'a');
    saveMutation.mutate({ data: reviewData, action: 'draft' });
  };

  const getMeetsCriterion = useCallback((required: string, result: string) => {
    if (!result) return 'pending';
    const resultLower = result.trim().toLowerCase();
    if (resultLower === 'pass') return 'met';
    if (!required) return 'pending';
    
    if (resultLower === 'yes') return 'met';
    if (resultLower === 'no') return 'not-met';
    
    const rangeMatch = required.match(/(\d+)\s*-\s*(\d+)/);
    if (rangeMatch) {
      const min = parseFloat(rangeMatch[1]);
      const max = parseFloat(rangeMatch[2]);
      const actualValue = parseFloat(result);
      if (!isNaN(min) && !isNaN(max) && !isNaN(actualValue)) {
        return (actualValue >= min && actualValue <= max) ? 'met' : 'not-met';
      }
    }
    
    const reqNum = parseFloat(required);
    const resNum = parseFloat(result);
    if (!isNaN(reqNum) && !isNaN(resNum)) {
      return resNum >= reqNum ? 'met' : 'not-met';
    }
    
    return required.trim().toLowerCase() === result.trim().toLowerCase() ? 'met' : 'not-met';
  }, []);

  const renderMeetsCriterionBadge = useCallback((required: string, result: string, row: CriteriaRow) => {
    const status = getMeetsCriterion(required, result);
    if (status === 'met') {
      return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded" data-testid="badge-met">Yes</span>;
    } else if (status === 'not-met') {
      return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded" data-testid="badge-not-met">No</span>;
    } else {
      return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded" data-testid="badge-pending">Pending</span>;
    }
  }, [getMeetsCriterion]);

  const updateCriteriaVerified = useCallback((id: string, value: string) => {
    setCriteriaData(prev => prev.map(row => 
      row.id === id ? { ...row, verified: value } : row
    ));
  }, []);

  const parentCriteriaIds = ['a2.3', 'a2.5', 'a2.6', 'a2.7'];

  const getChildrenIds = useCallback((parentId: string): string[] => {
    if (parentId === 'a2.7') {
      return cesTests.map((_, index) => `a2.7${String.fromCharCode(97 + index)}`);
    }
    return criteriaData
      .filter(row => row.id.startsWith(parentId) && row.id.length > parentId.length)
      .map(row => row.id);
  }, [cesTests, criteriaData]);

  const computeParentStatus = useCallback((parentId: string): 'yes' | 'na' | 'pending' => {
    if (parentId === 'a2.5') {
      if (existingReviewData?.checklistProgressData) {
        try {
          const progressResult = calculateChecklistProgressFromJson(
            existingReviewData.checklistProgressData,
            a2Config?.minChecklistVerifications ?? 1,
            a2Config?.minChecklistCompletionPercent ?? 85
          );
          if (progressResult.totalRequired > 0) {
            return progressResult.meetsThreshold ? 'yes' : 'pending';
          }
        } catch {
        }
      }
      return 'pending';
    }

    if (parentId === 'a2.3') {
      const childrenIds = getChildrenIds(parentId);
      if (childrenIds.length === 0) return 'pending';
      const anyChildMeets = childrenIds.some(childId => {
        const child = criteriaData.find(row => row.id === childId);
        if (!child) return false;
        return getMeetsCriterion(child.required, child.resultFromDb) === 'met';
      });
      return anyChildMeets ? 'yes' : 'pending';
    }

    const childrenIds = getChildrenIds(parentId);
    if (childrenIds.length === 0) return 'pending';

    const childVerifiedValues: string[] = [];
    
    if (parentId === 'a2.7') {
      cesTests.forEach(test => {
        const rl = (test.result || '').trim().toLowerCase();
        if (rl === 'pass') {
          childVerifiedValues.push('yes');
        } else if (rl === 'na' || rl === 'n/a') {
          childVerifiedValues.push('na');
        } else {
          childVerifiedValues.push('');
        }
      });
    } else {
      childrenIds.forEach(childId => {
        const child = criteriaData.find(row => row.id === childId);
        childVerifiedValues.push(child?.verified || '');
      });
    }

    const hasBlank = childVerifiedValues.some(v => v === '' || v === undefined);
    if (hasBlank) return 'pending';

    const allNa = childVerifiedValues.every(v => v === 'na');
    if (allNa) return 'na';

    const hasYes = childVerifiedValues.some(v => v === 'yes');
    const allYesOrNa = childVerifiedValues.every(v => v === 'yes' || v === 'na');
    if (hasYes && allYesOrNa) return 'yes';

    return 'pending';
  }, [getChildrenIds, cesTests, criteriaData, existingReviewData?.checklistProgressData, a2Config?.minChecklistCompletionPercent, a2Config?.minChecklistVerifications, getMeetsCriterion]);

  const isParentCriteria = useCallback((id: string): boolean => parentCriteriaIds.includes(id), []);

  const isOtherCriteriaSubItem = useCallback((id: string): boolean => {
    return id.startsWith('a2.6') && id.length > 4;
  }, []);

  const computeOtherCriteriaMeetsCriterion = useCallback((): 'yes' | 'na' | 'pending' => {
    const otherCriteriaSubItems = criteriaData.filter(row => isOtherCriteriaSubItem(row.id));
    if (otherCriteriaSubItems.length === 0) return 'pending';
    
    const verifiedValues = otherCriteriaSubItems.map(row => row.verified || '');
    const hasBlank = verifiedValues.some(v => v === '' || v === undefined);
    if (hasBlank) return 'pending';
    
    if (verifiedValues.some(v => v === 'yes')) return 'yes';
    if (verifiedValues.every(v => v === 'na')) return 'na';
    
    return 'pending';
  }, [criteriaData, isOtherCriteriaSubItem]);

  const addCesTest = useCallback(() => {
    const newId = nextCesTestIdRef.current.toString();
    nextCesTestIdRef.current += 1;
    setCesTests(prev => [...prev, {
      id: newId,
      description: '',
      date: '',
      minScore: '',
      score: '',
      result: ''
    }]);
  }, []);

  const deleteCesTest = useCallback((id: string) => {
    setCesTests(prev => prev.filter(t => t.id !== id));
  }, []);

  const updateCesTest = useCallback((id: string, field: string, value: string) => {
    setCesTests(prev => prev.map(t =>
      t.id === id ? { ...t, [field]: value } : t
    ));
  }, []);

  const addTrainingRow = useCallback(() => {
    const newId = nextTrainingIdRef.current.toString();
    nextTrainingIdRef.current += 1;
    setTrainingNeeds(prev => [...prev, {
      id: newId,
      training: '',
      correspondingInDB: '',
      category: '',
      status: '',
      completionDate: 'dd-mm-yy',
      addedFromDB: false,
    }]);
  }, []);

  const deleteTrainingRow = useCallback((id: string) => {
    setTrainingNeeds(prev => prev.filter(t => t.id !== id));
  }, []);

  const updateTraining = useCallback((id: string, field: string, value: string) => {
    setTrainingNeeds(prev => prev.map(t =>
      t.id === id ? { ...t, [field]: value } : t
    ));
  }, []);

  const addTrainingsFromDatabase = useCallback((selectedTemplates: TrainingCourseTemplate[]) => {
    const newTrainings = selectedTemplates.map((template) => {
      const newId = nextTrainingIdRef.current.toString();
      nextTrainingIdRef.current += 1;
      return {
        id: newId,
        training: template.name,
        correspondingInDB: template.id,
        category: '',
        status: '',
        completionDate: 'dd-mm-yy',
        addedFromDB: true,
      };
    });
    setTrainingNeeds(prev => [...prev, ...newTrainings]);
  }, []);

  const addApprover = useCallback(() => {
    const newId = nextApproverIdRef.current.toString();
    nextApproverIdRef.current += 1;
    const currentDate = new Date().toISOString().split('T')[0];
    setApprovers(prev => [...prev, {
      id: newId,
      date: currentDate,
      approver: '',
      status: '',
      approval: '',
      comments: '',
      isFromPartA: false
    }]);
  }, []);

  const deleteApprover = useCallback((id: string) => {
    setApprovers(prev => prev.filter(a => a.id !== id));
  }, []);

  const updateApprover = useCallback((id: string, field: string, value: string) => {
    setApprovers(prev => prev.map(a =>
      a.id === id ? { ...a, [field]: value } : a
    ));
  }, []);

  const removeVesselType = useCallback((type: string) => {
    setVesselTypes(prev => prev.filter(t => t !== type));
  }, []);

  const removeVesselClass = useCallback((cls: string) => {
    setVesselClasses(prev => prev.filter(c => c !== cls));
  }, []);

  const addVesselType = useCallback((type: string) => {
    if (!type) return;
    setVesselTypes(prev => (prev.includes(type) ? prev : [...prev, type]));
  }, []);

  const addVesselClass = useCallback((cls: string) => {
    if (!cls) return;
    setVesselClasses(prev => (prev.includes(cls) ? prev : [...prev, cls]));
  }, []);

  const addComment = useCallback(() => {
    const newId = nextCommentIdRef.current.toString();
    nextCommentIdRef.current += 1;
    const currentUserDisplay = getCurrentUserDisplay();
    setComments(prev => [...prev, {
      id: newId,
      user: currentUserDisplay,
      text: ''
    }]);
    setEditingCommentId(newId);
  }, []);

  const deleteComment = useCallback((id: string) => {
    setComments(prev => prev.filter(c => c.id !== id));
  }, []);

  const toggleApproverSelection = useCallback((approver: { userUuid: string; displayName: string }) => {
    setSelectedApproversForSubmission(prev => {
      if (prev.some(a => a.userUuid === approver.userUuid)) {
        return prev.filter(a => a.userUuid !== approver.userUuid);
      } else {
        return [...prev, approver];
      }
    });
  }, []);

  const handleSubmitForApproval = useCallback(() => {
    if (isSubmittingForApproval) {
      return;
    }
    
    if (selectedApproversForSubmission.length === 0) {
      toast({
        title: "No Approvers Selected",
        description: "Please select at least one approver before submitting for approval.",
        variant: "destructive",
      });
      return;
    }

    const resolvedApprovers = selectedApproversForSubmission.map(a => {
      if (a.userUuid) return a;
      const match = approverMasterData.find(m => m.displayName === a.displayName);
      return match ? { userUuid: match.userUuid, displayName: a.displayName } : a;
    });
    
    const unresolved = resolvedApprovers.filter(a => !a.userUuid);
    if (unresolved.length > 0) {
      toast({
        title: "Approver Data Issue",
        description: `Could not resolve identity for: ${unresolved.map(a => a.displayName).join(', ')}. Please re-select approvers.`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingForApproval(true);
    setSelectedApproversForSubmission(resolvedApprovers);
    
    const currentDate = new Date().toISOString().split('T')[0];
    
    const newApprovers: Approver[] = resolvedApprovers.map((approverObj) => {
      const existing = approvers.find(a => a.isFromPartA && a.id === approverObj.userUuid);
      return existing
        ? { ...existing, approver: approverObj.displayName, isFromPartA: true }
        : {
            id: approverObj.userUuid,
            date: currentDate,
            approver: approverObj.displayName,
            status: '',
            approval: '',
            comments: '',
            isFromPartA: true,
          };
    });

    const preservedNonPartA = approvers.filter(a => !a.isFromPartA);
    const mergedApprovers: Approver[] = [...newApprovers, ...preservedNonPartA];

    setApprovers(mergedApprovers);
    
    const reviewData = collectFormData({
      partANotes: '',
      partBNotes: '',
      partCNotes: '',
    }, 'a');
    
    reviewData.approvalData = JSON.stringify(mergedApprovers);
    reviewData.selectedApproversForSubmission = JSON.stringify(resolvedApprovers);
    reviewData.status = 'submitted';
    
    const approverCount = selectedApproversForSubmission.length;
    
    const submitReviewUuid = effectiveReviewUuid;
    const endpoint = submitReviewUuid
      ? `/api/v2/promotions/reviews/${submitReviewUuid}`
      : '/api/v2/promotions/reviews';
    const method = submitReviewUuid ? 'PATCH' : 'POST';
    
    apiRequest(method, endpoint, reviewData)
      .then((data: any) => {
        if (data?.reviewUuid) {
          setSavedReviewUuid(data.reviewUuid);
        }
        if (data?.id) {
          setSavedReviewId(data.id);
        }
        toast({
          title: "Submitted for Approval",
          description: `Promotion review has been submitted to ${approverCount} approver(s).`,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/v2/promotions/reviews'] });
        queryClient.invalidateQueries({ 
          queryKey: [`/api/v2/promotions/reviews/crew/${crewMemberId}/rank/${encodeURIComponent(promotionToRank)}`] 
        });
      })
      .catch((error: any) => {
        toast({
          title: "Submission Failed",
          description: error.message || "Failed to submit for approval",
          variant: "destructive",
        });
      })
      .finally(() => {
        setIsSubmittingForApproval(false);
      });
  }, [selectedApproversForSubmission, toast, collectFormData, effectiveReviewUuid, isSubmittingForApproval, approverMasterData]);

  const updateCommentText = useCallback((id: string, text: string) => {
    setComments(prev => prev.map(c => c.id === id ? { ...c, text } : c));
  }, []);

  const cesTestsSection = useMemo(() => (
    <PartACesTests
      cesTests={cesTests}
      onUpdateCesTest={updateCesTest}
      onDeleteCesTest={deleteCesTest}
    />
  ), [cesTests, updateCesTest, deleteCesTest]);

  return (
    <div className="promotion-review-form">
      <BaseSubmoduleForm
        title="Promotion Review Form"
        sections={sections}
        schema={promotionReviewSchema}
        defaultValues={defaultValues}
        onClose={onClose}
        onSubmit={handleSubmit}
      >
      {({ activeSection, form }) => (
        <>
          {activeSection === 'a' && canViewSection('a') && (
            <div className="bg-white rounded-lg p-6">
              <div className="space-y-6">
                {rankGroupLookupResult.attempted && !rankGroupLookupResult.found && rankGroupLookupResult.targetRank && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3" data-testid="alert-no-rank-group">
                    <Info className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-yellow-800">No Promotion Rank Group Assigned</h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        No Promotion Review Form rank group has been configured for the rank "{rankGroupLookupResult.targetRank}" in Admin Module. 
                        Required criteria values will be blank until configured. Please configure a rank group in Admin &gt; Forms Configuration &gt; Promotion Review Form.
                      </p>
                    </div>
                  </div>
                )}

                <div className="border-b pb-4">
                  <h2 className="text-xl font-semibold text-[#16569e]">Part A Promotion Criteria Review</h2>
                  <p className="text-sm text-gray-500 mt-1">Assess candidate's compliance with minimum promotion criteria</p>
                </div>

                <div className="border border-[#EAEBEF] rounded-lg p-4">
                  <h3 className="text-base font-medium text-[#16569e] mb-4">A1. Seafarer's Information</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-xs text-gray-500">Name</Label>
                      <div className="text-sm font-medium mt-1">{promotionData?.name || 'Grace Davis'}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">DOB / Age</Label>
                      <div className="text-sm font-medium mt-1">{promotionData?.dob || '08-Jul-1991'} / {promotionData?.ageValue || 'N/A'}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Nationality</Label>
                      <div className="text-sm font-medium mt-1">{promotionData?.nationality || 'Georgian'}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Present Rank</Label>
                      <div className="text-sm font-medium mt-1">{promotionData?.currentRank || 'Chief Officer'}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Promotion to Rank</Label>
                      <div className="text-sm font-medium mt-1">{promotionData?.promotionToRank || 'Master'}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Current Vessel or On Leave</Label>
                      <div className="text-sm font-medium mt-1 text-blue-600">{promotionData?.vesselLeave || 'On Leave'}</div>
                    </div>
                  </div>
                </div>

                <PartACriteriaTable
                  criteriaData={criteriaData}
                  vesselTypeOptions={vesselTypeOptions}
                  selectedVesselTypeForA2_3b={selectedVesselTypeForA2_3b}
                  onVesselTypeChange={setSelectedVesselTypeForA2_3b}
                  onUpdateVerified={updateCriteriaVerified}
                  isParentCriteria={isParentCriteria}
                  isOtherCriteriaSubItem={isOtherCriteriaSubItem}
                  computeParentStatus={computeParentStatus}
                  computeOtherCriteriaMeetsCriterion={computeOtherCriteriaMeetsCriterion}
                  getMeetsCriterionBadge={renderMeetsCriterionBadge}
                  criteriaComments={criteriaComments}
                  newCriteriaComment={newCriteriaComment}
                  onSetNewCriteriaComment={setNewCriteriaComment}
                  editingCriteriaComment={editingCriteriaComment}
                  onSetEditingCriteriaComment={setEditingCriteriaComment}
                  onSetCriteriaComments={setCriteriaComments}
                  onAddCesTest={addCesTest}
                  onShowChecklistForm={() => setShowChecklistForm(true)}
                  cesTestsSection={cesTestsSection}
                  checklistProgressData={existingReviewData?.checklistProgressData}
                  minChecklistVerifications={a2Config?.minChecklistVerifications ?? undefined}
                  minChecklistCompletionPercent={a2Config?.minChecklistCompletionPercent ?? undefined}
                />

                <PartATrainingNeeds
                  trainingNeeds={trainingNeeds}
                  onUpdateTraining={updateTraining}
                  onDeleteTraining={deleteTrainingRow}
                  onAddTrainingRow={addTrainingRow}
                  onOpenTrainingDialog={() => setIsTrainingDialogOpen(true)}
                  trainingComments={trainingComments}
                  newTrainingComment={newTrainingComment}
                  onSetNewTrainingComment={setNewTrainingComment}
                  editingTrainingComment={editingTrainingComment}
                  onSetEditingTrainingComment={setEditingTrainingComment}
                  editingTrainingCommentId={editingTrainingCommentId}
                  onSetEditingTrainingCommentId={setEditingTrainingCommentId}
                  onSetTrainingComments={setTrainingComments}
                  dbTrainings={dbTrainings}
                  isLoadingDbTrainings={isLoadingDbTrainings}
                  isErrorDbTrainings={isErrorDbTrainings}
                />

                <div className="border border-[#EAEBEF] rounded-lg p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-base font-medium text-[#16569e]">A4. Comments & Recommendations</h3>
                    <Button 
                      type="button"
                      variant="outline" 
                      size="sm" 
                      className="text-xs" 
                      onClick={addComment}
                      data-testid="button-add-reviewer"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Reviewer
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {comments.map((comment) => {
                      const isEditing = editingCommentId === comment.id || !comment.text?.trim();
                      return (
                        <div key={comment.id} className="bg-gray-50 p-3 rounded" data-testid={`comment-${comment.id}`}>
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-medium" data-testid={`comment-user-${comment.id}`}>{comment.user}</span>
                            <div className="flex gap-1">
                              {!isEditing && (
                                <Button 
                                  type="button"
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-6 w-6 p-0"
                                  onClick={() => setEditingCommentId(comment.id)}
                                  data-testid={`button-comment-edit-${comment.id}`}
                                >
                                  <Edit className="h-3 w-3 text-gray-600" />
                                </Button>
                              )}
                              <Button 
                                type="button"
                                variant="ghost" 
                                size="sm" 
                                className="h-6 w-6 p-0" 
                                onClick={() => deleteComment(comment.id)}
                                data-testid={`button-comment-delete-${comment.id}`}
                              >
                                <Trash2 className="h-3 w-3 text-gray-600" />
                              </Button>
                            </div>
                          </div>
                          {isEditing ? (
                            <textarea
                              className="w-full min-h-[80px] p-2 border border-blue-200 rounded text-blue-600 italic text-sm resize-y"
                              placeholder="Comment: Add your observations here..."
                              value={comment.text}
                              onChange={(e) => updateCommentText(comment.id, e.target.value)}
                              onBlur={() => {
                                if (comment.text.trim()) {
                                  setEditingCommentId(null);
                                }
                              }}
                              autoFocus
                              data-testid={`textarea-comment-${comment.id}`}
                            />
                          ) : (
                            <p className="text-sm text-gray-700 italic" data-testid={`comment-text-${comment.id}`}>{comment.text}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-4 mb-4">
                    <Label className="text-sm text-gray-600 whitespace-nowrap">Submit for Approval to:</Label>
                    <div className="relative flex-1 max-w-md">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between text-sm font-normal"
                            data-testid="button-approver-multi-select"
                          >
                            {selectedApproversForSubmission.length === 0
                              ? "Approver"
                              : selectedApproversForSubmission.length === 1
                                ? selectedApproversForSubmission[0].displayName
                                : `${selectedApproversForSubmission.length} Approvers Selected`}
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[350px] p-0" align="start">
                          <div className="max-h-[300px] overflow-y-auto">
                            {isLoadingUsers ? (
                              <div className="px-3 py-4 text-sm text-gray-500 text-center">Loading approvers...</div>
                            ) : approverMasterData.length === 0 ? (
                              <div className="px-3 py-4 text-sm text-gray-500 text-center">No office users found</div>
                            ) : (
                              approverMasterData.map((approverItem: { userUuid: string; displayName: string }) => (
                                <div
                                  key={approverItem.userUuid}
                                  className="flex items-center px-3 py-2 cursor-pointer hover:bg-gray-100"
                                  onClick={() => toggleApproverSelection(approverItem)}
                                  data-testid={`checkbox-approver-${approverItem.displayName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}
                                >
                                  <Checkbox
                                    checked={selectedApproversForSubmission.some(a => a.userUuid === approverItem.userUuid)}
                                    className="mr-3"
                                  />
                                  <span className="text-sm">{approverItem.displayName}</span>
                                </div>
                              ))
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button 
                      type="button"
                      variant="outline" 
                      className="px-8"
                      onClick={handleSaveDraftA}
                      data-testid="button-save-part-a"
                    >
                      Save
                    </Button>
                    <Button 
                      type="button"
                      className="px-8 bg-green-600 hover:bg-green-700"
                      onClick={handleSubmitForApproval}
                      disabled={isSubmittingForApproval}
                      data-testid="button-submit-part-a"
                    >
                      {isSubmittingForApproval ? 'Submitting...' : 'Submit for Approval'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'b' && canViewSection('b') && (
            <PartBApproval
              approvers={approvers}
              onAddApprover={addApprover}
              onDeleteApprover={deleteApprover}
              onUpdateApprover={updateApprover}
              vesselTypes={vesselTypes}
              vesselClasses={vesselClasses}
              onRemoveVesselType={removeVesselType}
              onRemoveVesselClass={removeVesselClass}
              onAddVesselType={addVesselType}
              onAddVesselClass={addVesselClass}
              vesselTypeOptions={b2VesselTypeOptions}
              vesselClassOptions={b2FleetGroupOptions}
              isLoadingVesselTypeOptions={isLoadingVesselTypesV2}
              isLoadingVesselClassOptions={isLoadingFleetGroupsV2}
              onSave={handleSaveDraftB}
              onSubmit={handleSubmitPartB}
              approverNames={approverMasterData.map(a => a.displayName)}
            />
          )}

          {activeSection === 'c' && canViewSection('c') && (
            <PartCExecution
              promotionConfirmed={promotionConfirmed}
              onSetPromotionConfirmed={setPromotionConfirmed}
              vesselAssigned={vesselAssigned}
              onSetVesselAssigned={setVesselAssigned}
              promotionDate={promotionDate}
              onSetPromotionDate={setPromotionDate}
              promotionTiming={promotionTiming}
              onSetPromotionTiming={setPromotionTiming}
              vessels={vesselOptions}
              currentUserDisplay={currentUserDisplay}
              onSave={handleSaveDraftC}
              onSubmit={handleSubmitPartC}
            />
          )}
        </>
      )}
      </BaseSubmoduleForm>

      {showChecklistForm && (
        <PromotionChecklistForm 
          promotionData={promotionData}
          onClose={() => setShowChecklistForm(false)}
          checklistConfig={a2Config}
          promotionReviewId={savedReviewId ?? existingReviewData?.id ?? null}
          promotionReviewUuid={effectiveReviewUuid}
          existingChecklistData={existingReviewData?.checklistProgressData}
        />
      )}

      <TrainingCourseSelectionDialog
        open={isTrainingDialogOpen}
        onClose={() => setIsTrainingDialogOpen(false)}
        onConfirm={addTrainingsFromDatabase}
        existingCourseIds={trainingNeeds.map(t => t.correspondingInDB).filter(Boolean)}
      />
    </div>
  );
};
