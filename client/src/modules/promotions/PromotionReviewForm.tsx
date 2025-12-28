import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BaseSubmoduleForm, FormSection } from '@/components/BaseSubmoduleForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Eye, Edit, Trash2, Plus, Info, X, MessageSquare } from 'lucide-react';
import { z } from 'zod';
import { PromotionChecklistForm } from './PromotionChecklistForm';
import { TrainingCourseSelectionDialog } from '@/modules/crew-pool/TrainingCourseSelectionDialog';
import type { TrainingCourseTemplate } from '@/utils/data/trainingCourseTemplates';
import type { Form, RankGroup } from '@shared/schema';
import type { PromotionA2Config } from '@shared/schema';
import { useRankNormalization } from '@/hooks/useRankNormalization';

interface PromotionReviewFormProps {
  promotionData: any;
  onClose: () => void;
}

const promotionReviewSchema = z.object({
  // Part A - Promotion Criteria Review
  partANotes: z.string().optional(),
  
  // Part B - Approval
  partBNotes: z.string().optional(),
  
  // Part C - Execution
  partCNotes: z.string().optional(),
});

type PromotionReviewFormData = z.infer<typeof promotionReviewSchema>;

interface CriteriaRow {
  id: string;
  criteria: string;
  required: string;
  resultFromDb: string;
  verified: string;
  hasInfo?: boolean;
}

interface TrainingRow {
  id: string;
  training: string;
  correspondingInDB: string;
  category: string;
  status: string;
  completionDate: string;
}

interface Comment {
  id: string;
  user: string;
  text: string;
}

interface Approver {
  id: string;
  date: string;
  approver: string;
  status: string;
  approval: string; // 'yes' | 'yes-conditional' | 'no'
  comments: string;
}

