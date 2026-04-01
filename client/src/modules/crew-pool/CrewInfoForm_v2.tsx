import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Edit, Camera, Plus, Trash2, Paperclip, Save, ArrowLeft, ChevronDown, Pencil, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormattedDateInput } from '@/components/ui/formatted-date-input';
import { formatDate } from '@/utils/format';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { toStorageCrew } from '@shared/crew-mapping';
import type { CrewDashboardSummary } from '@shared/schema';
import { getReportingDate, formatDateToISO, calculatePeriodMonths } from '@shared/dateUtils';
import { useCompanyRanks } from '@/hooks/useCompanyRanks';
import { useRankNormalization } from '@/hooks/useRankNormalization';
import { DEFAULT_DROPDOWN_VESSEL_TYPES } from '@/utils/data/vesselTypes';
import { useNationalitiesV2, useCountriesV2, useLanguagesV2, useVesselTypesV2, useVesselsV2, useManningAgentsV2, useCrewPoolsV2 } from '@/hooks/v2/useMasterDataV2';
import { LicenseSelectionDialog } from './LicenseSelectionDialog';
import { TrainingCourseSelectionDialog } from './TrainingCourseSelectionDialog';
import { validateMobileNumber, normalizeMobileInput, applyDialingCode, getDialingCode } from '../recruitment/countryDialingCodes';
import { TravelDocumentSelectionDialog } from './TravelDocumentSelectionDialog';
import { VisaSelectionDialog } from './VisaSelectionDialog';
import type { TrainingCourseTemplate } from '@/utils/data/trainingCourseTemplates';
import { usePermissions } from '@/contexts/PermissionsContext';
import type { LicenseTemplate } from '@/utils/data/licenseDceTemplates';
import type { TravelDocumentTemplate } from '@/utils/data/travelDocumentTemplates';
import type { VisaCountryTemplate } from '@/utils/data/visaCountryTemplates';
import { TimelineCard } from './components/TimelineCard';
import { FileAttachmentDialog, type FileAttachment } from '@/components/FileAttachmentDialog';
import { generateCrewInfoPDF, type CrewInfoFormData } from '@/lib/generateCrewInfoPDF';
import { crewPoolApiV2 } from './api/crewPoolApiV2';
import { 
  useCreateCrewV2, 
  useUpdateCrewV2, 
  useCrewListV2, 
  useCrewFullProfileV2, 
  useCrewByIdV2,
  useSavePersonalDetailsV2,
  useSaveAddressV2,
  useSaveFamilyInfoV2,
  useSaveChildV2,
  useSaveNextOfKinV2,
  useDeleteChildV2,
  useSaveVesselTypesV2,
  useSaveDocumentV2,
  useSaveVisaV2,
  useSaveEducationV2,
  useSaveLicenseV2,
  useSaveTrainingCourseV2,
  useSaveSeaServiceV2,
  useSaveMedicalV2,
  useSaveDoctorVisitV2,
  useDeleteDocumentV2,
  useDeleteVisaV2,
  useDeleteEducationV2,
  useDeleteLicenseV2,
  useDeleteTrainingCourseV2,
  useDeleteSeaServiceV2,
  useDeleteMedicalV2,
  useDeleteDoctorVisitV2,
  useAddDocumentAttachmentV2,
  useRemoveDocumentAttachmentV2,
  useAddVisaAttachmentV2,
  useRemoveVisaAttachmentV2,
  useAddEducationAttachmentV2,
  useRemoveEducationAttachmentV2,
  useAddLicenseAttachmentV2,
  useRemoveLicenseAttachmentV2,
  useAddTrainingAttachmentV2,
  useRemoveTrainingAttachmentV2,
  useAddSeaServiceAttachmentV2,
  useRemoveSeaServiceAttachmentV2,
  useAddMedicalAttachmentV2,
  useRemoveMedicalAttachmentV2,
  useAddDoctorVisitAttachmentV2,
  useRemoveDoctorVisitAttachmentV2
} from './hooks/useCrewPoolV2';
import type { LegacySeaService, LegacyPreJoiningMedical, LegacyDoctorVisit } from './mappers/v2ToLegacyMapper';
import { 
  mapLegacyCrewToV2, 
  mapLegacyPersonalDetailsToV2, 
  mapLegacyAddressToV2, 
  mapLegacyFamilyInfoToV2,
  mapLegacyDocumentToV2,
  mapLegacyVisaToV2,
  mapLegacyEducationToV2,
  mapLegacyLicenseToV2,
  mapLegacyTrainingCourseToV2,
  mapLegacySeaServiceToV2,
  mapLegacyPreJoiningMedicalToV2,
  mapLegacyDoctorVisitToV2,
} from './mappers/v2ToLegacyMapper';

function getCrewUserId(): string | null {
  try {
    return localStorage.getItem("crewUserId") || null;
  } catch {
    return null;
  }
}

function withAuditUser<T>(data: T): T {
  const auditUserUuid = getCrewUserId();
  if (Array.isArray(data)) {
    return data.map(item => 
      typeof item === 'object' && item !== null 
        ? { ...item, auditUserUuid } 
        : item
    ) as T;
  }
  if (typeof data === 'object' && data !== null) {
    return { ...data, auditUserUuid };
  }
  return data;
}

const calculateBMI = (height: string, weight: string): string => {
  const heightInM = parseFloat(height) / 100;
  const weightInKg = parseFloat(weight);
  if (heightInM > 0 && weightInKg > 0) {
    const bmi = weightInKg / (heightInM * heightInM);
    return bmi.toFixed(1);
  }
  return '';
};

const V2_QUERY_KEY = '/api/v2/crew-pool';

interface CrewMember {
  id: string;
  crewUuid?: string; // V2 uses crewUuid as primary identifier
  empNo: string;
  employeeId: string; // Added for crew ID display
  firstName: string;
  middleName: string;
  familyName: string;
  nationality: string;
  presentRank: string;
  dob: string;
  age: string;
  status: string;
  presentVessel: string;
}

interface CrewInfoFormProps {
  isOpen: boolean;
  onClose: () => void;
  crewMember: CrewMember | null;
  onCrewMemberChange?: (crewMember: CrewMember) => void;
}

interface FormData {
  // A1.1 General Particulars
  firstName: string;
  middleName: string;
  familyName: string;
  gender: string; // Male or Female
  nationality: string;
  presentRank: string;
  dateOfBirth: string;
  ageInYears: string;
  placeOfBirthCity: string;
  placeOfBirthCountry: string;
  heightCm: string;
  weightKg: string;
  bmi: string;
  nativeLanguage: string;
  foreignLanguages: string;
  englishProficiency: string;
  rankAppliedFor: string;
  vesselType: string[];
  manningAgent: string;
  crewPool: string;
  employeeId: string;
  nextAvailability: string;
  
  // A1.2 Address & Contact Info
  countryOfResidence: string;
  nearestAirport: string;
  residentialAddressLine1: string;
  residentialAddressLine2: string;
  contactLandline: string;
  mobile: string;
  email: string;
  
  // A1.3 Family and NOK
  maritalStatus: string;
  numberOfDependentChildren: string;
  fatherName: string;
  motherName: string;
  spouseFirstName: string;
  spouseMiddleName: string;
  spouseFamilyName: string;
  spouseDateOfBirth: string;
  children: ChildInfo[];
  nokFirstName: string;
  nokMiddleName: string;
  nokFamilyName: string;
  nokTelephone: string;
  nokEmail: string;
  nokAddress: string;
  nokRelationship: string;
  
  // A2.1 Travel and Identification Documents
  documents: DocumentInfo[];
  
  // A2.2 Visas
  visas: Visa[];
  
  // A3.1 Education
  education: Education[];
  
  // A3.2 License & DCE
  licenses: License[];
  
  // A3.3 Training Courses
  trainingCourses: TrainingCourse[];
  
  // A4.1 Sea Service
  currentCompanySeaService: SeaService[];
  externalSeaService: SeaService[];
  
  // F1. Pre Joining Medicals
  preJoiningMedicals: PreJoiningMedical[];
  
  // F2. Doctor Visits
  doctorVisits: DoctorVisit[];
}

interface ChildInfo {
  childUuid?: string;
  firstName: string;
  middleName: string;
  familyName: string;
  dateOfBirth: string;
  gender: string;
}

interface DocumentInfo {
  id: string;
  documentId: string;  // Template ID (e.g., DOC001) - empty for manual entries
  document: string;
  number: string;
  issued: string;
  expiry: string;
  issuingAuthority: string;
  attachments?: FileAttachment[];
}

interface Visa {
  id: string;
  visaUuid?: string;
  countryId: string;  // Template ID (e.g., USA, SCHENGEN) - empty for manual entries
  issuingCountry: string;
  serialNo: string;
  issued: string;
  expiry: string;
  visaType: string;
  attachments?: FileAttachment[];
}

interface Education {
  id: string;
  dateOfCompletion: string;
  schoolCollegeUniversity: string;
  subjectsField: string;
  qualifications: string;
  attachments?: FileAttachment[];
}

interface License {
  id: string;
  licenseId: string;  // Master 016 entry_id (e.g., LIC001) - empty for manual entries
  certificateDocument: string;
  abbr: string;
  requirement: string;
  certificateNo: string;
  issuingAuthority: string;
  issued: string;
  expiry: string;
  fromDatabase?: boolean;
  attachments?: FileAttachment[];
  archivedAt?: string;       // ISO date when COC was archived (superseded by upgrade)
  archivedReason?: string;   // Reason for archiving
}

interface TrainingCourse {
  id: string;
  courseId?: string;
  companyId?: string;
  trainingCourse: string;
  abbr: string;
  requirement: string;
  certificateNo: string;
  issuingAuthority: string;
  issued: string;
  expiry: string;
  fromDatabase?: boolean;
  sortOrder?: number;
  attachments?: FileAttachment[];
}

interface SeaService {
  id: string;
  vesselName: string;
  vesselCode: string;
  vesselType: string;
  deadweight: string;
  engineTypePower: string;
  ownerOperator: string;
  rank: string;
  from: string;
  to: string;
  periodMonths: string;
  experienceCategories?: string[]; // For Oil Chemical Tanker: ['oil', 'chemical'] by default, can be overridden
  attachments?: FileAttachment[];
}

interface PreJoiningMedical {
  id: string;
  vesselCode: string;
  vessel: string;
  dateOfMedical: string;
  bp: string; // Blood Pressure (mmHG)
  weight: string; // Weight (Kgs)
  anyMedicationPrescribed: string;
  fitnessForDuty: string;
  expiry: string;
  attachments?: FileAttachment[];
}

interface DoctorVisit {
  id: string;
  vessel: string;
  port: string;
  date: string;
  complaint: string; // Complaint / Illness / Injury
  doctorComments: string;
  attachments?: FileAttachment[];
}

