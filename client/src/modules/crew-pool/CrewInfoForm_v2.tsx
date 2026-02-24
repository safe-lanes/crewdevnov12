import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Edit, Camera, Plus, Trash2, Paperclip, Save, ArrowLeft, ChevronDown, Pencil, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { TravelDocumentSelectionDialog } from './TravelDocumentSelectionDialog';
import { VisaSelectionDialog } from './VisaSelectionDialog';
import type { TrainingCourseTemplate } from '@/utils/data/trainingCourseTemplates';
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
  mapLegacyFamilyInfoToV2 
} from './mappers/v2ToLegacyMapper';

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
  attachments?: FileAttachment[];
  archivedAt?: string;       // ISO date when COC was archived (superseded by upgrade)
  archivedReason?: string;   // Reason for archiving
}

interface TrainingCourse {
  id: string;
  courseId?: string;  // Template ID for duplicate detection
  companyId?: string; // Company ID from Admin > Training Matrix > Company (e.g., SA001)
  trainingCourse: string;
  abbr: string;
  requirement: string;
  certificateNo: string;
  issuingAuthority: string;
  issued: string;
  expiry: string;
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

  // Crew ID will be auto-assigned by the API during creation

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
  
  // State for tracking if we're saving before opening attachment dialog
  const [isSavingBeforeAttachment, setIsSavingBeforeAttachment] = useState(false);
  
  const dropdownButtonRef = useRef<HTMLButtonElement>(null);

  // Sections for stepper navigation  
  const sections = [
    { id: 'A', title: 'Dashboard', number: 'A' },
    { id: 'B', title: 'Seafarers\' Particulars', number: 'B' },
    { id: 'C', title: 'Travel & ID Documents', number: 'C' },
    { id: 'D', title: 'Training & Certificates', number: 'D' },
    { id: 'E', title: 'Sea Service', number: 'E' },
    { id: 'F', title: 'Medical', number: 'F' }
  ];

