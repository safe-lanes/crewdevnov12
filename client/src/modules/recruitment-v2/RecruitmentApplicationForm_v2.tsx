import { useState, useEffect, useRef, useMemo } from 'react';
import { StandardFormPopup } from '@/components/ui/form-popup';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Edit, Plus, Save, Trash2, Upload, Paperclip, X, Camera, FileText } from 'lucide-react';
import { FileAttachmentDialog, type FileAttachment } from '@/components/FileAttachmentDialog';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useCompanyRanks } from '@/hooks/useCompanyRanks';
import { useExternalNationalities } from '@/hooks/useExternalNationalities';
import { useExternalVesselTypes } from '@/hooks/useExternalVesselTypes';
import { useExternalCountries } from '@/hooks/useExternalCountries';
import { useExternalLanguages } from '@/hooks/useExternalLanguages';
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
    dateOfCompletion: string;
    schoolCollegeUniversity: string;
    subjectsField: string;
    qualifications: string;
    attachments?: FileAttachment[];
  }>;
  licenses: Array<{
    id: string;
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
    information: string;
    response: string;
    attachments?: FileAttachment[];
  }>;
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
});

type SectionType = 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'B' | 'C';

const sections: { id: SectionType; number: string; title: string; type: 'continuous' | 'stepper' }[] = [
  { id: 'A1', number: 'A1', title: "Seafarer's Particulars", type: 'continuous' },
  { id: 'A2', number: 'A2', title: 'Travel & ID Documents', type: 'continuous' },
  { id: 'A3', number: 'A3', title: 'Training & Certificates', type: 'continuous' },
  { id: 'A4', number: 'A4', title: 'Sea Service', type: 'continuous' },
  { id: 'A5', number: 'A5', title: 'Additional Information', type: 'continuous' },
  { id: 'B', number: 'B', title: 'Office Screening', type: 'stepper' },
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
    type: 'document' | 'visa' | 'education' | 'license' | 'training' | 'seaService' | 'additionalInfo' | null;
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
  
  const savingInProgress = savePersonalDetailsMutation.isPending || 
    saveAddressMutation.isPending || saveFamilyInfoMutation.isPending ||
    saveChildrenMutation.isPending || saveNextOfKinMutation.isPending ||
    saveVesselTypesMutation.isPending || saveDocumentMutation.isPending ||
    saveVisaMutation.isPending || saveEducationMutation.isPending ||
    saveLicenseMutation.isPending || saveTrainingMutation.isPending ||
    saveSeaServiceMutation.isPending || saveAdditionalInfoMutation.isPending;

  const { data: companyRanks, isLoading: ranksLoading, rankOptions } = useCompanyRanks();
  const { data: externalNationalitiesData } = useExternalNationalities();
  const { data: externalVesselTypesData } = useExternalVesselTypes();
  const { data: externalCountriesData } = useExternalCountries();
  const { data: externalLanguagesData } = useExternalLanguages();

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
          information: ai.information || '',
          response: ai.response || '',
          attachments: (ai.attachments || []) as any,
        })),
      }));
    }
  }, [additionalInfoData]);

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

  const addVesselType = (type: string) => {
    if (!formData.vesselType.includes(type)) {
      setFormData(prev => ({ ...prev, vesselType: [...prev.vesselType, type] }));
    }
  };

  const removeVesselType = (type: string) => {
    setFormData(prev => ({ ...prev, vesselType: prev.vesselType.filter(t => t !== type) }));
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
    type: 'document' | 'visa' | 'education' | 'license' | 'training' | 'seaService' | 'additionalInfo',
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
      
      const serverDocUuids = new Set((documentsData || []).map(d => d.docUuid));
      const localDocIds = new Set(formData.documents.map(d => d.id));
      
      for (const doc of formData.documents) {
        const docPayload = {
          documentId: doc.documentId || '',
          documentName: doc.document || '',
          number: doc.number || '',
          issued: doc.issued || '',
          expiry: doc.expiry || '',
          issuingAuthority: doc.issuingAuthority || '',
          issuingCountryUuid: '',
          sortOrder: formData.documents.indexOf(doc),
        };
        
        if (serverDocUuids.has(doc.id)) {
          await updateDocumentMutation.mutateAsync({
            docUuid: doc.id,
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
        if (!localDocIds.has(serverDoc.docUuid)) {
          await deleteDocumentMutation.mutateAsync({
            docUuid: serverDoc.docUuid,
            recCanUuid: currentUuid,
          });
        }
      }
      
      const serverVisaUuids = new Set((visasData || []).map(v => v.visaUuid));
      const localVisaIds = new Set(formData.visas.map(v => v.id));
      
      for (const visa of formData.visas) {
        const visaPayload = {
          countryUuid: visa.countryId || visa.issuingCountry || '',
          serialNo: visa.serialNo || '',
          issued: visa.issued || '',
          expiry: visa.expiry || '',
          visaType: visa.visaType || '',
          sortOrder: formData.visas.indexOf(visa),
        };
        
        if (serverVisaUuids.has(visa.id)) {
          await updateVisaMutation.mutateAsync({
            visaUuid: visa.id,
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
        if (!localVisaIds.has(serverVisa.visaUuid)) {
          await deleteVisaMutation.mutateAsync({
            visaUuid: serverVisa.visaUuid,
            recCanUuid: currentUuid,
          });
        }
      }
      
      const serverEduUuids = new Set((educationData || []).map(e => e.eduUuid));
      const localEduIds = new Set(formData.education.map(e => e.id));
      
      for (const edu of formData.education) {
        const eduPayload = {
          dateOfCompletion: edu.dateOfCompletion || '',
          institution: edu.schoolCollegeUniversity || '',
          subjectsField: edu.subjectsField || '',
          qualifications: edu.qualifications || '',
          sortOrder: formData.education.indexOf(edu),
        };
        
        if (serverEduUuids.has(edu.id)) {
          await updateEducationMutation.mutateAsync({
            eduUuid: edu.id,
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
        if (!localEduIds.has(serverEdu.eduUuid)) {
          await deleteEducationMutation.mutateAsync({
            eduUuid: serverEdu.eduUuid,
            recCanUuid: currentUuid,
          });
        }
      }
      
      const serverLicUuids = new Set((licensesData || []).map(l => l.licUuid));
      const localLicIds = new Set(formData.licenses.map(l => l.id));
      
      for (const lic of formData.licenses) {
        const licPayload = {
          licenseId: lic.licenseId || '',
          certificateDocument: lic.certificateDocument || '',
          abbr: lic.abbr || '',
          requirement: lic.requirement || '',
          certificateNo: lic.certificateNo || '',
          issuingAuthority: lic.issuingAuthority || '',
          issuingCountryUuid: '',
          issued: lic.issued || '',
          expiry: lic.expiry || '',
          sortOrder: formData.licenses.indexOf(lic),
        };
        
        if (serverLicUuids.has(lic.id)) {
          await updateLicenseMutation.mutateAsync({
            licUuid: lic.id,
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
        if (!localLicIds.has(serverLic.licUuid)) {
          await deleteLicenseMutation.mutateAsync({
            licUuid: serverLic.licUuid,
            recCanUuid: currentUuid,
          });
        }
      }
      
      const serverTrainUuids = new Set((trainingData || []).map(t => t.trainUuid));
      const localTrainIds = new Set(formData.trainingCourses.map(t => t.id));
      
      for (const train of formData.trainingCourses) {
        const trainPayload = {
          courseId: train.courseId || '',
          trainingCourse: train.trainingCourse || '',
          abbr: train.abbr || '',
          requirement: train.requirement || '',
          certificateNo: train.certificateNo || '',
          issuingAuthority: train.issuingAuthority || '',
          issuingCountryUuid: '',
          issued: train.issued || '',
          expiry: train.expiry || '',
          sortOrder: formData.trainingCourses.indexOf(train),
        };
        
        if (serverTrainUuids.has(train.id)) {
          await updateTrainingMutation.mutateAsync({
            trainUuid: train.id,
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
        if (!localTrainIds.has(serverTrain.trainUuid)) {
          await deleteTrainingMutation.mutateAsync({
            trainUuid: serverTrain.trainUuid,
            recCanUuid: currentUuid,
          });
        }
      }
      
      const serverSeaUuids = new Set((seaServiceData || []).map(s => s.seaUuid));
      const localSeaIds = new Set(formData.seaService.map(s => s.id));
      
      for (const sea of formData.seaService) {
        const seaPayload = {
          vesselName: sea.vesselName || '',
          vesselUuid: '',
          vesselTypeUuid: sea.vesselType || '',
          deadweight: sea.deadweight || '',
          engineTypePower: sea.engineTypePower || '',
          ownerOperator: sea.ownerOperator || '',
          rank: sea.rank || '',
          fromDate: sea.from || '',
          toDate: sea.to || '',
          periodMonths: sea.periodMonths || '',
          sortOrder: formData.seaService.indexOf(sea),
        };
        
        if (serverSeaUuids.has(sea.id)) {
          await updateSeaServiceMutation.mutateAsync({
            seaUuid: sea.id,
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
        if (!localSeaIds.has(serverSea.seaUuid)) {
          await deleteSeaServiceMutation.mutateAsync({
            seaUuid: serverSea.seaUuid,
            recCanUuid: currentUuid,
          });
        }
      }
      
      const serverInfoUuids = new Set((additionalInfoData || []).map(a => a.infoUuid));
      const localInfoIds = new Set(formData.additionalInfo.map(a => a.id));
      
      for (const info of formData.additionalInfo) {
        const infoPayload = {
          information: info.information || '',
          response: info.response || '',
          sortOrder: formData.additionalInfo.indexOf(info),
        };
        
        if (serverInfoUuids.has(info.id)) {
          await updateAdditionalInfoMutation.mutateAsync({
            infoUuid: info.id,
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
        if (!localInfoIds.has(serverInfo.infoUuid)) {
          await deleteAdditionalInfoMutation.mutateAsync({
            infoUuid: serverInfo.infoUuid,
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
      let currentUuid = recCanUuid;
      
      if (!currentUuid) {
        await handleSaveAndContinue();
        currentUuid = recCanUuid;
      }
      
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

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex flex-col items-center gap-2">
            <div 
              className="w-32 h-40 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden bg-gray-50"
              data-testid="photo-preview"
            >
              {formData.uploadedPhoto ? (
                <img src={formData.uploadedPhoto} alt="Candidate" className="w-full h-full object-cover" />
              ) : (
                <Camera className="h-8 w-8 text-gray-400" />
              )}
            </div>
            {isEditing && (
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                  data-testid="input-photo-upload"
                />
                <div className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
                  <Upload className="h-4 w-4" />
                  <span>Upload Photo</span>
                </div>
              </label>
            )}
          </div>

          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">First Name *</Label>
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
              <Label className="text-xs text-gray-500 tracking-wide">Family Name *</Label>
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
              <Label className="text-xs text-gray-500 tracking-wide">Nationality *</Label>
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
              <Label className="text-xs text-gray-500 tracking-wide">Date of Birth *</Label>
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
              <Label className="text-xs text-gray-500 tracking-wide">Age (Years)</Label>
              <div className="mt-1 text-sm text-gray-900" data-testid="text-age">{formData.ageInYears}</div>
            </div>
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">Place of Birth (City)</Label>
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
              <Label className="text-xs text-gray-500 tracking-wide">Place of Birth (Country)</Label>
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
              <Label className="text-xs text-gray-500 tracking-wide">Height (cm)</Label>
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
              <Label className="text-xs text-gray-500 tracking-wide">Weight (kg)</Label>
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
              <Label className="text-xs text-gray-500 tracking-wide">Rank Applied For *</Label>
              {isEditing ? (
                <Select value={formData.rankAppliedFor} onValueChange={(value) => updateFormData('rankAppliedFor', value)}>
                  <SelectTrigger className="mt-1" data-testid="select-rank-applied-for">
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
                <div className="mt-1 text-sm text-gray-900" data-testid="text-rank-applied-for">{formData.rankAppliedFor}</div>
              )}
            </div>
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">File No</Label>
              {isEditing ? (
                <Input
                  value={formData.fileNo}
                  onChange={(e) => updateFormData('fileNo', e.target.value)}
                  className="mt-1"
                  data-testid="input-file-no"
                />
              ) : (
                <div className="mt-1 text-sm text-gray-900" data-testid="text-file-no">{formData.fileNo}</div>
              )}
            </div>
            <div className="col-span-full">
              <Label className="text-xs text-gray-500 tracking-wide mb-2 block">Vessel Type(s) *</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.vesselType.map((type) => (
                  <div key={type} className="flex items-center bg-blue-100 text-blue-800 px-3 py-1 rounded-md text-sm">
                    <span>{type}</span>
                    {isEditing && (
                      <button onClick={() => removeVesselType(type)} className="ml-2 hover:text-blue-600">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {isEditing && (
                <Select value="" onValueChange={(value) => addVesselType(value)}>
                  <SelectTrigger className="w-full max-w-md" data-testid="select-vessel-type">
                    <SelectValue placeholder="Add vessel type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {vesselTypeMasterData
                      .filter((vt: string) => !formData.vesselType.includes(vt))
                      .map((vt: string) => (
                        <SelectItem key={vt} value={vt}>{vt}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
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
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>A1.2 Address & Contact</h3>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-gray-500 tracking-wide">Country of Residence</Label>
            {isEditing ? (
              <Select value={formData.countryOfResidence} onValueChange={(value) => updateFormData('countryOfResidence', value)}>
                <SelectTrigger className="mt-1" data-testid="select-country-residence">
                  <SelectValue placeholder="Select country" />
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
          <div className="sm:col-span-2">
            <Label className="text-xs text-gray-500 tracking-wide">Address Line 1</Label>
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
          <div className="sm:col-span-2">
            <Label className="text-xs text-gray-500 tracking-wide">Address Line 2</Label>
            {isEditing ? (
              <Input
                value={formData.residentialAddressLine2}
                onChange={(e) => updateFormData('residentialAddressLine2', e.target.value)}
                className="mt-1"
                data-testid="input-address-line2"
              />
            ) : (
              <div className="mt-1 text-sm text-gray-900">{formData.residentialAddressLine2}</div>
            )}
          </div>
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
          <div>
            <Label className="text-xs text-gray-500 tracking-wide">Mobile *</Label>
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
          <div className="sm:col-span-2">
            <Label className="text-xs text-gray-500 tracking-wide">Email *</Label>
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

          {formData.children.length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label className="text-xs text-gray-500 tracking-wide">Children</Label>
                {isEditing && (
                  <Button variant="outline" size="sm" onClick={addChild} data-testid="button-add-child">
                    <Plus className="h-4 w-4 mr-1" /> Add Child
                  </Button>
                )}
              </div>
              <Table className="w-full">
                <TableHeader>
                  <TableRow className="bg-gray-100">
                    <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">First Name</TableHead>
                    <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Middle Name</TableHead>
                    <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Family Name</TableHead>
                    <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Date of Birth</TableHead>
                    <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Gender</TableHead>
                    {isEditing && <TableHead className="text-[#4f5863] text-[13px] font-medium p-3 w-16">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formData.children.map((child) => (
                    <TableRow key={child.id} className="border-b border-gray-200">
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
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {isEditing && formData.children.length === 0 && (
            <Button variant="outline" size="sm" onClick={addChild} data-testid="button-add-first-child">
              <Plus className="h-4 w-4 mr-1" /> Add Child
            </Button>
          )}

          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-medium mb-3" style={{ color: '#16569e' }}>Next of Kin</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs text-gray-500 tracking-wide">First Name</Label>
                {isEditing ? (
                  <Input value={formData.nokFirstName} onChange={(e) => updateFormData('nokFirstName', e.target.value)} className="mt-1" data-testid="input-nok-first-name" />
                ) : (
                  <div className="mt-1 text-sm text-gray-900">{formData.nokFirstName}</div>
                )}
              </div>
              <div>
                <Label className="text-xs text-gray-500 tracking-wide">Middle Name</Label>
                {isEditing ? (
                  <Input value={formData.nokMiddleName} onChange={(e) => updateFormData('nokMiddleName', e.target.value)} className="mt-1" data-testid="input-nok-middle-name" />
                ) : (
                  <div className="mt-1 text-sm text-gray-900">{formData.nokMiddleName}</div>
                )}
              </div>
              <div>
                <Label className="text-xs text-gray-500 tracking-wide">Family Name</Label>
                {isEditing ? (
                  <Input value={formData.nokFamilyName} onChange={(e) => updateFormData('nokFamilyName', e.target.value)} className="mt-1" data-testid="input-nok-family-name" />
                ) : (
                  <div className="mt-1 text-sm text-gray-900">{formData.nokFamilyName}</div>
                )}
              </div>
              <div>
                <Label className="text-xs text-gray-500 tracking-wide">Relationship</Label>
                {isEditing ? (
                  <Input value={formData.nokRelationship} onChange={(e) => updateFormData('nokRelationship', e.target.value)} className="mt-1" data-testid="input-nok-relationship" />
                ) : (
                  <div className="mt-1 text-sm text-gray-900">{formData.nokRelationship}</div>
                )}
              </div>
              <div>
                <Label className="text-xs text-gray-500 tracking-wide">Telephone</Label>
                {isEditing ? (
                  <Input value={formData.nokTelephone} onChange={(e) => updateFormData('nokTelephone', e.target.value)} className="mt-1" data-testid="input-nok-telephone" />
                ) : (
                  <div className="mt-1 text-sm text-gray-900">{formData.nokTelephone}</div>
                )}
              </div>
              <div>
                <Label className="text-xs text-gray-500 tracking-wide">Email</Label>
                {isEditing ? (
                  <Input type="email" value={formData.nokEmail} onChange={(e) => updateFormData('nokEmail', e.target.value)} className="mt-1" data-testid="input-nok-email" />
                ) : (
                  <div className="mt-1 text-sm text-gray-900">{formData.nokEmail}</div>
                )}
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs text-gray-500 tracking-wide">Address</Label>
                {isEditing ? (
                  <Input value={formData.nokAddress} onChange={(e) => updateFormData('nokAddress', e.target.value)} className="mt-1" data-testid="input-nok-address" />
                ) : (
                  <div className="mt-1 text-sm text-gray-900">{formData.nokAddress}</div>
                )}
              </div>
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
                <h2 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part B - Office Screening</h2>
                <div style={{ color: '#16569e' }} className="text-sm">For office use only - Crew executives processing</div>
                <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
              </div>
              <div className="text-center text-gray-500 py-12">
                Part B sections will be implemented in Phase 2
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
              <div className="text-center text-gray-500 py-12">
                Part C sections will be implemented in Phase 2
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
              const isActive = section.type === 'continuous' 
                ? activeContinuousSection === section.id
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
                  const isActive = section.type === 'continuous' 
                    ? activeContinuousSection === section.id
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