export const CrewInfoForm_v2: React.FC<CrewInfoFormProps> = ({ isOpen, onClose, crewMember, onCrewMemberChange }) => {
  const { toast } = useToast();
  
  // Helper function to determine expiry date text color
  const getExpiryColorClass = (dateString: string): string => {
    if (!dateString) return 'text-[#4f5863]';
    
    const expiryDate = new Date(dateString);
    if (isNaN(expiryDate.getTime())) return 'text-[#4f5863]';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const twoMonthsFromNow = new Date(today);
    twoMonthsFromNow.setMonth(twoMonthsFromNow.getMonth() + 2);
    
    if (expiryDate < today) {
      return 'text-red-600'; // Expired
    } else if (expiryDate <= twoMonthsFromNow) {
      return 'text-orange-500'; // Expiring within 2 months
    }
    return 'text-[#4f5863]'; // Valid (default color)
  };
  
  // Helper function to analyze expiry status for an array of items
  const analyzeExpiryStatus = (items: Array<{ expiry: string; [key: string]: any }>, nameField: string) => {
    // Return grey if no items exist
    if (!items || items.length === 0) {
      return { dotColor: 'bg-gray-400', issueCount: 0, issues: [] };
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const twoMonthsFromNow = new Date(today);
    twoMonthsFromNow.setMonth(twoMonthsFromNow.getMonth() + 2);
    
    let hasExpired = false;
    let hasExpiring = false;
    let hasValidData = false;
    const issues: Array<{ name: string; expiry: string; status: 'expired' | 'expiring' }> = [];
    
    items.forEach(item => {
      if (!item.expiry) return;
      const expiryDate = new Date(item.expiry);
      if (isNaN(expiryDate.getTime())) return;
      
      hasValidData = true; // Found at least one item with valid expiry date
      
      if (expiryDate < today) {
        hasExpired = true;
        issues.push({ name: item[nameField] || 'Unknown', expiry: item.expiry, status: 'expired' });
      } else if (expiryDate <= twoMonthsFromNow) {
        hasExpiring = true;
        issues.push({ name: item[nameField] || 'Unknown', expiry: item.expiry, status: 'expiring' });
      }
    });
    
    // Return grey if no items have valid expiry dates
    if (!hasValidData) {
      return { dotColor: 'bg-gray-400', issueCount: 0, issues: [] };
    }
    
    const dotColor = hasExpired ? 'bg-red-500' : hasExpiring ? 'bg-orange-500' : 'bg-green-500';
    return { dotColor, issueCount: issues.length, issues };
  };

  const validateEmail = (value: string): string => {
    if (!value) return '';
    if (/\s/.test(value)) return 'Email must not contain spaces.';
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(value)) return 'Please enter a valid email address (e.g., user@domain.com).';
    return '';
  };

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const validateIssuedDate = (dateStr: string): string => {
    if (!dateStr) return '';
    if (dateStr > todayStr) return 'Issued date cannot be in the future.';
    return '';
  };

  const validateExpiryDate = (expiryStr: string, issuedStr: string): string => {
    if (!expiryStr || !issuedStr) return '';
    if (expiryStr < issuedStr) return 'Expiry date must be on or after the issued date.';
    return '';
  };

  const validateDob = (dateStr: string): string => {
    if (!dateStr) return '';
    const dobDate = new Date(dateStr);
    const today = new Date();
    if (dobDate > today) return 'Date of birth cannot be a future date.';
    const minDob = new Date();
    minDob.setFullYear(minDob.getFullYear() - 18);
    if (dobDate > minDob) return 'Crew member must be at least 18 years old.';
    return '';
  };

  // State for issues popup dialog
  const [issuesDialogOpen, setIssuesDialogOpen] = useState(false);
  const [issuesDialogData, setIssuesDialogData] = useState<{
    category: string;
    issues: Array<{ name: string; expiry: string; status: 'expired' | 'expiring' }>;
  }>({ category: '', issues: [] });
  
  // V2: Get crew UUID from crewMember (V2 uses crewUuid as primary identifier)
  const crewUuid = crewMember?.crewUuid || crewMember?.id || null;
  
  // V2: Full profile query (replaces dashboard + detailed data)
  const { data: v2FullProfile, isLoading: isV2ProfileLoading, error: v2ProfileError } = useCrewFullProfileV2(
    isOpen && crewUuid ? crewUuid : null
  );
  
  // V2: All crew members query for dropdown
  const { data: allCrewMembersRaw = [], isLoading: isCrewListLoading } = useCrewListV2();
  
  // V2: Map full profile data for legacy form compatibility
  const detailedCrewData = v2FullProfile || null;
  const isDetailedDataLoading = isV2ProfileLoading;
  
  // V2: Dashboard data from V2 API endpoint
  const { data: dashboardData, isLoading: isDashboardLoading, error: dashboardError } = useQuery<CrewDashboardSummary>({
    queryKey: ['/api/v2/crew-pool/crew', crewUuid, 'dashboard'],
    queryFn: async () => {
      const response = await fetch(`/api/v2/crew-pool/crew/${crewUuid}/dashboard`);
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard summary');
      }
      return response.json();
    },
    enabled: !!crewUuid && isOpen,
  });

  const invalidateCrewData = (id: string | null) => {
    if (!id) return;
    queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool', 'crew', id, 'full-profile'] });
    queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew', id, 'dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew', id, 'assignments'] });
  };

  // V2: Crew assignments — used to detect auto-generated (vessel-synced) E1 rows
  const { data: crewAssignmentsData } = useQuery<any[]>({
    queryKey: ['/api/v2/crew-pool/crew', crewUuid, 'assignments'],
    queryFn: async () => {
      const response = await fetch(`/api/v2/crew-pool/crew/${crewUuid}/assignments`);
      if (!response.ok) throw new Error('Failed to fetch assignments');
      return response.json();
    },
    enabled: !!crewUuid && isOpen,
  });

  const { data: adminCompanyTrainings = [] } = useQuery<Array<{ id: number; companyId: string }>>({
    queryKey: ['/api/v2/admin/company-trainings'],
  });

  // Get company ranks from shared hook
  const { data: companyRanks, isLoading: ranksLoading, rankOptions, error: ranksError } = useCompanyRanks();
  
  // Get rank normalization functions to convert positions to actual ranks
  const { normalizeRank } = useRankNormalization();
  
  // Sort crew members by rank hierarchy using company ranks sort order
  // Uses normalizeRank to convert positions (e.g., "OS_1") to actual ranks (e.g., "OS")
  const allCrewMembers = useMemo(() => {
    if (allCrewMembersRaw.length === 0) return [];
    
    // Create rank order lookup from company ranks (already sorted by sortOrder from API)
    const rankOrderMap = new Map<string, number>();
    companyRanks.forEach((rank, index) => {
      rankOrderMap.set(rank.rank.toLowerCase(), index);
    });
    
    return [...allCrewMembersRaw].sort((a, b) => {
      // Normalize positions to actual ranks before sorting
      const normalizedRankA = normalizeRank(a.presentRank || '').toLowerCase();
      const normalizedRankB = normalizeRank(b.presentRank || '').toLowerCase();
      
      const orderA = rankOrderMap.get(normalizedRankA) ?? 9999;
      const orderB = rankOrderMap.get(normalizedRankB) ?? 9999;
      
      // Primary sort by rank order, secondary by name
      if (orderA !== orderB) return orderA - orderB;
      return `${a.firstName} ${a.familyName}`.localeCompare(`${b.firstName} ${b.familyName}`);
    });
  }, [allCrewMembersRaw, companyRanks, normalizeRank]);

  // Data mappings with proper nullish coalescing
  const statusData = dashboardData?.status;
  const experienceData = dashboardData?.experience;
  const shipTypesData = dashboardData?.shipTypes;
  const rankExperienceData = dashboardData?.rankExperience;
  const complianceData = dashboardData?.compliance;
  const careerProgressionData = dashboardData?.careerProgression;
  const serviceTimelineData = dashboardData?.serviceTimeline;
  const appraisalsData = dashboardData?.appraisals;
  
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>('A');
  const [editingSections, setEditingSections] = useState<{[key: string]: boolean}>({
    'B1': false,
    'B2': false,
    'B3': false
  });
  const [showCrewDropdown, setShowCrewDropdown] = useState(false);
  // Track newly created crew member ID for subsequent saves
  const [createdCrewId, setCreatedCrewId] = useState<string | null>(null);
  // Track when we're auto-creating a crew record before edit
  const [isCreatingCrew, setIsCreatingCrew] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [isStatusEditOpen, setIsStatusEditOpen] = useState(false);
  const [isNextAvailabilityEditOpen, setIsNextAvailabilityEditOpen] = useState(false);
  const [tempNextAvailability, setTempNextAvailability] = useState<string>('');
  const [isLicenseDialogOpen, setIsLicenseDialogOpen] = useState(false);
  const [isTrainingDialogOpen, setIsTrainingDialogOpen] = useState(false);
  const [isTravelDocDialogOpen, setIsTravelDocDialogOpen] = useState(false);
  const [isVisaDialogOpen, setIsVisaDialogOpen] = useState(false);
  
  // File attachment dialog state
  const [attachmentDialog, setAttachmentDialog] = useState<{
    open: boolean;
    section: 'document' | 'visa' | 'education' | 'license' | 'training' | 'seaService' | 'currentSeaService' | 'externalSeaService' | 'preJoiningMedical' | 'doctorVisit';
    itemId: string;
    itemName: string;
  }>({
    open: false,
    section: 'document',
    itemId: '',
    itemName: ''
  });
  


  const [seaServiceDateErrors, setSeaServiceDateErrors] = useState<Record<string, string>>({});
  const [spouseValidationError, setSpouseValidationError] = useState('');
  const [spouseFirstNameError, setSpouseFirstNameError] = useState('');
  const [spouseFamilyNameError, setSpouseFamilyNameError] = useState('');
  const [spouseDobError, setSpouseDobError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [nokEmailError, setNokEmailError] = useState('');
  const [mobileError, setMobileError] = useState('');
  const [firstNameError, setFirstNameError] = useState('');
  const [dobError, setDobError] = useState('');
  const [docDateErrors, setDocDateErrors] = useState<Record<string, { issued?: string; expiry?: string }>>({});
  const [visaDateErrors, setVisaDateErrors] = useState<Record<string, { issued?: string; expiry?: string }>>({});
  const [licDateErrors, setLicDateErrors] = useState<Record<string, { issued?: string; expiry?: string }>>({});
  const [trainDateErrors, setTrainDateErrors] = useState<Record<string, { issued?: string; expiry?: string }>>({});
  const [docRequiredErrors, setDocRequiredErrors] = useState<Record<string, string>>({});
  const [visaRequiredErrors, setVisaRequiredErrors] = useState<Record<string, { issuingCountry?: string; visaType?: string }>>({});
  const [eduRequiredErrors, setEduRequiredErrors] = useState<Record<string, string>>({});
  const [licRequiredErrors, setLicRequiredErrors] = useState<Record<string, string>>({});
  const [trainRequiredErrors, setTrainRequiredErrors] = useState<Record<string, string>>({});
  const [seaServiceRequiredErrors, setSeaServiceRequiredErrors] = useState<Record<string, Record<string, string>>>({});
  const [deletedChildUuids, setDeletedChildUuids] = useState<string[]>([]);
  
  const dropdownButtonRef = useRef<HTMLButtonElement>(null);

  const { canView, canEdit, permissions } = usePermissions();

  const sectionMenuMap: Record<string, string | null> = {
    A: 'CP Dashboard',
    B: null,
    C: 'CP Travel ID Documents',
    D: 'CP Training Certificates',
    E: 'CP Sea Service',
    F: 'CP Medical',
  };

  const canViewSection = useCallback((sectionId: string): boolean => {
    const menuName = sectionMenuMap[sectionId];
    if (!menuName) return true;
    if (permissions.length === 0) return true;
    return canView(menuName);
  }, [permissions, canView]);

  const canEditSection = useCallback((sectionId: string): boolean => {
    const menuName = sectionMenuMap[sectionId];
    if (!menuName) return true;
    if (permissions.length === 0) return true;
    return canEdit(menuName);
  }, [permissions, canEdit]);

  const canEditCrewDatabase = permissions.length === 0 || canEdit('Crew Database');

  const allSections = [
    { id: 'A', title: 'Dashboard', number: 'A' },
    { id: 'B', title: 'Seafarers\' Particulars', number: 'B' },
    { id: 'C', title: 'Travel & ID Documents', number: 'C' },
    { id: 'D', title: 'Training & Certificates', number: 'D' },
    { id: 'E', title: 'Sea Service', number: 'E' },
    { id: 'F', title: 'Medical', number: 'F' }
  ];

  const sections = useMemo(() =>
    allSections.filter(s => canViewSection(s.id)),
    [permissions]
  );

  // Refs for scroll detection
  const sectionARef = useRef<HTMLDivElement>(null);
  const sectionBRef = useRef<HTMLDivElement>(null);
  const sectionCRef = useRef<HTMLDivElement>(null);
  const sectionDRef = useRef<HTMLDivElement>(null);
  const sectionERef = useRef<HTMLDivElement>(null);
  const sectionFRef = useRef<HTMLDivElement>(null);
  const isBatchSavingRef = useRef(false);
  const [isBatchSaving, setIsBatchSaving] = useState(false);

  // Refs for click-outside detection on B1/B2/B3
  const sectionB1Ref = useRef<HTMLDivElement>(null);
  const sectionB2Ref = useRef<HTMLDivElement>(null);
  const sectionB3Ref = useRef<HTMLDivElement>(null);

  // External API hooks for master data with 5-minute cache and 2 retry attempts
  const { data: externalVesselTypesData, isLoading: vesselTypesLoading } = useVesselTypesV2();
  const { data: externalVesselsData, isLoading: vesselsLoading } = useVesselsV2();
  const { data: externalNationalitiesData, isLoading: nationalitiesLoading } = useNationalitiesV2();
  const { data: externalCountriesData, isLoading: countriesLoading } = useCountriesV2();
  const { data: externalLanguagesData, isLoading: languagesLoading } = useLanguagesV2();

  // Process vessel types from V2 masters
  const vesselTypeMasterDataRaw = useMemo(() => {
    if (externalVesselTypesData && Array.isArray(externalVesselTypesData) && externalVesselTypesData.length > 0) {
      return externalVesselTypesData;
    }
    return [];
  }, [externalVesselTypesData]);
  
  // Filter to Level 2 and Level 3 types for dropdown (not Level 1 categories)
  // Sort alphabetically to match Recruitment form ordering
  // External API uses 'vesselType' field for name, 'vtuid' for ID
  const vesselTypeMasterData = useMemo(() => {
    if (vesselTypeMasterDataRaw.length > 0) {
      const hasLevelField = vesselTypeMasterDataRaw.some((vt: any) => vt.level !== undefined);
      const filteredTypes = hasLevelField 
        ? vesselTypeMasterDataRaw.filter((vt: any) => vt.level && vt.level >= 2)
        : vesselTypeMasterDataRaw;
      
      if (filteredTypes.length > 0) {
        return filteredTypes
          .map((vt: any) => vt.vesselType || vt.name)
          .filter(Boolean)
          .sort((a: string, b: string) => a.localeCompare(b));
      }
    }
    return DEFAULT_DROPDOWN_VESSEL_TYPES;
  }, [vesselTypeMasterDataRaw]);

  // Create a lookup map from vtuid (vessel type unique ID) to vessel type name
  // Supports both external API format (vesselType) and local DB format (name)
  const vesselTypeIdToNameMap = useMemo(() => {
    const map = new Map<string, string>();
    vesselTypeMasterDataRaw.forEach((vt: any) => {
      const typeName = vt.vesselType || vt.name;
      if (vt.vtuid && typeName) {
        map.set(vt.vtuid, typeName);
      }
      if (vt.entryId && typeName) {
        map.set(vt.entryId, typeName);
      }
    });
    return map;
  }, [vesselTypeMasterDataRaw]);

  // Process vessels from external API for E1 Sea Service dropdown
  const vesselMasterData = useMemo(() => {
    if (externalVesselsData && Array.isArray(externalVesselsData) && externalVesselsData.length > 0) {
      return externalVesselsData;
    }
    return [];
  }, [externalVesselsData]);

  // Transform vessel master data for dropdown (name display, UUID storage, vessel type link)
  // Uses vesselUuid from local master_vessels table as the value key
  const vesselOptions = useMemo(() => {
    return vesselMasterData
      .filter((v: any) => (v.vessel || v.name) && (v.vesselUuid || v.uuid))
      .map((v: any) => ({
        code: v.vesselUuid || v.uuid,
        name: v.vessel || v.name,
        vtuid: v.vtuid || null
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [vesselMasterData]);

  const NATIONALITIES = useMemo(() => {
    if (externalNationalitiesData && Array.isArray(externalNationalitiesData) && externalNationalitiesData.length > 0) {
      return externalNationalitiesData.map((n: any) => n.nationality || n.name).filter(Boolean).sort();
    }
    return [];
  }, [externalNationalitiesData]);

  const languageMasterData = useMemo(() => {
    if (externalLanguagesData && Array.isArray(externalLanguagesData) && externalLanguagesData.length > 0) {
      return externalLanguagesData.map((l: any) => l.languageName || l.name).filter(Boolean).sort();
    }
    return [];
  }, [externalLanguagesData]);

  const countryMasterData = useMemo(() => {
    if (externalCountriesData && Array.isArray(externalCountriesData) && externalCountriesData.length > 0) {
      return externalCountriesData.map((c: any) => c.countryName || c.name).filter(Boolean).sort();
    }
    return [];
  }, [externalCountriesData]);

  // Fetch Manning Agents from V2 dedicated table
  const { data: manningAgentsData } = useManningAgentsV2();
  
  // Fetch Crew Pool from V2 dedicated table
  const { data: crewPoolData } = useCrewPoolsV2();
  
  // Extract manning agent names from master data
  const manningAgentOptions = useMemo(() => {
    const agents = manningAgentsData || [];
    return agents
      .filter((agent: any) => agent.name && agent.name.trim().length > 0)
      .map((agent: any) => ({
        id: agent.id,
        name: agent.name,
        country: agent.country || '',
        email: agent.email || ''
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [manningAgentsData]);

  // Extract crew pool names from master data
  const crewPoolOptions = useMemo(() => {
    const pools = crewPoolData || [];
    return pools
      .filter((pool: any) => pool.name && pool.name.trim().length > 0)
      .map((pool: any) => ({
        id: pool.id,
        name: pool.name
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [crewPoolData]);

  // Initialize form data with crew member data
  // Note: presentRank is normalized to convert positions (e.g., "OS_1") to actual ranks (e.g., "OS")
  const [formData, setFormData] = useState<FormData>({
    // A1.1 General Particulars
    firstName: crewMember?.firstName || '',
    middleName: crewMember?.middleName || '',
    familyName: crewMember?.familyName || '',
    gender: '',
    nationality: crewMember?.nationality || '',
    presentRank: normalizeRank(crewMember?.presentRank || '') || crewMember?.presentRank || '',
    dateOfBirth: crewMember?.dob || '',
    ageInYears: crewMember?.age || '',
    placeOfBirthCity: '',
    placeOfBirthCountry: '',
    heightCm: '',
    weightKg: '',
    bmi: '',
    nativeLanguage: '',
    foreignLanguages: '',
    englishProficiency: '',
    rankAppliedFor: '',
    vesselType: [],
    manningAgent: '',
    crewPool: '',
    employeeId: crewMember?.employeeId || '',
    nextAvailability: '',
    
    // A1.2 Address & Contact Info
    countryOfResidence: '',
    nearestAirport: '',
    residentialAddressLine1: '',
    residentialAddressLine2: '',
    contactLandline: '',
    mobile: '',
    email: '',
    
    // A1.3 Family and NOK
    maritalStatus: '',
    numberOfDependentChildren: '',
    fatherName: '',
    motherName: '',
    spouseFirstName: '',
    spouseMiddleName: '',
    spouseFamilyName: '',
    spouseDateOfBirth: '',
    children: [],
    nokFirstName: '',
    nokMiddleName: '',
    nokFamilyName: '',
    nokTelephone: '',
    nokEmail: '',
    nokAddress: '',
    nokRelationship: '',
    
    // A2.1 Travel and Identification Documents
    documents: [],
    
    // A2.2 Visas
    visas: [],
    
    // A3.1 Education
    education: [],
    
    // A3.2 License & DCE
    licenses: [],
    
    // A3.3 Training Courses
    trainingCourses: [],
    
    // A4.1 Sea Service - Current Company
    currentCompanySeaService: [],
    
    // A4.2 Sea Service - External
    externalSeaService: [],
    
    // F1. Pre Joining Medicals
    preJoiningMedicals: [],
    
    // F2. Doctor Visits
    doctorVisits: []
  });

  const runSeaServiceOverlapCheck = useCallback(() => {
    const allSeaRows = [
      ...(formData.currentCompanySeaService || []).filter((r: any) => !r.isVesselSynced),
      ...(formData.externalSeaService || []),
    ].filter((r: any) => !!(r.from || r.fromDate));

    const newErrors: Record<string, string> = {};
    for (let i = 0; i < allSeaRows.length; i++) {
      for (let j = i + 1; j < allSeaRows.length; j++) {
        const a = allSeaRows[i] as any;
        const b = allSeaRows[j] as any;
        const aFrom = a.from || a.fromDate || '';
        const aTo = (a.to && a.to !== '') ? a.to : ((a.toDate && a.toDate !== '') ? a.toDate : null);
        const bFrom = b.from || b.fromDate || '';
        const bTo = (b.to && b.to !== '') ? b.to : ((b.toDate && b.toDate !== '') ? b.toDate : null);
        if (!aFrom || !bFrom) continue;
        const noOverlap =
          (aTo !== null && aTo < bFrom) ||
          (bTo !== null && bTo < aFrom);
        if (!noOverlap) {
          const aKey = a.id || a.seaUuid || `sea-${aFrom}`;
          const bKey = b.id || b.seaUuid || `sea-${bFrom}`;
          newErrors[aKey] = 'Sea service dates overlap with another record.';
          newErrors[bKey] = 'Sea service dates overlap with another record.';
        }
      }
    }
    setSeaServiceDateErrors(newErrors);
    return newErrors;
  }, [formData.currentCompanySeaService, formData.externalSeaService]);

  const validateSeaServiceFieldOnBlur = useCallback((serviceId: string, service: any) => {
    const fieldErrors: Record<string, string> = {};
    if (!(service.vesselName || '').trim()) fieldErrors.vesselName = 'Vessel name is required.';
    if (!(service.vesselType || '').trim()) fieldErrors.vesselType = 'Vessel type is required.';
    if (!(service.rank || '').trim()) fieldErrors.rank = 'Rank is required.';
    if (!(service.from || service.fromDate || '').trim()) fieldErrors.from = 'From date is required.';
    if (!(service.to || service.toDate || '').trim()) fieldErrors.to = 'To date is required.';
    setSeaServiceRequiredErrors(prev => {
      if (Object.keys(fieldErrors).length > 0) return { ...prev, [serviceId]: fieldErrors };
      const next = { ...prev };
      delete next[serviceId];
      return next;
    });
  }, []);

  const calculateSeaServicePeriod = (fromDate: string, toDate: string): string => {
    if (!fromDate || !toDate) return '';
    try {
      const from = new Date(fromDate);
      const to = new Date(toDate);
      if (isNaN(from.getTime()) || isNaN(to.getTime())) return '';
      const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
      const days = to.getDate() - from.getDate();
      const totalMonths = months + (days / 30);
      return totalMonths >= 0 ? totalMonths.toFixed(1) : '';
    } catch {
      return '';
    }
  };

  // Update form data when detailed crew data loads from API
  // V2: Check both crewUuid and id for compatibility
  useEffect(() => {
    if (isBatchSavingRef.current) return;
    if (detailedCrewData && (crewMember?.crewUuid || crewMember?.id)) {
      setDeletedChildUuids([]);
      setFormData(prev => ({
        ...prev,
        // A1.1 General Particulars
        firstName: detailedCrewData.firstName || '',
        middleName: detailedCrewData.middleName || '',
        familyName: detailedCrewData.familyName || '',
        gender: detailedCrewData.gender || '',
        nationality: detailedCrewData.nationality || '',
        presentRank: normalizeRank(detailedCrewData.presentRank || '') || detailedCrewData.presentRank || '',
        dateOfBirth: detailedCrewData.dob || detailedCrewData.dateOfBirth || '',
        ageInYears: detailedCrewData.age || calculateAge(detailedCrewData.dob || detailedCrewData.dateOfBirth || ''),
        placeOfBirthCity: detailedCrewData.placeOfBirthCity || '',
        placeOfBirthCountry: detailedCrewData.placeOfBirthCountry || '',
        heightCm: detailedCrewData.height || detailedCrewData.heightCm || '',
        weightKg: detailedCrewData.weight || detailedCrewData.weightKg || '',
        bmi: detailedCrewData.bmi || calculateBMI(
          detailedCrewData.height || detailedCrewData.heightCm || '',
          detailedCrewData.weight || detailedCrewData.weightKg || ''
        ),
        nativeLanguage: detailedCrewData.nativeLanguage || '',
        foreignLanguages: detailedCrewData.foreignLanguages || '',
        englishProficiency: detailedCrewData.englishProficiency || '',
        rankAppliedFor: normalizeRank(detailedCrewData.rankAppliedFor || '') || detailedCrewData.rankAppliedFor || '',
        vesselType: Array.isArray(detailedCrewData.vesselTypes) 
          ? detailedCrewData.vesselTypes 
          : detailedCrewData.vesselTypes 
            ? [detailedCrewData.vesselTypes] 
            : [],
        manningAgent: detailedCrewData.manningAgent || '',
        crewPool: detailedCrewData.crewPool || '',
        employeeId: detailedCrewData.employeeId || '',
        nextAvailability: detailedCrewData.nextAvailability || '',
        
        // A1.2 Address & Contact Info
        countryOfResidence: detailedCrewData.countryOfResidence || '',
        nearestAirport: detailedCrewData.nearestAirport || '',
        residentialAddressLine1: detailedCrewData.residentialAddressLine1 || '',
        residentialAddressLine2: detailedCrewData.residentialAddressLine2 || '',
        contactLandline: detailedCrewData.contactLandline || '',
        mobile: detailedCrewData.mobile || '',
        email: detailedCrewData.email || '',
        
        // A1.3 Family and NOK
        maritalStatus: detailedCrewData.maritalStatus || '',
        numberOfDependentChildren: detailedCrewData.numberOfDependentChildren || '',
        fatherName: detailedCrewData.fatherName || '',
        motherName: detailedCrewData.motherName || '',
        spouseFirstName: detailedCrewData.spouseFirstName || '',
        spouseMiddleName: detailedCrewData.spouseMiddleName || '',
        spouseFamilyName: detailedCrewData.spouseFamilyName || '',
        spouseDateOfBirth: detailedCrewData.spouseDateOfBirth || '',
        children: Array.isArray(detailedCrewData.children) 
          ? detailedCrewData.children 
          : detailedCrewData.children 
            ? JSON.parse(detailedCrewData.children) 
            : [],
        nokFirstName: detailedCrewData.nokFirstName || '',
        nokMiddleName: detailedCrewData.nokMiddleName || '',
        nokFamilyName: detailedCrewData.nokFamilyName || '',
        nokTelephone: detailedCrewData.nokTelephone || '',
        nokEmail: detailedCrewData.nokEmail || '',
        nokAddress: detailedCrewData.nokAddress || '',
        nokRelationship: detailedCrewData.nokRelationship || '',
        
        // Complex data arrays - parse JSON strings from API
        // IMPORTANT: Use empty defaults (not prev state) to prevent data leaking between crew members
        documents: Array.isArray(detailedCrewData.documents) 
          ? detailedCrewData.documents 
          : detailedCrewData.documents 
            ? JSON.parse(detailedCrewData.documents) 
            : [],
        visas: Array.isArray(detailedCrewData.visas) 
          ? detailedCrewData.visas 
          : detailedCrewData.visas 
            ? JSON.parse(detailedCrewData.visas) 
            : [],
        education: Array.isArray(detailedCrewData.education) 
          ? detailedCrewData.education 
          : detailedCrewData.education 
            ? JSON.parse(detailedCrewData.education) 
            : [],
        licenses: (Array.isArray(detailedCrewData.licenses) 
          ? detailedCrewData.licenses 
          : detailedCrewData.licenses 
            ? JSON.parse(detailedCrewData.licenses) 
            : []).map((l: any) => ({ ...l, fromDatabase: !!(l.licenseId && l.licenseId.trim()) })),
        trainingCourses: (() => {
          const raw = (Array.isArray(detailedCrewData.trainingCourses) 
            ? detailedCrewData.trainingCourses 
            : detailedCrewData.trainingCourses 
              ? JSON.parse(detailedCrewData.trainingCourses) 
              : []).map((t: any) => ({ ...t, fromDatabase: !!(t.courseId && t.courseId.trim()) }));
          const orderMap = new Map<string, number>();
          adminCompanyTrainings.forEach((ct, idx) => orderMap.set(ct.companyId, idx));
          const UNMAPPED_DB_BASE = 500;
          const MANUAL_BASE = 1000;
          let unmappedIdx = 0;
          raw.forEach((t: any) => {
            const cid = (t.courseId || '').trim();
            if (cid && orderMap.has(cid)) {
              t.sortOrder = orderMap.get(cid);
            } else if (cid) {
              t.sortOrder = UNMAPPED_DB_BASE + unmappedIdx++;
            } else {
              t.sortOrder = MANUAL_BASE + (t.sortOrder ?? 0);
            }
          });
          raw.sort((a: any, b: any) => {
            const aOrder = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
            const bOrder = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
            return aOrder - bOrder;
          });
          return raw;
        })(),
        currentCompanySeaService: (() => {
          const services = Array.isArray(detailedCrewData.currentCompanySeaService) 
            ? detailedCrewData.currentCompanySeaService 
            : detailedCrewData.currentCompanySeaService 
              ? JSON.parse(detailedCrewData.currentCompanySeaService) 
              : [];  // Reset to empty instead of preserving prev state
          // Recalculate periods for existing records with dates
          return services.map((s: SeaService) => ({
            ...s,
            periodMonths: s.from && s.to ? calculateSeaServicePeriod(s.from, s.to) : s.periodMonths || ''
          }));
        })(),
        externalSeaService: (() => {
          const services = Array.isArray(detailedCrewData.externalSeaService) 
            ? detailedCrewData.externalSeaService 
            : detailedCrewData.externalSeaService 
              ? JSON.parse(detailedCrewData.externalSeaService) 
              : [];  // Reset to empty instead of preserving prev state
          // Recalculate periods for existing records with dates
          return services.map((s: SeaService) => ({
            ...s,
            periodMonths: s.from && s.to ? calculateSeaServicePeriod(s.from, s.to) : s.periodMonths || ''
          }));
        })(),
        preJoiningMedicals: (() => {
          const medicals = Array.isArray(detailedCrewData.preJoiningMedicals) 
            ? detailedCrewData.preJoiningMedicals 
            : detailedCrewData.preJoiningMedicals 
              ? JSON.parse(detailedCrewData.preJoiningMedicals) 
              : [];
          return medicals.map((m: PreJoiningMedical, index: number) => ({
            ...m,
            id: m.id || `MED-${index + 1}`,
            vesselCode: m.vesselCode || ''
          }));
        })(),
        doctorVisits: (() => {
          const visits = Array.isArray(detailedCrewData.doctorVisits) 
            ? detailedCrewData.doctorVisits 
            : detailedCrewData.doctorVisits 
              ? JSON.parse(detailedCrewData.doctorVisits) 
              : [];
          return visits.map((v: DoctorVisit, index: number) => ({
            ...v,
            id: v.id || `DRV-${index + 1}`,
          }));
        })(),
      }));
      
      // Also load the uploaded photo from crew data (or reset if no photo)
      setUploadedPhoto(detailedCrewData.uploadedPhoto || null);
    }
  }, [detailedCrewData, crewMember?.crewUuid, crewMember?.id, adminCompanyTrainings]);

  // Mark E1 rows that were auto-generated via vessel sign-on as isVesselSynced
  useEffect(() => {
    if (!crewAssignmentsData || crewAssignmentsData.length === 0) return;

    // Build a set of "vesselUuid|signOnDate" keys from all on-board assignments
    const assignmentKeys = new Set<string>();
    crewAssignmentsData.forEach((a: any) => {
      if (a.vesselUuid && a.signOnDate && !a.signOffDate) {
        assignmentKeys.add(`${a.vesselUuid}|${a.signOnDate}`);
      }
    });

    setFormData(prev => {
      const updated = (prev.currentCompanySeaService || []).map((sea: any) => {
        if (!sea.seaUuid) return sea; // manual (unsaved) rows are never synced
        const key = `${sea.vesselCode || sea.vesselUuid || ''}|${sea.from || sea.fromDate || ''}`;
        const isSynced = assignmentKeys.has(key);
        if (isSynced === !!(sea.isVesselSynced)) return sea;
        return { ...sea, isVesselSynced: isSynced };
      });
      if (updated.every((s: any, i: number) => s === prev.currentCompanySeaService[i])) return prev;
      return { ...prev, currentCompanySeaService: updated };
    });
  }, [crewAssignmentsData, detailedCrewData]);

  // Reset photo when crew member changes or form closes
  // V2: Check both crewUuid and id
  useEffect(() => {
    if (!isOpen || !(crewMember?.crewUuid || crewMember?.id)) {
      setUploadedPhoto(null);
    }
  }, [isOpen, crewMember?.crewUuid, crewMember?.id]);

  // Reset createdCrewId when:
  // 1. Dialog opens for a NEW crew member (crewMember is null/undefined at open)
  // 2. Dialog opens for a DIFFERENT crew member (crewMember?.id changes)
  // This ensures each session starts fresh
  useEffect(() => {
    if (isOpen) {
      // Dialog is opening - check if we need to reset for a fresh session
      if (!crewMember?.id) {
        // Opening for a new crew member - ensure we start fresh (POST on first save)
        setCreatedCrewId(null);
      }
    }
  }, [isOpen, crewMember?.id]);
  
  useEffect(() => {
    // When switching to a different crew member while dialog is open, reset the locally created ID
    setCreatedCrewId(null);
  }, [crewMember?.id]);

  // Reset form data when opening for a NEW crew member (crewMember is null)
  // This ensures the form starts with empty values instead of stale data from previous selection
  useEffect(() => {
    if (isOpen && !crewMember) {
      setFormData({
        // A1.1 General Particulars
        firstName: '',
        middleName: '',
        familyName: '',
        gender: '',
        nationality: '',
        presentRank: '',
        dateOfBirth: '',
        ageInYears: '',
        placeOfBirthCity: '',
        placeOfBirthCountry: '',
        heightCm: '',
        weightKg: '',
        bmi: '',
        nativeLanguage: '',
        foreignLanguages: '',
        englishProficiency: '',
        rankAppliedFor: '',
        vesselType: [],
        manningAgent: '',
        crewPool: '',
        employeeId: '',
        nextAvailability: '',
        
        // A1.2 Address & Contact Info
        countryOfResidence: '',
        nearestAirport: '',
        residentialAddressLine1: '',
        residentialAddressLine2: '',
        contactLandline: '',
        mobile: '',
        email: '',
        
        // A1.3 Family and NOK
        maritalStatus: '',
        numberOfDependentChildren: '',
        fatherName: '',
        motherName: '',
        spouseFirstName: '',
        spouseMiddleName: '',
        spouseFamilyName: '',
        spouseDateOfBirth: '',
        children: [],
        nokFirstName: '',
        nokMiddleName: '',
        nokFamilyName: '',
        nokTelephone: '',
        nokEmail: '',
        nokAddress: '',
        nokRelationship: '',
        
        // A2.1 Travel and Identification Documents
        documents: [],
        
        // A2.2 Visas
        visas: [],
        
        // A3.1 Education
        education: [],
        
        // A3.2 License
        licenses: [],
        
        // A3.3 Training Courses
        trainingCourses: [],
        
        // A4.1 Sea Service
        currentCompanySeaService: [],
        externalSeaService: [],
        
        // F1. Pre-Joining Medical
        preJoiningMedicals: [],
        
        // F2. Doctor Visits
        doctorVisits: [],
      });
      setUploadedPhoto(null);
    }
  }, [isOpen, crewMember]);

  // Click-outside detection for B1/B2/B3: auto-save and close editing section
  useEffect(() => {
    const isInsidePortal = (el: Element | null): boolean => {
      while (el) {
        if (
          el.hasAttribute?.('data-radix-popper-content-wrapper') ||
          el.hasAttribute?.('data-radix-portal') ||
          el.getAttribute?.('role') === 'listbox' ||
          el.getAttribute?.('role') === 'dialog' ||
          el.classList?.contains('rdp') ||
          el.hasAttribute?.('data-radix-select-viewport') ||
          el.closest?.('[data-radix-popper-content-wrapper]') ||
          el.closest?.('[data-radix-portal]')
        ) {
          return true;
        }
        el = el.parentElement;
      }
      return false;
    };

    const handleClickOutside = async (e: MouseEvent) => {
      const target = e.target as Element;
      if (isInsidePortal(target)) return;

      const sectionRefs: Record<string, React.RefObject<HTMLDivElement>> = {
        'B1': sectionB1Ref,
        'B2': sectionB2Ref,
        'B3': sectionB3Ref,
      };

      for (const [sectionId, isEditing] of Object.entries(editingSections)) {
        if (!isEditing) continue;
        const ref = sectionRefs[sectionId];
        if (ref?.current && !ref.current.contains(target)) {
          let crewUuid = getEffectiveCrewUuid();
          if (!crewUuid && sectionId === 'B1') {
            const trimmedFirstName = (formData.firstName || '').trim();
            if (trimmedFirstName) {
              crewUuid = await ensureCrewExists();
            } else {
              const hasB1Data = !!(
                (formData.familyName || '').trim() ||
                (formData.middleName || '').trim() ||
                formData.presentRank ||
                formData.dateOfBirth ||
                formData.nationality ||
                formData.gender ||
                formData.heightCm ||
                formData.weightKg ||
                formData.bmi ||
                (formData.placeOfBirthCity || '').trim() ||
                (formData.placeOfBirthCountry || '').trim() ||
                (formData.nativeLanguage || '').trim() ||
                (formData.foreignLanguages || '').trim() ||
                (formData.englishProficiency || '').trim() ||
                (formData.manningAgent || '').trim() ||
                (formData.crewPool || '').trim() ||
                (Array.isArray(formData.vesselType) && formData.vesselType.length > 0)
              );
              if (hasB1Data) {
                setFirstNameError('First name is required.');
                continue;
              }
            }
          }
          if (crewUuid) {
            handleSectionAutoSave(sectionId, crewUuid);
          }
          setEditingSections(prev => ({ ...prev, [sectionId]: false }));
        }
      }
    };

    const hasEditingSection = Object.values(editingSections).some(Boolean);
    if (hasEditingSection) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [editingSections, formData]);


  // Helper function to calculate age from date of birth
  const calculateAge = (dateOfBirth: string) => {
    if (!dateOfBirth) return '';
    
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    
    // Check if valid date
    if (isNaN(birthDate.getTime())) return '';
    
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    // Adjust if birthday hasn't occurred this year yet
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age >= 0 ? age.toString() : '';
  };

  // Crew ID will be auto-assigned by the API during creation (no pre-fetching)

  // Update form data function with BMI and Age auto-calculation
  const updateFormData = (field: keyof FormData, value: string) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-calculate BMI when height or weight changes
      if (field === 'heightCm' || field === 'weightKg') {
        const height = field === 'heightCm' ? value : prev.heightCm;
        const weight = field === 'weightKg' ? value : prev.weightKg;
        updated.bmi = calculateBMI(height, weight);
      }
      
      // Auto-calculate age when date of birth changes
      if (field === 'dateOfBirth') {
        updated.ageInYears = calculateAge(value);
      }
      
      return updated;
    });
  };


  // Photo upload handler
  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedPhoto(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setUploadedPhoto(null);
  };

  // Vessel type selection handler
  const handleVesselTypeSelection = (vesselType: string) => {
    const currentTypes = formData.vesselType || [];
    const updatedVesselTypes = currentTypes.includes(vesselType)
      ? currentTypes.filter(type => type !== vesselType)
      : [...currentTypes, vesselType];
    setFormData(prev => ({ ...prev, vesselType: updatedVesselTypes }));
  };

  const isVesselTypeSelected = (vesselType: string): boolean => {
    return (formData.vesselType || []).includes(vesselType);
  };

  // Language selection handler
  const handleLanguageSelection = (field: 'foreignLanguages', language: string) => {
    const currentLanguages = formData[field];
    const languageArray = currentLanguages ? currentLanguages.split(', ').filter(Boolean) : [];
    
    const updatedLanguages = languageArray.includes(language)
      ? languageArray.filter(lang => lang !== language)
      : [...languageArray, language];
    
    setFormData(prev => ({ ...prev, [field]: updatedLanguages.join(', ') }));
  };

  const isLanguageSelected = (field: 'foreignLanguages', language: string): boolean => {
    const currentLanguages = formData[field];
    return currentLanguages ? currentLanguages.split(', ').includes(language) : false;
  };

  // Child management functions
  const addChild = () => {
    const newChild: ChildInfo = {
      firstName: '',
      middleName: '',
      familyName: '',
      dateOfBirth: '',
      gender: ''
    };
    setFormData(prev => ({ ...prev, children: [...prev.children, newChild] }));
  };

  const updateChild = (index: number, field: keyof ChildInfo, value: string) => {
    setFormData(prev => ({
      ...prev,
      children: prev.children.map((child, i) => 
        i === index ? { ...child, [field]: value } : child
      )
    }));
  };

  const removeChild = (index: number) => {
    const childToRemove = formData.children[index];
    if (childToRemove?.childUuid) {
      setDeletedChildUuids(prev => [...prev, childToRemove.childUuid!]);
    }
    setFormData(prev => ({
      ...prev,
      children: prev.children.filter((_, i) => i !== index)
    }));
  };

  // Helper function to get next unique ID based on prefix
  const getNextId = (items: Array<{id?: string}>, prefix: string): string => {
    const existingNums = items
      .map(item => {
        if (!item.id) return 0;
        const match = item.id.match(new RegExp(`^${prefix}-(\\d+)$`));
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => n > 0);
    const maxNum = existingNums.length > 0 ? Math.max(...existingNums) : 0;
    return `${prefix}-${maxNum + 1}`;
  };

  // Helper to get max ID number from items with a given prefix
  const getMaxIdNum = (items: Array<{id?: string}>, prefix: string): number => {
    const existingNums = items
      .map(item => {
        if (!item.id) return 0;
        const match = item.id.match(new RegExp(`^${prefix}-(\\d+)$`));
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => n > 0);
    return existingNums.length > 0 ? Math.max(...existingNums) : 0;
  };

  // Document management
  const addDocument = () => {
    setFormData(prev => {
      const newDoc: DocumentInfo = {
        id: getNextId(prev.documents, 'DOC'),
        documentId: '',
        document: '',
        number: '',
        issued: '',
        expiry: '',
        issuingAuthority: ''
      };
      return { ...prev, documents: [...prev.documents, newDoc] };
    });
  };

  const updateDocument = (id: string, field: keyof DocumentInfo, value: string) => {
    setFormData(prev => ({
      ...prev,
      documents: prev.documents.map(doc => 
        doc.id === id ? { ...doc, [field]: value } : doc
      )
    }));
  };

  const removeDocument = (id: string) => {
    const doc = formData.documents.find(d => d.id === id);
    const docUuid = (doc as any)?.docUuid;
    const crewIdentifier = crewMember?.crewUuid || crewMember?.id;
    
    if (docUuid && crewIdentifier) {
      deleteDocumentMutationV2.mutate(
        { crewUuid: crewIdentifier, docUuid },
        {
          onSuccess: () => {
            setFormData(prev => ({
              ...prev,
              documents: prev.documents.filter(d => d.id !== id)
            }));
            invalidateCrewData(crewIdentifier);
          },
          onError: (error) => {
            console.error('Failed to delete document:', error);
            toast({ title: 'Failed to delete document', variant: 'destructive' });
          }
        }
      );
    } else {
      setFormData(prev => ({
        ...prev,
        documents: prev.documents.filter(d => d.id !== id)
      }));
    }
  };

  // Visa management
  const addVisa = () => {
    setFormData(prev => {
      const newVisa: Visa = {
        id: getNextId(prev.visas, 'VIS'),
        countryId: '',
        issuingCountry: '',
        serialNo: '',
        issued: '',
        expiry: '',
        visaType: ''
      };
      return { ...prev, visas: [...prev.visas, newVisa] };
    });
  };

  const updateVisa = (id: string, field: keyof Visa, value: string) => {
    setFormData(prev => ({
      ...prev,
      visas: prev.visas.map(visa => 
        visa.id === id ? { ...visa, [field]: value } : visa
      )
    }));
  };

  const removeVisa = (id: string) => {
    const visa = formData.visas.find(v => v.id === id);
    const visaUuid = (visa as any)?.visaUuid;
    const crewIdentifier = crewMember?.crewUuid || crewMember?.id;
    
    if (visaUuid && crewIdentifier) {
      deleteVisaMutationV2.mutate(
        { crewUuid: crewIdentifier, visaUuid },
        {
          onSuccess: () => {
            setFormData(prev => ({
              ...prev,
              visas: prev.visas.filter(v => v.id !== id)
            }));
            invalidateCrewData(crewIdentifier);
          },
          onError: (error) => {
            console.error('Failed to delete visa:', error);
            toast({ title: 'Failed to delete visa', variant: 'destructive' });
          }
        }
      );
    } else {
      setFormData(prev => ({
        ...prev,
        visas: prev.visas.filter(v => v.id !== id)
      }));
    }
  };

  // Education management
  const addEducation = () => {
    setFormData(prev => {
      const newEducation: Education = {
        id: getNextId(prev.education, 'EDU'),
        dateOfCompletion: '',
        schoolCollegeUniversity: '',
        subjectsField: '',
        qualifications: ''
      };
      return { ...prev, education: [...prev.education, newEducation] };
    });
  };

  const updateEducation = (id: string, field: keyof Education, value: string) => {
    setFormData(prev => ({
      ...prev,
      education: prev.education.map(edu => 
        edu.id === id ? { ...edu, [field]: value } : edu
      )
    }));
  };

  const removeEducation = (id: string) => {
    const edu = formData.education.find(e => e.id === id);
    const eduUuid = (edu as any)?.eduUuid;
    const crewIdentifier = crewMember?.crewUuid || crewMember?.id;
    
    if (eduUuid && crewIdentifier) {
      deleteEducationMutationV2.mutate(
        { crewUuid: crewIdentifier, eduUuid },
        {
          onSuccess: () => {
            setFormData(prev => ({
              ...prev,
              education: prev.education.filter(e => e.id !== id)
            }));
            invalidateCrewData(crewIdentifier);
          },
          onError: (error) => {
            console.error('Failed to delete education:', error);
            toast({ title: 'Failed to delete education', variant: 'destructive' });
          }
        }
      );
    } else {
      setFormData(prev => ({
        ...prev,
        education: prev.education.filter(e => e.id !== id)
      }));
    }
  };

  // License management
  const addLicense = () => {
    setFormData(prev => {
      const newLicense: License = {
        id: getNextId(prev.licenses, 'LIC'),
        licenseId: '',
        certificateDocument: '',
        abbr: '',
        requirement: '',
        certificateNo: '',
        issuingAuthority: '',
        issued: '',
        expiry: ''
      };
      return { ...prev, licenses: [...prev.licenses, newLicense] };
    });
  };

  // Add licenses from database selection
  // cocsToArchive: Array of license IDs (template IDs) to archive when upgrading COCs
  const addLicensesFromDatabase = (selectedTemplates: LicenseTemplate[], cocsToArchive?: string[]) => {
    setFormData(prev => {
      let existingLicenses = prev.licenses.filter(l => l.certificateDocument.trim() !== '');
      
      // If archiving COCs due to upgrade, mark them as archived
      if (cocsToArchive && cocsToArchive.length > 0) {
        const archiveSet = new Set(cocsToArchive);
        existingLicenses = existingLicenses.map(license => {
          if (archiveSet.has(license.licenseId)) {
            return {
              ...license,
              archivedAt: new Date().toISOString(),
              archivedReason: 'Superseded by higher-level COC upgrade',
            };
          }
          return license;
        });
      }
      
      const maxId = getMaxIdNum(prev.licenses, 'LIC');
      const newLicenses: License[] = selectedTemplates.map((template, index) => ({
        id: `LIC-${maxId + index + 1}`,
        licenseId: template.id,
        certificateDocument: template.name,
        abbr: template.abbr,
        requirement: template.requirement,
        certificateNo: '',
        issuingAuthority: '',
        issued: '',
        expiry: '',
        fromDatabase: true,
      }));
      return { 
        ...prev, 
        licenses: [...existingLicenses, ...newLicenses] 
      };
    });
    setIsLicenseDialogOpen(false);
  };

  // Add training courses from database selection
  const addTrainingCoursesFromDatabase = (selectedTemplates: TrainingCourseTemplate[]) => {
    setFormData(prev => {
      const existingCourses = prev.trainingCourses.filter(c => c.trainingCourse.trim() !== '');
      const maxId = getMaxIdNum(prev.trainingCourses, 'TRN');
      const newCourses: TrainingCourse[] = selectedTemplates.map((template, index) => ({
        id: `TRN-${maxId + index + 1}`,
        courseId: template.companyId,
        companyId: template.companyId,
        trainingCourse: template.name,
        abbr: template.abbr,
        requirement: template.requirement,
        certificateNo: '',
        issuingAuthority: '',
        issued: '',
        expiry: '',
        fromDatabase: true,
        sortOrder: template.sortOrder,
      }));
      const allCourses = [...existingCourses, ...newCourses];
      const orderMap = new Map<string, number>();
      adminCompanyTrainings.forEach((ct, idx) => orderMap.set(ct.companyId, idx));
      allCourses.forEach(c => {
        if (c.courseId && orderMap.has(c.courseId)) {
          c.sortOrder = orderMap.get(c.courseId);
        }
      });
      allCourses.sort((a, b) => {
        const aOrder = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
        const bOrder = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
        return aOrder - bOrder;
      });
      return { 
        ...prev, 
        trainingCourses: allCourses 
      };
    });
    setIsTrainingDialogOpen(false);
  };

  // Add travel documents from database selection
  const addTravelDocsFromDatabase = (selectedTemplates: TravelDocumentTemplate[]) => {
    setFormData(prev => {
      const existingDocs = prev.documents.filter(d => d.document.trim() !== '');
      const maxId = getMaxIdNum(prev.documents, 'DOC');
      const newDocs: DocumentInfo[] = selectedTemplates.map((template, index) => ({
        id: `DOC-${maxId + index + 1}`,
        documentId: template.id,
        document: template.name,
        number: '',
        issued: '',
        expiry: '',
        issuingAuthority: ''
      }));
      return { 
        ...prev, 
        documents: [...existingDocs, ...newDocs] 
      };
    });
    setIsTravelDocDialogOpen(false);
  };

  // Add visas from database selection (country list)
  const addVisasFromDatabase = (selectedCountries: VisaCountryTemplate[]) => {
    setFormData(prev => {
      const existingVisas = prev.visas.filter(v => v.issuingCountry.trim() !== '');
      const maxId = getMaxIdNum(prev.visas, 'VIS');
      const newVisas: Visa[] = selectedCountries.map((country, index) => ({
        id: `VIS-${maxId + index + 1}`,
        countryId: country.id,
        issuingCountry: country.name,
        serialNo: '',
        issued: '',
        expiry: '',
        visaType: ''
      }));
      return { 
        ...prev, 
        visas: [...existingVisas, ...newVisas] 
      };
    });
    setIsVisaDialogOpen(false);
  };

  const updateLicense = (id: string, field: keyof License, value: string) => {
    setFormData(prev => ({
      ...prev,
      licenses: prev.licenses.map(license => 
        license.id === id ? { ...license, [field]: value } : license
      )
    }));
  };

  const removeLicense = (id: string) => {
    const license = formData.licenses.find(l => l.id === id);
    const licUuid = (license as any)?.licUuid;
    const crewIdentifier = crewMember?.crewUuid || crewMember?.id;
    
    if (licUuid && crewIdentifier) {
      deleteLicenseMutationV2.mutate(
        { crewUuid: crewIdentifier, licUuid },
        {
          onSuccess: () => {
            setFormData(prev => ({
              ...prev,
              licenses: prev.licenses.filter(l => l.id !== id)
            }));
            invalidateCrewData(crewIdentifier);
          },
          onError: (error) => {
            console.error('Failed to delete license:', error);
            toast({ title: 'Failed to delete license', variant: 'destructive' });
          }
        }
      );
    } else {
      setFormData(prev => ({
        ...prev,
        licenses: prev.licenses.filter(l => l.id !== id)
      }));
    }
  };

  // Training course management
  const addTrainingCourse = () => {
    setFormData(prev => {
      const newCourse: TrainingCourse = {
        id: getNextId(prev.trainingCourses, 'TRN'),
        trainingCourse: '',
        abbr: '',
        requirement: '',
        certificateNo: '',
        issuingAuthority: '',
        issued: '',
        expiry: ''
      };
      return { ...prev, trainingCourses: [...prev.trainingCourses, newCourse] };
    });
  };

  const updateTrainingCourse = (id: string, field: keyof TrainingCourse, value: string) => {
    setFormData(prev => ({
      ...prev,
      trainingCourses: prev.trainingCourses.map(course => 
        course.id === id ? { ...course, [field]: value } : course
      )
    }));
  };

  const removeTrainingCourse = (id: string) => {
    const course = formData.trainingCourses.find(c => c.id === id);
    const trainUuid = (course as any)?.trainUuid;
    const crewIdentifier = crewMember?.crewUuid || crewMember?.id;
    
    if (trainUuid && crewIdentifier) {
      deleteTrainingCourseMutationV2.mutate(
        { crewUuid: crewIdentifier, trainUuid },
        {
          onSuccess: () => {
            setFormData(prev => ({
              ...prev,
              trainingCourses: prev.trainingCourses.filter(c => c.id !== id)
            }));
            invalidateCrewData(crewIdentifier);
          },
          onError: (error) => {
            console.error('Failed to delete training course:', error);
            toast({ title: 'Failed to delete training course', variant: 'destructive' });
          }
        }
      );
    } else {
      setFormData(prev => ({
        ...prev,
        trainingCourses: prev.trainingCourses.filter(c => c.id !== id)
      }));
    }
  };

  const calculatePeriodMonths = (fromDate: string, toDate: string): string => {
    if (!fromDate || !toDate) return '';
    try {
      const from = new Date(fromDate);
      const to = new Date(toDate);
      if (isNaN(from.getTime()) || isNaN(to.getTime())) return '';
      const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
      const days = to.getDate() - from.getDate();
      const totalMonths = months + (days / 30);
      return totalMonths >= 0 ? totalMonths.toFixed(1) : '';
    } catch {
      return '';
    }
  };

  // Sea service management - Current Company
  const addCurrentCompanySeaService = () => {
    setFormData(prev => {
      const newService: SeaService = {
        id: getNextId(prev.currentCompanySeaService, 'SEA-C'),
        vesselName: '',
        vesselCode: '',
        vesselType: '',
        deadweight: '',
        engineTypePower: '',
        ownerOperator: '',
        rank: '',
        from: '',
        to: '',
        periodMonths: ''
      };
      return { ...prev, currentCompanySeaService: [newService, ...prev.currentCompanySeaService] };
    });
  };

  const updateCurrentCompanySeaService = (id: string, field: keyof SeaService, value: string) => {
    setFormData(prev => ({
      ...prev,
      currentCompanySeaService: prev.currentCompanySeaService.map(service => {
        if (service.id !== id) return service;
        
        const updatedService = { ...service, [field]: value };
        
        // Auto-calculate period when from or to date changes
        if (field === 'from' || field === 'to') {
          const fromDate = field === 'from' ? value : service.from;
          const toDate = field === 'to' ? value : service.to;
          updatedService.periodMonths = calculatePeriodMonths(fromDate, toDate);
        }
        
        return updatedService;
      })
    }));
  };

  const removeCurrentCompanySeaService = (id: string) => {
    const service = formData.currentCompanySeaService.find(s => s.id === id);
    const seaUuid = (service as any)?.seaUuid;
    const crewIdentifier = crewMember?.crewUuid || crewMember?.id;
    
    if (seaUuid && crewIdentifier) {
      deleteSeaServiceMutationV2.mutate(
        { crewUuid: crewIdentifier, seaUuid },
        {
          onSuccess: () => {
            setFormData(prev => ({
              ...prev,
              currentCompanySeaService: prev.currentCompanySeaService.filter(s => s.id !== id)
            }));
            invalidateCrewData(crewIdentifier);
          },
          onError: (error) => {
            console.error('Failed to delete sea service:', error);
            toast({ title: 'Failed to delete sea service', variant: 'destructive' });
          }
        }
      );
    } else {
      setFormData(prev => ({
        ...prev,
        currentCompanySeaService: prev.currentCompanySeaService.filter(s => s.id !== id)
      }));
    }
  };

  // Sea service management - External
  const addExternalSeaService = () => {
    setFormData(prev => {
      const newService: SeaService = {
        id: getNextId(prev.externalSeaService, 'SEA-E'),
        vesselName: '',
        vesselCode: '',
        vesselType: '',
        deadweight: '',
        engineTypePower: '',
        ownerOperator: '',
        rank: '',
        from: '',
        to: '',
        periodMonths: ''
      };
      return { ...prev, externalSeaService: [newService, ...prev.externalSeaService] };
    });
  };

  const updateExternalSeaService = (id: string, field: keyof SeaService, value: string) => {
    setFormData(prev => ({
      ...prev,
      externalSeaService: prev.externalSeaService.map(service => {
        if (service.id !== id) return service;
        
        const updatedService = { ...service, [field]: value };
        
        // Auto-calculate period when from or to date changes
        if (field === 'from' || field === 'to') {
          const fromDate = field === 'from' ? value : service.from;
          const toDate = field === 'to' ? value : service.to;
          updatedService.periodMonths = calculatePeriodMonths(fromDate, toDate);
        }
        
        return updatedService;
      })
    }));
  };

  const removeExternalSeaService = (id: string) => {
    const service = formData.externalSeaService.find(s => s.id === id);
    const seaUuid = (service as any)?.seaUuid;
    const crewIdentifier = crewMember?.crewUuid || crewMember?.id;
    
    if (seaUuid && crewIdentifier) {
      deleteSeaServiceMutationV2.mutate(
        { crewUuid: crewIdentifier, seaUuid },
        {
          onSuccess: () => {
            setFormData(prev => ({
              ...prev,
              externalSeaService: prev.externalSeaService.filter(s => s.id !== id)
            }));
            invalidateCrewData(crewIdentifier);
          },
          onError: (error) => {
            console.error('Failed to delete sea service:', error);
            toast({ title: 'Failed to delete sea service', variant: 'destructive' });
          }
        }
      );
    } else {
      setFormData(prev => ({
        ...prev,
        externalSeaService: prev.externalSeaService.filter(s => s.id !== id)
      }));
    }
  };

  // Pre-joining medical management
  const addPreJoiningMedical = () => {
    setFormData(prev => {
      const newMedical: PreJoiningMedical = {
        id: getNextId(prev.preJoiningMedicals, 'MED'),
        vesselCode: '',
        vessel: '',
        dateOfMedical: '',
        bp: '', 
        weight: '',
        anyMedicationPrescribed: '',
        fitnessForDuty: '',
        expiry: ''
      };
      return { ...prev, preJoiningMedicals: [newMedical, ...prev.preJoiningMedicals] };
    });
  };

  const updatePreJoiningMedical = (id: string, field: keyof PreJoiningMedical, value: string) => {
    setFormData(prev => ({
      ...prev,
      preJoiningMedicals: prev.preJoiningMedicals.map(medical => 
        medical.id === id ? { ...medical, [field]: value } : medical
      )
    }));
  };

  const removePreJoiningMedical = (id: string) => {
    const medical = formData.preJoiningMedicals.find(m => m.id === id);
    const medUuid = (medical as any)?.medUuid;
    const crewIdentifier = crewMember?.crewUuid || crewMember?.id;
    
    if (medUuid && crewIdentifier) {
      deleteMedicalMutationV2.mutate(
        { crewUuid: crewIdentifier, medUuid },
        {
          onSuccess: () => {
            setFormData(prev => ({
              ...prev,
              preJoiningMedicals: prev.preJoiningMedicals.filter(m => m.id !== id)
            }));
            invalidateCrewData(crewIdentifier);
          },
          onError: (error) => {
            console.error('Failed to delete medical record:', error);
            toast({ title: 'Failed to delete medical record', variant: 'destructive' });
          }
        }
      );
    } else {
      setFormData(prev => ({
        ...prev,
        preJoiningMedicals: prev.preJoiningMedicals.filter(m => m.id !== id)
      }));
    }
  };

  // Doctor visit management
  const addDoctorVisit = () => {
    setFormData(prev => {
      const newVisit: DoctorVisit = {
        id: getNextId(prev.doctorVisits, 'DRV'),
        vessel: '',
        port: '',
        date: '',
        complaint: '',
        doctorComments: ''
      };
      return { ...prev, doctorVisits: [newVisit, ...prev.doctorVisits] };
    });
  };

  const updateDoctorVisit = (id: string, field: keyof DoctorVisit, value: string) => {
    setFormData(prev => ({
      ...prev,
      doctorVisits: prev.doctorVisits.map(visit => 
        visit.id === id ? { ...visit, [field]: value } : visit
      )
    }));
  };

  const removeDoctorVisit = (id: string) => {
    const visit = formData.doctorVisits.find(v => v.id === id);
    const visitUuid = (visit as any)?.visitUuid;
    const crewIdentifier = crewMember?.crewUuid || crewMember?.id;
    
    if (visitUuid && crewIdentifier) {
      deleteDoctorVisitMutationV2.mutate(
        { crewUuid: crewIdentifier, visitUuid },
        {
          onSuccess: () => {
            setFormData(prev => ({
              ...prev,
              doctorVisits: prev.doctorVisits.filter(v => v.id !== id)
            }));
            invalidateCrewData(crewIdentifier);
          },
          onError: (error) => {
            console.error('Failed to delete doctor visit:', error);
            toast({ title: 'Failed to delete doctor visit', variant: 'destructive' });
          }
        }
      );
    } else {
      setFormData(prev => ({
        ...prev,
        doctorVisits: prev.doctorVisits.filter(v => v.id !== id)
      }));
    }
  };

  // File attachment management functions
  const openAttachmentDialog = (section: typeof attachmentDialog.section, itemId: string, itemName: string) => {
    setAttachmentDialog({
      open: true,
      section,
      itemId,
      itemName
    });
  };

  // Helper to get record UUID by section and local id
  const getRecordUuid = (section: typeof attachmentDialog.section, itemId: string): string | undefined => {
    switch (section) {
      case 'document':
        return (formData.documents.find(d => d.id === itemId) as any)?.docUuid;
      case 'visa':
        return (formData.visas.find(v => v.id === itemId) as any)?.visaUuid;
      case 'education':
        return (formData.education.find(e => e.id === itemId) as any)?.eduUuid;
      case 'license':
        return (formData.licenses.find(l => l.id === itemId) as any)?.licUuid;
      case 'training':
        return (formData.trainingCourses.find(t => t.id === itemId) as any)?.trainUuid;
      case 'currentSeaService':
        return (formData.currentCompanySeaService.find(s => s.id === itemId) as any)?.seaUuid;
      case 'externalSeaService':
        return (formData.externalSeaService.find(s => s.id === itemId) as any)?.seaUuid;
      case 'preJoiningMedical':
        return (formData.preJoiningMedicals.find(m => m.id === itemId) as any)?.medUuid;
      case 'doctorVisit':
        return (formData.doctorVisits.find(v => v.id === itemId) as any)?.visitUuid;
      default:
        return undefined;
    }
  };

  const handleAttachmentClick = (section: typeof attachmentDialog.section, itemId: string, itemName: string) => {
    const crewIdentifier = crewMember?.crewUuid || crewMember?.id || createdCrewId;
    
    if (!crewIdentifier) {
      toast({
        title: 'Save Required',
        description: 'Please save the crew member first before adding attachments.',
        variant: 'destructive'
      });
      return;
    }

    const recordUuid = getRecordUuid(section, itemId);
    
    if (recordUuid) {
      openAttachmentDialog(section, itemId, itemName);
      return;
    }

    toast({
      title: 'Save Required',
      description: 'Please save the record first before adding attachments.',
      variant: 'destructive'
    });
  };

  const getAttachmentsForItem = (): FileAttachment[] => {
    const { section, itemId } = attachmentDialog;
    
    switch (section) {
      case 'document':
        return formData.documents.find(d => d.id === itemId)?.attachments || [];
      case 'visa':
        return formData.visas.find(v => v.id === itemId)?.attachments || [];
      case 'education':
        return formData.education.find(e => e.id === itemId)?.attachments || [];
      case 'license':
        return formData.licenses.find(l => l.id === itemId)?.attachments || [];
      case 'training':
        return formData.trainingCourses.find(t => t.id === itemId)?.attachments || [];
      case 'currentSeaService':
        return formData.currentCompanySeaService.find(s => s.id === itemId)?.attachments || [];
      case 'externalSeaService':
        return formData.externalSeaService.find(s => s.id === itemId)?.attachments || [];
      case 'preJoiningMedical':
        return formData.preJoiningMedicals.find(m => m.id === itemId)?.attachments || [];
      case 'doctorVisit':
        return formData.doctorVisits.find(v => v.id === itemId)?.attachments || [];
      default:
        return [];
    }
  };

  const updateAttachments = (attachments: FileAttachment[]) => {
    const { section, itemId } = attachmentDialog;
    
    setFormData(prev => {
      switch (section) {
        case 'document':
          return {
            ...prev,
            documents: prev.documents.map(d =>
              d.id === itemId ? { ...d, attachments } : d
            )
          };
        case 'visa':
          return {
            ...prev,
            visas: prev.visas.map(v =>
              v.id === itemId ? { ...v, attachments } : v
            )
          };
        case 'education':
          return {
            ...prev,
            education: prev.education.map(e =>
              e.id === itemId ? { ...e, attachments } : e
            )
          };
        case 'license':
          return {
            ...prev,
            licenses: prev.licenses.map(l =>
              l.id === itemId ? { ...l, attachments } : l
            )
          };
        case 'training':
          return {
            ...prev,
            trainingCourses: prev.trainingCourses.map(t =>
              t.id === itemId ? { ...t, attachments } : t
            )
          };
        case 'currentSeaService':
          return {
            ...prev,
            currentCompanySeaService: prev.currentCompanySeaService.map(s =>
              s.id === itemId ? { ...s, attachments } : s
            )
          };
        case 'externalSeaService':
          return {
            ...prev,
            externalSeaService: prev.externalSeaService.map(s =>
              s.id === itemId ? { ...s, attachments } : s
            )
          };
        case 'preJoiningMedical':
          return {
            ...prev,
            preJoiningMedicals: prev.preJoiningMedicals.map(m =>
              m.id === itemId ? { ...m, attachments } : m
            )
          };
        case 'doctorVisit':
          return {
            ...prev,
            doctorVisits: prev.doctorVisits.map(v =>
              v.id === itemId ? { ...v, attachments } : v
            )
          };
        default:
          return prev;
      }
    });
  };

  // Photo Upload Component for Sidebar
  const renderSidebarPhotoUpload = () => {
    return (
      <div className="sticky top-0 bg-gray-50 p-3 border-b border-gray-200">
        <div className="relative">
          {/* Hidden file input for photo upload - always available */}
          <input
            id="sidebar-photo-upload"
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            className="hidden"
          />
          
          {uploadedPhoto ? (
            <div className="relative w-full aspect-[4/5] max-w-[120px] mx-auto rounded-lg overflow-hidden border-2 border-gray-300">
              <img 
                src={uploadedPhoto} 
                alt="Uploaded photo" 
                className="w-full h-full object-cover"
              />
              {canEditCrewDatabase && (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6"
                onClick={removePhoto}
                data-testid="button-remove-photo"
              >
                <X className="h-3 w-3" />
              </Button>
              )}
            </div>
          ) : canEditCrewDatabase ? (
            <label htmlFor="sidebar-photo-upload" className="cursor-pointer block">
              <div className="w-full aspect-[4/5] max-w-[120px] mx-auto bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-colors">
                <div className="text-center">
                  <Camera className="h-6 w-6 mx-auto mb-1 text-gray-400" />
                  <div className="text-xs text-gray-500 mb-1">Upload Photo</div>
                  <div className="text-xs text-blue-600 hover:text-blue-800">Choose file</div>
                </div>
              </div>
            </label>
          ) : (
            <div className="w-full aspect-[4/5] max-w-[120px] mx-auto bg-gray-100 rounded-lg flex items-center justify-center border-2 border-gray-300">
              <div className="text-center">
                <Camera className="h-6 w-6 mx-auto mb-1 text-gray-300" />
              </div>
            </div>
          )}
          
          {uploadedPhoto && canEditCrewDatabase && (
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              className="w-full text-xs mt-2"
              onClick={() => document.getElementById('sidebar-photo-upload')?.click()}
              data-testid="button-change-photo"
            >
              Change Photo
            </Button>
          )}
        </div>
      </div>
    );
  };

  // Dashboard render function
  const renderDashboard = () => {
    if (dashboardError) {
      return <div className="text-center py-8 text-red-600">Error loading dashboard data</div>;
    }

    return (
      <div className="space-y-6">
        {/* 3-Column Grid Layout with 25/35/40 proportions (1fr:1.4fr:1.6fr = 25:35:40) */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr_1.6fr] gap-6 items-stretch">
          
          {/* LEFT COLUMN - Status & Compliance */}
          <div className="flex flex-col gap-6 h-full">
            {/* Status Card */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 flex-1" data-testid="card-status">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium" style={{ color: '#16569e' }}>Status</h3>
                {canEditSection('A') && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setIsStatusEditOpen(true)}
                  data-testid="button-edit-status"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                )}
              </div>
              <div className="space-y-3">
                {isDashboardLoading ? (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-10 bg-gray-200 rounded"></div>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-16"></div>
                      <div className="h-5 bg-gray-200 rounded w-32"></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="h-3 bg-gray-200 rounded w-12 mb-1"></div>
                        <div className="h-4 bg-gray-200 rounded w-20"></div>
                      </div>
                      <div>
                        <div className="h-3 bg-gray-200 rounded w-16 mb-1"></div>
                        <div className="h-4 bg-gray-200 rounded w-20"></div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Status Badge with color coding: On Board=orange, On Leave=green, Inactive=gray */}
                    <div 
                      className={`${
                        statusData?.status === 'On Board' ? 'bg-orange-500' : 
                        statusData?.status === 'On Leave' ? 'bg-green-500' : 
                        statusData?.status === 'Inactive' ? 'bg-gray-500' :
                        'bg-gray-400'
                      } text-white p-3 rounded text-center`} 
                      data-testid="status-badge"
                    >
                      <div className="text-sm font-medium">{statusData?.status || '—'}</div>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      {/* Vessel - only show when On Board */}
                      {statusData?.status === 'On Board' && (
                        <div>
                          <div className="text-gray-600 text-xs">Vessel</div>
                          <div className="font-medium text-lg" data-testid="text-vessel">
                            {statusData?.vessel || crewMember?.presentVessel || '—'}
                          </div>
                        </div>
                      )}
                      
                      {/* Next Availability - show for both On Leave and On Board (crew may take short leave and return) */}
                      {(statusData?.status === 'On Leave' || statusData?.status === 'On Board') && (
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="text-gray-600 text-xs">Next Availability</div>
                            <div className="font-medium" data-testid="text-next-availability">
                              {statusData?.nextAvailability || formData.nextAvailability || '—'}
                            </div>
                          </div>
                          {canEditSection('A') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 ml-2"
                            onClick={() => setIsNextAvailabilityEditOpen(true)}
                            data-testid="button-edit-next-availability"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          )}
                        </div>
                      )}
                      
                      {/* Vessel field (when On Leave - shows as dash since not on vessel) */}
                      {statusData?.status === 'On Leave' && (
                        <div>
                          <div className="text-gray-600 text-xs">Vessel</div>
                          <div className="font-medium text-lg" data-testid="text-vessel">
                            —
                          </div>
                        </div>
                      )}
                      
                      {/* Signed On and Relief Due - only show when On Board */}
                      {statusData?.status === 'On Board' && (
                        <div className="grid grid-cols-2 gap-4 mt-3">
                          <div>
                            <div className="text-gray-600 text-xs">Signed On</div>
                            <div className="font-medium" data-testid="text-joined">
                              {statusData?.joinedDate || '—'}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-600 text-xs">Relief Due</div>
                            <div className="font-medium" data-testid="text-sailing-due">
                              {statusData?.sailingDue || '—'}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div className="mt-3">
                        <div className="text-gray-600 text-xs">Nearest Airport</div>
                        <div className="font-medium" data-testid="text-assignment">
                          {formData.nearestAirport || '—'}
                        </div>
                      </div>
                      
                      <div className="mt-3">
                        <div className="text-gray-600 text-xs">Emergency Contact Name, Relation, Ph:</div>
                        <div className="text-red-600 text-sm font-medium" data-testid="text-emergency-contact">
                          {formData.nokFirstName && formData.nokRelationship && formData.nokTelephone ? 
                            `${formData.nokFirstName} ${formData.nokFamilyName || ''}, ${formData.nokRelationship}, ${formData.nokTelephone}`.trim() : 
                            statusData?.emergencyContact ? 
                              `${statusData.emergencyContact.name}, ${statusData.emergencyContact.relation}, ${statusData.emergencyContact.phone}` : 
                              '—'}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Training/Cert/Docs Card */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 flex-1" data-testid="card-compliance-status">
              <h3 className="text-lg font-medium mb-4" style={{ color: '#16569e' }} data-testid="text-compliance-title">Training/ Cert/ Docs</h3>
              
              <div className="space-y-3" data-testid="compliance-items">
                {isDashboardLoading ? (
                  <div className="space-y-3 animate-pulse">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-3 h-3 bg-gray-200 rounded-full"></div>
                          <div className="h-4 bg-gray-200 rounded w-24"></div>
                        </div>
                        <div className="h-3 bg-gray-200 rounded w-16"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    {/* Travel Docs - linked to C1 */}
                    {(() => {
                      const analysis = analyzeExpiryStatus(formData.documents, 'document');
                      return (
                        <div className="flex items-center justify-between" data-testid="doc-travel-docs">
                          <div className="flex items-center space-x-3">
                            <div className={`w-3 h-3 ${analysis.dotColor} rounded-full`} data-testid="status-travel-docs"></div>
                            <span className="text-sm">Travel Docs:</span>
                          </div>
                          <div className="flex items-center">
                            {analysis.issueCount > 0 && (
                              <button
                                onClick={() => {
                                  setIssuesDialogData({ category: 'Travel Docs', issues: analysis.issues });
                                  setIssuesDialogOpen(true);
                                }}
                                className="text-xs text-gray-500 hover:text-blue-600 hover:underline cursor-pointer"
                                data-testid="details-travel-docs"
                              >
                                Issues: {analysis.issueCount}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                    
                    {/* Visas - linked to C2 */}
                    {(() => {
                      const analysis = analyzeExpiryStatus(formData.visas, 'issuingCountry');
                      return (
                        <div className="flex items-center justify-between" data-testid="doc-visas">
                          <div className="flex items-center space-x-3">
                            <div className={`w-3 h-3 ${analysis.dotColor} rounded-full`} data-testid="status-visas"></div>
                            <span className="text-sm">Visas:</span>
                          </div>
                          <div className="flex items-center">
                            {analysis.issueCount > 0 && (
                              <button
                                onClick={() => {
                                  setIssuesDialogData({ category: 'Visas', issues: analysis.issues });
                                  setIssuesDialogOpen(true);
                                }}
                                className="text-xs text-gray-500 hover:text-blue-600 hover:underline cursor-pointer"
                                data-testid="details-visas"
                              >
                                Issues: {analysis.issueCount}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                    
                    {/* License & DCE - linked to D2 */}
                    {(() => {
                      const analysis = analyzeExpiryStatus(formData.licenses, 'certificateDocument');
                      return (
                        <div className="flex items-center justify-between" data-testid="doc-license-dce">
                          <div className="flex items-center space-x-3">
                            <div className={`w-3 h-3 ${analysis.dotColor} rounded-full`} data-testid="status-license-dce"></div>
                            <span className="text-sm">License & DCE:</span>
                          </div>
                          <div className="flex items-center">
                            {analysis.issueCount > 0 && (
                              <button
                                onClick={() => {
                                  setIssuesDialogData({ category: 'License & DCE', issues: analysis.issues });
                                  setIssuesDialogOpen(true);
                                }}
                                className="text-xs text-gray-500 hover:text-blue-600 hover:underline cursor-pointer"
                                data-testid="details-license-dce"
                              >
                                Issues: {analysis.issueCount}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                    
                    {/* Training - linked to D3 */}
                    {(() => {
                      const analysis = analyzeExpiryStatus(formData.trainingCourses, 'trainingCourse');
                      return (
                        <div className="flex items-center justify-between" data-testid="doc-training">
                          <div className="flex items-center space-x-3">
                            <div className={`w-3 h-3 ${analysis.dotColor} rounded-full`} data-testid="status-training"></div>
                            <span className="text-sm">Training:</span>
                          </div>
                          <div className="flex items-center">
                            {analysis.issueCount > 0 && (
                              <button
                                onClick={() => {
                                  setIssuesDialogData({ category: 'Training', issues: analysis.issues });
                                  setIssuesDialogOpen(true);
                                }}
                                className="text-xs text-gray-500 hover:text-blue-600 hover:underline cursor-pointer"
                                data-testid="details-training"
                              >
                                Issues: {analysis.issueCount}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                    
                    {/* Medical - linked to F1 (shows expiry date) */}
                    {(() => {
                      let medicalExpiry: string | null = null;
                      let medicalStatus: 'expired' | 'expiring' | 'valid' | 'nodata' = 'nodata';
                      
                      if (formData.preJoiningMedicals && formData.preJoiningMedicals.length > 0) {
                        // Sort by expiry date descending (latest first)
                        const sortedMedicals = [...formData.preJoiningMedicals]
                          .filter(m => m.expiry)
                          .sort((a, b) => new Date(b.expiry).getTime() - new Date(a.expiry).getTime());
                        
                        // Find the first entry with a valid expiry date
                        for (const medical of sortedMedicals) {
                          const expiryDate = new Date(medical.expiry);
                          if (!isNaN(expiryDate.getTime())) {
                            medicalExpiry = medical.expiry;
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const twoMonthsFromNow = new Date(today);
                            twoMonthsFromNow.setMonth(twoMonthsFromNow.getMonth() + 2);
                            
                            if (expiryDate < today) {
                              medicalStatus = 'expired';
                            } else if (expiryDate <= twoMonthsFromNow) {
                              medicalStatus = 'expiring';
                            } else {
                              medicalStatus = 'valid';
                            }
                            break; // Found valid date, stop iterating
                          }
                        }
                      }
                      
                      const dotColor = medicalStatus === 'nodata' ? 'bg-gray-400' : 
                                       medicalStatus === 'valid' ? 'bg-green-500' : 
                                       medicalStatus === 'expiring' ? 'bg-orange-500' : 'bg-red-500';
                      let displayDetails = '';
                      if (medicalExpiry && medicalStatus !== 'nodata') {
                        const expDate = new Date(medicalExpiry);
                        if (!isNaN(expDate.getTime())) {
                          displayDetails = `Exp: ${expDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}`;
                        }
                      }
                      
                      return (
                        <div className="flex items-center justify-between" data-testid="doc-medical">
                          <div className="flex items-center space-x-3">
                            <div className={`w-3 h-3 ${dotColor} rounded-full`} data-testid="status-medical"></div>
                            <span className="text-sm">Medical:</span>
                          </div>
                          <div className="flex items-center">
                            {displayDetails && (
                              <span className="text-xs text-gray-500" data-testid="details-medical">{displayDetails}</span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            </div>
            
            {/* Issues Popup Dialog */}
            <Dialog open={issuesDialogOpen} onOpenChange={setIssuesDialogOpen}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle style={{ color: '#16569e' }}>
                    {issuesDialogData.category} - Expiry Issues
                  </DialogTitle>
                </DialogHeader>
                <div className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-100">
                        <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Document</TableHead>
                        <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Expiry Date</TableHead>
                        <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {issuesDialogData.issues.map((issue, index) => (
                        <TableRow key={index} className="border-b border-gray-200">
                          <TableCell className="p-3 text-sm">{issue.name}</TableCell>
                          <TableCell className="p-3 text-sm">
                            {new Date(issue.expiry).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </TableCell>
                          <TableCell className="p-3">
                            <span className={`text-xs font-medium px-2 py-1 rounded ${
                              issue.status === 'expired' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                            }`}>
                              {issue.status === 'expired' ? 'Expired' : 'Expiring Soon'}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* MIDDLE COLUMN - Experience, Rank, Ship Types */}
          <div className="flex flex-col gap-6 h-full">
            {/* Experience Metrics */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 flex-1" data-testid="card-experience">
              <h3 className="text-lg font-medium mb-4" style={{ color: '#16569e' }}>Experience</h3>
              {isDashboardLoading ? (
                <div className="grid grid-cols-5 gap-4 animate-pulse">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="text-center">
                      <div className="h-3 bg-gray-200 rounded w-16 mx-auto mb-1"></div>
                      <div className="h-3 bg-gray-200 rounded w-10 mx-auto mb-1"></div>
                      <div className="h-7 bg-gray-200 rounded w-8 mx-auto"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-4">
                  <div className="text-center flex flex-col items-center h-16 justify-between">
                    <div>
                      <div className="text-xs text-gray-500">Company</div>
                      <div className="text-xs text-gray-500">(Yrs)</div>
                    </div>
                    <div className="text-2xl font-medium text-black" data-testid="text-company-years">
                      {experienceData?.company ?? '—'}
                    </div>
                  </div>
                  <div className="text-center flex flex-col items-center h-16 justify-between">
                    <div>
                      <div className="text-xs text-gray-500">Rank</div>
                      <div className="text-xs text-gray-500">(Yrs)</div>
                    </div>
                    <div className="text-2xl font-medium text-black" data-testid="text-rank-years">
                      {experienceData?.rank ?? '—'}
                    </div>
                  </div>
                  <div className="text-center flex flex-col items-center h-16 justify-between">
                    <div>
                      <div className="text-xs text-gray-500">Tankers</div>
                      <div className="text-xs text-gray-500">(Yrs)</div>
                    </div>
                    <div className="text-2xl font-medium text-black" data-testid="text-tankers-years">
                      {experienceData?.tankers ?? '—'}
                    </div>
                  </div>
                  <div className="text-center flex flex-col items-center h-16 justify-between">
                    <div>
                      <div className="text-xs text-gray-500">OOW</div>
                      <div className="text-xs text-gray-500">(Yrs)</div>
                    </div>
                    <div className="text-2xl font-medium text-black" data-testid="text-ocw-years">
                      {experienceData?.ocw ?? '—'}
                    </div>
                  </div>
                  <div className="text-center flex flex-col items-center h-16 justify-between overflow-hidden">
                    <div>
                      <div className="text-xs text-gray-500">Endors</div>
                      <div className="text-xs text-gray-500">&nbsp;</div>
                    </div>
                    <div 
                      className="text-xs font-medium text-black w-full overflow-hidden text-ellipsis line-clamp-2" 
                      title={typeof experienceData?.endorsements === 'string' ? experienceData.endorsements : ''}
                      data-testid="text-endorsements-count"
                    >
                      {experienceData?.endorsements ?? '—'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Rank Experience */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 flex-1" data-testid="card-rank">
              <h3 className="text-lg font-medium mb-4" style={{ color: '#16569e' }}>Rank</h3>
              <div className="space-y-3">
                {isDashboardLoading ? (
                  <>
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="space-y-1 animate-pulse">
                        <div className="flex justify-between">
                          <div className="h-4 bg-gray-200 rounded w-24"></div>
                          <div className="h-4 bg-gray-200 rounded w-8"></div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-gray-300 h-2 rounded-full" style={{ width: `${60 - i * 15}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </>
                ) : rankExperienceData?.items && rankExperienceData.items.length > 0 ? (
                  rankExperienceData.items.map((item: { type?: string; label: string; months: number; years: number }, index: number) => {
                    const percentage = rankExperienceData.totalMonths > 0 
                      ? (item.months / rankExperienceData.totalMonths) * 100 
                      : 0;
                    const rankSlug = (item.type || item.label || 'unknown').toLowerCase().replace(/[\s\/]+/g, '-');
                    
                    return (
                      <div key={index} className="space-y-1" data-testid={`rank-${rankSlug}`}>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{item.label}</span>
                          <span className="font-medium" data-testid={`text-${rankSlug}-years`}>
                            {item.years}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="h-2 rounded-full transition-all duration-300" 
                            style={{ width: `${percentage}%`, backgroundColor: '#56baf3' }}
                          ></div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center text-gray-500 py-4 text-sm">
                    No rank experience data available
                  </div>
                )}
              </div>
              {!isDashboardLoading && rankExperienceData?.items && rankExperienceData.items.length > 0 && (
                <div className="mt-3 flex justify-between text-xs text-gray-500">
                  <span>0</span>
                  <span>{Math.round(rankExperienceData.totalYears / 4)}</span>
                  <span>{Math.round(rankExperienceData.totalYears / 2)}</span>
                  <span>{rankExperienceData.totalYears}</span>
                </div>
              )}
            </div>

            {/* Ship Type Experience */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 flex-1" data-testid="card-ship-types">
              <h3 className="text-lg font-medium mb-4" style={{ color: '#16569e' }}>Ship Type</h3>
              <div className="space-y-3">
                {isDashboardLoading ? (
                  <>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="space-y-1 animate-pulse">
                        <div className="flex justify-between">
                          <div className="h-4 bg-gray-200 rounded w-20"></div>
                          <div className="h-4 bg-gray-200 rounded w-8"></div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-gray-300 h-2 rounded-full" style={{ width: `${70 - i * 10}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </>
                ) : shipTypesData?.items && shipTypesData.items.length > 0 ? (
                  shipTypesData.items.map((item: { type?: string; label: string; months: number; years: number }, index: number) => {
                    const percentage = shipTypesData.totalMonths > 0 
                      ? (item.months / shipTypesData.totalMonths) * 100 
                      : 0;
                    const typeSlug = (item.type || item.label || 'unknown').toLowerCase().replace(/[\s\/]+/g, '-');
                    
                    return (
                      <div key={index} className="space-y-1" data-testid={`ship-type-${typeSlug}`}>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{item.label}</span>
                          <span className="font-medium" data-testid={`text-${typeSlug}-years`}>
                            {item.years}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="h-2 rounded-full transition-all duration-300" 
                            style={{ width: `${percentage}%`, backgroundColor: '#56baf3' }}
                          ></div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center text-gray-500 py-4 text-sm">
                    No ship type experience data available
                  </div>
                )}
              </div>
              {!isDashboardLoading && shipTypesData?.items && shipTypesData.items.length > 0 && (
                <div className="mt-3 flex justify-between text-xs text-gray-500">
                  <span>0</span>
                  <span>{Math.round(shipTypesData.totalYears / 4)}</span>
                  <span>{Math.round(shipTypesData.totalYears / 2)}</span>
                  <span>{shipTypesData.totalYears}</span>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN - Timeline, Appraisals, Promotion */}
          <div className="flex flex-col gap-6 h-full">
            {/* Timeline Card */}
            <div className="flex-1">
              <TimelineCard
                assignments={serviceTimelineData || []}
                isLoading={isDashboardLoading}
                onAppraisalClick={(_appraisalId: number) => {
                }}
                onHandoverClick={(_handoverId: number) => {
                }}
              />
            </div>

            {/* Appraisals */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 flex-1" data-testid="card-appraisals">
              <h3 className="text-lg font-medium mb-4" style={{ color: '#16569e' }}>Appraisals</h3>
              <div className="text-gray-500 py-8">
                Coming Soon
              </div>
            </div>

            {/* Promotion */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 flex-1" data-testid="card-promotion">
              <h3 className="text-lg font-medium mb-4" style={{ color: '#16569e' }} data-testid="text-promotion-title">Promotion</h3>
              <div className="text-gray-500 py-8">
                Coming Soon
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };


  // B1 General Particulars render function
  const renderA11GeneralParticulars = () => {
    const isEditing = editingSections['B1'];
    
    return (
      <div ref={sectionB1Ref} className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>B1 General Particulars</h3>
          {canEditCrewDatabase && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleEditSection('B1')}
            className="text-gray-500 hover:text-gray-700"
            data-testid="button-edit-b1"
          >
            <Edit className="h-4 w-4" />
          </Button>
          )}
        </div>
          
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Row 1: First Name | Middle Name | Family Name */}
          <div>
            <Label className="text-xs text-gray-500 tracking-wide">First Name <span className="text-red-500">*</span></Label>
            {isEditing ? (
              <Input
                value={formData.firstName}
                onChange={(e) => { updateFormData('firstName', e.target.value); if (firstNameError) setFirstNameError(''); }}
                onBlur={() => { if (!(formData.firstName || '').trim()) setFirstNameError('First name is required.'); else setFirstNameError(''); }}
                className={`mt-1 ${firstNameError ? 'border-red-500' : ''}`}
                data-testid="input-first-name"
              />
            ) : (
              <div className="mt-1 text-sm text-gray-900">{formData.firstName}</div>
            )}
            {firstNameError && <p className="text-xs text-red-500 mt-1" data-testid="text-firstname-error">{firstNameError}</p>}
          </div>
          
          <div>
            <Label className="text-xs text-gray-500 tracking-wide">Middle Name</Label>
            {isEditing ? (
              <Input
                value={formData.middleName}
                onChange={(e) => updateFormData('middleName', e.target.value)}
                className="mt-1"
              />
            ) : (
              <div className="mt-1 text-sm text-gray-900">{formData.middleName}</div>
            )}
          </div>
          
          <div>
            <Label className="text-xs text-gray-500 tracking-wide">Family Name</Label>
            {isEditing ? (
              <Input
                value={formData.familyName}
                onChange={(e) => updateFormData('familyName', e.target.value)}
                className="mt-1"
              />
            ) : (
              <div className="mt-1 text-sm text-gray-900">{formData.familyName}</div>
            )}
          </div>
          
          {/* Row 2: Gender | Rank | Vessel Type */}
          <div>
            <Label className="text-xs text-gray-500 tracking-wide">Gender</Label>
            {isEditing ? (
              <Select value={formData.gender} onValueChange={(value) => updateFormData('gender', value)}>
                <SelectTrigger className="mt-1" data-testid="select-gender-crew">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="mt-1 text-sm text-gray-900">{formData.gender}</div>
            )}
          </div>
          
          <div>
            <Label className="text-xs text-gray-500 tracking-wide">Rank</Label>
            {isEditing ? (
              <Select value={formData.presentRank} onValueChange={(value) => updateFormData('presentRank', value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select rank" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {ranksLoading ? (
                    <SelectItem value="loading" disabled>Loading ranks...</SelectItem>
                  ) : ranksError ? (
                    <SelectItem value="error" disabled>Failed to load ranks</SelectItem>
                  ) : rankOptions.length === 0 ? (
                    <SelectItem value="empty" disabled>No ranks available</SelectItem>
                  ) : (
                    rankOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            ) : (
              <div className="mt-1 text-sm text-gray-900">{normalizeRank(formData.presentRank || '') || formData.presentRank}</div>
            )}
          </div>
          
          <div>
            <Label className="text-xs text-gray-500 tracking-wide">Vessel Type</Label>
            {isEditing ? (
              <div className="mt-1">
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.vesselType.map((vesselType) => (
                    <span
                      key={vesselType}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      {vesselType}
                      <button
                        type="button"
                        onClick={() => handleVesselTypeSelection(vesselType)}
                        className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-blue-600 hover:bg-blue-200 hover:text-blue-900"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <Select onValueChange={(value) => handleVesselTypeSelection(value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select vessel types" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {vesselTypeMasterData.map((vesselType: string) => (
                      <SelectItem 
                        key={vesselType} 
                        value={vesselType}
                        className={isVesselTypeSelected(vesselType) ? 'bg-blue-50 text-blue-900' : ''}
                      >
                        <div className="flex items-center">
                          {isVesselTypeSelected(vesselType) && <span className="mr-2 text-blue-600">✓</span>}
                          {vesselType}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="mt-1 text-sm text-gray-900">
                {formData.vesselType.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {formData.vesselType.map((vesselType) => (
                      <span
                        key={vesselType}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                      >
                        {vesselType}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-gray-500">No vessel types selected</span>
                )}
              </div>
            )}
          </div>
          
          {/* Row 3: Nationality | Date of birth | Age( Years ) */}
          <div>
            <Label className="text-xs text-gray-500 tracking-wide">Nationality</Label>
            {isEditing ? (
              <Select value={formData.nationality} onValueChange={(value) => updateFormData('nationality', value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select nationality" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {NATIONALITIES.map(nationality => (
                    <SelectItem key={nationality} value={nationality}>{nationality}</SelectItem>
                  ))}
                </SelectContent>
                </Select>
            ) : (
              <div className="mt-1 text-sm text-gray-900">{formData.nationality}</div>
            )}
          </div>
          
          <div>
            <Label className="text-xs text-gray-500 tracking-wide">Date of birth</Label>
            {isEditing ? (
              <FormattedDateInput
                value={formData.dateOfBirth}
                onChange={(e) => { updateFormData('dateOfBirth', e.target.value); if (dobError) setDobError(''); }}
                onBlur={() => { const err = validateDob(formData.dateOfBirth); setDobError(err); }}
                max={(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 18); return d.toISOString().split('T')[0]; })()}
                className={`mt-1 ${dobError ? 'border-red-500' : ''}`}
                data-testid="input-date-of-birth"
              />
            ) : (
              <div className="mt-1 text-sm text-gray-900">{formatDate(formData.dateOfBirth)}</div>
            )}
            {dobError && <p className="text-xs text-red-500 mt-1" data-testid="text-dob-error">{dobError}</p>}
          </div>
          
          <div>
            <Label className="text-xs text-gray-500 tracking-wide">Age( Years )</Label>
            {isEditing ? (
              <Input
                value={formData.ageInYears}
                onChange={(e) => updateFormData('ageInYears', e.target.value)}
                className="mt-1 bg-gray-50"
                placeholder="Auto-calculated from DOB"
                readOnly
              />
            ) : (
              <div className="mt-1 text-sm text-gray-900">{formData.ageInYears}</div>
            )}
          </div>
          
          {/* Row 4: Place of birth( City ) | Place of birth( Country ) | Height( Cm ) */}
          <div>
            <Label className="text-xs text-gray-500 tracking-wide">Place of birth( City )</Label>
            {isEditing ? (
              <Input
                value={formData.placeOfBirthCity}
                onChange={(e) => updateFormData('placeOfBirthCity', e.target.value)}
                className="mt-1"
              />
            ) : (
              <div className="mt-1 text-sm text-gray-900">{formData.placeOfBirthCity}</div>
            )}
          </div>
          
          <div>
            <Label className="text-xs text-gray-500 tracking-wide">Place of birth( Country )</Label>
            {isEditing ? (
              <Select value={formData.placeOfBirthCountry} onValueChange={(value) => updateFormData('placeOfBirthCountry', value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {countryMasterData.map(country => (
                    <SelectItem key={country} value={country}>{country}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="mt-1 text-sm text-gray-900">{formData.placeOfBirthCountry}</div>
            )}
          </div>
          
          <div>
            <Label className="text-xs text-gray-500 tracking-wide">Height( Cm )</Label>
            {isEditing ? (
              <Input
                type="number"
                value={formData.heightCm}
                onChange={(e) => updateFormData('heightCm', e.target.value)}
                className="mt-1"
                min="100"
                max="250"
                placeholder="e.g. 175"
              />
            ) : (
              <div className="mt-1 text-sm text-gray-900">{formData.heightCm}</div>
            )}
          </div>
          
          {/* Row 5: Weight( kg ) | BMI (Auto Generated) | Native Language */}
          <div>
            <Label className="text-xs text-gray-500 tracking-wide">Weight( kg )</Label>
            {isEditing ? (
              <Input
                type="number"
                value={formData.weightKg}
                onChange={(e) => updateFormData('weightKg', e.target.value)}
                className="mt-1"
                min="40"
                max="200"
                placeholder="e.g. 75"
              />
            ) : (
              <div className="mt-1 text-sm text-gray-900">{formData.weightKg}</div>
            )}
          </div>
          
          <div>
            <Label className="text-xs text-gray-500 tracking-wide">BMI (Auto Generated)</Label>
            {isEditing ? (
              <Input
                value={formData.bmi}
                className="mt-1 bg-gray-50"
                placeholder="Auto-calculated from Height & Weight"
                readOnly
              />
            ) : (
              <div className="mt-1 text-sm text-gray-900">{formData.bmi}</div>
            )}
          </div>
          
          <div>
            <Label className="text-xs text-gray-500 tracking-wide">Native Language</Label>
            {isEditing ? (
              <Select value={formData.nativeLanguage} onValueChange={(value) => updateFormData('nativeLanguage', value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select native language" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {languageMasterData.map(language => (
                    <SelectItem key={language} value={language}>{language}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="mt-1 text-sm text-gray-900">{formData.nativeLanguage}</div>
            )}
          </div>
          
          {/* Row 6: Foreign Languages | English Proficiency | Manning Agent */}
          <div>
            <Label className="text-xs text-gray-500 tracking-wide">Foreign Languages</Label>
            {isEditing ? (
              <div className="relative">
                <Select 
                  value="" 
                  onValueChange={(value) => {
                    handleLanguageSelection('foreignLanguages', value);
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue>
                      {formData.foreignLanguages ? (
                        <div className="text-left">
                          <span className="text-sm">{formData.foreignLanguages}</span>
                          <div className="text-xs text-gray-500 mt-0.5">Click to add/remove languages</div>
                        </div>
                      ) : (
                        <span className="text-gray-500">Select foreign languages (multi-select)</span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]" onCloseAutoFocus={(e) => e.preventDefault()}>
                    {languageMasterData.map(language => {
                      const isSelected = isLanguageSelected('foreignLanguages', language);
                      return (
                        <SelectItem 
                          key={language} 
                          value={language} 
                          className={`cursor-pointer hover:bg-gray-50 ${isSelected ? "bg-blue-50" : ""}`}
                          onSelect={(e) => {
                            e.preventDefault();
                          }}
                        >
                          <div className="flex items-center gap-2 w-full">
                            <span className={`w-4 h-4 border rounded flex items-center justify-center text-xs ${
                              isSelected ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300'
                            }`}>
                              {isSelected && '✓'}
                            </span>
                            <span>{language}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {formData.foreignLanguages && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {formData.foreignLanguages.split(', ').map((lang, index) => (
                      <span key={index} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        {lang}
                        <button
                          type="button"
                          onClick={() => handleLanguageSelection('foreignLanguages', lang)}
                          className="hover:text-blue-600"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-1 text-sm text-gray-900">{formData.foreignLanguages}</div>
            )}
          </div>
          
          <div>
            <Label className="text-xs text-gray-500 tracking-wide">English Proficiency</Label>
            {isEditing ? (
              <Select value={formData.englishProficiency} onValueChange={(value) => updateFormData('englishProficiency', value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select proficiency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="None">None</SelectItem>
                  <SelectItem value="Basic">Basic</SelectItem>
                  <SelectItem value="Intermediate">Intermediate</SelectItem>
                  <SelectItem value="Fluent">Fluent</SelectItem>
                  <SelectItem value="Native">Native</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="mt-1 text-sm text-gray-900">{formData.englishProficiency}</div>
            )}
          </div>
          
          <div>
            <Label className="text-xs text-gray-500 tracking-wide">Manning Agent</Label>
            {isEditing ? (
              <Select value={formData.manningAgent} onValueChange={(value) => updateFormData('manningAgent', value)}>
                <SelectTrigger className="mt-1" data-testid="select-manning-agent-crew">
                  <SelectValue placeholder="Select manning agent" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {manningAgentOptions.map((agent: any) => (
                      <SelectItem key={agent.id} value={agent.name} data-testid={`manning-agent-crew-option-${agent.id}`}>
                        {agent.name}
                      </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="mt-1 text-sm text-gray-900">{formData.manningAgent}</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // B2 Address & Contact Info render function
  const renderA12AddressContact = () => {
    const isEditing = editingSections['B2'];
    
    return (
      <div ref={sectionB2Ref} className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>B2 Address & Contact Info</h3>
          {canEditCrewDatabase && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleEditSection('B2')}
            className="text-gray-500 hover:text-gray-700"
            data-testid="button-edit-b2"
          >
            <Edit className="h-4 w-4" />
          </Button>
          )}
        </div>
          
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label className="text-xs text-gray-500 tracking-wide">Country of Residence</Label>
            {isEditing ? (
              <Select value={formData.countryOfResidence} onValueChange={(value) => { setFormData(prev => ({ ...prev, countryOfResidence: value, mobile: applyDialingCode(value, prev.mobile) })); if (mobileError) setMobileError(''); }}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select country of residence" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {countryMasterData.map(country => (
                    <SelectItem key={country} value={country}>{country}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="mt-1 text-sm text-gray-900">{formData.countryOfResidence}</div>
            )}
          </div>
          
          <div>
            <Label className="text-xs text-gray-500 tracking-wide">Nearest Airport</Label>
            {isEditing ? (
              <Input
                value={formData.nearestAirport}
                onChange={(e) => updateFormData('nearestAirport', e.target.value)}
                className="mt-1"
              />
            ) : (
              <div className="mt-1 text-sm text-gray-900">{formData.nearestAirport}</div>
            )}
          </div>
          
          <div>
            <Label className="text-xs text-gray-500 tracking-wide">Residential Address Line 1</Label>
            {isEditing ? (
              <Input
                value={formData.residentialAddressLine1}
                onChange={(e) => updateFormData('residentialAddressLine1', e.target.value)}
                className="mt-1"
              />
            ) : (
              <div className="mt-1 text-sm text-gray-900">{formData.residentialAddressLine1}</div>
            )}
          </div>
          
          <div>
            <Label className="text-xs text-gray-500 tracking-wide">Residential Address Line 2</Label>
            {isEditing ? (
              <Input
                value={formData.residentialAddressLine2}
                onChange={(e) => updateFormData('residentialAddressLine2', e.target.value)}
                className="mt-1"
              />
            ) : (
              <div className="mt-1 text-sm text-gray-900">{formData.residentialAddressLine2}</div>
            )}
          </div>
          
          <div>
            <Label className="text-xs text-gray-500 tracking-wide">Contact ( Landline )</Label>
            {isEditing ? (
              <Input
                value={formData.contactLandline}
                onChange={(e) => updateFormData('contactLandline', e.target.value)}
                className="mt-1"
              />
            ) : (
              <div className="mt-1 text-sm text-gray-900">{formData.contactLandline}</div>
            )}
          </div>
          
          <div>
            <Label className="text-xs text-gray-500 tracking-wide">Mobile</Label>
            {isEditing ? (
              <Input
                value={formData.mobile}
                onChange={(e) => { const normalized = normalizeMobileInput(formData.countryOfResidence, e.target.value); updateFormData('mobile', normalized); if (mobileError) setMobileError(''); }}
                onBlur={() => { const trimmed = (formData.mobile || '').trim(); if (trimmed) { const err = validateMobileNumber(formData.countryOfResidence, trimmed); setMobileError(err || ''); } else { setMobileError(''); } }}
                className={`mt-1 ${mobileError ? 'border-red-500' : ''}`}
                data-testid="input-mobile"
              />
            ) : (
              <div className="mt-1 text-sm text-gray-900">{formData.mobile}</div>
            )}
            {mobileError && <p className="text-xs text-red-500 mt-1" data-testid="text-mobile-error">{mobileError}</p>}
          </div>
          
          <div>
            <Label className="text-xs text-gray-500 tracking-wide">Email</Label>
            {isEditing ? (
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => { updateFormData('email', e.target.value); if (emailError) setEmailError(''); }}
                onBlur={() => { setEmailError(validateEmail(formData.email || '')); }}
                className={`mt-1 ${emailError ? 'border-red-500' : ''}`}
                data-testid="input-email"
              />
            ) : (
              <div className="mt-1 text-sm text-gray-900">{formData.email}</div>
            )}
            {emailError && <p className="text-xs text-red-500 mt-1" data-testid="text-email-error">{emailError}</p>}
          </div>
        </div>
      </div>
    );
  };

  // B3 Family and NOK render function
  const renderA13FamilyNOK = () => {
    const isEditing = editingSections['B3'];
    
    return (
      <div ref={sectionB3Ref} className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>B3 Family and NOK</h3>
          {canEditCrewDatabase && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleEditSection('B3')}
            className="text-gray-500 hover:text-gray-700"
            data-testid="button-edit-b3"
          >
            <Edit className="h-4 w-4" />
          </Button>
          )}
        </div>
          
        <div className="space-y-6">
          {/* Basic Family Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">Marital Status</Label>
              {isEditing ? (
                <Select value={formData.maritalStatus} onValueChange={(value) => updateFormData('maritalStatus', value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Single">Single</SelectItem>
                    <SelectItem value="Married">Married</SelectItem>
                    <SelectItem value="Divorced">Divorced</SelectItem>
                    <SelectItem value="Widowed">Widowed</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="mt-1 text-sm text-gray-900">{formData.maritalStatus}</div>
              )}
            </div>
            
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">No. of Dependant Children</Label>
              {isEditing ? (
                <Input
                  value={formData.numberOfDependentChildren}
                  onChange={(e) => updateFormData('numberOfDependentChildren', e.target.value)}
                  className="mt-1"
                />
              ) : (
                <div className="mt-1 text-sm text-gray-900">{formData.numberOfDependentChildren}</div>
              )}
            </div>
            
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">Father's Name</Label>
              {isEditing ? (
                <Input
                  value={formData.fatherName}
                  onChange={(e) => updateFormData('fatherName', e.target.value)}
                  className="mt-1"
                />
              ) : (
                <div className="mt-1 text-sm text-gray-900">{formData.fatherName}</div>
              )}
            </div>
            
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">Mother's Name</Label>
              {isEditing ? (
                <Input
                  value={formData.motherName}
                  onChange={(e) => updateFormData('motherName', e.target.value)}
                  className="mt-1"
                />
              ) : (
                <div className="mt-1 text-sm text-gray-900">{formData.motherName}</div>
              )}
            </div>
          </div>

          {/* Spouse Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">Spouse First Name {formData.maritalStatus === 'Married' && <span className="text-red-500">*</span>}</Label>
              {isEditing ? (
                <Input
                  value={formData.spouseFirstName}
                  onChange={(e) => { updateFormData('spouseFirstName', e.target.value); if (spouseFirstNameError) setSpouseFirstNameError(''); if (spouseValidationError) setSpouseValidationError(''); }}
                  onBlur={() => { if (formData.maritalStatus === 'Married' && !(formData.spouseFirstName || '').trim()) setSpouseFirstNameError('Spouse first name is required.'); else setSpouseFirstNameError(''); }}
                  className={`mt-1 ${spouseFirstNameError ? 'border-red-500' : ''}`}
                  data-testid="input-spouse-first-name"
                />
              ) : (
                <div className="mt-1 text-sm text-gray-900">{formData.spouseFirstName}</div>
              )}
              {spouseFirstNameError && <p className="text-xs text-red-500 mt-1" data-testid="text-spouse-firstname-error">{spouseFirstNameError}</p>}
            </div>
            
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">Spouse Middle Name</Label>
              {isEditing ? (
                <Input
                  value={formData.spouseMiddleName}
                  onChange={(e) => updateFormData('spouseMiddleName', e.target.value)}
                  className="mt-1"
                />
              ) : (
                <div className="mt-1 text-sm text-gray-900">{formData.spouseMiddleName}</div>
              )}
            </div>
            
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">Spouse Family Name {formData.maritalStatus === 'Married' && <span className="text-red-500">*</span>}</Label>
              {isEditing ? (
                <Input
                  value={formData.spouseFamilyName}
                  onChange={(e) => { updateFormData('spouseFamilyName', e.target.value); if (spouseFamilyNameError) setSpouseFamilyNameError(''); if (spouseValidationError) setSpouseValidationError(''); }}
                  onBlur={() => { if (formData.maritalStatus === 'Married' && !(formData.spouseFamilyName || '').trim()) setSpouseFamilyNameError('Spouse family name is required.'); else setSpouseFamilyNameError(''); }}
                  className={`mt-1 ${spouseFamilyNameError ? 'border-red-500' : ''}`}
                  data-testid="input-spouse-family-name"
                />
              ) : (
                <div className="mt-1 text-sm text-gray-900">{formData.spouseFamilyName}</div>
              )}
              {spouseFamilyNameError && <p className="text-xs text-red-500 mt-1" data-testid="text-spouse-familyname-error">{spouseFamilyNameError}</p>}
            </div>
            
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">Spouse Date of Birth {formData.maritalStatus === 'Married' && <span className="text-red-500">*</span>}</Label>
              {isEditing ? (
                <FormattedDateInput
                  value={formData.spouseDateOfBirth}
                  onChange={(e) => { updateFormData('spouseDateOfBirth', e.target.value); if (spouseDobError) setSpouseDobError(''); if (spouseValidationError) setSpouseValidationError(''); }}
                  onBlur={() => { if (formData.maritalStatus === 'Married') { if (!(formData.spouseDateOfBirth || '').trim()) { setSpouseDobError('Spouse date of birth is required.'); } else if (formData.spouseDateOfBirth > todayStr) { setSpouseDobError('Spouse date of birth cannot be a future date.'); } else { setSpouseDobError(''); } } else { setSpouseDobError(''); } }}
                  className={`mt-1 ${spouseDobError ? 'border-red-500' : ''}`}
                  max={todayStr}
                  data-testid="input-spouse-dob"
                />
              ) : (
                <div className="mt-1 text-sm text-gray-900">{formatDate(formData.spouseDateOfBirth)}</div>
              )}
              {spouseDobError && <p className="text-xs text-red-500 mt-1" data-testid="text-spouse-dob-error">{spouseDobError}</p>}
            </div>
          </div>

          {/* Children Information */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <Label className="text-xs text-gray-500 tracking-wide">Children Information</Label>
              {isEditing && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addChild}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Child
                </Button>
              )}
            </div>
            
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">S.No</th>
                      <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">First Name</th>
                      <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Middle Name</th>
                      <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Family Name</th>
                      <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Date of Birth</th>
                      <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Gender</th>
                      {isEditing && <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {formData.children.map((child, index) => (
                      <tr key={index} className="border-t">
                        <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">{index + 1}.</td>
                        <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                          {isEditing ? (
                            <Input
                              value={child.firstName}
                              onChange={(e) => updateChild(index, 'firstName', e.target.value)}
                              className="border border-[#EAEBEF] bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                            />
                          ) : (
                            child.firstName
                          )}
                        </td>
                        <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                          {isEditing ? (
                            <Input
                              value={child.middleName}
                              onChange={(e) => updateChild(index, 'middleName', e.target.value)}
                              className="border border-[#EAEBEF] bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                            />
                          ) : (
                            child.middleName
                          )}
                        </td>
                        <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                          {isEditing ? (
                            <Input
                              value={child.familyName}
                              onChange={(e) => updateChild(index, 'familyName', e.target.value)}
                              className="border border-[#EAEBEF] bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                            />
                          ) : (
                            child.familyName
                          )}
                        </td>
                        <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                          {isEditing ? (
                            <FormattedDateInput
                              value={child.dateOfBirth}
                              onChange={(e) => updateChild(index, 'dateOfBirth', e.target.value)}
                              className="border border-[#EAEBEF] bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                            />
                          ) : (
                            formatDate(child.dateOfBirth)
                          )}
                        </td>
                        <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                          {isEditing ? (
                            <Select value={child.gender} onValueChange={(value) => updateChild(index, 'gender', value)}>
                              <SelectTrigger className="border border-[#EAEBEF] bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Male">Male</SelectItem>
                                <SelectItem value="Female">Female</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            child.gender
                          )}
                        </td>
                        {isEditing && (
                          <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                            <div className="flex gap-2 justify-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeChild(index)}
                                className="h-6 w-6"
                              >
                                <Trash2 className="h-[18px] w-[18px] text-gray-500" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* NOK Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">NOK: First Name</Label>
              {isEditing ? (
                <Input
                  value={formData.nokFirstName}
                  onChange={(e) => updateFormData('nokFirstName', e.target.value)}
                  className="mt-1"
                />
              ) : (
                <div className="mt-1 text-sm text-gray-900">{formData.nokFirstName}</div>
              )}
            </div>
            
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">NOK: Middle Name</Label>
              {isEditing ? (
                <Input
                  value={formData.nokMiddleName}
                  onChange={(e) => updateFormData('nokMiddleName', e.target.value)}
                  className="mt-1"
                />
              ) : (
                <div className="mt-1 text-sm text-gray-900">{formData.nokMiddleName}</div>
              )}
            </div>
            
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">NOK: Family Name</Label>
              {isEditing ? (
                <Input
                  value={formData.nokFamilyName}
                  onChange={(e) => updateFormData('nokFamilyName', e.target.value)}
                  className="mt-1"
                />
              ) : (
                <div className="mt-1 text-sm text-gray-900">{formData.nokFamilyName}</div>
              )}
            </div>
            
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">NOK: Relationship</Label>
              {isEditing ? (
                <Input
                  value={formData.nokRelationship}
                  onChange={(e) => updateFormData('nokRelationship', e.target.value)}
                  className="mt-1"
                />
              ) : (
                <div className="mt-1 text-sm text-gray-900">{formData.nokRelationship}</div>
              )}
            </div>
            
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">NOK: Telephone</Label>
              {isEditing ? (
                <Input
                  value={formData.nokTelephone}
                  onChange={(e) => updateFormData('nokTelephone', e.target.value)}
                  className="mt-1"
                />
              ) : (
                <div className="mt-1 text-sm text-gray-900">{formData.nokTelephone}</div>
              )}
            </div>
            
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">NOK: Email</Label>
              {isEditing ? (
                <Input
                  type="email"
                  value={formData.nokEmail}
                  onChange={(e) => { updateFormData('nokEmail', e.target.value); if (nokEmailError) setNokEmailError(''); }}
                  onBlur={() => { setNokEmailError(validateEmail(formData.nokEmail || '')); }}
                  className={`mt-1 ${nokEmailError ? 'border-red-500' : ''}`}
                  data-testid="input-nok-email"
                />
              ) : (
                <div className="mt-1 text-sm text-gray-900">{formData.nokEmail}</div>
              )}
              {nokEmailError && <p className="text-xs text-red-500 mt-1" data-testid="text-nokemail-error">{nokEmailError}</p>}
            </div>
            
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">NOK: Address</Label>
              {isEditing ? (
                <Input
                  value={formData.nokAddress}
                  onChange={(e) => updateFormData('nokAddress', e.target.value)}
                  className="mt-1"
                />
              ) : (
                <div className="mt-1 text-sm text-gray-900">{formData.nokAddress}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // C1 Travel and Identification Documents render function
  const renderA21TravelDocs = () => {
    return (
      <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>C1 Travel and Identification Docs</h3>
          {canEditSection('C') && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTravelDocDialogOpen(true)}
              className="text-gray-600 border-gray-300 hover:bg-gray-50"
              data-testid="button-add-travel-doc-from-db"
            >
              <Plus className="h-4 w-4 mr-2" />
              ADD FROM DATABASE
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={addDocument}
              className="text-gray-600 border-gray-300 hover:bg-gray-50"
              data-testid="button-add-travel-doc"
            >
              <Plus className="h-4 w-4 mr-2" />
              ADD
            </Button>
          </div>
          )}
        </div>
        
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-gray-100">
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Document <span className="text-red-500">*</span></TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Number</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Issued</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Expiry</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Issuing Authority</TableHead>
              {canEditSection('C') && <TableHead className="text-[#4f5863] text-[13px] font-medium p-3 w-24">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {formData.documents.map((doc) => (
              <TableRow key={doc.id} className="border-b border-gray-200">
                <TableCell className="p-3">
                  {doc.documentId ? (
                    <span className="text-[#4f5863] text-[13px]">{doc.document}</span>
                  ) : (
                    <Input
                      value={doc.document}
                      onChange={(e) => { updateDocument(doc.id, 'document', e.target.value); if (docRequiredErrors[doc.id]) setDocRequiredErrors(prev => { const n = {...prev}; delete n[doc.id]; return n; }); }}
                      onBlur={() => { if (!(doc.document || '').trim()) setDocRequiredErrors(prev => ({...prev, [doc.id]: 'Document name is required.'})); else setDocRequiredErrors(prev => { const n = {...prev}; delete n[doc.id]; return n; }); }}
                      className={`text-[#4f5863] text-[13px] border ${docRequiredErrors[doc.id] ? 'border-red-500' : 'border-[#EAEBEF]'} shadow-none p-0 h-auto`}
                    />
                  )}
                  {docRequiredErrors[doc.id] && <p className="text-xs text-red-500 mt-1">{docRequiredErrors[doc.id]}</p>}
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    value={doc.number}
                    onChange={(e) => updateDocument(doc.id, 'number', e.target.value)}
                    className="text-[#4f5863] text-[13px] border border-[#EAEBEF] shadow-none p-0 h-auto"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <FormattedDateInput
                    value={doc.issued}
                    onChange={(e) => { updateDocument(doc.id, 'issued', e.target.value); if (docDateErrors[doc.id]?.issued) setDocDateErrors(prev => { const n = {...prev}; if (n[doc.id]) { delete n[doc.id].issued; if (!n[doc.id].expiry) delete n[doc.id]; } return n; }); }}
                    onBlur={() => { const err = validateIssuedDate(doc.issued); if (err) setDocDateErrors(prev => ({...prev, [doc.id]: {...(prev[doc.id] || {}), issued: err}})); else setDocDateErrors(prev => { const n = {...prev}; if (n[doc.id]) { delete n[doc.id].issued; if (!n[doc.id].expiry) delete n[doc.id]; } return n; }); }}
                    max={todayStr}
                    className={`text-[#4f5863] text-[13px] border ${docDateErrors[doc.id]?.issued ? 'border-red-500' : 'border-[#EAEBEF]'} shadow-none p-0 h-auto`}
                  />
                  {docDateErrors[doc.id]?.issued && <p className="text-xs text-red-500 mt-1">{docDateErrors[doc.id].issued}</p>}
                </TableCell>
                <TableCell className="p-3">
                  <FormattedDateInput
                    value={doc.expiry}
                    onChange={(e) => { updateDocument(doc.id, 'expiry', e.target.value); if (docDateErrors[doc.id]?.expiry) setDocDateErrors(prev => { const n = {...prev}; if (n[doc.id]) { delete n[doc.id].expiry; if (!n[doc.id].issued) delete n[doc.id]; } return n; }); }}
                    onBlur={() => { const err = validateExpiryDate(doc.expiry, doc.issued); if (err) setDocDateErrors(prev => ({...prev, [doc.id]: {...(prev[doc.id] || {}), expiry: err}})); else setDocDateErrors(prev => { const n = {...prev}; if (n[doc.id]) { delete n[doc.id].expiry; if (!n[doc.id].issued) delete n[doc.id]; } return n; }); }}
                    min={doc.issued || undefined}
                    className={`${getExpiryColorClass(doc.expiry)} text-[13px] border ${docDateErrors[doc.id]?.expiry ? 'border-red-500' : 'border-[#EAEBEF]'} shadow-none p-0 h-auto`}
                  />
                  {docDateErrors[doc.id]?.expiry && <p className="text-xs text-red-500 mt-1">{docDateErrors[doc.id].expiry}</p>}
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    value={doc.issuingAuthority}
                    onChange={(e) => updateDocument(doc.id, 'issuingAuthority', e.target.value)}
                    className="text-[#4f5863] text-[13px] border border-[#EAEBEF] shadow-none p-0 h-auto"
                  />
                </TableCell>
                {canEditSection('C') && (
                <TableCell className="p-3">
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-gray-400 hover:text-blue-600 relative"
                      onClick={() => handleAttachmentClick('document', doc.id, doc.document || 'Document')}
                      data-testid={`button-attach-document-${doc.id}`}
                    >
                      <Paperclip className="h-3 w-3" />
                      {(doc.attachments?.length || 0) > 0 && (
                        <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] rounded-full h-3.5 w-3.5 flex items-center justify-center">
                          {doc.attachments?.length}
                        </span>
                      )}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-gray-400 hover:text-red-600"
                      onClick={() => removeDocument(doc.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  // C2 Visas render function
  const renderA22Visas = () => {
    return (
      <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>C2 Visas</h3>
          {canEditSection('C') && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsVisaDialogOpen(true)}
              className="text-gray-600 border-gray-300 hover:bg-gray-50"
              data-testid="button-add-visa-from-db"
            >
              <Plus className="h-4 w-4 mr-2" />
              ADD FROM DATABASE
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={addVisa}
              className="text-gray-600 border-gray-300 hover:bg-gray-50"
              data-testid="button-add-visa"
            >
              <Plus className="h-4 w-4 mr-2" />
              ADD
            </Button>
          </div>
          )}
        </div>
        
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-gray-100">
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Issuing Country <span className="text-red-500">*</span></TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">S.No.( If Applicable )</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Issued</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Expiry</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Visa Type <span className="text-red-500">*</span></TableHead>
              {canEditSection('C') && <TableHead className="text-[#4f5863] text-[13px] font-medium p-3 w-24">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {formData.visas.map((visa) => (
              <TableRow key={visa.id} className="border-b border-gray-200">
                <TableCell className="p-3">
                  {(visa.countryId || visa.visaUuid) ? (
                    <span className="text-[#4f5863] text-[13px]">{visa.issuingCountry}</span>
                  ) : (
                    <Input
                      value={visa.issuingCountry}
                      onChange={(e) => { updateVisa(visa.id, 'issuingCountry', e.target.value); if (visaRequiredErrors[visa.id]?.issuingCountry) setVisaRequiredErrors(prev => { const n = {...prev}; if (n[visa.id]) { delete n[visa.id].issuingCountry; if (!n[visa.id].visaType) delete n[visa.id]; } return n; }); }}
                      onBlur={() => { if (!(visa.issuingCountry || '').trim()) setVisaRequiredErrors(prev => ({...prev, [visa.id]: {...(prev[visa.id] || {}), issuingCountry: 'Issuing country is required.'}})); else setVisaRequiredErrors(prev => { const n = {...prev}; if (n[visa.id]) { delete n[visa.id].issuingCountry; if (!n[visa.id].visaType) delete n[visa.id]; } return n; }); }}
                      className={`text-[#4f5863] text-[13px] border ${visaRequiredErrors[visa.id]?.issuingCountry ? 'border-red-500' : 'border-[#EAEBEF]'} shadow-none p-0 h-auto`}
                    />
                  )}
                  {visaRequiredErrors[visa.id]?.issuingCountry && <p className="text-xs text-red-500 mt-1">{visaRequiredErrors[visa.id].issuingCountry}</p>}
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    value={visa.serialNo}
                    onChange={(e) => updateVisa(visa.id, 'serialNo', e.target.value)}
                    className="text-[#4f5863] text-[13px] border border-[#EAEBEF] shadow-none p-0 h-auto"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <FormattedDateInput
                    value={visa.issued}
                    onChange={(e) => { updateVisa(visa.id, 'issued', e.target.value); if (visaDateErrors[visa.id]?.issued) setVisaDateErrors(prev => { const n = {...prev}; if (n[visa.id]) { delete n[visa.id].issued; if (!n[visa.id].expiry) delete n[visa.id]; } return n; }); }}
                    onBlur={() => { const err = validateIssuedDate(visa.issued); if (err) setVisaDateErrors(prev => ({...prev, [visa.id]: {...(prev[visa.id] || {}), issued: err}})); else setVisaDateErrors(prev => { const n = {...prev}; if (n[visa.id]) { delete n[visa.id].issued; if (!n[visa.id].expiry) delete n[visa.id]; } return n; }); }}
                    max={todayStr}
                    className={`text-[#4f5863] text-[13px] border ${visaDateErrors[visa.id]?.issued ? 'border-red-500' : 'border-[#EAEBEF]'} shadow-none p-0 h-auto`}
                  />
                  {visaDateErrors[visa.id]?.issued && <p className="text-xs text-red-500 mt-1">{visaDateErrors[visa.id].issued}</p>}
                </TableCell>
                <TableCell className="p-3">
                  <FormattedDateInput
                    value={visa.expiry}
                    onChange={(e) => { updateVisa(visa.id, 'expiry', e.target.value); if (visaDateErrors[visa.id]?.expiry) setVisaDateErrors(prev => { const n = {...prev}; if (n[visa.id]) { delete n[visa.id].expiry; if (!n[visa.id].issued) delete n[visa.id]; } return n; }); }}
                    onBlur={() => { const err = validateExpiryDate(visa.expiry, visa.issued); if (err) setVisaDateErrors(prev => ({...prev, [visa.id]: {...(prev[visa.id] || {}), expiry: err}})); else setVisaDateErrors(prev => { const n = {...prev}; if (n[visa.id]) { delete n[visa.id].expiry; if (!n[visa.id].issued) delete n[visa.id]; } return n; }); }}
                    min={visa.issued || undefined}
                    className={`${getExpiryColorClass(visa.expiry)} text-[13px] border ${visaDateErrors[visa.id]?.expiry ? 'border-red-500' : 'border-[#EAEBEF]'} shadow-none p-0 h-auto`}
                  />
                  {visaDateErrors[visa.id]?.expiry && <p className="text-xs text-red-500 mt-1">{visaDateErrors[visa.id].expiry}</p>}
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    value={visa.visaType}
                    onChange={(e) => { updateVisa(visa.id, 'visaType', e.target.value); if (visaRequiredErrors[visa.id]?.visaType) setVisaRequiredErrors(prev => { const n = {...prev}; if (n[visa.id]) { delete n[visa.id].visaType; if (!n[visa.id].issuingCountry) delete n[visa.id]; } return n; }); }}
                    onBlur={() => { if (!(visa.visaType || '').trim()) setVisaRequiredErrors(prev => ({...prev, [visa.id]: {...(prev[visa.id] || {}), visaType: 'Visa type is required.'}})); else setVisaRequiredErrors(prev => { const n = {...prev}; if (n[visa.id]) { delete n[visa.id].visaType; if (!n[visa.id].issuingCountry) delete n[visa.id]; } return n; }); }}
                    className={`text-[#4f5863] text-[13px] border ${visaRequiredErrors[visa.id]?.visaType ? 'border-red-500' : 'border-[#EAEBEF]'} shadow-none p-0 h-auto`}
                  />
                  {visaRequiredErrors[visa.id]?.visaType && <p className="text-xs text-red-500 mt-1">{visaRequiredErrors[visa.id].visaType}</p>}
                </TableCell>
                {canEditSection('C') && (
                <TableCell className="p-3">
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-gray-400 hover:text-blue-600 relative"
                      onClick={() => handleAttachmentClick('visa', visa.id, visa.issuingCountry || 'Visa')}
                      data-testid={`button-attach-visa-${visa.id}`}
                    >
                      <Paperclip className="h-3 w-3" />
                      {(visa.attachments?.length || 0) > 0 && (
                        <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] rounded-full h-3.5 w-3.5 flex items-center justify-center">
                          {visa.attachments?.length}
                        </span>
                      )}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-gray-400 hover:text-red-600"
                      onClick={() => removeVisa(visa.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  // D1 Education render function
  const renderA31Education = () => {
    return (
      <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>D1 Education</h3>
          {canEditSection('D') && (
          <Button
            variant="outline"
            size="sm"
            onClick={addEducation}
            className="text-gray-600 border-gray-300 hover:bg-gray-50"
            data-testid="button-add-education"
          >
            <Plus className="h-4 w-4 mr-2" />
            ADD
          </Button>
          )}
        </div>
        
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-gray-100">
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Qualifications <span className="text-red-500">*</span></TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Subjects/Field</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">School/College/University</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Date of Completion</TableHead>
              {canEditSection('D') && <TableHead className="text-[#4f5863] text-[13px] font-medium p-3 w-24">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {formData.education.map((edu) => (
              <TableRow key={edu.id} className="border-b border-gray-200">
                <TableCell className="p-3">
                  <Input
                    value={edu.qualifications}
                    onChange={(e) => { updateEducation(edu.id, 'qualifications', e.target.value); if (eduRequiredErrors[edu.id]) setEduRequiredErrors(prev => { const n = {...prev}; delete n[edu.id]; return n; }); }}
                    onBlur={() => { if (!(edu.qualifications || '').trim()) setEduRequiredErrors(prev => ({...prev, [edu.id]: 'Qualifications is required.'})); else setEduRequiredErrors(prev => { const n = {...prev}; delete n[edu.id]; return n; }); }}
                    className={`text-[#4f5863] text-[13px] border ${eduRequiredErrors[edu.id] ? 'border-red-500' : 'border-[#EAEBEF]'} shadow-none p-0 h-auto`}
                  />
                  {eduRequiredErrors[edu.id] && <p className="text-xs text-red-500 mt-1">{eduRequiredErrors[edu.id]}</p>}
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    value={edu.subjectsField}
                    onChange={(e) => updateEducation(edu.id, 'subjectsField', e.target.value)}
                    className="text-[#4f5863] text-[13px] border border-[#EAEBEF] shadow-none p-0 h-auto"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    value={edu.schoolCollegeUniversity}
                    onChange={(e) => updateEducation(edu.id, 'schoolCollegeUniversity', e.target.value)}
                    className="text-[#4f5863] text-[13px] border border-[#EAEBEF] shadow-none p-0 h-auto"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <FormattedDateInput
                    value={edu.dateOfCompletion}
                    onChange={(e) => updateEducation(edu.id, 'dateOfCompletion', e.target.value)}
                    className="text-[#4f5863] text-[13px] border border-[#EAEBEF] shadow-none p-0 h-auto"
                  />
                </TableCell>
                {canEditSection('D') && (
                <TableCell className="p-3">
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-gray-400 hover:text-blue-600 relative"
                      onClick={() => handleAttachmentClick('education', edu.id, edu.qualifications || 'Education')}
                      data-testid={`button-attach-education-${edu.id}`}
                    >
                      <Paperclip className="h-3 w-3" />
                      {(edu.attachments?.length || 0) > 0 && (
                        <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] rounded-full h-3.5 w-3.5 flex items-center justify-center">
                          {edu.attachments?.length}
                        </span>
                      )}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-gray-400 hover:text-red-600"
                      onClick={() => removeEducation(edu.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  // D2 License & DCE render function
  const renderA32LicenseDCE = () => {
    return (
      <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>D2 License & DCE</h3>
          {canEditSection('D') && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsLicenseDialogOpen(true)}
              className="text-gray-600 border-gray-300 hover:bg-gray-50 text-xs"
              data-testid="button-add-license-from-database"
            >
              + ADD FROM DATABASE
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={addLicense}
              className="text-gray-600 border-gray-300 hover:bg-gray-50"
              data-testid="button-add-license"
            >
              <Plus className="h-4 w-4 mr-2" />
              ADD
            </Button>
          </div>
          )}
        </div>
        
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-gray-100">
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3 w-20">ID</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Certificate/Document <span className="text-red-500">*</span></TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Abbr</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Requirement</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Certificate No</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Issuing Authority</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Issued</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Expiry</TableHead>
              {canEditSection('D') && <TableHead className="text-[#4f5863] text-[13px] font-medium p-3 w-24">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {formData.licenses.map((license) => (
              <TableRow 
                key={license.id} 
                className={`border-b border-gray-200 ${license.archivedAt ? 'bg-gray-50 opacity-60' : ''}`}
              >
                <TableCell className="p-3">
                  <div className="flex items-center gap-1">
                    <span className="text-[#4f5863] text-[13px] font-mono">
                      {license.licenseId || '-'}
                    </span>
                    {license.archivedAt && (
                      <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                        ARCHIVED
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="p-3">
                  {license.fromDatabase ? (
                    <span className="text-[#4f5863] text-[13px]">{license.certificateDocument}</span>
                  ) : (
                    <Input
                      value={license.certificateDocument}
                      onChange={(e) => { updateLicense(license.id, 'certificateDocument', e.target.value); if (licRequiredErrors[license.id]) setLicRequiredErrors(prev => { const n = {...prev}; delete n[license.id]; return n; }); }}
                      onBlur={() => { if (!(license.certificateDocument || '').trim()) setLicRequiredErrors(prev => ({...prev, [license.id]: 'Certificate/Document is required.'})); else setLicRequiredErrors(prev => { const n = {...prev}; delete n[license.id]; return n; }); }}
                      className={`text-[#4f5863] text-[13px] border ${licRequiredErrors[license.id] ? 'border-red-500' : 'border-[#EAEBEF]'} shadow-none p-0 h-auto`}
                      disabled={!!license.archivedAt}
                    />
                  )}
                  {licRequiredErrors[license.id] && <p className="text-xs text-red-500 mt-1">{licRequiredErrors[license.id]}</p>}
                </TableCell>
                <TableCell className="p-3">
                  {license.fromDatabase ? (
                    <span className="text-[#4f5863] text-[13px]">{license.abbr}</span>
                  ) : (
                    <Input
                      value={license.abbr}
                      onChange={(e) => updateLicense(license.id, 'abbr', e.target.value)}
                      className="text-[#4f5863] text-[13px] border border-[#EAEBEF] shadow-none p-0 h-auto"
                    />
                  )}
                </TableCell>
                <TableCell className="p-3">
                  {license.fromDatabase ? (
                    <span className="text-[#4f5863] text-[13px]">{license.requirement}</span>
                  ) : (
                    <Input
                      value={license.requirement}
                      onChange={(e) => updateLicense(license.id, 'requirement', e.target.value)}
                      className="text-[#4f5863] text-[13px] border border-[#EAEBEF] shadow-none p-0 h-auto"
                    />
                  )}
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    value={license.certificateNo}
                    onChange={(e) => updateLicense(license.id, 'certificateNo', e.target.value)}
                    className="text-[#4f5863] text-[13px] border border-[#EAEBEF] shadow-none p-0 h-auto"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <Select 
                    value={license.issuingAuthority} 
                    onValueChange={(value) => updateLicense(license.id, 'issuingAuthority', value)}
                  >
                    <SelectTrigger className="text-[#4f5863] text-[13px] border border-[#EAEBEF] shadow-none p-0 h-auto">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {license.issuingAuthority && !countryMasterData.includes(license.issuingAuthority) && (
                        <SelectItem key={license.issuingAuthority} value={license.issuingAuthority}>{license.issuingAuthority}</SelectItem>
                      )}
                      {countryMasterData.map(country => (
                        <SelectItem key={country} value={country}>{country}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="p-3">
                  <FormattedDateInput
                    value={license.issued}
                    onChange={(e) => { updateLicense(license.id, 'issued', e.target.value); if (licDateErrors[license.id]?.issued) setLicDateErrors(prev => { const n = {...prev}; if (n[license.id]) { delete n[license.id].issued; if (!n[license.id].expiry) delete n[license.id]; } return n; }); }}
                    onBlur={() => { const err = validateIssuedDate(license.issued); if (err) setLicDateErrors(prev => ({...prev, [license.id]: {...(prev[license.id] || {}), issued: err}})); else setLicDateErrors(prev => { const n = {...prev}; if (n[license.id]) { delete n[license.id].issued; if (!n[license.id].expiry) delete n[license.id]; } return n; }); }}
                    max={todayStr}
                    className={`text-[#4f5863] text-[13px] border ${licDateErrors[license.id]?.issued ? 'border-red-500' : 'border-[#EAEBEF]'} shadow-none p-0 h-auto`}
                  />
                  {licDateErrors[license.id]?.issued && <p className="text-xs text-red-500 mt-1">{licDateErrors[license.id].issued}</p>}
                </TableCell>
                <TableCell className="p-3">
                  <FormattedDateInput
                    value={license.expiry}
                    onChange={(e) => { updateLicense(license.id, 'expiry', e.target.value); if (licDateErrors[license.id]?.expiry) setLicDateErrors(prev => { const n = {...prev}; if (n[license.id]) { delete n[license.id].expiry; if (!n[license.id].issued) delete n[license.id]; } return n; }); }}
                    onBlur={() => { const err = validateExpiryDate(license.expiry, license.issued); if (err) setLicDateErrors(prev => ({...prev, [license.id]: {...(prev[license.id] || {}), expiry: err}})); else setLicDateErrors(prev => { const n = {...prev}; if (n[license.id]) { delete n[license.id].expiry; if (!n[license.id].issued) delete n[license.id]; } return n; }); }}
                    min={license.issued || undefined}
                    className={`${getExpiryColorClass(license.expiry)} text-[13px] border ${licDateErrors[license.id]?.expiry ? 'border-red-500' : 'border-[#EAEBEF]'} shadow-none p-0 h-auto`}
                  />
                  {licDateErrors[license.id]?.expiry && <p className="text-xs text-red-500 mt-1">{licDateErrors[license.id].expiry}</p>}
                </TableCell>
                {canEditSection('D') && (
                <TableCell className="p-3">
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-gray-400 hover:text-blue-600 relative"
                      onClick={() => handleAttachmentClick('license', license.id, license.certificateDocument || 'License')}
                      data-testid={`button-attach-license-${license.id}`}
                    >
                      <Paperclip className="h-3 w-3" />
                      {(license.attachments?.length || 0) > 0 && (
                        <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] rounded-full h-3.5 w-3.5 flex items-center justify-center">
                          {license.attachments?.length}
                        </span>
                      )}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-gray-400 hover:text-red-600"
                      onClick={() => removeLicense(license.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  // D3 Training Courses render function
  const renderA33TrainingCourse = () => {
    return (
      <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>D3 Training Course</h3>
          {canEditSection('D') && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTrainingDialogOpen(true)}
              className="text-gray-600 border-gray-300 hover:bg-gray-50 text-xs"
              data-testid="button-add-training-from-database"
            >
              + ADD FROM DATABASE
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={addTrainingCourse}
              className="text-gray-600 border-gray-300 hover:bg-gray-50"
              data-testid="button-add-training-course"
            >
              <Plus className="h-4 w-4 mr-2" />
              ADD
            </Button>
          </div>
          )}
        </div>
        
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-gray-100">
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Company ID</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Training Course <span className="text-red-500">*</span></TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Abbr</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Requirement</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Certificate No</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Issuing Authority</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Issued</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Expiry</TableHead>
              {canEditSection('D') && <TableHead className="text-[#4f5863] text-[13px] font-medium p-3 w-24">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...formData.trainingCourses]
              .sort((a, b) => {
                const aOrder = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
                const bOrder = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
                return aOrder - bOrder;
              })
              .map((course) => (
              <TableRow key={course.id} className="border-b border-gray-200">
                <TableCell className="p-3">
                  <div className="text-[#4f5863] text-[13px] font-mono">{course.courseId || '-'}</div>
                </TableCell>
                <TableCell className="p-3">
                  {course.fromDatabase ? (
                    <span className="text-[#4f5863] text-[13px]">{course.trainingCourse}</span>
                  ) : (
                    <Input
                      value={course.trainingCourse}
                      onChange={(e) => { updateTrainingCourse(course.id, 'trainingCourse', e.target.value); if (trainRequiredErrors[course.id]) setTrainRequiredErrors(prev => { const n = {...prev}; delete n[course.id]; return n; }); }}
                      onBlur={() => { if (!(course.trainingCourse || '').trim()) setTrainRequiredErrors(prev => ({...prev, [course.id]: 'Training course is required.'})); else setTrainRequiredErrors(prev => { const n = {...prev}; delete n[course.id]; return n; }); }}
                      className={`text-[#4f5863] text-[13px] border ${trainRequiredErrors[course.id] ? 'border-red-500' : 'border-[#EAEBEF]'} shadow-none p-0 h-auto`}
                    />
                  )}
                  {trainRequiredErrors[course.id] && <p className="text-xs text-red-500 mt-1">{trainRequiredErrors[course.id]}</p>}
                </TableCell>
                <TableCell className="p-3">
                  {course.fromDatabase ? (
                    <span className="text-[#4f5863] text-[13px]">{course.abbr}</span>
                  ) : (
                    <Input
                      value={course.abbr}
                      onChange={(e) => updateTrainingCourse(course.id, 'abbr', e.target.value)}
                      className="text-[#4f5863] text-[13px] border border-[#EAEBEF] shadow-none p-0 h-auto"
                    />
                  )}
                </TableCell>
                <TableCell className="p-3">
                  {course.fromDatabase ? (
                    <span className="text-[#4f5863] text-[13px]">{course.requirement}</span>
                  ) : (
                    <Input
                      value={course.requirement}
                      onChange={(e) => updateTrainingCourse(course.id, 'requirement', e.target.value)}
                      className="text-[#4f5863] text-[13px] border border-[#EAEBEF] shadow-none p-0 h-auto"
                    />
                  )}
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    value={course.certificateNo}
                    onChange={(e) => updateTrainingCourse(course.id, 'certificateNo', e.target.value)}
                    className="text-[#4f5863] text-[13px] border border-[#EAEBEF] shadow-none p-0 h-auto"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    value={course.issuingAuthority}
                    onChange={(e) => updateTrainingCourse(course.id, 'issuingAuthority', e.target.value)}
                    className="text-[#4f5863] text-[13px] border border-[#EAEBEF] shadow-none p-0 h-auto"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <FormattedDateInput
                    value={course.issued}
                    onChange={(e) => { updateTrainingCourse(course.id, 'issued', e.target.value); if (trainDateErrors[course.id]?.issued) setTrainDateErrors(prev => { const n = {...prev}; if (n[course.id]) { delete n[course.id].issued; if (!n[course.id].expiry) delete n[course.id]; } return n; }); }}
                    onBlur={() => { const err = validateIssuedDate(course.issued); if (err) setTrainDateErrors(prev => ({...prev, [course.id]: {...(prev[course.id] || {}), issued: err}})); else setTrainDateErrors(prev => { const n = {...prev}; if (n[course.id]) { delete n[course.id].issued; if (!n[course.id].expiry) delete n[course.id]; } return n; }); }}
                    max={todayStr}
                    className={`text-[#4f5863] text-[13px] border ${trainDateErrors[course.id]?.issued ? 'border-red-500' : 'border-[#EAEBEF]'} shadow-none p-0 h-auto`}
                  />
                  {trainDateErrors[course.id]?.issued && <p className="text-xs text-red-500 mt-1">{trainDateErrors[course.id].issued}</p>}
                </TableCell>
                <TableCell className="p-3">
                  <FormattedDateInput
                    value={course.expiry}
                    onChange={(e) => { updateTrainingCourse(course.id, 'expiry', e.target.value); if (trainDateErrors[course.id]?.expiry) setTrainDateErrors(prev => { const n = {...prev}; if (n[course.id]) { delete n[course.id].expiry; if (!n[course.id].issued) delete n[course.id]; } return n; }); }}
                    onBlur={() => { const err = validateExpiryDate(course.expiry, course.issued); if (err) setTrainDateErrors(prev => ({...prev, [course.id]: {...(prev[course.id] || {}), expiry: err}})); else setTrainDateErrors(prev => { const n = {...prev}; if (n[course.id]) { delete n[course.id].expiry; if (!n[course.id].issued) delete n[course.id]; } return n; }); }}
                    min={course.issued || undefined}
                    className={`${getExpiryColorClass(course.expiry)} text-[13px] border ${trainDateErrors[course.id]?.expiry ? 'border-red-500' : 'border-[#EAEBEF]'} shadow-none p-0 h-auto`}
                  />
                  {trainDateErrors[course.id]?.expiry && <p className="text-xs text-red-500 mt-1">{trainDateErrors[course.id].expiry}</p>}
                </TableCell>
                {canEditSection('D') && (
                <TableCell className="p-3">
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-gray-400 hover:text-blue-600 relative"
                      onClick={() => handleAttachmentClick('training', course.id, course.trainingCourse || 'Training')}
                      data-testid={`button-attach-training-${course.id}`}
                    >
                      <Paperclip className="h-3 w-3" />
                      {(course.attachments?.length || 0) > 0 && (
                        <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] rounded-full h-3.5 w-3.5 flex items-center justify-center">
                          {course.attachments?.length}
                        </span>
                      )}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-gray-400 hover:text-red-600"
                      onClick={() => removeTrainingCourse(course.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  // E1: Current Company Sea Service render function
  const renderE1CurrentCompanySeaService = () => {
    return (
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>E1. Details of Sea Service (Company)</h3>
          {canEditSection('E') && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCurrentCompanySeaService}
            className="flex items-center gap-2"
            data-testid="button-add-current-service"
          >
            <Plus className="h-4 w-4" />
            ADD
          </Button>
          )}
        </div>
        
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Vessel Name <span className="text-red-500">*</span></th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Vessel Type <span className="text-red-500">*</span></th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Deadweight</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Engine Type/ Power</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Owner / operator</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Rank <span className="text-red-500">*</span></th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">From <span className="text-red-500">*</span></th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">To <span className="text-red-500">*</span></th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Period(M)</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Experience</th>
                  {canEditSection('E') && <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left w-24">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {formData.currentCompanySeaService.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-gray-500">
                      No current company sea service records added yet. Click "ADD" to get started.
                    </td>
                  </tr>
                ) : (
                  [...formData.currentCompanySeaService]
                    .sort((a, b) => {
                      // Sort by latest dates first (To date, then From date)
                      const aDate = a.to || a.from || '';
                      const bDate = b.to || b.from || '';
                      return bDate.localeCompare(aDate);
                    })
                    .map((service) => {
                      const isVesselSynced = !!(service as any).isVesselSynced;
                      return (
                    <tr key={service.id} className={`border-t${isVesselSynced ? ' bg-blue-50/30' : ''}`}>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        {isVesselSynced ? (
                          <div className="flex items-center gap-1">
                            <span className="text-[13px] text-[#4f5863]">{service.vesselName || '—'}</span>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-blue-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.61 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M12 10v4"/><path d="M12 2v3"/></svg>
                                </TooltipTrigger>
                                <TooltipContent><p>Auto-synced from Vessel tab</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        ) : (
                          <Select
                            value={service.vesselCode}
                            onValueChange={(value) => {
                              const selectedVessel = vesselOptions.find(v => v.code === value);
                              updateCurrentCompanySeaService(service.id, 'vesselCode', value);
                              updateCurrentCompanySeaService(service.id, 'vesselName', selectedVessel?.name || '');
                              if (selectedVessel?.vtuid) {
                                const vesselTypeName = vesselTypeIdToNameMap.get(selectedVessel.vtuid);
                                if (vesselTypeName) {
                                  updateCurrentCompanySeaService(service.id, 'vesselType', vesselTypeName);
                                }
                              }
                              if (seaServiceRequiredErrors[service.id]?.vesselName && selectedVessel?.name) setSeaServiceRequiredErrors(prev => { const n = { ...prev }; if (n[service.id]) { const { vesselName: _, ...rest } = n[service.id]; n[service.id] = rest; } return n; });
                              setTimeout(() => validateSeaServiceFieldOnBlur(service.id, { ...service, vesselCode: value, vesselName: selectedVessel?.name || '', vesselType: selectedVessel?.vtuid ? (vesselTypeIdToNameMap.get(selectedVessel.vtuid) || service.vesselType) : service.vesselType }), 0);
                            }}
                          >
                            <SelectTrigger className={`border ${seaServiceRequiredErrors[service.id]?.vesselName ? 'border-red-500' : 'border-[#EAEBEF]'} bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6`}>
                              <SelectValue placeholder="Select vessel">
                                {service.vesselName || "Select vessel"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {vesselsLoading ? (
                                <SelectItem value="loading" disabled>Loading vessels...</SelectItem>
                              ) : vesselOptions.length === 0 ? (
                                <SelectItem value="empty" disabled>No vessels available</SelectItem>
                              ) : (
                                vesselOptions.map((vessel) => (
                                  <SelectItem key={vessel.code} value={vessel.code}>
                                    {vessel.name}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        )}
                        {seaServiceRequiredErrors[service.id]?.vesselName && <p className="text-xs text-red-500 mt-1">{seaServiceRequiredErrors[service.id].vesselName}</p>}
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        {isVesselSynced ? (
                          <span className="text-[13px] text-[#4f5863]">{service.vesselType || '—'}</span>
                        ) : (
                          <Select
                            value={service.vesselType}
                            onValueChange={(value) => { updateCurrentCompanySeaService(service.id, 'vesselType', value); if (seaServiceRequiredErrors[service.id]?.vesselType) setSeaServiceRequiredErrors(prev => { const n = { ...prev }; if (n[service.id]) { const { vesselType: _, ...rest } = n[service.id]; n[service.id] = rest; } return n; }); setTimeout(() => validateSeaServiceFieldOnBlur(service.id, { ...service, vesselType: value }), 0); }}
                          >
                            <SelectTrigger className={`border ${seaServiceRequiredErrors[service.id]?.vesselType ? 'border-red-500' : 'border-[#EAEBEF]'} bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6`}>
                              <SelectValue placeholder="Select vessel type" />
                            </SelectTrigger>
                            <SelectContent>
                              {vesselTypeMasterData.map((vesselType) => (
                                <SelectItem key={vesselType} value={vesselType}>
                                  {vesselType}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {seaServiceRequiredErrors[service.id]?.vesselType && <p className="text-xs text-red-500 mt-1">{seaServiceRequiredErrors[service.id].vesselType}</p>}
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Input
                          value={service.deadweight}
                          onChange={(e) => updateCurrentCompanySeaService(service.id, 'deadweight', e.target.value)}
                          className="border border-[#EAEBEF] bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                          placeholder="Enter deadweight"
                        />
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Input
                          value={service.engineTypePower}
                          onChange={(e) => updateCurrentCompanySeaService(service.id, 'engineTypePower', e.target.value)}
                          className="border border-[#EAEBEF] bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                          placeholder="Enter engine type/power"
                        />
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Input
                          value={service.ownerOperator}
                          onChange={(e) => updateCurrentCompanySeaService(service.id, 'ownerOperator', e.target.value)}
                          className="border border-[#EAEBEF] bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                          placeholder="Enter owner/operator"
                        />
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        {isVesselSynced ? (
                          <span className="text-[13px] text-[#4f5863]">{service.rank || '—'}</span>
                        ) : (
                          <Select
                            value={service.rank}
                            onValueChange={(value) => { updateCurrentCompanySeaService(service.id, 'rank', value); if (seaServiceRequiredErrors[service.id]?.rank) setSeaServiceRequiredErrors(prev => { const n = { ...prev }; if (n[service.id]) { const { rank: _, ...rest } = n[service.id]; n[service.id] = rest; } return n; }); setTimeout(() => validateSeaServiceFieldOnBlur(service.id, { ...service, rank: value }), 0); }}
                          >
                            <SelectTrigger className={`border ${seaServiceRequiredErrors[service.id]?.rank ? 'border-red-500' : 'border-[#EAEBEF]'} bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6`}>
                              <SelectValue placeholder="Select rank" />
                            </SelectTrigger>
                            <SelectContent>
                              {ranksLoading ? (
                                <SelectItem value="loading" disabled>Loading ranks...</SelectItem>
                              ) : ranksError ? (
                                <SelectItem value="error" disabled>Failed to load ranks</SelectItem>
                              ) : rankOptions.length === 0 ? (
                                <SelectItem value="empty" disabled>No ranks available</SelectItem>
                              ) : (
                                rankOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        )}
                        {seaServiceRequiredErrors[service.id]?.rank && <p className="text-xs text-red-500 mt-1">{seaServiceRequiredErrors[service.id].rank}</p>}
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        {isVesselSynced ? (
                          <span className="text-[13px] text-[#4f5863]">{service.from ? formatDate(service.from) : '—'}</span>
                        ) : (
                          <FormattedDateInput
                            value={service.from}
                            onChange={(e) => { updateCurrentCompanySeaService(service.id, 'from', e.target.value); if (seaServiceRequiredErrors[service.id]?.from && e.target.value) setSeaServiceRequiredErrors(prev => { const n = { ...prev }; if (n[service.id]) { const { from: _, ...rest } = n[service.id]; n[service.id] = rest; } return n; }); }}
                            onBlur={(e) => { runSeaServiceOverlapCheck(); validateSeaServiceFieldOnBlur(service.id, { ...service, from: e.target.value }); }}
                            className={`border ${seaServiceRequiredErrors[service.id]?.from ? 'border-red-500' : 'border-[#EAEBEF]'} bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6`}
                          />
                        )}
                        {seaServiceRequiredErrors[service.id]?.from && <p className="text-xs text-red-500 mt-1">{seaServiceRequiredErrors[service.id].from}</p>}
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        {(() => {
                          const isManualRow = !(service as any).seaUuid;
                          const isActiveContract = !isManualRow && (!service.to || service.to === '' || (service as any).isActive === true);
                          
                          // Use shared date utility for consistent date across frontend and backend
                          const todayDate = formatDateToISO(getReportingDate());
                          
                          if (isActiveContract) {
                            // Active contract: show today's date in blue with tooltip (read-only)
                            return (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div 
                                      className="border-0 bg-transparent p-0 text-[13px] font-normal h-6 cursor-default" 
                                      style={{ color: '#3b82f6' }}
                                      data-testid={`date-to-active-${service.id}`}
                                    >
                                      {formatDate(todayDate)}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Currently on board</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          } else {
                            // Completed contract: show normal 'to' date
                            return (
                              <FormattedDateInput
                                value={service.to}
                                onChange={(e) => { updateCurrentCompanySeaService(service.id, 'to', e.target.value); if (seaServiceRequiredErrors[service.id]?.to && e.target.value) setSeaServiceRequiredErrors(prev => { const n = { ...prev }; if (n[service.id]) { const { to: _, ...rest } = n[service.id]; n[service.id] = rest; } return n; }); }}
                                onBlur={(e) => { runSeaServiceOverlapCheck(); validateSeaServiceFieldOnBlur(service.id, { ...service, to: e.target.value }); }}
                                className={`border ${(seaServiceRequiredErrors[service.id]?.to || seaServiceDateErrors[service.id || (service as any).seaUuid]) ? 'border-red-500' : 'border-[#EAEBEF]'} bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6`}
                                data-testid={`input-date-to-${service.id}`}
                              />
                            );
                          }
                        })()}
                        {seaServiceRequiredErrors[service.id]?.to && <p className="text-xs text-red-500 mt-1">{seaServiceRequiredErrors[service.id].to}</p>}
                        {!seaServiceRequiredErrors[service.id]?.to && seaServiceDateErrors[service.id || (service as any).seaUuid] && <p className="text-xs text-red-500 mt-1" data-testid={`text-e1-to-error-${service.id}`}>{seaServiceDateErrors[service.id || (service as any).seaUuid]}</p>}
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        {(() => {
                          const isManualRow2 = !(service as any).seaUuid;
                          const isActiveContract = !isManualRow2 && (!service.to || service.to === '' || (service as any).isActive === true);
                          
                          let displayPeriod = service.periodMonths;
                          
                          if (isActiveContract && service.from) {
                            // Calculate dynamic period for active contracts using shared date utility
                            const from = new Date(service.from);
                            const to = getReportingDate();
                            if (!isNaN(from.getTime()) && to >= from) {
                              const timeDiff = to.getTime() - from.getTime();
                              const totalDays = timeDiff / (1000 * 60 * 60 * 24);
                              const months = Math.max(0, totalDays / 30.44);
                              displayPeriod = months.toFixed(1);
                            }
                          }
                          
                          return (
                            <Input
                              value={displayPeriod}
                              readOnly
                              className={`border-0 bg-gray-50 p-0 focus-visible:ring-0 text-[13px] font-normal h-6 cursor-not-allowed ${isActiveContract ? 'text-blue-600' : 'text-[#4f5863]'}`}
                              title={isActiveContract ? "Auto-calculated based on sign-on date to today" : "Auto-calculated based on From & To dates"}
                              data-testid={`input-period-months-${service.id}`}
                            />
                          );
                        })()}
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        {service.vesselType === 'Oil Chemical Tanker' ? (
                          <div className="flex flex-col gap-1">
                            <label className="flex items-center gap-1 text-[11px]">
                              <Checkbox
                                checked={(service.experienceCategories || ['oil', 'chemical']).includes('oil')}
                                onCheckedChange={(checked) => {
                                  const current = service.experienceCategories || ['oil', 'chemical'];
                                  let newCategories: string[];
                                  if (checked) {
                                    newCategories = [...current, 'oil'].filter((v, i, a) => a.indexOf(v) === i);
                                  } else {
                                    if (current.filter(c => c !== 'oil').length === 0) return;
                                    newCategories = current.filter(c => c !== 'oil');
                                  }
                                  setFormData(prev => ({
                                    ...prev,
                                    currentCompanySeaService: prev.currentCompanySeaService.map(s =>
                                      s.id === service.id ? { ...s, experienceCategories: newCategories } : s
                                    )
                                  }));
                                }}
                                className="h-3 w-3"
                              />
                              <span>Oil</span>
                            </label>
                            <label className="flex items-center gap-1 text-[11px]">
                              <Checkbox
                                checked={(service.experienceCategories || ['oil', 'chemical']).includes('chemical')}
                                onCheckedChange={(checked) => {
                                  const current = service.experienceCategories || ['oil', 'chemical'];
                                  let newCategories: string[];
                                  if (checked) {
                                    newCategories = [...current, 'chemical'].filter((v, i, a) => a.indexOf(v) === i);
                                  } else {
                                    if (current.filter(c => c !== 'chemical').length === 0) return;
                                    newCategories = current.filter(c => c !== 'chemical');
                                  }
                                  setFormData(prev => ({
                                    ...prev,
                                    currentCompanySeaService: prev.currentCompanySeaService.map(s =>
                                      s.id === service.id ? { ...s, experienceCategories: newCategories } : s
                                    )
                                  }));
                                }}
                                className="h-3 w-3"
                              />
                              <span>Chemical</span>
                            </label>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-[11px]">—</span>
                        )}
                      </td>
                      {canEditSection('E') && (
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-gray-400 hover:text-blue-600 relative"
                            onClick={() => handleAttachmentClick('currentSeaService', service.id, service.vesselName || 'Sea Service')}
                            data-testid={`button-attach-current-service-${service.id}`}
                          >
                            <Paperclip className="h-3 w-3" />
                            {(service.attachments?.length || 0) > 0 && (
                              <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] rounded-full h-3.5 w-3.5 flex items-center justify-center">
                                {service.attachments?.length}
                              </span>
                            )}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className={`h-6 w-6 ${isVesselSynced ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-red-600'}`}
                            onClick={() => removeCurrentCompanySeaService(service.id)}
                            disabled={isVesselSynced}
                            data-testid={`button-delete-current-service-${service.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                      )}
                    </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // E2: External Sea Service render function
  const renderE2ExternalSeaService = () => {
    return (
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>E2. Details of Sea Service (External)</h3>
          {canEditSection('E') && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addExternalSeaService}
            className="flex items-center gap-2"
            data-testid="button-add-external-service"
          >
            <Plus className="h-4 w-4" />
            ADD
          </Button>
          )}
        </div>
        
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Vessel Name <span className="text-red-500">*</span></th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Vessel Type <span className="text-red-500">*</span></th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Deadweight</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Engine Type/ Power</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Owner / operator</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Rank <span className="text-red-500">*</span></th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">From <span className="text-red-500">*</span></th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">To <span className="text-red-500">*</span></th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Period(M)</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Experience</th>
                  {canEditSection('E') && <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left w-24">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {formData.externalSeaService.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-gray-500">
                      No external sea service records added yet. Click "ADD" to get started.
                    </td>
                  </tr>
                ) : (
                  [...formData.externalSeaService]
                    .sort((a, b) => {
                      // Sort by latest dates first (To date, then From date)
                      const aDate = a.to || a.from || '';
                      const bDate = b.to || b.from || '';
                      return bDate.localeCompare(aDate);
                    })
                    .map((service) => (
                    <tr key={service.id} className="border-t">
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Input
                          value={service.vesselName}
                          onChange={(e) => { updateExternalSeaService(service.id, 'vesselName', e.target.value); if (seaServiceRequiredErrors[service.id]?.vesselName && e.target.value.trim()) setSeaServiceRequiredErrors(prev => { const n = { ...prev }; if (n[service.id]) { const { vesselName: _, ...rest } = n[service.id]; n[service.id] = rest; } return n; }); }}
                          onBlur={() => validateSeaServiceFieldOnBlur(service.id, service)}
                          className={`border ${seaServiceRequiredErrors[service.id]?.vesselName ? 'border-red-500' : 'border-[#EAEBEF]'} bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6`}
                          placeholder="Enter vessel name"
                        />
                        {seaServiceRequiredErrors[service.id]?.vesselName && <p className="text-xs text-red-500 mt-1">{seaServiceRequiredErrors[service.id].vesselName}</p>}
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Select
                          value={service.vesselType}
                          onValueChange={(value) => { updateExternalSeaService(service.id, 'vesselType', value); if (seaServiceRequiredErrors[service.id]?.vesselType) setSeaServiceRequiredErrors(prev => { const n = { ...prev }; if (n[service.id]) { const { vesselType: _, ...rest } = n[service.id]; n[service.id] = rest; } return n; }); setTimeout(() => validateSeaServiceFieldOnBlur(service.id, { ...service, vesselType: value }), 0); }}
                        >
                          <SelectTrigger className={`border ${seaServiceRequiredErrors[service.id]?.vesselType ? 'border-red-500' : 'border-[#EAEBEF]'} bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6`}>
                            <SelectValue placeholder="Select vessel type" />
                          </SelectTrigger>
                          <SelectContent>
                            {vesselTypeMasterData.map((vesselType) => (
                              <SelectItem key={vesselType} value={vesselType}>
                                {vesselType}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {seaServiceRequiredErrors[service.id]?.vesselType && <p className="text-xs text-red-500 mt-1">{seaServiceRequiredErrors[service.id].vesselType}</p>}
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Input
                          value={service.deadweight}
                          onChange={(e) => updateExternalSeaService(service.id, 'deadweight', e.target.value)}
                          className="border border-[#EAEBEF] bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                          placeholder="Enter deadweight"
                        />
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Input
                          value={service.engineTypePower}
                          onChange={(e) => updateExternalSeaService(service.id, 'engineTypePower', e.target.value)}
                          className="border border-[#EAEBEF] bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                          placeholder="Enter engine type/power"
                        />
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Input
                          value={service.ownerOperator}
                          onChange={(e) => updateExternalSeaService(service.id, 'ownerOperator', e.target.value)}
                          className="border border-[#EAEBEF] bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                          placeholder="Enter owner/operator"
                        />
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Select
                          value={service.rank}
                          onValueChange={(value) => { updateExternalSeaService(service.id, 'rank', value); if (seaServiceRequiredErrors[service.id]?.rank) setSeaServiceRequiredErrors(prev => { const n = { ...prev }; if (n[service.id]) { const { rank: _, ...rest } = n[service.id]; n[service.id] = rest; } return n; }); setTimeout(() => validateSeaServiceFieldOnBlur(service.id, { ...service, rank: value }), 0); }}
                        >
                          <SelectTrigger className={`border ${seaServiceRequiredErrors[service.id]?.rank ? 'border-red-500' : 'border-[#EAEBEF]'} bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6`}>
                            <SelectValue placeholder="Select rank" />
                          </SelectTrigger>
                          <SelectContent>
                            {ranksLoading ? (
                              <SelectItem value="loading" disabled>Loading ranks...</SelectItem>
                            ) : ranksError ? (
                              <SelectItem value="error" disabled>Failed to load ranks</SelectItem>
                            ) : rankOptions.length === 0 ? (
                              <SelectItem value="empty" disabled>No ranks available</SelectItem>
                            ) : (
                              rankOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        {seaServiceRequiredErrors[service.id]?.rank && <p className="text-xs text-red-500 mt-1">{seaServiceRequiredErrors[service.id].rank}</p>}
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <FormattedDateInput
                          value={service.from}
                          onChange={(e) => { updateExternalSeaService(service.id, 'from', e.target.value); if (seaServiceRequiredErrors[service.id]?.from && e.target.value) setSeaServiceRequiredErrors(prev => { const n = { ...prev }; if (n[service.id]) { const { from: _, ...rest } = n[service.id]; n[service.id] = rest; } return n; }); }}
                          onBlur={(e) => { runSeaServiceOverlapCheck(); validateSeaServiceFieldOnBlur(service.id, { ...service, from: e.target.value }); }}
                          className={`border ${seaServiceRequiredErrors[service.id]?.from ? 'border-red-500' : 'border-[#EAEBEF]'} bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6`}
                        />
                        {seaServiceRequiredErrors[service.id]?.from && <p className="text-xs text-red-500 mt-1">{seaServiceRequiredErrors[service.id].from}</p>}
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <FormattedDateInput
                          value={service.to}
                          onChange={(e) => { updateExternalSeaService(service.id, 'to', e.target.value); if (seaServiceRequiredErrors[service.id]?.to && e.target.value) setSeaServiceRequiredErrors(prev => { const n = { ...prev }; if (n[service.id]) { const { to: _, ...rest } = n[service.id]; n[service.id] = rest; } return n; }); }}
                          onBlur={(e) => { runSeaServiceOverlapCheck(); validateSeaServiceFieldOnBlur(service.id, { ...service, to: e.target.value }); }}
                          className={`border ${(seaServiceRequiredErrors[service.id]?.to || seaServiceDateErrors[service.id]) ? 'border-red-500' : 'border-[#EAEBEF]'} bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6`}
                        />
                        {seaServiceRequiredErrors[service.id]?.to && <p className="text-xs text-red-500 mt-1">{seaServiceRequiredErrors[service.id].to}</p>}
                        {!seaServiceRequiredErrors[service.id]?.to && seaServiceDateErrors[service.id] && <p className="text-xs text-red-500 mt-1" data-testid={`text-e2-to-error-${service.id}`}>{seaServiceDateErrors[service.id]}</p>}
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Input
                          value={service.periodMonths}
                          readOnly
                          className="border-0 bg-gray-50 p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6 cursor-not-allowed"
                          title="Auto-calculated based on From & To dates"
                        />
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        {service.vesselType === 'Oil Chemical Tanker' ? (
                          <div className="flex flex-col gap-1">
                            <label className="flex items-center gap-1 text-[11px]">
                              <Checkbox
                                checked={(service.experienceCategories || ['oil', 'chemical']).includes('oil')}
                                onCheckedChange={(checked) => {
                                  const current = service.experienceCategories || ['oil', 'chemical'];
                                  let newCategories: string[];
                                  if (checked) {
                                    newCategories = [...current, 'oil'].filter((v, i, a) => a.indexOf(v) === i);
                                  } else {
                                    if (current.filter(c => c !== 'oil').length === 0) return;
                                    newCategories = current.filter(c => c !== 'oil');
                                  }
                                  setFormData(prev => ({
                                    ...prev,
                                    externalSeaService: prev.externalSeaService.map(s =>
                                      s.id === service.id ? { ...s, experienceCategories: newCategories } : s
                                    )
                                  }));
                                }}
                                className="h-3 w-3"
                              />
                              <span>Oil</span>
                            </label>
                            <label className="flex items-center gap-1 text-[11px]">
                              <Checkbox
                                checked={(service.experienceCategories || ['oil', 'chemical']).includes('chemical')}
                                onCheckedChange={(checked) => {
                                  const current = service.experienceCategories || ['oil', 'chemical'];
                                  let newCategories: string[];
                                  if (checked) {
                                    newCategories = [...current, 'chemical'].filter((v, i, a) => a.indexOf(v) === i);
                                  } else {
                                    if (current.filter(c => c !== 'chemical').length === 0) return;
                                    newCategories = current.filter(c => c !== 'chemical');
                                  }
                                  setFormData(prev => ({
                                    ...prev,
                                    externalSeaService: prev.externalSeaService.map(s =>
                                      s.id === service.id ? { ...s, experienceCategories: newCategories } : s
                                    )
                                  }));
                                }}
                                className="h-3 w-3"
                              />
                              <span>Chemical</span>
                            </label>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-[11px]">—</span>
                        )}
                      </td>
                      {canEditSection('E') && (
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-gray-400 hover:text-blue-600 relative"
                            onClick={() => handleAttachmentClick('externalSeaService', service.id, service.vesselName || 'Sea Service')}
                            data-testid={`button-attach-external-service-${service.id}`}
                          >
                            <Paperclip className="h-3 w-3" />
                            {(service.attachments?.length || 0) > 0 && (
                              <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] rounded-full h-3.5 w-3.5 flex items-center justify-center">
                                {service.attachments?.length}
                              </span>
                            )}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-gray-400 hover:text-red-600"
                            onClick={() => removeExternalSeaService(service.id)}
                            data-testid={`button-delete-external-service-${service.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // F1: Pre Joining Medicals render function
  const renderF1PreJoiningMedicals = () => {
    return (
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>F1. Pre Joining Medicals</h3>
          {canEditSection('F') && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addPreJoiningMedical}
            className="flex items-center gap-2"
            data-testid="button-add-medical"
          >
            <Plus className="h-4 w-4" />
            ADD
          </Button>
          )}
        </div>
        
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Vessel</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Date of Medical</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">BP (mmHG)</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Weight (Kgs)</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Any Medication Prescribed</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Fitness for Sea Service</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Expiry</th>
                  {canEditSection('F') && <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left w-24">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {formData.preJoiningMedicals.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-500">
                      No medical records added yet. Click "ADD" to get started.
                    </td>
                  </tr>
                ) : (
                  formData.preJoiningMedicals.map((medical) => (
                    <tr key={medical.id} className="border-t">
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Select
                          value={medical.vesselCode || ''}
                          onValueChange={(value) => {
                            const selectedVessel = vesselOptions.find(v => v.code === value);
                            updatePreJoiningMedical(medical.id, 'vesselCode', value);
                            updatePreJoiningMedical(medical.id, 'vessel', selectedVessel?.name || '');
                          }}
                        >
                          <SelectTrigger className="border border-[#EAEBEF] bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6">
                            <SelectValue placeholder="Select vessel">
                              {medical.vessel || "Select vessel"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {vesselsLoading ? (
                              <SelectItem value="loading" disabled>Loading vessels...</SelectItem>
                            ) : vesselOptions.length === 0 ? (
                              <SelectItem value="empty" disabled>No vessels available</SelectItem>
                            ) : (
                              vesselOptions.map((vessel) => (
                                <SelectItem key={vessel.code} value={vessel.code}>
                                  {vessel.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <FormattedDateInput
                          value={medical.dateOfMedical}
                          onChange={(e) => updatePreJoiningMedical(medical.id, 'dateOfMedical', e.target.value)}
                          className="border border-[#EAEBEF] bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                        />
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Input
                          value={medical.bp}
                          onChange={(e) => updatePreJoiningMedical(medical.id, 'bp', e.target.value)}
                          className="border border-[#EAEBEF] bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                        />
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Input
                          value={medical.weight}
                          onChange={(e) => updatePreJoiningMedical(medical.id, 'weight', e.target.value)}
                          className="border border-[#EAEBEF] bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                        />
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Input
                          value={medical.anyMedicationPrescribed}
                          onChange={(e) => updatePreJoiningMedical(medical.id, 'anyMedicationPrescribed', e.target.value)}
                          className="border border-[#EAEBEF] bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                          placeholder="Enter medication"
                        />
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Select
                          value={medical.fitnessForDuty || ''}
                          onValueChange={(value) => updatePreJoiningMedical(medical.id, 'fitnessForDuty', value)}
                        >
                          <SelectTrigger className="border border-[#EAEBEF] bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Fit">Fit</SelectItem>
                            <SelectItem value="Unfit">Unfit</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <FormattedDateInput
                          value={medical.expiry}
                          onChange={(e) => updatePreJoiningMedical(medical.id, 'expiry', e.target.value)}
                          className={`border border-[#EAEBEF] bg-transparent p-0 focus-visible:ring-0 ${getExpiryColorClass(medical.expiry)} text-[13px] font-normal h-6`}
                        />
                      </td>
                      {canEditSection('F') && (
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-gray-400 hover:text-blue-600 relative"
                            onClick={() => handleAttachmentClick('preJoiningMedical', medical.id, medical.vessel || 'Medical')}
                            data-testid={`button-attach-medical-${medical.id}`}
                          >
                            <Paperclip className="h-3 w-3" />
                            {(medical.attachments?.length || 0) > 0 && (
                              <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] rounded-full h-3.5 w-3.5 flex items-center justify-center">
                                {medical.attachments?.length}
                              </span>
                            )}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-gray-400 hover:text-red-600"
                            onClick={() => removePreJoiningMedical(medical.id)}
                            data-testid={`button-delete-medical-${medical.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // F2: Doctor Visits render function
  const renderF2DoctorVisits = () => {
    return (
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>F2. Doctor Visits</h3>
          {canEditSection('F') && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addDoctorVisit}
            className="flex items-center gap-2"
            data-testid="button-add-visit"
          >
            <Plus className="h-4 w-4" />
            ADD
          </Button>
          )}
        </div>
        
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Vessel</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Port</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Date</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Complaint / Illness / Injury</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Doctor Comments</th>
                  {canEditSection('F') && <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left w-24">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {formData.doctorVisits.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">
                      No doctor visits recorded yet. Click "ADD" to get started.
                    </td>
                  </tr>
                ) : (
                  formData.doctorVisits.map((visit) => (
                    <tr key={visit.id} className="border-t">
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Input
                          value={visit.vessel}
                          onChange={(e) => updateDoctorVisit(visit.id, 'vessel', e.target.value)}
                          className="border border-[#EAEBEF] bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                          placeholder="Enter vessel"
                        />
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Input
                          value={visit.port}
                          onChange={(e) => updateDoctorVisit(visit.id, 'port', e.target.value)}
                          className="border border-[#EAEBEF] bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                          placeholder="Enter port"
                        />
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <FormattedDateInput
                          value={visit.date}
                          onChange={(e) => updateDoctorVisit(visit.id, 'date', e.target.value)}
                          className="border border-[#EAEBEF] bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                        />
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Input
                          value={visit.complaint}
                          onChange={(e) => updateDoctorVisit(visit.id, 'complaint', e.target.value)}
                          className="border border-[#EAEBEF] bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                          placeholder="Enter complaint/illness/injury"
                        />
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Input
                          value={visit.doctorComments}
                          onChange={(e) => updateDoctorVisit(visit.id, 'doctorComments', e.target.value)}
                          className="border border-[#EAEBEF] bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                          placeholder="Enter doctor comments"
                        />
                      </td>
                      {canEditSection('F') && (
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-gray-400 hover:text-blue-600 relative"
                            onClick={() => handleAttachmentClick('doctorVisit', visit.id, visit.vessel || 'Doctor Visit')}
                            data-testid={`button-attach-visit-${visit.id}`}
                          >
                            <Paperclip className="h-3 w-3" />
                            {(visit.attachments?.length || 0) > 0 && (
                              <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] rounded-full h-3.5 w-3.5 flex items-center justify-center">
                                {visit.attachments?.length}
                              </span>
                            )}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-gray-400 hover:text-red-600"
                            onClick={() => removeDoctorVisit(visit.id)}
                            data-testid={`button-delete-visit-${visit.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // Save Draft functionality
  const handleSaveDraft = () => {
    if (isBatchSavingRef.current) return;

    let hasErrors = false;

    // B1: First Name
    const trimmedFirstName = (formData.firstName || '').trim();
    if (!trimmedFirstName) {
      setFirstNameError('First name is required.');
      hasErrors = true;
    } else {
      setFirstNameError('');
    }

    // B1: DOB
    if (formData.dateOfBirth) {
      const dErr = validateDob(formData.dateOfBirth);
      if (dErr) { setDobError(dErr); hasErrors = true; } else { setDobError(''); }
    } else { setDobError(''); }

    // B2: Mobile
    const trimmedMobile = (formData.mobile || '').trim();
    if (trimmedMobile && formData.countryOfResidence) {
      const mobileErr = validateMobileNumber(formData.countryOfResidence, trimmedMobile);
      if (mobileErr) { setMobileError(mobileErr); hasErrors = true; } else { setMobileError(''); }
    } else { setMobileError(''); }

    // B2: Email
    const trimmedEmail = (formData.email || '').trim();
    if (trimmedEmail) {
      const emailErr = validateEmail(trimmedEmail);
      if (emailErr) { setEmailError(emailErr); hasErrors = true; } else { setEmailError(''); }
    } else { setEmailError(''); }

    // B3: NOK Email
    const trimmedNokEmail = (formData.nokEmail || '').trim();
    if (trimmedNokEmail) {
      const nokErr = validateEmail(trimmedNokEmail);
      if (nokErr) { setNokEmailError(nokErr); hasErrors = true; } else { setNokEmailError(''); }
    } else { setNokEmailError(''); }

    // B3: Spouse validation
    if (formData.maritalStatus === 'Married') {
      if (!(formData.spouseFirstName || '').trim()) { setSpouseFirstNameError('Spouse first name is required.'); hasErrors = true; } else { setSpouseFirstNameError(''); }
      if (!(formData.spouseFamilyName || '').trim()) { setSpouseFamilyNameError('Spouse family name is required.'); hasErrors = true; } else { setSpouseFamilyNameError(''); }
      if (!(formData.spouseDateOfBirth || '').trim()) { setSpouseDobError('Spouse date of birth is required.'); hasErrors = true; }
      else if (formData.spouseDateOfBirth > todayStr) { setSpouseDobError('Spouse date of birth cannot be a future date.'); hasErrors = true; }
      else { setSpouseDobError(''); }
    } else {
      setSpouseFirstNameError(''); setSpouseFamilyNameError(''); setSpouseDobError('');
    }
    setSpouseValidationError('');

    // Row blank detection helpers
    const hasAttachments = (atts: any) => Array.isArray(atts) && atts.filter((a: any) => !a.isDeleted).length > 0;
    const isDocBlank = (doc: typeof formData.documents[0]) => !(doc.document || '').trim() && !(doc.number || '').trim() && !(doc.issued || '').trim() && !(doc.expiry || '').trim() && !(doc.issuingAuthority || '').trim() && !hasAttachments(doc.attachments);
    const isVisaBlank = (visa: typeof formData.visas[0]) => !(visa.issuingCountry || '').trim() && !(visa.serialNo || '').trim() && !(visa.issued || '').trim() && !(visa.expiry || '').trim() && !(visa.visaType || '').trim() && !hasAttachments(visa.attachments);
    const isEduBlank = (edu: typeof formData.education[0]) => !(edu.qualifications || '').trim() && !(edu.subjectsField || '').trim() && !(edu.schoolCollegeUniversity || '').trim() && !(edu.dateOfCompletion || '').trim() && !hasAttachments(edu.attachments);
    const isLicBlank = (lic: typeof formData.licenses[0]) => !(lic.certificateDocument || '').trim() && !(lic.abbr || '').trim() && !(lic.requirement || '').trim() && !(lic.certificateNo || '').trim() && !(lic.issuingAuthority || '').trim() && !(lic.issued || '').trim() && !(lic.expiry || '').trim() && !hasAttachments(lic.attachments);
    const isTrainBlank = (t: typeof formData.trainingCourses[0]) => !(t.trainingCourse || '').trim() && !(t.abbr || '').trim() && !(t.requirement || '').trim() && !(t.certificateNo || '').trim() && !(t.issuingAuthority || '').trim() && !(t.issued || '').trim() && !(t.expiry || '').trim() && !hasAttachments(t.attachments);
    const isSeaServiceBlank = (sea: any) => !(sea.vesselName || '').trim() && !(sea.vesselType || '').trim() && !(sea.rank || '').trim() && !(sea.from || sea.fromDate || '').trim() && !(sea.to || sea.toDate || '').trim() && !(sea.ownerOperator || '').trim() && !(sea.deadweight || '').trim() && !(sea.engineTypePower || '').trim();
    const isMedicalBlank = (med: any) => !(med.vessel || '').trim() && !(med.dateOfMedical || '').trim() && !(med.bp || '').trim() && !(med.weight || '').trim() && !(med.fitnessForDuty || '').trim() && !(med.expiry || '').trim() && !(med.anyMedicationPrescribed || '').trim() && !hasAttachments(med.attachments);
    const isDoctorVisitBlank = (dv: any) => !(dv.vessel || '').trim() && !(dv.port || '').trim() && !(dv.date || '').trim() && !(dv.complaint || '').trim() && !(dv.doctorComments || '').trim() && !hasAttachments(dv.attachments);

    // C1: Document required + date validation
    const newDocReqErrors: Record<string, string> = {};
    const newDocDateErrors: Record<string, { issued?: string; expiry?: string }> = {};
    formData.documents.forEach((doc) => {
      if (!isDocBlank(doc)) {
        if (!(doc.document || '').trim()) { newDocReqErrors[doc.id] = 'Document name is required.'; hasErrors = true; }
        const ie = validateIssuedDate(doc.issued); if (ie) { newDocDateErrors[doc.id] = {...(newDocDateErrors[doc.id] || {}), issued: ie}; hasErrors = true; }
        const ee = validateExpiryDate(doc.expiry, doc.issued); if (ee) { newDocDateErrors[doc.id] = {...(newDocDateErrors[doc.id] || {}), expiry: ee}; hasErrors = true; }
      }
    });
    setDocRequiredErrors(newDocReqErrors);
    setDocDateErrors(newDocDateErrors);

    // C2: Visa required + date validation
    const newVisaReqErrors: Record<string, { issuingCountry?: string; visaType?: string }> = {};
    const newVisaDateErrors: Record<string, { issued?: string; expiry?: string }> = {};
    formData.visas.forEach((visa) => {
      if (!isVisaBlank(visa)) {
        const vReq: { issuingCountry?: string; visaType?: string } = {};
        if (!(visa.issuingCountry || '').trim()) { vReq.issuingCountry = 'Issuing country is required.'; hasErrors = true; }
        if (!(visa.visaType || '').trim()) { vReq.visaType = 'Visa type is required.'; hasErrors = true; }
        if (vReq.issuingCountry || vReq.visaType) newVisaReqErrors[visa.id] = vReq;
        const ie = validateIssuedDate(visa.issued); if (ie) { newVisaDateErrors[visa.id] = {...(newVisaDateErrors[visa.id] || {}), issued: ie}; hasErrors = true; }
        const ee = validateExpiryDate(visa.expiry, visa.issued); if (ee) { newVisaDateErrors[visa.id] = {...(newVisaDateErrors[visa.id] || {}), expiry: ee}; hasErrors = true; }
      }
    });
    setVisaRequiredErrors(newVisaReqErrors);
    setVisaDateErrors(newVisaDateErrors);

    // D1: Education required
    const newEduReqErrors: Record<string, string> = {};
    formData.education.forEach((edu) => {
      if (!isEduBlank(edu) && !(edu.qualifications || '').trim()) { newEduReqErrors[edu.id] = 'Qualifications is required.'; hasErrors = true; }
    });
    setEduRequiredErrors(newEduReqErrors);

    // D2: License required + date validation
    const newLicReqErrors: Record<string, string> = {};
    const newLicDateErrors: Record<string, { issued?: string; expiry?: string }> = {};
    formData.licenses.forEach((lic) => {
      if (!isLicBlank(lic)) {
        if (!(lic.certificateDocument || '').trim()) { newLicReqErrors[lic.id] = 'Certificate/Document is required.'; hasErrors = true; }
        const ie = validateIssuedDate(lic.issued); if (ie) { newLicDateErrors[lic.id] = {...(newLicDateErrors[lic.id] || {}), issued: ie}; hasErrors = true; }
        const ee = validateExpiryDate(lic.expiry, lic.issued); if (ee) { newLicDateErrors[lic.id] = {...(newLicDateErrors[lic.id] || {}), expiry: ee}; hasErrors = true; }
      }
    });
    setLicRequiredErrors(newLicReqErrors);
    setLicDateErrors(newLicDateErrors);

    // D3: Training required + date validation
    const newTrainReqErrors: Record<string, string> = {};
    const newTrainDateErrors: Record<string, { issued?: string; expiry?: string }> = {};
    formData.trainingCourses.forEach((t) => {
      if (!isTrainBlank(t)) {
        if (!(t.trainingCourse || '').trim()) { newTrainReqErrors[t.id] = 'Training course is required.'; hasErrors = true; }
        const ie = validateIssuedDate(t.issued); if (ie) { newTrainDateErrors[t.id] = {...(newTrainDateErrors[t.id] || {}), issued: ie}; hasErrors = true; }
        const ee = validateExpiryDate(t.expiry, t.issued); if (ee) { newTrainDateErrors[t.id] = {...(newTrainDateErrors[t.id] || {}), expiry: ee}; hasErrors = true; }
      }
    });
    setTrainRequiredErrors(newTrainReqErrors);
    setTrainDateErrors(newTrainDateErrors);

    // E1/E2: Sea service date + mandatory field validation (all non-synced rows)
    const newSeaErrors: Record<string, string> = {};
    const newSeaReqErrors: Record<string, Record<string, string>> = {};
    (formData.currentCompanySeaService || []).forEach((sea: any, i: number) => {
      const isVesselSynced = !!sea.isVesselSynced;
      if (!isVesselSynced) {
        const from = sea.from || sea.fromDate || '';
        const to = sea.to || sea.toDate || '';
        if (from && to && to < from) {
          newSeaErrors[sea.id || sea.seaUuid || `e1-${from}`] = '"To" date cannot be earlier than "From" date.';
          hasErrors = true;
        }
        const fieldErrors: Record<string, string> = {};
        if (!(sea.vesselName || '').trim()) fieldErrors.vesselName = 'Vessel name is required.';
        if (!(sea.vesselType || '').trim()) fieldErrors.vesselType = 'Vessel type is required.';
        if (!(sea.rank || '').trim()) fieldErrors.rank = 'Rank is required.';
        if (!from) fieldErrors.from = 'From date is required.';
        if (!to) fieldErrors.to = 'To date is required.';
        if (Object.keys(fieldErrors).length > 0) { newSeaReqErrors[sea.id || `e1-${i}`] = fieldErrors; hasErrors = true; }
      }
    });
    (formData.externalSeaService || []).forEach((sea: any, i: number) => {
      const from = sea.from || sea.fromDate || '';
      const to = sea.to || sea.toDate || '';
      if (from && to && to < from) {
        newSeaErrors[sea.id || sea.seaUuid || `e2-${from}`] = '"To" date cannot be earlier than "From" date.';
        hasErrors = true;
      }
      const fieldErrors: Record<string, string> = {};
      if (!(sea.vesselName || '').trim()) fieldErrors.vesselName = 'Vessel name is required.';
      if (!(sea.vesselType || '').trim()) fieldErrors.vesselType = 'Vessel type is required.';
      if (!(sea.rank || '').trim()) fieldErrors.rank = 'Rank is required.';
      if (!from) fieldErrors.from = 'From date is required.';
      if (!to) fieldErrors.to = 'To date is required.';
      if (Object.keys(fieldErrors).length > 0) { newSeaReqErrors[sea.id || `e2-${i}`] = fieldErrors; hasErrors = true; }
    });
    setSeaServiceRequiredErrors(newSeaReqErrors);

    // Cross-section period overlap validation — merge with to<from errors
    const overlapErrors = runSeaServiceOverlapCheck();
    const mergedSeaErrors = { ...newSeaErrors };
    Object.entries(overlapErrors).forEach(([key, msg]) => {
      if (mergedSeaErrors[key]) {
        mergedSeaErrors[key] = `${mergedSeaErrors[key]} ${msg}`;
      } else {
        mergedSeaErrors[key] = msg;
      }
    });
    setSeaServiceDateErrors(mergedSeaErrors);
    if (Object.keys(mergedSeaErrors).length > 0) hasErrors = true;

    // If any errors, scroll to first error and show toast
    if (hasErrors) {
      toast({
        title: "Validation Error",
        description: "Please fix the highlighted errors before saving.",
        variant: "destructive",
      });
      setTimeout(() => {
        const firstError = document.querySelector('p.text-red-500, input.border-red-500, [class*="border-red-500"]');
        if (firstError) {
          firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      return;
    }

    // Remove fully blank rows before saving — filter all 9 array sections
    const nonEmptyDocuments = formData.documents.filter(doc => doc.docUuid || !isDocBlank(doc));
    const nonEmptyVisas = formData.visas.filter(visa => visa.visaUuid || !isVisaBlank(visa));
    const nonEmptyEducation = formData.education.filter(edu => (edu as any).eduUuid || !isEduBlank(edu));
    const nonEmptyLicenses = formData.licenses.filter(lic => (lic as any).licUuid || !isLicBlank(lic));
    const nonEmptyTraining = formData.trainingCourses.filter(t => (t as any).trainUuid || !isTrainBlank(t));
    const nonEmptyCurrentSea = formData.currentCompanySeaService.filter((sea: any) => sea.seaUuid || sea.isVesselSynced || !isSeaServiceBlank(sea));
    const nonEmptyExternalSea = formData.externalSeaService.filter((sea: any) => sea.seaUuid || !isSeaServiceBlank(sea));
    const nonEmptyMedicals = formData.preJoiningMedicals.filter((med: any) => med.medUuid || !isMedicalBlank(med));
    const nonEmptyDoctorVisits = formData.doctorVisits.filter((dv: any) => dv.visitUuid || !isDoctorVisitBlank(dv));

    const cleanedFormData = {
      ...formData,
      documents: nonEmptyDocuments,
      visas: nonEmptyVisas,
      education: nonEmptyEducation,
      licenses: nonEmptyLicenses,
      trainingCourses: nonEmptyTraining,
      currentCompanySeaService: nonEmptyCurrentSea,
      externalSeaService: nonEmptyExternalSea,
      preJoiningMedicals: nonEmptyMedicals,
      doctorVisits: nonEmptyDoctorVisits,
    };
    setFormData(cleanedFormData);

    // Include the uploaded photo in the data to be saved — use cleaned data
    const dataWithPhoto = { ...cleanedFormData, uploadedPhoto: uploadedPhoto || null };
    
    // V2: Use crewUuid as primary identifier for updates
    // Also check createdCrewId — after first save of a new crew, crewMember is still null
    // but createdCrewId holds the UUID of the just-created record
    const crewIdentifier = crewMember?.crewUuid || crewMember?.id || createdCrewId;
    if (crewIdentifier) {
      isBatchSavingRef.current = true;
      setIsBatchSaving(true);
      (async () => {
        const batchErrors: string[] = [];
        const uuidUpdates: { section: string; localId: string; uuid: string }[] = [];
        try {

          const nonBatchOps: (() => Promise<any>)[] = [];
          nonBatchOps.push(async () => {
            const v2Crew = withAuditUser(mapLegacyCrewToV2(dataWithPhoto));
            delete v2Crew.nextAvailability;
            delete v2Crew.isActive;
            delete v2Crew.status;
            await crewPoolApiV2.updateCrew(crewIdentifier, v2Crew);
          });
          const personalDetailsData = {
            height: formData.heightCm,
            weight: formData.weightKg,
            bmi: formData.bmi,
            dob: formData.dateOfBirth,
            ageInYears: formData.ageInYears,
            placeOfBirthCity: formData.placeOfBirthCity,
            placeOfBirthCountry: formData.placeOfBirthCountry,
            nativeLanguage: formData.nativeLanguage,
            foreignLanguages: formData.foreignLanguages,
            englishProficiency: formData.englishProficiency,
            manningAgent: formData.manningAgent,
            crewPool: formData.crewPool,
          };
          nonBatchOps.push(async () => {
            const v2Personal = withAuditUser(mapLegacyPersonalDetailsToV2(personalDetailsData));
            await crewPoolApiV2.savePersonalDetails(crewIdentifier, v2Personal);
          });
          const addressData = {
            countryOfResidence: formData.countryOfResidence,
            nearestAirport: formData.nearestAirport,
            residentialAddressLine1: formData.residentialAddressLine1,
            residentialAddressLine2: formData.residentialAddressLine2,
            contactLandline: formData.contactLandline,
            mobile: formData.mobile,
            email: formData.email,
          };
          nonBatchOps.push(async () => {
            const v2Address = withAuditUser(mapLegacyAddressToV2(addressData));
            await crewPoolApiV2.saveAddress(crewIdentifier, v2Address);
          });
          const familyInfoData = {
            maritalStatus: formData.maritalStatus,
            numberOfDependentChildren: formData.numberOfDependentChildren,
            fatherName: formData.fatherName,
            motherName: formData.motherName,
            spouseFirstName: formData.spouseFirstName,
            spouseMiddleName: formData.spouseMiddleName,
            spouseFamilyName: formData.spouseFamilyName,
            spouseDateOfBirth: formData.spouseDateOfBirth,
          };
          nonBatchOps.push(async () => {
            const v2Family = withAuditUser(mapLegacyFamilyInfoToV2(familyInfoData));
            await crewPoolApiV2.saveFamilyInfo(crewIdentifier, v2Family);
          });

          const nonBatchResults = await Promise.allSettled(nonBatchOps.map(op => op()));
          nonBatchResults.forEach((result, idx) => {
            if (result.status === 'rejected') {
              const errMsg = result.reason?.message || String(result.reason);
              console.error(`V2 Error in non-batch op ${idx + 1}:`, result.reason);
              batchErrors.push(`Non-batch: ${errMsg}`);
            }
          });

          const miscOps: (() => Promise<any>)[] = [];
          if (deletedChildUuids.length > 0) {
            for (const childUuid of deletedChildUuids) {
              miscOps.push(async () => {
                try { await crewPoolApiV2.deleteChild(crewIdentifier, childUuid); } catch (e) { /* ignore */ }
              });
            }
            setDeletedChildUuids([]);
          }
          if (formData.children && formData.children.length > 0) {
            formData.children.forEach((child: any, index: number) => {
              const childData = {
                firstName: child.firstName,
                middleName: child.middleName,
                familyName: child.familyName,
                dob: child.dateOfBirth,
                gender: child.gender,
                sortOrder: index,
              };
              miscOps.push(async () => {
                if (child.childUuid) {
                  await crewPoolApiV2.updateChild(crewIdentifier, child.childUuid, childData);
                } else {
                  const created = await crewPoolApiV2.createChild(crewIdentifier, childData);
                  if (created?.childUuid) {
                    setFormData(prev => ({
                      ...prev,
                      children: prev.children.map((c, i) =>
                        i === index ? { ...c, childUuid: created.childUuid } : c
                      )
                    }));
                  }
                }
              });
            });
          }

          const nokData = {
            firstName: formData.nokFirstName,
            middleName: formData.nokMiddleName,
            familyName: formData.nokFamilyName,
            relationship: formData.nokRelationship,
            telephone: formData.nokTelephone,
            email: formData.nokEmail,
            address: formData.nokAddress,
          };
          miscOps.push(async () => {
            await crewPoolApiV2.saveNextOfKin(crewIdentifier, nokData);
          });

          if (formData.vesselType && Array.isArray(formData.vesselType)) {
            miscOps.push(async () => {
              await crewPoolApiV2.saveVesselTypesApplied(crewIdentifier, formData.vesselType);
            });
          }

          if (miscOps.length > 0) {
            const miscResults = await Promise.allSettled(miscOps.map(op => op()));
            miscResults.forEach((result, idx) => {
              if (result.status === 'rejected') {
                console.error(`V2 Error in misc op ${idx + 1}:`, result.reason);
              }
            });
          }

          const processBatch = async (batchName: string, operations: (() => Promise<any>)[]) => {
            if (operations.length === 0) return;
            const subBatchSize = 3;
            for (let i = 0; i < operations.length; i += subBatchSize) {
              const subBatch = operations.slice(i, i + subBatchSize);
              const results = await Promise.allSettled(subBatch.map(op => op()));
              results.forEach((result, idx) => {
                if (result.status === 'rejected') {
                  const errMsg = result.reason?.message || String(result.reason);
                  console.error(`V2 Error in batch ${batchName}, item ${i + idx + 1}:`, result.reason);
                  batchErrors.push(`${batchName}: ${errMsg}`);
                }
              });
            }
          };

          const batch1Operations: (() => Promise<any>)[] = [];
          const batch2Operations: (() => Promise<any>)[] = [];
          const batch3Operations: (() => Promise<any>)[] = [];
          const batch4Operations: (() => Promise<any>)[] = [];

          if (cleanedFormData.documents && cleanedFormData.documents.length > 0) {
            cleanedFormData.documents.forEach((doc: any, index: number) => {
              const docAttachments = doc.attachments || [];
              const capturedNewAttachments = [...docAttachments.filter((att: any) => !att.attUuid || att.isNew)];
              const capturedDeletedAttachments = [...docAttachments.filter((att: any) => att.isDeleted && att.attUuid)];

              const docData = {
                docUuid: doc.docUuid,
                documentId: doc.documentId || doc.document || '',
                documentName: doc.document || doc.documentId || '',
                number: doc.number || '',
                issued: doc.issued || '',
                expiry: doc.expiry || '',
                issuingAuthority: doc.issuingAuthority || '',
                issuingCountryUuid: doc.issuingCountry || '',
                sortOrder: index,
              };

              const capturedLocalId = doc.id;
              batch1Operations.push(async () => {
                const v2Data = withAuditUser(mapLegacyDocumentToV2(docData));
                let savedDoc: any;
                if (doc.docUuid) {
                  savedDoc = await crewPoolApiV2.updateDocument(crewIdentifier, doc.docUuid, v2Data);
                } else {
                  savedDoc = await crewPoolApiV2.createDocument(crewIdentifier, v2Data);
                }
                const savedDocUuid = savedDoc?.docUuid || savedDoc?.doc_uuid || doc.docUuid;
                if (savedDocUuid && !doc.docUuid) {
                  uuidUpdates.push({ section: 'documents', localId: capturedLocalId, uuid: savedDocUuid });
                }

                for (const att of capturedDeletedAttachments) {
                  await crewPoolApiV2.removeDocumentAttachment(crewIdentifier, savedDocUuid, att.attUuid);
                }
                for (const att of capturedNewAttachments) {
                  await crewPoolApiV2.addDocumentAttachment(crewIdentifier, savedDocUuid, { fileName: att.name, fileUrl: att.data, fileSize: String(att.size || 0), mimeType: att.type });
                }
                return savedDoc;
              });
            });
          }

          if (cleanedFormData.visas && cleanedFormData.visas.length > 0) {
            cleanedFormData.visas.forEach((visa: any, index: number) => {
              const visaAttachments = visa.attachments || [];
              const capturedNewAttachments = [...visaAttachments.filter((att: any) => !att.attUuid || att.isNew)];
              const capturedDeletedAttachments = [...visaAttachments.filter((att: any) => att.isDeleted && att.attUuid)];

              const visaData = {
                visaUuid: visa.visaUuid,
                country: visa.issuingCountry || visa.country || '',
                serialNo: visa.serialNo ?? visa.serialNumber ?? '',
                issued: visa.issued || '',
                expiry: visa.expiry || '',
                visaType: visa.visaType || '',
                sortOrder: index,
              };

              const capturedVisaLocalId = visa.id;
              batch1Operations.push(async () => {
                const v2Data = withAuditUser(mapLegacyVisaToV2(visaData));
                let savedVisa: any;
                if (visa.visaUuid) {
                  savedVisa = await crewPoolApiV2.updateVisa(crewIdentifier, visa.visaUuid, v2Data);
                } else {
                  savedVisa = await crewPoolApiV2.createVisa(crewIdentifier, v2Data);
                }
                const savedVisaUuid = savedVisa?.visaUuid || savedVisa?.visa_uuid || visa.visaUuid;
                if (savedVisaUuid && !visa.visaUuid) {
                  uuidUpdates.push({ section: 'visas', localId: capturedVisaLocalId, uuid: savedVisaUuid });
                }

                for (const att of capturedDeletedAttachments) {
                  await crewPoolApiV2.removeVisaAttachment(crewIdentifier, savedVisaUuid, att.attUuid);
                }
                for (const att of capturedNewAttachments) {
                  await crewPoolApiV2.addVisaAttachment(crewIdentifier, savedVisaUuid, { fileName: att.name, fileUrl: att.data, fileSize: String(att.size || 0), mimeType: att.type });
                }
                return savedVisa;
              });
            });
          }

          if (cleanedFormData.education && cleanedFormData.education.length > 0) {
            cleanedFormData.education.forEach((edu: any, index: number) => {
              const eduAttachments = edu.attachments || [];
              const capturedNewAttachments = [...eduAttachments.filter((att: any) => !att.attUuid || att.isNew)].map((att: any) => ({
                attUuid: att.attUuid,
                isNew: att.isNew || !att.attUuid,
                fileName: att.name || att.fileName || '',
                fileData: att.data || att.fileData || '',
                fileSize: String(att.size || att.fileSize || 0),
                fileType: att.type || att.fileType || '',
              }));
              const capturedDeletedAttachments = [...eduAttachments.filter((att: any) => att.isDeleted && att.attUuid)];

              const eduData = {
                id: edu.id,
                eduUuid: edu.eduUuid,
                dateOfCompletion: edu.dateOfCompletion || '',
                schoolCollegeUniversity: edu.schoolCollegeUniversity || '',
                subjectsField: edu.subjectsField || '',
                qualifications: edu.qualifications || '',
                sortOrder: index,
              };

              const capturedEduLocalId = edu.id;
              batch2Operations.push(async () => {
                if (edu.eduUuid) {
                  for (const att of capturedDeletedAttachments) {
                    await crewPoolApiV2.removeEducationAttachment(crewIdentifier, edu.eduUuid, att.attUuid);
                  }
                }

                const v2Data = withAuditUser(mapLegacyEducationToV2(eduData));
                let savedEdu: any;
                let entityUuid: string;
                if (edu.eduUuid) {
                  savedEdu = await crewPoolApiV2.updateEducation(crewIdentifier, edu.eduUuid, v2Data);
                  entityUuid = edu.eduUuid;
                } else {
                  savedEdu = await crewPoolApiV2.createEducation(crewIdentifier, v2Data);
                  entityUuid = savedEdu?.eduUuid || savedEdu?.edu_uuid;
                }
                if (entityUuid && !edu.eduUuid) {
                  uuidUpdates.push({ section: 'education', localId: capturedEduLocalId, uuid: entityUuid });
                }

                const newAtts = capturedNewAttachments.filter(att => !att.attUuid || att.isNew);
                for (const att of newAtts) {
                  if (att.fileName && (att.fileData)) {
                    await crewPoolApiV2.addEducationAttachment(crewIdentifier, entityUuid, {
                      fileName: att.fileName,
                      fileUrl: att.fileData,
                      fileSize: att.fileSize,
                      mimeType: att.fileType,
                    });
                  }
                }
                return savedEdu;
              });
            });
          }

          if (cleanedFormData.licenses && cleanedFormData.licenses.length > 0) {
            cleanedFormData.licenses.forEach((lic: any, index: number) => {
              const licAttachments = lic.attachments || [];
              const capturedNewAttachments = [...licAttachments.filter((att: any) => !att.attUuid || att.isNew)].map((att: any) => ({
                attUuid: att.attUuid,
                isNew: att.isNew || !att.attUuid,
                fileName: att.name || att.fileName || '',
                fileData: att.data || att.fileData || '',
                fileSize: String(att.size || att.fileSize || 0),
                fileType: att.type || att.fileType || '',
              }));
              const capturedDeletedAttachments = [...licAttachments.filter((att: any) => att.isDeleted && att.attUuid)];

              const licData = {
                id: lic.id,
                licUuid: lic.licUuid,
                licenseId: lic.licenseId || '',
                certificateDocument: lic.certificateDocument || '',
                abbr: lic.abbr || '',
                requirement: lic.requirement || '',
                certificateNo: lic.certificateNo || '',
                issuingAuthority: lic.issuingAuthority || '',
                issuingCountry: lic.issuingCountry || '',
                issued: lic.issued || '',
                expiry: lic.expiry || '',
                archivedAt: lic.archivedAt || '',
                sortOrder: index,
              };

              const capturedLicLocalId = lic.id;
              batch2Operations.push(async () => {
                if (lic.licUuid) {
                  for (const att of capturedDeletedAttachments) {
                    await crewPoolApiV2.removeLicenseAttachment(crewIdentifier, lic.licUuid, att.attUuid);
                  }
                }

                const v2Data = withAuditUser(mapLegacyLicenseToV2(licData));
                let savedLic: any;
                let entityUuid: string;
                if (lic.licUuid) {
                  savedLic = await crewPoolApiV2.updateLicense(crewIdentifier, lic.licUuid, v2Data);
                  entityUuid = lic.licUuid;
                } else {
                  savedLic = await crewPoolApiV2.createLicense(crewIdentifier, v2Data);
                  entityUuid = savedLic?.licUuid || savedLic?.lic_uuid;
                }
                if (entityUuid && !lic.licUuid) {
                  uuidUpdates.push({ section: 'licenses', localId: capturedLicLocalId, uuid: entityUuid });
                }

                const newAtts = capturedNewAttachments.filter(att => !att.attUuid || att.isNew);
                for (const att of newAtts) {
                  if (att.fileName && (att.fileData)) {
                    await crewPoolApiV2.addLicenseAttachment(crewIdentifier, entityUuid, {
                      fileName: att.fileName,
                      fileUrl: att.fileData,
                      fileSize: att.fileSize,
                      mimeType: att.fileType,
                    });
                  }
                }
                return savedLic;
              });
            });
          }

          if (cleanedFormData.trainingCourses && cleanedFormData.trainingCourses.length > 0) {
            const trainOrderMap = new Map<string, number>();
            adminCompanyTrainings.forEach((ct, idx) => trainOrderMap.set(ct.companyId, idx));
            cleanedFormData.trainingCourses.forEach((train: any, index: number) => {
              const trainAttachments = train.attachments || [];
              const capturedNewAttachments = [...trainAttachments.filter((att: any) => !att.attUuid || att.isNew)].map((att: any) => ({
                attUuid: att.attUuid,
                isNew: att.isNew || !att.attUuid,
                fileName: att.name || att.fileName || '',
                fileData: att.data || att.fileData || '',
                fileSize: String(att.size || att.fileSize || 0),
                fileType: att.type || att.fileType || '',
              }));
              const capturedDeletedAttachments = [...trainAttachments.filter((att: any) => att.isDeleted && att.attUuid)];

              const trainData = {
                id: train.id,
                trainUuid: train.trainUuid,
                courseId: train.courseId || '',
                trainingCourse: train.trainingCourse || '',
                abbr: train.abbr || '',
                requirement: train.requirement || '',
                certificateNo: train.certificateNo || '',
                issuingAuthority: train.issuingAuthority || '',
                issuingCountry: train.issuingCountry || '',
                issued: train.issued || '',
                expiry: train.expiry || '',
                sortOrder: (() => {
                  const cid = (train.courseId || '').trim();
                  if (cid && trainOrderMap.has(cid)) return trainOrderMap.get(cid)!;
                  if (cid) return 500 + index;
                  return 1000 + index;
                })(),
              };

              const capturedTrainLocalId = train.id;
              batch3Operations.push(async () => {
                if (train.trainUuid) {
                  for (const att of capturedDeletedAttachments) {
                    await crewPoolApiV2.removeTrainingAttachment(crewIdentifier, train.trainUuid, att.attUuid);
                  }
                }

                const v2Data = withAuditUser(mapLegacyTrainingCourseToV2(trainData));
                let savedTrain: any;
                let entityUuid: string;
                if (train.trainUuid) {
                  savedTrain = await crewPoolApiV2.updateTrainingCourse(crewIdentifier, train.trainUuid, v2Data);
                  entityUuid = train.trainUuid;
                } else {
                  savedTrain = await crewPoolApiV2.createTrainingCourse(crewIdentifier, v2Data);
                  entityUuid = savedTrain?.trainUuid || savedTrain?.train_uuid;
                }
                if (entityUuid && !train.trainUuid) {
                  uuidUpdates.push({ section: 'trainingCourses', localId: capturedTrainLocalId, uuid: entityUuid });
                }

                const newAtts = capturedNewAttachments.filter(att => !att.attUuid || att.isNew);
                for (const att of newAtts) {
                  if (att.fileName && (att.fileData)) {
                    await crewPoolApiV2.addTrainingAttachment(crewIdentifier, entityUuid, {
                      fileName: att.fileName,
                      fileUrl: att.fileData,
                      fileSize: att.fileSize,
                      mimeType: att.fileType,
                    });
                  }
                }
                return savedTrain;
              });
            });
          }

          if (cleanedFormData.currentCompanySeaService && cleanedFormData.currentCompanySeaService.length > 0) {
            cleanedFormData.currentCompanySeaService.forEach((sea: any, index: number) => {
              const seaAttachments = sea.attachments || [];
              const capturedNewAttachments = [...seaAttachments.filter((att: any) => !att.attUuid || att.isNew)].map((att: any) => ({
                attUuid: att.attUuid,
                isNew: att.isNew || !att.attUuid,
                fileName: att.name || att.fileName || '',
                fileData: att.data || att.fileData || '',
                fileSize: String(att.size || att.fileSize || 0),
                fileType: att.type || att.fileType || '',
              }));
              const capturedDeletedAttachments = [...seaAttachments.filter((att: any) => att.isDeleted && att.attUuid)];

              const isSeaSynced = !!sea.isVesselSynced && !!sea.seaUuid;
              const seaData: LegacySeaService = {
                seaUuid: sea.seaUuid,
                isCompanyService: true,
                vesselName: sea.vesselName || '',
                vesselCode: sea.vesselCode || '',
                vesselType: sea.vesselType || '',
                rank: sea.rank || '',
                from: sea.from || sea.fromDate || '',
                to: sea.to || sea.toDate || '',
                fromDate: sea.from || sea.fromDate || '',
                toDate: sea.to || sea.toDate || '',
                deadweight: sea.deadweight || '',
                engineTypePower: sea.engineTypePower || '',
                ownerOperator: sea.ownerOperator || '',
                periodMonths: sea.periodMonths || '',
                experienceCategories: sea.experienceCategories || [],
                sortOrder: index,
                ...(isSeaSynced ? { _skipLockedFields: true } : {}),
              } as LegacySeaService;

              const capturedCompanySeaLocalId = sea.id;
              batch3Operations.push(async () => {
                if (sea.seaUuid) {
                  for (const att of capturedDeletedAttachments) {
                    await crewPoolApiV2.removeSeaServiceAttachment(crewIdentifier, sea.seaUuid, att.attUuid);
                  }
                }

                const rawV2Data = mapLegacySeaServiceToV2(seaData);
                if ((seaData as any)._skipLockedFields) {
                  delete rawV2Data.vesselName;
                  delete rawV2Data.vesselUuid;
                  delete rawV2Data.vesselTypeUuid;
                  delete rawV2Data.rank;
                  delete rawV2Data.fromDate;
                  delete rawV2Data.toDate;
                }
                const v2Data = withAuditUser(rawV2Data);
                let savedSea: any;
                let entityUuid: string;
                if (sea.seaUuid) {
                  savedSea = await crewPoolApiV2.updateSeaService(crewIdentifier, sea.seaUuid, v2Data);
                  entityUuid = sea.seaUuid;
                } else {
                  savedSea = await crewPoolApiV2.createSeaService(crewIdentifier, v2Data);
                  entityUuid = savedSea?.seaUuid || savedSea?.sea_uuid;
                }
                if (entityUuid && !sea.seaUuid) {
                  uuidUpdates.push({ section: 'currentCompanySeaService', localId: capturedCompanySeaLocalId, uuid: entityUuid });
                }

                const newAtts = capturedNewAttachments.filter(att => !att.attUuid || att.isNew);
                for (const att of newAtts) {
                  if (att.fileName && (att.fileData)) {
                    await crewPoolApiV2.addSeaServiceAttachment(crewIdentifier, entityUuid, {
                      fileName: att.fileName,
                      fileUrl: att.fileData,
                      fileSize: att.fileSize,
                      mimeType: att.fileType,
                    });
                  }
                }
                return savedSea;
              });
            });
          }

          if (cleanedFormData.externalSeaService && cleanedFormData.externalSeaService.length > 0) {
            cleanedFormData.externalSeaService.forEach((sea: any, index: number) => {
              const seaAttachments = sea.attachments || [];
              const capturedNewAttachments = [...seaAttachments.filter((att: any) => !att.attUuid || att.isNew)].map((att: any) => ({
                attUuid: att.attUuid,
                isNew: att.isNew || !att.attUuid,
                fileName: att.name || att.fileName || '',
                fileData: att.data || att.fileData || '',
                fileSize: String(att.size || att.fileSize || 0),
                fileType: att.type || att.fileType || '',
              }));
              const capturedDeletedAttachments = [...seaAttachments.filter((att: any) => att.isDeleted && att.attUuid)];

              const seaData: LegacySeaService = {
                seaUuid: sea.seaUuid,
                isCompanyService: false,
                vesselName: sea.vesselName || '',
                vesselCode: sea.vesselCode || '',
                vesselType: sea.vesselType || '',
                deadweight: sea.deadweight || '',
                engineTypePower: sea.engineTypePower || '',
                ownerOperator: sea.ownerOperator || '',
                rank: sea.rank || '',
                from: sea.from || sea.fromDate || '',
                to: sea.to || sea.toDate || '',
                fromDate: sea.from || sea.fromDate || '',
                toDate: sea.to || sea.toDate || '',
                periodMonths: sea.periodMonths || '',
                experienceCategories: sea.experienceCategories || [],
                sortOrder: index,
              };

              const capturedExtSeaLocalId = sea.id;
              batch3Operations.push(async () => {
                if (sea.seaUuid) {
                  for (const att of capturedDeletedAttachments) {
                    await crewPoolApiV2.removeSeaServiceAttachment(crewIdentifier, sea.seaUuid, att.attUuid);
                  }
                }

                const v2Data = withAuditUser(mapLegacySeaServiceToV2(seaData));
                let savedSea: any;
                let entityUuid: string;
                if (sea.seaUuid) {
                  savedSea = await crewPoolApiV2.updateSeaService(crewIdentifier, sea.seaUuid, v2Data);
                  entityUuid = sea.seaUuid;
                } else {
                  savedSea = await crewPoolApiV2.createSeaService(crewIdentifier, v2Data);
                  entityUuid = savedSea?.seaUuid || savedSea?.sea_uuid;
                }
                if (entityUuid && !sea.seaUuid) {
                  uuidUpdates.push({ section: 'externalSeaService', localId: capturedExtSeaLocalId, uuid: entityUuid });
                }

                const newAtts = capturedNewAttachments.filter(att => !att.attUuid || att.isNew);
                for (const att of newAtts) {
                  if (att.fileName && (att.fileData)) {
                    await crewPoolApiV2.addSeaServiceAttachment(crewIdentifier, entityUuid, {
                      fileName: att.fileName,
                      fileUrl: att.fileData,
                      fileSize: att.fileSize,
                      mimeType: att.fileType,
                    });
                  }
                }
                return savedSea;
              });
            });
          }

          const nonEmptyMedicals = (cleanedFormData.preJoiningMedicals || []).filter((med: any) => {
            if (med.medUuid) return true;
            const hasAttachments = (med.attachments || []).some((att: any) => !att.isDeleted);
            return (med.vesselCode || med.vessel || med.dateOfMedical || med.bp || med.weight || med.anyMedicationPrescribed || med.clinicHospital || med.fitnessForDuty || med.expiry || hasAttachments);
          });
          if (nonEmptyMedicals.length > 0) {
            nonEmptyMedicals.forEach((med: any, index: number) => {
              const medAttachments = med.attachments || [];
              const capturedNewAttachments = [...medAttachments.filter((att: any) => !att.attUuid || att.isNew)].map((att: any) => ({
                attUuid: att.attUuid,
                isNew: att.isNew || !att.attUuid,
                fileName: att.name || att.fileName || '',
                fileData: att.data || att.fileData || '',
                fileSize: String(att.size || att.fileSize || 0),
                fileType: att.type || att.fileType || '',
              }));
              const capturedDeletedAttachments = [...medAttachments.filter((att: any) => att.isDeleted && att.attUuid)];

              const medData: LegacyPreJoiningMedical = {
                medUuid: med.medUuid,
                vesselCode: med.vesselCode || '',
                vesselName: med.vessel || '',
                vessel: med.vessel || '',
                dateOfMedical: med.dateOfMedical || '',
                bp: med.bp || '',
                weight: med.weight || '',
                anyMedicationPrescribed: med.anyMedicationPrescribed || '',
                clinicHospital: med.clinicHospital || '',
                fitnessForDuty: med.fitnessForDuty || '',
                expiryDate: med.expiry || '',
                expiry: med.expiry || '',
                sortOrder: index,
              };

              const capturedMedLocalId = med.id;
              batch4Operations.push(async () => {
                if (med.medUuid) {
                  for (const att of capturedDeletedAttachments) {
                    await crewPoolApiV2.removeMedicalAttachment(crewIdentifier, med.medUuid, att.attUuid);
                  }
                }

                const v2Data = withAuditUser(mapLegacyPreJoiningMedicalToV2(medData));
                let savedMed: any;
                let entityUuid: string;
                if (med.medUuid) {
                  savedMed = await crewPoolApiV2.updateMedical(crewIdentifier, med.medUuid, v2Data);
                  entityUuid = med.medUuid;
                } else {
                  savedMed = await crewPoolApiV2.createMedical(crewIdentifier, v2Data);
                  entityUuid = savedMed?.medUuid || savedMed?.med_uuid;
                }
                if (entityUuid && !med.medUuid) {
                  uuidUpdates.push({ section: 'preJoiningMedicals', localId: capturedMedLocalId, uuid: entityUuid });
                }

                const newAtts = capturedNewAttachments.filter(att => !att.attUuid || att.isNew);
                for (const att of newAtts) {
                  if (att.fileName && (att.fileData)) {
                    await crewPoolApiV2.addMedicalAttachment(crewIdentifier, entityUuid, {
                      fileName: att.fileName,
                      fileUrl: att.fileData,
                      fileSize: att.fileSize,
                      mimeType: att.fileType,
                    });
                  }
                }
                return savedMed;
              });
            });
          }

          const nonEmptyVisits = (cleanedFormData.doctorVisits || []).filter((visit: any) => {
            if (visit.visitUuid) return true;
            const hasAttachments = (visit.attachments || []).some((att: any) => !att.isDeleted);
            return (visit.vessel || visit.port || visit.date || visit.complaint || visit.doctorComments || visit.doctorName || visit.clinicHospital || visit.diagnosis || visit.treatment || visit.followUpDate || hasAttachments);
          });
          if (nonEmptyVisits.length > 0) {
            nonEmptyVisits.forEach((visit: any, index: number) => {
              const visitAttachments = visit.attachments || [];
              const capturedNewAttachments = [...visitAttachments.filter((att: any) => !att.attUuid || att.isNew)].map((att: any) => ({
                attUuid: att.attUuid,
                isNew: att.isNew || !att.attUuid,
                fileName: att.name || att.fileName || '',
                fileData: att.data || att.fileData || '',
                fileSize: String(att.size || att.fileSize || 0),
                fileType: att.type || att.fileType || '',
              }));
              const capturedDeletedAttachments = [...visitAttachments.filter((att: any) => att.isDeleted && att.attUuid)];

              const visitData: LegacyDoctorVisit = {
                visitUuid: visit.visitUuid,
                vessel: visit.vessel || '',
                port: visit.port || '',
                date: visit.date || '',
                visitDate: visit.date || '',
                doctorName: visit.doctorName || '',
                clinicHospital: visit.clinicHospital || '',
                complaint: visit.complaint || '',
                doctorComments: visit.doctorComments || '',
                diagnosis: visit.diagnosis || '',
                treatment: visit.treatment || '',
                followUpDate: visit.followUpDate || '',
                sortOrder: index,
              };

              const capturedVisitLocalId = visit.id;
              batch4Operations.push(async () => {
                if (visit.visitUuid) {
                  for (const att of capturedDeletedAttachments) {
                    await crewPoolApiV2.removeDoctorVisitAttachment(crewIdentifier, visit.visitUuid, att.attUuid);
                  }
                }

                const v2Data = withAuditUser(mapLegacyDoctorVisitToV2(visitData));
                let savedVisit: any;
                let entityUuid: string;
                if (visit.visitUuid) {
                  savedVisit = await crewPoolApiV2.updateDoctorVisit(crewIdentifier, visit.visitUuid, v2Data);
                  entityUuid = visit.visitUuid;
                } else {
                  savedVisit = await crewPoolApiV2.createDoctorVisit(crewIdentifier, v2Data);
                  entityUuid = savedVisit?.visitUuid || savedVisit?.visit_uuid;
                }
                if (entityUuid && !visit.visitUuid) {
                  uuidUpdates.push({ section: 'doctorVisits', localId: capturedVisitLocalId, uuid: entityUuid });
                }

                const newAtts = capturedNewAttachments.filter(att => !att.attUuid || att.isNew);
                for (const att of newAtts) {
                  if (att.fileName && (att.fileData)) {
                    await crewPoolApiV2.addDoctorVisitAttachment(crewIdentifier, entityUuid, {
                      fileName: att.fileName,
                      fileUrl: att.fileData,
                      fileSize: att.fileSize,
                      mimeType: att.fileType,
                    });
                  }
                }
                return savedVisit;
              });
            });
          }

          await processBatch('Batch 1: Documents + Visas', batch1Operations);
          await processBatch('Batch 2: Education + Licenses', batch2Operations);
          await processBatch('Batch 3: Training + Sea Service', batch3Operations);
          await processBatch('Batch 4: Medicals + Doctor Visits', batch4Operations);

          if (uuidUpdates.length > 0) {
            const uuidKeyMap: Record<string, string> = {
              documents: 'docUuid',
              visas: 'visaUuid',
              education: 'eduUuid',
              licenses: 'licUuid',
              trainingCourses: 'trainUuid',
              currentCompanySeaService: 'seaUuid',
              externalSeaService: 'seaUuid',
              preJoiningMedicals: 'medUuid',
              doctorVisits: 'visitUuid',
            };
            setFormData(prev => {
              const updated = { ...prev };
              for (const { section, localId, uuid } of uuidUpdates) {
                const uuidField = uuidKeyMap[section];
                if (uuidField && Array.isArray((updated as any)[section])) {
                  (updated as any)[section] = (updated as any)[section].map((item: any) =>
                    item.id === localId ? { ...item, [uuidField]: uuid } : item
                  );
                }
              }
              return updated;
            });
          }

          if (batchErrors.length > 0) {
            console.error('V2: Batch execution completed with errors:', batchErrors);
            toast({
              title: "Partially Saved",
              description: `Some records failed to save: ${batchErrors.length} error(s). Please review and try again.`,
              variant: "destructive",
              duration: 6000,
            });
          } else {
            toast({
              title: "Saved",
              description: "Crew member updated successfully.",
              duration: 3000,
            });
          }

          queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew'] });
          invalidateCrewData(crewIdentifier);
          await queryClient.refetchQueries({ queryKey: [V2_QUERY_KEY, 'crew', crewIdentifier, 'full-profile'] });
        } catch (error) {
          console.error('V2: Error during batch execution:', error);
          toast({
            title: "Save Error",
            description: "Some records failed to save. Please try again.",
            variant: "destructive",
            duration: 5000,
          });
        } finally {
          isBatchSavingRef.current = false;
          setIsBatchSaving(false);
        }
      })();
    } else {
      // Create new crew member - generate ID based on current date
      const newId = new Date().toISOString().slice(0, 10); // YYYY-MM-DD format
      const formDataWithId = { ...dataWithPhoto, id: newId };
      createCrewMutation.mutate(formDataWithId);
    }
  };

  // Export to PDF functionality
  const handleExport = async () => {
    try {
      const crewName = `${formData.firstName || 'Unknown'} ${formData.familyName || 'Crew'}`;
      
      const pdfFormData: CrewInfoFormData = {
        firstName: formData.firstName,
        middleName: formData.middleName,
        familyName: formData.familyName,
        gender: formData.gender,
        nationality: formData.nationality,
        presentRank: formData.presentRank,
        dateOfBirth: formData.dateOfBirth,
        ageInYears: formData.ageInYears,
        placeOfBirthCity: formData.placeOfBirthCity,
        placeOfBirthCountry: formData.placeOfBirthCountry,
        heightCm: formData.heightCm,
        weightKg: formData.weightKg,
        bmi: formData.bmi,
        nativeLanguage: formData.nativeLanguage,
        foreignLanguages: formData.foreignLanguages,
        englishProficiency: formData.englishProficiency,
        rankAppliedFor: formData.rankAppliedFor,
        vesselType: formData.vesselType,
        manningAgent: formData.manningAgent,
        crewPool: formData.crewPool,
        employeeId: formData.employeeId,
        nextAvailability: formData.nextAvailability,
        countryOfResidence: formData.countryOfResidence,
        nearestAirport: formData.nearestAirport,
        residentialAddressLine1: formData.residentialAddressLine1,
        residentialAddressLine2: formData.residentialAddressLine2,
        contactLandline: formData.contactLandline,
        mobile: formData.mobile,
        email: formData.email,
        maritalStatus: formData.maritalStatus,
        numberOfDependentChildren: formData.numberOfDependentChildren,
        fatherName: formData.fatherName,
        motherName: formData.motherName,
        spouseFirstName: formData.spouseFirstName,
        spouseMiddleName: formData.spouseMiddleName,
        spouseFamilyName: formData.spouseFamilyName,
        spouseDateOfBirth: formData.spouseDateOfBirth,
        children: formData.children,
        nokFirstName: formData.nokFirstName,
        nokMiddleName: formData.nokMiddleName,
        nokFamilyName: formData.nokFamilyName,
        nokTelephone: formData.nokTelephone,
        nokEmail: formData.nokEmail,
        nokAddress: formData.nokAddress,
        nokRelationship: formData.nokRelationship,
        documents: formData.documents.map(d => ({
          id: d.id,
          documentId: d.documentId,
          document: d.document,
          number: d.number,
          issued: d.issued,
          expiry: d.expiry,
          issuingAuthority: d.issuingAuthority,
        })),
        visas: formData.visas.map(v => ({
          id: v.id,
          countryId: v.countryId,
          issuingCountry: v.issuingCountry,
          serialNo: v.serialNo,
          issued: v.issued,
          expiry: v.expiry,
          visaType: v.visaType,
        })),
        education: formData.education.map(e => ({
          id: e.id,
          dateOfCompletion: e.dateOfCompletion,
          schoolCollegeUniversity: e.schoolCollegeUniversity,
          subjectsField: e.subjectsField,
          qualifications: e.qualifications,
        })),
        licenses: formData.licenses.map(l => ({
          id: l.id,
          licenseId: l.licenseId,
          certificateDocument: l.certificateDocument,
          abbr: l.abbr,
          requirement: l.requirement,
          certificateNo: l.certificateNo,
          issuingAuthority: l.issuingAuthority,
          issued: l.issued,
          expiry: l.expiry,
          archivedAt: l.archivedAt,
          archivedReason: l.archivedReason,
        })),
        trainingCourses: formData.trainingCourses.map(t => ({
          id: t.id,
          courseId: t.courseId,
          companyId: t.companyId,
          trainingCourse: t.trainingCourse,
          abbr: t.abbr,
          requirement: t.requirement,
          certificateNo: t.certificateNo,
          issuingAuthority: t.issuingAuthority,
          issued: t.issued,
          expiry: t.expiry,
        })),
        currentCompanySeaService: formData.currentCompanySeaService.map(s => ({
          id: s.id,
          vesselName: s.vesselName,
          vesselCode: s.vesselCode,
          vesselType: s.vesselType,
          deadweight: s.deadweight,
          engineTypePower: s.engineTypePower,
          ownerOperator: s.ownerOperator,
          rank: s.rank,
          from: s.from,
          to: s.to,
          periodMonths: s.periodMonths,
          experienceCategories: s.experienceCategories,
        })),
        externalSeaService: formData.externalSeaService.map(s => ({
          id: s.id,
          vesselName: s.vesselName,
          vesselCode: s.vesselCode,
          vesselType: s.vesselType,
          deadweight: s.deadweight,
          engineTypePower: s.engineTypePower,
          ownerOperator: s.ownerOperator,
          rank: s.rank,
          from: s.from,
          to: s.to,
          periodMonths: s.periodMonths,
          experienceCategories: s.experienceCategories,
        })),
        preJoiningMedicals: formData.preJoiningMedicals.map(m => ({
          id: m.id,
          vesselCode: m.vesselCode,
          vessel: m.vessel,
          dateOfMedical: m.dateOfMedical,
          bp: m.bp,
          weight: m.weight,
          anyMedicationPrescribed: m.anyMedicationPrescribed,
          fitnessForDuty: m.fitnessForDuty,
          expiry: m.expiry,
        })),
        doctorVisits: formData.doctorVisits.map(v => ({
          id: v.id,
          vessel: v.vessel,
          port: v.port,
          date: v.date,
          complaint: v.complaint,
          doctorComments: v.doctorComments,
        })),
      };

      const nokInfoStr = formData.nokFirstName 
        ? `${formData.nokFirstName} ${formData.nokFamilyName || ''}, ${formData.nokRelationship || ''}, ${formData.nokTelephone || ''}`.trim()
        : null;
      
      const dashboardInfo = dashboardData ? {
        status: statusData ? {
          status: statusData.status || '',
          vessel: statusData.vessel || null,
          joinedDate: statusData.joinedDate || null,
          sailingDue: statusData.sailingDue || null,
          nextAvailability: statusData.nextAvailability || null,
          nearestAirport: formData.nearestAirport || null,
          nokInfo: nokInfoStr,
        } : undefined,
        experience: experienceData ? {
          company: experienceData.company || 0,
          rank: experienceData.rank || 0,
          tankers: experienceData.tankers || 0,
          ocw: experienceData.ocw || 0,
          endorsements: experienceData.endorsements || 0,
        } : undefined,
      } : undefined;

      await generateCrewInfoPDF(pdfFormData, crewName, dashboardInfo, uploadedPhoto);
      
      toast({
        title: "Export Successful",
        description: `Crew information exported as PDF for ${crewName}`,
      });
    } catch (error) {
      console.error('Failed to export PDF:', error);
      toast({
        title: "Export Failed",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Auto-save functionality — saves the specific section's data to the backend
  const handleSectionAutoSave = async (sectionId: string, crewUuidOverride?: string) => {
    if (isBatchSavingRef.current) return;
    const crewUuid = crewUuidOverride || getEffectiveCrewUuid();
    if (!crewUuid) return;

    if (sectionId === 'B1') {
      const personalDetailsData = {
        height: formData.heightCm,
        weight: formData.weightKg,
        bmi: formData.bmi,
        dob: formData.dateOfBirth,
        ageInYears: formData.ageInYears,
        placeOfBirthCity: formData.placeOfBirthCity,
        placeOfBirthCountry: formData.placeOfBirthCountry,
        nativeLanguage: formData.nativeLanguage,
        foreignLanguages: formData.foreignLanguages,
        englishProficiency: formData.englishProficiency,
        manningAgent: formData.manningAgent,
        crewPool: formData.crewPool,
      };
      updateCrewMutation.mutate({ id: crewUuid, data: { ...formData, uploadedPhoto: uploadedPhoto || null } });
      savePersonalDetailsMutationV2.mutate({ crewUuid, data: personalDetailsData });
      if (formData.vesselType && Array.isArray(formData.vesselType) && formData.vesselType.length > 0) {
        saveVesselTypesMutationV2.mutate({ crewUuid, vesselTypeUuids: formData.vesselType });
      }
    } else if (sectionId === 'B2') {
      const addressData = {
        countryOfResidence: formData.countryOfResidence,
        nearestAirport: formData.nearestAirport,
        residentialAddressLine1: formData.residentialAddressLine1,
        residentialAddressLine2: formData.residentialAddressLine2,
        contactLandline: formData.contactLandline,
        mobile: formData.mobile,
        email: formData.email,
      };
      saveAddressMutationV2.mutate({ crewUuid, data: addressData });
    } else if (sectionId === 'B3') {
      let b3HasErrors = false;
      const familyInfoData = {
        maritalStatus: formData.maritalStatus,
        numberOfDependentChildren: formData.numberOfDependentChildren,
        fatherName: formData.fatherName,
        motherName: formData.motherName,
        spouseFirstName: formData.spouseFirstName,
        spouseMiddleName: formData.spouseMiddleName,
        spouseFamilyName: formData.spouseFamilyName,
        spouseDateOfBirth: formData.spouseDateOfBirth,
      };
      try {
        await crewPoolApiV2.saveFamilyInfo(crewUuid, mapLegacyFamilyInfoToV2(familyInfoData));
      } catch (e) {
        console.error('[V2] Failed to save family info:', e);
        b3HasErrors = true;
      }
      const nokData = {
        firstName: formData.nokFirstName,
        middleName: formData.nokMiddleName,
        familyName: formData.nokFamilyName,
        relationship: formData.nokRelationship,
        telephone: formData.nokTelephone,
        email: formData.nokEmail,
        address: formData.nokAddress,
      };
      if (nokData.firstName || nokData.familyName || nokData.telephone || nokData.email) {
        try {
          await crewPoolApiV2.saveNextOfKin(crewUuid, nokData);
        } catch (e) {
          console.error('[V2] Failed to save next of kin:', e);
          b3HasErrors = true;
        }
      }
      if (deletedChildUuids.length > 0) {
        const successfulDeletes: string[] = [];
        for (const childUuid of deletedChildUuids) {
          try {
            await crewPoolApiV2.deleteChild(crewUuid, childUuid);
            successfulDeletes.push(childUuid);
          } catch (e) {
            console.error(`[V2] Failed to delete child ${childUuid}:`, e);
            b3HasErrors = true;
          }
        }
        setDeletedChildUuids(prev => prev.filter(id => !successfulDeletes.includes(id)));
      }
      if (formData.children && formData.children.length > 0) {
        for (let index = 0; index < formData.children.length; index++) {
          const child = formData.children[index] as any;
          const childData = {
            firstName: child.firstName, middleName: child.middleName,
            familyName: child.familyName, dob: child.dateOfBirth,
            gender: child.gender, sortOrder: index,
          };
          try {
            if (child.childUuid) {
              await crewPoolApiV2.updateChild(crewUuid, child.childUuid, childData);
            } else {
              const created = await crewPoolApiV2.createChild(crewUuid, childData);
              if (created?.childUuid) {
                setFormData(prev => ({
                  ...prev,
                  children: prev.children.map((c, i) =>
                    i === index ? { ...c, childUuid: created.childUuid } : c
                  )
                }));
              }
            }
          } catch (e) {
            console.error(`[V2] Failed to save child ${child.firstName}:`, e);
            b3HasErrors = true;
          }
        }
      }
      invalidateCrewData(crewUuid);
      if (b3HasErrors) {
        toast({
          title: "Partial save",
          description: "Some items in Section B3 could not be saved. Please try again.",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }
    }

    toast({
      title: "Auto-saved",
      description: `Section ${sectionId} has been saved.`,
      duration: 1500,
    });
  };

  // Crew member selection handler
  const handleCrewMemberSelection = (selectedCrewMember: CrewMember) => {
    // Update form data with selected crew member's basic information
    // presentRank is normalized to convert positions to actual ranks
    setFormData(prev => ({
      ...prev,
      firstName: selectedCrewMember.firstName || '',
      middleName: selectedCrewMember.middleName || '',
      familyName: selectedCrewMember.familyName || '',
      nationality: selectedCrewMember.nationality || '',
      presentRank: normalizeRank(selectedCrewMember.presentRank || '') || selectedCrewMember.presentRank || '',
      dateOfBirth: selectedCrewMember.dob || '',
      ageInYears: selectedCrewMember.age || '',
      employeeId: selectedCrewMember.employeeId || '',
    }));

    // Close dropdown
    setShowCrewDropdown(false);

    // Reset photo
    setUploadedPhoto(null);

    // Call parent handler if provided
    if (onCrewMemberChange) {
      onCrewMemberChange(selectedCrewMember);
    }

    toast({
      title: "Crew Member Changed",
      description: `Switched to ${selectedCrewMember.firstName} ${selectedCrewMember.familyName}`,
      duration: 2000,
    });
  };

  // Get effective crew UUID (either from existing crew or newly created)
  const getEffectiveCrewUuid = (): string | null => {
    return crewMember?.crewUuid || crewMember?.id || createdCrewId || null;
  };

  // Ensure crew record exists before allowing section edits
  // This implements the "save-before-edit" pattern for new crew records
  const ensureCrewExists = async (): Promise<string | null> => {
    const existingUuid = getEffectiveCrewUuid();
    if (existingUuid) {
      return existingUuid;
    }

    // Race condition guard - prevent duplicate creation on rapid clicks
    if (isCreatingCrew) {
      return null; // Already creating, don't proceed
    }

    // No crew UUID exists - need to create parent record first
    setIsCreatingCrew(true);
    try {
      // Create crew record with current form data using V2 mapping pipeline
      const legacyCrewData = {
        firstName: formData.firstName || '',
        familyName: formData.familyName || '',
        middleName: formData.middleName || '',
        gender: formData.gender || '',
        nationality: formData.nationality || '',
        presentRank: formData.presentRank || '',
        dateOfBirth: formData.dateOfBirth || '',
        uploadedPhoto: uploadedPhoto || null,
      };
      
      // Use the same V2 mapping pipeline as the createCrewMutationV2 hook
      const v2Data = mapLegacyCrewToV2(legacyCrewData);
      
      const result = await crewPoolApiV2.createCrew(v2Data);
      const newCrewUuid = result?.crewUuid;
      
      if (newCrewUuid) {
        setCreatedCrewId(newCrewUuid);
        
        queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool', 'crew'] });
        invalidateCrewData(newCrewUuid);
        
        // Chain save of child tables with the new crewUuid (same as Save button path)
        // This ensures B1/address/family data is persisted immediately
        const personalDetailsData = {
          height: formData.heightCm,
          weight: formData.weightKg,
          bmi: formData.bmi,
          dob: formData.dateOfBirth,
          ageInYears: formData.ageInYears,
          placeOfBirthCity: formData.placeOfBirthCity,
          placeOfBirthCountry: formData.placeOfBirthCountry,
          nativeLanguage: formData.nativeLanguage,
          foreignLanguages: formData.foreignLanguages,
          englishProficiency: formData.englishProficiency,
          manningAgent: formData.manningAgent,
          crewPool: formData.crewPool,
        };
        crewPoolApiV2.savePersonalDetails(newCrewUuid, mapLegacyPersonalDetailsToV2(personalDetailsData)).catch(
          (err) => console.error('[V2] Personal Details auto-save error:', err)
        );
        
        const addressData = {
          countryOfResidence: formData.countryOfResidence,
          nearestAirport: formData.nearestAirport,
          residentialAddressLine1: formData.residentialAddressLine1,
          residentialAddressLine2: formData.residentialAddressLine2,
          contactLandline: formData.contactLandline,
          mobile: formData.mobile,
          email: formData.email,
        };
        crewPoolApiV2.saveAddress(newCrewUuid, mapLegacyAddressToV2(addressData)).catch(
          (err) => console.error('[V2] Address auto-save error:', err)
        );
        
        const familyInfoData = {
          maritalStatus: formData.maritalStatus,
          numberOfDependentChildren: formData.numberOfDependentChildren,
          fatherName: formData.fatherName,
          motherName: formData.motherName,
          spouseFirstName: formData.spouseFirstName,
          spouseMiddleName: formData.spouseMiddleName,
          spouseFamilyName: formData.spouseFamilyName,
          spouseDateOfBirth: formData.spouseDateOfBirth,
        };
        crewPoolApiV2.saveFamilyInfo(newCrewUuid, mapLegacyFamilyInfoToV2(familyInfoData)).catch(
          (err) => console.error('[V2] Family Info auto-save error:', err)
        );

        if (Array.isArray(formData.vesselType) && formData.vesselType.length > 0) {
          crewPoolApiV2.saveVesselTypesApplied(newCrewUuid, formData.vesselType).catch(
            (err) => console.error('[V2] Vessel Types auto-save error:', err)
          );
        }
        
        // Notify parent component if needed
        if (onCrewMemberChange && result) {
          onCrewMemberChange(result);
        }
        
        toast({
          title: "Record Created",
          description: "Crew record saved. You can now edit sections.",
          duration: 2000,
        });
        
        return newCrewUuid;
      }
      
      throw new Error('No crewUuid returned from create');
    } catch (error: any) {
      console.error('[V2] Failed to auto-create crew:', error);
      toast({
        title: "Error",
        description: `Failed to create crew record: ${error.message}`,
        variant: "destructive",
        duration: 5000,
      });
      return null;
    } finally {
      setIsCreatingCrew(false);
    }
  };

  // Toggle edit section with auto-save and ensure crew exists (B2/B3 only)
  const toggleEditSection = async (sectionId: 'B1' | 'B2' | 'B3') => {
    const isCurrentlyEditing = editingSections[sectionId];
    
    // For B2 and B3, validate mandatory fields before allowing edit on new crew
    if (!isCurrentlyEditing && sectionId !== 'B1') {
      if (!(formData.firstName || '').trim()) {
        toast({
          title: "Missing Required Field",
          description: "Please fill in 'First Name' in Section B1 (General Particulars) before editing this section.",
          variant: "destructive",
        });
        return;
      }
      const crewUuidResult = await ensureCrewExists();
      if (!crewUuidResult) {
        return;
      }
    }
    
    // If another section is being edited, auto-save it before switching
    const currentlyEditing = Object.keys(editingSections).find(key => editingSections[key]);
    if (currentlyEditing && currentlyEditing !== sectionId && editingSections[currentlyEditing]) {
      handleSectionAutoSave(currentlyEditing);
      setEditingSections(prev => ({ ...prev, [currentlyEditing]: false }));
    }
    
    setEditingSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const queryClient = useQueryClient();

  // V2 Create crew member mutation
  const createCrewMutationV2 = useCreateCrewV2();
  
  // V2 Update crew member mutation  
  const updateCrewMutationV2 = useUpdateCrewV2();
  
  // V2 Section save mutations
  const savePersonalDetailsMutationV2 = useSavePersonalDetailsV2();
  const saveAddressMutationV2 = useSaveAddressV2();
  const saveFamilyInfoMutationV2 = useSaveFamilyInfoV2();
  const saveChildMutationV2 = useSaveChildV2();
  const saveNextOfKinMutationV2 = useSaveNextOfKinV2();
  const deleteChildMutationV2 = useDeleteChildV2();
  const saveVesselTypesMutationV2 = useSaveVesselTypesV2();
  const saveDocumentMutationV2 = useSaveDocumentV2();
  const saveVisaMutationV2 = useSaveVisaV2();
  const saveEducationMutationV2 = useSaveEducationV2();
  const saveLicenseMutationV2 = useSaveLicenseV2();
  const saveTrainingCourseMutationV2 = useSaveTrainingCourseV2();
  const saveSeaServiceMutationV2 = useSaveSeaServiceV2();
  const saveMedicalMutationV2 = useSaveMedicalV2();
  const saveDoctorVisitMutationV2 = useSaveDoctorVisitV2();
  const deleteDocumentMutationV2 = useDeleteDocumentV2();
  const deleteVisaMutationV2 = useDeleteVisaV2();
  const deleteEducationMutationV2 = useDeleteEducationV2();
  const deleteLicenseMutationV2 = useDeleteLicenseV2();
  const deleteTrainingCourseMutationV2 = useDeleteTrainingCourseV2();
  const deleteSeaServiceMutationV2 = useDeleteSeaServiceV2();
  const deleteMedicalMutationV2 = useDeleteMedicalV2();
  const deleteDoctorVisitMutationV2 = useDeleteDoctorVisitV2();
  const addDocumentAttachmentV2 = useAddDocumentAttachmentV2();
  const removeDocumentAttachmentV2 = useRemoveDocumentAttachmentV2();
  const addVisaAttachmentV2 = useAddVisaAttachmentV2();
  const removeVisaAttachmentV2 = useRemoveVisaAttachmentV2();
  const addEducationAttachmentV2 = useAddEducationAttachmentV2();
  const removeEducationAttachmentV2 = useRemoveEducationAttachmentV2();
  const addLicenseAttachmentV2 = useAddLicenseAttachmentV2();
  const removeLicenseAttachmentV2 = useRemoveLicenseAttachmentV2();
  const addTrainingAttachmentV2 = useAddTrainingAttachmentV2();
  const removeTrainingAttachmentV2 = useRemoveTrainingAttachmentV2();
  const addSeaServiceAttachmentV2 = useAddSeaServiceAttachmentV2();
  const removeSeaServiceAttachmentV2 = useRemoveSeaServiceAttachmentV2();
  const addMedicalAttachmentV2 = useAddMedicalAttachmentV2();
  const removeMedicalAttachmentV2 = useRemoveMedicalAttachmentV2();
  const addDoctorVisitAttachmentV2 = useAddDoctorVisitAttachmentV2();
  const removeDoctorVisitAttachmentV2 = useRemoveDoctorVisitAttachmentV2();
  
  // Wrapper for create mutation with UI feedback
  // After parent record is created, chain saves for personal details, address, and family
  const createCrewMutation = {
    mutate: (data: any) => {
      createCrewMutationV2.mutate(data, {
        onSuccess: (responseData: any) => {
          const crewUuid = responseData?.crewUuid;
          const generatedEmpNo = responseData?.empNo || responseData?.employeeId;
          
          if (generatedEmpNo) {
            setFormData(prev => ({ ...prev, employeeId: generatedEmpNo }));
          }
          
          if (crewUuid) {
            setCreatedCrewId(crewUuid);
            // NOTE: We intentionally do NOT call onCrewMemberChange here.
            // Calling it would update the `crewMember` prop from null to the new record,
            // which triggers the form-data load effect and overwrites the user's in-progress
            // edits with the (incomplete) freshly-created record from the API.
            // The `createdCrewId` state is sufficient — subsequent saves use:
            //   existingUuid = crewMember?.crewUuid || crewMember?.id || createdCrewId
            
            // Chain save of child tables with the new crewUuid
            // Personal Details (B1 fields)
            const personalDetailsData = {
              height: data.heightCm || formData.heightCm,
              weight: data.weightKg || formData.weightKg,
              bmi: data.bmi || formData.bmi,
              dob: data.dateOfBirth || formData.dateOfBirth,
              ageInYears: data.ageInYears || formData.ageInYears,
              placeOfBirthCity: data.placeOfBirthCity || formData.placeOfBirthCity,
              placeOfBirthCountry: data.placeOfBirthCountry || formData.placeOfBirthCountry,
              nativeLanguage: data.nativeLanguage || formData.nativeLanguage,
              foreignLanguages: data.foreignLanguages || formData.foreignLanguages,
              englishProficiency: data.englishProficiency || formData.englishProficiency,
              manningAgent: data.manningAgent || formData.manningAgent,
              crewPool: data.crewPool || formData.crewPool,
            };
            savePersonalDetailsMutationV2.mutate({ crewUuid, data: personalDetailsData }, {
              onError: (err) => console.error('[V2] Personal Details chain save error:', err),
              onSuccess: () => {},
            });
            
            // Address (A1.2 fields)
            const addressData = {
              countryOfResidence: data.countryOfResidence || formData.countryOfResidence,
              nearestAirport: data.nearestAirport || formData.nearestAirport,
              residentialAddressLine1: data.residentialAddressLine1 || formData.residentialAddressLine1,
              residentialAddressLine2: data.residentialAddressLine2 || formData.residentialAddressLine2,
              contactLandline: data.contactLandline || formData.contactLandline,
              mobile: data.mobile || formData.mobile,
              email: data.email || formData.email,
            };
            saveAddressMutationV2.mutate({ crewUuid, data: addressData }, {
              onError: (err) => console.error('[V2] Address chain save error:', err),
              onSuccess: () => {},
            });
            
            // Family Info (A1.3 fields)
            const familyInfoData = {
              maritalStatus: data.maritalStatus || formData.maritalStatus,
              numberOfDependentChildren: data.numberOfDependentChildren || formData.numberOfDependentChildren,
              fatherName: data.fatherName || formData.fatherName,
              motherName: data.motherName || formData.motherName,
              spouseFirstName: data.spouseFirstName || formData.spouseFirstName,
              spouseMiddleName: data.spouseMiddleName || formData.spouseMiddleName,
              spouseFamilyName: data.spouseFamilyName || formData.spouseFamilyName,
              spouseDateOfBirth: data.spouseDateOfBirth || formData.spouseDateOfBirth,
            };
            saveFamilyInfoMutationV2.mutate({ crewUuid, data: familyInfoData }, {
              onError: (err) => console.error('[V2] Family Info chain save error:', err),
              onSuccess: () => {},
            });

            const vesselTypes = data.vesselType || formData.vesselType;
            if (Array.isArray(vesselTypes) && vesselTypes.length > 0) {
              saveVesselTypesMutationV2.mutate({ crewUuid, vesselTypeUuids: vesselTypes }, {
                onError: (err) => console.error('[V2] Vessel Types chain save error:', err),
                onSuccess: () => {},
              });
            }
          }
          toast({
            title: "Saved",
            description: "Crew member created successfully. You can continue editing.",
            duration: 3000,
          });
        },
        onError: (error: any) => {
          toast({
            title: "Error",
            description: `Failed to create crew member: ${error.message}`,
            variant: "destructive",
            duration: 5000,
          });
        },
      });
    },
    isPending: createCrewMutationV2.isPending,
  };

  // Wrapper for update mutation with UI feedback
  const updateCrewMutation = {
    mutate: ({ id, data }: { id: string; data: any }) => {
      updateCrewMutationV2.mutate({ crewUuid: id, data }, {
        onSuccess: () => {
          toast({
            title: "Saved", 
            description: "Crew member updated successfully. You can continue editing.",
            duration: 3000,
          });
        },
        onError: (error: any) => {
          toast({
            title: "Error",
            description: `Failed to update crew member: ${error.message}`,
            variant: "destructive",
            duration: 5000,
          });
        },
      });
    },
    isPending: updateCrewMutationV2.isPending,
  };

  // V2: Status update mutation (for isActive toggle and nextAvailability)
  const statusUpdateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { isActive?: boolean; nextAvailability?: string } }) => {
      const response = await apiRequest('PATCH', `/api/v2/crew-pool/crew/${id}`, data);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      return { success: true };
    },
    onSuccess: (_, variables) => {
      // V2: Invalidate V2 query keys
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool', 'crew'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool', 'crew', variables.id] });
      invalidateCrewData(variables.id);
      toast({
        title: "Status Updated",
        description: "Crew member status has been updated.",
        duration: 3000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to update status: ${error.message}`,
        variant: "destructive",
        duration: 5000,
      });
    },
  });

  // Handle toggling isActive status
  const handleToggleActiveStatus = (newIsActive: boolean) => {
    // V2: Use crewUuid as the primary identifier
    const crewId = crewMember?.crewUuid || crewMember?.id || createdCrewId;
    if (crewId) {
      statusUpdateMutation.mutate({ id: crewId, data: { isActive: newIsActive } });
    }
    setIsStatusEditOpen(false);
  };

  const today = new Date();
  const todayDateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Handle updating next availability date
  const handleUpdateNextAvailability = () => {
    // V2: Use crewUuid as the primary identifier
    const crewId = crewMember?.crewUuid || crewMember?.id || createdCrewId;
    if (crewId && tempNextAvailability) {
      statusUpdateMutation.mutate({ id: crewId, data: { nextAvailability: tempNextAvailability } });
    }
    setIsNextAvailabilityEditOpen(false);
    setTempNextAvailability('');
  };

  const handleSave = () => {
    
    // Include the uploaded photo in the data to be saved
    const dataWithPhoto = { ...formData, uploadedPhoto: uploadedPhoto || null };
    
    // V2 uses crewUuid, fallback to id for compatibility
    const existingUuid = crewMember?.crewUuid || crewMember?.id || createdCrewId;
    
    if (existingUuid) {
      // Update existing crew member via V2 API
      updateCrewMutation.mutate({ id: existingUuid, data: dataWithPhoto });
      
      // V2: Also save section data to their respective tables
      // Personal Details (A1.1 fields like height, weight, DOB, languages, etc.)
      const personalDetailsData = {
        height: formData.heightCm,
        weight: formData.weightKg,
        bmi: formData.bmi,
        dob: formData.dateOfBirth,
        ageInYears: formData.ageInYears,
        placeOfBirthCity: formData.placeOfBirthCity,
        placeOfBirthCountry: formData.placeOfBirthCountry,
        nativeLanguage: formData.nativeLanguage,
        foreignLanguages: formData.foreignLanguages,
        englishProficiency: formData.englishProficiency,
        manningAgent: formData.manningAgent,
        crewPool: formData.crewPool,
      };
      savePersonalDetailsMutationV2.mutate({ crewUuid: existingUuid, data: personalDetailsData }, {
        onError: (err) => console.error('Personal Details Save Error:', err),
        onSuccess: () => {},
      });
      
      // Address (A1.2 fields)
      const addressData = {
        countryOfResidence: formData.countryOfResidence,
        nearestAirport: formData.nearestAirport,
        residentialAddressLine1: formData.residentialAddressLine1,
        residentialAddressLine2: formData.residentialAddressLine2,
        contactLandline: formData.contactLandline,
        mobile: formData.mobile,
        email: formData.email,
      };
      saveAddressMutationV2.mutate({ crewUuid: existingUuid, data: addressData });
      
      // Family Info (A1.3 fields)
      const familyInfoData = {
        maritalStatus: formData.maritalStatus,
        numberOfDependentChildren: formData.numberOfDependentChildren,
        fatherName: formData.fatherName,
        motherName: formData.motherName,
        spouseFirstName: formData.spouseFirstName,
        spouseMiddleName: formData.spouseMiddleName,
        spouseFamilyName: formData.spouseFamilyName,
        spouseDateOfBirth: formData.spouseDateOfBirth,
      };
      saveFamilyInfoMutationV2.mutate({ crewUuid: existingUuid, data: familyInfoData });
    } else {
      // Create new crew member via V2 API
      createCrewMutation.mutate(dataWithPhoto);
    }
  };

  const isSaving = isBatchSaving || isCreatingCrew || createCrewMutation.isPending || updateCrewMutation.isPending || 
    savePersonalDetailsMutationV2.isPending || saveAddressMutationV2.isPending || saveFamilyInfoMutationV2.isPending;

  const handleCancel = () => {
    onClose();
  };

  // Enhanced scroll detection for continuous scroll layout
  useEffect(() => {
    if (!isOpen) return;

    const observerOptions = {
      root: null,
      rootMargin: '-10% 0px -60% 0px', // More sensitive detection
      threshold: [0.1, 0.3, 0.5, 0.7] // Multiple thresholds for better detection
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      // Find the section with the highest intersection ratio
      let maxRatio = 0;
      let mostVisibleSection = '';
      
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
          maxRatio = entry.intersectionRatio;
          const targetId = entry.target.getAttribute('data-section');
          if (targetId) {
            mostVisibleSection = targetId;
          }
        }
      });
      
      // Update active section only if we found a more visible section
      if (mostVisibleSection && mostVisibleSection !== activeSection) {
        setActiveSection(mostVisibleSection);
      }
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    const sectionRefMap: Record<string, React.RefObject<HTMLDivElement | null>> = {
      A: sectionARef, B: sectionBRef, C: sectionCRef,
      D: sectionDRef, E: sectionERef, F: sectionFRef,
    };
    sections.forEach((s) => {
      const ref = sectionRefMap[s.id];
      if (ref?.current) {
        observer.observe(ref.current);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [isOpen, activeSection, sections]);

  // Scroll to section functionality
  const scrollToSection = (sectionId: string) => {
    let targetRef;
    switch (sectionId) {
      case 'A':
        targetRef = sectionARef;
        break;
      case 'B':
        targetRef = sectionBRef;
        break;
      case 'C':
        targetRef = sectionCRef;
        break;
      case 'D':
        targetRef = sectionDRef;
        break;
      case 'E':
        targetRef = sectionERef;
        break;
      case 'F':
        targetRef = sectionFRef;
        break;
      default:
        return;
    }
    
    if (targetRef.current) {
      targetRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-2 sm:p-4">
      <div className="bg-white rounded-lg w-full max-w-none 2xl:max-w-[95vw] h-[calc(100vh-1rem)] sm:h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-2 sm:p-3 lg:p-4 flex items-center justify-between">
          <div className="flex items-center gap-1 sm:gap-2 lg:gap-4">
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  if (!showCrewDropdown) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setDropdownPosition({
                      top: rect.bottom + window.scrollY + 8,
                      left: rect.left + window.scrollX
                    });
                  }
                  setShowCrewDropdown(!showCrewDropdown);
                }}
                ref={dropdownButtonRef}
                className="flex items-center gap-2 text-sm sm:text-lg lg:text-xl font-bold truncate hover:text-blue-600 transition-colors"
                data-testid="button-crew-dropdown"
              >
                <span>
                  {crewMember
                    ? `${crewMember.firstName} ${crewMember.familyName}, ${normalizeRank(crewMember.presentRank || '') || 'Crew Member'}`
                    : (formData.firstName || formData.familyName)
                      ? `${formData.firstName || ''} ${formData.familyName || ''}`.trim() + (formData.presentRank ? `, ${normalizeRank(formData.presentRank) || formData.presentRank}` : '')
                      : 'Crew Member'}
                </span>
                <ChevronDown className="h-4 w-4 flex-shrink-0" />
              </button>
              
              {showCrewDropdown && createPortal(
                <>
                  <div 
                    className="fixed inset-0 z-[999]" 
                    onClick={() => setShowCrewDropdown(false)}
                    data-testid="dropdown-overlay"
                  />
                  <div 
                    className="fixed w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-[1000] max-h-64 overflow-y-auto"
                    style={{
                      top: `${dropdownPosition.top}px`,
                      left: `${dropdownPosition.left}px`,
                    }}
                  >
                    {allCrewMembers.length > 0 ? (
                      allCrewMembers.map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => handleCrewMemberSelection(member)}
                          className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors ${
                            crewMember?.id === member.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                          }`}
                          data-testid={`option-crew-${member.id}`}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="font-medium">
                                {member.firstName} {member.familyName}
                              </div>
                              <div className="text-sm text-gray-500">
                                {normalizeRank(member.presentRank || '') || member.presentRank} • {member.empNo}
                              </div>
                            </div>
                            {crewMember?.id === member.id && (
                              <div className="text-blue-600 text-sm">Current</div>
                            )}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-gray-500 text-sm">
                        No crew members available
                      </div>
                    )}
                  </div>
                </>,
                document.body
              )}
            </div>
          </div>
          <div className="flex gap-1 sm:gap-2">
            <Button 
              variant="outline" 
              size="sm"
              className="items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-white border-gray-300 text-gray-700 shadow-sm hover:bg-gray-50 h-8 rounded-md px-3 text-xs hidden sm:flex"
              onClick={handleExport}
              data-testid="button-export"
            >
              <FileText className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              className="items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 text-primary-foreground shadow hover:bg-primary/90 h-8 rounded-md px-3 text-xs hidden sm:flex bg-[#5fa5fa]"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={handleSaveDraft}
              disabled={isSaving}
              data-testid="button-save-draft"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              className="sm:hidden"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={handleSaveDraft}
              disabled={isSaving}
              data-testid="button-save-draft-mobile"
            >
              <Save className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile Horizontal Stepper */}
        <div className="block sm:hidden bg-white border-b px-4 py-3">
          <nav className="flex justify-center space-x-4">
            {sections.map((section, index) => {
              const isActive = activeSection === section.id;
              
              return (
                <div key={section.id} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => scrollToSection(section.id)}
                    className="flex items-center justify-center"
                    data-testid={`button-step-mobile-${section.id}`}
                  >
                    <span 
                      className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold shrink-0 ${
                        isActive 
                          ? "bg-blue-600 text-white" 
                          : "bg-gray-600 text-white"
                      }`}
                    >
                      {section.number}
                    </span>
                  </button>
                  {index < sections.length - 1 && (
                    <div className="w-8 h-0.5 bg-gray-300 mx-2"></div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        <div className="flex h-full overflow-hidden bg-[#f9fafb]">
          {/* Left Sidebar - Photo + Enhanced Stepper (Hidden on Mobile) */}
          <aside className="hidden sm:block sticky top-0 self-start basis-20 md:basis-48 lg:basis-52 shrink-0 bg-gray-50 border-r overflow-y-auto">
            {/* Photo Upload Section */}
            {renderSidebarPhotoUpload()}
            
            {/* Crew Pool Dropdown */}
            <div className="px-3 pt-3">
              <Select 
                value={formData.crewPool} 
                onValueChange={(value) => updateFormData('crewPool', value)}
              >
                <SelectTrigger className="w-full text-xs" data-testid="select-sidebar-crew-pool">
                  <SelectValue placeholder="Crew Pool" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {crewPoolOptions.map((pool: any) => (
                    <SelectItem key={pool.id} value={pool.name} data-testid={`crew-pool-option-${pool.id}`}>
                      {pool.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Stepper Navigation */}
            <div className="p-3">
              <nav className="space-y-1">
                {sections.map((section, index) => {
                  const isActive = activeSection === section.id;
                  const isCompleted = false; // You can add completion logic here
                  
                  return (
                    <div key={section.id} className="relative">
                      <button
                        type="button"
                        onClick={() => scrollToSection(section.id)}
                        className={`group flex items-center w-full px-3 py-2 rounded-md transition-all border-l-4 min-h-[3rem] ${
                          isActive 
                            ? "bg-blue-50 border-blue-600 text-blue-700" 
                            : "border-transparent hover:bg-gray-100 text-gray-700"
                        }`}
                        aria-current={isActive ? "step" : undefined}
                        data-testid={`button-step-${section.id}`}
                      >
                        <span 
                          className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold shrink-0 ${
                            isActive 
                              ? "bg-blue-600 text-white" 
                              : "bg-gray-600 text-white"
                          }`}
                        >
                          {section.number}
                        </span>
                        <span 
                          className="hidden xl:block ml-3 text-left text-sm leading-tight flex-1"
                          data-testid={`text-step-title-${section.id}`}
                          title={section.title}
                          style={{ 
                            wordBreak: 'break-word',
                            lineHeight: '1.2',
                            maxWidth: '8rem',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}
                        >
                          {section.title}
                        </span>
                      </button>
                      {index < sections.length - 1 && (
                        <div className="absolute left-7 top-12 w-0.5 h-3 bg-gray-300"></div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>
          </aside>
          
          {/* Main Content Area - Continuous Scroll */}
          <div className="flex-1 overflow-y-auto p-2 sm:p-4 lg:p-6 bg-[#f9fafb] space-y-6">
            {/* A - Dashboard */}
            {canViewSection('A') && (
            <Card className="bg-white border border-gray-200 shadow-sm" ref={sectionARef} data-section="A">
              <CardContent className="p-3 sm:p-4 lg:p-6">
                {renderDashboard()}
              </CardContent>
            </Card>
            )}

            {/* B - Seafarers' Particulars (always visible) */}
            <Card className="bg-white border border-gray-200 shadow-sm" ref={sectionBRef} data-section="B">
              <CardContent className="p-3 sm:p-4 lg:p-6">
                <div className="pb-4 mb-6">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h2 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part B Seafarers' Particulars</h2>
                      <div style={{ color: '#16569e' }} className="text-sm">Enter details as applicable</div>
                    </div>
                    {formData.employeeId && (
                      <div className="text-right">
                        <span className="text-sm text-gray-500">Crew ID:</span>
                        <span className="ml-2 text-base font-medium" style={{ color: '#16569e' }} data-testid="text-crew-id">{formData.employeeId}</span>
                      </div>
                    )}
                  </div>
                  <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
                </div>
                <div className="space-y-6">
                  <div className="space-y-6">
                    <div>
                      {renderA11GeneralParticulars()}
                    </div>
                    <div>
                      {renderA12AddressContact()}
                    </div>
                  </div>
                  <div>
                    {renderA13FamilyNOK()}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* C - Travel & ID Documents */}
            {canViewSection('C') && (
            <Card className="bg-white border border-gray-200 shadow-sm" ref={sectionCRef} data-section="C">
              <CardContent className="p-3 sm:p-4 lg:p-6">
                <div className="pb-4 mb-6">
                  <h2 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part C - Travel & ID Documents</h2>
                  <div style={{ color: '#16569e' }} className="text-sm">Add from the list all applicable identification & travel documents</div>
                  <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
                </div>
                <div className="space-y-6">
                  {renderA21TravelDocs()}
                  {renderA22Visas()}
                </div>
              </CardContent>
            </Card>
            )}

            {/* D - Training & Certificates */}
            {canViewSection('D') && (
            <Card className="bg-white border border-gray-200 shadow-sm" ref={sectionDRef} data-section="D">
              <CardContent className="p-3 sm:p-4 lg:p-6">
                <div className="pb-4 mb-6">
                  <h2 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part D - Training & Certificates</h2>
                  <div style={{ color: '#16569e' }} className="text-sm">Add Education, Competency & Training Information</div>
                  <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
                </div>
                <div className="space-y-6">
                  {renderA31Education()}
                  {renderA32LicenseDCE()}
                  {renderA33TrainingCourse()}
                </div>
              </CardContent>
            </Card>
            )}

            {/* E - Sea Service */}
            {canViewSection('E') && (
            <Card className="bg-white border border-gray-200 shadow-sm" ref={sectionERef} data-section="E">
              <CardContent className="p-3 sm:p-4 lg:p-6">
                <div className="pb-4 mb-6">
                  <h2 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part E - Sea Service</h2>
                  <div style={{ color: '#16569e' }} className="text-sm">Add Sea service details, latest on top</div>
                  <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
                </div>
                <div className="space-y-6">
                  {renderE1CurrentCompanySeaService()}
                  {renderE2ExternalSeaService()}
                </div>
              </CardContent>
            </Card>
            )}

            {/* F - Medical Records */}
            {canViewSection('F') && (
            <Card className="bg-white border border-gray-200 shadow-sm" ref={sectionFRef} data-section="F">
              <CardContent className="p-3 sm:p-4 lg:p-6">
                <div className="pb-4 mb-6">
                  <h2 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part F - Medical Records</h2>
                  <div style={{ color: '#16569e' }} className="text-sm">Add medical record details, latest on top</div>
                  <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
                </div>
                <div className="space-y-6">
                  {renderF1PreJoiningMedicals()}
                  {renderF2DoctorVisits()}
                </div>
              </CardContent>
            </Card>
            )}
          </div>
        </div>
      </div>
      
      {/* Status Edit Dialog - Toggle Active/Inactive */}
      <Dialog open={isStatusEditOpen} onOpenChange={setIsStatusEditOpen}>
        <DialogContent className="sm:max-w-[350px]">
          <DialogHeader>
            <DialogTitle>Change Status</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-gray-600 mb-4">
              Toggle between Active and Inactive status. Active crew members can be "On Board" (on vessel) or "On Leave" (not on vessel).
            </p>
            <Button
              variant={statusData?.isActive !== false ? "default" : "outline"}
              className="w-full justify-start"
              onClick={() => handleToggleActiveStatus(true)}
              data-testid="button-set-active"
            >
              <div className="w-3 h-3 rounded-full bg-green-500 mr-3"></div>
              Active (On Board / On Leave)
            </Button>
            <Button
              variant={statusData?.isActive === false ? "default" : "outline"}
              className="w-full justify-start"
              onClick={() => handleToggleActiveStatus(false)}
              data-testid="button-set-inactive"
            >
              <div className="w-3 h-3 rounded-full bg-gray-500 mr-3"></div>
              Inactive
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Next Availability Edit Dialog */}
      <Dialog open={isNextAvailabilityEditOpen} onOpenChange={setIsNextAvailabilityEditOpen}>
        <DialogContent className="sm:max-w-[350px]">
          <DialogHeader>
            <DialogTitle>Set Next Availability</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium text-gray-700">Next Availability Date</label>
            <FormattedDateInput
              value={tempNextAvailability}
              onChange={(e) => setTempNextAvailability(e.target.value)}
              className="mt-1"
              min={todayDateString}
              data-testid="input-next-availability"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNextAvailabilityEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateNextAvailability} disabled={!tempNextAvailability}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* License Selection Dialog - Add from Database */}
      <LicenseSelectionDialog
        open={isLicenseDialogOpen}
        onClose={() => setIsLicenseDialogOpen(false)}
        onConfirm={addLicensesFromDatabase}
        existingLicenseIds={formData.licenses.filter(l => !l.archivedAt).map(l => l.licenseId).filter(Boolean)}
      />
      
      {/* Training Course Selection Dialog - Add from Database */}
      <TrainingCourseSelectionDialog
        open={isTrainingDialogOpen}
        onClose={() => setIsTrainingDialogOpen(false)}
        onConfirm={addTrainingCoursesFromDatabase}
        existingCourseIds={formData.trainingCourses.map(c => c.courseId).filter((id): id is string => Boolean(id))}
      />
      
      {/* Travel Document Selection Dialog - Add from Database */}
      <TravelDocumentSelectionDialog
        open={isTravelDocDialogOpen}
        onClose={() => setIsTravelDocDialogOpen(false)}
        onConfirm={addTravelDocsFromDatabase}
        existingDocumentIds={formData.documents.map(d => d.documentId).filter(Boolean)}
      />
      
      {/* Visa Selection Dialog - Add from Database */}
      <VisaSelectionDialog
        open={isVisaDialogOpen}
        onClose={() => setIsVisaDialogOpen(false)}
        onConfirm={addVisasFromDatabase}
        existingCountryIds={formData.visas.flatMap(v => [v.countryId, v.issuingCountry]).filter(Boolean)}
      />
      
      {/* File Attachment Dialog */}
      <FileAttachmentDialog
        open={attachmentDialog.open}
        onOpenChange={(open) => setAttachmentDialog(prev => ({ ...prev, open }))}
        attachments={getAttachmentsForItem()}
        onAttachmentsChange={updateAttachments}
        title="Manage Attachments"
        itemName={attachmentDialog.itemName}
      />
    </div>
  );
};

export default CrewInfoForm_v2;