export const PromotionReviewForm: React.FC<PromotionReviewFormProps> = ({
  promotionData,
  onClose,
}) => {
  const sections = [
    { id: 'a', title: 'Part A: Promotion Criteria Review', letter: 'A' },
    { id: 'b', title: 'Part B: Approval', letter: 'B' },
    { id: 'c', title: 'Part C: Execution', letter: 'C' },
  ];

  // Fetch forms to find the Promotion Review Form
  const { data: formsData } = useQuery<Form[]>({
    queryKey: ['/api/forms'],
  });

  // Fetch rank groups
  const { data: rankGroupsData } = useQuery<RankGroup[]>({
    queryKey: ['/api/rank-groups'],
  });

  // Fetch license data from Master 016
  const { data: licenseEntriesData } = useQuery<any[]>({
    queryKey: ['/api/master-data-entries/by-code/016'],
  });

  // Rank normalization - needed to match raw ranks (e.g., "3rd Officer_1") to parent ranks ("3rd Officer") in rank groups
  const { normalizeRank } = useRankNormalization();

  // Check if rank group lookup has been attempted and whether a match was found
  const rankGroupLookupResult = useMemo<{ attempted: boolean; found: boolean; targetRank: string | null }>(() => {
    if (!formsData || !rankGroupsData) {
      return { attempted: false, found: false, targetRank: null };
    }

    const promotionForm = formsData.find(f => f.name === 'Promotion Review Form');
    if (!promotionForm) {
      return { attempted: true, found: false, targetRank: null };
    }

    const rawTargetRank = promotionData?.promotionToRank;
    if (!rawTargetRank || rawTargetRank === '-') {
      return { attempted: true, found: false, targetRank: null };
    }

    const targetRank = normalizeRank(rawTargetRank);

    const matchingRankGroup = rankGroupsData.find(rg => {
      if (rg.formId !== promotionForm.id || rg.archivedAt !== null) return false;
      try {
        const ranksArray = typeof rg.ranks === 'string' ? JSON.parse(rg.ranks) : rg.ranks;
        return ranksArray && Array.isArray(ranksArray) && ranksArray.includes(targetRank);
      } catch {
        return false;
      }
    });

    return { 
      attempted: true, 
      found: !!matchingRankGroup, 
      targetRank 
    };
  }, [formsData, rankGroupsData, promotionData, normalizeRank]);

  // Find the rank group configuration based on the target promotion rank
  const a2Config = useMemo<PromotionA2Config | null>(() => {
    if (!formsData || !rankGroupsData) return null;

    // Find the Promotion Review Form
    const promotionForm = formsData.find(f => f.name === 'Promotion Review Form');
    if (!promotionForm) return null;

    // Get the target promotion rank (the rank the crew member is being promoted TO)
    // PromotionsTable provides: currentRank, promotionToRank
    // The rank group configuration should be based on the TARGET rank, not the current rank
    const rawTargetRank = promotionData?.promotionToRank;
    if (!rawTargetRank || rawTargetRank === '-') {
      return null;
    }
    
    // Normalize the rank to parent rank (e.g., "3rd Officer_1" → "3rd Officer")
    // This is needed because rank groups are configured with parent ranks only
    const targetRank = normalizeRank(rawTargetRank);

    // Find the rank group that contains this rank and is for the promotion form
    const matchingRankGroup = rankGroupsData.find(rg => {
      if (rg.formId !== promotionForm.id || rg.archivedAt !== null) return false;
      // ranks is stored as a JSON string array in the RankGroup
      try {
        const ranksArray = typeof rg.ranks === 'string' ? JSON.parse(rg.ranks) : rg.ranks;
        return ranksArray && Array.isArray(ranksArray) && ranksArray.includes(targetRank);
      } catch {
        return false;
      }
    });

    if (!matchingRankGroup?.configuration) return null;

    try {
      return JSON.parse(matchingRankGroup.configuration) as PromotionA2Config;
    } catch {
      return null;
    }
  }, [formsData, rankGroupsData, promotionData, normalizeRank]);

  // Resolve license names from IDs
  const licenseNamesById = useMemo(() => {
    const map: Record<string, string> = {};
    if (licenseEntriesData) {
      licenseEntriesData.forEach(entry => {
        if (entry.entryId && entry.description) {
          map[entry.entryId] = entry.description;
        }
      });
    }
    return map;
  }, [licenseEntriesData]);

  // Build the required license display text
  const requiredLicenseDisplay = useMemo(() => {
    if (!a2Config?.higherLicenseIds?.length) return '';
    return a2Config.higherLicenseIds
      .map(id => licenseNamesById[id] || id)
      .join(', ');
  }, [a2Config, licenseNamesById]);

  // Build the age display text
  const requiredAgeDisplay = useMemo(() => {
    if (!a2Config?.ageMin && !a2Config?.ageMax) return '';
    if (a2Config.ageMin && a2Config.ageMax) {
      return `${a2Config.ageMin}-${a2Config.ageMax} Years`;
    }
    if (a2Config.ageMin) return `Min ${a2Config.ageMin} Years`;
    if (a2Config.ageMax) return `Max ${a2Config.ageMax} Years`;
    return '';
  }, [a2Config]);

  // Build criteria data from configuration - use useState so we can allow edits
  const [criteriaData, setCriteriaData] = useState<CriteriaRow[]>([]);

  // Default fallback values when no rank group configuration is found
  // These preserve the original hardcoded defaults for backward compatibility
  const defaultCriteriaValues = {
    higherLicense: 'Master COC',
    ageRange: '34 Years',
    rankVessel: '36 Months',
    rankVesselType: '18 Months',
    companyService: '12 Months',
    tankerExperience: '48 Months',
    recommendations: '2',
    checklist: '',
  };

  // Initialize criteria data when config loads
  useEffect(() => {
    // Determine display values - use config if available, else use defaults
    const hasConfig = a2Config !== null;
    
    const baseCriteria: CriteriaRow[] = [
      { 
        id: 'a2.1', 
        criteria: 'A2.1 Higher License Criteria?', 
        required: requiredLicenseDisplay || (hasConfig ? '' : defaultCriteriaValues.higherLicense), 
        resultFromDb: '', 
        verified: 'yes', 
        hasInfo: true 
      },
      { 
        id: 'a2.2', 
        criteria: 'A2.2 Age Criteria?', 
        required: requiredAgeDisplay || (hasConfig ? '' : defaultCriteriaValues.ageRange), 
        resultFromDb: '', 
        verified: 'yes', 
        hasInfo: true 
      },
      { id: 'a2.3', criteria: 'A2.3 Experience & Sea Service Criteria?', required: '', resultFromDb: '', verified: 'yes', hasInfo: true },
      { 
        id: 'a2.3a', 
        criteria: 'A2.3a  Minimum Rank Experience (Vessel)?', 
        required: a2Config?.experienceMonths?.rankVessel ? `${a2Config.experienceMonths.rankVessel} Months` : (hasConfig ? '' : defaultCriteriaValues.rankVessel), 
        resultFromDb: '', 
        verified: 'yes', 
        hasInfo: false 
      },
      { 
        id: 'a2.3b', 
        criteria: 'A2.3b  Minimum Rank Experience (Vessel Type)?', 
        required: a2Config?.experienceMonths?.rankVesselType ? `${a2Config.experienceMonths.rankVesselType} Months` : (hasConfig ? '' : defaultCriteriaValues.rankVesselType), 
        resultFromDb: '', 
        verified: 'yes', 
        hasInfo: false 
      },
      { 
        id: 'a2.3c', 
        criteria: 'A2.3c  Minimum Company Service in previous rank?', 
        required: a2Config?.experienceMonths?.companyService ? `${a2Config.experienceMonths.companyService} Months` : (hasConfig ? '' : defaultCriteriaValues.companyService), 
        resultFromDb: '', 
        verified: 'yes', 
        hasInfo: false 
      },
      { 
        id: 'a2.3d', 
        criteria: 'A2.3d  Minimum Tanker Experience?', 
        required: a2Config?.experienceMonths?.tankerExperience ? `${a2Config.experienceMonths.tankerExperience} Months` : (hasConfig ? '' : defaultCriteriaValues.tankerExperience), 
        resultFromDb: '', 
        verified: 'yes', 
        hasInfo: false 
      },
      { 
        id: 'a2.4', 
        criteria: 'A2.4 Recommendations Criteria?', 
        required: a2Config?.minRecommendations ? String(a2Config.minRecommendations) : (hasConfig ? '' : defaultCriteriaValues.recommendations), 
        resultFromDb: '', 
        verified: 'yes', 
        hasInfo: true 
      },
      { 
        id: 'a2.5a', 
        criteria: 'A2.5a Promotion Checklist Completed?', 
        required: a2Config?.minChecklistVerifications ? String(a2Config.minChecklistVerifications) : (hasConfig ? '' : defaultCriteriaValues.checklist), 
        resultFromDb: '', 
        verified: 'yes', 
        hasInfo: true 
      },
      { id: 'a2.6', criteria: 'A2.6 Other Criteria?', required: '', resultFromDb: '', verified: 'yes', hasInfo: true },
    ];

    // Add dynamic other criteria sub-items (label is the description, requirement is the required value)
    if (a2Config?.otherCriteria?.length) {
      a2Config.otherCriteria.forEach((item, index) => {
        const letter = String.fromCharCode(97 + index); // a, b, c, ...
        baseCriteria.push({
          id: `a2.6${letter}`,
          criteria: `A2.6${letter}  ${item.label || `Other Criteria ${index + 1}`}?`,
          required: item.requirement || '',
          resultFromDb: '',
          verified: 'yes',
          hasInfo: false,
        });
      });
    } else if (!hasConfig) {
      // Preserve original hardcoded defaults for backward compatibility
      baseCriteria.push(
        { id: 'a2.6a', criteria: 'A2.6a  Other Criteria 1?', required: 'Sample', resultFromDb: '', verified: 'yes', hasInfo: false },
        { id: 'a2.6b', criteria: 'A2.6b  Other Criteria 2?', required: 'Sample', resultFromDb: '', verified: 'yes', hasInfo: false }
      );
    }

    // Add CES/Language tests header
    baseCriteria.push(
      { id: 'a2.7', criteria: 'A2.7 CES / Language Tests Criteria?', required: '', resultFromDb: '', verified: 'yes', hasInfo: true },
      { id: 'a2.8', criteria: 'A2.8 Training & Other Documents Verification?', required: '', resultFromDb: '', verified: 'yes', hasInfo: true }
    );

    setCriteriaData(baseCriteria);
  }, [a2Config, requiredLicenseDisplay, requiredAgeDisplay]);

  // A2.7 CES/Language Tests state - initialize from config
  const [cesTests, setCesTests] = useState<{ id: string; description: string; date: string; minScore: string; score: string; result: string }[]>([]);

  // Initialize CES tests from config (or preserve default empty row for backward compatibility)
  useEffect(() => {
    if (a2Config?.cesTests?.length) {
      setCesTests(a2Config.cesTests.map((test, index) => ({
        id: String(index + 1),
        description: test.description || '',
        date: '',
        minScore: test.minScore ? String(test.minScore) : '',
        score: '',
        result: '',
      })));
    } else {
      // Preserve default empty row for backward compatibility
      setCesTests([{ id: '1', description: '', date: '', minScore: '', score: '', result: '' }]);
    }
  }, [a2Config]);

  // A2 Criteria Comments state
  const [criteriaComments, setCriteriaComments] = useState<Record<string, Comment[]>>({});
  const [newCriteriaComment, setNewCriteriaComment] = useState<Record<string, string>>({});
  const [editingCriteriaComment, setEditingCriteriaComment] = useState<string | null>(null);

  // A3 Training Needs state
  const [trainingNeeds, setTrainingNeeds] = useState<TrainingRow[]>([
    { id: '1', training: 'Training 1', correspondingInDB: '', category: '1. Competence', status: 'Proposed', completionDate: 'dd-mm-yy' },
    { id: '2', training: 'Training 2', correspondingInDB: '', category: '1. Competence', status: 'Approved', completionDate: 'dd-mm-yy' },
    { id: '3', training: 'Training 3', correspondingInDB: '', category: '2. Soft Skills', status: 'Planned', completionDate: 'dd-mm-yy' },
    { id: '4', training: 'Training 4', correspondingInDB: '', category: '1. Competence', status: 'Declined', completionDate: '' },
    { id: '5', training: 'Training 5', correspondingInDB: '', category: '2. Soft Skills', status: 'Completed', completionDate: 'dd-mm-yy' },
  ]);
  const [isTrainingDialogOpen, setIsTrainingDialogOpen] = useState(false);

  // A3 Training Comments state
  const [trainingComments, setTrainingComments] = useState<Record<string, Comment[]>>({});
  const [newTrainingComment, setNewTrainingComment] = useState<Record<string, string>>({});
  const [editingTrainingComment, setEditingTrainingComment] = useState<string | null>(null);

  // A4 Comments state
  const [comments, setComments] = useState<Comment[]>([
    { id: '1', user: 'Roxanne, Crewing Executive', text: "Candidate's feedback over conduct was positive. No issues reported" },
    { id: '2', user: 'Joseph Hall, Crew Manager', text: 'Exception granted to this candidate as per discussion with Department Manager' },
  ]);

  // Part B - Approval state
  const [approvers, setApprovers] = useState<Approver[]>([
    { 
      id: '1', 
      date: '', 
      approver: '', 
      status: '', 
      approval: 'yes', 
      comments: 'Capt. Nick, Marine Superintendent:\nPromotion approved, candidate has a good understanding of the higher rank responsibilities.' 
    },
    { 
      id: '2', 
      date: '', 
      approver: '', 
      status: '', 
      approval: 'yes', 
      comments: '' 
    },
  ]);

  // Counters for generating unique IDs
  const nextApproverIdRef = useRef(3);
  const nextCesTestIdRef = useRef(2);
  const nextCommentIdRef = useRef(3);
  const nextTrainingIdRef = useRef(6);

  const [vesselTypes, setVesselTypes] = useState<string[]>(['Product Tankers', 'Crude Oil Tankers']);
  const [vesselClasses, setVesselClasses] = useState<string[]>(['MR Class1 Tankers', 'Chemical JP 20']);

  // Part C - Execution state
  const [promotionConfirmed, setPromotionConfirmed] = useState<string>('yes'); // yes, waitlist, rejected
  const [vesselAssigned, setVesselAssigned] = useState<string>('');
  const [promotionDate, setPromotionDate] = useState<string>('');
  const [promotionTiming, setPromotionTiming] = useState<string>('on-board'); // on-board, prior-joining

  // Promotion Checklist Form state
  const [showChecklistForm, setShowChecklistForm] = useState(false);

  const defaultValues: PromotionReviewFormData = {
    partANotes: '',
    partBNotes: '',
    partCNotes: '',
  };

  const handleSubmit = (data: PromotionReviewFormData) => {
    console.log('Form submitted:', data);
    // Will implement save logic later
    onClose();
  };

  const getMeetsCriterion = (required: string, result: string) => {
    if (!required || !result) return 'pending';
    
    // Handle range values like "29-40 Years"
    if (result.includes('-')) {
      const reqNum = parseFloat(required);
      const rangeParts = result.split('-');
      const min = parseFloat(rangeParts[0]);
      const max = parseFloat(rangeParts[1]);
      if (!isNaN(reqNum) && !isNaN(min) && !isNaN(max)) {
        return (reqNum >= min && reqNum <= max) ? 'met' : 'not-met';
      }
    }
    
    // Handle numeric comparison
    const reqNum = parseFloat(required);
    const resNum = parseFloat(result);
    if (!isNaN(reqNum) && !isNaN(resNum)) {
      return resNum >= reqNum ? 'met' : 'not-met';
    }
    
    // Handle string comparison
    return required.trim().toLowerCase() === result.trim().toLowerCase() ? 'met' : 'not-met';
  };

  const renderMeetsCriterionBadge = (required: string, result: string) => {
    const status = getMeetsCriterion(required, result);
    if (status === 'met') {
      return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded" data-testid="badge-met">Yes</span>;
    } else if (status === 'not-met') {
      return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded" data-testid="badge-not-met">No</span>;
    } else {
      return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded" data-testid="badge-pending">Pending</span>;
    }
  };

  const addTrainingRow = () => {
    const newId = nextTrainingIdRef.current.toString();
    nextTrainingIdRef.current += 1;
    setTrainingNeeds([...trainingNeeds, {
      id: newId,
      training: `Training ${newId}`,
      correspondingInDB: '',
      category: '1. Competence',
      status: 'Proposed',
      completionDate: 'dd-mm-yy'
    }]);
  };

  const addTrainingsFromDatabase = (selectedTemplates: TrainingCourseTemplate[]) => {
    const newTrainings = selectedTemplates.map((template) => {
      const newId = nextTrainingIdRef.current.toString();
      nextTrainingIdRef.current += 1;
      return {
        id: newId,
        training: template.name,
        correspondingInDB: template.id,
        category: '1. Competence',
        status: 'Proposed',
        completionDate: 'dd-mm-yy'
      };
    });
    setTrainingNeeds([...trainingNeeds, ...newTrainings]);
    setIsTrainingDialogOpen(false);
  };

  const deleteTrainingRow = (id: string) => {
    setTrainingNeeds(trainingNeeds.filter(t => t.id !== id));
  };

  const updateCriteriaVerified = (id: string, value: string) => {
    setCriteriaData(criteriaData.map(row => 
      row.id === id ? { ...row, verified: value } : row
    ));
  };

  const addCesTest = () => {
    const newId = nextCesTestIdRef.current.toString();
    nextCesTestIdRef.current += 1;
    setCesTests([...cesTests, {
      id: newId,
      description: '',
      date: '',
      minScore: '',
      score: '',
      result: ''
    }]);
  };

  const deleteCesTest = (id: string) => {
    setCesTests(cesTests.filter(t => t.id !== id));
  };

  const updateCesTest = (id: string, field: string, value: string) => {
    setCesTests(cesTests.map(t =>
      t.id === id ? { ...t, [field]: value } : t
    ));
  };

  const addComment = () => {
    const newId = nextCommentIdRef.current.toString();
    nextCommentIdRef.current += 1;
    setComments([...comments, {
      id: newId,
      user: 'New User',
      text: ''
    }]);
  };

  const deleteComment = (id: string) => {
    setComments(comments.filter(c => c.id !== id));
  };

  const updateComment = (id: string, text: string) => {
    setComments(comments.map(c => 
      c.id === id ? { ...c, text } : c
    ));
  };

  const updateTraining = (id: string, field: string, value: string) => {
    setTrainingNeeds(trainingNeeds.map(t =>
      t.id === id ? { ...t, [field]: value } : t
    ));
  };

  // Part B handlers
  const addApprover = () => {
    const newId = nextApproverIdRef.current.toString();
    nextApproverIdRef.current += 1;
    setApprovers([...approvers, {
      id: newId,
      date: '',
      approver: '',
      status: '',
      approval: 'yes',
      comments: ''
    }]);
  };

  const deleteApprover = (id: string) => {
    setApprovers(approvers.filter(a => a.id !== id));
  };

  const updateApprover = (id: string, field: string, value: string) => {
    setApprovers(approvers.map(a =>
      a.id === id ? { ...a, [field]: value } : a
    ));
  };

  const removeVesselType = (type: string) => {
    setVesselTypes(vesselTypes.filter(t => t !== type));
  };

  const removeVesselClass = (cls: string) => {
    setVesselClasses(vesselClasses.filter(c => c !== cls));
  };

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
                {/* Alert if no rank group is configured for the target rank */}
                {rankGroupLookupResult.attempted && !rankGroupLookupResult.found && rankGroupLookupResult.targetRank && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3" data-testid="alert-no-rank-group">
                    <Info className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-yellow-800">No Promotion Rank Group Assigned</h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        No Promotion Review Form rank group has been configured for the rank "{rankGroupLookupResult.targetRank}" in Admin Module. 
                        Default criteria values will be used. Please configure a rank group in Admin &gt; Forms Configuration &gt; Promotion Review Form.
                      </p>
                    </div>
                  </div>
                )}

                {/* Header */}
                <div className="border-b pb-4">
                  <h2 className="text-xl font-semibold text-[#16569e]">Part A Promotion Criteria Review</h2>
                  <p className="text-sm text-gray-500 mt-1">Assess candidate's compliance with minimum promotion criteria</p>
                </div>

              {/* A1: Seafarer's Information */}
              <div className="border border-[#EAEBEF] rounded-lg p-4">
                <h3 className="text-base font-medium text-[#16569e] mb-4">A1. Seafarer's Information</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500">Name</Label>
                    <div className="text-sm font-medium mt-1">{promotionData?.name || 'Grace Davis'}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">DOB / Age</Label>
                    <div className="text-sm font-medium mt-1">{promotionData?.dob || '08-Jul-1991'} / {promotionData?.age || 'N/A'}</div>
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

              {/* A2: Minimum Promotion Criteria */}
              <div className="border border-[#EAEBEF] rounded-lg p-4">
                <h3 className="text-base font-medium text-[#16569e] mb-4">A2. Minimum Promotion Criteria</h3>
                
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="text-xs font-normal text-gray-600 w-[35%]">Criteria</TableHead>
                        <TableHead className="text-xs font-normal text-gray-600 w-[15%]">Required</TableHead>
                        <TableHead className="text-xs font-normal text-gray-600 w-[15%]">Result From Database</TableHead>
                        <TableHead className="text-xs font-normal text-gray-600 w-[12%]">Meets Criterion</TableHead>
                        <TableHead className="text-xs font-normal text-gray-600 w-[13%]">Verified</TableHead>
                        <TableHead className="text-xs font-normal text-gray-600 w-[10%]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {criteriaData.map((row) => {
                        // Helper function to render a criteria row
                        const renderCriteriaRow = () => (
                          <React.Fragment key={row.id}>
                            <TableRow className={row.id.includes('.') && row.id.split('.').length > 2 ? 'bg-gray-50' : ''}>
                              <TableCell className="text-sm">
                                <div className="flex items-center gap-2">
                                  <span className={row.id.includes('.') && row.id.split('.').length > 2 ? 'ml-8' : ''}>{row.criteria}</span>
                                  {row.hasInfo && row.id !== 'a2.7' && <Info className="h-4 w-4 text-gray-400 cursor-help" />}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">{row.required}</TableCell>
                              <TableCell className="text-sm">{row.resultFromDb}</TableCell>
                              <TableCell>
                                {renderMeetsCriterionBadge(row.required, row.resultFromDb)}
                              </TableCell>
                              <TableCell>
                                <RadioGroup 
                                  value={row.verified} 
                                  onValueChange={(value) => updateCriteriaVerified(row.id, value)}
                                  className="flex gap-4"
                                >
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="yes" id={`${row.id}-yes`} data-testid={`radio-verified-yes-${row.id}`} />
                                    <Label htmlFor={`${row.id}-yes`} className="text-sm cursor-pointer">Yes</Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="na" id={`${row.id}-na`} data-testid={`radio-verified-na-${row.id}`} />
                                    <Label htmlFor={`${row.id}-na`} className="text-sm cursor-pointer">NA</Label>
                                  </div>
                                </RadioGroup>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button 
                                    type="button"
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-7 w-7 p-0"
                                    data-testid={`button-criteria-view-${row.id}`}
                                  >
                                    <Eye className="h-4 w-4 text-gray-600" />
                                  </Button>
                                  <Button 
                                    type="button"
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-7 w-7 p-0"
                                    onClick={() => setNewCriteriaComment(prev => ({
                                      ...prev,
                                      [row.id]: ""
                                    }))}
                                    data-testid={`button-criteria-comment-${row.id}`}
                                  >
                                    <MessageSquare className="h-4 w-4 text-gray-400" />
                                  </Button>
                                  {row.id === 'a2.7' && (
                                    <Button 
                                      type="button"
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-7 w-7 p-0"
                                      onClick={addCesTest}
                                      data-testid="button-add-ces-test-inline"
                                    >
                                      <Plus className="h-4 w-4 text-gray-600" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                            
                            {/* Comments for this criteria row */}
                            {(criteriaComments[row.id]?.length > 0 || newCriteriaComment[row.id] !== undefined) && (
                              <TableRow key={`${row.id}-comments`}>
                                <TableCell colSpan={6} className="py-2 px-4 bg-gray-50">
                                  <div className="space-y-2">
                                    {criteriaComments[row.id]?.map((comment) => (
                                      <div key={comment.id} className="flex justify-between items-start">
                                        <div className="flex-1">
                                          <div className="text-blue-600 italic text-[13px] mb-2">{comment.user}:</div>
                                          {editingCriteriaComment === comment.id ? (
                                            <Textarea
                                              value={comment.text}
                                              onChange={(e) => {
                                                setCriteriaComments(prev => ({
                                                  ...prev,
                                                  [row.id]: prev[row.id]?.map(c => 
                                                    c.id === comment.id ? { ...c, text: e.target.value } : c
                                                  ) || []
                                                }));
                                              }}
                                              onBlur={() => setEditingCriteriaComment(null)}
                                              autoFocus
                                              className="min-h-[80px] w-full"
                                            />
                                          ) : (
                                            <div 
                                              className="text-blue-600 italic text-[13px] p-1 cursor-pointer min-h-[20px] border border-transparent hover:border-gray-200 rounded"
                                              onClick={() => setEditingCriteriaComment(comment.id)}
                                            >
                                              {comment.text}
                                            </div>
                                          )}
                                        </div>
                                        <div className="ml-2">
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                              setCriteriaComments(prev => ({
                                                ...prev,
                                                [row.id]: prev[row.id]?.filter(c => c.id !== comment.id) || []
                                              }));
                                              if (editingCriteriaComment === comment.id) {
                                                setEditingCriteriaComment(null);
                                              }
                                            }}
                                            data-testid={`button-delete-comment-${comment.id}`}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                    
                                    {newCriteriaComment[row.id] !== undefined && (
                                      <div>
                                        <div className="text-sm font-medium text-gray-600 mb-2">Roxanne, Crewing Executive</div>
                                        <Textarea
                                          value={newCriteriaComment[row.id]}
                                          onChange={(e) => {
                                            setNewCriteriaComment(prev => ({
                                              ...prev,
                                              [row.id]: e.target.value
                                            }));
                                          }}
                                          onBlur={() => {
                                            if (newCriteriaComment[row.id]?.trim()) {
                                              const commentId = Date.now().toString();
                                              setCriteriaComments(prev => ({
                                                ...prev,
                                                [row.id]: [
                                                  ...(prev[row.id] || []),
                                                  {
                                                    id: commentId,
                                                    user: "Roxanne, Crewing Executive",
                                                    text: newCriteriaComment[row.id]
                                                  }
                                                ]
                                              }));
                                            }
                                            setNewCriteriaComment(prev => {
                                              const newState = { ...prev };
                                              delete newState[row.id];
                                              return newState;
                                            });
                                          }}
                                          placeholder="Comment: Add your observations here..."
                                          className="text-blue-600 italic border-blue-200 text-[13px]"
                                          rows={2}
                                          autoFocus
                                          data-testid={`textarea-new-comment-${row.id}`}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );

                        // Insert A2.5 Progress Bar before A2.5a
                        if (row.id === 'a2.5a') {
                          return (
                            <React.Fragment key={row.id}>
                              {/* A2.5 Progress Bar Row */}
                              <TableRow 
                                key="a2.5-progress" 
                                className="cursor-pointer hover:bg-gray-50"
                                onClick={() => setShowChecklistForm(true)}
                                data-testid="row-promotion-checklist-progress"
                              >
                                <TableCell colSpan={2} className="text-sm">A2.5 Promotion Checklist Progress</TableCell>
                                <TableCell colSpan={4}>
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                                      <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '60%' }}></div>
                                    </div>
                                    <span className="text-sm text-gray-600">60%</span>
                                  </div>
                                </TableCell>
                              </TableRow>
                              {renderCriteriaRow()}
                            </React.Fragment>
                          );
                        }

                        // Insert A2.7a CES tests after A2.7
                        if (row.id === 'a2.7') {
                          return (
                            <React.Fragment key={row.id}>
                              {renderCriteriaRow()}
                              {/* A2.7a CES/Language Tests Rows */}
                              {cesTests.map((test, index) => (
                                <TableRow key={`ces-${test.id}`} className="bg-gray-50">
                                  <TableCell className="text-sm">
                                    A2.7{String.fromCharCode(97 + index)}
                                    {test.description && <span className="ml-2 text-gray-600">({test.description})</span>}
                                  </TableCell>
                                  <TableCell>
                                    <Input 
                                      type="date" 
                                      className="h-8 text-xs" 
                                      placeholder="Date"
                                      value={test.date}
                                      onChange={(e) => updateCesTest(test.id, 'date', e.target.value)}
                                      data-testid={`input-ces-date-${test.id}`}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input 
                                      className="h-8 text-xs" 
                                      placeholder="Min Score"
                                      value={test.minScore}
                                      onChange={(e) => updateCesTest(test.id, 'minScore', e.target.value)}
                                      data-testid={`input-ces-minscore-${test.id}`}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input 
                                      className="h-8 text-xs" 
                                      placeholder="Score"
                                      value={test.score}
                                      onChange={(e) => updateCesTest(test.id, 'score', e.target.value)}
                                      data-testid={`input-ces-score-${test.id}`}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Select 
                                      value={test.result}
                                      onValueChange={(value) => updateCesTest(test.id, 'result', value)}
                                    >
                                      <SelectTrigger className="h-8 text-xs" data-testid={`select-ces-result-${test.id}`}>
                                        <SelectValue placeholder="Result" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="pass">Pass</SelectItem>
                                        <SelectItem value="fail">Fail</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex gap-1">
                                      <Button 
                                        type="button"
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-7 w-7 p-0"
                                        data-testid={`button-ces-info-${test.id}`}
                                      >
                                        <Info className="h-4 w-4 text-gray-600" />
                                      </Button>
                                      <Button 
                                        type="button"
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-7 w-7 p-0"
                                        data-testid={`button-ces-edit-${test.id}`}
                                      >
                                        <Edit className="h-4 w-4 text-gray-600" />
                                      </Button>
                                      <Button 
                                        type="button"
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-7 w-7 p-0"
                                        onClick={() => deleteCesTest(test.id)}
                                        data-testid={`button-ces-delete-${test.id}`}
                                      >
                                        <Trash2 className="h-4 w-4 text-gray-600" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </React.Fragment>
                          );
                        }

                        // Default: render the row as-is
                        return renderCriteriaRow();
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* A3: Identified Training Needs */}
              <div className="border border-[#EAEBEF] rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-medium text-[#16569e]">A3. Identified Training Needs</h3>
                  <div className="flex gap-2">
                    <Button 
                      type="button"
                      variant="outline" 
                      size="sm" 
                      className="text-xs"
                      onClick={() => setIsTrainingDialogOpen(true)}
                      data-testid="button-add-training-from-db"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Training from Database
                    </Button>
                    <Button 
                      type="button"
                      variant="outline" 
                      size="sm" 
                      className="text-xs" 
                      onClick={addTrainingRow}
                      data-testid="button-add-new-training"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add New Training
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="text-xs font-normal text-gray-600 w-[8%]">S.No.</TableHead>
                        <TableHead className="text-xs font-normal text-gray-600 w-[20%]">Training</TableHead>
                        <TableHead className="text-xs font-normal text-gray-600 w-[25%]">Corresponding in DB</TableHead>
                        <TableHead className="text-xs font-normal text-gray-600 w-[17%]">Category</TableHead>
                        <TableHead className="text-xs font-normal text-gray-600 w-[20%]">Status</TableHead>
                        <TableHead className="text-xs font-normal text-gray-600 w-[10%]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trainingNeeds.map((training, index) => {
                        return (
                          <React.Fragment key={training.id}>
                            <TableRow>
                            <TableCell className="text-sm" data-testid={`cell-training-sno-${training.id}`}>{index + 1}</TableCell>
                            <TableCell className="text-sm" data-testid={`cell-training-name-${training.id}`}>{training.training}</TableCell>
                            <TableCell>
                              <Select 
                                value={training.correspondingInDB}
                                onValueChange={(value) => updateTraining(training.id, 'correspondingInDB', value)}
                              >
                                <SelectTrigger className="h-8 text-xs" data-testid={`select-training-db-${training.id}`}>
                                  <SelectValue placeholder="Select Training from DB" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="training1">Training 1</SelectItem>
                                  <SelectItem value="training2">Training 2</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select 
                                value={training.category}
                                onValueChange={(value) => updateTraining(training.id, 'category', value)}
                              >
                                <SelectTrigger className="h-8 text-xs" data-testid={`select-training-category-${training.id}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1. Competence">1. Competence</SelectItem>
                                  <SelectItem value="2. Soft Skills">2. Soft Skills</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select 
                                value={training.status}
                                onValueChange={(value) => updateTraining(training.id, 'status', value)}
                              >
                                <SelectTrigger className="h-8 text-xs" data-testid={`select-training-status-${training.id}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Proposed">Proposed</SelectItem>
                                  <SelectItem value="Approved">Approved</SelectItem>
                                  <SelectItem value="Planned">Planned</SelectItem>
                                  <SelectItem value="Declined">Declined</SelectItem>
                                  <SelectItem value="Completed">Completed</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button 
                                  type="button"
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-7 w-7 p-0" 
                                  onClick={() => deleteTrainingRow(training.id)}
                                  data-testid={`button-training-delete-${training.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-gray-600" />
                                </Button>
                                <Button 
                                  type="button"
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-7 w-7 p-0"
                                  onClick={() => setEditingTrainingComment(editingTrainingComment === training.id ? null : training.id)}
                                  data-testid={`button-training-comment-${training.id}`}
                                >
                                  <MessageSquare className="h-4 w-4 text-gray-600" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>

                          {/* Comment display for this training row */}
                          {(editingTrainingComment === training.id || trainingComments[training.id]?.length > 0) && (
                            <TableRow>
                              <TableCell colSpan={6} className="bg-gray-50 p-3">
                                {trainingComments[training.id]?.map((comment) => (
                                  <div key={comment.id} className="mb-2">
                                    <div className="flex justify-between items-start">
                                      <div className="flex-1">
                                        <div className="text-xs font-medium text-gray-700 mb-1">{comment.user}</div>
                                        <div 
                                          className="text-xs text-blue-600 italic cursor-pointer"
                                          onClick={() => {
                                            setEditingTrainingComment(training.id);
                                            setNewTrainingComment(prev => ({ ...prev, [training.id]: comment.text }));
                                          }}
                                        >
                                          Comment: {comment.text}
                                        </div>
                                      </div>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0"
                                        onClick={() => {
                                          setTrainingComments(prev => ({
                                            ...prev,
                                            [training.id]: prev[training.id].filter(c => c.id !== comment.id)
                                          }));
                                        }}
                                        data-testid={`button-delete-training-comment-${comment.id}`}
                                      >
                                        <Trash2 className="h-3 w-3 text-gray-600" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                                
                                {editingTrainingComment === training.id && (
                                  <div className="mt-2">
                                    <div className="text-xs font-medium text-gray-700 mb-1">Roxanne, Crewing Executive</div>
                                    <textarea
                                      className="w-full h-20 p-2 border rounded text-xs"
                                      placeholder="Comment: Add your observations here..."
                                      value={newTrainingComment[training.id] || ''}
                                      onChange={(e) => setNewTrainingComment(prev => ({ ...prev, [training.id]: e.target.value }))}
                                      onBlur={() => {
                                        const commentText = newTrainingComment[training.id]?.trim();
                                        if (commentText) {
                                          const newComment: Comment = {
                                            id: `training-comment-${Date.now()}`,
                                            user: 'Roxanne, Crewing Executive',
                                            text: commentText
                                          };
                                          setTrainingComments(prev => ({
                                            ...prev,
                                            [training.id]: [...(prev[training.id] || []), newComment]
                                          }));
                                        }
                                        setNewTrainingComment(prev => ({ ...prev, [training.id]: '' }));
                                        setEditingTrainingComment(null);
                                      }}
                                      data-testid={`textarea-training-comment-${training.id}`}
                                    />
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          )}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* A4: Comments & Recommendations */}
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

              {/* Action Buttons */}
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
            <div className="bg-white rounded-lg p-6">
              <div className="space-y-6">
                {/* Header */}
                <div className="border-b pb-4">
                  <h2 className="text-xl font-semibold text-[#16569e]">Part B - Approval</h2>
                  <p className="text-sm text-[#60a5fa] mt-1">To be completed by the designated approver</p>
                </div>

                {/* B1 Approved? */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-medium text-[#16569e]">B1 Approved?</h3>
                      <Info className="h-4 w-4 text-gray-400 cursor-help" />
                    </div>
                    <Button 
                      type="button"
                      variant="outline" 
                      size="sm" 
                      className="text-xs" 
                      onClick={addApprover}
                      data-testid="button-add-approver"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Approver
                    </Button>
                  </div>

                  {approvers.map((approver, index) => (
                    <div key={approver.id} className="space-y-2" data-testid={`approver-${approver.id}`}>
                      <div className="flex items-center gap-3">
                        <Input 
                          type="date" 
                          className="h-9 w-40 text-xs"
                          placeholder="dd:mm:yy"
                          value={approver.date}
                          onChange={(e) => updateApprover(approver.id, 'date', e.target.value)}
                          data-testid={`input-approver-date-${approver.id}`}
                        />
                        <Select 
                          value={approver.approver}
                          onValueChange={(value) => updateApprover(approver.id, 'approver', value)}
                        >
                          <SelectTrigger className="h-9 text-xs flex-1" data-testid={`select-approver-${approver.id}`}>
                            <SelectValue placeholder="Approver" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="marine-superintendent">Marine Superintendent</SelectItem>
                            <SelectItem value="technical-superintendent">Technical Superintendent</SelectItem>
                            <SelectItem value="crew-manager">Crew Manager</SelectItem>
                            <SelectItem value="fleet-manager">Fleet Manager</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select 
                          value={approver.status}
                          onValueChange={(value) => updateApprover(approver.id, 'status', value)}
                        >
                          <SelectTrigger className="h-9 text-xs w-32" data-testid={`select-status-${approver.id}`}>
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                        <RadioGroup 
                          value={approver.approval} 
                          onValueChange={(value) => updateApprover(approver.id, 'approval', value)}
                          className="flex gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="yes" id={`${approver.id}-yes`} data-testid={`radio-approval-yes-${approver.id}`} />
                            <Label htmlFor={`${approver.id}-yes`} className="text-sm cursor-pointer">Yes</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="yes-conditional" id={`${approver.id}-yes-conditional`} data-testid={`radio-approval-conditional-${approver.id}`} />
                            <Label htmlFor={`${approver.id}-yes-conditional`} className="text-sm cursor-pointer">Yes, Conditional</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="no" id={`${approver.id}-no`} data-testid={`radio-approval-no-${approver.id}`} />
                            <Label htmlFor={`${approver.id}-no`} className="text-sm cursor-pointer">No</Label>
                          </div>
                        </RadioGroup>
                        <Button 
                          type="button"
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0"
                          onClick={() => deleteApprover(approver.id)}
                          data-testid={`button-delete-approver-${approver.id}`}
                        >
                          <Plus className="h-4 w-4 text-gray-600 rotate-45" />
                        </Button>
                      </div>
                      {approver.comments && (
                        <div className="bg-gray-50 p-3 rounded">
                          <p className="text-sm text-blue-600 italic whitespace-pre-line" data-testid={`approver-comments-${approver.id}`}>
                            {approver.comments}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* B2 Suitable for */}
                <div className="space-y-4">
                  <h3 className="text-base font-medium text-[#16569e]">B2 Suitable for:</h3>
                  
                  {/* B2.1 Vessel type(s) */}
                  <div className="flex items-center gap-4">
                    <Label className="text-sm w-48">B2.1 Vessel type(s):</Label>
                    <div className="flex-1 flex items-center gap-2 flex-wrap border border-gray-300 rounded-md p-2 min-h-[36px]" data-testid="vessel-types-container">
                      {vesselTypes.map((type) => (
                        <div key={type} className="inline-flex items-center gap-1 bg-[#E0F2FE] text-[#0284C7] px-2 py-1 rounded text-sm" data-testid={`vessel-type-${type.toLowerCase().replace(/\s+/g, '-')}`}>
                          {type}
                          <button 
                            type="button"
                            onClick={() => removeVesselType(type)} 
                            className="ml-1"
                            data-testid={`button-remove-vessel-type-${type.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0"
                      data-testid="button-add-vessel-type"
                    >
                      <Plus className="h-4 w-4 text-gray-600" />
                    </Button>
                  </div>

                  {/* B2.2 Vessel/Vessel Class/Fleet */}
                  <div className="flex items-center gap-4">
                    <Label className="text-sm w-48">B2.2 Vessel/ Vessel Class/ Fleet:</Label>
                    <div className="flex-1 flex items-center gap-2 flex-wrap border border-gray-300 rounded-md p-2 min-h-[36px]" data-testid="vessel-classes-container">
                      {vesselClasses.map((cls) => (
                        <div key={cls} className="inline-flex items-center gap-1 bg-[#E0F2FE] text-[#0284C7] px-2 py-1 rounded text-sm" data-testid={`vessel-class-${cls.toLowerCase().replace(/\s+/g, '-')}`}>
                          {cls}
                          <button 
                            type="button"
                            onClick={() => removeVesselClass(cls)} 
                            className="ml-1"
                            data-testid={`button-remove-vessel-class-${cls.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0"
                      data-testid="button-add-vessel-class"
                    >
                      <Plus className="h-4 w-4 text-gray-600" />
                    </Button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-4">
                  <Button 
                    type="button"
                    variant="outline" 
                    className="px-8 bg-[#60a5fa] text-white hover:bg-[#3b82f6]"
                    data-testid="button-save-part-b"
                  >
                    Save
                  </Button>
                  <Button 
                    type="button"
                    className="px-8 bg-green-600 hover:bg-green-700"
                    data-testid="button-submit-part-b"
                  >
                    Submit
                  </Button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'c' && (
            <div className="bg-white rounded-lg p-6">
              <div className="space-y-6">
                {/* Header */}
                <div className="border-b pb-4">
                  <h2 className="text-xl font-semibold text-[#16569e]">Part C - Execution</h2>
                  <p className="text-sm text-[#60a5fa] mt-1">To be completed by the crew executive/ crew manager</p>
                </div>

                {/* C.1 Confirmation & Assignment */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-medium text-[#16569e]">C.1 Confirmation & Assignment</h3>
                    <Info className="h-4 w-4 text-gray-400 cursor-help" />
                  </div>

                  {/* B2.1 Promotion confirmed */}
                  <div className="flex items-center gap-4">
                    <Label className="text-sm w-48">B2.1 Promotion confirmed:</Label>
                    <RadioGroup 
                      value={promotionConfirmed} 
                      onValueChange={setPromotionConfirmed}
                      className="flex gap-6"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="promotion-yes" data-testid="radio-promotion-yes" />
                        <Label htmlFor="promotion-yes" className="text-sm cursor-pointer">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="waitlist" id="promotion-waitlist" data-testid="radio-promotion-waitlist" />
                        <Label htmlFor="promotion-waitlist" className="text-sm cursor-pointer">Waitlist</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="rejected" id="promotion-rejected" data-testid="radio-promotion-rejected" />
                        <Label htmlFor="promotion-rejected" className="text-sm cursor-pointer">Rejected</Label>
                      </div>
                    </RadioGroup>
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 ml-auto"
                      data-testid="button-info-promotion-confirmed"
                    >
                      <Plus className="h-4 w-4 text-gray-600" />
                    </Button>
                  </div>

                  {/* B2.2 Vessel Assigned */}
                  <div className="flex items-center gap-4">
                    <Label className="text-sm w-48">B2.2 Vessel Assigned:</Label>
                    <Select 
                      value={vesselAssigned}
                      onValueChange={setVesselAssigned}
                    >
                      <SelectTrigger className="flex-1" data-testid="select-vessel-assigned">
                        <SelectValue placeholder="Select vessel" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mt-liberty-gas">MT Liberty Gas</SelectItem>
                        <SelectItem value="mt-nordic-star">MT Nordic Star</SelectItem>
                        <SelectItem value="mt-ocean-breeze">MT Ocean Breeze</SelectItem>
                        <SelectItem value="mt-pacific-dawn">MT Pacific Dawn</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0"
                      data-testid="button-info-vessel-assigned"
                    >
                      <Plus className="h-4 w-4 text-gray-600" />
                    </Button>
                  </div>

                  {/* B2.3 Date of Promotion */}
                  <div className="flex items-center gap-4">
                    <Label className="text-sm w-48">B2.3 Date of Promotion:</Label>
                    <Input 
                      type="date" 
                      className="w-40"
                      placeholder="dd:mm:yy"
                      value={promotionDate}
                      onChange={(e) => setPromotionDate(e.target.value)}
                      data-testid="input-promotion-date"
                    />
                    <RadioGroup 
                      value={promotionTiming} 
                      onValueChange={setPromotionTiming}
                      className="flex gap-6 flex-1"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="on-board" id="timing-on-board" data-testid="radio-timing-on-board" />
                        <Label htmlFor="timing-on-board" className="text-sm cursor-pointer">Promoted on board</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="prior-joining" id="timing-prior-joining" data-testid="radio-timing-prior-joining" />
                        <Label htmlFor="timing-prior-joining" className="text-sm cursor-pointer">Promoted prior joining</Label>
                      </div>
                    </RadioGroup>
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0"
                      data-testid="button-info-promotion-date"
                    >
                      <Plus className="h-4 w-4 text-gray-600" />
                    </Button>
                  </div>
                </div>

                {/* Submitted by and Action Buttons */}
                <div className="flex justify-between items-center pt-4">
                  <p className="text-sm italic text-[#60a5fa]">Submitted by: Roxanne, Crewing Executive</p>
                  <div className="flex gap-3">
                    <Button 
                      type="button"
                      variant="outline" 
                      className="px-8 bg-[#60a5fa] text-white hover:bg-[#3b82f6]"
                      data-testid="button-save-part-c"
                    >
                      Save
                    </Button>
                    <Button 
                      type="button"
                      className="px-8 bg-green-600 hover:bg-green-700"
                      data-testid="button-submit-part-c"
                    >
                      Submit
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      </BaseSubmoduleForm>

      {/* Promotion Checklist Form Modal */}
      {showChecklistForm && (
        <PromotionChecklistForm 
          promotionData={promotionData}
          onClose={() => setShowChecklistForm(false)}
        />
      )}

      {/* Training Database Selection Dialog */}
      <TrainingCourseSelectionDialog
        open={isTrainingDialogOpen}
        onClose={() => setIsTrainingDialogOpen(false)}
        onConfirm={addTrainingsFromDatabase}
        existingCourseIds={trainingNeeds.map(t => t.correspondingInDB).filter(Boolean)}
      />
    </>
  );
};
