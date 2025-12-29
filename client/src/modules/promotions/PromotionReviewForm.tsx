import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { BaseSubmoduleForm, FormSection } from '@/components/BaseSubmoduleForm';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Info, Plus, Edit, Trash2 } from 'lucide-react';
import { z } from 'zod';
import { PromotionChecklistForm } from './PromotionChecklistForm';
import { TrainingCourseSelectionDialog } from '@/modules/crew-pool/TrainingCourseSelectionDialog';
import type { TrainingCourseTemplate } from '@/utils/data/trainingCourseTemplates';
import type { Form, RankGroup, CrewMember, CrewDashboardSummary, PromotionReview } from '@shared/schema';
import type { PromotionA2Config } from '@shared/schema';
import { useRankNormalization } from '@/hooks/useRankNormalization';
import { useExternalVesselTypes } from '@/hooks/useExternalVesselTypes';
import { getVesselTypesForDropdown } from '@/utils/data/vesselTypes';
import type { LicenseRecord } from '@/utils/data/licenseDceTemplates';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

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


export const PromotionReviewForm: React.FC<PromotionReviewFormProps> = ({
  promotionData,
  onClose,
}) => {
  const { toast } = useToast();
  const sections = [
    { id: 'a', title: 'Part A: Promotion Criteria Review', letter: 'A' },
    { id: 'b', title: 'Part B: Approval', letter: 'B' },
    { id: 'c', title: 'Part C: Execution', letter: 'C' },
  ];

  const { data: formsData } = useQuery<Form[]>({
    queryKey: ['/api/forms'],
  });

  const { data: rankGroupsData } = useQuery<RankGroup[]>({
    queryKey: ['/api/rank-groups'],
  });

  const { data: licenseEntriesData } = useQuery<any[]>({
    queryKey: ['/api/masters/016/data'],
  });

  const crewMemberId = promotionData?.crewMemberId ?? '';
  const promotionToRank = promotionData?.promotionToRank ?? '';

  const { data: crewMemberData } = useQuery<CrewMember>({
    queryKey: [`/api/crew-members/${crewMemberId}`],
    enabled: !!crewMemberId,
  });

  const { data: dashboardData } = useQuery<CrewDashboardSummary>({
    queryKey: [`/api/crew-members/${crewMemberId}/dashboard`],
    enabled: !!crewMemberId,
  });

  const { data: externalVesselTypesData } = useExternalVesselTypes();
  const { normalizeRank } = useRankNormalization();

  const presentRank = crewMemberData?.presentRank ?? '';

  // Fetch promotion recommendations count from completed appraisals at current rank
  const { data: promotionRecommendationsData } = useQuery<{ count: number; rank: string; crewMemberId: string }>({
    queryKey: [`/api/appraisals/crew/${crewMemberId}/promotion-recommendations?rank=${encodeURIComponent(presentRank)}`],
    enabled: !!crewMemberId && !!presentRank,
  });

  const a2_4_recommendationsResult = useMemo(() => {
    if (promotionRecommendationsData?.count !== undefined) {
      return String(promotionRecommendationsData.count);
    }
    return '';
  }, [promotionRecommendationsData]);

  const [savedReviewId, setSavedReviewId] = useState<number | null>(null);

  const { data: existingReviewData, isLoading: isLoadingReview } = useQuery<PromotionReview>({
    queryKey: [`/api/promotion-reviews/crew/${crewMemberId}/rank/${encodeURIComponent(promotionToRank)}`],
    enabled: !!crewMemberId && !!promotionToRank,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const endpoint = savedReviewId
        ? `/api/promotion-reviews/${savedReviewId}`
        : '/api/promotion-reviews';
      const method = savedReviewId ? 'PATCH' : 'POST';
      const response = await apiRequest(method, endpoint, data);
      return response;
    },
    onSuccess: (data: any) => {
      if (data?.id) {
        setSavedReviewId(data.id);
      }
      toast({
        title: "Draft Saved",
        description: "Your promotion review progress has been saved.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/promotion-reviews'] });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save draft",
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

  const a2Config = useMemo<PromotionA2Config | null>(() => {
    if (!promotionData?.promotionToRank || !formsData || !rankGroupsData) return null;
    const promotionReviewForm = formsData.find(f => f.name === 'Promotion Review Form');
    if (!promotionReviewForm) return null;
    const formRankGroups = rankGroupsData.filter(rg => 
      rg.formId === promotionReviewForm.id && !rg.archivedAt
    );
    const targetRank = promotionData.promotionToRank;
    const normalizedTarget = normalizeRank(targetRank);
    const matchingRankGroup = formRankGroups.find(rg => {
      const groupRanks = parseRanksArray(rg.ranks);
      return groupRanks.some((rank: string) => normalizeRank(rank) === normalizedTarget);
    });
    if (!matchingRankGroup) return null;
    try {
      const config = matchingRankGroup.configuration;
      if (!config) return null;
      const parsed = typeof config === 'string' ? JSON.parse(config) : config;
      // Support both nested format (promotionA2) and flat format (direct config)
      const promotionConfig = parsed?.promotionA2 ?? parsed;
      // Validate it's a PromotionA2Config by checking for any known schema field
      if (promotionConfig && typeof promotionConfig === 'object') {
        const knownFields = ['higherLicenseIds', 'ageMin', 'ageMax', 'experienceMonths', 
          'minRecommendations', 'minChecklistVerifications', 'minChecklistCompletionPercent', 
          'otherCriteria', 'cesTests'];
        const hasKnownField = knownFields.some(field => field in promotionConfig);
        if (hasKnownField) return promotionConfig;
      }
      return null;
    } catch {
      return null;
    }
  }, [promotionData?.promotionToRank, formsData, rankGroupsData, normalizeRank, parseRanksArray]);

  const licenseNamesById = useMemo(() => {
    if (!licenseEntriesData) return {};
    const map: Record<number, string> = {};
    licenseEntriesData.forEach((entry: any) => {
      if (entry.id && entry.name) {
        map[entry.id] = entry.name;
      }
    });
    return map;
  }, [licenseEntriesData]);

  const requiredLicenseDisplay = useMemo(() => {
    if (!a2Config?.higherLicenseIds?.length) return '';
    const names = a2Config.higherLicenseIds
      .map(id => licenseNamesById[Number(id)] || `License ID ${id}`)
      .filter(Boolean);
    return names.join(', ') || '';
  }, [a2Config?.higherLicenseIds, licenseNamesById]);

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
    if (!crewMemberData) return '';
    const licenses = (crewMemberData as any).licensesAndCertificates || [];
    if (!a2Config?.higherLicenseIds?.length) {
      const cocLicense = licenses.find((lic: LicenseRecord) => 
        lic.certificateDocument?.toLowerCase().includes('coc') || 
        lic.certificateDocument?.toLowerCase().includes('certificate of competency')
      );
      return cocLicense ? 'Yes' : 'No';
    }
    const requiredLicenseNames = a2Config.higherLicenseIds
      .map(id => licenseNamesById[Number(id)])
      .filter(Boolean);
    if (!requiredLicenseNames.length) return 'No';
    const hasAnyLicense = requiredLicenseNames.some(requiredName => {
      const requiredLower = requiredName.toLowerCase();
      return licenses.some((lic: LicenseRecord) => {
        const certDoc = lic.certificateDocument?.toLowerCase() || '';
        const licId = lic.licenseId?.toLowerCase() || '';
        return certDoc.includes(requiredLower) || 
               requiredLower.includes(certDoc) ||
               licId.includes(requiredLower);
      });
    });
    return hasAnyLicense ? 'Yes' : 'No';
  }, [crewMemberData, a2Config?.higherLicenseIds, licenseNamesById]);

  const a2_2_ageResult = useMemo(() => {
    if (!crewMemberData?.dateOfBirth) return '';
    const dob = new Date(crewMemberData.dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return `${age} Years`;
  }, [crewMemberData?.dateOfBirth]);

  const a2_3a_rankExperienceResult = useMemo(() => {
    if (!dashboardData?.experience?.rank) return '';
    const rankYears = dashboardData.experience.rank;
    const rankMonths = Math.round(rankYears * 12);
    return `${rankMonths} Months`;
  }, [dashboardData]);

  const vesselTypeOptions = useMemo(() => {
    if (externalVesselTypesData && externalVesselTypesData.length > 0) {
      return externalVesselTypesData.map((vt: any) => vt.name || vt.vesselType || String(vt));
    }
    return getVesselTypesForDropdown();
  }, [externalVesselTypesData]);

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
    if (!dashboardData?.experience?.company) return '';
    const companyYears = dashboardData.experience.company;
    const companyMonths = Math.round(companyYears * 12);
    return `${companyMonths} Months`;
  }, [dashboardData]);

  const a2_3d_tankerExperienceResult = useMemo(() => {
    if (!dashboardData?.experience?.tankers) return '';
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
        resultFromDb: '', 
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

    setCriteriaData(prev => {
      if (prev.length === 0) {
        return baseCriteria;
      }
      const existingVerifiedMap = new Map(prev.map(row => [row.id, row.verified]));
      return baseCriteria.map(row => ({
        ...row,
        verified: existingVerifiedMap.get(row.id) || row.verified,
      }));
    });
  }, [a2Config, requiredLicenseDisplay, requiredAgeDisplay, a2_1_licenseResult, a2_2_ageResult, a2_3a_rankExperienceResult, a2_3b_vesselTypeExperienceResult, a2_3c_companyServiceResult, a2_3d_tankerExperienceResult, a2_4_recommendationsResult]);

  const [cesTests, setCesTests] = useState<CesTest[]>([]);

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
        if (prev.length === 0) {
          return [{ id: '1', description: '', date: '', minScore: '', score: '', result: '' }];
        }
        return prev;
      }
    });
  }, [a2Config]);

  const [criteriaComments, setCriteriaComments] = useState<Record<string, Comment[]>>({});
  const [newCriteriaComment, setNewCriteriaComment] = useState<Record<string, string>>({});
  const [editingCriteriaComment, setEditingCriteriaComment] = useState<string | null>(null);

  const [trainingNeeds, setTrainingNeeds] = useState<TrainingRow[]>([
    { id: '1', training: 'LT Endorsement', correspondingInDB: '', category: '1. Competence', status: 'Proposed', completionDate: 'dd-mm-yy' },
    { id: '2', training: 'Crowd Control', correspondingInDB: '', category: '1. Competence', status: 'Proposed', completionDate: 'dd-mm-yy' },
  ]);
  const [isTrainingDialogOpen, setIsTrainingDialogOpen] = useState(false);

  const [trainingComments, setTrainingComments] = useState<Record<string, Comment[]>>({});
  const [newTrainingComment, setNewTrainingComment] = useState<Record<string, string>>({});
  const [editingTrainingComment, setEditingTrainingComment] = useState<string | null>(null);

  const [comments, setComments] = useState<Comment[]>([
    { id: '1', user: 'Roxanne, Crewing Executive', text: 'Shows good aptitude for senior roles. Candidate has the right credentials and experience.' },
    { id: '2', user: 'Roxanne, Crewing Executive', text: 'Pending completion of minimum rank experience and COC Master license.' },
  ]);

  const [approvers, setApprovers] = useState<Approver[]>([
    { id: '1', date: '', approver: '', status: '', approval: 'yes', comments: '' },
    { id: '2', date: '', approver: '', status: '', approval: 'yes', comments: '' },
  ]);

  const nextApproverIdRef = useRef(3);
  const nextCesTestIdRef = useRef(2);
  const nextCommentIdRef = useRef(3);
  const nextTrainingIdRef = useRef(6);

  const [vesselTypes, setVesselTypes] = useState<string[]>(['Product Tankers', 'Crude Oil Tankers']);
  const [vesselClasses, setVesselClasses] = useState<string[]>(['MR Class1 Tankers', 'Chemical JP 20']);

  const [promotionConfirmed, setPromotionConfirmed] = useState<string>('yes');
  const [vesselAssigned, setVesselAssigned] = useState<string>('');
  const [promotionDate, setPromotionDate] = useState<string>('');
  const [promotionTiming, setPromotionTiming] = useState<string>('on-board');

  const [showChecklistForm, setShowChecklistForm] = useState(false);

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
            setCesTests(cesData);
          }
        } catch {}
      }
      
      if (existingReviewData.criteriaComments) {
        try {
          const commentData = typeof existingReviewData.criteriaComments === 'string'
            ? JSON.parse(existingReviewData.criteriaComments)
            : existingReviewData.criteriaComments;
          setCriteriaComments(commentData);
        } catch {}
      }
      
      if (existingReviewData.trainingNeeds) {
        try {
          const training = typeof existingReviewData.trainingNeeds === 'string'
            ? JSON.parse(existingReviewData.trainingNeeds)
            : existingReviewData.trainingNeeds;
          if (Array.isArray(training) && training.length > 0) {
            setTrainingNeeds(training);
          }
        } catch {}
      }
      
      if (existingReviewData.approvalData) {
        try {
          const approvalData = typeof existingReviewData.approvalData === 'string'
            ? JSON.parse(existingReviewData.approvalData)
            : existingReviewData.approvalData;
          if (Array.isArray(approvalData) && approvalData.length > 0) {
            setApprovers(approvalData);
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
    }
  }, [existingReviewData]);

  const collectFormData = useCallback((formData: PromotionReviewFormData) => {
    const criteriaVerifiedStatus: Record<string, string> = {};
    const criteriaMeetsStatus: Record<string, string> = {};
    
    // Helper function to compute meets status (inlined to avoid dependency issues)
    const computeMeetsStatus = (required: string, result: string): string => {
      if (!required || !result) return 'pending';
      
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
      criteriaMeetsStatus[row.id] = computeMeetsStatus(row.required, row.resultFromDb);
    });
    
    // Compute parent criteria aggregation (a2.3, a2.6)
    // Parent is 'yes' if all children are 'yes', 'pending' if any child is 'pending' or 'no'
    const parentIds = ['a2.3', 'a2.6'];
    parentIds.forEach(parentId => {
      const childIds = Object.keys(criteriaMeetsStatus).filter(
        id => id.startsWith(parentId) && id.length > parentId.length
      );
      if (childIds.length > 0) {
        const childValues = childIds.map(id => criteriaMeetsStatus[id]);
        if (childValues.every(v => v === 'yes')) {
          criteriaMeetsStatus[parentId] = 'yes';
        } else {
          // Per user spec: 'No' or 'Pending' → Yellow dot, so map both to 'pending'
          criteriaMeetsStatus[parentId] = 'pending';
        }
      }
    });
    
    // Compute CES tests meets status (a2.7)
    // If all tests pass/NA → yes, if any fail/empty → pending (Yellow per user spec)
    if (cesTests.length > 0) {
      const results = cesTests.map(t => t.result || '');
      if (results.every(r => r === 'Pass' || r === 'NA')) {
        criteriaMeetsStatus['a2.7'] = 'yes';
      } else {
        // Any empty, Fail, or other result → pending (Yellow per user spec)
        criteriaMeetsStatus['a2.7'] = 'pending';
      }
    }

    return {
      crewMemberId: promotionData?.crewMemberId,
      promotionToRank: promotionData?.promotionToRank,
      selectedVesselTypeForA2_3b: selectedVesselTypeForA2_3b || null,
      criteriaVerifiedStatus: JSON.stringify(criteriaVerifiedStatus),
      criteriaMeetsStatus: JSON.stringify(criteriaMeetsStatus),
      cesTestsData: JSON.stringify(cesTests),
      criteriaComments: JSON.stringify(criteriaComments),
      trainingNeeds: JSON.stringify(trainingNeeds),
      approvalData: JSON.stringify(approvers),
      promotionConfirmed,
      vesselAssigned,
      promotionDate,
      promotionTiming,
      partANotes: formData.partANotes || null,
      partBNotes: formData.partBNotes || null,
      partCNotes: formData.partCNotes || null,
      status: 'draft',
    };
  }, [criteriaData, cesTests, criteriaComments, trainingNeeds, approvers, promotionConfirmed, vesselAssigned, promotionDate, promotionTiming, selectedVesselTypeForA2_3b, promotionData]);

  const handleSaveDraft = useCallback(() => {
    const reviewData = collectFormData({
      partANotes: '',
      partBNotes: '',
      partCNotes: '',
    });
    saveMutation.mutate(reviewData);
  }, [collectFormData, saveMutation]);

  const handleSubmit = (data: PromotionReviewFormData) => {
    const reviewData = collectFormData(data);
    saveMutation.mutate(reviewData);
  };

  const getMeetsCriterion = useCallback((required: string, result: string) => {
    if (!required || !result) return 'pending';
    
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

  const parentCriteriaIds = ['a2.3', 'a2.6', 'a2.7'];

  const getChildrenIds = useCallback((parentId: string): string[] => {
    if (parentId === 'a2.7') {
      return cesTests.map((_, index) => `a2.7${String.fromCharCode(97 + index)}`);
    }
    return criteriaData
      .filter(row => row.id.startsWith(parentId) && row.id.length > parentId.length)
      .map(row => row.id);
  }, [cesTests, criteriaData]);

  const computeParentStatus = useCallback((parentId: string): 'yes' | 'na' | 'pending' => {
    const childrenIds = getChildrenIds(parentId);
    if (childrenIds.length === 0) return 'pending';

    const childVerifiedValues: string[] = [];
    
    if (parentId === 'a2.7') {
      cesTests.forEach(test => {
        if (test.result === 'Pass') {
          childVerifiedValues.push('yes');
        } else if (test.result === 'NA') {
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
  }, [getChildrenIds, cesTests, criteriaData]);

  const isParentCriteria = useCallback((id: string): boolean => parentCriteriaIds.includes(id), []);

  const isOtherCriteriaSubItem = useCallback((id: string): boolean => {
    return id.startsWith('a2.6') && id.length > 4;
  }, []);

  const computeOtherCriteriaMeetsCriterion = useCallback((): 'yes' | 'pending' => {
    const otherCriteriaSubItems = criteriaData.filter(row => isOtherCriteriaSubItem(row.id));
    if (otherCriteriaSubItems.length === 0) return 'pending';
    
    const verifiedValues = otherCriteriaSubItems.map(row => row.verified || '');
    const hasBlank = verifiedValues.some(v => v === '' || v === undefined);
    if (hasBlank) return 'pending';
    
    const allYesOrNa = verifiedValues.every(v => v === 'yes' || v === 'na');
    if (allYesOrNa) return 'yes';
    
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
      training: `Training ${newId}`,
      correspondingInDB: '',
      category: '1. Competence',
      status: 'Proposed',
      completionDate: 'dd-mm-yy'
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
      const templateWithCategory = template as TrainingCourseTemplate & { category?: string };
      return {
        id: newId,
        training: template.name,
        correspondingInDB: template.id,
        category: templateWithCategory.category === 'S' ? '1. Competence' : '2. Soft Skills',
        status: 'Proposed',
        completionDate: 'dd-mm-yy'
      };
    });
    setTrainingNeeds(prev => [...prev, ...newTrainings]);
  }, []);

  const addApprover = useCallback(() => {
    const newId = nextApproverIdRef.current.toString();
    nextApproverIdRef.current += 1;
    setApprovers(prev => [...prev, {
      id: newId,
      date: '',
      approver: '',
      status: '',
      approval: 'yes',
      comments: ''
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

  const addComment = useCallback(() => {
    const newId = nextCommentIdRef.current.toString();
    nextCommentIdRef.current += 1;
    setComments(prev => [...prev, {
      id: newId,
      user: 'New User',
      text: ''
    }]);
  }, []);

  const deleteComment = useCallback((id: string) => {
    setComments(prev => prev.filter(c => c.id !== id));
  }, []);

  const cesTestsSection = useMemo(() => (
    <PartACesTests
      cesTests={cesTests}
      onUpdateCesTest={updateCesTest}
      onDeleteCesTest={deleteCesTest}
    />
  ), [cesTests, updateCesTest, deleteCesTest]);

  return (
    <>
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
          {activeSection === 'a' && (
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
                  onSetTrainingComments={setTrainingComments}
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
                    {comments.map((comment) => (
                      <div key={comment.id} className="bg-gray-50 p-3 rounded" data-testid={`comment-${comment.id}`}>
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-sm font-medium text-blue-600" data-testid={`comment-user-${comment.id}`}>{comment.user}</span>
                          <div className="flex gap-1">
                            <Button 
                              type="button"
                              variant="ghost" 
                              size="sm" 
                              className="h-6 w-6 p-0"
                              data-testid={`button-comment-edit-${comment.id}`}
                            >
                              <Edit className="h-3 w-3 text-gray-600" />
                            </Button>
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
                        <p className="text-sm text-gray-700 italic" data-testid={`comment-text-${comment.id}`}>{comment.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button 
                    variant="outline" 
                    className="px-8"
                    data-testid="button-save-part-a"
                  >
                    Save
                  </Button>
                  <Button 
                    className="px-8 bg-green-600 hover:bg-green-700"
                    data-testid="button-submit-part-a"
                  >
                    Submit
                  </Button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'b' && (
            <PartBApproval
              approvers={approvers}
              onAddApprover={addApprover}
              onDeleteApprover={deleteApprover}
              onUpdateApprover={updateApprover}
              vesselTypes={vesselTypes}
              vesselClasses={vesselClasses}
              onRemoveVesselType={removeVesselType}
              onRemoveVesselClass={removeVesselClass}
            />
          )}

          {activeSection === 'c' && (
            <PartCExecution
              promotionConfirmed={promotionConfirmed}
              onSetPromotionConfirmed={setPromotionConfirmed}
              vesselAssigned={vesselAssigned}
              onSetVesselAssigned={setVesselAssigned}
              promotionDate={promotionDate}
              onSetPromotionDate={setPromotionDate}
              promotionTiming={promotionTiming}
              onSetPromotionTiming={setPromotionTiming}
            />
          )}
        </>
      )}
      </BaseSubmoduleForm>

      {showChecklistForm && (
        <PromotionChecklistForm 
          promotionData={promotionData}
          onClose={() => setShowChecklistForm(false)}
        />
      )}

      <TrainingCourseSelectionDialog
        open={isTrainingDialogOpen}
        onClose={() => setIsTrainingDialogOpen(false)}
        onConfirm={addTrainingsFromDatabase}
        existingCourseIds={trainingNeeds.map(t => t.correspondingInDB).filter(Boolean)}
      />
    </>
  );
};
