import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StandardFormPopup } from '@/components/ui/form-popup';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Edit, Plus, Save, Trash2, Upload, Paperclip, X, Camera, FileText, Info, MessageSquare, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FileAttachmentDialog, type FileAttachment } from '@/components/FileAttachmentDialog';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useCompanyRanks } from '@/hooks/useCompanyRanks';
import { useExternalNationalities } from '@/hooks/useExternalNationalities';
import { useExternalVesselTypes } from '@/hooks/useExternalVesselTypes';
import { useExternalCountries } from '@/hooks/useExternalCountries';
import { useExternalLanguages } from '@/hooks/useExternalLanguages';
import { useExternalUsers } from '@/hooks/useExternalUsers';
import { useExternalVessels } from '@/hooks/useExternalVessels';
import { useExternalFleetGroups } from '@/hooks/useExternalFleetGroups';
import {
  useV2Candidate,
  useV2CreateCandidate,
  useV2UpdateCandidate,
  useV2PersonalDetails,
  useV2SavePersonalDetails,
  useV2Address,
  useV2SaveAddress,
  useV2FamilyInfo,
  useV2SaveFamilyInfo,
  useV2Children,
  useV2SaveChildren,
  useV2NextOfKin,
  useV2SaveNextOfKin,
  useV2VesselTypes,
  useV2SaveVesselTypes,
  useV2Documents,
  useV2SaveDocument,
  useV2UpdateDocument,
  useV2DeleteDocument,
  useV2Visas,
  useV2SaveVisa,
  useV2UpdateVisa,
  useV2DeleteVisa,
  useV2Education,
  useV2SaveEducation,
  useV2UpdateEducation,
  useV2DeleteEducation,
  useV2Licenses,
  useV2SaveLicense,
  useV2UpdateLicense,
  useV2DeleteLicense,
  useV2TrainingCourses,
  useV2SaveTrainingCourse,
  useV2UpdateTrainingCourse,
  useV2DeleteTrainingCourse,
  useV2SeaService,
  useV2SaveSeaService,
  useV2UpdateSeaService,
  useV2DeleteSeaService,
  useV2AdditionalInfo,
  useV2SaveAdditionalInfo,
  useV2UpdateAdditionalInfo,
  useV2DeleteAdditionalInfo,
  useV2ScreeningB1,
  useV2SaveScreeningB1,
  useV2ScreeningB2,
  useV2SaveScreeningB2,
  useV2ScreeningB3,
  useV2SaveScreeningB3,
  useV2ScreeningB4,
  useV2SaveScreeningB4,
  useV2ScreeningB5,
  useV2SaveScreeningB5,
  useV2ScreeningB6,
  useV2SaveScreeningB6,
  useV2ScreeningB7,
  useV2SaveScreeningB7,
  useV2ScreeningB8,
  useV2SaveScreeningB8,
  useV2ScreeningB2Items,
  useV2CreateScreeningB2Item,
  useV2ScreeningB3Authorities,
  useV2CreateScreeningB3Authority,
  useV2ScreeningB4CertItems,
  useV2CreateScreeningB4CertItem,
  useV2ScreeningB5TestItems,
  useV2CreateScreeningB5TestItem,
  useV2ScreeningB6InterviewItems,
  useV2CreateScreeningB6InterviewItem,
  useV2ScreeningB7TrainingItems,
  useV2CreateScreeningB7TrainingItem,
  useV2ScreeningB8Approvers,
  useV2CreateScreeningB8Approver,
  useV2ScreeningB1Comments,
  useV2CreateScreeningB1Comment,
  useV2ScreeningB2Comments,
  useV2CreateScreeningB2Comment,
  useV2ScreeningB3Comments,
  useV2CreateScreeningB3Comment,
  useV2ScreeningB4Comments,
  useV2CreateScreeningB4Comment,
  useV2ScreeningB5Comments,
  useV2CreateScreeningB5Comment,
  useV2ScreeningB6Comments,
  useV2CreateScreeningB6Comment,
  useV2ScreeningB8Comments,
  useV2CreateScreeningB8Comment,
  useV2Approvals,
  useV2SaveApproval,
  useV2UpdateApproval,
  useV2Suitability,
  useV2SaveSuitability,
  useV2RecruitmentDecision,
  useV2SaveRecruitmentDecision,
} from './hooks/useRecruitmentV2';
import type { V2CandidateListItem } from './types/formTypes';
import { LicenseSelectionDialog } from '@/modules/crew-pool/LicenseSelectionDialog';
import { TrainingCourseSelectionDialog } from '@/modules/crew-pool/TrainingCourseSelectionDialog';
import { TravelDocumentSelectionDialog } from '@/modules/crew-pool/TravelDocumentSelectionDialog';
import { VisaSelectionDialog } from '@/modules/crew-pool/VisaSelectionDialog';
import type { LicenseTemplate } from '@/utils/data/licenseDceTemplates';
import type { TrainingCourseTemplate } from '@/utils/data/trainingCourseTemplates';
import type { TravelDocumentTemplate } from '@/utils/data/travelDocumentTemplates';
import type { VisaCountryTemplate } from '@/utils/data/visaCountryTemplates';

interface RecruitmentApplicationFormV2Props {
  candidate: V2CandidateListItem | null;
  onClose: () => void;
}

interface LocalFormData {
  uploadedPhoto: string;
  firstName: string;
  middleName: string;
  familyName: string;
  gender: string;
  nationality: string;
  presentRank: string;
  vesselType: string[];
  dateOfBirth: string;
  placeOfBirthCity: string;
  placeOfBirthCountry: string;
  ageInYears: string;
  heightCm: string;
  weightKg: string;
  nativeLanguage: string;
  foreignLanguages: string;
  englishProficiency: string;
  rankAppliedFor: string;
  manningAgent: string;
  fileNo: string;
  countryOfResidence: string;
  nearestAirport: string;
  residentialAddressLine1: string;
  residentialAddressLine2: string;
  contactLandline: string;
  mobile: string;
  email: string;
  maritalStatus: string;
  numberOfDependentChildren: string;
  fatherName: string;
  motherName: string;
  spouseFirstName: string;
  spouseMiddleName: string;
  spouseFamilyName: string;
  spouseDateOfBirth: string;
  children: Array<{
    id: string;
    firstName: string;
    middleName: string;
    familyName: string;
    dateOfBirth: string;
    gender: string;
  }>;
  nokFirstName: string;
  nokMiddleName: string;
  nokFamilyName: string;
  nokTelephone: string;
  nokEmail: string;
  nokAddress: string;
  nokRelationship: string;
  documents: Array<{
    id: string;
    serverId?: number;
    documentId?: string;
    document: string;
    number: string;
    issued: string;
    expiry: string;
    issuingAuthority: string;
    attachments?: FileAttachment[];
  }>;
  visas: Array<{
    id: string;
    serverId?: number;
    countryId?: string;
    issuingCountry: string;
    serialNo: string;
    issued: string;
    expiry: string;
    visaType: string;
    attachments?: FileAttachment[];
  }>;
  education: Array<{
    id: string;
    serverId?: number;
    dateOfCompletion: string;
    schoolCollegeUniversity: string;
    subjectsField: string;
    qualifications: string;
    attachments?: FileAttachment[];
  }>;
  licenses: Array<{
    id: string;
    serverId?: number;
    licenseId?: string;
    certificateDocument: string;
    abbr: string;
    requirement: string;
    certificateNo: string;
    issuingAuthority: string;
    issued: string;
    expiry: string;
    attachments?: FileAttachment[];
  }>;
  trainingCourses: Array<{
    id: string;
    serverId?: number;
    courseId?: string;
    trainingCourse: string;
    abbr: string;
    requirement: string;
    certificateNo: string;
    issuingAuthority: string;
    issued: string;
    expiry: string;
    attachments?: FileAttachment[];
  }>;
  seaService: Array<{
    id: string;
    serverId?: number;
    vesselName: string;
    vesselType: string;
    deadweight: string;
    engineTypePower: string;
    ownerOperator: string;
    rank: string;
    from: string;
    to: string;
    periodMonths: string;
    attachments?: FileAttachment[];
  }>;
  additionalInfo: Array<{
    id: string;
    serverId?: number;
    information: string;
    response: string;
    attachments?: FileAttachment[];
  }>;
  b1AgeMeetsCriteria: string;
  b1RankMeetsCriteria: string;
  b1CertificatesValid: string;
  b1Shortlisted: string;
  b2ReferencesCompleted: string;
  b2EmployerFeedback: string;
  b2References: Array<{ id: string; date: string; nameDesignation: string; contactInfo: string }>;
  b3ChecksCompleted: string;
  b3Results: string;
  b3Authorities: Array<{ id: string; serverId?: number; date?: string; authority?: string; authorityName?: string; checkType?: string; dateChecked?: string; result?: string; remarks?: string }>;
  b4CertificatesAuthenticated: string;
  b4Results: string;
  b4Certs: Array<{ id: string; serverId?: number; date: string; certificate: string; authority: string }>;
  b4CertItems: Array<{ id: string; serverId?: number; date?: string; certificate?: string; authority?: string; certificateName?: string; issuingAuthority?: string; dateVerified?: string; verificationResult?: string; remarks?: string }>;
  b5TestsCompleted: string;
  b5Tests: Array<{ id: string; serverId?: number; date: string; subject: string; score: string; result: string }>;
  b5TestItems: Array<{ id: string; serverId?: number; date?: string; subject?: string; score?: string; result?: string; testType?: string; testDate?: string; remarks?: string }>;
  b6InterviewCompleted: string;
  b6Interviews: Array<{ id: string; serverId?: number; date: string; interviewer: string; status: string; result: string; comments: string }>;
  b6InterviewItems: Array<{ id: string; serverId?: number; date?: string; interviewer?: string; status?: string; result?: string; comments?: string; interviewerName?: string; interviewDate?: string; interviewType?: string; remarks?: string }>;
  b7TrainingNeeds: Array<{ id: string; serverId?: number; training?: string; identifiedBy?: string; category?: string; dueDate?: string; comments?: string; trainingName?: string; trainingType?: string; provider?: string; scheduledDate?: string; status?: string; remarks?: string }>;
  b8Shortlisted: string;
  b8SelectedApprovers: Array<{ id: string; serverId?: number; approverName?: string; approverRole?: string; approvalDate?: string; decision?: string; remarks?: string }>;
  b2ReferenceItems: Array<{ id: string; serverId?: number; date?: string; nameDesignation?: string; contactInfo?: string; employerName?: string; contactPerson?: string; contactNumber?: string; dateContacted?: string; feedback?: string; rating?: string }>;
  // Comment fields for B1-B8
  b1Comments: {[key: string]: Array<{user: string; text: string; id: string}>};
  b2Comments: {[key: string]: Array<{user: string; text: string; id: string}>};
  b3Comments: {[key: string]: Array<{user: string; text: string; id: string}>};
  b4Comments: {[key: string]: Array<{user: string; text: string; id: string}>};
  b5Comments: {[key: string]: Array<{user: string; text: string; id: string}>};
  b6Comments: {[key: string]: Array<{user: string; text: string; id: string}>};
  b7Comments: {[key: string]: Array<{user: string; text: string; id: string}>};
  b8Comments: {[key: string]: Array<{user: string; text: string; id: string}>};
  // Attachments for B1-B8
  b1Attachments: FileAttachment[];
  b2Attachments: FileAttachment[];
  b3Attachments: FileAttachment[];
  b4Attachments: FileAttachment[];
  b5Attachments: FileAttachment[];
  b6Attachments: FileAttachment[];
  b7Attachments: FileAttachment[];
  b8Attachments: FileAttachment[];
  // Submit fields for B1-B8
  b1SubmittedBy: string;
  b1SubmittedDate: string;
  b2SubmittedBy: string;
  b2SubmittedDate: string;
  b3SubmittedBy: string;
  b3SubmittedDate: string;
  b4SubmittedBy: string;
  b4SubmittedDate: string;
  b5SubmittedBy: string;
  b5SubmittedDate: string;
  b6SubmittedBy: string;
  b6SubmittedDate: string;
  b7SubmittedBy: string;
  b7SubmittedDate: string;
  b8SubmittedBy: string;
  selectedApproversForSubmission: string[];
  b8SubmittedDate: string;
  // Part C - Approval fields
  c1Approvers: Array<{
    id: string;
    serverId?: number;
    appUuid?: string;
    date: string;
    approver: string;
    status: string;
    approval: string;
    comments: string;
  }>;
  c2VesselTypes: string[];
  c2FleetGroups: string[];
  c3RecruitmentStatus: string;
  c3AssignedGroups: string[];
  c3SubmittedBy: string;
  c3SubmittedDate: string;
}

const getInitialFormData = (): LocalFormData => ({
  uploadedPhoto: '',
  firstName: '',
  middleName: '',
  familyName: '',
  gender: '',
  nationality: '',
  presentRank: '',
  vesselType: [],
  dateOfBirth: '',
  placeOfBirthCity: '',
  placeOfBirthCountry: '',
  ageInYears: '',
  heightCm: '',
  weightKg: '',
  nativeLanguage: '',
  foreignLanguages: '',
  englishProficiency: '',
  rankAppliedFor: '',
  manningAgent: '',
  fileNo: '',
  countryOfResidence: '',
  nearestAirport: '',
  residentialAddressLine1: '',
  residentialAddressLine2: '',
  contactLandline: '',
  mobile: '',
  email: '',
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
  documents: [],
  visas: [],
  education: [],
  licenses: [],
  trainingCourses: [],
  seaService: [],
  additionalInfo: [],
  b1AgeMeetsCriteria: '',
  b1RankMeetsCriteria: '',
  b1CertificatesValid: '',
  b1Shortlisted: '',
  b2ReferencesCompleted: '',
  b2EmployerFeedback: '',
  b2References: [{ id: '1', date: '', nameDesignation: '', contactInfo: '' }],
  b3ChecksCompleted: '',
  b3Results: '',
  b3Authorities: [{ id: '1', date: '', authority: '' }],
  b4CertificatesAuthenticated: '',
  b4Results: '',
  b4Certs: [{ id: '1', date: '', certificate: '', authority: '' }],
  b4CertItems: [],
  b5TestsCompleted: '',
  b5Tests: [{ id: '1', date: '', subject: '', score: '', result: '' }],
  b5TestItems: [],
  b6InterviewCompleted: '',
  b6Interviews: [{ id: '1', date: '', interviewer: '', status: '', result: '', comments: '' }],
  b6InterviewItems: [],
  b7TrainingNeeds: [{ id: '1', training: '', identifiedBy: '', category: '', dueDate: '', comments: '' }],
  b8Shortlisted: '',
  b8SelectedApprovers: [],
  b2ReferenceItems: [],
  // Comments for B1-B8
  b1Comments: {},
  b2Comments: {},
  b3Comments: {},
  b4Comments: {},
  b5Comments: {},
  b6Comments: {},
  b7Comments: {},
  b8Comments: {},
  // Attachments for B1-B8
  b1Attachments: [],
  b2Attachments: [],
  b3Attachments: [],
  b4Attachments: [],
  b5Attachments: [],
  b6Attachments: [],
  b7Attachments: [],
  b8Attachments: [],
  // Submit fields for B1-B8
  b1SubmittedBy: '',
  b1SubmittedDate: '',
  b2SubmittedBy: '',
  b2SubmittedDate: '',
  b3SubmittedBy: '',
  b3SubmittedDate: '',
  b4SubmittedBy: '',
  b4SubmittedDate: '',
  b5SubmittedBy: '',
  b5SubmittedDate: '',
  b6SubmittedBy: '',
  b6SubmittedDate: '',
  b7SubmittedBy: '',
  b7SubmittedDate: '',
  b8SubmittedBy: '',
  selectedApproversForSubmission: [],
  b8SubmittedDate: '',
  // Part C - Approval initial values
  c1Approvers: [{ id: `approver-${Date.now()}`, serverId: undefined, appUuid: undefined, date: '', approver: '', status: '', approval: '', comments: '' }],
  c2VesselTypes: [],
  c2FleetGroups: [],
  c3RecruitmentStatus: '',
  c3AssignedGroups: [],
  c3SubmittedBy: '',
  c3SubmittedDate: '',
});

type SectionType = 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'B' | 'C';

const sections: { id: SectionType; number: string; title: string; type: 'continuous' | 'stepper' }[] = [
  { id: 'A1', number: 'A1', title: "Seafarer's Particulars", type: 'continuous' },
  { id: 'A2', number: 'A2', title: 'Travel & ID Documents', type: 'continuous' },
  { id: 'A3', number: 'A3', title: 'Training & Certificates', type: 'continuous' },
  { id: 'A4', number: 'A4', title: 'Sea Service', type: 'continuous' },
  { id: 'A5', number: 'A5', title: 'Additional Information', type: 'continuous' },
  { id: 'B', number: 'B', title: 'Company Processing', type: 'stepper' },
  { id: 'C', number: 'C', title: 'Approval', type: 'stepper' },
];