  // Refs for scroll detection
  const sectionARef = useRef<HTMLDivElement>(null);
  const sectionBRef = useRef<HTMLDivElement>(null);
  const sectionCRef = useRef<HTMLDivElement>(null);
  const sectionDRef = useRef<HTMLDivElement>(null);
  const sectionERef = useRef<HTMLDivElement>(null);
  const sectionFRef = useRef<HTMLDivElement>(null);

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
  // Sort in hierarchical order with Oil Chemical Tanker positioned after Chemical Tanker
  // External API uses 'vesselType' field for name, 'vtuid' for ID
  const vesselTypeMasterData = useMemo(() => {
    const preferredOrder = [
      'Oil Tanker',
      'Chemical Tanker',
      'Oil Chemical Tanker',
      'Gas Tanker',
      'Bitumen/Asphalt Carriers',
      'Product Oil Tanker',
      'Crude Oil Tanker',
      'LNG Tanker',
      'LPG Tanker',
      'Bulk Carrier',
      'General Cargo',
      'Container',
      'RoRo',
      'Barges',
      'Offshore Support Vessels',
      'Shuttle Tankers'
    ];
    
    if (vesselTypeMasterDataRaw.length > 0) {
      // External API doesn't have 'level' field, so include all types
      // Support both external API format (vesselType) and local DB format (name)
      const hasLevelField = vesselTypeMasterDataRaw.some((vt: any) => vt.level !== undefined);
      const filteredTypes = hasLevelField 
        ? vesselTypeMasterDataRaw.filter((vt: any) => vt.level && vt.level >= 2)
        : vesselTypeMasterDataRaw;
      
      if (filteredTypes.length > 0) {
        return filteredTypes
          .map((vt: any) => vt.vesselType || vt.name)
          .filter(Boolean)
          .sort((a: string, b: string) => {
            const indexA = preferredOrder.indexOf(a);
            const indexB = preferredOrder.indexOf(b);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.localeCompare(b);
          });
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
    gender: 'Male', // Default to Male, will be loaded from fetched data
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
    documents: [{
      id: '1',
      documentId: '',
      document: '',
      number: '',
      issued: '',
      expiry: '',
      issuingAuthority: ''
    }],
    
    // A2.2 Visas
    visas: [{
      id: '1',
      countryId: '',
      issuingCountry: '',
      serialNo: '',
      issued: '',
      expiry: '',
      visaType: ''
    }],
    
    // A3.1 Education
    education: [{
      id: '1',
      dateOfCompletion: '',
      schoolCollegeUniversity: '',
      subjectsField: '',
      qualifications: ''
    }],
    
    // A3.2 License & DCE
    licenses: [{
      id: '1',
      licenseId: '',
      certificateDocument: '',
      abbr: '',
      requirement: '',
      certificateNo: '',
      issuingAuthority: '',
      issued: '',
      expiry: ''
    }],
    
    // A3.3 Training Courses
    trainingCourses: [{
      id: '1',
      trainingCourse: '',
      abbr: '',
      requirement: '',
      certificateNo: '',
      issuingAuthority: '',
      issued: '',
      expiry: ''
    }],
    
    // A4.1 Sea Service - Current Company
    currentCompanySeaService: [{
      id: '1',
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
    }],
    
    // A4.2 Sea Service - External
    externalSeaService: [{
      id: '1',
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
    }],
    
    // F1. Pre Joining Medicals
    preJoiningMedicals: [],
    
    // F2. Doctor Visits
    doctorVisits: []
  });

  // Helper function to calculate period in months between two dates (used for hydration)
  // Uses average days per month (30.44) for accurate calculation
  const calculateSeaServicePeriod = (fromDate: string, toDate: string): string => {
    if (!fromDate || !toDate) return '';
    
    const from = new Date(fromDate);
    const to = new Date(toDate);
    
    if (isNaN(from.getTime()) || isNaN(to.getTime())) return '';
    if (to < from) return '';
    
    // Calculate total days between dates and convert to months
    const timeDiff = to.getTime() - from.getTime();
    const totalDays = timeDiff / (1000 * 60 * 60 * 24);
    const totalMonths = totalDays / 30.44; // Average days per month
    
    // Round to 1 decimal place, ensure minimum of 0
    const result = Math.max(0, Math.round(totalMonths * 10) / 10);
    return result.toString();
  };

  // Update form data when detailed crew data loads from API
  // V2: Check both crewUuid and id for compatibility
  useEffect(() => {
    if (detailedCrewData && (crewMember?.crewUuid || crewMember?.id)) {
      setFormData(prev => ({
        ...prev,
        // A1.1 General Particulars
        firstName: detailedCrewData.firstName || '',
        middleName: detailedCrewData.middleName || '',
        familyName: detailedCrewData.familyName || '',
        gender: detailedCrewData.gender || 'Male',
        nationality: detailedCrewData.nationality || '',
        presentRank: normalizeRank(detailedCrewData.presentRank || '') || detailedCrewData.presentRank || '',
        dateOfBirth: detailedCrewData.dob || detailedCrewData.dateOfBirth || '',
        ageInYears: detailedCrewData.age || detailedCrewData.ageInYears || calculateAge(detailedCrewData.dob || detailedCrewData.dateOfBirth || ''),
        placeOfBirthCity: detailedCrewData.placeOfBirthCity || '',
        placeOfBirthCountry: detailedCrewData.placeOfBirthCountry || '',
        heightCm: detailedCrewData.height || detailedCrewData.heightCm || '',
        weightKg: detailedCrewData.weight || detailedCrewData.weightKg || '',
        bmi: detailedCrewData.bmi || '',
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
        licenses: Array.isArray(detailedCrewData.licenses) 
          ? detailedCrewData.licenses 
          : detailedCrewData.licenses 
            ? JSON.parse(detailedCrewData.licenses) 
            : [],
        trainingCourses: Array.isArray(detailedCrewData.trainingCourses) 
          ? detailedCrewData.trainingCourses 
          : detailedCrewData.trainingCourses 
            ? JSON.parse(detailedCrewData.trainingCourses) 
            : [],
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
  }, [detailedCrewData, crewMember?.crewUuid, crewMember?.id]);
  
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
      console.log('[V2] Resetting form data for new crew member');
      setFormData({
        // A1.1 General Particulars
        firstName: '',
        middleName: '',
        familyName: '',
        gender: 'Male',
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
        documents: [{
          id: '1',
          documentId: '',
          document: '',
          number: '',
          issued: '',
          expiry: '',
          issuingAuthority: ''
        }],
        
        // A2.2 Visas
        visas: [{
          id: '1',
          countryId: '',
          issuingCountry: '',
          serialNo: '',
          issued: '',
          expiry: '',
          visaType: ''
        }],
        
        // A3.1 Education
        education: [{
          id: '1',
          dateOfCompletion: '',
          schoolCollegeUniversity: '',
          subjectsField: '',
          qualifications: '',
          attachments: []
        }],
        
        // A3.2 License
        licenses: [{
          id: '1',
          licenseId: '',
          certificateDocument: '',
          abbr: '',
          requirement: '',
          certificateNo: '',
          issuingAuthority: '',
          issued: '',
          expiry: '',
          attachments: []
        }],
        
        // A3.3 Training Courses
        trainingCourses: [{
          id: '1',
          courseId: '',
          companyId: '',
          trainingCourse: '',
          abbr: '',
          requirement: '',
          certificateNo: '',
          issuingAuthority: '',
          issued: '',
          expiry: '',
          attachments: []
        }],
        
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

  // Helper function to calculate BMI
  const calculateBMI = (height: string, weight: string) => {
    const heightInM = parseFloat(height) / 100; // Convert cm to meters
    const weightInKg = parseFloat(weight);
    if (heightInM > 0 && weightInKg > 0) {
      const bmi = weightInKg / (heightInM * heightInM);
      return bmi.toFixed(1);
    }
    return '';
  };

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
            queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool', 'crew', crewIdentifier, 'full-profile'] });
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
            queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool', 'crew', crewIdentifier, 'full-profile'] });
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
            queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool', 'crew', crewIdentifier, 'full-profile'] });
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
        expiry: ''
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
        courseId: template.id,
        companyId: template.companyId,
        trainingCourse: template.name,
        abbr: template.abbr,
        requirement: template.requirement,
        certificateNo: '',
        issuingAuthority: '',
        issued: '',
        expiry: ''
      }));
      return { 
        ...prev, 
        trainingCourses: [...existingCourses, ...newCourses] 
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
            queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool', 'crew', crewIdentifier, 'full-profile'] });
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
            queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool', 'crew', crewIdentifier, 'full-profile'] });
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

  // Helper function to calculate period in months between two dates
  // Uses average days per month (30.44) for accurate calculation
  const calculatePeriodMonths = (fromDate: string, toDate: string): string => {
    if (!fromDate || !toDate) return '';
    
    const from = new Date(fromDate);
    const to = new Date(toDate);
    
    if (isNaN(from.getTime()) || isNaN(to.getTime())) return '';
    if (to < from) return '';
    
    // Calculate total days between dates and convert to months
    const timeDiff = to.getTime() - from.getTime();
    const totalDays = timeDiff / (1000 * 60 * 60 * 24);
    const totalMonths = totalDays / 30.44; // Average days per month
    
    // Round to 1 decimal place, ensure minimum of 0
    const result = Math.max(0, Math.round(totalMonths * 10) / 10);
    return result.toString();
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
            queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool', 'crew', crewIdentifier, 'full-profile'] });
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
            queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool', 'crew', crewIdentifier, 'full-profile'] });
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
            queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool', 'crew', crewIdentifier, 'full-profile'] });
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
            queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool', 'crew', crewIdentifier, 'full-profile'] });
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

  // Save-before-attachment handler: saves record first if no UUID exists
  const handleAttachmentClick = async (section: typeof attachmentDialog.section, itemId: string, itemName: string) => {
    const crewIdentifier = crewMember?.crewUuid || crewMember?.id;
    
    // Check if crew member exists - must save crew first
    if (!crewIdentifier) {
      toast({
        title: 'Save Required',
        description: 'Please save the crew member first before adding attachments.',
        variant: 'destructive'
      });
      return;
    }

    // Check if record has UUID (already saved)
    const recordUuid = getRecordUuid(section, itemId);
    
    if (recordUuid) {
      // Record already saved, open attachment dialog directly
      openAttachmentDialog(section, itemId, itemName);
      return;
    }

    // Record not saved - save it first using DIRECT API call (bypasses query invalidation)
    // This preserves local form state (unsaved rows) while only updating the saved record's UUID
    setIsSavingBeforeAttachment(true);
    
    try {
      let savedUuid: string | undefined;
      
      switch (section) {
        case 'document': {
          const doc = formData.documents.find(d => d.id === itemId);
          if (!doc) throw new Error('Document not found');
          // Use direct API call to avoid query invalidation that overwrites form state
          const response = await crewPoolApiV2.createDocument(crewIdentifier, {
            documentId: doc.documentId || '',
            documentName: doc.document || '',
            number: doc.number || '',
            issued: doc.issued || '',
            expiry: doc.expiry || '',
            issuingAuthority: doc.issuingAuthority || '',
          });
          const result = await response.json() as { docUuid?: string };
          savedUuid = result?.docUuid;
          // Update local state with new UUID - preserves other unsaved rows
          setFormData(prev => ({
            ...prev,
            documents: prev.documents.map(d =>
              d.id === itemId ? { ...d, docUuid: savedUuid } as any : d
            )
          }));
          break;
        }
        
        case 'visa': {
          const visa = formData.visas.find(v => v.id === itemId);
          if (!visa) throw new Error('Visa not found');
          const response = await crewPoolApiV2.createVisa(crewIdentifier, {
            issuingCountry: visa.issuingCountry || '',
            serialNo: visa.serialNo || '',
            issued: visa.issued || '',
            expiry: visa.expiry || '',
            visaType: visa.visaType || '',
          });
          const result = await response.json() as { visaUuid?: string };
          savedUuid = result?.visaUuid;
          setFormData(prev => ({
            ...prev,
            visas: prev.visas.map(v =>
              v.id === itemId ? { ...v, visaUuid: savedUuid } as any : v
            )
          }));
          break;
        }
        
        case 'education': {
          const edu = formData.education.find(e => e.id === itemId);
          if (!edu) throw new Error('Education not found');
          const response = await crewPoolApiV2.createEducation(crewIdentifier, {
            dateOfCompletion: edu.dateOfCompletion || '',
            schoolCollegeUniversity: edu.schoolCollegeUniversity || '',
            subjectsField: edu.subjectsField || '',
            qualifications: edu.qualifications || '',
          });
          const result = await response.json() as { eduUuid?: string };
          savedUuid = result?.eduUuid;
          setFormData(prev => ({
            ...prev,
            education: prev.education.map(e =>
              e.id === itemId ? { ...e, eduUuid: savedUuid } as any : e
            )
          }));
          break;
        }
        
        case 'license': {
          const license = formData.licenses.find(l => l.id === itemId);
          if (!license) throw new Error('License not found');
          const response = await crewPoolApiV2.createLicense(crewIdentifier, {
            licenseId: license.licenseId || '',
            certificateDocument: license.certificateDocument || '',
            abbr: license.abbr || '',
            requirement: license.requirement || '',
            certificateNo: license.certificateNo || '',
            issuingAuthority: license.issuingAuthority || '',
            issued: license.issued || '',
            expiry: license.expiry || '',
          });
          const result = await response.json() as { licUuid?: string };
          savedUuid = result?.licUuid;
          setFormData(prev => ({
            ...prev,
            licenses: prev.licenses.map(l =>
              l.id === itemId ? { ...l, licUuid: savedUuid } as any : l
            )
          }));
          break;
        }
        
        case 'training': {
          const course = formData.trainingCourses.find(t => t.id === itemId);
          if (!course) throw new Error('Training course not found');
          const response = await crewPoolApiV2.createTrainingCourse(crewIdentifier, {
            courseId: course.courseId || '',
            trainingCourse: course.trainingCourse || '',
            abbr: course.abbr || '',
            requirement: course.requirement || '',
            certificateNo: course.certificateNo || '',
            issuingAuthority: course.issuingAuthority || '',
            issued: course.issued || '',
            expiry: course.expiry || '',
          });
          const result = await response.json() as { trainUuid?: string };
          savedUuid = result?.trainUuid;
          setFormData(prev => ({
            ...prev,
            trainingCourses: prev.trainingCourses.map(t =>
              t.id === itemId ? { ...t, trainUuid: savedUuid } as any : t
            )
          }));
          break;
        }
        
        case 'currentSeaService': {
          const service = formData.currentCompanySeaService.find(s => s.id === itemId);
          if (!service) throw new Error('Sea service not found');
          const response = await crewPoolApiV2.createSeaService(crewIdentifier, {
            isCompanyService: true,
            vesselName: service.vesselName || '',
            vesselCode: service.vesselCode || '',
            vesselType: service.vesselType || '',
            deadweight: service.deadweight || '',
            engineTypePower: service.engineTypePower || '',
            ownerOperator: service.ownerOperator || '',
            rank: service.rank || '',
            from: service.from || '',
            to: service.to || '',
            fromDate: service.from || '',
            toDate: service.to || '',
            periodMonths: service.periodMonths || '',
            experienceCategories: service.experienceCategories || [],
          });
          const result = await response.json() as { seaUuid?: string };
          savedUuid = result?.seaUuid;
          setFormData(prev => ({
            ...prev,
            currentCompanySeaService: prev.currentCompanySeaService.map(s =>
              s.id === itemId ? { ...s, seaUuid: savedUuid } as any : s
            )
          }));
          break;
        }
        
        case 'externalSeaService': {
          const service = formData.externalSeaService.find(s => s.id === itemId);
          if (!service) throw new Error('Sea service not found');
          const response = await crewPoolApiV2.createSeaService(crewIdentifier, {
            isCompanyService: false,
            vesselName: service.vesselName || '',
            vesselCode: service.vesselCode || '',
            vesselType: service.vesselType || '',
            deadweight: service.deadweight || '',
            engineTypePower: service.engineTypePower || '',
            ownerOperator: service.ownerOperator || '',
            rank: service.rank || '',
            from: service.from || '',
            to: service.to || '',
            fromDate: service.from || '',
            toDate: service.to || '',
            periodMonths: service.periodMonths || '',
            experienceCategories: service.experienceCategories || [],
          });
          const result = await response.json() as { seaUuid?: string };
          savedUuid = result?.seaUuid;
          setFormData(prev => ({
            ...prev,
            externalSeaService: prev.externalSeaService.map(s =>
              s.id === itemId ? { ...s, seaUuid: savedUuid } as any : s
            )
          }));
          break;
        }
        
        case 'preJoiningMedical': {
          const medical = formData.preJoiningMedicals.find(m => m.id === itemId);
          if (!medical) throw new Error('Medical record not found');
          const response = await crewPoolApiV2.createMedical(crewIdentifier, {
            vesselUuid: medical.vesselCode || undefined,
            vesselName: medical.vessel || undefined,
            examinationDate: medical.dateOfMedical || undefined,
            bp: medical.bp || undefined,
            weight: medical.weight || undefined,
            anyMedicationPrescribed: medical.anyMedicationPrescribed || undefined,
            clinicHospital: (medical as any).clinicHospital || undefined,
            fitForDuty: medical.fitnessForDuty || undefined,
            expiryDate: medical.expiry || undefined,
          });
          const result = await response.json() as { medUuid?: string };
          savedUuid = result?.medUuid;
          setFormData(prev => ({
            ...prev,
            preJoiningMedicals: prev.preJoiningMedicals.map(m =>
              m.id === itemId ? { ...m, medUuid: savedUuid } as any : m
            )
          }));
          break;
        }
        
        case 'doctorVisit': {
          const visit = formData.doctorVisits.find(v => v.id === itemId);
          if (!visit) throw new Error('Doctor visit not found');
          const response = await crewPoolApiV2.createDoctorVisit(crewIdentifier, {
            vessel: visit.vessel || '',
            port: visit.port || '',
            date: visit.date || '',
            visitDate: visit.date || '',
            doctorName: (visit as any).doctorName || '',
            clinicHospital: (visit as any).clinicHospital || '',
            complaint: visit.complaint || '',
            doctorComments: visit.doctorComments || '',
            diagnosis: (visit as any).diagnosis || '',
            treatment: (visit as any).treatment || '',
            followUpDate: (visit as any).followUpDate || '',
          });
          const result = await response.json() as { visitUuid?: string };
          savedUuid = result?.visitUuid;
          setFormData(prev => ({
            ...prev,
            doctorVisits: prev.doctorVisits.map(v =>
              v.id === itemId ? { ...v, visitUuid: savedUuid } as any : v
            )
          }));
          break;
        }
      }
      
      toast({
        title: 'Record Saved',
        description: 'Record saved. You can now add attachments.',
      });
      
      // Now open the attachment dialog
      openAttachmentDialog(section, itemId, itemName);
      
    } catch (error) {
      console.error('Error saving record before attachment:', error);
      toast({
        title: 'Save Failed',
        description: 'Failed to save record. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSavingBeforeAttachment(false);
    }
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
            </div>
          ) : (
            <label htmlFor="sidebar-photo-upload" className="cursor-pointer block">
              <div className="w-full aspect-[4/5] max-w-[120px] mx-auto bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-colors">
                <div className="text-center">
                  <Camera className="h-6 w-6 mx-auto mb-1 text-gray-400" />
                  <div className="text-xs text-gray-500 mb-1">Upload Photo</div>
                  <div className="text-xs text-blue-600 hover:text-blue-800">Choose file</div>
                </div>
              </div>
            </label>
          )}
          
          {uploadedPhoto && (
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setIsStatusEditOpen(true)}
                  data-testid="button-edit-status"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
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
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 ml-2"
                            onClick={() => setIsNextAvailabilityEditOpen(true)}
                            data-testid="button-edit-next-availability"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
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
                onAppraisalClick={(appraisalId: number) => {
                  console.log('Navigate to appraisal:', appraisalId);
                }}
                onHandoverClick={(handoverId: number) => {
                  console.log('Navigate to handover:', handoverId);
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
      <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>B1 General Particulars</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleEditSection('B1')}
            className="text-gray-500 hover:text-gray-700"
            data-testid="button-edit-b1"
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
          
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Row 1: First Name | Middle Name | Family Name */}
          <div>
            <Label className="text-xs text-gray-500 tracking-wide">First Name</Label>
            {isEditing ? (
              <Input
                value={formData.firstName}
                onChange={(e) => updateFormData('firstName', e.target.value)}
                className="mt-1"
              />
            ) : (
              <div className="mt-1 text-sm text-gray-900">{formData.firstName}</div>
            )}
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
              <Input
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => updateFormData('dateOfBirth', e.target.value)}
                className="mt-1"
              />
            ) : (
              <div className="mt-1 text-sm text-gray-900">{formData.dateOfBirth}</div>
            )}
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
                  <SelectItem value="Good">Good</SelectItem>
                  <SelectItem value="Fair">Fair</SelectItem>
                  <SelectItem value="Poor">Poor</SelectItem>
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
                  {manningAgentOptions.map((agent: any) => {
                    const displayValue = agent.country ? `${agent.name} (${agent.country})` : agent.name;
                    return (
                      <SelectItem key={agent.id} value={displayValue} data-testid={`manning-agent-crew-option-${agent.id}`}>
                        {displayValue}
                      </SelectItem>
                    );
                  })}
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
      <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>B2 Address & Contact Info</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleEditSection('B2')}
            className="text-gray-500 hover:text-gray-700"
            data-testid="button-edit-b2"
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
          
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label className="text-xs text-gray-500 tracking-wide">Country of Residence</Label>
            {isEditing ? (
              <Select value={formData.countryOfResidence} onValueChange={(value) => updateFormData('countryOfResidence', value)}>
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
                onChange={(e) => updateFormData('mobile', e.target.value)}
                className="mt-1"
              />
            ) : (
              <div className="mt-1 text-sm text-gray-900">{formData.mobile}</div>
            )}
          </div>
          
          <div>
            <Label className="text-xs text-gray-500 tracking-wide">Email</Label>
            {isEditing ? (
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => updateFormData('email', e.target.value)}
                className="mt-1"
              />
            ) : (
              <div className="mt-1 text-sm text-gray-900">{formData.email}</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // B3 Family and NOK render function
  const renderA13FamilyNOK = () => {
    const isEditing = editingSections['B3'];
    
    return (
      <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>B3 Family and NOK</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleEditSection('B3')}
            className="text-gray-500 hover:text-gray-700"
            data-testid="button-edit-b3"
          >
            <Edit className="h-4 w-4" />
          </Button>
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
              <Label className="text-xs text-gray-500 tracking-wide">Spouse First Name</Label>
              {isEditing ? (
                <Input
                  value={formData.spouseFirstName}
                  onChange={(e) => updateFormData('spouseFirstName', e.target.value)}
                  className="mt-1"
                />
              ) : (
                <div className="mt-1 text-sm text-gray-900">{formData.spouseFirstName}</div>
              )}
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
              <Label className="text-xs text-gray-500 tracking-wide">Spouse Family Name</Label>
              {isEditing ? (
                <Input
                  value={formData.spouseFamilyName}
                  onChange={(e) => updateFormData('spouseFamilyName', e.target.value)}
                  className="mt-1"
                />
              ) : (
                <div className="mt-1 text-sm text-gray-900">{formData.spouseFamilyName}</div>
              )}
            </div>
            
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">Spouse Date of Birth</Label>
              {isEditing ? (
                <Input
                  type="date"
                  value={formData.spouseDateOfBirth}
                  onChange={(e) => updateFormData('spouseDateOfBirth', e.target.value)}
                  className="mt-1"
                />
              ) : (
                <div className="mt-1 text-sm text-gray-900">{formData.spouseDateOfBirth}</div>
              )}
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
                              className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
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
                              className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
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
                              className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                            />
                          ) : (
                            child.familyName
                          )}
                        </td>
                        <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                          {isEditing ? (
                            <Input
                              type="date"
                              value={child.dateOfBirth}
                              onChange={(e) => updateChild(index, 'dateOfBirth', e.target.value)}
                              className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                            />
                          ) : (
                            child.dateOfBirth
                          )}
                        </td>
                        <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                          {isEditing ? (
                            <Select value={child.gender} onValueChange={(value) => updateChild(index, 'gender', value)}>
                              <SelectTrigger className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Son">Son</SelectItem>
                                <SelectItem value="Daughter">Daughter</SelectItem>
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
                  onChange={(e) => updateFormData('nokEmail', e.target.value)}
                  className="mt-1"
                />
              ) : (
                <div className="mt-1 text-sm text-gray-900">{formData.nokEmail}</div>
              )}
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
        </div>
        
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-gray-100">
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Document</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Number</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Issued</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Expiry</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Issuing Authority</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3 w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {formData.documents.map((doc) => (
              <TableRow key={doc.id} className="border-b border-gray-200">
                <TableCell className="p-3">
                  <Input
                    value={doc.document}
                    onChange={(e) => updateDocument(doc.id, 'document', e.target.value)}
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    value={doc.number}
                    onChange={(e) => updateDocument(doc.id, 'number', e.target.value)}
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    type="date"
                    value={doc.issued}
                    onChange={(e) => updateDocument(doc.id, 'issued', e.target.value)}
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    type="date"
                    value={doc.expiry}
                    onChange={(e) => updateDocument(doc.id, 'expiry', e.target.value)}
                    className={`${getExpiryColorClass(doc.expiry)} text-[13px] border-0 shadow-none p-0 h-auto`}
                  />
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    value={doc.issuingAuthority}
                    onChange={(e) => updateDocument(doc.id, 'issuingAuthority', e.target.value)}
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                  />
                </TableCell>
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
        </div>
        
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-gray-100">
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Issuing Country</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">S.No.( If Applicable )</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Issued</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Expiry</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Visa Type</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3 w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {formData.visas.map((visa) => (
              <TableRow key={visa.id} className="border-b border-gray-200">
                <TableCell className="p-3">
                  <Input
                    value={visa.issuingCountry}
                    onChange={(e) => updateVisa(visa.id, 'issuingCountry', e.target.value)}
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    value={visa.serialNo}
                    onChange={(e) => updateVisa(visa.id, 'serialNo', e.target.value)}
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    type="date"
                    value={visa.issued}
                    onChange={(e) => updateVisa(visa.id, 'issued', e.target.value)}
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    type="date"
                    value={visa.expiry}
                    onChange={(e) => updateVisa(visa.id, 'expiry', e.target.value)}
                    className={`${getExpiryColorClass(visa.expiry)} text-[13px] border-0 shadow-none p-0 h-auto`}
                  />
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    value={visa.visaType}
                    onChange={(e) => updateVisa(visa.id, 'visaType', e.target.value)}
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                  />
                </TableCell>
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
        </div>
        
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-gray-100">
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Date of Completion</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">School/College/University</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Subjects/Field</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Qualifications</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3 w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {formData.education.map((edu) => (
              <TableRow key={edu.id} className="border-b border-gray-200">
                <TableCell className="p-3">
                  <Input
                    type="date"
                    value={edu.dateOfCompletion}
                    onChange={(e) => updateEducation(edu.id, 'dateOfCompletion', e.target.value)}
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    value={edu.schoolCollegeUniversity}
                    onChange={(e) => updateEducation(edu.id, 'schoolCollegeUniversity', e.target.value)}
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    value={edu.subjectsField}
                    onChange={(e) => updateEducation(edu.id, 'subjectsField', e.target.value)}
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    value={edu.qualifications}
                    onChange={(e) => updateEducation(edu.id, 'qualifications', e.target.value)}
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                  />
                </TableCell>
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
        </div>
        
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-gray-100">
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3 w-20">ID</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Certificate/Document</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Abbr</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Requirement</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Certificate No</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Issuing Country</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Issued</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Expiry</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3 w-24">Actions</TableHead>
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
                  <Input
                    value={license.certificateDocument}
                    onChange={(e) => updateLicense(license.id, 'certificateDocument', e.target.value)}
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                    disabled={!!license.archivedAt}
                  />
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    value={license.abbr}
                    onChange={(e) => updateLicense(license.id, 'abbr', e.target.value)}
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    value={license.requirement}
                    onChange={(e) => updateLicense(license.id, 'requirement', e.target.value)}
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    value={license.certificateNo}
                    onChange={(e) => updateLicense(license.id, 'certificateNo', e.target.value)}
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <Select 
                    value={license.issuingAuthority} 
                    onValueChange={(value) => updateLicense(license.id, 'issuingAuthority', value)}
                  >
                    <SelectTrigger className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {countryMasterData.map(country => (
                        <SelectItem key={country} value={country}>{country}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    type="date"
                    value={license.issued}
                    onChange={(e) => updateLicense(license.id, 'issued', e.target.value)}
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    type="date"
                    value={license.expiry}
                    onChange={(e) => updateLicense(license.id, 'expiry', e.target.value)}
                    className={`${getExpiryColorClass(license.expiry)} text-[13px] border-0 shadow-none p-0 h-auto`}
                  />
                </TableCell>
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
        </div>
        
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-gray-100">
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Company ID</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Training Course</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Abbr</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Requirement</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Certificate No</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Issuing Authority</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Issued</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Expiry</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3 w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {formData.trainingCourses.map((course) => (
              <TableRow key={course.id} className="border-b border-gray-200">
                <TableCell className="p-3">
                  <div className="text-[#4f5863] text-[13px] font-mono">{course.courseId || '-'}</div>
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    value={course.trainingCourse}
                    onChange={(e) => updateTrainingCourse(course.id, 'trainingCourse', e.target.value)}
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    value={course.abbr}
                    onChange={(e) => updateTrainingCourse(course.id, 'abbr', e.target.value)}
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    value={course.requirement}
                    onChange={(e) => updateTrainingCourse(course.id, 'requirement', e.target.value)}
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    value={course.certificateNo}
                    onChange={(e) => updateTrainingCourse(course.id, 'certificateNo', e.target.value)}
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    value={course.issuingAuthority}
                    onChange={(e) => updateTrainingCourse(course.id, 'issuingAuthority', e.target.value)}
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    type="date"
                    value={course.issued}
                    onChange={(e) => updateTrainingCourse(course.id, 'issued', e.target.value)}
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    type="date"
                    value={course.expiry}
                    onChange={(e) => updateTrainingCourse(course.id, 'expiry', e.target.value)}
                    className={`${getExpiryColorClass(course.expiry)} text-[13px] border-0 shadow-none p-0 h-auto`}
                  />
                </TableCell>
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
        </div>
        
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Vessel Name</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Vessel Type</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Deadweight</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Engine Type/ Power</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Owner / operator</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Rank</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">From</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">To</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Period(M)</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Experience</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left w-24">Actions</th>
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
                    .map((service) => (
                    <tr key={service.id} className="border-t">
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Select
                          value={service.vesselCode}
                          onValueChange={(value) => {
                            const selectedVessel = vesselOptions.find(v => v.code === value);
                            updateCurrentCompanySeaService(service.id, 'vesselCode', value);
                            updateCurrentCompanySeaService(service.id, 'vesselName', selectedVessel?.name || '');
                            // Auto-populate vessel type from vessel's linked vtuid
                            if (selectedVessel?.vtuid) {
                              const vesselTypeName = vesselTypeIdToNameMap.get(selectedVessel.vtuid);
                              if (vesselTypeName) {
                                updateCurrentCompanySeaService(service.id, 'vesselType', vesselTypeName);
                              }
                            }
                          }}
                        >
                          <SelectTrigger className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6">
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
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Select
                          value={service.vesselType}
                          onValueChange={(value) => updateCurrentCompanySeaService(service.id, 'vesselType', value)}
                        >
                          <SelectTrigger className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6">
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
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Input
                          value={service.deadweight}
                          onChange={(e) => updateCurrentCompanySeaService(service.id, 'deadweight', e.target.value)}
                          className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                          placeholder="Enter deadweight"
                        />
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Input
                          value={service.engineTypePower}
                          onChange={(e) => updateCurrentCompanySeaService(service.id, 'engineTypePower', e.target.value)}
                          className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                          placeholder="Enter engine type/power"
                        />
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Input
                          value={service.ownerOperator}
                          onChange={(e) => updateCurrentCompanySeaService(service.id, 'ownerOperator', e.target.value)}
                          className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                          placeholder="Enter owner/operator"
                        />
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Select
                          value={service.rank}
                          onValueChange={(value) => updateCurrentCompanySeaService(service.id, 'rank', value)}
                        >
                          <SelectTrigger className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6">
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
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Input
                          type="date"
                          value={service.from}
                          onChange={(e) => updateCurrentCompanySeaService(service.id, 'from', e.target.value)}
                          className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                        />
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        {(() => {
                          // Check if this is an active contract (no 'to' date or isActive flag)
                          const isActiveContract = !service.to || service.to === '' || (service as any).isActive === true;
                          
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
                                      {todayDate}
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
                              <Input
                                type="date"
                                value={service.to}
                                onChange={(e) => updateCurrentCompanySeaService(service.id, 'to', e.target.value)}
                                className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                                data-testid={`input-date-to-${service.id}`}
                              />
                            );
                          }
                        })()}
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        {(() => {
                          // For active contracts, calculate period from 'from' date to today
                          const isActiveContract = !service.to || service.to === '' || (service as any).isActive === true;
                          
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
                            className="h-6 w-6 text-gray-400 hover:text-red-600"
                            onClick={() => removeCurrentCompanySeaService(service.id)}
                            data-testid={`button-delete-current-service-${service.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
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

  // E2: External Sea Service render function
  const renderE2ExternalSeaService = () => {
    return (
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>E2. Details of Sea Service (External)</h3>
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
        </div>
        
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Vessel Name</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Vessel Type</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Deadweight</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Engine Type/ Power</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Owner / operator</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Rank</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">From</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">To</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Period(M)</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left">Experience</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left w-24">Actions</th>
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
                          onChange={(e) => updateExternalSeaService(service.id, 'vesselName', e.target.value)}
                          className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                          placeholder="Enter vessel name"
                        />
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Select
                          value={service.vesselType}
                          onValueChange={(value) => updateExternalSeaService(service.id, 'vesselType', value)}
                        >
                          <SelectTrigger className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6">
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
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Input
                          value={service.deadweight}
                          onChange={(e) => updateExternalSeaService(service.id, 'deadweight', e.target.value)}
                          className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                          placeholder="Enter deadweight"
                        />
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Input
                          value={service.engineTypePower}
                          onChange={(e) => updateExternalSeaService(service.id, 'engineTypePower', e.target.value)}
                          className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                          placeholder="Enter engine type/power"
                        />
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Input
                          value={service.ownerOperator}
                          onChange={(e) => updateExternalSeaService(service.id, 'ownerOperator', e.target.value)}
                          className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                          placeholder="Enter owner/operator"
                        />
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Select
                          value={service.rank}
                          onValueChange={(value) => updateExternalSeaService(service.id, 'rank', value)}
                        >
                          <SelectTrigger className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6">
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
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Input
                          type="date"
                          value={service.from}
                          onChange={(e) => updateExternalSeaService(service.id, 'from', e.target.value)}
                          className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                        />
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Input
                          type="date"
                          value={service.to}
                          onChange={(e) => updateExternalSeaService(service.id, 'to', e.target.value)}
                          className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                        />
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
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left w-24">Actions</th>
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
                          <SelectTrigger className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6">
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
                        <Input
                          type="date"
                          value={medical.dateOfMedical}
                          onChange={(e) => updatePreJoiningMedical(medical.id, 'dateOfMedical', e.target.value)}
                          className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                        />
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Input
                          value={medical.bp}
                          onChange={(e) => updatePreJoiningMedical(medical.id, 'bp', e.target.value)}
                          className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                        />
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Input
                          value={medical.weight}
                          onChange={(e) => updatePreJoiningMedical(medical.id, 'weight', e.target.value)}
                          className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                        />
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Input
                          value={medical.anyMedicationPrescribed}
                          onChange={(e) => updatePreJoiningMedical(medical.id, 'anyMedicationPrescribed', e.target.value)}
                          className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                          placeholder="Enter medication"
                        />
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Select
                          value={medical.fitnessForDuty || ''}
                          onValueChange={(value) => updatePreJoiningMedical(medical.id, 'fitnessForDuty', value)}
                        >
                          <SelectTrigger className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Fit">Fit</SelectItem>
                            <SelectItem value="Unfit">Unfit</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Input
                          type="date"
                          value={medical.expiry}
                          onChange={(e) => updatePreJoiningMedical(medical.id, 'expiry', e.target.value)}
                          className={`border-0 bg-transparent p-0 focus-visible:ring-0 ${getExpiryColorClass(medical.expiry)} text-[13px] font-normal h-6`}
                        />
                      </td>
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
                  <th className="text-gray-600 text-xs font-normal py-2 px-2 sm:px-4 text-left w-24">Actions</th>
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
                          className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                          placeholder="Enter vessel"
                        />
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Input
                          value={visit.port}
                          onChange={(e) => updateDoctorVisit(visit.id, 'port', e.target.value)}
                          className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                          placeholder="Enter port"
                        />
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Input
                          type="date"
                          value={visit.date}
                          onChange={(e) => updateDoctorVisit(visit.id, 'date', e.target.value)}
                          className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                        />
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Input
                          value={visit.complaint}
                          onChange={(e) => updateDoctorVisit(visit.id, 'complaint', e.target.value)}
                          className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                          placeholder="Enter complaint/illness/injury"
                        />
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-2 sm:px-4">
                        <Input
                          value={visit.doctorComments}
                          onChange={(e) => updateDoctorVisit(visit.id, 'doctorComments', e.target.value)}
                          className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                          placeholder="Enter doctor comments"
                        />
                      </td>
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
    console.log('Saving crew info (V2):', formData);
    
    // Include the uploaded photo in the data to be saved
    const dataWithPhoto = { ...formData, uploadedPhoto: uploadedPhoto || null };
    
    // V2: Use crewUuid as primary identifier for updates
    const crewIdentifier = crewMember?.crewUuid || crewMember?.id;
    if (crewMember && crewIdentifier) {
      // Update existing crew member using crewUuid
      updateCrewMutation.mutate({ id: crewIdentifier, data: dataWithPhoto });
      
      // V2: Also save section data to their respective tables
      // Personal Details (A1.1 fields like height, weight, DOB, languages, etc.)
      const personalDetailsData = {
        height: formData.heightCm,
        weight: formData.weightKg,
        bmi: formData.bmi,
        dob: formData.dateOfBirth,
        placeOfBirthCity: formData.placeOfBirthCity,
        placeOfBirthCountry: formData.placeOfBirthCountry,
        nativeLanguage: formData.nativeLanguage,
        foreignLanguages: formData.foreignLanguages,
        englishProficiency: formData.englishProficiency,
        manningAgent: formData.manningAgent,
        crewPool: formData.crewPool,
      };
      console.log('V2 Saving Personal Details:', { crewUuid: crewIdentifier, data: personalDetailsData });
      savePersonalDetailsMutationV2.mutate({ crewUuid: crewIdentifier, data: personalDetailsData });
      
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
      console.log('V2 Saving Address:', { crewUuid: crewIdentifier, data: addressData });
      saveAddressMutationV2.mutate({ crewUuid: crewIdentifier, data: addressData });
      
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
      console.log('V2 Saving Family Info:', { crewUuid: crewIdentifier, data: familyInfoData });
      saveFamilyInfoMutationV2.mutate({ crewUuid: crewIdentifier, data: familyInfoData });
      
      // Children (A1.3 - array of child records)
      if (formData.children && formData.children.length > 0) {
        console.log('V2 Saving Children:', { crewUuid: crewIdentifier, count: formData.children.length });
        formData.children.forEach((child: any) => {
          const childData = {
            firstName: child.firstName,
            middleName: child.middleName,
            familyName: child.familyName,
            dateOfBirth: child.dateOfBirth,
            gender: child.gender,
          };
          saveChildMutationV2.mutate({ 
            crewUuid: crewIdentifier, 
            data: childData, 
            childUuid: child.childUuid 
          });
        });
      }
      
      // Next of Kin (NOK) - single record
      const nokData = {
        firstName: formData.nokFirstName,
        middleName: formData.nokMiddleName,
        familyName: formData.nokFamilyName,
        relationship: formData.nokRelationship,
        telephone: formData.nokTelephone,
        email: formData.nokEmail,
        address: formData.nokAddress,
      };
      // Only save if any NOK field has a value
      if (nokData.firstName || nokData.familyName || nokData.telephone || nokData.email) {
        console.log('V2 Saving Next of Kin:', { crewUuid: crewIdentifier, data: nokData });
        saveNextOfKinMutationV2.mutate({ crewUuid: crewIdentifier, data: nokData });
      }
      
      // Vessel Types Applied (A5 - array of vessel type UUIDs)
      // The form stores vesselType as an array of vessel type names/UUIDs
      if (formData.vesselType && Array.isArray(formData.vesselType) && formData.vesselType.length > 0) {
        console.log('V2 Saving Vessel Types:', { crewUuid: crewIdentifier, vesselTypes: formData.vesselType });
        saveVesselTypesMutationV2.mutate({ crewUuid: crewIdentifier, vesselTypeUuids: formData.vesselType });
      }
      
      // BATCHED SAVE: Process saves in sequential batches to prevent database connection exhaustion
      // This is a production-critical pattern that prevents "too many clients" errors
      const batchErrors: string[] = [];
      const processBatch = async (batchName: string, operations: (() => Promise<any>)[]) => {
        if (operations.length === 0) return;
        console.log(`V2 Processing batch: ${batchName} (${operations.length} operations)`);
        
        // Process operations in smaller sub-batches of 3 to prevent connection spikes
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
        console.log(`V2 Completed batch: ${batchName}`);
      };
      
      // Collect operations into batches instead of firing immediately
      const batch1Operations: (() => Promise<any>)[] = []; // Documents + Visas
      const batch2Operations: (() => Promise<any>)[] = []; // Education + Licenses
      const batch3Operations: (() => Promise<any>)[] = []; // Training + Sea Service
      const batch4Operations: (() => Promise<any>)[] = []; // Medicals + Doctor Visits
      
      // Documents (Part C - C1 Travel and Identification Docs) - Add to Batch 1
      if (formData.documents && formData.documents.length > 0) {
        console.log('V2 Preparing Documents for batch:', { crewUuid: crewIdentifier, count: formData.documents.length });
        formData.documents.forEach((doc: any, index: number) => {
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
          
          // Push operation factory to batch instead of executing immediately
          batch1Operations.push(async () => {
            const savedDoc = await saveDocumentMutationV2.mutateAsync({ 
              crewUuid: crewIdentifier, 
              data: docData, 
              docUuid: doc.docUuid 
            });
            const savedDocUuid = savedDoc?.docUuid || doc.docUuid;
            
            // Handle attachments sequentially
            for (const att of capturedDeletedAttachments) {
              await removeDocumentAttachmentV2.mutateAsync({
                crewUuid: crewIdentifier,
                docUuid: savedDocUuid,
                attUuid: att.attUuid
              });
            }
            for (const att of capturedNewAttachments) {
              await addDocumentAttachmentV2.mutateAsync({
                crewUuid: crewIdentifier,
                docUuid: savedDocUuid,
                data: { fileName: att.name, fileUrl: att.data, fileSize: String(att.size || 0), mimeType: att.type }
              });
            }
            return savedDoc;
          });
        });
      }
      
      // Visas (Part C - C2 Visas) - Add to Batch 1
      if (formData.visas && formData.visas.length > 0) {
        console.log('V2 Preparing Visas for batch:', { crewUuid: crewIdentifier, count: formData.visas.length });
        formData.visas.forEach((visa: any, index: number) => {
          const visaAttachments = visa.attachments || [];
          const capturedNewAttachments = [...visaAttachments.filter((att: any) => !att.attUuid || att.isNew)];
          const capturedDeletedAttachments = [...visaAttachments.filter((att: any) => att.isDeleted && att.attUuid)];
          
          const visaData = {
            visaUuid: visa.visaUuid,
            country: visa.issuingCountry || visa.country || '',
            serialNo: visa.serialNo || visa.serialNumber || '',
            issued: visa.issued || '',
            expiry: visa.expiry || '',
            visaType: visa.visaType || '',
            sortOrder: index,
          };
          
          batch1Operations.push(async () => {
            const savedVisa = await saveVisaMutationV2.mutateAsync({ 
              crewUuid: crewIdentifier, 
              data: visaData, 
              visaUuid: visa.visaUuid 
            });
            const savedVisaUuid = savedVisa?.visaUuid || visa.visaUuid;
            
            for (const att of capturedDeletedAttachments) {
              await removeVisaAttachmentV2.mutateAsync({
                crewUuid: crewIdentifier,
                visaUuid: savedVisaUuid,
                attUuid: att.attUuid
              });
            }
            for (const att of capturedNewAttachments) {
              await addVisaAttachmentV2.mutateAsync({
                crewUuid: crewIdentifier,
                visaUuid: savedVisaUuid,
                data: { fileName: att.name, fileUrl: att.data, fileSize: String(att.size || 0), mimeType: att.type }
              });
            }
            return savedVisa;
          });
        });
      }
      
      // Education (Part D - D1) - Add to Batch 2
      if (formData.education && formData.education.length > 0) {
        console.log('V2 Preparing Education for batch:', { crewUuid: crewIdentifier, count: formData.education.length });
        formData.education.forEach((edu: any, index: number) => {
          const eduAttachments = edu.attachments || [];
          const capturedNewAttachments = [...eduAttachments.filter((att: any) => !att.attUuid || att.isNew)].map((att: any) => ({
            attUuid: att.attUuid,
            isNew: att.isNew || !att.attUuid,
            fileName: att.name || att.fileName || '',
            fileData: att.data || att.fileData || '',
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
          
          batch2Operations.push(async () => {
            // Delete attachments first (if any marked for deletion)
            const savedEduUuid = edu.eduUuid;
            if (savedEduUuid) {
              for (const att of capturedDeletedAttachments) {
                await removeEducationAttachmentV2.mutateAsync({
                  crewUuid: crewIdentifier,
                  eduUuid: savedEduUuid,
                  attUuid: att.attUuid
                });
              }
            }
            
            // Save record with attachments - hook handles attachment saves internally
            const savedEdu = await saveEducationMutationV2.mutateAsync({ 
              crewUuid: crewIdentifier, 
              data: eduData, 
              eduUuid: edu.eduUuid,
              attachments: capturedNewAttachments
            });
            return savedEdu;
          });
        });
      }
      
      // Licenses (Part D - D2) - Add to Batch 2
      if (formData.licenses && formData.licenses.length > 0) {
        console.log('V2 Preparing Licenses for batch:', { crewUuid: crewIdentifier, count: formData.licenses.length });
        formData.licenses.forEach((lic: any, index: number) => {
          const licAttachments = lic.attachments || [];
          const capturedNewAttachments = [...licAttachments.filter((att: any) => !att.attUuid || att.isNew)].map((att: any) => ({
            attUuid: att.attUuid,
            isNew: att.isNew || !att.attUuid,
            fileName: att.name || att.fileName || '',
            fileData: att.data || att.fileData || '',
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
          
          batch2Operations.push(async () => {
            // Delete attachments first (if any marked for deletion)
            const savedLicUuid = lic.licUuid;
            if (savedLicUuid) {
              for (const att of capturedDeletedAttachments) {
                await removeLicenseAttachmentV2.mutateAsync({
                  crewUuid: crewIdentifier,
                  licUuid: savedLicUuid,
                  attUuid: att.attUuid
                });
              }
            }
            
            // Save record with attachments - hook handles attachment saves internally
            const savedLic = await saveLicenseMutationV2.mutateAsync({ 
              crewUuid: crewIdentifier, 
              data: licData, 
              licUuid: lic.licUuid,
              attachments: capturedNewAttachments
            });
            return savedLic;
          });
        });
      }
      
      // Training Courses (Part D - D3) - Add to Batch 3
      if (formData.trainingCourses && formData.trainingCourses.length > 0) {
        console.log('V2 Preparing Training Courses for batch:', { crewUuid: crewIdentifier, count: formData.trainingCourses.length });
        formData.trainingCourses.forEach((train: any, index: number) => {
          const trainAttachments = train.attachments || [];
          const capturedNewAttachments = [...trainAttachments.filter((att: any) => !att.attUuid || att.isNew)].map((att: any) => ({
            attUuid: att.attUuid,
            isNew: att.isNew || !att.attUuid,
            fileName: att.name || att.fileName || '',
            fileData: att.data || att.fileData || '',
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
            sortOrder: index,
          };
          
          batch3Operations.push(async () => {
            // Delete attachments first (if any marked for deletion)
            const savedTrainUuid = train.trainUuid;
            if (savedTrainUuid) {
              for (const att of capturedDeletedAttachments) {
                await removeTrainingAttachmentV2.mutateAsync({
                  crewUuid: crewIdentifier,
                  trainUuid: savedTrainUuid,
                  attUuid: att.attUuid
                });
              }
            }
            
            // Save record with attachments - hook handles attachment saves internally
            const savedTrain = await saveTrainingCourseMutationV2.mutateAsync({ 
              crewUuid: crewIdentifier, 
              data: trainData, 
              trainUuid: train.trainUuid,
              attachments: capturedNewAttachments
            });
            return savedTrain;
          });
        });
      }
      
      const seaServiceErrors: string[] = [];
      (formData.currentCompanySeaService || []).forEach((sea: any, i: number) => {
        if (!sea.seaUuid) {
          const missing: string[] = [];
          if (!(sea.vesselName || '').trim()) missing.push('Vessel Name');
          if (!(sea.vesselType || '').trim()) missing.push('Vessel Type');
          if (!(sea.rank || '').trim()) missing.push('Rank');
          if (!(sea.from || sea.fromDate || '').trim()) missing.push('From Date');
          if (!(sea.to || sea.toDate || '').trim()) missing.push('To Date');
          if (missing.length > 0) seaServiceErrors.push(`E1 Company Sea Service Row ${i + 1}: ${missing.map(f => `'${f}'`).join(', ')} required to save this row.`);
        }
      });
      (formData.externalSeaService || []).forEach((sea: any, i: number) => {
        if (!sea.seaUuid) {
          const missing: string[] = [];
          if (!(sea.vesselName || '').trim()) missing.push('Vessel Name');
          if (!(sea.vesselType || '').trim()) missing.push('Vessel Type');
          if (!(sea.rank || '').trim()) missing.push('Rank');
          if (!(sea.from || sea.fromDate || '').trim()) missing.push('From Date');
          if (!(sea.to || sea.toDate || '').trim()) missing.push('To Date');
          if (missing.length > 0) seaServiceErrors.push(`E2 External Sea Service Row ${i + 1}: ${missing.map(f => `'${f}'`).join(', ')} required to save this row.`);
        }
      });
      if (seaServiceErrors.length > 0) {
        toast({
          title: "Validation Error",
          description: seaServiceErrors.join('\n'),
          variant: "destructive",
        });
        return;
      }

      // Sea Service - Company (Part E - E1) - Add to Batch 3
      if (formData.currentCompanySeaService && formData.currentCompanySeaService.length > 0) {
        console.log('V2 Preparing Company Sea Service for batch:', { crewUuid: crewIdentifier, count: formData.currentCompanySeaService.length });
        formData.currentCompanySeaService.forEach((sea: any, index: number) => {
          const seaAttachments = sea.attachments || [];
          const capturedNewAttachments = [...seaAttachments.filter((att: any) => !att.attUuid || att.isNew)].map((att: any) => ({
            attUuid: att.attUuid,
            isNew: att.isNew || !att.attUuid,
            fileName: att.name || att.fileName || '',
            fileData: att.data || att.fileData || '',
          }));
          const capturedDeletedAttachments = [...seaAttachments.filter((att: any) => att.isDeleted && att.attUuid)];
          
          const seaData: LegacySeaService = {
            seaUuid: sea.seaUuid,
            isCompanyService: true,
            vesselName: sea.vesselName || '',
            vesselCode: sea.vesselCode || '',
            vesselType: sea.vesselType || '',
            deadweight: sea.deadweight || '',
            engineTypePower: sea.engineTypePower || '',
            ownerOperator: sea.ownerOperator || '',
            rank: sea.rank || '',
            from: sea.from || sea.fromDate || '',
            to: sea.to || sea.toDate || '',
            fromDate: sea.fromDate || sea.from || '',
            toDate: sea.toDate || sea.to || '',
            periodMonths: sea.periodMonths || '',
            experienceCategories: sea.experienceCategories || [],
            sortOrder: index,
          };
          
          batch3Operations.push(async () => {
            // Delete attachments first (if any marked for deletion)
            const savedSeaUuid = sea.seaUuid;
            if (savedSeaUuid) {
              for (const att of capturedDeletedAttachments) {
                await removeSeaServiceAttachmentV2.mutateAsync({
                  crewUuid: crewIdentifier,
                  seaUuid: savedSeaUuid,
                  attUuid: att.attUuid
                });
              }
            }
            
            // Save record with attachments - hook handles attachment saves internally
            const savedSea = await saveSeaServiceMutationV2.mutateAsync({ 
              crewUuid: crewIdentifier, 
              data: seaData, 
              seaUuid: sea.seaUuid,
              attachments: capturedNewAttachments
            });
            return savedSea;
          });
        });
      }
      
      // Sea Service - External (Part E - E2) - Add to Batch 3
      if (formData.externalSeaService && formData.externalSeaService.length > 0) {
        console.log('V2 Preparing External Sea Service for batch:', { crewUuid: crewIdentifier, count: formData.externalSeaService.length });
        formData.externalSeaService.forEach((sea: any, index: number) => {
          const seaAttachments = sea.attachments || [];
          const capturedNewAttachments = [...seaAttachments.filter((att: any) => !att.attUuid || att.isNew)].map((att: any) => ({
            attUuid: att.attUuid,
            isNew: att.isNew || !att.attUuid,
            fileName: att.name || att.fileName || '',
            fileData: att.data || att.fileData || '',
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
            fromDate: sea.fromDate || sea.from || '',
            toDate: sea.toDate || sea.to || '',
            periodMonths: sea.periodMonths || '',
            experienceCategories: sea.experienceCategories || [],
            sortOrder: index,
          };
          
          batch3Operations.push(async () => {
            // Delete attachments first (if any marked for deletion)
            const savedSeaUuid = sea.seaUuid;
            if (savedSeaUuid) {
              for (const att of capturedDeletedAttachments) {
                await removeSeaServiceAttachmentV2.mutateAsync({
                  crewUuid: crewIdentifier,
                  seaUuid: savedSeaUuid,
                  attUuid: att.attUuid
                });
              }
            }
            
            // Save record with attachments - hook handles attachment saves internally
            const savedSea = await saveSeaServiceMutationV2.mutateAsync({ 
              crewUuid: crewIdentifier, 
              data: seaData, 
              seaUuid: sea.seaUuid,
              attachments: capturedNewAttachments
            });
            return savedSea;
          });
        });
      }
      
      // Pre-Joining Medicals (Part F - F1) - Add to Batch 4
      const nonEmptyMedicals = (formData.preJoiningMedicals || []).filter((med: any) => {
        if (med.medUuid) return true;
        const hasAttachments = (med.attachments || []).some((att: any) => !att.isDeleted);
        return (med.vesselCode || med.vessel || med.dateOfMedical || med.bp || med.weight || med.anyMedicationPrescribed || med.clinicHospital || med.fitnessForDuty || med.expiry || hasAttachments);
      });
      if (nonEmptyMedicals.length > 0) {
        console.log('V2 Preparing Pre-Joining Medicals for batch:', { crewUuid: crewIdentifier, count: nonEmptyMedicals.length });
        nonEmptyMedicals.forEach((med: any, index: number) => {
          const medAttachments = med.attachments || [];
          const capturedNewAttachments = [...medAttachments.filter((att: any) => !att.attUuid || att.isNew)].map((att: any) => ({
            attUuid: att.attUuid,
            isNew: att.isNew || !att.attUuid,
            fileName: att.name || att.fileName || '',
            fileData: att.data || att.fileData || '',
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
          
          batch4Operations.push(async () => {
            // Delete attachments first (if any marked for deletion)
            const savedMedUuid = med.medUuid;
            if (savedMedUuid) {
              for (const att of capturedDeletedAttachments) {
                await removeMedicalAttachmentV2.mutateAsync({
                  crewUuid: crewIdentifier,
                  medUuid: savedMedUuid,
                  attUuid: att.attUuid
                });
              }
            }
            
            // Save record with attachments - hook handles attachment saves internally
            const savedMed = await saveMedicalMutationV2.mutateAsync({ 
              crewUuid: crewIdentifier, 
              data: medData, 
              medUuid: med.medUuid,
              attachments: capturedNewAttachments
            });
            return savedMed;
          });
        });
      }
      
      // Doctor Visits (Part F - F2) - Add to Batch 4
      const nonEmptyVisits = (formData.doctorVisits || []).filter((visit: any) => {
        if (visit.visitUuid) return true;
        const hasAttachments = (visit.attachments || []).some((att: any) => !att.isDeleted);
        return (visit.vessel || visit.port || visit.date || visit.complaint || visit.doctorComments || visit.doctorName || visit.clinicHospital || visit.diagnosis || visit.treatment || visit.followUpDate || hasAttachments);
      });
      if (nonEmptyVisits.length > 0) {
        console.log('V2 Preparing Doctor Visits for batch:', { crewUuid: crewIdentifier, count: nonEmptyVisits.length });
        nonEmptyVisits.forEach((visit: any, index: number) => {
          const visitAttachments = visit.attachments || [];
          const capturedNewAttachments = [...visitAttachments.filter((att: any) => !att.attUuid || att.isNew)].map((att: any) => ({
            attUuid: att.attUuid,
            isNew: att.isNew || !att.attUuid,
            fileName: att.name || att.fileName || '',
            fileData: att.data || att.fileData || '',
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
          
          batch4Operations.push(async () => {
            // Delete attachments first (if any marked for deletion)
            const savedVisitUuid = visit.visitUuid;
            if (savedVisitUuid) {
              for (const att of capturedDeletedAttachments) {
                await removeDoctorVisitAttachmentV2.mutateAsync({
                  crewUuid: crewIdentifier,
                  visitUuid: savedVisitUuid,
                  attUuid: att.attUuid
                });
              }
            }
            
            // Save record with attachments - hook handles attachment saves internally
            const savedVisit = await saveDoctorVisitMutationV2.mutateAsync({ 
              crewUuid: crewIdentifier, 
              data: visitData, 
              visitUuid: visit.visitUuid,
              attachments: capturedNewAttachments
            });
            return savedVisit;
          });
        });
      }
      
      // EXECUTE BATCHES SEQUENTIALLY - Critical for preventing database connection exhaustion
      // This pattern ensures we never have more than ~3 concurrent connections
      (async () => {
        try {
          console.log('V2 Starting sequential batch execution...');
          await processBatch('Batch 1: Documents + Visas', batch1Operations);
          await processBatch('Batch 2: Education + Licenses', batch2Operations);
          await processBatch('Batch 3: Training + Sea Service', batch3Operations);
          await processBatch('Batch 4: Medicals + Doctor Visits', batch4Operations);
          
          if (batchErrors.length > 0) {
            console.error('V2: Batch execution completed with errors:', batchErrors);
            toast({
              title: "Partially Saved",
              description: `Some records failed to save: ${batchErrors.length} error(s). Please review and try again.`,
              variant: "destructive",
              duration: 6000,
            });
          } else {
            console.log('V2: All batches completed successfully');
          }
        } catch (error) {
          console.error('V2: Error during batch execution:', error);
          toast({
            title: "Save Error",
            description: "Some records failed to save. Please try again.",
            variant: "destructive",
            duration: 5000,
          });
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

  // Auto-save functionality
  const handleAutoSave = () => {
    console.log('Auto-saving current section:', activeSection);
    toast({
      title: "Auto-saved",
      description: `Section ${activeSection} has been auto-saved.`,
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
      console.log('[V2] Crew creation already in progress, waiting...');
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
      };
      
      // Use the same V2 mapping pipeline as the createCrewMutationV2 hook
      const v2Data = mapLegacyCrewToV2(legacyCrewData);
      
      console.log('[V2] Auto-creating crew record before edit:', { legacyCrewData, v2Data });
      const result = await crewPoolApiV2.createCrew(v2Data);
      const newCrewUuid = result?.crewUuid;
      
      if (newCrewUuid) {
        console.log('[V2] Crew record created with UUID:', newCrewUuid);
        setCreatedCrewId(newCrewUuid);
        
        // Invalidate query cache to reflect new crew
        queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool', 'crew'] });
        
        // Chain save of child tables with the new crewUuid (same as Save button path)
        // This ensures B1/address/family data is persisted immediately
        const personalDetailsData = {
          height: formData.heightCm,
          weight: formData.weightKg,
          bmi: formData.bmi,
          dob: formData.dateOfBirth,
          placeOfBirthCity: formData.placeOfBirthCity,
          placeOfBirthCountry: formData.placeOfBirthCountry,
          nativeLanguage: formData.nativeLanguage,
          foreignLanguages: formData.foreignLanguages,
          englishProficiency: formData.englishProficiency,
          manningAgent: formData.manningAgent,
          crewPool: formData.crewPool,
        };
        console.log('[V2] Chaining Personal Details save after auto-create:', { crewUuid: newCrewUuid, data: personalDetailsData });
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
        console.log('[V2] Chaining Address save after auto-create:', { crewUuid: newCrewUuid, data: addressData });
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
        console.log('[V2] Chaining Family Info save after auto-create:', { crewUuid: newCrewUuid, data: familyInfoData });
        crewPoolApiV2.saveFamilyInfo(newCrewUuid, mapLegacyFamilyInfoToV2(familyInfoData)).catch(
          (err) => console.error('[V2] Family Info auto-save error:', err)
        );
        
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
    
    // For B2 and B3, ensure crew exists before entering edit mode
    // B1 is the primary data entry section - no auto-save needed
    if (!isCurrentlyEditing && sectionId !== 'B1') {
      const crewUuidResult = await ensureCrewExists();
      if (!crewUuidResult) {
        // Failed to create crew - don't enter edit mode
        return;
      }
    }
    
    // If turning off edit mode and another section is being edited, auto-save
    const currentlyEditing = Object.keys(editingSections).find(key => editingSections[key]);
    if (currentlyEditing && currentlyEditing !== sectionId && editingSections[currentlyEditing]) {
      handleAutoSave();
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
          console.log('V2 Create crew response - crewUuid:', crewUuid);
          
          if (crewUuid) {
            setCreatedCrewId(crewUuid);
            if (onCrewMemberChange && responseData) {
              onCrewMemberChange(responseData);
            }
            
            // Chain save of child tables with the new crewUuid
            // Personal Details (B1 fields)
            const personalDetailsData = {
              height: data.heightCm || formData.heightCm,
              weight: data.weightKg || formData.weightKg,
              bmi: data.bmi || formData.bmi,
              dob: data.dateOfBirth || formData.dateOfBirth,
              placeOfBirthCity: data.placeOfBirthCity || formData.placeOfBirthCity,
              placeOfBirthCountry: data.placeOfBirthCountry || formData.placeOfBirthCountry,
              nativeLanguage: data.nativeLanguage || formData.nativeLanguage,
              foreignLanguages: data.foreignLanguages || formData.foreignLanguages,
              englishProficiency: data.englishProficiency || formData.englishProficiency,
              manningAgent: data.manningAgent || formData.manningAgent,
              crewPool: data.crewPool || formData.crewPool,
            };
            console.log('[V2] Chaining Personal Details save after create:', { crewUuid, data: personalDetailsData });
            savePersonalDetailsMutationV2.mutate({ crewUuid, data: personalDetailsData }, {
              onError: (err) => console.error('[V2] Personal Details chain save error:', err),
              onSuccess: () => console.log('[V2] Personal Details chain save success'),
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
            console.log('[V2] Chaining Address save after create:', { crewUuid, data: addressData });
            saveAddressMutationV2.mutate({ crewUuid, data: addressData }, {
              onError: (err) => console.error('[V2] Address chain save error:', err),
              onSuccess: () => console.log('[V2] Address chain save success'),
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
            console.log('[V2] Chaining Family Info save after create:', { crewUuid, data: familyInfoData });
            saveFamilyInfoMutationV2.mutate({ crewUuid, data: familyInfoData }, {
              onError: (err) => console.error('[V2] Family Info chain save error:', err),
              onSuccess: () => console.log('[V2] Family Info chain save success'),
            });
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
    console.log('Saving crew info (V2):', formData);
    
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
        placeOfBirthCity: formData.placeOfBirthCity,
        placeOfBirthCountry: formData.placeOfBirthCountry,
        nativeLanguage: formData.nativeLanguage,
        foreignLanguages: formData.foreignLanguages,
        englishProficiency: formData.englishProficiency,
        manningAgent: formData.manningAgent,
        crewPool: formData.crewPool,
      };
      console.log('V2 Personal Details Save:', { crewUuid: existingUuid, data: personalDetailsData });
      savePersonalDetailsMutationV2.mutate({ crewUuid: existingUuid, data: personalDetailsData }, {
        onError: (err) => console.error('Personal Details Save Error:', err),
        onSuccess: (res) => console.log('Personal Details Saved:', res),
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
      console.log('Creating new crew with V2 API:', dataWithPhoto);
      createCrewMutation.mutate(dataWithPhoto);
    }
  };

  const isSaving = isCreatingCrew || createCrewMutation.isPending || updateCrewMutation.isPending || 
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

    // Observe all section refs
    [sectionARef, sectionBRef, sectionCRef, sectionDRef, sectionERef, sectionFRef].forEach((ref) => {
      if (ref.current) {
        observer.observe(ref.current);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [isOpen, activeSection]);

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
                  {crewMember ? `${crewMember.firstName} ${crewMember.familyName}, ${normalizeRank(crewMember.presentRank || '') || 'Crew Member'}` : 'Crew Member'}
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
            <Card className="bg-white border border-gray-200 shadow-sm" ref={sectionARef} data-section="A">
              <CardContent className="p-3 sm:p-4 lg:p-6">
                {renderDashboard()}
              </CardContent>
            </Card>

            {/* B - Seafarers' Particulars */}
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

            {/* D - Training & Certificates */}
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

            {/* E - Sea Service */}
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

            {/* F - Medical Records */}
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
            <Input
              type="date"
              value={tempNextAvailability}
              onChange={(e) => setTempNextAvailability(e.target.value)}
              className="mt-1"
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
        existingCountryIds={formData.visas.map(v => v.countryId).filter(Boolean)}
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