export const RecruitmentApplicationFormV2: React.FC<RecruitmentApplicationFormV2Props> = ({
  candidate,
  onClose
}) => {
  const [activeSection, setActiveSection] = useState<SectionType>('A1');
  const [activeContinuousSection, setActiveContinuousSection] = useState<SectionType>('A1');
  const [recCanUuid, setRecCanUuid] = useState<string | null>(candidate?.recCanUuid || null);
  const [formData, setFormData] = useState<LocalFormData>(getInitialFormData);
  const [editingSections, setEditingSections] = useState<{[key: string]: boolean}>({
    'A1.1': true,
    'A1.2': true,
    'A1.3': true,
  });
  
  // Comment editing state - exact copy from legacy
  const [editingB1Comment, setEditingB1Comment] = useState<string | null>(null);
  const [newB1Comment, setNewB1Comment] = useState<{[key: string]: string}>({});
  const [editingB2Comment, setEditingB2Comment] = useState<string | null>(null);
  const [newB2Comment, setNewB2Comment] = useState<{[key: string]: string}>({});
  const [editingB3Comment, setEditingB3Comment] = useState<string | null>(null);
  const [newB3Comment, setNewB3Comment] = useState<{[key: string]: string}>({});
  const [editingB4Comment, setEditingB4Comment] = useState<string | null>(null);
  const [newB4Comment, setNewB4Comment] = useState<{[key: string]: string}>({});
  const [editingB5Comment, setEditingB5Comment] = useState<string | null>(null);
  const [newB5Comment, setNewB5Comment] = useState<{[key: string]: string}>({});
  const [editingB6Comment, setEditingB6Comment] = useState<string | null>(null);
  const [newB6Comment, setNewB6Comment] = useState<{[key: string]: string}>({});
  const [editingB7Comment, setEditingB7Comment] = useState<string | null>(null);
  const [newB7Comment, setNewB7Comment] = useState<{[key: string]: string}>({});
  const [editingB8Comment, setEditingB8Comment] = useState<string | null>(null);
  const [newB8Comment, setNewB8Comment] = useState<{[key: string]: string}>({});
  
  // Current user for comments - get from sessionStorage like legacy
  const currentUser = useMemo(() => {
    const name = sessionStorage.getItem('crewUserName') || 'Unknown User';
    const position = sessionStorage.getItem('crewDesignation') || 'Unknown Position';
    return { name, position };
  }, []);
  const currentUserDisplay = `${currentUser.name}, ${currentUser.position}`;
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const a1Ref = useRef<HTMLDivElement>(null);
  const a2Ref = useRef<HTMLDivElement>(null);
  const a3Ref = useRef<HTMLDivElement>(null);
  const a4Ref = useRef<HTMLDivElement>(null);
  const a5Ref = useRef<HTMLDivElement>(null);
  const sectionA13Ref = useRef<HTMLDivElement>(null);

  const [attachmentDialog, setAttachmentDialog] = useState<{
    open: boolean;
    type: 'document' | 'visa' | 'education' | 'license' | 'training' | 'seaService' | 'additionalInfo' | 'b1' | 'b2' | 'b3' | 'b4' | 'b5' | 'b6' | 'b7' | 'b8' | null;
    itemId: string;
    itemName: string;
  }>({ open: false, type: null, itemId: '', itemName: '' });

  const [isLicenseDialogOpen, setIsLicenseDialogOpen] = useState(false);
  const [isTrainingDialogOpen, setIsTrainingDialogOpen] = useState(false);
  const [isTravelDocDialogOpen, setIsTravelDocDialogOpen] = useState(false);
  const [isVisaDialogOpen, setIsVisaDialogOpen] = useState(false);

  const { data: candidateData, isLoading: candidateLoading } = useV2Candidate(recCanUuid);
  const { data: personalDetails, isLoading: personalDetailsLoading } = useV2PersonalDetails(recCanUuid);
  const { data: addressData, isLoading: addressLoading } = useV2Address(recCanUuid);
  const { data: familyInfo, isLoading: familyInfoLoading } = useV2FamilyInfo(recCanUuid);
  const { data: childrenData, isLoading: childrenLoading } = useV2Children(recCanUuid);
  const { data: nextOfKinData, isLoading: nextOfKinLoading } = useV2NextOfKin(recCanUuid);
  const { data: vesselTypesData, isLoading: vesselTypesLoading } = useV2VesselTypes(recCanUuid);
  const { data: documentsData } = useV2Documents(recCanUuid);
  const { data: visasData } = useV2Visas(recCanUuid);
  const { data: educationData } = useV2Education(recCanUuid);
  const { data: licensesData } = useV2Licenses(recCanUuid);
  const { data: trainingData } = useV2TrainingCourses(recCanUuid);
  const { data: seaServiceData } = useV2SeaService(recCanUuid);
  const { data: additionalInfoData } = useV2AdditionalInfo(recCanUuid);

  const { data: screeningB1Data } = useV2ScreeningB1(recCanUuid);
  const { data: screeningB2Data } = useV2ScreeningB2(recCanUuid);
  const { data: screeningB3Data } = useV2ScreeningB3(recCanUuid);
  const { data: screeningB4Data } = useV2ScreeningB4(recCanUuid);
  const { data: screeningB5Data } = useV2ScreeningB5(recCanUuid);
  const { data: screeningB6Data } = useV2ScreeningB6(recCanUuid);
  const { data: screeningB7Data } = useV2ScreeningB7(recCanUuid);
  const { data: screeningB8Data } = useV2ScreeningB8(recCanUuid);

  // Part C - Approval data
  const { data: approvalsData } = useV2Approvals(recCanUuid);
  const { data: suitabilityData } = useV2Suitability(recCanUuid);
  const { data: decisionData } = useV2RecruitmentDecision(recCanUuid);

  const b1Uuid = screeningB1Data?.b1Uuid || null;
  const b2Uuid = screeningB2Data?.b2Uuid || null;
  const b3Uuid = screeningB3Data?.b3Uuid || null;
  const b4Uuid = screeningB4Data?.b4Uuid || null;
  const b5Uuid = screeningB5Data?.b5Uuid || null;
  const b6Uuid = screeningB6Data?.b6Uuid || null;
  const b7Uuid = screeningB7Data?.b7Uuid || null;
  const b8Uuid = screeningB8Data?.b8Uuid || null;

  const { data: screeningB1Comments } = useV2ScreeningB1Comments(b1Uuid);
  const { data: screeningB2Comments } = useV2ScreeningB2Comments(b2Uuid);
  const { data: screeningB3Comments } = useV2ScreeningB3Comments(b3Uuid);
  const { data: screeningB4Comments } = useV2ScreeningB4Comments(b4Uuid);
  const { data: screeningB5Comments } = useV2ScreeningB5Comments(b5Uuid);
  const { data: screeningB6Comments } = useV2ScreeningB6Comments(b6Uuid);
  const { data: screeningB8Comments } = useV2ScreeningB8Comments(b8Uuid);

  const { data: screeningB2Items } = useV2ScreeningB2Items(b2Uuid);
  const { data: screeningB3Authorities } = useV2ScreeningB3Authorities(b3Uuid);
  const { data: screeningB4CertItems } = useV2ScreeningB4CertItems(b4Uuid);
  const { data: screeningB5TestItems } = useV2ScreeningB5TestItems(b5Uuid);
  const { data: screeningB6InterviewItems } = useV2ScreeningB6InterviewItems(b6Uuid);
  const { data: screeningB7TrainingItems } = useV2ScreeningB7TrainingItems(b7Uuid);
  const { data: screeningB8Approvers } = useV2ScreeningB8Approvers(b8Uuid);

  const createCandidateMutation = useV2CreateCandidate();
  const updateCandidateMutation = useV2UpdateCandidate();
  const savePersonalDetailsMutation = useV2SavePersonalDetails();
  const saveAddressMutation = useV2SaveAddress();
  const saveFamilyInfoMutation = useV2SaveFamilyInfo();
  const saveChildrenMutation = useV2SaveChildren();
  const saveNextOfKinMutation = useV2SaveNextOfKin();
  const saveVesselTypesMutation = useV2SaveVesselTypes();
  
  const saveDocumentMutation = useV2SaveDocument();
  const updateDocumentMutation = useV2UpdateDocument();
  const deleteDocumentMutation = useV2DeleteDocument();
  
  const saveVisaMutation = useV2SaveVisa();
  const updateVisaMutation = useV2UpdateVisa();
  const deleteVisaMutation = useV2DeleteVisa();
  
  const saveEducationMutation = useV2SaveEducation();
  const updateEducationMutation = useV2UpdateEducation();
  const deleteEducationMutation = useV2DeleteEducation();
  
  const saveLicenseMutation = useV2SaveLicense();
  const updateLicenseMutation = useV2UpdateLicense();
  const deleteLicenseMutation = useV2DeleteLicense();
  
  const saveTrainingMutation = useV2SaveTrainingCourse();
  const updateTrainingMutation = useV2UpdateTrainingCourse();
  const deleteTrainingMutation = useV2DeleteTrainingCourse();
  
  const saveSeaServiceMutation = useV2SaveSeaService();
  const updateSeaServiceMutation = useV2UpdateSeaService();
  const deleteSeaServiceMutation = useV2DeleteSeaService();
  
  const saveAdditionalInfoMutation = useV2SaveAdditionalInfo();
  const updateAdditionalInfoMutation = useV2UpdateAdditionalInfo();
  const deleteAdditionalInfoMutation = useV2DeleteAdditionalInfo();

  const saveScreeningB1Mutation = useV2SaveScreeningB1();
  const saveScreeningB2Mutation = useV2SaveScreeningB2();
  const saveScreeningB3Mutation = useV2SaveScreeningB3();
  const saveScreeningB4Mutation = useV2SaveScreeningB4();
  const saveScreeningB5Mutation = useV2SaveScreeningB5();
  const saveScreeningB6Mutation = useV2SaveScreeningB6();
  const saveScreeningB7Mutation = useV2SaveScreeningB7();
  const saveScreeningB8Mutation = useV2SaveScreeningB8();
  
  const createB2ItemMutation = useV2CreateScreeningB2Item();
  const createB3AuthorityMutation = useV2CreateScreeningB3Authority();
  const createB4CertItemMutation = useV2CreateScreeningB4CertItem();
  const createB5TestItemMutation = useV2CreateScreeningB5TestItem();
  const createB6InterviewItemMutation = useV2CreateScreeningB6InterviewItem();
  const createB7TrainingItemMutation = useV2CreateScreeningB7TrainingItem();
  const createB8ApproverMutation = useV2CreateScreeningB8Approver();

  const createB1CommentMutation = useV2CreateScreeningB1Comment();
  const createB2CommentMutation = useV2CreateScreeningB2Comment();
  const createB3CommentMutation = useV2CreateScreeningB3Comment();
  const createB4CommentMutation = useV2CreateScreeningB4Comment();
  const createB5CommentMutation = useV2CreateScreeningB5Comment();
  const createB6CommentMutation = useV2CreateScreeningB6Comment();
  const createB8CommentMutation = useV2CreateScreeningB8Comment();

  // Part C - Approval mutations
  const saveApprovalMutation = useV2SaveApproval();
  const updateApprovalMutation = useV2UpdateApproval();
  const saveSuitabilityMutation = useV2SaveSuitability();
  const saveDecisionMutation = useV2SaveRecruitmentDecision();
  
  const savingInProgress = savePersonalDetailsMutation.isPending || 
    saveAddressMutation.isPending || saveFamilyInfoMutation.isPending ||
    saveChildrenMutation.isPending || saveNextOfKinMutation.isPending ||
    saveVesselTypesMutation.isPending || saveDocumentMutation.isPending ||
    saveVisaMutation.isPending || saveEducationMutation.isPending ||
    saveLicenseMutation.isPending || saveTrainingMutation.isPending ||
    saveSeaServiceMutation.isPending || saveAdditionalInfoMutation.isPending ||
    saveApprovalMutation.isPending || saveSuitabilityMutation.isPending ||
    saveDecisionMutation.isPending;

  const { data: companyRanks, isLoading: ranksLoading, rankOptions } = useCompanyRanks();
  const { data: externalNationalitiesData } = useExternalNationalities();
  const { data: externalVesselTypesData } = useExternalVesselTypes();
  const { data: externalCountriesData } = useExternalCountries();
  const { data: externalLanguagesData } = useExternalLanguages();
  const { data: externalUsersData, isLoading: isLoadingUsers } = useExternalUsers();

  // Filter users by userType === "Office" and extract displayName for approver/interviewer dropdown
  const approverMasterData = useMemo(() => {
    const users = (externalUsersData as any)?.users || externalUsersData || [];
    if (users.length > 0) {
      const displayNames = users
        .filter((user: any) => user.userType?.toLowerCase() === 'office')
        .map((user: any) => user.displayName || `${user.fullname || user.userName}, ${user.designation || ''}`)
        .filter(Boolean);
      // Deduplicate to prevent React key warnings
      return Array.from(new Set(displayNames)).sort() as string[];
    }
    return [];
  }, [externalUsersData]);

  const NATIONALITIES = useMemo(() => {
    const nationalities = (externalNationalitiesData as any)?.nationalities || externalNationalitiesData || [];
    if (nationalities.length > 0) {
      return nationalities.map((n: any) => n.nationality || n.countryName || n.name).filter(Boolean);
    }
    return [];
  }, [externalNationalitiesData]);

  const vesselTypeMasterData = useMemo(() => {
    const vesselTypes = (externalVesselTypesData as any)?.vesseltypes || (externalVesselTypesData as any)?.vesselTypes || externalVesselTypesData || [];
    if (vesselTypes.length > 0) {
      return vesselTypes.map((vt: any) => vt.vesselType || vt.name).filter(Boolean);
    }
    return [];
  }, [externalVesselTypesData]);

  const countryMasterData: string[] = useMemo(() => {
    const countries = (externalCountriesData as any)?.countries || externalCountriesData || [];
    if (countries.length > 0) {
      return countries.map((c: any) => c.countryName || c.name).filter(Boolean).sort();
    }
    return [];
  }, [externalCountriesData]);

  const languageMasterData = useMemo(() => {
    const languages = (externalLanguagesData as any)?.languages || externalLanguagesData || [];
    if (languages.length > 0) {
      return languages.map((l: any) => l.languageName || l.name).filter(Boolean).sort();
    }
    return [];
  }, [externalLanguagesData]);

  // Fetch Manning Agents from Master 021
  const { data: manningAgentsData } = useQuery<any[]>({
    queryKey: ['/api/masters/021/data'],
  });
  
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

  // Fetch vessels and fleet groups for C2/C3 dropdowns
  const { data: externalVesselsData, isLoading: isLoadingVessels } = useExternalVessels();
  const { data: externalFleetGroupsData, isLoading: isLoadingFleetGroups } = useExternalFleetGroups();

  const isLoadingVesselFleetData = isLoadingVessels || isLoadingFleetGroups;

  const vesselFleetOptions = useMemo(() => {
    const options: Array<{ value: string; label: string; category: 'vessel' | 'fleet' }> = [];
    const addedValues = new Set<string>();

    const addOption = (name: string, category: 'vessel' | 'fleet') => {
      const trimmedName = name?.trim();
      if (trimmedName && trimmedName.length > 0 && !addedValues.has(trimmedName)) {
        addedValues.add(trimmedName);
        options.push({ value: trimmedName, label: trimmedName, category });
      }
    };

    const vessels = (externalVesselsData as any)?.vessels || externalVesselsData || [];
    vessels.forEach((v: any) => {
      const vesselName = v.vessel || v.name;
      if (vesselName) addOption(vesselName, 'vessel');
    });

    const fleetGroups = (externalFleetGroupsData as any)?.fleetGroups || externalFleetGroupsData || [];
    fleetGroups.forEach((f: any) => {
      if (f.name) addOption(f.name, 'fleet');
    });

    return options;
  }, [externalVesselsData, externalFleetGroupsData]);

  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -60% 0px',
      threshold: 0
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.getAttribute('data-section-id') as SectionType;
          if (sectionId && ['A1', 'A2', 'A3', 'A4', 'A5'].includes(sectionId)) {
            setActiveContinuousSection(sectionId);
          }
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    [a1Ref, a2Ref, a3Ref, a4Ref, a5Ref].forEach(ref => {
      if (ref.current) {
        observer.observe(ref.current);
      }
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (candidateData) {
      setFormData(prev => ({
        ...prev,
        firstName: candidateData.firstName || '',
        middleName: candidateData.middleName || '',
        familyName: candidateData.familyName || '',
        gender: candidateData.gender || '',
        dateOfBirth: candidateData.dob || '',
        nationality: candidateData.nationalityUuid || '',
        presentRank: candidateData.presentRank || '',
        rankAppliedFor: candidateData.rankAppliedFor || '',
        fileNo: candidateData.fileNo || '',
        uploadedPhoto: candidateData.uploadedPhoto || '',
        ageInYears: candidateData.dob ? calculateAge(candidateData.dob) : '',
      }));
    }
  }, [candidateData]);

  useEffect(() => {
    if (personalDetails) {
      setFormData(prev => ({
        ...prev,
        placeOfBirthCity: personalDetails.placeOfBirthCity || '',
        placeOfBirthCountry: personalDetails.placeOfBirthCountryUuid || '',
        heightCm: personalDetails.heightCm || '',
        weightKg: personalDetails.weightKg || '',
        nativeLanguage: personalDetails.nativeLanguageUuid || '',
        foreignLanguages: personalDetails.foreignLanguages || '',
        englishProficiency: personalDetails.englishProficiency || '',
        manningAgent: personalDetails.manningAgent || '',
      }));
    }
  }, [personalDetails]);

  useEffect(() => {
    if (addressData) {
      setFormData(prev => ({
        ...prev,
        countryOfResidence: addressData.countryOfResidenceUuid || '',
        nearestAirport: addressData.nearestAirport || '',
        residentialAddressLine1: addressData.addressLine1 || '',
        residentialAddressLine2: addressData.addressLine2 || '',
        contactLandline: addressData.contactLandline || '',
        mobile: addressData.mobile || '',
        email: addressData.email || '',
      }));
    }
  }, [addressData]);

  useEffect(() => {
    if (familyInfo) {
      setFormData(prev => ({
        ...prev,
        maritalStatus: familyInfo.maritalStatus || '',
        numberOfDependentChildren: familyInfo.numDependentChildren || '',
        fatherName: familyInfo.fatherName || '',
        motherName: familyInfo.motherName || '',
        spouseFirstName: familyInfo.spouseFirstName || '',
        spouseMiddleName: familyInfo.spouseMiddleName || '',
        spouseFamilyName: familyInfo.spouseFamilyName || '',
        spouseDateOfBirth: familyInfo.spouseDob || '',
      }));
    }
  }, [familyInfo]);

  useEffect(() => {
    if (nextOfKinData) {
      setFormData(prev => ({
        ...prev,
        nokFirstName: nextOfKinData.firstName || '',
        nokMiddleName: nextOfKinData.middleName || '',
        nokFamilyName: nextOfKinData.familyName || '',
        nokTelephone: nextOfKinData.telephone || '',
        nokEmail: nextOfKinData.email || '',
        nokAddress: nextOfKinData.address || '',
        nokRelationship: nextOfKinData.relationship || '',
      }));
    }
  }, [nextOfKinData]);

  useEffect(() => {
    if (childrenData && childrenData.length > 0) {
      setFormData(prev => ({
        ...prev,
        children: childrenData.map(child => ({
          id: child.childUuid,
          firstName: child.firstName || '',
          middleName: child.middleName || '',
          familyName: child.familyName || '',
          dateOfBirth: child.dob || '',
          gender: child.gender || '',
        })),
      }));
    }
  }, [childrenData]);

  useEffect(() => {
    if (vesselTypesData && vesselTypesData.length > 0) {
      setFormData(prev => ({
        ...prev,
        vesselType: vesselTypesData.map(vt => vt.vesselTypeUuid),
      }));
    }
  }, [vesselTypesData]);

  useEffect(() => {
    if (documentsData && documentsData.length > 0) {
      setFormData(prev => ({
        ...prev,
        documents: documentsData.map(doc => ({
          id: doc.docUuid,
          serverId: doc.id,
          documentId: doc.documentId || '',
          document: doc.documentName || '',
          number: doc.number || '',
          issued: doc.issued || '',
          expiry: doc.expiry || '',
          issuingAuthority: doc.issuingAuthority || '',
          attachments: (doc.attachments || []) as any,
        })),
      }));
    }
  }, [documentsData]);

  useEffect(() => {
    if (visasData && visasData.length > 0) {
      setFormData(prev => ({
        ...prev,
        visas: visasData.map(visa => ({
          id: visa.visaUuid,
          serverId: visa.id,
          countryId: visa.countryUuid || '',
          issuingCountry: visa.countryUuid || '',
          serialNo: visa.serialNo || '',
          issued: visa.issued || '',
          expiry: visa.expiry || '',
          visaType: visa.visaType || '',
          attachments: (visa.attachments || []) as any,
        })),
      }));
    }
  }, [visasData]);

  useEffect(() => {
    if (educationData && educationData.length > 0) {
      setFormData(prev => ({
        ...prev,
        education: educationData.map(edu => ({
          id: edu.eduUuid,
          serverId: edu.id,
          dateOfCompletion: edu.dateOfCompletion || '',
          schoolCollegeUniversity: edu.institution || '',
          subjectsField: edu.subjectsField || '',
          qualifications: edu.qualifications || '',
          attachments: (edu.attachments || []) as any,
        })),
      }));
    }
  }, [educationData]);

  useEffect(() => {
    if (licensesData && licensesData.length > 0) {
      setFormData(prev => ({
        ...prev,
        licenses: licensesData.map(lic => ({
          id: lic.licUuid,
          serverId: lic.id,
          licenseId: lic.licenseId || '',
          certificateDocument: lic.certificateDocument || '',
          abbr: lic.abbr || '',
          requirement: lic.requirement || '',
          certificateNo: lic.certificateNo || '',
          issuingAuthority: lic.issuingAuthority || '',
          issued: lic.issued || '',
          expiry: lic.expiry || '',
          attachments: (lic.attachments || []) as any,
        })),
      }));
    }
  }, [licensesData]);

  useEffect(() => {
    if (trainingData && trainingData.length > 0) {
      setFormData(prev => ({
        ...prev,
        trainingCourses: trainingData.map(course => ({
          id: course.trainUuid,
          serverId: course.id,
          courseId: course.courseId || '',
          trainingCourse: course.trainingCourse || '',
          abbr: course.abbr || '',
          requirement: course.requirement || '',
          certificateNo: course.certificateNo || '',
          issuingAuthority: course.issuingAuthority || '',
          issued: course.issued || '',
          expiry: course.expiry || '',
          attachments: (course.attachments || []) as any,
        })),
      }));
    }
  }, [trainingData]);

  useEffect(() => {
    if (seaServiceData && seaServiceData.length > 0) {
      setFormData(prev => ({
        ...prev,
        seaService: seaServiceData.map(service => ({
          id: service.seaUuid,
          serverId: service.id,
          vesselName: service.vesselName || '',
          vesselType: service.vesselTypeUuid || '',
          deadweight: service.deadweight || '',
          engineTypePower: service.engineTypePower || '',
          ownerOperator: service.ownerOperator || '',
          rank: service.rank || '',
          from: service.fromDate || '',
          to: service.toDate || '',
          periodMonths: service.periodMonths || '',
          attachments: (service.attachments || []) as any,
        })),
      }));
    }
  }, [seaServiceData]);

  useEffect(() => {
    if (additionalInfoData && additionalInfoData.length > 0) {
      setFormData(prev => ({
        ...prev,
        additionalInfo: additionalInfoData.map(ai => ({
          id: ai.infoUuid,
          serverId: ai.id,
          information: ai.information || '',
          response: ai.response || '',
          attachments: (ai.attachments || []) as any,
        })),
      }));
    }
  }, [additionalInfoData]);

  useEffect(() => {
    if (screeningB1Data) {
      setFormData(prev => ({
        ...prev,
        b1AgeMeetsCriteria: screeningB1Data.ageMeetsCriteria || '',
        b1RankMeetsCriteria: screeningB1Data.rankMeetsCriteria || '',
        b1CertificatesValid: screeningB1Data.certificatesValid || '',
        b1Shortlisted: screeningB1Data.shortlisted || '',
      }));
    }
  }, [screeningB1Data]);

  useEffect(() => {
    if (screeningB1Comments && screeningB1Comments.length > 0) {
      const commentsMap: {[key: string]: Array<{user: string; text: string; id: string}>} = {};
      screeningB1Comments.forEach((comment: any) => {
        const key = comment.fieldKey || 'general';
        if (!commentsMap[key]) {
          commentsMap[key] = [];
        }
        commentsMap[key].push({
          user: comment.userUuid || 'Unknown',
          text: comment.commentText || '',
          id: comment.commentUuid || comment.id?.toString() || '',
        });
      });
      setFormData(prev => ({
        ...prev,
        b1Comments: commentsMap,
      }));
    }
  }, [screeningB1Comments]);

  useEffect(() => {
    if (screeningB2Data) {
      setFormData(prev => ({
        ...prev,
        b2ReferencesCompleted: screeningB2Data.referencesCompleted || '',
        b2EmployerFeedback: screeningB2Data.employerFeedback || '',
      }));
    }
  }, [screeningB2Data]);

  useEffect(() => {
    if (screeningB3Data) {
      setFormData(prev => ({
        ...prev,
        b3ChecksCompleted: screeningB3Data.checksCompleted || '',
        b3Results: screeningB3Data.results || '',
      }));
    }
  }, [screeningB3Data]);

  useEffect(() => {
    if (screeningB4Data) {
      setFormData(prev => ({
        ...prev,
        b4CertificatesAuthenticated: screeningB4Data.certificatesAuthenticated || '',
        b4Results: screeningB4Data.results || '',
      }));
    }
  }, [screeningB4Data]);

  useEffect(() => {
    if (screeningB5Data) {
      setFormData(prev => ({
        ...prev,
        b5TestsCompleted: screeningB5Data.testsCompleted || '',
      }));
    }
  }, [screeningB5Data]);

  useEffect(() => {
    if (screeningB6Data) {
      setFormData(prev => ({
        ...prev,
        b6InterviewCompleted: screeningB6Data.interviewCompleted || '',
      }));
    }
  }, [screeningB6Data]);

  useEffect(() => {
    if (screeningB8Data) {
      setFormData(prev => ({
        ...prev,
        b8Shortlisted: screeningB8Data.shortlisted || '',
      }));
    }
  }, [screeningB8Data]);

  useEffect(() => {
    if (screeningB2Comments && screeningB2Comments.length > 0) {
      const commentsMap: {[key: string]: Array<{user: string; text: string; id: string}>} = {};
      screeningB2Comments.forEach((comment: any) => {
        const key = comment.fieldKey || 'general';
        if (!commentsMap[key]) {
          commentsMap[key] = [];
        }
        commentsMap[key].push({
          user: comment.userUuid || 'Unknown',
          text: comment.commentText || '',
          id: comment.commentUuid || comment.id?.toString() || '',
        });
      });
      setFormData(prev => ({
        ...prev,
        b2Comments: commentsMap,
      }));
    }
  }, [screeningB2Comments]);

  useEffect(() => {
    if (screeningB3Comments && screeningB3Comments.length > 0) {
      const commentsMap: {[key: string]: Array<{user: string; text: string; id: string}>} = {};
      screeningB3Comments.forEach((comment: any) => {
        const key = comment.fieldKey || 'general';
        if (!commentsMap[key]) {
          commentsMap[key] = [];
        }
        commentsMap[key].push({
          user: comment.userUuid || 'Unknown',
          text: comment.commentText || '',
          id: comment.commentUuid || comment.id?.toString() || '',
        });
      });
      setFormData(prev => ({
        ...prev,
        b3Comments: commentsMap,
      }));
    }
  }, [screeningB3Comments]);

  useEffect(() => {
    if (screeningB4Comments && screeningB4Comments.length > 0) {
      const commentsMap: {[key: string]: Array<{user: string; text: string; id: string}>} = {};
      screeningB4Comments.forEach((comment: any) => {
        const key = comment.fieldKey || 'general';
        if (!commentsMap[key]) {
          commentsMap[key] = [];
        }
        commentsMap[key].push({
          user: comment.userUuid || 'Unknown',
          text: comment.commentText || '',
          id: comment.commentUuid || comment.id?.toString() || '',
        });
      });
      setFormData(prev => ({
        ...prev,
        b4Comments: commentsMap,
      }));
    }
  }, [screeningB4Comments]);

  useEffect(() => {
    if (screeningB5Comments && screeningB5Comments.length > 0) {
      const commentsMap: {[key: string]: Array<{user: string; text: string; id: string}>} = {};
      screeningB5Comments.forEach((comment: any) => {
        const key = comment.fieldKey || 'general';
        if (!commentsMap[key]) {
          commentsMap[key] = [];
        }
        commentsMap[key].push({
          user: comment.userUuid || 'Unknown',
          text: comment.commentText || '',
          id: comment.commentUuid || comment.id?.toString() || '',
        });
      });
      setFormData(prev => ({
        ...prev,
        b5Comments: commentsMap,
      }));
    }
  }, [screeningB5Comments]);

  useEffect(() => {
    if (screeningB6Comments && screeningB6Comments.length > 0) {
      const commentsMap: {[key: string]: Array<{user: string; text: string; id: string}>} = {};
      screeningB6Comments.forEach((comment: any) => {
        const key = comment.fieldKey || 'general';
        if (!commentsMap[key]) {
          commentsMap[key] = [];
        }
        commentsMap[key].push({
          user: comment.userUuid || 'Unknown',
          text: comment.commentText || '',
          id: comment.commentUuid || comment.id?.toString() || '',
        });
      });
      setFormData(prev => ({
        ...prev,
        b6Comments: commentsMap,
      }));
    }
  }, [screeningB6Comments]);

  useEffect(() => {
    if (screeningB8Comments && screeningB8Comments.length > 0) {
      const commentsMap: {[key: string]: Array<{user: string; text: string; id: string}>} = {};
      screeningB8Comments.forEach((comment: any) => {
        const key = comment.fieldKey || 'general';
        if (!commentsMap[key]) {
          commentsMap[key] = [];
        }
        commentsMap[key].push({
          user: comment.userUuid || 'Unknown',
          text: comment.commentText || '',
          id: comment.commentUuid || comment.id?.toString() || '',
        });
      });
      setFormData(prev => ({
        ...prev,
        b8Comments: commentsMap,
      }));
    }
  }, [screeningB8Comments]);

  useEffect(() => {
    if (screeningB2Items && screeningB2Items.length > 0) {
      setFormData(prev => ({
        ...prev,
        b2References: screeningB2Items.map((item: any) => ({
          id: item.refUuid || item.id?.toString(),
          date: item.refDate || '',
          nameDesignation: item.nameDesignation || '',
          contactInfo: item.contactInfo || '',
        })),
      }));
    }
  }, [screeningB2Items]);

  useEffect(() => {
    if (screeningB3Authorities && screeningB3Authorities.length > 0) {
      setFormData(prev => ({
        ...prev,
        b3Authorities: screeningB3Authorities.map((auth: any) => ({
          id: auth.authUuid,
          serverId: auth.id,
          date: auth.checkDate || '',
          authority: auth.authority || '',
        })),
      }));
    }
  }, [screeningB3Authorities]);

  useEffect(() => {
    if (screeningB4CertItems && screeningB4CertItems.length > 0) {
      setFormData(prev => ({
        ...prev,
        b4Certs: screeningB4CertItems.map((cert: any) => ({
          id: cert.certUuid,
          serverId: cert.id,
          date: cert.authDate || '',
          certificate: cert.certificate || '',
          authority: cert.authority || '',
        })),
      }));
    }
  }, [screeningB4CertItems]);

  useEffect(() => {
    if (screeningB5TestItems && screeningB5TestItems.length > 0) {
      setFormData(prev => ({
        ...prev,
        b5Tests: screeningB5TestItems.map((test: any) => ({
          id: test.testUuid,
          serverId: test.id,
          date: test.testDate || '',
          subject: test.subject || '',
          score: test.score || '',
          result: test.result || '',
        })),
      }));
    }
  }, [screeningB5TestItems]);

  useEffect(() => {
    if (screeningB6InterviewItems && screeningB6InterviewItems.length > 0) {
      setFormData(prev => ({
        ...prev,
        b6Interviews: screeningB6InterviewItems.map((interview: any) => ({
          id: interview.intUuid,
          serverId: interview.id,
          date: interview.interviewDate || '',
          interviewer: interview.interviewerUuid || '',
          status: interview.status || '',
          result: interview.result || '',
          comments: interview.comments || '',
        })),
      }));
    }
  }, [screeningB6InterviewItems]);

  useEffect(() => {
    if (screeningB7TrainingItems && screeningB7TrainingItems.length > 0) {
      // Map API fields (DB column names) to UI form fields  
      setFormData(prev => ({
        ...prev,
        b7TrainingNeeds: screeningB7TrainingItems.map(training => ({
          id: training.trainItemUuid,
          serverId: training.id,
          training: training.training || '',
          identifiedBy: training.identifiedByUuid || '',
          category: training.category || '',
          dueDate: training.dueDate || '',
          comments: training.comments || '',
        })),
      }));
    }
  }, [screeningB7TrainingItems]);

  useEffect(() => {
    if (screeningB8Approvers && screeningB8Approvers.length > 0) {
      setFormData(prev => ({
        ...prev,
        b8SelectedApprovers: screeningB8Approvers.map(approver => ({
          id: approver.approverUuid,
          serverId: approver.id,
          approverName: approver.approverName || '',
          approverRole: approver.approverRole || '',
          approvalDate: approver.approvalDate || '',
          decision: approver.decision || '',
          remarks: approver.remarks || '',
        })),
      }));
    }
  }, [screeningB8Approvers]);

  // Part C - Load approvals data
  useEffect(() => {
    if (approvalsData && approvalsData.length > 0) {
      setFormData(prev => ({
        ...prev,
        c1Approvers: approvalsData.map(approval => ({
          id: approval.appUuid,
          serverId: approval.id,
          appUuid: approval.appUuid,
          date: approval.approvalDate || '',
          approver: approval.approverUuid || '',
          status: approval.status || '',
          approval: approval.approval || '',
          comments: approval.comments || '',
        })),
      }));
    }
  }, [approvalsData]);

  // Part C - Load suitability data
  useEffect(() => {
    if (suitabilityData) {
      setFormData(prev => ({
        ...prev,
        c2VesselTypes: suitabilityData.vesselTypes?.map(vt => vt.vesselTypeUuid) || [],
        c2FleetGroups: suitabilityData.fleetGroups?.map(fg => fg.fleetGroupUuid) || [],
      }));
    }
  }, [suitabilityData]);

  // Part C - Load decision data
  useEffect(() => {
    if (decisionData) {
      setFormData(prev => ({
        ...prev,
        c3RecruitmentStatus: decisionData.recruitmentStatus || '',
        c3AssignedGroups: decisionData.assignedGroups?.map(ag => ag.groupUuid) || [],
        c3SubmittedBy: decisionData.submittedByUuid || '',
        c3SubmittedDate: decisionData.submittedDate || '',
      }));
    }
  }, [decisionData]);

  const calculateAge = (dob: string): string => {
    if (!dob) return '';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age > 0 ? age.toString() : '';
  };

  const calculatePeriod = (fromDate: string, toDate: string): string => {
    if (!fromDate || !toDate) return '';
    try {
      const from = new Date(fromDate);
      const to = new Date(toDate);
      if (isNaN(from.getTime()) || isNaN(to.getTime())) return '';
      const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
      const days = to.getDate() - from.getDate();
      const totalMonths = months + (days / 30);
      return totalMonths > 0 ? `${totalMonths.toFixed(1)}M` : '';
    } catch {
      return '';
    }
  };

  const updateFormData = <K extends keyof LocalFormData>(field: K, value: LocalFormData[K]) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'dateOfBirth') {
        updated.ageInYears = calculateAge(value as string);
      }
      return updated;
    });
  };

  const toggleEditSection = (section: string) => {
    setEditingSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getNextId = (items: Array<{id: string}>, prefix: string): string => {
    const existingNums = items
      .map(item => {
        const match = item.id.match(new RegExp(`^${prefix}-(\\d+)$`));
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => n > 0);
    const maxNum = existingNums.length > 0 ? Math.max(...existingNums) : 0;
    return `${prefix}-${maxNum + 1}`;
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        updateFormData('uploadedPhoto', base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const addDocument = () => {
    const newDoc = {
      id: getNextId(formData.documents, 'DOC'),
      document: '',
      number: '',
      issued: '',
      expiry: '',
      issuingAuthority: '',
      attachments: []
    };
    setFormData(prev => ({ ...prev, documents: [...prev.documents, newDoc] }));
  };

  const removeDocument = (id: string) => {
    setFormData(prev => ({ ...prev, documents: prev.documents.filter(d => d.id !== id) }));
  };

  const updateDocument = (id: string, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      documents: prev.documents.map(d => d.id === id ? { ...d, [field]: value } : d)
    }));
  };

  const addVisa = () => {
    const newVisa = {
      id: getNextId(formData.visas, 'VIS'),
      issuingCountry: '',
      serialNo: '',
      issued: '',
      expiry: '',
      visaType: '',
      attachments: []
    };
    setFormData(prev => ({ ...prev, visas: [...prev.visas, newVisa] }));
  };

  const removeVisa = (id: string) => {
    setFormData(prev => ({ ...prev, visas: prev.visas.filter(v => v.id !== id) }));
  };

  const updateVisa = (id: string, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      visas: prev.visas.map(v => v.id === id ? { ...v, [field]: value } : v)
    }));
  };

  const addEducation = () => {
    const newEdu = {
      id: getNextId(formData.education, 'EDU'),
      dateOfCompletion: '',
      schoolCollegeUniversity: '',
      subjectsField: '',
      qualifications: '',
      attachments: []
    };
    setFormData(prev => ({ ...prev, education: [...prev.education, newEdu] }));
  };

  const removeEducation = (id: string) => {
    setFormData(prev => ({ ...prev, education: prev.education.filter(e => e.id !== id) }));
  };

  const updateEducation = (id: string, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      education: prev.education.map(e => e.id === id ? { ...e, [field]: value } : e)
    }));
  };

  const addLicense = () => {
    const newLic = {
      id: getNextId(formData.licenses, 'LIC'),
      certificateDocument: '',
      abbr: '',
      requirement: '',
      certificateNo: '',
      issuingAuthority: '',
      issued: '',
      expiry: '',
      attachments: []
    };
    setFormData(prev => ({ ...prev, licenses: [...prev.licenses, newLic] }));
  };

  const removeLicense = (id: string) => {
    setFormData(prev => ({ ...prev, licenses: prev.licenses.filter(l => l.id !== id) }));
  };

  const updateLicense = (id: string, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      licenses: prev.licenses.map(l => l.id === id ? { ...l, [field]: value } : l)
    }));
  };

  const addTrainingCourse = () => {
    const newCourse = {
      id: getNextId(formData.trainingCourses, 'TRN'),
      trainingCourse: '',
      abbr: '',
      requirement: '',
      certificateNo: '',
      issuingAuthority: '',
      issued: '',
      expiry: '',
      attachments: []
    };
    setFormData(prev => ({ ...prev, trainingCourses: [...prev.trainingCourses, newCourse] }));
  };

  const removeTrainingCourse = (id: string) => {
    setFormData(prev => ({ ...prev, trainingCourses: prev.trainingCourses.filter(t => t.id !== id) }));
  };

  const updateTrainingCourse = (id: string, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      trainingCourses: prev.trainingCourses.map(t => t.id === id ? { ...t, [field]: value } : t)
    }));
  };

  const addSeaService = () => {
    const newService = {
      id: getNextId(formData.seaService, 'SEA'),
      vesselName: '',
      vesselType: '',
      deadweight: '',
      engineTypePower: '',
      ownerOperator: '',
      rank: '',
      from: '',
      to: '',
      periodMonths: '',
      attachments: []
    };
    setFormData(prev => ({ ...prev, seaService: [...prev.seaService, newService] }));
  };

  const removeSeaService = (id: string) => {
    setFormData(prev => ({ ...prev, seaService: prev.seaService.filter(s => s.id !== id) }));
  };

  const updateSeaService = (id: string, field: string, value: string) => {
    setFormData(prev => {
      const updatedServices = prev.seaService.map(s => {
        if (s.id === id) {
          const updated = { ...s, [field]: value };
          if (field === 'from' || field === 'to') {
            updated.periodMonths = calculatePeriod(updated.from, updated.to);
          }
          return updated;
        }
        return s;
      });
      return { ...prev, seaService: updatedServices };
    });
  };

  const addAdditionalInfo = () => {
    const newInfo = {
      id: getNextId(formData.additionalInfo, 'A5'),
      information: '',
      response: '',
      attachments: []
    };
    setFormData(prev => ({ ...prev, additionalInfo: [...prev.additionalInfo, newInfo] }));
  };

  const removeAdditionalInfo = (id: string) => {
    setFormData(prev => ({ ...prev, additionalInfo: prev.additionalInfo.filter(a => a.id !== id) }));
  };

  const updateAdditionalInfo = (id: string, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      additionalInfo: prev.additionalInfo.map(a => a.id === id ? { ...a, [field]: value } : a)
    }));
  };

  const addChild = () => {
    const newChild = {
      id: `CHILD-${Date.now()}`,
      firstName: '',
      middleName: '',
      familyName: '',
      dateOfBirth: '',
      gender: ''
    };
    setFormData(prev => ({ ...prev, children: [...prev.children, newChild] }));
  };

  const removeChild = (id: string) => {
    setFormData(prev => ({ ...prev, children: prev.children.filter(c => c.id !== id) }));
  };

  const updateChild = (id: string, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      children: prev.children.map(c => c.id === id ? { ...c, [field]: value } : c)
    }));
  };

  // Part C - Approval management functions
  const addC1Approver = () => {
    const newApprover = {
      id: `APP-${Date.now()}`,
      date: '',
      approver: '',
      status: '',
      approval: '',
      comments: ''
    };
    setFormData(prev => ({ ...prev, c1Approvers: [...prev.c1Approvers, newApprover] }));
  };

  const removeC1Approver = (id: string) => {
    setFormData(prev => ({ ...prev, c1Approvers: prev.c1Approvers.filter(a => a.id !== id) }));
  };

  const updateC1Approver = (id: string, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      c1Approvers: prev.c1Approvers.map(a => a.id === id ? { ...a, [field]: value } : a)
    }));
  };

  const addC2VesselType = (vesselType: string) => {
    if (!formData.c2VesselTypes.includes(vesselType)) {
      setFormData(prev => ({ ...prev, c2VesselTypes: [...prev.c2VesselTypes, vesselType] }));
    }
  };

  const removeC2VesselType = (vesselType: string) => {
    setFormData(prev => ({ ...prev, c2VesselTypes: prev.c2VesselTypes.filter(v => v !== vesselType) }));
  };

  const addC2FleetGroup = (fleetGroup: string) => {
    if (!formData.c2FleetGroups.includes(fleetGroup)) {
      setFormData(prev => ({ ...prev, c2FleetGroups: [...prev.c2FleetGroups, fleetGroup] }));
    }
  };

  const removeC2FleetGroup = (fleetGroup: string) => {
    setFormData(prev => ({ ...prev, c2FleetGroups: prev.c2FleetGroups.filter(f => f !== fleetGroup) }));
  };

  const addC3AssignedGroup = (group: string) => {
    if (!formData.c3AssignedGroups.includes(group)) {
      setFormData(prev => ({ ...prev, c3AssignedGroups: [...prev.c3AssignedGroups, group] }));
    }
  };

  const removeC3AssignedGroup = (group: string) => {
    setFormData(prev => ({ ...prev, c3AssignedGroups: prev.c3AssignedGroups.filter(g => g !== group) }));
  };

  const addVesselType = (type: string) => {
    if (!formData.vesselType.includes(type)) {
      setFormData(prev => ({ ...prev, vesselType: [...prev.vesselType, type] }));
    }
  };

  const removeVesselType = (type: string) => {
    setFormData(prev => ({ ...prev, vesselType: prev.vesselType.filter(t => t !== type) }));
  };

  const isVesselTypeSelected = (type: string): boolean => {
    return formData.vesselType.includes(type);
  };

  const handleVesselTypeSelection = (selectedVesselType: string) => {
    const currentVesselTypes = formData.vesselType;
    const isAlreadySelected = currentVesselTypes.includes(selectedVesselType);
    
    let updatedVesselTypes;
    if (isAlreadySelected) {
      updatedVesselTypes = currentVesselTypes.filter(type => type !== selectedVesselType);
    } else {
      updatedVesselTypes = [...currentVesselTypes, selectedVesselType];
    }
    
    setFormData(prev => ({ ...prev, vesselType: updatedVesselTypes }));
  };

  const handleLanguageSelection = (field: 'nativeLanguage' | 'foreignLanguages', selectedLanguage: string) => {
    if (field === 'nativeLanguage') {
      updateFormData('nativeLanguage', selectedLanguage);
    } else {
      const currentLanguages = formData.foreignLanguages ? formData.foreignLanguages.split(', ') : [];
      const isAlreadySelected = currentLanguages.includes(selectedLanguage);
      
      let updatedLanguages;
      if (isAlreadySelected) {
        updatedLanguages = currentLanguages.filter(lang => lang !== selectedLanguage);
      } else {
        updatedLanguages = [...currentLanguages, selectedLanguage];
      }
      
      updateFormData('foreignLanguages', updatedLanguages.join(', '));
    }
  };

  const isLanguageSelected = (field: 'nativeLanguage' | 'foreignLanguages', language: string): boolean => {
    if (field === 'nativeLanguage') {
      return formData.nativeLanguage === language;
    } else {
      const currentLanguages = formData.foreignLanguages ? formData.foreignLanguages.split(', ') : [];
      return currentLanguages.includes(language);
    }
  };

  const addLicensesFromDatabase = (selectedLicenses: LicenseTemplate[]) => {
    const existingLicenses = formData.licenses.filter(l => l.certificateDocument.trim() !== '');
    const maxNum = Math.max(0, ...formData.licenses.map(l => {
      const match = l.id.match(/^LIC-(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    }));
    const newLicenses = selectedLicenses.map((license, index) => ({
      id: `LIC-${maxNum + index + 1}`,
      licenseId: license.id,
      certificateDocument: license.name,
      abbr: license.abbr || '',
      requirement: license.requirement || '',
      certificateNo: '',
      issuingAuthority: '',
      issued: '',
      expiry: '',
      attachments: []
    }));
    setFormData(prev => ({ ...prev, licenses: [...existingLicenses, ...newLicenses] }));
    setIsLicenseDialogOpen(false);
  };

  const addTrainingCoursesFromDatabase = (selectedCourses: TrainingCourseTemplate[]) => {
    const existingCourses = formData.trainingCourses.filter(c => c.trainingCourse.trim() !== '');
    const maxNum = Math.max(0, ...formData.trainingCourses.map(c => {
      const match = c.id.match(/^TRN-(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    }));
    const newCourses = selectedCourses.map((course, index) => ({
      id: `TRN-${maxNum + index + 1}`,
      courseId: course.id,
      trainingCourse: course.name,
      abbr: course.abbr || '',
      requirement: course.requirement || '',
      certificateNo: '',
      issuingAuthority: '',
      issued: '',
      expiry: '',
      attachments: []
    }));
    setFormData(prev => ({ ...prev, trainingCourses: [...existingCourses, ...newCourses] }));
    setIsTrainingDialogOpen(false);
  };

  const addTravelDocsFromDatabase = (selectedDocs: TravelDocumentTemplate[]) => {
    const existingDocs = formData.documents.filter(d => d.document.trim() !== '');
    const maxNum = Math.max(0, ...formData.documents.map(d => {
      const match = d.id.match(/^DOC-(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    }));
    const newDocs = selectedDocs.map((doc, index) => ({
      id: `DOC-${maxNum + index + 1}`,
      documentId: doc.id,
      document: doc.name,
      number: '',
      issued: '',
      expiry: '',
      issuingAuthority: '',
      attachments: []
    }));
    setFormData(prev => ({ ...prev, documents: [...existingDocs, ...newDocs] }));
    setIsTravelDocDialogOpen(false);
  };

  const addVisasFromDatabase = (selectedCountries: VisaCountryTemplate[]) => {
    const existingVisas = formData.visas.filter(v => v.issuingCountry.trim() !== '');
    const maxNum = Math.max(0, ...formData.visas.map(v => {
      const match = v.id.match(/^VIS-(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    }));
    const newVisas = selectedCountries.map((country, index) => ({
      id: `VIS-${maxNum + index + 1}`,
      countryId: country.id,
      issuingCountry: country.name,
      serialNo: '',
      issued: '',
      expiry: '',
      visaType: '',
      attachments: []
    }));
    setFormData(prev => ({ ...prev, visas: [...existingVisas, ...newVisas] }));
    setIsVisaDialogOpen(false);
  };

  const openAttachmentDialog = (
    type: 'document' | 'visa' | 'education' | 'license' | 'training' | 'seaService' | 'additionalInfo' | 'b1' | 'b2' | 'b3' | 'b4' | 'b5' | 'b6' | 'b7' | 'b8',
    itemId: string,
    itemName: string
  ) => {
    setAttachmentDialog({ open: true, type, itemId, itemName });
  };

  const getAttachmentsForItem = (): FileAttachment[] => {
    if (!attachmentDialog.type) return [];
    switch (attachmentDialog.type) {
      case 'document': return formData.documents.find(d => d.id === attachmentDialog.itemId)?.attachments || [];
      case 'visa': return formData.visas.find(v => v.id === attachmentDialog.itemId)?.attachments || [];
      case 'education': return formData.education.find(e => e.id === attachmentDialog.itemId)?.attachments || [];
      case 'license': return formData.licenses.find(l => l.id === attachmentDialog.itemId)?.attachments || [];
      case 'training': return formData.trainingCourses.find(t => t.id === attachmentDialog.itemId)?.attachments || [];
      case 'seaService': return formData.seaService.find(s => s.id === attachmentDialog.itemId)?.attachments || [];
      case 'additionalInfo': return formData.additionalInfo.find(a => a.id === attachmentDialog.itemId)?.attachments || [];
      case 'b1': return formData.b1Attachments || [];
      case 'b2': return formData.b2Attachments || [];
      case 'b3': return formData.b3Attachments || [];
      case 'b4': return formData.b4Attachments || [];
      case 'b5': return formData.b5Attachments || [];
      case 'b6': return formData.b6Attachments || [];
      case 'b7': return formData.b7Attachments || [];
      case 'b8': return formData.b8Attachments || [];
      default: return [];
    }
  };

  const updateAttachments = (attachments: FileAttachment[]) => {
    if (!attachmentDialog.type) return;
    setFormData(prev => {
      switch (attachmentDialog.type) {
        case 'document': return { ...prev, documents: prev.documents.map(d => d.id === attachmentDialog.itemId ? { ...d, attachments } : d) };
        case 'visa': return { ...prev, visas: prev.visas.map(v => v.id === attachmentDialog.itemId ? { ...v, attachments } : v) };
        case 'education': return { ...prev, education: prev.education.map(e => e.id === attachmentDialog.itemId ? { ...e, attachments } : e) };
        case 'license': return { ...prev, licenses: prev.licenses.map(l => l.id === attachmentDialog.itemId ? { ...l, attachments } : l) };
        case 'training': return { ...prev, trainingCourses: prev.trainingCourses.map(t => t.id === attachmentDialog.itemId ? { ...t, attachments } : t) };
        case 'seaService': return { ...prev, seaService: prev.seaService.map(s => s.id === attachmentDialog.itemId ? { ...s, attachments } : s) };
        case 'additionalInfo': return { ...prev, additionalInfo: prev.additionalInfo.map(a => a.id === attachmentDialog.itemId ? { ...a, attachments } : a) };
        case 'b1': return { ...prev, b1Attachments: attachments };
        case 'b2': return { ...prev, b2Attachments: attachments };
        case 'b3': return { ...prev, b3Attachments: attachments };
        case 'b4': return { ...prev, b4Attachments: attachments };
        case 'b5': return { ...prev, b5Attachments: attachments };
        case 'b6': return { ...prev, b6Attachments: attachments };
        case 'b7': return { ...prev, b7Attachments: attachments };
        case 'b8': return { ...prev, b8Attachments: attachments };
        default: return prev;
      }
    });
  };

  const handleSectionNavigation = (sectionId: SectionType) => {
    if (['A1', 'A2', 'A3', 'A4', 'A5'].includes(sectionId)) {
      setActiveSection('A1');
      setActiveContinuousSection(sectionId);
      const refMap: Record<string, React.RefObject<HTMLDivElement>> = {
        'A1': a1Ref, 'A2': a2Ref, 'A3': a3Ref, 'A4': a4Ref, 'A5': a5Ref
      };
      refMap[sectionId]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      setActiveSection(sectionId);
    }
  };

  const handleSaveAndContinue = async () => {
    try {
      toast({
        title: "Saving...",
        description: "Saving form data to database",
      });
      
      let currentUuid = recCanUuid;
      
      if (!currentUuid) {
        const newCandidate = await createCandidateMutation.mutateAsync({
          firstName: formData.firstName,
          middleName: formData.middleName || '',
          familyName: formData.familyName,
          gender: formData.gender || '',
          dob: formData.dateOfBirth || '',
          nationalityUuid: formData.nationality || '',
          presentRank: formData.presentRank || '',
          rankAppliedFor: formData.rankAppliedFor || '',
          status: 'draft',
          uploadedPhoto: formData.uploadedPhoto || '',
        });
        currentUuid = newCandidate.recCanUuid;
        setRecCanUuid(currentUuid);
      } else {
        await updateCandidateMutation.mutateAsync({
          recCanUuid: currentUuid,
          data: {
            firstName: formData.firstName,
            middleName: formData.middleName || '',
            familyName: formData.familyName,
            gender: formData.gender || '',
            dob: formData.dateOfBirth || '',
            nationalityUuid: formData.nationality || '',
            presentRank: formData.presentRank || '',
            rankAppliedFor: formData.rankAppliedFor || '',
            uploadedPhoto: formData.uploadedPhoto || '',
          },
        });
      }
      
      if (!currentUuid) {
        throw new Error('Failed to create candidate');
      }
      
      await Promise.all([
        savePersonalDetailsMutation.mutateAsync({
          recCanUuid: currentUuid,
          data: {
            placeOfBirthCity: formData.placeOfBirthCity || undefined,
            placeOfBirthCountryUuid: formData.placeOfBirthCountry || undefined,
            heightCm: formData.heightCm || undefined,
            weightKg: formData.weightKg || undefined,
            nativeLanguageUuid: formData.nativeLanguage || undefined,
            foreignLanguages: formData.foreignLanguages || undefined,
            englishProficiency: formData.englishProficiency || undefined,
            manningAgent: formData.manningAgent || undefined,
          },
        }),
        saveAddressMutation.mutateAsync({
          recCanUuid: currentUuid,
          data: {
            countryOfResidenceUuid: formData.countryOfResidence || undefined,
            nearestAirport: formData.nearestAirport || undefined,
            addressLine1: formData.residentialAddressLine1 || undefined,
            addressLine2: formData.residentialAddressLine2 || undefined,
            contactLandline: formData.contactLandline || undefined,
            mobile: formData.mobile || undefined,
            email: formData.email || undefined,
          },
        }),
        saveFamilyInfoMutation.mutateAsync({
          recCanUuid: currentUuid,
          data: {
            maritalStatus: formData.maritalStatus || undefined,
            numDependentChildren: formData.numberOfDependentChildren || undefined,
            fatherName: formData.fatherName || undefined,
            motherName: formData.motherName || undefined,
            spouseFirstName: formData.spouseFirstName || undefined,
            spouseMiddleName: formData.spouseMiddleName || undefined,
            spouseFamilyName: formData.spouseFamilyName || undefined,
            spouseDob: formData.spouseDateOfBirth || undefined,
          },
        }),
        saveNextOfKinMutation.mutateAsync({
          recCanUuid: currentUuid,
          data: {
            firstName: formData.nokFirstName || undefined,
            middleName: formData.nokMiddleName || undefined,
            familyName: formData.nokFamilyName || undefined,
            telephone: formData.nokTelephone || undefined,
            email: formData.nokEmail || undefined,
            address: formData.nokAddress || undefined,
            relationship: formData.nokRelationship || undefined,
          },
        }),
      ]);
      
      if (formData.children.length > 0) {
        await saveChildrenMutation.mutateAsync({
          recCanUuid: currentUuid,
          data: formData.children.map((child, index) => ({
            firstName: child.firstName,
            middleName: child.middleName || undefined,
            familyName: child.familyName || undefined,
            dob: child.dateOfBirth || undefined,
            gender: child.gender || undefined,
            sortOrder: index,
          })) as any,
        });
      }
      
      if (formData.vesselType.length > 0) {
        await saveVesselTypesMutation.mutateAsync({
          recCanUuid: currentUuid,
          data: formData.vesselType.map((vt, index) => ({
            vesselTypeUuid: vt,
            sortOrder: index,
          })) as any,
        });
      }
      
      const serverDocMap = new Map((documentsData || []).map(d => [d.docUuid, d.id]));
      const localDocIds = new Set(formData.documents.map(d => d.id));
      
      for (const doc of formData.documents) {
        const docPayload = {
          documentId: doc.documentId || undefined,
          documentName: doc.document || undefined,
          number: doc.number || undefined,
          issued: doc.issued || undefined,
          expiry: doc.expiry || undefined,
          issuingAuthority: doc.issuingAuthority || undefined,
          sortOrder: formData.documents.indexOf(doc),
        };
        
        const serverNumericId = serverDocMap.get(doc.id);
        if (serverNumericId !== undefined) {
          await updateDocumentMutation.mutateAsync({
            id: serverNumericId,
            data: docPayload,
            recCanUuid: currentUuid,
          });
        } else {
          await saveDocumentMutation.mutateAsync({
            recCanUuid: currentUuid,
            data: docPayload,
          });
        }
      }
      
      for (const serverDoc of (documentsData || [])) {
        if (!localDocIds.has(serverDoc.docUuid) && serverDoc.id) {
          await deleteDocumentMutation.mutateAsync({
            id: serverDoc.id,
            recCanUuid: currentUuid,
          });
        }
      }
      
      const serverVisaMap = new Map((visasData || []).map(v => [v.visaUuid, v.id]));
      const localVisaIds = new Set(formData.visas.map(v => v.id));
      
      for (const visa of formData.visas) {
        const visaPayload = {
          countryUuid: visa.countryId || visa.issuingCountry || undefined,
          serialNo: visa.serialNo || undefined,
          issued: visa.issued || undefined,
          expiry: visa.expiry || undefined,
          visaType: visa.visaType || undefined,
          sortOrder: formData.visas.indexOf(visa),
        };
        
        const serverNumericId = serverVisaMap.get(visa.id);
        if (serverNumericId !== undefined) {
          await updateVisaMutation.mutateAsync({
            id: serverNumericId,
            data: visaPayload,
            recCanUuid: currentUuid,
          });
        } else {
          await saveVisaMutation.mutateAsync({
            recCanUuid: currentUuid,
            data: visaPayload,
          });
        }
      }
      
      for (const serverVisa of (visasData || [])) {
        if (!localVisaIds.has(serverVisa.visaUuid) && serverVisa.id) {
          await deleteVisaMutation.mutateAsync({
            id: serverVisa.id,
            recCanUuid: currentUuid,
          });
        }
      }
      
      const serverEduMap = new Map((educationData || []).map(e => [e.eduUuid, e.id]));
      const localEduIds = new Set(formData.education.map(e => e.id));
      
      for (const edu of formData.education) {
        const eduPayload = {
          dateOfCompletion: edu.dateOfCompletion || undefined,
          institution: edu.schoolCollegeUniversity || undefined,
          subjectsField: edu.subjectsField || undefined,
          qualifications: edu.qualifications || undefined,
          sortOrder: formData.education.indexOf(edu),
        };
        
        const serverNumericId = serverEduMap.get(edu.id);
        if (serverNumericId !== undefined) {
          await updateEducationMutation.mutateAsync({
            id: serverNumericId,
            data: eduPayload,
            recCanUuid: currentUuid,
          });
        } else {
          await saveEducationMutation.mutateAsync({
            recCanUuid: currentUuid,
            data: eduPayload,
          });
        }
      }
      
      for (const serverEdu of (educationData || [])) {
        if (!localEduIds.has(serverEdu.eduUuid) && serverEdu.id) {
          await deleteEducationMutation.mutateAsync({
            id: serverEdu.id,
            recCanUuid: currentUuid,
          });
        }
      }
      
      const serverLicMap = new Map((licensesData || []).map(l => [l.licUuid, l.id]));
      const localLicIds = new Set(formData.licenses.map(l => l.id));
      
      for (const lic of formData.licenses) {
        const licPayload = {
          licenseId: lic.licenseId || undefined,
          certificateDocument: lic.certificateDocument || undefined,
          abbr: lic.abbr || undefined,
          requirement: lic.requirement || undefined,
          certificateNo: lic.certificateNo || undefined,
          issuingAuthority: lic.issuingAuthority || undefined,
          issued: lic.issued || undefined,
          expiry: lic.expiry || undefined,
          sortOrder: formData.licenses.indexOf(lic),
        };
        
        const serverNumericId = serverLicMap.get(lic.id);
        if (serverNumericId !== undefined) {
          await updateLicenseMutation.mutateAsync({
            id: serverNumericId,
            data: licPayload,
            recCanUuid: currentUuid,
          });
        } else {
          await saveLicenseMutation.mutateAsync({
            recCanUuid: currentUuid,
            data: licPayload,
          });
        }
      }
      
      for (const serverLic of (licensesData || [])) {
        if (!localLicIds.has(serverLic.licUuid) && serverLic.id) {
          await deleteLicenseMutation.mutateAsync({
            id: serverLic.id,
            recCanUuid: currentUuid,
          });
        }
      }
      
      const serverTrainMap = new Map((trainingData || []).map(t => [t.trainUuid, t.id]));
      const localTrainIds = new Set(formData.trainingCourses.map(t => t.id));
      
      for (const train of formData.trainingCourses) {
        const trainPayload = {
          courseId: train.courseId || undefined,
          trainingCourse: train.trainingCourse || undefined,
          abbr: train.abbr || undefined,
          requirement: train.requirement || undefined,
          certificateNo: train.certificateNo || undefined,
          issuingAuthority: train.issuingAuthority || undefined,
          issued: train.issued || undefined,
          expiry: train.expiry || undefined,
          sortOrder: formData.trainingCourses.indexOf(train),
        };
        
        const serverNumericId = serverTrainMap.get(train.id);
        if (serverNumericId !== undefined) {
          await updateTrainingMutation.mutateAsync({
            id: serverNumericId,
            data: trainPayload,
            recCanUuid: currentUuid,
          });
        } else {
          await saveTrainingMutation.mutateAsync({
            recCanUuid: currentUuid,
            data: trainPayload,
          });
        }
      }
      
      for (const serverTrain of (trainingData || [])) {
        if (!localTrainIds.has(serverTrain.trainUuid) && serverTrain.id) {
          await deleteTrainingMutation.mutateAsync({
            id: serverTrain.id,
            recCanUuid: currentUuid,
          });
        }
      }
      
      const serverSeaMap = new Map((seaServiceData || []).map(s => [s.seaUuid, s.id]));
      const localSeaIds = new Set(formData.seaService.map(s => s.id));
      
      for (const sea of formData.seaService) {
        const seaPayload = {
          vesselName: sea.vesselName || undefined,
          vesselTypeUuid: sea.vesselType || undefined,
          deadweight: sea.deadweight || undefined,
          engineTypePower: sea.engineTypePower || undefined,
          ownerOperator: sea.ownerOperator || undefined,
          rank: sea.rank || undefined,
          fromDate: sea.from || undefined,
          toDate: sea.to || undefined,
          periodMonths: sea.periodMonths || undefined,
          sortOrder: formData.seaService.indexOf(sea),
        };
        
        const serverNumericId = serverSeaMap.get(sea.id);
        if (serverNumericId !== undefined) {
          await updateSeaServiceMutation.mutateAsync({
            id: serverNumericId,
            data: seaPayload,
            recCanUuid: currentUuid,
          });
        } else {
          await saveSeaServiceMutation.mutateAsync({
            recCanUuid: currentUuid,
            data: seaPayload,
          });
        }
      }
      
      for (const serverSea of (seaServiceData || [])) {
        if (!localSeaIds.has(serverSea.seaUuid) && serverSea.id) {
          await deleteSeaServiceMutation.mutateAsync({
            id: serverSea.id,
            recCanUuid: currentUuid,
          });
        }
      }
      
      const serverInfoMap = new Map((additionalInfoData || []).map(a => [a.infoUuid, a.id]));
      const localInfoIds = new Set(formData.additionalInfo.map(a => a.id));
      
      for (const info of formData.additionalInfo) {
        const infoPayload = {
          information: info.information || undefined,
          response: info.response || undefined,
          sortOrder: formData.additionalInfo.indexOf(info),
        };
        
        const serverNumericId = serverInfoMap.get(info.id);
        if (serverNumericId !== undefined) {
          await updateAdditionalInfoMutation.mutateAsync({
            id: serverNumericId,
            data: infoPayload,
            recCanUuid: currentUuid,
          });
        } else {
          await saveAdditionalInfoMutation.mutateAsync({
            recCanUuid: currentUuid,
            data: infoPayload,
          });
        }
      }
      
      for (const serverInfo of (additionalInfoData || [])) {
        if (!localInfoIds.has(serverInfo.infoUuid) && serverInfo.id) {
          await deleteAdditionalInfoMutation.mutateAsync({
            id: serverInfo.id,
            recCanUuid: currentUuid,
          });
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ['v2', 'candidates'] });
      queryClient.invalidateQueries({ queryKey: ['v2', 'documents', currentUuid] });
      queryClient.invalidateQueries({ queryKey: ['v2', 'visas', currentUuid] });
      queryClient.invalidateQueries({ queryKey: ['v2', 'education', currentUuid] });
      queryClient.invalidateQueries({ queryKey: ['v2', 'licenses', currentUuid] });
      queryClient.invalidateQueries({ queryKey: ['v2', 'training-courses', currentUuid] });
      queryClient.invalidateQueries({ queryKey: ['v2', 'sea-service', currentUuid] });
      queryClient.invalidateQueries({ queryKey: ['v2', 'additional-info', currentUuid] });
      
      toast({
        title: "Saved",
        description: "Form data saved successfully",
      });
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save form data",
        variant: "destructive",
      });
    }
  };

  const handleSaveOnly = async () => {
    await handleSaveAndContinue();
  };

  const handleA5SubmitForScreening = async () => {
    try {
      // Always save all form data first (including additional info)
      await handleSaveAndContinue();
      
      const currentUuid = recCanUuid;
      
      if (currentUuid) {
        await updateCandidateMutation.mutateAsync({
          recCanUuid: currentUuid,
          data: {
            status: 'submitted',
          },
        });
        
        toast({
          title: "Submitted",
          description: "Application submitted for screening",
        });
        
        queryClient.invalidateQueries({ queryKey: ['v2', 'candidates'] });
      } else {
        toast({
          title: "Error",
          description: "Please save the form first before submitting",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Submit error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit application",
        variant: "destructive",
      });
    }
  };

  // Toggle approver selection for "Submit for Approval to" multi-select
  const toggleApproverSelection = (approverName: string) => {
    setFormData(prev => {
      const currentSelected = prev.selectedApproversForSubmission;
      if (currentSelected.includes(approverName)) {
        return {
          ...prev,
          selectedApproversForSubmission: currentSelected.filter(a => a !== approverName)
        };
      } else {
        return {
          ...prev,
          selectedApproversForSubmission: [...currentSelected, approverName]
        };
      }
    });
  };

  const handleSaveScreening = async () => {
    if (!recCanUuid) {
      toast({
        title: "Error",
        description: "Please save the candidate first",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({
        title: "Saving...",
        description: "Saving screening data",
      });

      const [b1Result, b2Result, b3Result, b4Result, b5Result, b6Result, b7Result, b8Result] = await Promise.all([
        saveScreeningB1Mutation.mutateAsync({
          recCanUuid,
          data: {
            ageMeetsCriteria: formData.b1AgeMeetsCriteria || undefined,
            rankMeetsCriteria: formData.b1RankMeetsCriteria || undefined,
            certificatesValid: formData.b1CertificatesValid || undefined,
            shortlisted: formData.b1Shortlisted || undefined,
            submittedByUuid: formData.b1SubmittedBy || undefined,
            submittedDate: formData.b1SubmittedDate || undefined,
          } as any,
        }),
        saveScreeningB2Mutation.mutateAsync({
          recCanUuid,
          data: {
            referencesCompleted: formData.b2ReferencesCompleted || undefined,
            employerFeedback: formData.b2EmployerFeedback || undefined,
            submittedByUuid: formData.b2SubmittedBy || undefined,
            submittedDate: formData.b2SubmittedDate || undefined,
          } as any,
        }),
        saveScreeningB3Mutation.mutateAsync({
          recCanUuid,
          data: {
            checksCompleted: formData.b3ChecksCompleted || undefined,
            results: formData.b3Results || undefined,
            submittedByUuid: formData.b3SubmittedBy || undefined,
            submittedDate: formData.b3SubmittedDate || undefined,
          } as any,
        }),
        saveScreeningB4Mutation.mutateAsync({
          recCanUuid,
          data: {
            certificatesAuthenticated: formData.b4CertificatesAuthenticated || undefined,
            results: formData.b4Results || undefined,
            submittedByUuid: formData.b4SubmittedBy || undefined,
            submittedDate: formData.b4SubmittedDate || undefined,
          } as any,
        }),
        saveScreeningB5Mutation.mutateAsync({
          recCanUuid,
          data: {
            testsCompleted: formData.b5TestsCompleted || undefined,
            submittedByUuid: formData.b5SubmittedBy || undefined,
            submittedDate: formData.b5SubmittedDate || undefined,
          } as any,
        }),
        saveScreeningB6Mutation.mutateAsync({
          recCanUuid,
          data: {
            interviewCompleted: formData.b6InterviewCompleted || undefined,
            submittedByUuid: formData.b6SubmittedBy || undefined,
            submittedDate: formData.b6SubmittedDate || undefined,
          } as any,
        }),
        saveScreeningB7Mutation.mutateAsync({
          recCanUuid,
          data: {
            submittedByUuid: formData.b7SubmittedBy || undefined,
            submittedDate: formData.b7SubmittedDate || undefined,
          } as any,
        }),
        saveScreeningB8Mutation.mutateAsync({
          recCanUuid,
          data: {
            shortlisted: formData.b8Shortlisted || undefined,
            submittedByUuid: formData.b8SubmittedBy || undefined,
            submittedDate: formData.b8SubmittedDate || undefined,
            selectedApprovers: JSON.stringify(formData.selectedApproversForSubmission || []),
          } as any,
        }),
      ]);

      const currentB2Uuid = b2Result?.b2Uuid || b2Uuid;
      const currentB3Uuid = b3Result?.b3Uuid || b3Uuid;
      const currentB4Uuid = b4Result?.b4Uuid || b4Uuid;
      const currentB5Uuid = b5Result?.b5Uuid || b5Uuid;
      const currentB6Uuid = b6Result?.b6Uuid || b6Uuid;
      const currentB7Uuid = b7Result?.b7Uuid || b7Uuid;
      const currentB8Uuid = b8Result?.b8Uuid || b8Uuid;

      const serverB2ItemMap = new Map((screeningB2Items || []).map((i: any) => [i.refUuid, i.id]));
      for (const item of formData.b2References) {
        if (!serverB2ItemMap.has(item.id) && currentB2Uuid && (item.date || item.nameDesignation || item.contactInfo)) {
          await createB2ItemMutation.mutateAsync({
            b2Uuid: currentB2Uuid,
            data: {
              refDate: item.date || undefined,
              nameDesignation: item.nameDesignation || undefined,
              contactInfo: item.contactInfo || undefined,
            } as any,
          });
        }
      }

      const serverB3AuthMap = new Map((screeningB3Authorities || []).map((a: any) => [a.authUuid, a.id]));
      for (const auth of formData.b3Authorities) {
        if (!serverB3AuthMap.has(auth.id) && currentB3Uuid && (auth.date || auth.authority)) {
          await createB3AuthorityMutation.mutateAsync({
            b3Uuid: currentB3Uuid,
            data: {
              checkDate: auth.date || undefined,
              authority: auth.authority || undefined,
            } as any,
          });
        }
      }

      const serverB4CertMap = new Map((screeningB4CertItems || []).map((c: any) => [c.certUuid, c.id]));
      for (const cert of formData.b4Certs) {
        if (!serverB4CertMap.has(cert.id) && currentB4Uuid && (cert.date || cert.certificate || cert.authority)) {
          await createB4CertItemMutation.mutateAsync({
            b4Uuid: currentB4Uuid,
            data: {
              authDate: cert.date || undefined,
              certificate: cert.certificate || undefined,
              authority: cert.authority || undefined,
            } as any,
          });
        }
      }

      const serverB5TestMap = new Map((screeningB5TestItems || []).map((t: any) => [t.testUuid, t.id]));
      for (const test of formData.b5Tests) {
        if (!serverB5TestMap.has(test.id) && currentB5Uuid && (test.date || test.subject || test.score || test.result)) {
          await createB5TestItemMutation.mutateAsync({
            b5Uuid: currentB5Uuid,
            data: {
              testDate: test.date || undefined,
              subject: test.subject || undefined,
              score: test.score || undefined,
              result: test.result || undefined,
            } as any,
          });
        }
      }

      const serverB6InterviewMap = new Map((screeningB6InterviewItems || []).map((i: any) => [i.intUuid, i.id]));
      for (const interview of formData.b6Interviews) {
        if (!serverB6InterviewMap.has(interview.id) && currentB6Uuid && (interview.date || interview.interviewer || interview.status || interview.result)) {
          await createB6InterviewItemMutation.mutateAsync({
            b6Uuid: currentB6Uuid,
            data: {
              interviewDate: interview.date || undefined,
              interviewerUuid: interview.interviewer || undefined,
              status: interview.status || undefined,
              result: interview.result || undefined,
              comments: interview.comments || undefined,
            } as any,
          });
        }
      }

      const serverB7TrainingMap = new Map((screeningB7TrainingItems || []).map(t => [t.trainItemUuid, t.id]));
      for (const training of formData.b7TrainingNeeds) {
        if (!serverB7TrainingMap.has(training.id) && currentB7Uuid) {
          await createB7TrainingItemMutation.mutateAsync({
            b7Uuid: currentB7Uuid,
            data: {
              training: training.training || undefined,
              category: training.category || undefined,
              identifiedByUuid: training.identifiedBy || undefined,
              dueDate: training.dueDate || undefined,
              comments: training.comments || undefined,
            },
          });
        }
      }

      // Save B8 approvers from UI (formData.selectedApproversForSubmission is a string array of approver names)
      const serverB8ApproverMap = new Map((screeningB8Approvers || []).map(a => [a.approverName, a.id]));
      for (const approverName of formData.selectedApproversForSubmission) {
        if (!serverB8ApproverMap.has(approverName) && currentB8Uuid) {
          await createB8ApproverMutation.mutateAsync({
            b8Uuid: currentB8Uuid,
            data: {
              approverName: approverName || undefined,
            },
          });
        }
      }

      // Part C - Save approvals (C1)
      const serverApprovalMap = new Map((approvalsData || []).map(a => [a.appUuid, a.id]));
      for (const approver of formData.c1Approvers) {
        const existingServerId = approver.serverId || (approver.appUuid ? serverApprovalMap.get(approver.appUuid) : undefined);
        if (existingServerId) {
          await updateApprovalMutation.mutateAsync({
            recCanUuid,
            id: existingServerId,
            data: {
              approvalDate: approver.date || undefined,
              approverUuid: approver.approver || undefined,
              status: approver.status || undefined,
              approval: approver.approval || undefined,
              comments: approver.comments || undefined,
            } as any,
          });
        } else if (approver.date || approver.approver) {
          const newApproval = await saveApprovalMutation.mutateAsync({
            recCanUuid,
            data: {
              approvalDate: approver.date || undefined,
              approverUuid: approver.approver || undefined,
              status: approver.status || undefined,
              approval: approver.approval || undefined,
              comments: approver.comments || undefined,
            } as any,
          });
          if (newApproval?.id) {
            setFormData(prev => ({
              ...prev,
              c1Approvers: prev.c1Approvers.map(a => 
                a.id === approver.id ? { ...a, serverId: newApproval.id, appUuid: newApproval.appUuid } : a
              ),
            }));
          }
        }
      }

      // Part C - Save suitability (C2)
      await saveSuitabilityMutation.mutateAsync({
        recCanUuid,
        data: {
          vesselTypes: formData.c2VesselTypes.map(vt => ({ vesselTypeUuid: vt })),
          fleetGroups: formData.c2FleetGroups.map(fg => ({ fleetGroupUuid: fg })),
        } as any,
      });

      // Part C - Save decision (C3)
      if (formData.c3RecruitmentStatus) {
        await saveDecisionMutation.mutateAsync({
          recCanUuid,
          data: {
            recruitmentStatus: formData.c3RecruitmentStatus || undefined,
            assignedGroups: formData.c3AssignedGroups.map(g => ({ groupUuid: g })),
          } as any,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['v2', 'approvals', recCanUuid] });
      queryClient.invalidateQueries({ queryKey: ['v2', 'suitability', recCanUuid] });
      queryClient.invalidateQueries({ queryKey: ['v2', 'recruitment-decision', recCanUuid] });
      queryClient.invalidateQueries({ queryKey: ['v2', 'screening-b1', recCanUuid] });
      queryClient.invalidateQueries({ queryKey: ['v2', 'screening-b2', recCanUuid] });
      queryClient.invalidateQueries({ queryKey: ['v2', 'screening-b3', recCanUuid] });
      queryClient.invalidateQueries({ queryKey: ['v2', 'screening-b4', recCanUuid] });
      queryClient.invalidateQueries({ queryKey: ['v2', 'screening-b5', recCanUuid] });
      queryClient.invalidateQueries({ queryKey: ['v2', 'screening-b6', recCanUuid] });
      queryClient.invalidateQueries({ queryKey: ['v2', 'screening-b7', recCanUuid] });
      queryClient.invalidateQueries({ queryKey: ['v2', 'screening-b8', recCanUuid] });
      queryClient.invalidateQueries({ queryKey: ['v2', 'screening-b2-items', currentB2Uuid] });
      queryClient.invalidateQueries({ queryKey: ['v2', 'screening-b3-authorities', currentB3Uuid] });
      queryClient.invalidateQueries({ queryKey: ['v2', 'screening-b4-cert-items', currentB4Uuid] });
      queryClient.invalidateQueries({ queryKey: ['v2', 'screening-b5-test-items', currentB5Uuid] });
      queryClient.invalidateQueries({ queryKey: ['v2', 'screening-b6-interview-items', currentB6Uuid] });
      queryClient.invalidateQueries({ queryKey: ['v2', 'screening-b7-training-items', currentB7Uuid] });
      queryClient.invalidateQueries({ queryKey: ['v2', 'screening-b8-approvers', currentB8Uuid] });

      toast({
        title: "Success",
        description: "Screening data saved successfully",
      });
    } catch (error) {
      console.error('Save screening error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save screening data",
        variant: "destructive",
      });
    }
  };

  const renderA11GeneralParticulars = () => {
    const isEditing = editingSections['A1.1'];

    return (
      <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>A1.1 General Particulars</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleEditSection('A1.1')}
            className="text-gray-500 hover:text-gray-700"
            data-testid="button-edit-a11"
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Photo Upload Area - Left Column */}
          <div className="lg:col-span-3 space-y-4">
            <div className="relative">
              <input
                id="photo-upload-v2"
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
                data-testid="input-photo-upload"
              />
              
              {formData.uploadedPhoto ? (
                <div className="relative w-32 h-40 rounded-lg overflow-hidden border-2 border-gray-300">
                  <img 
                    src={formData.uploadedPhoto} 
                    alt="Uploaded photo" 
                    className="w-full h-full object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6"
                    onClick={() => updateFormData('uploadedPhoto', '')}
                    data-testid="button-remove-photo"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <label htmlFor="photo-upload-v2" className="cursor-pointer block">
                  <div className="w-32 h-40 bg-gray-50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-colors">
                    <div className="text-center">
                      <Camera className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <div className="text-sm text-gray-500 mb-2">Upload Photo</div>
                      <div className="text-xs text-blue-600 hover:text-blue-800">Choose file</div>
                    </div>
                  </div>
                </label>
              )}
              {formData.uploadedPhoto && (
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  className="w-full text-xs mt-2"
                  onClick={() => document.getElementById('photo-upload-v2')?.click()}
                  data-testid="button-change-photo"
                >
                  Change Photo
                </Button>
              )}
            </div>
            
            {/* Fields below photograph */}
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-gray-500 tracking-wide">Rank Applied For</Label>
                {isEditing ? (
                  <Select value={formData.rankAppliedFor} onValueChange={(value) => updateFormData('rankAppliedFor', value)}>
                    <SelectTrigger className="mt-1" data-testid="select-rank-applied-for">
                      <SelectValue placeholder="Select rank" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {ranksLoading ? (
                        <SelectItem value="loading" disabled>Loading ranks...</SelectItem>
                      ) : (
                        rankOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="mt-1 text-sm text-gray-900" data-testid="text-rank-applied-for">{formData.rankAppliedFor}</div>
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
                      <SelectTrigger className="mt-1" data-testid="select-vessel-type">
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
              
              <div>
                <Label className="text-xs text-gray-500 tracking-wide">File No</Label>
                <div className="mt-1 text-sm text-gray-900">
                  {formData.fileNo || (
                    <span className="text-gray-400 italic">Auto-generated on Submit for Screening</span>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Form Fields - Right Column */}
          <div className="lg:col-span-9 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">First Name</Label>
              {isEditing ? (
                <Input
                  value={formData.firstName}
                  onChange={(e) => updateFormData('firstName', e.target.value)}
                  className="mt-1"
                  data-testid="input-first-name"
                />
              ) : (
                <div className="mt-1 text-sm text-gray-900" data-testid="text-first-name">{formData.firstName}</div>
              )}
            </div>
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">Middle Name</Label>
              {isEditing ? (
                <Input
                  value={formData.middleName}
                  onChange={(e) => updateFormData('middleName', e.target.value)}
                  className="mt-1"
                  data-testid="input-middle-name"
                />
              ) : (
                <div className="mt-1 text-sm text-gray-900" data-testid="text-middle-name">{formData.middleName}</div>
              )}
            </div>
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">Family Name</Label>
              {isEditing ? (
                <Input
                  value={formData.familyName}
                  onChange={(e) => updateFormData('familyName', e.target.value)}
                  className="mt-1"
                  data-testid="input-family-name"
                />
              ) : (
                <div className="mt-1 text-sm text-gray-900" data-testid="text-family-name">{formData.familyName}</div>
              )}
            </div>
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">Gender</Label>
              {isEditing ? (
                <Select value={formData.gender} onValueChange={(value) => updateFormData('gender', value)}>
                  <SelectTrigger className="mt-1" data-testid="select-gender">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="mt-1 text-sm text-gray-900" data-testid="text-gender">{formData.gender}</div>
              )}
            </div>
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">Nationality</Label>
              {isEditing ? (
                <Select value={formData.nationality} onValueChange={(value) => updateFormData('nationality', value)}>
                  <SelectTrigger className="mt-1" data-testid="select-nationality">
                    <SelectValue placeholder="Select nationality" />
                  </SelectTrigger>
                  <SelectContent>
                    {NATIONALITIES.map((nat: string) => (
                      <SelectItem key={nat} value={nat}>{nat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="mt-1 text-sm text-gray-900" data-testid="text-nationality">{formData.nationality}</div>
              )}
            </div>
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">Present Rank</Label>
              {isEditing ? (
                <Select value={formData.presentRank} onValueChange={(value) => updateFormData('presentRank', value)}>
                  <SelectTrigger className="mt-1" data-testid="select-present-rank">
                    <SelectValue placeholder="Select rank" />
                  </SelectTrigger>
                  <SelectContent>
                    {ranksLoading ? (
                      <SelectItem value="loading" disabled>Loading ranks...</SelectItem>
                    ) : (
                      rankOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <div className="mt-1 text-sm text-gray-900" data-testid="text-present-rank">{formData.presentRank}</div>
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
                  data-testid="input-dob"
                />
              ) : (
                <div className="mt-1 text-sm text-gray-900" data-testid="text-dob">{formData.dateOfBirth}</div>
              )}
            </div>
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">Age( Years )</Label>
              <div className="mt-1 text-sm text-gray-900" data-testid="text-age">{formData.ageInYears}</div>
            </div>
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">Place of birth( City )</Label>
              {isEditing ? (
                <Input
                  value={formData.placeOfBirthCity}
                  onChange={(e) => updateFormData('placeOfBirthCity', e.target.value)}
                  className="mt-1"
                  data-testid="input-pob-city"
                />
              ) : (
                <div className="mt-1 text-sm text-gray-900" data-testid="text-pob-city">{formData.placeOfBirthCity}</div>
              )}
            </div>
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">Place of birth( Country )</Label>
              {isEditing ? (
                <Select value={formData.placeOfBirthCountry} onValueChange={(value) => updateFormData('placeOfBirthCountry', value)}>
                  <SelectTrigger className="mt-1" data-testid="select-pob-country">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countryMasterData.map((country: string) => (
                      <SelectItem key={country} value={country}>{country}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="mt-1 text-sm text-gray-900" data-testid="text-pob-country">{formData.placeOfBirthCountry}</div>
              )}
            </div>
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">Height( Cm )</Label>
              {isEditing ? (
                <Input
                  value={formData.heightCm}
                  onChange={(e) => updateFormData('heightCm', e.target.value.replace(/[^0-9]/g, ''))}
                  className="mt-1"
                  data-testid="input-height"
                />
              ) : (
                <div className="mt-1 text-sm text-gray-900" data-testid="text-height">{formData.heightCm}</div>
              )}
            </div>
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">Weight( kg )</Label>
              {isEditing ? (
                <Input
                  value={formData.weightKg}
                  onChange={(e) => updateFormData('weightKg', e.target.value.replace(/[^0-9]/g, ''))}
                  className="mt-1"
                  data-testid="input-weight"
                />
              ) : (
                <div className="mt-1 text-sm text-gray-900" data-testid="text-weight">{formData.weightKg}</div>
              )}
            </div>
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">Native Language</Label>
              {isEditing ? (
                <Select value={formData.nativeLanguage} onValueChange={(value) => updateFormData('nativeLanguage', value)}>
                  <SelectTrigger className="mt-1" data-testid="select-native-language">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {languageMasterData.map((lang: string) => (
                      <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="mt-1 text-sm text-gray-900" data-testid="text-native-language">{formData.nativeLanguage}</div>
              )}
            </div>
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">English Proficiency</Label>
              {isEditing ? (
                <Select value={formData.englishProficiency} onValueChange={(value) => updateFormData('englishProficiency', value)}>
                  <SelectTrigger className="mt-1" data-testid="select-english-proficiency">
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
                <div className="mt-1 text-sm text-gray-900" data-testid="text-english-proficiency">{formData.englishProficiency}</div>
              )}
            </div>
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">Foreign Languages</Label>
              {isEditing ? (
                <div className="relative">
                  <Select 
                    value="" 
                    onValueChange={(value) => handleLanguageSelection('foreignLanguages', value)}
                  >
                    <SelectTrigger className="mt-1" data-testid="select-foreign-languages">
                      <SelectValue>
                        {formData.foreignLanguages ? (
                          <div className="text-left">
                            <span className="text-sm">{formData.foreignLanguages}</span>
                          </div>
                        ) : (
                          <span className="text-gray-500">Select foreign languages</span>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {languageMasterData.map((language: string) => {
                        const isSelected = isLanguageSelected('foreignLanguages', language);
                        return (
                          <SelectItem 
                            key={language} 
                            value={language} 
                            className={`cursor-pointer ${isSelected ? "bg-blue-50" : ""}`}
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
                <div className="mt-1 text-sm text-gray-900" data-testid="text-foreign-languages">{formData.foreignLanguages}</div>
              )}
            </div>
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">Manning Agent</Label>
              {isEditing ? (
                <Select value={formData.manningAgent} onValueChange={(value) => updateFormData('manningAgent', value)}>
                  <SelectTrigger className="mt-1" data-testid="select-manning-agent">
                    <SelectValue placeholder="Select manning agent" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {manningAgentOptions.map((agent: any) => (
                      <SelectItem key={agent.id} value={agent.name}>
                        {agent.name}{agent.country ? ` (${agent.country})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="mt-1 text-sm text-gray-900" data-testid="text-manning-agent">{formData.manningAgent}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderA12AddressContact = () => {
    const isEditing = editingSections['A1.2'];

    return (
      <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>A1.2 Address & Contact Info</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleEditSection('A1.2')}
            className="text-gray-500 hover:text-gray-700"
            data-testid="button-edit-a12"
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Row 1: Country of Residence, Nearest Airport, Mobile, Email */}
          <div>
            <Label className="text-xs text-gray-500 tracking-wide">Country of Residence</Label>
            {isEditing ? (
              <Select value={formData.countryOfResidence} onValueChange={(value) => updateFormData('countryOfResidence', value)}>
                <SelectTrigger className="mt-1" data-testid="select-country-residence">
                  <SelectValue placeholder="Select country of residence" />
                </SelectTrigger>
                <SelectContent>
                  {countryMasterData.map((country: string) => (
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
                data-testid="input-nearest-airport"
              />
            ) : (
              <div className="mt-1 text-sm text-gray-900">{formData.nearestAirport}</div>
            )}
          </div>
          <div>
            <Label className="text-xs text-gray-500 tracking-wide">Mobile</Label>
            {isEditing ? (
              <Input
                value={formData.mobile}
                onChange={(e) => updateFormData('mobile', e.target.value)}
                className="mt-1"
                data-testid="input-mobile"
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
                data-testid="input-email"
              />
            ) : (
              <div className="mt-1 text-sm text-gray-900">{formData.email}</div>
            )}
          </div>

          {/* Row 2: Residential Address Line 1, Residential Address Line 2 */}
          <div className="lg:col-span-2">
            <Label className="text-xs text-gray-500 tracking-wide">Residential Address Line 1( House No./Building/Street )</Label>
            {isEditing ? (
              <Input
                value={formData.residentialAddressLine1}
                onChange={(e) => updateFormData('residentialAddressLine1', e.target.value)}
                className="mt-1"
                data-testid="input-address-line1"
              />
            ) : (
              <div className="mt-1 text-sm text-gray-900">{formData.residentialAddressLine1}</div>
            )}
          </div>
          <div className="lg:col-span-2">
            <Label className="text-xs text-gray-500 tracking-wide">Residential Address Line 2( City, State, PIN )</Label>
            {isEditing ? (
              <Input
                value={formData.residentialAddressLine2}
                onChange={(e) => updateFormData('residentialAddressLine2', e.target.value)}
                className="mt-1"
                placeholder="Enter city, state, PIN"
                data-testid="input-address-line2"
              />
            ) : (
              <div className="mt-1 text-sm text-gray-900">{formData.residentialAddressLine2}</div>
            )}
          </div>

          {/* Row 3: Contact Landline */}
          <div>
            <Label className="text-xs text-gray-500 tracking-wide">Contact Landline</Label>
            {isEditing ? (
              <Input
                value={formData.contactLandline}
                onChange={(e) => updateFormData('contactLandline', e.target.value)}
                className="mt-1"
                data-testid="input-landline"
              />
            ) : (
              <div className="mt-1 text-sm text-gray-900">{formData.contactLandline}</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderA13FamilyNOK = () => {
    const isEditing = editingSections['A1.3'];

    return (
      <div ref={sectionA13Ref} className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>A1.3 Family and NOK</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleEditSection('A1.3')}
            className="text-gray-500 hover:text-gray-700"
            data-testid="button-edit-a13"
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">Marital Status</Label>
              {isEditing ? (
                <Select value={formData.maritalStatus} onValueChange={(value) => updateFormData('maritalStatus', value)}>
                  <SelectTrigger className="mt-1" data-testid="select-marital-status">
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
                  onChange={(e) => updateFormData('numberOfDependentChildren', e.target.value.replace(/[^0-9]/g, ''))}
                  className="mt-1"
                  data-testid="input-num-children"
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
                  data-testid="input-father-name"
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
                  data-testid="input-mother-name"
                />
              ) : (
                <div className="mt-1 text-sm text-gray-900">{formData.motherName}</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">Spouse First Name</Label>
              {isEditing ? (
                <Input
                  value={formData.spouseFirstName}
                  onChange={(e) => updateFormData('spouseFirstName', e.target.value)}
                  className="mt-1"
                  data-testid="input-spouse-first-name"
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
                  data-testid="input-spouse-middle-name"
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
                  data-testid="input-spouse-family-name"
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
                  data-testid="input-spouse-dob"
                />
              ) : (
                <div className="mt-1 text-sm text-gray-900">{formData.spouseDateOfBirth}</div>
              )}
            </div>
          </div>

          {/* Children Information Section */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label className="text-xs text-gray-500 tracking-wide">Children Information</Label>
              {isEditing && (
                <Button variant="outline" size="sm" onClick={addChild} data-testid="button-add-child">
                  <Plus className="h-4 w-4 mr-1" /> Add Child
                </Button>
              )}
            </div>
            <Table className="w-full">
              <TableHeader>
                <TableRow className="bg-gray-100">
                  <TableHead className="text-[#4f5863] text-[13px] font-medium p-3 w-16">S.No</TableHead>
                  <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">First Name</TableHead>
                  <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Middle Name</TableHead>
                  <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Family Name</TableHead>
                  <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Date of Birth</TableHead>
                  <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Gender</TableHead>
                  {isEditing && <TableHead className="text-[#4f5863] text-[13px] font-medium p-3 w-16">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {formData.children.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isEditing ? 7 : 6} className="p-3 text-center text-gray-400 text-[13px]">
                      No children added
                    </TableCell>
                  </TableRow>
                ) : (
                  formData.children.map((child, index) => (
                    <TableRow key={child.id} className="border-b border-gray-200">
                      <TableCell className="p-3 text-[13px]">{index + 1}</TableCell>
                      <TableCell className="p-3">
                        {isEditing ? (
                          <Input value={child.firstName} onChange={(e) => updateChild(child.id, 'firstName', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                        ) : (
                          <span className="text-[13px]">{child.firstName}</span>
                        )}
                      </TableCell>
                      <TableCell className="p-3">
                        {isEditing ? (
                          <Input value={child.middleName} onChange={(e) => updateChild(child.id, 'middleName', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                        ) : (
                          <span className="text-[13px]">{child.middleName}</span>
                        )}
                      </TableCell>
                      <TableCell className="p-3">
                        {isEditing ? (
                          <Input value={child.familyName} onChange={(e) => updateChild(child.id, 'familyName', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                        ) : (
                          <span className="text-[13px]">{child.familyName}</span>
                        )}
                      </TableCell>
                      <TableCell className="p-3">
                        {isEditing ? (
                          <Input type="date" value={child.dateOfBirth} onChange={(e) => updateChild(child.id, 'dateOfBirth', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                        ) : (
                          <span className="text-[13px]">{child.dateOfBirth}</span>
                        )}
                      </TableCell>
                      <TableCell className="p-3">
                        {isEditing ? (
                          <Select value={child.gender} onValueChange={(value) => updateChild(child.id, 'gender', value)}>
                            <SelectTrigger className="text-[13px] border-0 shadow-none p-0 h-auto">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Male">Male</SelectItem>
                              <SelectItem value="Female">Female</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-[13px]">{child.gender}</span>
                        )}
                      </TableCell>
                      {isEditing && (
                        <TableCell className="p-3">
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-red-600" onClick={() => removeChild(child.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* NOK Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Row 1: NOK: First Name, NOK: Middle Name, NOK: Family Name, NOK: Email */}
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">NOK: First Name</Label>
              {isEditing ? (
                <Input value={formData.nokFirstName} onChange={(e) => updateFormData('nokFirstName', e.target.value)} className="mt-1" data-testid="input-nok-first-name" />
              ) : (
                <div className="mt-1 text-sm text-gray-900">{formData.nokFirstName}</div>
              )}
            </div>
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">NOK: Middle Name</Label>
              {isEditing ? (
                <Input value={formData.nokMiddleName} onChange={(e) => updateFormData('nokMiddleName', e.target.value)} className="mt-1" data-testid="input-nok-middle-name" />
              ) : (
                <div className="mt-1 text-sm text-gray-900">{formData.nokMiddleName}</div>
              )}
            </div>
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">NOK: Family Name</Label>
              {isEditing ? (
                <Input value={formData.nokFamilyName} onChange={(e) => updateFormData('nokFamilyName', e.target.value)} className="mt-1" data-testid="input-nok-family-name" />
              ) : (
                <div className="mt-1 text-sm text-gray-900">{formData.nokFamilyName}</div>
              )}
            </div>
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">NOK: Email</Label>
              {isEditing ? (
                <Input type="email" value={formData.nokEmail} onChange={(e) => updateFormData('nokEmail', e.target.value)} className="mt-1" data-testid="input-nok-email" />
              ) : (
                <div className="mt-1 text-sm text-gray-900">{formData.nokEmail}</div>
              )}
            </div>
            {/* Row 2: NOK: Address, NOK: Relationship, NOK: Tel */}
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">NOK: Address</Label>
              {isEditing ? (
                <Input value={formData.nokAddress} onChange={(e) => updateFormData('nokAddress', e.target.value)} className="mt-1" data-testid="input-nok-address" />
              ) : (
                <div className="mt-1 text-sm text-gray-900">{formData.nokAddress}</div>
              )}
            </div>
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">NOK: Relationship</Label>
              {isEditing ? (
                <Input value={formData.nokRelationship} onChange={(e) => updateFormData('nokRelationship', e.target.value)} className="mt-1" data-testid="input-nok-relationship" />
              ) : (
                <div className="mt-1 text-sm text-gray-900">{formData.nokRelationship}</div>
              )}
            </div>
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">NOK: Tel</Label>
              {isEditing ? (
                <Input value={formData.nokTelephone} onChange={(e) => updateFormData('nokTelephone', e.target.value)} className="mt-1" data-testid="input-nok-telephone" />
              ) : (
                <div className="mt-1 text-sm text-gray-900">{formData.nokTelephone}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderA21TravelDocs = () => {
    return (
      <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>A2.1 Travel & Identification Documents</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsTravelDocDialogOpen(true)} className="text-gray-600 border-gray-300 hover:bg-gray-50 text-xs" data-testid="button-add-doc-from-db">
              + ADD FROM DATABASE
            </Button>
            <Button variant="outline" size="sm" onClick={addDocument} className="text-gray-600 border-gray-300 hover:bg-gray-50" data-testid="button-add-document">
              <Plus className="h-4 w-4 mr-2" /> ADD
            </Button>
          </div>
        </div>

        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-gray-100">
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">ID</TableHead>
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
                <TableCell className="p-3 text-[13px]">{doc.id}</TableCell>
                <TableCell className="p-3">
                  <Input value={doc.document} onChange={(e) => updateDocument(doc.id, 'document', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                </TableCell>
                <TableCell className="p-3">
                  <Input value={doc.number} onChange={(e) => updateDocument(doc.id, 'number', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                </TableCell>
                <TableCell className="p-3">
                  <Input type="date" value={doc.issued} onChange={(e) => updateDocument(doc.id, 'issued', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                </TableCell>
                <TableCell className="p-3">
                  <Input type="date" value={doc.expiry} onChange={(e) => updateDocument(doc.id, 'expiry', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                </TableCell>
                <TableCell className="p-3">
                  <Input value={doc.issuingAuthority} onChange={(e) => updateDocument(doc.id, 'issuingAuthority', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                </TableCell>
                <TableCell className="p-3">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-blue-600 relative" onClick={() => openAttachmentDialog('document', doc.id, doc.document || 'Document')} data-testid={`button-attach-doc-${doc.id}`}>
                      <Paperclip className="h-3 w-3" />
                      {(doc.attachments?.length || 0) > 0 && (
                        <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] rounded-full h-3.5 w-3.5 flex items-center justify-center">{doc.attachments?.length}</span>
                      )}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-red-600" onClick={() => removeDocument(doc.id)}>
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

  const renderA22Visas = () => {
    return (
      <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>A2.2 Visas</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsVisaDialogOpen(true)} className="text-gray-600 border-gray-300 hover:bg-gray-50 text-xs" data-testid="button-add-visa-from-db">
              + ADD FROM DATABASE
            </Button>
            <Button variant="outline" size="sm" onClick={addVisa} className="text-gray-600 border-gray-300 hover:bg-gray-50" data-testid="button-add-visa">
              <Plus className="h-4 w-4 mr-2" /> ADD
            </Button>
          </div>
        </div>

        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-gray-100">
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">ID</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Issuing Country</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Serial No</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Issued</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Expiry</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Visa Type</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3 w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {formData.visas.map((visa) => (
              <TableRow key={visa.id} className="border-b border-gray-200">
                <TableCell className="p-3 text-[13px]">{visa.id}</TableCell>
                <TableCell className="p-3">
                  <Input value={visa.issuingCountry} onChange={(e) => updateVisa(visa.id, 'issuingCountry', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                </TableCell>
                <TableCell className="p-3">
                  <Input value={visa.serialNo} onChange={(e) => updateVisa(visa.id, 'serialNo', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                </TableCell>
                <TableCell className="p-3">
                  <Input type="date" value={visa.issued} onChange={(e) => updateVisa(visa.id, 'issued', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                </TableCell>
                <TableCell className="p-3">
                  <Input type="date" value={visa.expiry} onChange={(e) => updateVisa(visa.id, 'expiry', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                </TableCell>
                <TableCell className="p-3">
                  <Input value={visa.visaType} onChange={(e) => updateVisa(visa.id, 'visaType', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                </TableCell>
                <TableCell className="p-3">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-blue-600 relative" onClick={() => openAttachmentDialog('visa', visa.id, visa.issuingCountry || 'Visa')} data-testid={`button-attach-visa-${visa.id}`}>
                      <Paperclip className="h-3 w-3" />
                      {(visa.attachments?.length || 0) > 0 && (
                        <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] rounded-full h-3.5 w-3.5 flex items-center justify-center">{visa.attachments?.length}</span>
                      )}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-red-600" onClick={() => removeVisa(visa.id)}>
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

  const renderA31Education = () => {
    return (
      <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>A3.1 Education</h3>
          <Button variant="outline" size="sm" onClick={addEducation} className="text-gray-600 border-gray-300 hover:bg-gray-50" data-testid="button-add-education">
            <Plus className="h-4 w-4 mr-2" /> ADD
          </Button>
        </div>

        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-gray-100">
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">ID</TableHead>
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
                <TableCell className="p-3 text-[13px]">{edu.id}</TableCell>
                <TableCell className="p-3">
                  <Input type="date" value={edu.dateOfCompletion} onChange={(e) => updateEducation(edu.id, 'dateOfCompletion', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                </TableCell>
                <TableCell className="p-3">
                  <Input value={edu.schoolCollegeUniversity} onChange={(e) => updateEducation(edu.id, 'schoolCollegeUniversity', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                </TableCell>
                <TableCell className="p-3">
                  <Input value={edu.subjectsField} onChange={(e) => updateEducation(edu.id, 'subjectsField', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                </TableCell>
                <TableCell className="p-3">
                  <Input value={edu.qualifications} onChange={(e) => updateEducation(edu.id, 'qualifications', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                </TableCell>
                <TableCell className="p-3">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-blue-600 relative" onClick={() => openAttachmentDialog('education', edu.id, edu.schoolCollegeUniversity || 'Education')} data-testid={`button-attach-edu-${edu.id}`}>
                      <Paperclip className="h-3 w-3" />
                      {(edu.attachments?.length || 0) > 0 && (
                        <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] rounded-full h-3.5 w-3.5 flex items-center justify-center">{edu.attachments?.length}</span>
                      )}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-red-600" onClick={() => removeEducation(edu.id)}>
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

  const renderA32LicenseDCE = () => {
    return (
      <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>A3.2 License & DCE</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsLicenseDialogOpen(true)} className="text-gray-600 border-gray-300 hover:bg-gray-50 text-xs" data-testid="button-add-license-from-db">
              + ADD FROM DATABASE
            </Button>
            <Button variant="outline" size="sm" onClick={addLicense} className="text-gray-600 border-gray-300 hover:bg-gray-50" data-testid="button-add-license">
              <Plus className="h-4 w-4 mr-2" /> ADD
            </Button>
          </div>
        </div>

        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-gray-100">
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">ID</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Certificate/Document</TableHead>
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
            {formData.licenses.map((lic) => (
              <TableRow key={lic.id} className="border-b border-gray-200">
                <TableCell className="p-3 text-[13px]">{lic.id}</TableCell>
                <TableCell className="p-3">
                  <Input value={lic.certificateDocument} onChange={(e) => updateLicense(lic.id, 'certificateDocument', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                </TableCell>
                <TableCell className="p-3">
                  <Input value={lic.abbr} onChange={(e) => updateLicense(lic.id, 'abbr', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                </TableCell>
                <TableCell className="p-3">
                  <Input value={lic.requirement} onChange={(e) => updateLicense(lic.id, 'requirement', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                </TableCell>
                <TableCell className="p-3">
                  <Input value={lic.certificateNo} onChange={(e) => updateLicense(lic.id, 'certificateNo', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                </TableCell>
                <TableCell className="p-3">
                  <Input value={lic.issuingAuthority} onChange={(e) => updateLicense(lic.id, 'issuingAuthority', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                </TableCell>
                <TableCell className="p-3">
                  <Input type="date" value={lic.issued} onChange={(e) => updateLicense(lic.id, 'issued', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                </TableCell>
                <TableCell className="p-3">
                  <Input type="date" value={lic.expiry} onChange={(e) => updateLicense(lic.id, 'expiry', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                </TableCell>
                <TableCell className="p-3">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-blue-600 relative" onClick={() => openAttachmentDialog('license', lic.id, lic.certificateDocument || 'License')} data-testid={`button-attach-lic-${lic.id}`}>
                      <Paperclip className="h-3 w-3" />
                      {(lic.attachments?.length || 0) > 0 && (
                        <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] rounded-full h-3.5 w-3.5 flex items-center justify-center">{lic.attachments?.length}</span>
                      )}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-red-600" onClick={() => removeLicense(lic.id)}>
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

  const renderA33TrainingCourse = () => {
    return (
      <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>A3.3 Training Course</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsTrainingDialogOpen(true)} className="text-gray-600 border-gray-300 hover:bg-gray-50 text-xs" data-testid="button-add-training-from-db">
              + ADD FROM DATABASE
            </Button>
            <Button variant="outline" size="sm" onClick={addTrainingCourse} className="text-gray-600 border-gray-300 hover:bg-gray-50" data-testid="button-add-training">
              <Plus className="h-4 w-4 mr-2" /> ADD
            </Button>
          </div>
        </div>

        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-gray-100">
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">ID</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Training/Course</TableHead>
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
                <TableCell className="p-3 text-[13px]">{course.id}</TableCell>
                <TableCell className="p-3">
                  <Input value={course.trainingCourse} onChange={(e) => updateTrainingCourse(course.id, 'trainingCourse', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                </TableCell>
                <TableCell className="p-3">
                  <Input value={course.abbr} onChange={(e) => updateTrainingCourse(course.id, 'abbr', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                </TableCell>
                <TableCell className="p-3">
                  <Input value={course.requirement} onChange={(e) => updateTrainingCourse(course.id, 'requirement', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                </TableCell>
                <TableCell className="p-3">
                  <Input value={course.certificateNo} onChange={(e) => updateTrainingCourse(course.id, 'certificateNo', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                </TableCell>
                <TableCell className="p-3">
                  <Input value={course.issuingAuthority} onChange={(e) => updateTrainingCourse(course.id, 'issuingAuthority', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                </TableCell>
                <TableCell className="p-3">
                  <Input type="date" value={course.issued} onChange={(e) => updateTrainingCourse(course.id, 'issued', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                </TableCell>
                <TableCell className="p-3">
                  <Input type="date" value={course.expiry} onChange={(e) => updateTrainingCourse(course.id, 'expiry', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                </TableCell>
                <TableCell className="p-3">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-blue-600 relative" onClick={() => openAttachmentDialog('training', course.id, course.trainingCourse || 'Training')} data-testid={`button-attach-training-${course.id}`}>
                      <Paperclip className="h-3 w-3" />
                      {(course.attachments?.length || 0) > 0 && (
                        <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] rounded-full h-3.5 w-3.5 flex items-center justify-center">{course.attachments?.length}</span>
                      )}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-red-600" onClick={() => removeTrainingCourse(course.id)}>
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

  const renderA41SeaService = () => {
    return (
      <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>A4.1 Details of Sea Service</h3>
          <Button variant="outline" size="sm" onClick={addSeaService} className="text-gray-600 border-gray-300 hover:bg-gray-50" data-testid="button-add-sea-service">
            <Plus className="h-4 w-4 mr-2" /> ADD
          </Button>
        </div>

        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-gray-100">
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3 w-40">Vessel Name</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3 w-28">Vessel Type</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3 w-20">Deadweight</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3 w-24">Engine Type/Power</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3 w-24">Owner/Operator</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3 w-24">Rank</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3 w-28">From</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3 w-28">To</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3 w-16">Period(M)</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3 w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {formData.seaService.map((service) => (
              <TableRow key={service.id} className="border-b border-gray-200">
                <TableCell className="p-3">
                  <Input value={service.vesselName} onChange={(e) => updateSeaService(service.id, 'vesselName', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" placeholder="Enter vessel name" />
                </TableCell>
                <TableCell className="p-3">
                  <Select value={service.vesselType} onValueChange={(value) => updateSeaService(service.id, 'vesselType', value)}>
                    <SelectTrigger className="text-[13px] border-0 shadow-none p-0 h-auto">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {vesselTypeMasterData.map((vt: string) => (
                        <SelectItem key={vt} value={vt}>{vt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="p-3">
                  <Input value={service.deadweight} onChange={(e) => updateSeaService(service.id, 'deadweight', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                </TableCell>
                <TableCell className="p-3">
                  <Input value={service.engineTypePower} onChange={(e) => updateSeaService(service.id, 'engineTypePower', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                </TableCell>
                <TableCell className="p-3">
                  <Input value={service.ownerOperator} onChange={(e) => updateSeaService(service.id, 'ownerOperator', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                </TableCell>
                <TableCell className="p-3">
                  <Select value={service.rank} onValueChange={(value) => updateSeaService(service.id, 'rank', value)}>
                    <SelectTrigger className="text-[13px] border-0 shadow-none p-0 h-auto">
                      <SelectValue placeholder="Select rank" />
                    </SelectTrigger>
                    <SelectContent>
                      {ranksLoading ? (
                        <SelectItem value="loading" disabled>Loading ranks...</SelectItem>
                      ) : (
                        rankOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="p-3">
                  <Input type="date" value={service.from} onChange={(e) => updateSeaService(service.id, 'from', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                </TableCell>
                <TableCell className="p-3">
                  <Input type="date" value={service.to} onChange={(e) => updateSeaService(service.id, 'to', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" />
                </TableCell>
                <TableCell className="p-3">
                  <Input value={service.periodMonths} readOnly className="text-[13px] border-0 shadow-none p-0 h-auto bg-gray-50 cursor-not-allowed" title="Auto-calculated" />
                </TableCell>
                <TableCell className="p-3">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-blue-600 relative" onClick={() => openAttachmentDialog('seaService', service.id, service.vesselName || 'Sea Service')} data-testid={`button-attach-seaservice-${service.id}`}>
                      <Paperclip className="h-3 w-3" />
                      {(service.attachments?.length || 0) > 0 && (
                        <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] rounded-full h-3.5 w-3.5 flex items-center justify-center">{service.attachments?.length}</span>
                      )}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-red-600" onClick={() => removeSeaService(service.id)}>
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

  const renderA5AdditionalInfo = () => {
    return (
      <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>A5.1 Details on Additional Information required</h3>
          <Button variant="outline" size="sm" onClick={addAdditionalInfo} className="text-gray-600 border-gray-300 hover:bg-gray-50" data-testid="button-add-additional-info">
            <Plus className="h-4 w-4 mr-2" /> ADD
          </Button>
        </div>

        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-gray-100">
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Information</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Response</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3 w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {formData.additionalInfo.map((info) => (
              <TableRow key={info.id} className="border-b border-gray-200">
                <TableCell className="p-3">
                  <Input value={info.information} onChange={(e) => updateAdditionalInfo(info.id, 'information', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" placeholder="Enter information requirement" />
                </TableCell>
                <TableCell className="p-3">
                  <Input value={info.response} onChange={(e) => updateAdditionalInfo(info.id, 'response', e.target.value)} className="text-[13px] border-0 shadow-none p-0 h-auto" placeholder="Enter response" />
                </TableCell>
                <TableCell className="p-3">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-gray-600 relative" onClick={() => openAttachmentDialog('additionalInfo', info.id, info.information || 'Additional Info')} data-testid={`button-attach-additionalinfo-${info.id}`}>
                      <Paperclip className="h-3 w-3" />
                      {(info.attachments?.length || 0) > 0 && (
                        <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] rounded-full h-3.5 w-3.5 flex items-center justify-center">{info.attachments?.length}</span>
                      )}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600" onClick={() => removeAdditionalInfo(info.id)}>
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

  const renderContinuousSections = () => {
    return (
      <div className="space-y-6">
        <div ref={a1Ref} data-section-id="A1">
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="pb-4 mb-6">
                <h2 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part A1 Seafarers' Particulars</h2>
                <div style={{ color: '#16569e' }} className="text-sm">Enter details as applicable</div>
                <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
              </div>
              <div className="space-y-6">
                <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
                  <div className="2xl:col-span-1">{renderA11GeneralParticulars()}</div>
                  <div className="2xl:col-span-1">{renderA12AddressContact()}</div>
                </div>
                <div>{renderA13FamilyNOK()}</div>
              </div>
              <div className="flex justify-end gap-2 mt-6 pt-4">
                <Button className="bg-[#60A5FA] hover:bg-[#3B82F6] text-white px-8" onClick={handleSaveAndContinue} disabled={savingInProgress} data-testid="button-save-continue-a1">
                  {savingInProgress ? 'Saving...' : 'Save & Continue'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div ref={a2Ref} data-section-id="A2">
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="pb-4 mb-6">
                <h2 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part A2 - Travel & ID Documents</h2>
                <div style={{ color: '#16569e' }} className="text-sm">Add from the list all applicable identification & travel documents</div>
                <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
              </div>
              <div className="space-y-6">
                {renderA21TravelDocs()}
                {renderA22Visas()}
              </div>
              <div className="flex justify-end gap-2 mt-6 pt-4">
                <Button className="bg-[#60A5FA] hover:bg-[#3B82F6] text-white px-8" onClick={handleSaveAndContinue} disabled={savingInProgress} data-testid="button-save-continue-a2">
                  {savingInProgress ? 'Saving...' : 'Save & Continue'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div ref={a3Ref} data-section-id="A3">
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="pb-4 mb-6">
                <h2 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part A3 - Training & Certificates</h2>
                <div style={{ color: '#16569e' }} className="text-sm">Add Education, Competency & Training Information</div>
                <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
              </div>
              <div className="space-y-6">
                {renderA31Education()}
                {renderA32LicenseDCE()}
                {renderA33TrainingCourse()}
              </div>
              <div className="flex justify-end gap-2 mt-6 pt-4">
                <Button className="bg-[#60A5FA] hover:bg-[#3B82F6] text-white px-8" onClick={handleSaveAndContinue} disabled={savingInProgress} data-testid="button-save-continue-a3">
                  {savingInProgress ? 'Saving...' : 'Save & Continue'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div ref={a4Ref} data-section-id="A4">
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="pb-4 mb-6">
                <h2 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part A4 - Sea Service</h2>
                <div style={{ color: '#16569e' }} className="text-sm">Add Sea service details, latest on top</div>
                <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
              </div>
              <div className="space-y-6">{renderA41SeaService()}</div>
              <div className="flex justify-end gap-2 mt-6 pt-4">
                <Button className="bg-[#60A5FA] hover:bg-[#3B82F6] text-white px-8" onClick={handleSaveAndContinue} disabled={savingInProgress} data-testid="button-save-continue-a4">
                  {savingInProgress ? 'Saving...' : 'Save & Continue'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div ref={a5Ref} data-section-id="A5">
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="pb-4 mb-6">
                <h2 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part A5 - Additional Information</h2>
                <div className="text-sm text-[#16569e]">Provide additional information as below</div>
                <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
              </div>
              <div className="space-y-6">{renderA5AdditionalInfo()}</div>
              <div className="flex justify-end gap-2 mt-6 pt-4">
                <Button className="bg-green-600 hover:bg-green-700 text-white px-8" onClick={handleA5SubmitForScreening} disabled={savingInProgress} data-testid="button-submit-for-screening">
                  {savingInProgress ? 'Saving...' : 'Submit for Screening'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (['A1', 'A2', 'A3', 'A4', 'A5'].includes(activeSection)) {
      return renderContinuousSections();
    }

    switch (activeSection) {
      case 'B':
        return (
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="pb-4 mb-6">
                <h2 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part B - Company Processing</h2>
                <div style={{ color: '#16569e' }} className="text-sm">For office use only - Crew executives processing</div>
                <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
              </div>
              
              <div className="space-y-8">
                {/* B1. Initial Screening - matching legacy exactly with full comment functionality */}
                <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-base font-medium" style={{ color: '#16569e' }}>B1. Initial Screening</h3>
                    <div className="cursor-help" title="Guidance for initial screening process">
                      <Info className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                  
                  {[
                    { id: 'b1-age', field: 'b1AgeMeetsCriteria', label: 'B1.1 Age meets Company Criteria for the Rank applied for?', hasNA: true },
                    { id: 'b1-rank', field: 'b1RankMeetsCriteria', label: 'B1.2 Experience meets Company Criteria for the Rank applied for?', hasNA: true },
                    { id: 'b1-cert', field: 'b1CertificatesValid', label: 'B1.3 Certificates & Documents in order & valid as per Company Criteria?', hasNA: true },
                    { id: 'b1-shortlist', field: 'b1Shortlisted', label: 'B1.4 Shortlisted (Initial Screening)?', hasNA: false },
                  ].map((question) => (
                    <React.Fragment key={question.id}>
                      <div className="flex justify-between items-center mb-2">
                        <Label className="text-xs text-gray-500 tracking-wide flex-1 pr-4">
                          {question.label}
                        </Label>
                        <div className="flex items-center min-w-[300px]">
                          <div className="flex gap-6 w-[200px]">
                            <RadioGroup 
                              value={formData[question.field as keyof LocalFormData] as string} 
                              onValueChange={(value) => setFormData(prev => ({ ...prev, [question.field]: value }))}
                              className="flex gap-6"
                            >
                              <div className="flex items-center space-x-2 w-[50px]">
                                <RadioGroupItem value="yes" id={`${question.id}-yes`} />
                                <Label htmlFor={`${question.id}-yes`} className="text-sm cursor-pointer">Yes</Label>
                              </div>
                              <div className="flex items-center space-x-2 w-[50px]">
                                <RadioGroupItem value="no" id={`${question.id}-no`} />
                                <Label htmlFor={`${question.id}-no`} className="text-sm cursor-pointer">No</Label>
                              </div>
                              {question.hasNA && (
                                <div className="flex items-center space-x-2 w-[50px]">
                                  <RadioGroupItem value="na" id={`${question.id}-na`} />
                                  <Label htmlFor={`${question.id}-na`} className="text-sm cursor-pointer">NA</Label>
                                </div>
                              )}
                              {!question.hasNA && <div className="w-[50px]"></div>}
                            </RadioGroup>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 ml-4"
                            onClick={() => setNewB1Comment(prev => ({
                              ...prev,
                              [question.id]: ""
                            }))}
                            data-testid={`button-${question.id}-comment`}
                          >
                            <MessageSquare className="h-4 w-4 text-gray-400" />
                          </Button>
                        </div>
                      </div>

                      {/* Multiple comments for this question - exact copy from legacy */}
                      {(formData.b1Comments[question.id]?.length > 0 || newB1Comment[question.id] !== undefined) && (
                        <div className="ml-4 mb-4 space-y-2">
                          {/* Existing comments */}
                          {formData.b1Comments[question.id]?.map((comment) => (
                            <div key={comment.id} className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="text-blue-600 italic text-[13px] mb-2">{comment.user}:</div>
                                {editingB1Comment === comment.id ? (
                                  <Textarea
                                    value={comment.text}
                                    onChange={(e) => {
                                      setFormData(prev => ({
                                        ...prev,
                                        b1Comments: {
                                          ...prev.b1Comments,
                                          [question.id]: prev.b1Comments[question.id]?.map(c => 
                                            c.id === comment.id ? { ...c, text: e.target.value } : c
                                          ) || []
                                        }
                                      }));
                                    }}
                                    onBlur={() => setEditingB1Comment(null)}
                                    autoFocus
                                    className="min-h-[80px] w-full"
                                  />
                                ) : (
                                  <div 
                                    className="text-blue-600 italic text-[13px] p-1 cursor-pointer min-h-[20px] border border-transparent hover:border-gray-200 rounded"
                                    onClick={() => setEditingB1Comment(comment.id)}
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
                                    setFormData(prev => ({
                                      ...prev,
                                      b1Comments: {
                                        ...prev.b1Comments,
                                        [question.id]: prev.b1Comments[question.id]?.filter(c => c.id !== comment.id) || []
                                      }
                                    }));
                                    if (editingB1Comment === comment.id) {
                                      setEditingB1Comment(null);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          
                          {/* New comment input */}
                          {newB1Comment[question.id] !== undefined && (
                            <div>
                              <div className="text-sm font-medium text-gray-600 mb-2">{currentUserDisplay}</div>
                              <Textarea
                                value={newB1Comment[question.id]}
                                onChange={(e) => {
                                  setNewB1Comment(prev => ({
                                    ...prev,
                                    [question.id]: e.target.value
                                  }));
                                }}
                                onBlur={() => {
                                  if (newB1Comment[question.id]?.trim() && b1Uuid) {
                                    const commentId = Date.now().toString();
                                    const commentText = newB1Comment[question.id];
                                    setFormData(prev => ({
                                      ...prev,
                                      b1Comments: {
                                        ...prev.b1Comments,
                                        [question.id]: [
                                          ...(prev.b1Comments[question.id] || []),
                                          {
                                            id: commentId,
                                            user: currentUserDisplay,
                                            text: commentText
                                          }
                                        ]
                                      }
                                    }));
                                    createB1CommentMutation.mutate({
                                      b1Uuid,
                                      data: {
                                        fieldKey: question.id,
                                        userUuid: currentUserDisplay,
                                        commentText: commentText
                                      }
                                    });
                                  }
                                  setNewB1Comment(prev => {
                                    const newState = { ...prev };
                                    delete newState[question.id];
                                    return newState;
                                  });
                                }}
                                placeholder="Comment: Add your observations here..."
                                className="text-blue-600 italic border-blue-200 text-[13px]"
                                rows={2}
                                autoFocus
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                  
                  {/* Attachment button */}
                  <div className="flex justify-start mt-6">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-gray-600 border-gray-300 hover:bg-gray-50"
                      data-testid="button-b1-attachments"
                      onClick={() => openAttachmentDialog('b1', 'b1', 'B1. Initial Screening')}
                    >
                      <Paperclip className="h-4 w-4 mr-2" />
                      Attachment(s)
                      {formData.b1Attachments?.length > 0 && (
                        <span className="ml-2 bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
                          {formData.b1Attachments.length}
                        </span>
                      )}
                    </Button>
                  </div>

                  {/* Submitted by section */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <div className="text-xs text-gray-500">
                        {formData.b1SubmittedBy ? (
                          <>
                            <span className="font-medium">Submitted by:</span> {formData.b1SubmittedBy}
                            {formData.b1SubmittedDate && ` on ${formData.b1SubmittedDate}`}
                          </>
                        ) : (
                          <span className="text-gray-400">Not yet submitted</span>
                        )}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={handleSaveScreening}
                        data-testid="button-b1-submit"
                      >
                        Submit
                      </Button>
                    </div>
                  </div>
                </div>

                {/* B2. Reference Checks - matching legacy exactly */}
                <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-base font-medium" style={{ color: '#16569e' }}>B2. Reference Checks with Previous Employer</h3>
                    <div className="cursor-help" title="Guidance for reference checks">
                      <Info className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                  
                  {/* B2.1 Reference checks completed */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <Label className="text-xs text-gray-500 tracking-wide flex-1 pr-4">
                        B2.1 Reference checks completed?
                      </Label>
                      <div className="flex items-center min-w-[300px]">
                        <div className="flex gap-6 w-[200px]">
                          <RadioGroup 
                            value={formData.b2ReferencesCompleted} 
                            onValueChange={(value) => setFormData(prev => ({ ...prev, b2ReferencesCompleted: value }))}
                            className="flex gap-6"
                          >
                            <div className="flex items-center space-x-2 w-[50px]">
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="yes" id="b2-completed-yes" />
                                <Label htmlFor="b2-completed-yes" className="text-sm cursor-pointer">Yes</Label>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 w-[50px]">
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="no" id="b2-completed-no" />
                                <Label htmlFor="b2-completed-no" className="text-sm cursor-pointer">No</Label>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 w-[50px]">
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="na" id="b2-completed-na" />
                                <Label htmlFor="b2-completed-na" className="text-sm cursor-pointer">NA</Label>
                              </div>
                            </div>
                          </RadioGroup>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 ml-4"
                          onClick={() => setNewB2Comment(prev => ({ ...prev, 'b2-completed': "" }))}
                          data-testid="button-b2-completed-comment"
                        >
                          <MessageSquare className="h-4 w-4 text-gray-400" />
                        </Button>
                      </div>
                    </div>

                    {/* Reference check entry fields - only show when B2.1 is Yes */}
                    {formData.b2ReferencesCompleted === 'yes' && (
                      <div className="ml-4 mb-4 space-y-3">
                        {formData.b2References.map((reference, index) => (
                          <div key={reference.id} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <Input
                                type="date"
                                placeholder="Date"
                                className="text-sm"
                                value={reference.date}
                                onChange={(e) => {
                                  setFormData(prev => ({
                                    ...prev,
                                    b2References: prev.b2References.map(ref => 
                                      ref.id === reference.id 
                                        ? { ...ref, date: e.target.value }
                                        : ref
                                    )
                                  }));
                                }}
                                data-testid={`input-b2-ref-date-${index}`}
                              />
                            </div>
                            <div>
                              <Input
                                type="text"
                                placeholder="Name & Designation"
                                className="text-sm"
                                value={reference.nameDesignation}
                                onChange={(e) => {
                                  setFormData(prev => ({
                                    ...prev,
                                    b2References: prev.b2References.map(ref => 
                                      ref.id === reference.id 
                                        ? { ...ref, nameDesignation: e.target.value }
                                        : ref
                                    )
                                  }));
                                }}
                                data-testid={`input-b2-ref-name-${index}`}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Input
                                type="text"
                                placeholder="Contact Info"
                                className="text-sm flex-1"
                                value={reference.contactInfo}
                                onChange={(e) => {
                                  setFormData(prev => ({
                                    ...prev,
                                    b2References: prev.b2References.map(ref => 
                                      ref.id === reference.id 
                                        ? { ...ref, contactInfo: e.target.value }
                                        : ref
                                    )
                                  }));
                                }}
                                data-testid={`input-b2-ref-contact-${index}`}
                              />
                              {index === formData.b2References.length - 1 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-10 w-10 p-0 border-gray-300"
                                  onClick={() => {
                                    const newId = String(Date.now());
                                    setFormData(prev => ({
                                      ...prev,
                                      b2References: [...prev.b2References, { 
                                        id: newId, 
                                        date: '', 
                                        nameDesignation: '', 
                                        contactInfo: '' 
                                      }]
                                    }));
                                  }}
                                  data-testid="button-add-b2-reference"
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              )}
                              {formData.b2References.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-10 w-10 p-0"
                                  onClick={() => {
                                    setFormData(prev => ({
                                      ...prev,
                                      b2References: prev.b2References.filter(ref => ref.id !== reference.id)
                                    }));
                                  }}
                                  data-testid={`button-remove-b2-ref-${index}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                              {formData.b2References.length === 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-10 w-10 p-0"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Comments for B2.1 */}
                    {(formData.b2Comments['b2-completed']?.length > 0 || newB2Comment['b2-completed'] !== undefined) && (
                      <div className="ml-4 mb-4 space-y-2">
                        {formData.b2Comments['b2-completed']?.map((comment) => (
                          <div key={comment.id} className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="text-blue-600 italic text-[13px] mb-2">{comment.user}:</div>
                              {editingB2Comment === comment.id ? (
                                <Textarea
                                  value={comment.text}
                                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                                    setFormData(prev => ({
                                      ...prev,
                                      b2Comments: {
                                        ...prev.b2Comments,
                                        'b2-completed': prev.b2Comments['b2-completed']?.map(c => 
                                          c.id === comment.id ? { ...c, text: e.target.value } : c
                                        ) || []
                                      }
                                    }));
                                  }}
                                  onBlur={() => setEditingB2Comment(null)}
                                  autoFocus
                                  className="min-h-[80px] w-full"
                                />
                              ) : (
                                <div 
                                  className="text-blue-600 italic text-[13px] p-1 cursor-pointer min-h-[20px] border border-transparent hover:border-gray-200 rounded"
                                  onClick={() => setEditingB2Comment(comment.id)}
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
                                  setFormData(prev => ({
                                    ...prev,
                                    b2Comments: {
                                      ...prev.b2Comments,
                                      'b2-completed': prev.b2Comments['b2-completed']?.filter(c => c.id !== comment.id) || []
                                    }
                                  }));
                                  if (editingB2Comment === comment.id) {
                                    setEditingB2Comment(null);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        
                        {newB2Comment['b2-completed'] !== undefined && (
                          <div>
                            <div className="text-sm font-medium text-gray-600 mb-2">{currentUserDisplay}</div>
                            <Textarea
                              value={newB2Comment['b2-completed']}
                              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                                setNewB2Comment(prev => ({ ...prev, 'b2-completed': e.target.value }));
                              }}
                              onBlur={() => {
                                if (newB2Comment['b2-completed']?.trim() && b2Uuid) {
                                  const commentId = Date.now().toString();
                                  const commentText = newB2Comment['b2-completed'];
                                  setFormData(prev => ({
                                    ...prev,
                                    b2Comments: {
                                      ...prev.b2Comments,
                                      'b2-completed': [
                                        ...(prev.b2Comments['b2-completed'] || []),
                                        { id: commentId, user: currentUserDisplay, text: commentText }
                                      ]
                                    }
                                  }));
                                  createB2CommentMutation.mutate({
                                    b2Uuid,
                                    data: { fieldKey: 'b2-completed', userUuid: currentUserDisplay, commentText }
                                  });
                                }
                                setNewB2Comment(prev => {
                                  const newState = { ...prev };
                                  delete newState['b2-completed'];
                                  return newState;
                                });
                              }}
                              placeholder="Comment: Add your observations here..."
                              className="text-blue-600 italic border-blue-200 text-[13px]"
                              rows={2}
                              autoFocus
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* B2.2 Reference checks results positive */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <Label className="text-xs text-gray-500 tracking-wide flex-1 pr-4">
                        B2.2 Reference checks results positive? If yes, record brief overview of verification in comment. If no state details.
                      </Label>
                      <div className="flex items-center min-w-[300px]">
                        <div className="flex gap-6 w-[200px]">
                          <RadioGroup 
                            value={formData.b2EmployerFeedback} 
                            onValueChange={(value) => setFormData(prev => ({ ...prev, b2EmployerFeedback: value }))}
                            className="flex gap-6"
                          >
                            <div className="flex items-center space-x-2 w-[50px]">
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="yes" id="b2-results-yes" />
                                <Label htmlFor="b2-results-yes" className="text-sm cursor-pointer">Yes</Label>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 w-[50px]">
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="no" id="b2-results-no" />
                                <Label htmlFor="b2-results-no" className="text-sm cursor-pointer">No</Label>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 w-[50px]">
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="na" id="b2-results-na" />
                                <Label htmlFor="b2-results-na" className="text-sm cursor-pointer">NA</Label>
                              </div>
                            </div>
                          </RadioGroup>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 ml-4"
                          onClick={() => setNewB2Comment(prev => ({ ...prev, 'b2-results': "" }))}
                          data-testid="button-b2-results-comment"
                        >
                          <MessageSquare className="h-4 w-4 text-gray-400" />
                        </Button>
                      </div>
                    </div>

                    {/* Comments for B2.2 */}
                    {(formData.b2Comments['b2-results']?.length > 0 || newB2Comment['b2-results'] !== undefined) && (
                      <div className="ml-4 mb-4 space-y-2">
                        {formData.b2Comments['b2-results']?.map((comment) => (
                          <div key={comment.id} className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="text-blue-600 italic text-[13px] mb-2">{comment.user}:</div>
                              {editingB2Comment === comment.id ? (
                                <Textarea
                                  value={comment.text}
                                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                                    setFormData(prev => ({
                                      ...prev,
                                      b2Comments: {
                                        ...prev.b2Comments,
                                        'b2-results': prev.b2Comments['b2-results']?.map(c => 
                                          c.id === comment.id ? { ...c, text: e.target.value } : c
                                        ) || []
                                      }
                                    }));
                                  }}
                                  onBlur={() => setEditingB2Comment(null)}
                                  autoFocus
                                  className="min-h-[80px] w-full"
                                />
                              ) : (
                                <div 
                                  className="text-blue-600 italic text-[13px] p-1 cursor-pointer min-h-[20px] border border-transparent hover:border-gray-200 rounded"
                                  onClick={() => setEditingB2Comment(comment.id)}
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
                                  setFormData(prev => ({
                                    ...prev,
                                    b2Comments: {
                                      ...prev.b2Comments,
                                      'b2-results': prev.b2Comments['b2-results']?.filter(c => c.id !== comment.id) || []
                                    }
                                  }));
                                  if (editingB2Comment === comment.id) {
                                    setEditingB2Comment(null);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        
                        {newB2Comment['b2-results'] !== undefined && (
                          <div>
                            <div className="text-sm font-medium text-gray-600 mb-2">{currentUserDisplay}</div>
                            <Textarea
                              value={newB2Comment['b2-results']}
                              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                                setNewB2Comment(prev => ({ ...prev, 'b2-results': e.target.value }));
                              }}
                              onBlur={() => {
                                if (newB2Comment['b2-results']?.trim() && b2Uuid) {
                                  const commentId = Date.now().toString();
                                  const commentText = newB2Comment['b2-results'];
                                  setFormData(prev => ({
                                    ...prev,
                                    b2Comments: {
                                      ...prev.b2Comments,
                                      'b2-results': [
                                        ...(prev.b2Comments['b2-results'] || []),
                                        { id: commentId, user: currentUserDisplay, text: commentText }
                                      ]
                                    }
                                  }));
                                  createB2CommentMutation.mutate({
                                    b2Uuid,
                                    data: { fieldKey: 'b2-results', userUuid: currentUserDisplay, commentText }
                                  });
                                }
                                setNewB2Comment(prev => {
                                  const newState = { ...prev };
                                  delete newState['b2-results'];
                                  return newState;
                                });
                              }}
                              placeholder="Comment: Add your observations here..."
                              className="text-blue-600 italic border-blue-200 text-[13px]"
                              rows={2}
                              autoFocus
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                    
                    {/* Attachment button */}
                    <div className="flex justify-start mt-6">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-gray-600 border-gray-300 hover:bg-gray-50"
                        onClick={() => openAttachmentDialog('b2', 'b2', 'B2. Reference Checks')}
                        data-testid="button-b2-attachments"
                      >
                        <Paperclip className="h-4 w-4 mr-2" />
                        Attachment(s)
                        {formData.b2Attachments?.length > 0 && (
                          <span className="ml-2 bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
                            {formData.b2Attachments.length}
                          </span>
                        )}
                      </Button>
                    </div>

                    {/* Submitted by section */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex justify-between items-center">
                        <div className="text-xs text-gray-500">
                          {formData.b2SubmittedBy ? (
                            <>
                              <span className="font-medium">Submitted by:</span> {formData.b2SubmittedBy}
                              {formData.b2SubmittedDate && ` on ${formData.b2SubmittedDate}`}
                            </>
                          ) : (
                            <span className="text-gray-400">Not yet submitted</span>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => {
                            const currentDate = new Date().toLocaleDateString();
                            setFormData(prev => ({ ...prev, b2SubmittedBy: currentUserDisplay, b2SubmittedDate: currentDate }));
                            setTimeout(() => handleSaveScreening(), 100);
                          }}
                          data-testid="button-b2-submit"
                        >
                          Submit
                        </Button>
                      </div>
                    </div>
                </div>

                {/* B3. Background Security Checks - matching legacy exactly */}
                <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-base font-medium" style={{ color: '#16569e' }}>B3. Background Security Checks</h3>
                    <div className="cursor-help" title="Guidance for background security checks process">
                      <Info className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    {/* B3.1 Background security checks completed */}
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <Label className="text-xs text-gray-500 tracking-wide flex-1 pr-4">
                          B3.1 Background security checks completed?
                        </Label>
                        <div className="flex items-center min-w-[300px]">
                          <div className="flex gap-6 w-[200px]">
                            <RadioGroup 
                              value={formData.b3ChecksCompleted} 
                              onValueChange={(value) => setFormData(prev => ({ ...prev, b3ChecksCompleted: value }))}
                              className="flex gap-6"
                            >
                              <div className="flex items-center space-x-2 w-[50px]">
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="yes" id="b3-completed-yes" />
                                  <Label htmlFor="b3-completed-yes" className="text-sm cursor-pointer">Yes</Label>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2 w-[50px]">
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="no" id="b3-completed-no" />
                                  <Label htmlFor="b3-completed-no" className="text-sm cursor-pointer">No</Label>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2 w-[50px]">
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="na" id="b3-completed-na" />
                                  <Label htmlFor="b3-completed-na" className="text-sm cursor-pointer">NA</Label>
                                </div>
                              </div>
                            </RadioGroup>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 ml-4"
                            onClick={() => setNewB3Comment(prev => ({ ...prev, 'b3-completed': "" }))}
                            data-testid="button-b3-completed-comment"
                          >
                            <MessageSquare className="h-4 w-4 text-gray-400" />
                          </Button>
                        </div>
                      </div>

                      {/* Authority details when Yes is selected */}
                      {formData.b3ChecksCompleted === 'yes' && (
                        <div className="ml-4 mb-4 space-y-3">
                          {formData.b3Authorities.map((authority, index) => (
                            <div key={authority.id} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <Input
                                  type="date"
                                  placeholder="Date"
                                  className="text-sm"
                                  value={authority.date}
                                  onChange={(e) => {
                                    setFormData(prev => ({
                                      ...prev,
                                      b3Authorities: prev.b3Authorities.map(auth => 
                                        auth.id === authority.id 
                                          ? { ...auth, date: e.target.value }
                                          : auth
                                      )
                                    }));
                                  }}
                                  data-testid={`input-b3-auth-date-${index}`}
                                />
                              </div>
                              <div className="flex gap-2">
                                <Input
                                  type="text"
                                  placeholder="Authority Involved"
                                  className="text-sm flex-1"
                                  value={authority.authority}
                                  onChange={(e) => {
                                    setFormData(prev => ({
                                      ...prev,
                                      b3Authorities: prev.b3Authorities.map(auth => 
                                        auth.id === authority.id 
                                          ? { ...auth, authority: e.target.value }
                                          : auth
                                      )
                                    }));
                                  }}
                                  data-testid={`input-b3-auth-name-${index}`}
                                />
                                {index === formData.b3Authorities.length - 1 && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-10 w-10 p-0 border-gray-300"
                                    onClick={() => {
                                      const newId = String(Date.now());
                                      setFormData(prev => ({
                                        ...prev,
                                        b3Authorities: [...prev.b3Authorities, { 
                                          id: newId, 
                                          date: '', 
                                          authority: '' 
                                        }]
                                      }));
                                    }}
                                    data-testid="button-add-b3-authority"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                )}
                                {formData.b3Authorities.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-10 w-10 p-0"
                                    onClick={() => {
                                      setFormData(prev => ({
                                        ...prev,
                                        b3Authorities: prev.b3Authorities.filter(auth => auth.id !== authority.id)
                                      }));
                                    }}
                                    data-testid={`button-remove-b3-auth-${index}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                                {formData.b3Authorities.length === 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-10 w-10 p-0"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Comments for B3.1 */}
                      {(formData.b3Comments['b3-completed']?.length > 0 || newB3Comment['b3-completed'] !== undefined) && (
                        <div className="ml-4 mb-4 space-y-2">
                          {formData.b3Comments['b3-completed']?.map((comment) => (
                            <div key={comment.id} className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="text-blue-600 italic text-[13px] mb-2">{comment.user}:</div>
                                {editingB3Comment === comment.id ? (
                                  <Textarea
                                    value={comment.text}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                                      setFormData(prev => ({
                                        ...prev,
                                        b3Comments: {
                                          ...prev.b3Comments,
                                          'b3-completed': prev.b3Comments['b3-completed']?.map(c => 
                                            c.id === comment.id ? { ...c, text: e.target.value } : c
                                          ) || []
                                        }
                                      }));
                                    }}
                                    onBlur={() => setEditingB3Comment(null)}
                                    autoFocus
                                    className="min-h-[80px] w-full"
                                  />
                                ) : (
                                  <div 
                                    className="text-blue-600 italic text-[13px] p-1 cursor-pointer min-h-[20px] border border-transparent hover:border-gray-200 rounded"
                                    onClick={() => setEditingB3Comment(comment.id)}
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
                                    setFormData(prev => ({
                                      ...prev,
                                      b3Comments: {
                                        ...prev.b3Comments,
                                        'b3-completed': prev.b3Comments['b3-completed']?.filter(c => c.id !== comment.id) || []
                                      }
                                    }));
                                    if (editingB3Comment === comment.id) {
                                      setEditingB3Comment(null);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          
                          {newB3Comment['b3-completed'] !== undefined && (
                            <div>
                              <div className="text-sm font-medium text-gray-600 mb-2">{currentUserDisplay}</div>
                              <Textarea
                                value={newB3Comment['b3-completed']}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                                  setNewB3Comment(prev => ({ ...prev, 'b3-completed': e.target.value }));
                                }}
                                onBlur={() => {
                                  if (newB3Comment['b3-completed']?.trim() && b3Uuid) {
                                    const commentId = Date.now().toString();
                                    const commentText = newB3Comment['b3-completed'];
                                    setFormData(prev => ({
                                      ...prev,
                                      b3Comments: {
                                        ...prev.b3Comments,
                                        'b3-completed': [
                                          ...(prev.b3Comments['b3-completed'] || []),
                                          { id: commentId, user: currentUserDisplay, text: commentText }
                                        ]
                                      }
                                    }));
                                    createB3CommentMutation.mutate({
                                      b3Uuid,
                                      data: { fieldKey: 'b3-completed', userUuid: currentUserDisplay, commentText }
                                    });
                                  }
                                  setNewB3Comment(prev => {
                                    const newState = { ...prev };
                                    delete newState['b3-completed'];
                                    return newState;
                                  });
                                }}
                                placeholder="Comment: Add your observations here..."
                                className="text-blue-600 italic border-blue-200 text-[13px]"
                                rows={2}
                                autoFocus
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* B3.2 Background Security checks results positive */}
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <Label className="text-xs text-gray-500 tracking-wide flex-1 pr-4">
                          B3.2 Background Security checks results positive? If yes, record brief overview of verification. If no state details.
                        </Label>
                        <div className="flex items-center min-w-[300px]">
                          <div className="flex gap-6 w-[200px]">
                            <RadioGroup 
                              value={formData.b3Results} 
                              onValueChange={(value) => setFormData(prev => ({ ...prev, b3Results: value }))}
                              className="flex gap-6"
                            >
                              <div className="flex items-center space-x-2 w-[50px]">
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="yes" id="b3-results-yes" />
                                  <Label htmlFor="b3-results-yes" className="text-sm cursor-pointer">Yes</Label>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2 w-[50px]">
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="no" id="b3-results-no" />
                                  <Label htmlFor="b3-results-no" className="text-sm cursor-pointer">No</Label>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2 w-[50px]">
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="na" id="b3-results-na" />
                                  <Label htmlFor="b3-results-na" className="text-sm cursor-pointer">NA</Label>
                                </div>
                              </div>
                            </RadioGroup>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 ml-4"
                            onClick={() => setNewB3Comment(prev => ({ ...prev, 'b3-results': "" }))}
                            data-testid="button-b3-results-comment"
                          >
                            <MessageSquare className="h-4 w-4 text-gray-400" />
                          </Button>
                        </div>
                      </div>

                      {/* Comments for B3.2 */}
                      {(formData.b3Comments['b3-results']?.length > 0 || newB3Comment['b3-results'] !== undefined) && (
                        <div className="ml-4 mb-4 space-y-2">
                          {formData.b3Comments['b3-results']?.map((comment) => (
                            <div key={comment.id} className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="text-blue-600 italic text-[13px] mb-2">{comment.user}:</div>
                                {editingB3Comment === comment.id ? (
                                  <Textarea
                                    value={comment.text}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                                      setFormData(prev => ({
                                        ...prev,
                                        b3Comments: {
                                          ...prev.b3Comments,
                                          'b3-results': prev.b3Comments['b3-results']?.map(c => 
                                            c.id === comment.id ? { ...c, text: e.target.value } : c
                                          ) || []
                                        }
                                      }));
                                    }}
                                    onBlur={() => setEditingB3Comment(null)}
                                    autoFocus
                                    className="min-h-[80px] w-full"
                                  />
                                ) : (
                                  <div 
                                    className="text-blue-600 italic text-[13px] p-1 cursor-pointer min-h-[20px] border border-transparent hover:border-gray-200 rounded"
                                    onClick={() => setEditingB3Comment(comment.id)}
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
                                    setFormData(prev => ({
                                      ...prev,
                                      b3Comments: {
                                        ...prev.b3Comments,
                                        'b3-results': prev.b3Comments['b3-results']?.filter(c => c.id !== comment.id) || []
                                      }
                                    }));
                                    if (editingB3Comment === comment.id) {
                                      setEditingB3Comment(null);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          
                          {newB3Comment['b3-results'] !== undefined && (
                            <div>
                              <div className="text-sm font-medium text-gray-600 mb-2">{currentUserDisplay}</div>
                              <Textarea
                                value={newB3Comment['b3-results']}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                                  setNewB3Comment(prev => ({ ...prev, 'b3-results': e.target.value }));
                                }}
                                onBlur={() => {
                                  if (newB3Comment['b3-results']?.trim() && b3Uuid) {
                                    const commentId = Date.now().toString();
                                    const commentText = newB3Comment['b3-results'];
                                    setFormData(prev => ({
                                      ...prev,
                                      b3Comments: {
                                        ...prev.b3Comments,
                                        'b3-results': [
                                          ...(prev.b3Comments['b3-results'] || []),
                                          { id: commentId, user: currentUserDisplay, text: commentText }
                                        ]
                                      }
                                    }));
                                    createB3CommentMutation.mutate({
                                      b3Uuid,
                                      data: { fieldKey: 'b3-results', userUuid: currentUserDisplay, commentText }
                                    });
                                  }
                                  setNewB3Comment(prev => {
                                    const newState = { ...prev };
                                    delete newState['b3-results'];
                                    return newState;
                                  });
                                }}
                                placeholder="Comment: Add your observations here..."
                                className="text-blue-600 italic border-blue-200 text-[13px]"
                                rows={2}
                                autoFocus
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Attachment button */}
                    <div className="flex justify-start">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-gray-600 border-gray-300 hover:bg-gray-50"
                        onClick={() => openAttachmentDialog('b3', 'b3', 'B3. Background Security Checks')}
                        data-testid="button-b3-attachments"
                      >
                        <Paperclip className="h-4 w-4 mr-2" />
                        Attachment(s)
                        {formData.b3Attachments?.length > 0 && (
                          <span className="ml-2 bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
                            {formData.b3Attachments.length}
                          </span>
                        )}
                      </Button>
                    </div>

                    {/* Submitted by section */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex justify-between items-center">
                        <div className="text-xs text-gray-500">
                          {formData.b3SubmittedBy ? (
                            <>
                              <span className="font-medium">Submitted by:</span> {formData.b3SubmittedBy}
                              {formData.b3SubmittedDate && ` on ${formData.b3SubmittedDate}`}
                            </>
                          ) : (
                            <span className="text-gray-400">Not yet submitted</span>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => {
                            const currentDate = new Date().toLocaleDateString();
                            setFormData(prev => ({ ...prev, b3SubmittedBy: currentUserDisplay, b3SubmittedDate: currentDate }));
                            setTimeout(() => handleSaveScreening(), 100);
                          }}
                          data-testid="button-b3-submit"
                        >
                          Submit
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* B4. Authentication of Certificates & Documents - matching legacy exactly */}
                <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-base font-medium" style={{ color: '#16569e' }}>B4. Authentication of Certificates & Documents</h3>
                    <div className="cursor-help" title="Guidance for certificate authentication process">
                      <Info className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    {/* B4.1 Certificates & Documents Authenticated */}
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <Label className="text-xs text-gray-500 tracking-wide flex-1 pr-4">
                          B4.1 Certificates & Documents Authenticated?
                        </Label>
                        <div className="flex items-center min-w-[300px]">
                          <div className="flex gap-6 w-[200px]">
                            <RadioGroup 
                              value={formData.b4CertificatesAuthenticated} 
                              onValueChange={(value) => setFormData(prev => ({ ...prev, b4CertificatesAuthenticated: value }))}
                              className="flex gap-6"
                            >
                              <div className="flex items-center space-x-2 w-[50px]">
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="yes" id="b4-authenticated-yes" />
                                  <Label htmlFor="b4-authenticated-yes" className="text-sm cursor-pointer">Yes</Label>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2 w-[50px]">
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="no" id="b4-authenticated-no" />
                                  <Label htmlFor="b4-authenticated-no" className="text-sm cursor-pointer">No</Label>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2 w-[50px]">
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="na" id="b4-authenticated-na" />
                                  <Label htmlFor="b4-authenticated-na" className="text-sm cursor-pointer">NA</Label>
                                </div>
                              </div>
                            </RadioGroup>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 ml-4"
                            onClick={() => setNewB4Comment(prev => ({ ...prev, 'b4-authenticated': "" }))}
                            data-testid="button-b4-authenticated-comment"
                          >
                            <MessageSquare className="h-4 w-4 text-gray-400" />
                          </Button>
                        </div>
                      </div>

                      {/* Certificate details when Yes is selected */}
                      {formData.b4CertificatesAuthenticated === 'yes' && (
                        <div className="ml-4 mb-4 space-y-3">
                          {formData.b4Certs.map((certificate, index) => (
                            <div key={certificate.id} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <Input
                                  type="date"
                                  placeholder="Date"
                                  className="text-sm"
                                  value={certificate.date}
                                  onChange={(e) => {
                                    setFormData(prev => ({
                                      ...prev,
                                      b4Certs: prev.b4Certs.map(cert => 
                                        cert.id === certificate.id 
                                          ? { ...cert, date: e.target.value }
                                          : cert
                                      )
                                    }));
                                  }}
                                  data-testid={`input-b4-cert-date-${index}`}
                                />
                              </div>
                              <div>
                                <Input
                                  type="text"
                                  placeholder="Certificate or Document"
                                  className="text-sm"
                                  value={certificate.certificate}
                                  onChange={(e) => {
                                    setFormData(prev => ({
                                      ...prev,
                                      b4Certs: prev.b4Certs.map(cert => 
                                        cert.id === certificate.id 
                                          ? { ...cert, certificate: e.target.value }
                                          : cert
                                      )
                                    }));
                                  }}
                                  data-testid={`input-b4-cert-name-${index}`}
                                />
                              </div>
                              <div className="flex gap-2">
                                <Input
                                  type="text"
                                  placeholder="Authority Involved"
                                  className="text-sm flex-1"
                                  value={certificate.authority}
                                  onChange={(e) => {
                                    setFormData(prev => ({
                                      ...prev,
                                      b4Certs: prev.b4Certs.map(cert => 
                                        cert.id === certificate.id 
                                          ? { ...cert, authority: e.target.value }
                                          : cert
                                      )
                                    }));
                                  }}
                                  data-testid={`input-b4-cert-auth-${index}`}
                                />
                                {index === formData.b4Certs.length - 1 && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-10 w-10 p-0 border-gray-300"
                                    onClick={() => {
                                      const newId = String(Date.now());
                                      setFormData(prev => ({
                                        ...prev,
                                        b4Certs: [...prev.b4Certs, { 
                                          id: newId, 
                                          date: '', 
                                          certificate: '',
                                          authority: '' 
                                        }]
                                      }));
                                    }}
                                    data-testid="button-add-b4-cert"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                )}
                                {formData.b4Certs.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-10 w-10 p-0"
                                    onClick={() => {
                                      setFormData(prev => ({
                                        ...prev,
                                        b4Certs: prev.b4Certs.filter(cert => cert.id !== certificate.id)
                                      }));
                                    }}
                                    data-testid={`button-remove-b4-cert-${index}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                                {formData.b4Certs.length === 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-10 w-10 p-0"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Comments for B4.1 */}
                      {(formData.b4Comments['b4-authenticated']?.length > 0 || newB4Comment['b4-authenticated'] !== undefined) && (
                        <div className="ml-4 mb-4 space-y-2">
                          {formData.b4Comments['b4-authenticated']?.map((comment) => (
                            <div key={comment.id} className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="text-blue-600 italic text-[13px] mb-2">{comment.user}:</div>
                                {editingB4Comment === comment.id ? (
                                  <Textarea
                                    value={comment.text}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                                      setFormData(prev => ({
                                        ...prev,
                                        b4Comments: {
                                          ...prev.b4Comments,
                                          'b4-authenticated': prev.b4Comments['b4-authenticated']?.map(c => 
                                            c.id === comment.id ? { ...c, text: e.target.value } : c
                                          ) || []
                                        }
                                      }));
                                    }}
                                    onBlur={() => setEditingB4Comment(null)}
                                    autoFocus
                                    className="min-h-[80px] w-full"
                                  />
                                ) : (
                                  <div 
                                    className="text-blue-600 italic text-[13px] p-1 cursor-pointer min-h-[20px] border border-transparent hover:border-gray-200 rounded"
                                    onClick={() => setEditingB4Comment(comment.id)}
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
                                    setFormData(prev => ({
                                      ...prev,
                                      b4Comments: {
                                        ...prev.b4Comments,
                                        'b4-authenticated': prev.b4Comments['b4-authenticated']?.filter(c => c.id !== comment.id) || []
                                      }
                                    }));
                                    if (editingB4Comment === comment.id) {
                                      setEditingB4Comment(null);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          
                          {newB4Comment['b4-authenticated'] !== undefined && (
                            <div>
                              <div className="text-sm font-medium text-gray-600 mb-2">{currentUserDisplay}</div>
                              <Textarea
                                value={newB4Comment['b4-authenticated']}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                                  setNewB4Comment(prev => ({ ...prev, 'b4-authenticated': e.target.value }));
                                }}
                                onBlur={() => {
                                  if (newB4Comment['b4-authenticated']?.trim() && b4Uuid) {
                                    const commentId = Date.now().toString();
                                    const commentText = newB4Comment['b4-authenticated'];
                                    setFormData(prev => ({
                                      ...prev,
                                      b4Comments: {
                                        ...prev.b4Comments,
                                        'b4-authenticated': [
                                          ...(prev.b4Comments['b4-authenticated'] || []),
                                          { id: commentId, user: currentUserDisplay, text: commentText }
                                        ]
                                      }
                                    }));
                                    createB4CommentMutation.mutate({
                                      b4Uuid,
                                      data: { fieldKey: 'b4-authenticated', userUuid: currentUserDisplay, commentText }
                                    });
                                  }
                                  setNewB4Comment(prev => {
                                    const newState = { ...prev };
                                    delete newState['b4-authenticated'];
                                    return newState;
                                  });
                                }}
                                placeholder="Comment: Add your observations here..."
                                className="text-blue-600 italic border-blue-200 text-[13px]"
                                rows={2}
                                autoFocus
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* B4.2 Authentication checks results positive */}
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <Label className="text-xs text-gray-500 tracking-wide flex-1 pr-4">
                          B4.2 Authentication checks results positive? If yes, record brief overview of verification in comment. If no state details
                        </Label>
                        <div className="flex items-center min-w-[300px]">
                          <div className="flex gap-6 w-[200px]">
                            <RadioGroup 
                              value={formData.b4Results} 
                              onValueChange={(value) => setFormData(prev => ({ ...prev, b4Results: value }))}
                              className="flex gap-6"
                            >
                              <div className="flex items-center space-x-2 w-[50px]">
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="yes" id="b4-results-yes" />
                                  <Label htmlFor="b4-results-yes" className="text-sm cursor-pointer">Yes</Label>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2 w-[50px]">
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="no" id="b4-results-no" />
                                  <Label htmlFor="b4-results-no" className="text-sm cursor-pointer">No</Label>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2 w-[50px]">
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="na" id="b4-results-na" />
                                  <Label htmlFor="b4-results-na" className="text-sm cursor-pointer">NA</Label>
                                </div>
                              </div>
                            </RadioGroup>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 ml-4"
                            onClick={() => setNewB4Comment(prev => ({ ...prev, 'b4-results': "" }))}
                            data-testid="button-b4-results-comment"
                          >
                            <MessageSquare className="h-4 w-4 text-gray-400" />
                          </Button>
                        </div>
                      </div>

                      {/* Comments for B4.2 */}
                      {(formData.b4Comments['b4-results']?.length > 0 || newB4Comment['b4-results'] !== undefined) && (
                        <div className="ml-4 mb-4 space-y-2">
                          {formData.b4Comments['b4-results']?.map((comment) => (
                            <div key={comment.id} className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="text-blue-600 italic text-[13px] mb-2">{comment.user}:</div>
                                {editingB4Comment === comment.id ? (
                                  <Textarea
                                    value={comment.text}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                                      setFormData(prev => ({
                                        ...prev,
                                        b4Comments: {
                                          ...prev.b4Comments,
                                          'b4-results': prev.b4Comments['b4-results']?.map(c => 
                                            c.id === comment.id ? { ...c, text: e.target.value } : c
                                          ) || []
                                        }
                                      }));
                                    }}
                                    onBlur={() => setEditingB4Comment(null)}
                                    autoFocus
                                    className="min-h-[80px] w-full"
                                  />
                                ) : (
                                  <div 
                                    className="text-blue-600 italic text-[13px] p-1 cursor-pointer min-h-[20px] border border-transparent hover:border-gray-200 rounded"
                                    onClick={() => setEditingB4Comment(comment.id)}
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
                                    setFormData(prev => ({
                                      ...prev,
                                      b4Comments: {
                                        ...prev.b4Comments,
                                        'b4-results': prev.b4Comments['b4-results']?.filter(c => c.id !== comment.id) || []
                                      }
                                    }));
                                    if (editingB4Comment === comment.id) {
                                      setEditingB4Comment(null);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          
                          {newB4Comment['b4-results'] !== undefined && (
                            <div>
                              <div className="text-sm font-medium text-gray-600 mb-2">{currentUserDisplay}</div>
                              <Textarea
                                value={newB4Comment['b4-results']}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                                  setNewB4Comment(prev => ({ ...prev, 'b4-results': e.target.value }));
                                }}
                                onBlur={() => {
                                  if (newB4Comment['b4-results']?.trim() && b4Uuid) {
                                    const commentId = Date.now().toString();
                                    const commentText = newB4Comment['b4-results'];
                                    setFormData(prev => ({
                                      ...prev,
                                      b4Comments: {
                                        ...prev.b4Comments,
                                        'b4-results': [
                                          ...(prev.b4Comments['b4-results'] || []),
                                          { id: commentId, user: currentUserDisplay, text: commentText }
                                        ]
                                      }
                                    }));
                                    createB4CommentMutation.mutate({
                                      b4Uuid,
                                      data: { fieldKey: 'b4-results', userUuid: currentUserDisplay, commentText }
                                    });
                                  }
                                  setNewB4Comment(prev => {
                                    const newState = { ...prev };
                                    delete newState['b4-results'];
                                    return newState;
                                  });
                                }}
                                placeholder="Comment: Add your observations here..."
                                className="text-blue-600 italic border-blue-200 text-[13px]"
                                rows={2}
                                autoFocus
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Attachment button */}
                    <div className="flex justify-start">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-gray-600 border-gray-300 hover:bg-gray-50"
                        onClick={() => openAttachmentDialog('b4', 'b4', 'B4. Authentication of Certificates & Documents')}
                        data-testid="button-b4-attachments"
                      >
                        <Paperclip className="h-4 w-4 mr-2" />
                        Attachment(s)
                        {formData.b4Attachments?.length > 0 && (
                          <span className="ml-2 bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
                            {formData.b4Attachments.length}
                          </span>
                        )}
                      </Button>
                    </div>

                    {/* Submitted by section */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex justify-between items-center">
                        <div className="text-xs text-gray-500">
                          {formData.b4SubmittedBy ? (
                            <>
                              <span className="font-medium">Submitted by:</span> {formData.b4SubmittedBy}
                              {formData.b4SubmittedDate && ` on ${formData.b4SubmittedDate}`}
                            </>
                          ) : (
                            <span className="text-gray-400">Not yet submitted</span>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => {
                            const currentDate = new Date().toLocaleDateString();
                            setFormData(prev => ({ ...prev, b4SubmittedBy: currentUserDisplay, b4SubmittedDate: currentDate }));
                            setTimeout(() => handleSaveScreening(), 100);
                          }}
                          data-testid="button-b4-submit"
                        >
                          Submit
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* B5. CES / Language Test Results - matching legacy exactly */}
                <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-base font-medium" style={{ color: '#16569e' }}>B5. CES / Language Test Results</h3>
                    <div className="cursor-help" title="Guidance for CES/Language Test process">
                      <Info className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    {/* B5.1 Applicable CES / Language Tests completed */}
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <Label className="text-xs text-gray-500 tracking-wide flex-1 pr-4">
                          B5.1 Applicable CES / Language Tests completed?
                        </Label>
                        <div className="flex items-center min-w-[300px]">
                          <div className="flex gap-6 w-[200px]">
                            <RadioGroup 
                              value={formData.b5TestsCompleted} 
                              onValueChange={(value) => setFormData(prev => ({ ...prev, b5TestsCompleted: value }))}
                              className="flex gap-6"
                            >
                              <div className="flex items-center space-x-2 w-[50px]">
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="yes" id="b5-completed-yes" />
                                  <Label htmlFor="b5-completed-yes" className="text-sm cursor-pointer">Yes</Label>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2 w-[50px]">
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="no" id="b5-completed-no" />
                                  <Label htmlFor="b5-completed-no" className="text-sm cursor-pointer">No</Label>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2 w-[50px]">
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="na" id="b5-completed-na" />
                                  <Label htmlFor="b5-completed-na" className="text-sm cursor-pointer">NA</Label>
                                </div>
                              </div>
                            </RadioGroup>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 ml-4"
                            onClick={() => setNewB5Comment(prev => ({ ...prev, 'b5-completed': "" }))}
                            data-testid="button-b5-completed-comment"
                          >
                            <MessageSquare className="h-4 w-4 text-gray-400" />
                          </Button>
                        </div>
                      </div>

                      {/* Test details when Yes is selected */}
                      {formData.b5TestsCompleted === 'yes' && (
                        <div className="ml-4 mb-4 space-y-3">
                          {formData.b5Tests.map((test, index) => (
                            <div key={test.id} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <div>
                                <Input
                                  type="date"
                                  placeholder="Date"
                                  className="text-sm"
                                  value={test.date}
                                  onChange={(e) => {
                                    setFormData(prev => ({
                                      ...prev,
                                      b5Tests: prev.b5Tests.map(t => 
                                        t.id === test.id 
                                          ? { ...t, date: e.target.value }
                                          : t
                                      )
                                    }));
                                  }}
                                  data-testid={`input-b5-test-date-${index}`}
                                />
                              </div>
                              <div>
                                <Select
                                  value={test.subject}
                                  onValueChange={(value) => {
                                    setFormData(prev => ({
                                      ...prev,
                                      b5Tests: prev.b5Tests.map(t => 
                                        t.id === test.id 
                                          ? { ...t, subject: value }
                                          : t
                                      )
                                    }));
                                  }}
                                >
                                  <SelectTrigger className="text-sm" data-testid={`select-b5-test-subject-${index}`}>
                                    <SelectValue placeholder="Subject" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="English">English</SelectItem>
                                    <SelectItem value="Navigation">Navigation</SelectItem>
                                    <SelectItem value="Seamanship">Seamanship</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Input
                                  type="text"
                                  placeholder="Score"
                                  className="text-sm"
                                  value={test.score}
                                  onChange={(e) => {
                                    setFormData(prev => ({
                                      ...prev,
                                      b5Tests: prev.b5Tests.map(t => 
                                        t.id === test.id 
                                          ? { ...t, score: e.target.value }
                                          : t
                                      )
                                    }));
                                  }}
                                  data-testid={`input-b5-test-score-${index}`}
                                />
                              </div>
                              <div className="flex gap-2">
                                <Select
                                  value={test.result}
                                  onValueChange={(value) => {
                                    setFormData(prev => ({
                                      ...prev,
                                      b5Tests: prev.b5Tests.map(t => 
                                        t.id === test.id 
                                          ? { ...t, result: value }
                                          : t
                                      )
                                    }));
                                  }}
                                >
                                  <SelectTrigger className="text-sm flex-1" data-testid={`select-b5-test-result-${index}`}>
                                    <SelectValue placeholder="Result" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Pass">Pass</SelectItem>
                                    <SelectItem value="Fail">Fail</SelectItem>
                                    <SelectItem value="Pending">Pending</SelectItem>
                                  </SelectContent>
                                </Select>
                                {index === formData.b5Tests.length - 1 && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-10 w-10 p-0 border-gray-300"
                                    onClick={() => {
                                      const newId = String(Date.now());
                                      setFormData(prev => ({
                                        ...prev,
                                        b5Tests: [...prev.b5Tests, { 
                                          id: newId, 
                                          date: '', 
                                          subject: '',
                                          score: '',
                                          result: '' 
                                        }]
                                      }));
                                    }}
                                    data-testid="button-add-b5-test"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                )}
                                {formData.b5Tests.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-10 w-10 p-0"
                                    onClick={() => {
                                      setFormData(prev => ({
                                        ...prev,
                                        b5Tests: prev.b5Tests.filter(t => t.id !== test.id)
                                      }));
                                    }}
                                    data-testid={`button-remove-b5-test-${index}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                                {formData.b5Tests.length === 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-10 w-10 p-0"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Comments for B5.1 */}
                      {(formData.b5Comments['b5-completed']?.length > 0 || newB5Comment['b5-completed'] !== undefined) && (
                        <div className="ml-4 mb-4 space-y-2">
                          {formData.b5Comments['b5-completed']?.map((comment) => (
                            <div key={comment.id} className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="text-blue-600 italic text-[13px] mb-2">{comment.user}:</div>
                                {editingB5Comment === comment.id ? (
                                  <Textarea
                                    value={comment.text}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                                      setFormData(prev => ({
                                        ...prev,
                                        b5Comments: {
                                          ...prev.b5Comments,
                                          'b5-completed': prev.b5Comments['b5-completed']?.map(c => 
                                            c.id === comment.id ? { ...c, text: e.target.value } : c
                                          ) || []
                                        }
                                      }));
                                    }}
                                    onBlur={() => setEditingB5Comment(null)}
                                    autoFocus
                                    className="min-h-[80px] w-full"
                                  />
                                ) : (
                                  <div 
                                    className="text-blue-600 italic text-[13px] p-1 cursor-pointer min-h-[20px] border border-transparent hover:border-gray-200 rounded"
                                    onClick={() => setEditingB5Comment(comment.id)}
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
                                    setFormData(prev => ({
                                      ...prev,
                                      b5Comments: {
                                        ...prev.b5Comments,
                                        'b5-completed': prev.b5Comments['b5-completed']?.filter(c => c.id !== comment.id) || []
                                      }
                                    }));
                                    if (editingB5Comment === comment.id) {
                                      setEditingB5Comment(null);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          
                          {newB5Comment['b5-completed'] !== undefined && (
                            <div>
                              <div className="text-sm font-medium text-gray-600 mb-2">{currentUserDisplay}</div>
                              <Textarea
                                value={newB5Comment['b5-completed']}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                                  setNewB5Comment(prev => ({ ...prev, 'b5-completed': e.target.value }));
                                }}
                                onBlur={() => {
                                  if (newB5Comment['b5-completed']?.trim() && b5Uuid) {
                                    const commentId = Date.now().toString();
                                    const commentText = newB5Comment['b5-completed'];
                                    setFormData(prev => ({
                                      ...prev,
                                      b5Comments: {
                                        ...prev.b5Comments,
                                        'b5-completed': [
                                          ...(prev.b5Comments['b5-completed'] || []),
                                          { id: commentId, user: currentUserDisplay, text: commentText }
                                        ]
                                      }
                                    }));
                                    createB5CommentMutation.mutate({
                                      b5Uuid,
                                      data: { fieldKey: 'b5-completed', userUuid: currentUserDisplay, commentText }
                                    });
                                  }
                                  setNewB5Comment(prev => {
                                    const newState = { ...prev };
                                    delete newState['b5-completed'];
                                    return newState;
                                  });
                                }}
                                placeholder="Comment: Add your observations here..."
                                className="text-blue-600 italic border-blue-200 text-[13px]"
                                rows={2}
                                autoFocus
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Attachment button */}
                    <div className="flex justify-start">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-gray-600 border-gray-300 hover:bg-gray-50"
                        onClick={() => openAttachmentDialog('b5', 'b5', 'B5. CES / Language Test Results')}
                        data-testid="button-b5-attachments"
                      >
                        <Paperclip className="h-4 w-4 mr-2" />
                        Attachment(s)
                        {formData.b5Attachments?.length > 0 && (
                          <span className="ml-2 bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
                            {formData.b5Attachments.length}
                          </span>
                        )}
                      </Button>
                    </div>

                    {/* Submitted by section */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex justify-between items-center">
                        <div className="text-xs text-gray-500">
                          {formData.b5SubmittedBy ? (
                            <>
                              <span className="font-medium">Submitted by:</span> {formData.b5SubmittedBy}
                              {formData.b5SubmittedDate && ` on ${formData.b5SubmittedDate}`}
                            </>
                          ) : (
                            <span className="text-gray-400">Not yet submitted</span>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => {
                            const currentDate = new Date().toLocaleDateString();
                            setFormData(prev => ({ ...prev, b5SubmittedBy: currentUserDisplay, b5SubmittedDate: currentDate }));
                            setTimeout(() => handleSaveScreening(), 100);
                          }}
                          data-testid="button-b5-submit"
                        >
                          Submit
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* B6. Interview(s) - matching legacy exactly */}
                <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-base font-medium" style={{ color: '#16569e' }}>B6. Interview(s)</h3>
                    <div className="cursor-help" title="Guidance for interview process">
                      <Info className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    {/* B6.1 Interview completed */}
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <Label className="text-xs text-gray-500 tracking-wide flex-1 pr-4">
                          B6.1 Interview completed?
                        </Label>
                        <div className="flex items-center min-w-[300px]">
                          <div className="flex gap-6 w-[200px]">
                            <RadioGroup 
                              value={formData.b6InterviewCompleted} 
                              onValueChange={(value) => setFormData(prev => ({ ...prev, b6InterviewCompleted: value }))}
                              className="flex gap-6"
                            >
                              <div className="flex items-center space-x-2 w-[50px]">
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="yes" id="b6-completed-yes" />
                                  <Label htmlFor="b6-completed-yes" className="text-sm cursor-pointer">Yes</Label>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2 w-[50px]">
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="no" id="b6-completed-no" />
                                  <Label htmlFor="b6-completed-no" className="text-sm cursor-pointer">No</Label>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2 w-[50px]">
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="na" id="b6-completed-na" />
                                  <Label htmlFor="b6-completed-na" className="text-sm cursor-pointer">NA</Label>
                                </div>
                              </div>
                            </RadioGroup>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 ml-4"
                            onClick={() => setNewB6Comment(prev => ({ ...prev, 'b6-completed': "" }))}
                            data-testid="button-b6-completed-comment"
                          >
                            <MessageSquare className="h-4 w-4 text-gray-400" />
                          </Button>
                        </div>
                      </div>

                      {/* Interview details when Yes is selected */}
                      {formData.b6InterviewCompleted === 'yes' && (
                        <div className="ml-4 mb-4 space-y-3">
                          {formData.b6Interviews.map((interview, index) => (
                            <div key={interview.id} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <div>
                                <Input
                                  type="date"
                                  placeholder="Date"
                                  className="text-sm"
                                  value={interview.date}
                                  onChange={(e) => {
                                    setFormData(prev => ({
                                      ...prev,
                                      b6Interviews: prev.b6Interviews.map(int => 
                                        int.id === interview.id 
                                          ? { ...int, date: e.target.value }
                                          : int
                                      )
                                    }));
                                  }}
                                  data-testid={`input-b6-interview-date-${index}`}
                                />
                              </div>
                              <div>
                                <Select
                                  value={interview.interviewer}
                                  onValueChange={(value) => {
                                    setFormData(prev => ({
                                      ...prev,
                                      b6Interviews: prev.b6Interviews.map(int => 
                                        int.id === interview.id 
                                          ? { ...int, interviewer: value }
                                          : int
                                      )
                                    }));
                                  }}
                                >
                                  <SelectTrigger className="text-sm" data-testid={`select-b6-interview-interviewer-${index}`}>
                                    <SelectValue placeholder="Interviewer" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {isLoadingUsers ? (
                                      <SelectItem value="_loading" disabled>Loading interviewers...</SelectItem>
                                    ) : approverMasterData.length === 0 ? (
                                      <SelectItem value="_empty" disabled>No office users found</SelectItem>
                                    ) : (
                                      approverMasterData.map((interviewer: string) => (
                                        <SelectItem key={interviewer} value={interviewer}>
                                          {interviewer}
                                        </SelectItem>
                                      ))
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Select
                                  value={interview.status}
                                  onValueChange={(value) => {
                                    setFormData(prev => ({
                                      ...prev,
                                      b6Interviews: prev.b6Interviews.map(int => 
                                        int.id === interview.id 
                                          ? { ...int, status: value }
                                          : int
                                      )
                                    }));
                                  }}
                                >
                                  <SelectTrigger className="text-sm" data-testid={`select-b6-interview-status-${index}`}>
                                    <SelectValue placeholder="Status" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="scheduled">Scheduled</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex gap-2">
                                <Select
                                  value={interview.result}
                                  onValueChange={(value) => {
                                    setFormData(prev => ({
                                      ...prev,
                                      b6Interviews: prev.b6Interviews.map(int => 
                                        int.id === interview.id 
                                          ? { ...int, result: value }
                                          : int
                                      )
                                    }));
                                  }}
                                >
                                  <SelectTrigger className="text-sm flex-1" data-testid={`select-b6-interview-result-${index}`}>
                                    <SelectValue placeholder="Result" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="recommended">Recommended</SelectItem>
                                    <SelectItem value="not-recommended">Not Recommended</SelectItem>
                                    <SelectItem value="assess-further">Assess Further</SelectItem>
                                  </SelectContent>
                                </Select>
                                {index === formData.b6Interviews.length - 1 && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-10 w-10 p-0 border-gray-300"
                                    onClick={() => {
                                      const newId = String(Date.now());
                                      setFormData(prev => ({
                                        ...prev,
                                        b6Interviews: [...prev.b6Interviews, { 
                                          id: newId, 
                                          date: '', 
                                          interviewer: '',
                                          status: '',
                                          result: '',
                                          comments: '' 
                                        }]
                                      }));
                                    }}
                                    data-testid="button-add-b6-interview"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                )}
                                {formData.b6Interviews.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-10 w-10 p-0"
                                    onClick={() => {
                                      setFormData(prev => ({
                                        ...prev,
                                        b6Interviews: prev.b6Interviews.filter(int => int.id !== interview.id)
                                      }));
                                    }}
                                    data-testid={`button-remove-b6-interview-${index}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                                {formData.b6Interviews.length === 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-10 w-10 p-0"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Comments for B6.1 */}
                      {(formData.b6Comments['b6-completed']?.length > 0 || newB6Comment['b6-completed'] !== undefined) && (
                        <div className="ml-4 mb-4 space-y-2">
                          {formData.b6Comments['b6-completed']?.map((comment) => (
                            <div key={comment.id} className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="text-blue-600 italic text-[13px] mb-2">{comment.user}:</div>
                                {editingB6Comment === comment.id ? (
                                  <Textarea
                                    value={comment.text}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                                      setFormData(prev => ({
                                        ...prev,
                                        b6Comments: {
                                          ...prev.b6Comments,
                                          'b6-completed': prev.b6Comments['b6-completed']?.map(c => 
                                            c.id === comment.id ? { ...c, text: e.target.value } : c
                                          ) || []
                                        }
                                      }));
                                    }}
                                    onBlur={() => setEditingB6Comment(null)}
                                    autoFocus
                                    className="min-h-[80px] w-full"
                                  />
                                ) : (
                                  <div 
                                    className="text-blue-600 italic text-[13px] p-1 cursor-pointer min-h-[20px] border border-transparent hover:border-gray-200 rounded"
                                    onClick={() => setEditingB6Comment(comment.id)}
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
                                    setFormData(prev => ({
                                      ...prev,
                                      b6Comments: {
                                        ...prev.b6Comments,
                                        'b6-completed': prev.b6Comments['b6-completed']?.filter(c => c.id !== comment.id) || []
                                      }
                                    }));
                                    if (editingB6Comment === comment.id) {
                                      setEditingB6Comment(null);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          
                          {newB6Comment['b6-completed'] !== undefined && (
                            <div>
                              <div className="text-sm font-medium text-gray-600 mb-2">{currentUserDisplay}</div>
                              <Textarea
                                value={newB6Comment['b6-completed']}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                                  setNewB6Comment(prev => ({ ...prev, 'b6-completed': e.target.value }));
                                }}
                                onBlur={() => {
                                  if (newB6Comment['b6-completed']?.trim() && b6Uuid) {
                                    const commentId = Date.now().toString();
                                    const commentText = newB6Comment['b6-completed'];
                                    setFormData(prev => ({
                                      ...prev,
                                      b6Comments: {
                                        ...prev.b6Comments,
                                        'b6-completed': [
                                          ...(prev.b6Comments['b6-completed'] || []),
                                          { id: commentId, user: currentUserDisplay, text: commentText }
                                        ]
                                      }
                                    }));
                                    createB6CommentMutation.mutate({
                                      b6Uuid,
                                      data: { fieldKey: 'b6-completed', userUuid: currentUserDisplay, commentText }
                                    });
                                  }
                                  setNewB6Comment(prev => {
                                    const newState = { ...prev };
                                    delete newState['b6-completed'];
                                    return newState;
                                  });
                                }}
                                placeholder="Comment: Add your observations here..."
                                className="text-blue-600 italic border-blue-200 text-[13px]"
                                rows={2}
                                autoFocus
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Attachment button */}
                    <div className="flex justify-start">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-gray-600 border-gray-300 hover:bg-gray-50"
                        onClick={() => openAttachmentDialog('b6', 'b6', 'B6. Interview(s)')}
                        data-testid="button-b6-attachments"
                      >
                        <Paperclip className="h-4 w-4 mr-2" />
                        Attachment(s)
                        {formData.b6Attachments?.length > 0 && (
                          <span className="ml-2 bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
                            {formData.b6Attachments.length}
                          </span>
                        )}
                      </Button>
                    </div>

                    {/* Submitted by section */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex justify-between items-center">
                        <div className="text-xs text-gray-500">
                          {formData.b6SubmittedBy ? (
                            <>
                              <span className="font-medium">Submitted by:</span> {formData.b6SubmittedBy}
                              {formData.b6SubmittedDate && ` on ${formData.b6SubmittedDate}`}
                            </>
                          ) : (
                            <span className="text-gray-400">Not yet submitted</span>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => {
                            const currentDate = new Date().toLocaleDateString();
                            setFormData(prev => ({ ...prev, b6SubmittedBy: currentUserDisplay, b6SubmittedDate: currentDate }));
                            setTimeout(() => handleSaveScreening(), 100);
                          }}
                          data-testid="button-b6-submit"
                        >
                          Submit
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* B7. Training Needs Identified - matching legacy exactly */}
                <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-base font-medium" style={{ color: '#16569e' }}>B7. Training Needs Identified</h3>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // TODO: Open training database dialog
                        }}
                        className="text-gray-600 border-gray-300 hover:bg-gray-50 text-xs"
                        data-testid="button-add-b7-training-from-db"
                      >
                        + ADD FROM DATABASE
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newId = String(Date.now());
                          setFormData(prev => ({
                            ...prev,
                            b7TrainingNeeds: [...prev.b7TrainingNeeds, { id: newId, training: '', identifiedBy: '', category: '', dueDate: '', comments: '' }]
                          }));
                        }}
                        className="text-gray-600 border-gray-300 hover:bg-gray-50"
                        data-testid="button-add-b7-training"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        ADD
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Training needs table */}
                    <Table className="w-full">
                      <TableHeader>
                        <TableRow className="bg-gray-100">
                          <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Training/ Course</TableHead>
                          <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Identified by</TableHead>
                          <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Category</TableHead>
                          <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Due Date</TableHead>
                          <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Comments</TableHead>
                          <TableHead className="text-[#4f5863] text-[13px] font-medium p-3 w-20">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {formData.b7TrainingNeeds.map((training, idx) => (
                          <TableRow key={training.id} className="border-b border-gray-200">
                            <TableCell className="p-3">
                              <Input
                                value={training.training || ''}
                                onChange={(e) => {
                                  setFormData(prev => ({
                                    ...prev,
                                    b7TrainingNeeds: prev.b7TrainingNeeds.map(t => 
                                      t.id === training.id ? { ...t, training: e.target.value } : t
                                    )
                                  }));
                                }}
                                className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                                placeholder="Enter training/course name"
                                data-testid={`input-b7-training-name-${idx}`}
                              />
                            </TableCell>
                            <TableCell className="p-3">
                              <Select
                                value={training.identifiedBy || ''}
                                onValueChange={(value) => {
                                  setFormData(prev => ({
                                    ...prev,
                                    b7TrainingNeeds: prev.b7TrainingNeeds.map(t => 
                                      t.id === training.id ? { ...t, identifiedBy: value } : t
                                    )
                                  }));
                                }}
                              >
                                <SelectTrigger className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto" data-testid={`select-b7-training-identified-${idx}`}>
                                  <SelectValue placeholder="Select person" />
                                </SelectTrigger>
                                <SelectContent>
                                  {isLoadingUsers ? (
                                    <SelectItem value="_loading" disabled>Loading...</SelectItem>
                                  ) : approverMasterData.length === 0 ? (
                                    <SelectItem value="_empty" disabled>No users found</SelectItem>
                                  ) : (
                                    approverMasterData.map((name: string) => (
                                      <SelectItem key={name} value={name}>
                                        {name}
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="p-3">
                              <Select
                                value={training.category || ''}
                                onValueChange={(value) => {
                                  setFormData(prev => ({
                                    ...prev,
                                    b7TrainingNeeds: prev.b7TrainingNeeds.map(t => 
                                      t.id === training.id ? { ...t, category: value } : t
                                    )
                                  }));
                                }}
                              >
                                <SelectTrigger className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto" data-testid={`select-b7-training-category-${idx}`}>
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Mandatory">Mandatory</SelectItem>
                                  <SelectItem value="Recommended">Recommended</SelectItem>
                                  <SelectItem value="Optional">Optional</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="p-3">
                              <Input
                                type="date"
                                value={training.dueDate || ''}
                                onChange={(e) => {
                                  setFormData(prev => ({
                                    ...prev,
                                    b7TrainingNeeds: prev.b7TrainingNeeds.map(t => 
                                      t.id === training.id ? { ...t, dueDate: e.target.value } : t
                                    )
                                  }));
                                }}
                                className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                                data-testid={`input-b7-training-due-${idx}`}
                              />
                            </TableCell>
                            <TableCell className="p-3">
                              <Input
                                value={training.comments || ''}
                                onChange={(e) => {
                                  setFormData(prev => ({
                                    ...prev,
                                    b7TrainingNeeds: prev.b7TrainingNeeds.map(t => 
                                      t.id === training.id ? { ...t, comments: e.target.value } : t
                                    )
                                  }));
                                }}
                                className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                                placeholder="Enter comments"
                                data-testid={`input-b7-training-comments-${idx}`}
                              />
                            </TableCell>
                            <TableCell className="p-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (formData.b7TrainingNeeds.length > 1) {
                                    setFormData(prev => ({
                                      ...prev,
                                      b7TrainingNeeds: prev.b7TrainingNeeds.filter(t => t.id !== training.id)
                                    }));
                                  }
                                }}
                                className="h-8 w-8 p-0"
                                data-testid={`button-remove-b7-training-${idx}`}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {/* Submitted by section */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex justify-between items-center">
                        <div className="text-xs text-gray-500">
                          {formData.b7SubmittedBy ? (
                            <>
                              <span className="font-medium">Submitted by:</span> {formData.b7SubmittedBy}
                              {formData.b7SubmittedDate && ` on ${formData.b7SubmittedDate}`}
                            </>
                          ) : (
                            <span className="text-gray-400">Not yet submitted</span>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => {
                            const currentDate = new Date().toLocaleDateString();
                            setFormData(prev => ({ ...prev, b7SubmittedBy: currentUserDisplay, b7SubmittedDate: currentDate }));
                            setTimeout(() => handleSaveScreening(), 100);
                          }}
                          data-testid="button-b7-submit"
                        >
                          Submit
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* B8. Short Listing - matching legacy exactly */}
                <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-base font-medium" style={{ color: '#16569e' }}>B8. Short Listing</h3>
                  </div>
                  
                  <div className="space-y-6">
                    {/* B1.4 Shortlisted (For final approval) */}
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <Label className="text-xs text-gray-500 tracking-wide flex-1 pr-4">
                          B1.4 Shortlisted (For final approval)?
                        </Label>
                        <div className="flex items-center min-w-[300px]">
                          <div className="flex gap-6 w-[200px]">
                            <RadioGroup 
                              value={formData.b8Shortlisted} 
                              onValueChange={(value) => setFormData(prev => ({ ...prev, b8Shortlisted: value }))}
                              className="flex gap-6"
                            >
                              <div className="flex items-center space-x-2 w-[50px]">
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="yes" id="b8-shortlisted-yes" />
                                  <Label htmlFor="b8-shortlisted-yes" className="text-sm cursor-pointer">Yes</Label>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2 w-[50px]">
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="no" id="b8-shortlisted-no" />
                                  <Label htmlFor="b8-shortlisted-no" className="text-sm cursor-pointer">No</Label>
                                </div>
                              </div>
                            </RadioGroup>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 ml-4"
                            onClick={() => setNewB8Comment(prev => ({
                              ...prev,
                              'b8-shortlisted': ""
                            }))}
                            data-testid="button-b8-shortlisted-comment"
                          >
                            <MessageSquare className="h-4 w-4 text-gray-400" />
                          </Button>
                        </div>
                      </div>

                      {/* Comments for B8 */}
                      {(formData.b8Comments['b8-shortlisted']?.length > 0 || newB8Comment['b8-shortlisted'] !== undefined) && (
                        <div className="ml-4 mb-4 space-y-2">
                          {formData.b8Comments['b8-shortlisted']?.map((comment) => (
                            <div key={comment.id} className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="text-blue-600 italic text-[13px] mb-2">{comment.user}:</div>
                                {editingB8Comment === comment.id ? (
                                  <Textarea
                                    value={comment.text}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                                      setFormData(prev => ({
                                        ...prev,
                                        b8Comments: {
                                          ...prev.b8Comments,
                                          'b8-shortlisted': prev.b8Comments['b8-shortlisted']?.map(c => 
                                            c.id === comment.id ? { ...c, text: e.target.value } : c
                                          ) || []
                                        }
                                      }));
                                    }}
                                    onBlur={() => setEditingB8Comment(null)}
                                    autoFocus
                                    className="min-h-[80px] w-full"
                                  />
                                ) : (
                                  <div 
                                    className="text-blue-600 italic text-[13px] p-1 cursor-pointer min-h-[20px] border border-transparent hover:border-gray-200 rounded"
                                    onClick={() => setEditingB8Comment(comment.id)}
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
                                    setFormData(prev => ({
                                      ...prev,
                                      b8Comments: {
                                        ...prev.b8Comments,
                                        'b8-shortlisted': prev.b8Comments['b8-shortlisted']?.filter(c => c.id !== comment.id) || []
                                      }
                                    }));
                                    if (editingB8Comment === comment.id) {
                                      setEditingB8Comment(null);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          
                          {newB8Comment['b8-shortlisted'] !== undefined && (
                            <div>
                              <div className="text-sm font-medium text-gray-600 mb-2">{currentUserDisplay}</div>
                              <Textarea
                                value={newB8Comment['b8-shortlisted']}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                                  setNewB8Comment(prev => ({ ...prev, 'b8-shortlisted': e.target.value }));
                                }}
                                onBlur={() => {
                                  if (newB8Comment['b8-shortlisted']?.trim() && b8Uuid) {
                                    const commentId = Date.now().toString();
                                    const commentText = newB8Comment['b8-shortlisted'];
                                    setFormData(prev => ({
                                      ...prev,
                                      b8Comments: {
                                        ...prev.b8Comments,
                                        'b8-shortlisted': [
                                          ...(prev.b8Comments['b8-shortlisted'] || []),
                                          { id: commentId, user: currentUserDisplay, text: commentText }
                                        ]
                                      }
                                    }));
                                    createB8CommentMutation.mutate({
                                      b8Uuid,
                                      data: { fieldKey: 'b8-shortlisted', userUuid: currentUserDisplay, commentText }
                                    });
                                  }
                                  setNewB8Comment(prev => {
                                    const newState = { ...prev };
                                    delete newState['b8-shortlisted'];
                                    return newState;
                                  });
                                }}
                                placeholder="Comment: Add your observations here..."
                                className="text-blue-600 italic border-blue-200 text-[13px]"
                                rows={2}
                                autoFocus
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Attachment button */}
                    <div className="flex justify-start">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-gray-600 border-gray-300 hover:bg-gray-50"
                        onClick={() => openAttachmentDialog('b8', 'b8', 'B8. Short Listing')}
                        data-testid="button-b8-attachments"
                      >
                        <Paperclip className="h-4 w-4 mr-2" />
                        Attachment(s)
                        {formData.b8Attachments?.length > 0 && (
                          <span className="ml-2 bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
                            {formData.b8Attachments.length}
                          </span>
                        )}
                      </Button>
                    </div>

                    {/* Submitted by section */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex justify-between items-center">
                        <div className="text-xs text-gray-500">
                          {formData.b8SubmittedBy ? (
                            <>
                              <span className="font-medium">Submitted by:</span> {formData.b8SubmittedBy}
                              {formData.b8SubmittedDate && ` on ${formData.b8SubmittedDate}`}
                            </>
                          ) : (
                            <span className="text-gray-400">Not yet submitted</span>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => {
                            const currentDate = new Date().toLocaleDateString();
                            setFormData(prev => ({ ...prev, b8SubmittedBy: currentUserDisplay, b8SubmittedDate: currentDate }));
                            setTimeout(() => handleSaveScreening(), 100);
                          }}
                          data-testid="button-b8-submit"
                        >
                          Submit
                        </Button>
                      </div>
                    </div>

                    {/* Submit for Approval to */}
                    <div className="pt-4 border-t border-gray-200">
                      <div className="flex items-center gap-4">
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
                                {formData.selectedApproversForSubmission.length > 0
                                  ? `${formData.selectedApproversForSubmission.length} approver(s) selected`
                                  : "Approver"}
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
                                  approverMasterData.map((approverName: string) => (
                                    <div
                                      key={approverName}
                                      className="flex items-center px-3 py-2 cursor-pointer hover:bg-gray-100"
                                      onClick={() => toggleApproverSelection(approverName)}
                                      data-testid={`checkbox-approver-${approverName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}
                                    >
                                      <Checkbox
                                        checked={formData.selectedApproversForSubmission.includes(approverName)}
                                        className="mr-2"
                                      />
                                      <span className="text-sm text-gray-700">{approverName}</span>
                                    </div>
                                  ))
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-6 pt-4">
                  <Button 
                    className="bg-[#00AF7B] hover:bg-[#009B6B] text-white px-8"
                    onClick={() => {
                      handleSaveScreening();
                    }}
                    disabled={savingInProgress}
                    data-testid="button-submit-for-approval"
                  >
                    {savingInProgress ? 'Saving...' : 'Submit for Approval'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      case 'C':
        return (
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="pb-4 mb-6">
                <h2 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part C - Approval</h2>
                <div style={{ color: '#16569e' }} className="text-sm">To be completed by the designated approver</div>
                <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
              </div>

              {/* C1 Approval Section */}
              <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-base font-medium" style={{ color: '#16569e' }}>C.1 Approval</h3>
                  <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-xs text-gray-600">i</span>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <Label className="text-xs text-gray-500 tracking-wide flex-1 pr-4">
                        C1.1 Approved?
                      </Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addC1Approver}
                        className="text-gray-600 border-gray-300 hover:bg-gray-50"
                        data-testid="button-add-c1-approver"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Approver
                      </Button>
                    </div>

                    <div className="ml-4 mb-4 space-y-3">
                      {formData.c1Approvers.map((approver) => (
                        <div key={approver.id} className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                              <Input
                                type="date"
                                placeholder="Date"
                                className="text-sm"
                                value={approver.date}
                                onChange={(e) => updateC1Approver(approver.id, 'date', e.target.value)}
                                data-testid={`input-c1-date-${approver.id}`}
                              />
                            </div>
                            <div>
                              <Select
                                value={approver.approver}
                                onValueChange={(value) => updateC1Approver(approver.id, 'approver', value)}
                              >
                                <SelectTrigger className="text-sm" data-testid={`select-c1-approver-${approver.id}`}>
                                  <SelectValue placeholder="Approver" />
                                </SelectTrigger>
                                <SelectContent>
                                  {isLoadingUsers ? (
                                    <SelectItem value="_loading" disabled>Loading approvers...</SelectItem>
                                  ) : approverMasterData.length === 0 ? (
                                    <SelectItem value="_empty" disabled>No office users found</SelectItem>
                                  ) : (
                                    approverMasterData.map((approverName: string) => (
                                      <SelectItem key={approverName} value={approverName}>
                                        {approverName}
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Select
                                value={approver.status}
                                onValueChange={(value) => updateC1Approver(approver.id, 'status', value)}
                              >
                                <SelectTrigger className="text-sm" data-testid={`select-c1-status-${approver.id}`}>
                                  <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Review Pending">Review Pending</SelectItem>
                                  <SelectItem value="Review Completed">Review Completed</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex gap-3">
                                <label className="flex items-center">
                                  <input
                                    type="radio"
                                    name={`approval-${approver.id}`}
                                    value="Yes"
                                    checked={approver.approval === 'Yes'}
                                    onChange={(e) => updateC1Approver(approver.id, 'approval', e.target.value)}
                                    className="mr-1"
                                  />
                                  <span className="text-[13px]">Yes</span>
                                </label>
                                <label className="flex items-center">
                                  <input
                                    type="radio"
                                    name={`approval-${approver.id}`}
                                    value="Yes, Conditional"
                                    checked={approver.approval === 'Yes, Conditional'}
                                    onChange={(e) => updateC1Approver(approver.id, 'approval', e.target.value)}
                                    className="mr-1"
                                  />
                                  <span className="text-[13px]">Yes, Conditional</span>
                                </label>
                                <label className="flex items-center">
                                  <input
                                    type="radio"
                                    name={`approval-${approver.id}`}
                                    value="No"
                                    checked={approver.approval === 'No'}
                                    onChange={(e) => updateC1Approver(approver.id, 'approval', e.target.value)}
                                    className="mr-1"
                                  />
                                  <span className="text-[13px]">No</span>
                                </label>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-10 w-10 p-0"
                                onClick={() => removeC1Approver(approver.id)}
                                data-testid={`button-remove-c1-approver-${approver.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {approver.approver && (
                            <div className="ml-4">
                              <div className="text-blue-600 italic text-[13px] mb-2">
                                {approver.approver}:
                              </div>
                              <Textarea
                                value={approver.comments || ''}
                                onChange={(e) => updateC1Approver(approver.id, 'comments', e.target.value)}
                                placeholder="Click to add comment..."
                                className="text-blue-600 italic border-blue-200 text-[13px] mb-2"
                                rows={2}
                                data-testid={`textarea-c1-approver-comment-${approver.id}`}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* C2 Suitable for Section */}
              <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-base font-medium" style={{ color: '#16569e' }}>C2 Suitable for</h3>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="text-xs text-gray-500 tracking-wide mb-2 block">C2.1 Vessel type(s):</label>
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {formData.c2VesselTypes.map((vesselType) => (
                          <div key={vesselType} className="flex items-center bg-blue-100 text-blue-800 px-3 py-1 rounded-md text-sm">
                            <span>{vesselType}</span>
                            <button
                              onClick={() => removeC2VesselType(vesselType)}
                              className="ml-2 hover:text-blue-600"
                              data-testid={`button-remove-c2-vessel-${vesselType}`}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <Select
                        value=""
                        onValueChange={(value) => addC2VesselType(value)}
                      >
                        <SelectTrigger className="w-full max-w-md" data-testid="select-c2-vessel-type">
                          <SelectValue placeholder="Add vessel type..." />
                        </SelectTrigger>
                        <SelectContent>
                          {vesselTypeMasterData.filter((type: string) => !formData.c2VesselTypes.includes(type)).map((vesselType: string) => (
                            <SelectItem key={vesselType} value={vesselType}>
                              {vesselType}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 tracking-wide mb-2 block">C2.2 Vessel Class/ Fleet:</label>
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {formData.c2FleetGroups.map((fleetGroup) => (
                          <div key={fleetGroup} className="flex items-center bg-blue-100 text-blue-800 px-3 py-1 rounded-md text-sm">
                            <span>{fleetGroup}</span>
                            <button
                              onClick={() => removeC2FleetGroup(fleetGroup)}
                              className="ml-2 hover:text-blue-600"
                              data-testid={`button-remove-c2-fleet-${fleetGroup}`}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <Select
                        value=""
                        onValueChange={(value) => addC2FleetGroup(value)}
                      >
                        <SelectTrigger className="w-full max-w-md" data-testid="select-c2-fleet-group">
                          <SelectValue placeholder={isLoadingVesselFleetData ? "Loading options..." : "Add fleet group..."} />
                        </SelectTrigger>
                        <SelectContent>
                          {isLoadingVesselFleetData && (
                            <SelectItem value="_loading" disabled>Loading options...</SelectItem>
                          )}
                          {vesselFleetOptions
                            .filter(option => !formData.c2FleetGroups.includes(option.value))
                            .map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* C3 Recruited & Assigned to Section */}
              <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-base font-medium" style={{ color: '#16569e' }}>C3 Recruited & Assigned to</h3>
                </div>

                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <Label className="text-xs text-gray-500 tracking-wide flex-1 pr-4">
                        C3.1 Recruitment confirmed:
                      </Label>
                      <div className="flex items-center min-w-[300px]">
                        <div className="flex gap-6">
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name="recruitment-status"
                              value="Yes"
                              checked={formData.c3RecruitmentStatus === 'Yes'}
                              onChange={(e) => updateFormData('c3RecruitmentStatus', e.target.value)}
                              className="mr-2"
                            />
                            <span className="text-[13px]">Yes</span>
                          </label>
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name="recruitment-status"
                              value="Waitlist"
                              checked={formData.c3RecruitmentStatus === 'Waitlist'}
                              onChange={(e) => updateFormData('c3RecruitmentStatus', e.target.value)}
                              className="mr-2"
                            />
                            <span className="text-[13px]">Waitlist</span>
                          </label>
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name="recruitment-status"
                              value="Rejected"
                              checked={formData.c3RecruitmentStatus === 'Rejected'}
                              onChange={(e) => updateFormData('c3RecruitmentStatus', e.target.value)}
                              className="mr-2"
                            />
                            <span className="text-[13px]">Rejected</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 tracking-wide mb-2 block">C3.2 Vessel, Vessel Class/ Fleet:</label>
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {formData.c3AssignedGroups.map((group) => (
                          <div key={group} className="flex items-center bg-blue-100 text-blue-800 px-3 py-1 rounded-md text-sm">
                            <span>{group}</span>
                            <button
                              onClick={() => removeC3AssignedGroup(group)}
                              className="ml-2 hover:text-blue-600"
                              data-testid={`button-remove-c3-group-${group}`}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <Select
                        value=""
                        onValueChange={(value) => addC3AssignedGroup(value)}
                      >
                        <SelectTrigger className="w-full max-w-md" data-testid="select-c3-vessel-fleet">
                          <SelectValue placeholder={isLoadingVesselFleetData ? "Loading options..." : "Add vessel/fleet..."} />
                        </SelectTrigger>
                        <SelectContent>
                          {isLoadingVesselFleetData && (
                            <SelectItem value="_loading" disabled>Loading options...</SelectItem>
                          )}
                          {vesselFleetOptions
                            .filter(option => !formData.c3AssignedGroups.includes(option.value))
                            .map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <div className="text-xs text-gray-500">
                        {formData.c3SubmittedBy ? (
                          <>Submitted by: {formData.c3SubmittedBy}</>
                        ) : (
                          <span className="text-gray-400">Not yet submitted</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formData.c3SubmittedDate && (
                          <>Date: {formData.c3SubmittedDate}</>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6 pt-4">
                <Button 
                  className="bg-[#00AF7B] hover:bg-[#009B6B] text-white px-8"
                  onClick={() => {
                    handleSaveOnly();
                  }}
                  disabled={savingInProgress}
                  data-testid="button-save-approval"
                >
                  {savingInProgress ? 'Saving...' : 'Save Approval'}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      default:
        return (
          <div className="p-6 text-center text-gray-600">
            Content for {activeSection} will be implemented in future iterations.
          </div>
        );
    }
  };

  return (
    <StandardFormPopup
      isOpen={true}
      onClose={onClose}
      title={candidate ? `Recruitment Application V2 - ${candidate.firstName} ${candidate.familyName}` : 'New Candidate Application'}
      className="max-w-none 2xl:max-w-[95vw]"
    >
      <div className="flex flex-col h-full overflow-hidden">
        <div className="sticky top-0 bg-white border-b p-2 sm:p-3 lg:p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-1 sm:gap-2 lg:gap-4">
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-sm sm:text-lg lg:text-xl font-bold truncate">
              <span className="hidden sm:inline">Recruitment Application V2 - </span>
              {candidate ? `${candidate.firstName} ${candidate.familyName}` : 'New Candidate'}
            </h1>
          </div>
          <div className="flex gap-1 sm:gap-2">
            <Button 
              variant="outline" 
              size="sm"
              className="items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-white border-gray-300 text-gray-700 shadow-sm hover:bg-gray-50 h-8 rounded-md px-3 text-xs hidden sm:flex"
              data-testid="button-export"
            >
              <FileText className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              className="items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 text-primary-foreground shadow hover:bg-primary/90 h-8 rounded-md px-3 text-xs hidden sm:flex bg-[#5fa5fa]"
              onClick={handleSaveOnly}
              disabled={savingInProgress}
              data-testid="button-save-draft"
            >
              <Save className="h-4 w-4 mr-2" />
              {savingInProgress ? 'Saving...' : 'Save Draft'}
            </Button>
            <Button variant="outline" size="sm" className="sm:hidden" onClick={handleSaveOnly} disabled={savingInProgress}>
              <Save className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="block sm:hidden bg-white border-b px-4 py-3">
          <nav className="flex justify-center space-x-4">
            {sections.map((section, index) => {
              // Only highlight continuous sections (A1-A5) when activeSection is also in A1-A5
              // Otherwise highlight based on activeSection for B/C
              const isActive = section.type === 'continuous' 
                ? (activeContinuousSection === section.id && ['A1', 'A2', 'A3', 'A4', 'A5'].includes(activeSection))
                : activeSection === section.id;
              
              return (
                <div key={section.id} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => handleSectionNavigation(section.id)}
                    className="flex items-center justify-center"
                    data-testid={`button-step-mobile-${section.id}`}
                  >
                    <span 
                      className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold shrink-0 ${
                        isActive ? "bg-blue-600 text-white" : "bg-gray-600 text-white"
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

        <div className="flex h-full overflow-hidden">
          <aside className="hidden sm:block sticky top-0 self-start basis-20 md:basis-48 lg:basis-52 shrink-0 bg-gray-50 border-r overflow-y-auto">
            <div className="p-3">
              <nav className="space-y-1">
                {sections.map((section, index) => {
                  // Only highlight continuous sections (A1-A5) when activeSection is also in A1-A5
                  // Otherwise highlight based on activeSection for B/C
                  const isActive = section.type === 'continuous' 
                    ? (activeContinuousSection === section.id && ['A1', 'A2', 'A3', 'A4', 'A5'].includes(activeSection))
                    : activeSection === section.id;
                  
                  return (
                    <div key={section.id} className="relative">
                      <button
                        type="button"
                        onClick={() => handleSectionNavigation(section.id)}
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
                            isActive ? "bg-blue-600 text-white" : "bg-gray-600 text-white"
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
          
          <div className="flex-1 overflow-y-auto p-2 sm:p-4 lg:p-6 bg-[#f9fafb]">
            {renderContent()}
          </div>
        </div>
      </div>
      
      <LicenseSelectionDialog
        open={isLicenseDialogOpen}
        onClose={() => setIsLicenseDialogOpen(false)}
        onConfirm={addLicensesFromDatabase}
        existingLicenseIds={formData.licenses.map(l => l.licenseId).filter((id): id is string => Boolean(id))}
      />
      
      <TrainingCourseSelectionDialog
        open={isTrainingDialogOpen}
        onClose={() => setIsTrainingDialogOpen(false)}
        onConfirm={addTrainingCoursesFromDatabase}
        existingCourseIds={formData.trainingCourses.map(c => c.courseId).filter((id): id is string => Boolean(id))}
      />
      
      <TravelDocumentSelectionDialog
        open={isTravelDocDialogOpen}
        onClose={() => setIsTravelDocDialogOpen(false)}
        onConfirm={addTravelDocsFromDatabase}
        existingDocumentIds={formData.documents.map(d => d.documentId).filter((id): id is string => Boolean(id))}
      />
      
      <VisaSelectionDialog
        open={isVisaDialogOpen}
        onClose={() => setIsVisaDialogOpen(false)}
        onConfirm={addVisasFromDatabase}
        existingCountryIds={formData.visas.map(v => v.countryId).filter((id): id is string => Boolean(id))}
      />
      
      <FileAttachmentDialog
        open={attachmentDialog.open}
        onOpenChange={(open) => setAttachmentDialog(prev => ({ ...prev, open }))}
        attachments={getAttachmentsForItem()}
        onAttachmentsChange={updateAttachments}
        title="Manage Attachments"
        itemName={attachmentDialog.itemName}
      />
    </StandardFormPopup>
  );
};

export default RecruitmentApplicationFormV2;
