import React, { useState, useRef, useEffect, useMemo } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowLeft, Edit, Plus, Save, Trash2, Upload, Paperclip, X, Camera, Info, MessageSquare, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { FileAttachmentDialog, type FileAttachment } from '@/components/FileAttachmentDialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { type RecruitmentCandidate, type InsertRecruitmentCandidate } from '@shared/schema';
import { useCompanyRanks } from '@/hooks/useCompanyRanks';
import { useExternalNationalities } from '@/hooks/useExternalNationalities';
import { useExternalVesselTypes } from '@/hooks/useExternalVesselTypes';
import { useExternalVessels } from '@/hooks/useExternalVessels';
import { useExternalFleetGroups } from '@/hooks/useExternalFleetGroups';
import { useExternalLanguages } from '@/hooks/useExternalLanguages';
import { useExternalCountries } from '@/hooks/useExternalCountries';
import { LicenseSelectionDialog } from '@/modules/crew-pool/LicenseSelectionDialog';
import { TrainingCourseSelectionDialog } from '@/modules/crew-pool/TrainingCourseSelectionDialog';
import { TravelDocumentSelectionDialog } from '@/modules/crew-pool/TravelDocumentSelectionDialog';
import { VisaSelectionDialog } from '@/modules/crew-pool/VisaSelectionDialog';
import type { LicenseTemplate } from '@/utils/data/licenseDceTemplates';
import type { TrainingCourseTemplate } from '@/utils/data/trainingCourseTemplates';
import type { TravelDocumentTemplate } from '@/utils/data/travelDocumentTemplates';
import type { VisaCountryTemplate } from '@/utils/data/visaCountryTemplates';

interface RecruitmentApplicationFormProps {
  candidate: RecruitmentCandidate | null;
  onClose: () => void;
}

interface FormData {
  // A1.1 General Particulars
  uploadedPhoto: string; // Base64 encoded photo data
  firstName: string;
  middleName: string;
  familyName: string;
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
  children: Array<{
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

  // A2.1 Travel and Identification Documents
  documents: Array<{
    id: string;
    documentId?: string;  // Template ID for duplicate detection
    document: string;
    number: string;
    issued: string;
    expiry: string;
    issuingAuthority: string;
    attachments?: FileAttachment[];
  }>;

  // A2.2 Visas
  visas: Array<{
    id: string;
    countryId?: string;  // Template ID for duplicate detection
    issuingCountry: string;
    serialNo: string;
    issued: string;
    expiry: string;
    visaType: string;
    attachments?: FileAttachment[];
  }>;

  // A3.1 Education
  education: Array<{
    id: string;
    dateOfCompletion: string;
    schoolCollegeUniversity: string;
    subjectsField: string;
    qualifications: string;
    attachments?: FileAttachment[];
  }>;

  // A3.2 License & DCE
  licenses: Array<{
    id: string;
    licenseId?: string;  // Template ID for duplicate detection
    certificateDocument: string;
    abbr: string;
    requirement: string;
    certificateNo: string;
    issuingAuthority: string;
    issued: string;
    expiry: string;
    attachments?: FileAttachment[];
  }>;

  // A3.3 Training Course
  trainingCourses: Array<{
    id: string;
    courseId?: string;  // Template ID for duplicate detection
    trainingCourse: string;
    abbr: string;
    requirement: string;
    certificateNo: string;
    issuingAuthority: string;
    issued: string;
    expiry: string;
    attachments?: FileAttachment[];
  }>;

  // A4.1 Sea Service
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

  // A5 Additional Information
  additionalInfo: Array<{
    id: string;
    information: string;
    response: string;
    attachments?: FileAttachment[];
  }>;

  // Part B - Office Screening
  b1AgeMeetsCriteria: string;
  b1RankMeetsCriteria: string;
  b1CertificatesValid: string;
  b1Shortlisted: string;
  b1Comments: {[key: string]: Array<{user: string, text: string, id: string}>};
  b1Attachments: FileAttachment[];
  b1SubmittedBy: string;
  b1SubmittedDate: string;
  
  // B2 Reference Checks fields
  b2ReferenceChecksCompleted: string;
  b2CurrentEmployerFeedback: string;
  b2Comments: {[key: string]: Array<{user: string, text: string, id: string}>};
  b2References: Array<{id: string, date: string, nameDesignation: string, contactInfo: string}>;
  b2Attachments: FileAttachment[];
  b2SubmittedBy: string;
  b2SubmittedDate: string;
  
  // B3 Background Security Checks fields
  b3SecurityChecksCompleted: string;
  b3SecurityChecksResults: string;
  b3Comments: {[key: string]: Array<{user: string, text: string, id: string}>};
  b3Authorities: Array<{id: string, date: string, authority: string}>;
  b3Attachments: FileAttachment[];
  b3SubmittedBy: string;
  b3SubmittedDate: string;
  
  // B4 Authentication of Certificates & Documents fields
  b4CertificatesAuthenticated: string;
  b4AuthenticationResults: string;
  b4Comments: {[key: string]: Array<{user: string, text: string, id: string}>};
  b4Certificates: Array<{id: string, date: string, certificate: string, authority: string}>;
  b4Attachments: FileAttachment[];
  b4SubmittedBy: string;
  b4SubmittedDate: string;
  
  // B5 CES/Language Test Results fields
  b5CesTestsCompleted: string;
  b5Comments: {[key: string]: Array<{user: string, text: string, id: string}>};
  b5Tests: Array<{id: string, date: string, subject: string, score: string, result: string}>;
  b5Attachments: FileAttachment[];
  b5SubmittedBy: string;
  b5SubmittedDate: string;
  
  // B6 Interviews fields
  b6InterviewCompleted: string;
  b6Comments: {[key: string]: Array<{user: string, text: string, id: string}>};
  b6Interviews: Array<{id: string, date: string, interviewer: string, status: string, result: string, comments: string}>;
  b6InterviewComments: {[key: string]: string};
  b6Attachments: FileAttachment[];
  b6SubmittedBy: string;
  b6SubmittedDate: string;
  
  // B7 Training Needs Identified fields
  b7TrainingNeeds: Array<{id: string, training: string, identifiedBy: string, category: string, dueDate: string, comments: string}>;
  b7SubmittedBy: string;
  b7SubmittedDate: string;
  
  // B8 Short Listing fields
  b8Shortlisted: string;
  b8Comments: {[key: string]: Array<{user: string, text: string, id: string}>};
  b8Attachments: FileAttachment[];
  b8SubmittedBy: string;
  b8SubmittedDate: string;
  
  // Submit for Approval fields (after B8)
  selectedApproversForSubmission: string[];
  approvalSubmittedBy: string;
  approvalSubmittedDate: string;

  // Part C - Approval
  // C1 Approval fields
  c1Approvers: Array<{id: string, date: string, approver: string, status: string, approval: string, comments?: string}>;
  
  // C2 Suitable for fields
  c2VesselTypes: string[];
  c2FleetGroups: string[];
  
  // C3 Recruited fields
  c3RecruitmentStatus: string;
  c3AssignedGroups: string[];
  c3SubmittedBy: string;
  c3SubmittedDate: string;
}

// Helper to normalize formData before saving to ensure all arrays have proper attachments
const normalizeFormDataForSave = (data: FormData): FormData => ({
  ...data,
  additionalInfo: data.additionalInfo.map(info => ({
    ...info,
    attachments: info.attachments || []
  })),
  b1Attachments: data.b1Attachments || [],
  b2Attachments: data.b2Attachments || [],
  b3Attachments: data.b3Attachments || [],
  b4Attachments: data.b4Attachments || [],
  b5Attachments: data.b5Attachments || [],
  b6Attachments: data.b6Attachments || [],
  b8Attachments: data.b8Attachments || []
});

export const RecruitmentApplicationForm: React.FC<RecruitmentApplicationFormProps> = ({
  candidate,
  onClose
}) => {
  const [activeSection, setActiveSection] = useState('A1');
  const [activeContinuousSection, setActiveContinuousSection] = useState('A1'); // For continuous scroll sections
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Track the candidate ID for this session (fixes duplicate creation bug)
  // Initialize from prop (for editing existing) or null (for new candidate)
  const [currentCandidateId, setCurrentCandidateId] = useState<string | null>(candidate?.id || null);
  
  // Track if transfer has been completed in this session
  const transferCompletedRef = React.useRef(candidate?.status === 'Recruited');

  // Get company ranks from shared hook
  const { data: companyRanks, isLoading: ranksLoading, rankNames } = useCompanyRanks();

  // Current user from sessionStorage - reads crewUserName and crewDesignation
  // Updates dynamically when user logs in with different credentials
  const [currentUser, setCurrentUser] = useState(() => {
    const name = sessionStorage.getItem('crewUserName') || 'Unknown User';
    const position = sessionStorage.getItem('crewDesignation') || 'Unknown Position';
    return { name, position };
  });

  // Listen for sessionStorage changes (for when user logs in with different credentials)
  useEffect(() => {
    const updateCurrentUser = () => {
      const name = sessionStorage.getItem('crewUserName') || 'Unknown User';
      const position = sessionStorage.getItem('crewDesignation') || 'Unknown Position';
      setCurrentUser({ name, position });
    };

    // Listen for storage events (triggered when sessionStorage changes in another tab/window)
    window.addEventListener('storage', updateCurrentUser);
    
    // Also check periodically for changes within the same tab
    const intervalId = setInterval(updateCurrentUser, 1000);

    return () => {
      window.removeEventListener('storage', updateCurrentUser);
      clearInterval(intervalId);
    };
  }, []);

  const currentUserDisplay = `${currentUser.name}, ${currentUser.position}`;

  // Create a save-only mutation (for individual section buttons)
  const saveOnlyMutation = useMutation({
    mutationFn: (candidateData: InsertRecruitmentCandidate) => {
      if (currentCandidateId) {
        // Update existing candidate (PATCH)
        console.log('🔄 PATCH - Updating existing candidate:', currentCandidateId);
        return fetch(`/api/recruitment-candidates/${currentCandidateId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(candidateData)
        }).then(res => {
          if (!res.ok) throw new Error('Failed to update candidate');
          return res.json();
        });
      } else {
        // Create new candidate (POST)
        console.log('✨ POST - Creating new candidate');
        return fetch('/api/recruitment-candidates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(candidateData)
        }).then(res => {
          if (!res.ok) throw new Error('Failed to create candidate');
          return res.json();
        });
      }
    },
    onSuccess: async (savedCandidate) => {
      // Store the ID after first creation (fixes duplicate bug)
      if (!currentCandidateId && savedCandidate.id) {
        console.log('💾 Storing candidate ID for future updates:', savedCandidate.id);
        setCurrentCandidateId(savedCandidate.id);
      }
      
      toast({
        title: "Success",
        description: "Data saved successfully!",
      });
      
      // Only transfer if status is "Recruited" AND we haven't transferred yet in this session
      if (savedCandidate.status === 'Recruited' && !transferCompletedRef.current) {
        try {
          const transferResponse = await fetch(`/api/recruitment-candidates/${savedCandidate.id}/transfer-to-crew`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (transferResponse.ok) {
            const transferResult = await transferResponse.json();
            // Mark transfer as completed
            transferCompletedRef.current = true;
            toast({
              title: "Crew Member Created",
              description: `Successfully transferred to Crew Database with ID: ${transferResult.crewId}`,
            });
            console.log('✅ Candidate transferred to crew database:', transferResult);
          } else {
            const error = await transferResponse.json();
            toast({
              title: "Transfer Warning",
              description: `Candidate marked as Recruited but transfer to Crew Database failed: ${error.error}`,
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error('Failed to transfer recruited candidate:', error);
          toast({
            title: "Transfer Warning",
            description: "Candidate marked as Recruited but automatic transfer to Crew Database failed. Please transfer manually.",
            variant: "destructive",
          });
        }
      }
      
      // Force immediate refetch of the data
      await queryClient.refetchQueries({ queryKey: ['/api/recruitment-candidates'] });
      await queryClient.refetchQueries({ queryKey: ['/api/crew-members'] });
      // DON'T advance to next section - just save data
    },
    onError: (error) => {
      console.error('Error saving candidate:', error);
      toast({
        title: "Error",
        description: "Failed to save candidate. Please check your database connection and try again.",
        variant: "destructive",
      });
    }
  });

  // Create mutation for saving recruitment candidate (advances to next section)
  const saveMutation = useMutation({
    mutationFn: (candidateData: InsertRecruitmentCandidate) => {
      if (currentCandidateId) {
        // Update existing candidate (PATCH)
        console.log('🔄 PATCH - Updating existing candidate:', currentCandidateId);
        return fetch(`/api/recruitment-candidates/${currentCandidateId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(candidateData)
        }).then(res => {
          if (!res.ok) throw new Error('Failed to update candidate');
          return res.json();
        });
      } else {
        // Create new candidate (POST)
        console.log('✨ POST - Creating new candidate');
        return fetch('/api/recruitment-candidates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(candidateData)
        }).then(res => {
          if (!res.ok) throw new Error('Failed to create candidate');
          return res.json();
        });
      }
    },
    onSuccess: async (savedCandidate) => {
      // Store the ID after first creation (fixes duplicate bug)
      if (!currentCandidateId && savedCandidate.id) {
        console.log('💾 Storing candidate ID for future updates:', savedCandidate.id);
        setCurrentCandidateId(savedCandidate.id);
      }
      
      toast({
        title: "Success",
        description: "Candidate saved successfully!",
      });
      // Force immediate refetch of the data
      await queryClient.refetchQueries({ queryKey: ['/api/recruitment-candidates'] });
      
      // Advance to next section or close if at the end
      const nextSection = getNextSection(activeSection);
      if (nextSection) {
        setActiveSection(nextSection);
      } else {
        onClose(); // Close only if at the last section
      }
    },
    onError: (error) => {
      console.error('Error saving candidate:', error);
      toast({
        title: "Error",
        description: "Failed to save candidate. Please check your database connection and try again.",
        variant: "destructive",
      });
    }
  });

  // Helper function to determine status based on section
  const getStatusForSection = (section: string, isMainSubmit: boolean = false) => {
    // If already at final status, don't change
    if (candidate?.status && ['Recruited', 'Waitlisted', 'Rejected'].includes(candidate.status)) {
      return candidate.status;
    }

    if (section === 'A5' && isMainSubmit) {
      return 'Applied'; // A5 Submit for Screening
    }
    if (section.startsWith('B') && !isMainSubmit) {
      return 'Screening'; // Any Part B section submit
    }
    if (section === 'B' && isMainSubmit) {
      return 'For Approval'; // Part B main Submit for Approval
    }
    if (section === 'C' && isMainSubmit) {
      // C3 decisions will be handled separately
      return candidate?.status || 'For Approval';
    }
    
    // Default: keep current status or Draft
    return candidate?.status || 'Draft';
  };

  // Handle C3 final decision submit
  const handleC3Submit = () => {
    if (!formData.firstName || !formData.familyName) {
      toast({
        title: "Validation Error",
        description: "Please fill in at least First Name and Family Name before saving.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.c3RecruitmentStatus) {
      toast({
        title: "Validation Error",
        description: "Please select a recruitment decision (Yes, Waitlist, or Rejected) before submitting.",
        variant: "destructive",
      });
      return;
    }

    // Map C3 radio button values to database status values
    const statusMapping: {[key: string]: string} = {
      'Yes': 'Recruited',
      'Waitlist': 'Waitlisted', 
      'Rejected': 'Rejected'
    };

    const finalStatus = statusMapping[formData.c3RecruitmentStatus];

    // Use existing file number (generated during A5 Submit for Screening)
    const fileNo = candidate?.fileNo || formData.fileNo || '';
    
    const candidateData: InsertRecruitmentCandidate = {
      id: currentCandidateId || new Date().toISOString().split('T')[0] + '-' + Date.now(),
      fileNo: fileNo,
      firstName: formData.firstName,
      middleName: formData.middleName || '',
      familyName: formData.familyName,
      dob: formData.dateOfBirth || '',
      nationality: formData.nationality || '',
      rankAppliedFor: formData.rankAppliedFor || '',
      presentRank: formData.presentRank || '',
      vesselType: Array.isArray(formData.vesselType) ? formData.vesselType.join(', ') : formData.vesselType || '',
      status: finalStatus, // Set final recruitment status
      applicationData: JSON.stringify(normalizeFormDataForSave({
        ...formData,
        c3SubmittedDate: new Date().toLocaleDateString()
      }))
    };

    // Use the save-only mutation for final decision
    saveOnlyMutation.mutate(candidateData);
  };

  // Handle save only (without closing form or advancing)
  const handleSaveOnly = () => {
    if (!formData.firstName || !formData.familyName) {
      toast({
        title: "Validation Error",
        description: "Please fill in at least First Name and Family Name before saving.",
        variant: "destructive",
      });
      return;
    }

    // Use existing file number (generated during A5 Submit for Screening)
    const fileNo = candidate?.fileNo || formData.fileNo || '';
    
    const candidateData: InsertRecruitmentCandidate = {
      id: currentCandidateId || new Date().toISOString().split('T')[0] + '-' + Date.now(),
      fileNo: fileNo,
      firstName: formData.firstName,
      middleName: formData.middleName || '',
      familyName: formData.familyName,
      dob: formData.dateOfBirth || '',
      nationality: formData.nationality || '',
      rankAppliedFor: formData.rankAppliedFor || '',
      presentRank: formData.presentRank || '',
      vesselType: Array.isArray(formData.vesselType) ? formData.vesselType.join(', ') : formData.vesselType || '',
      status: getStatusForSection(activeSection, false), // Individual section submits
      applicationData: JSON.stringify(normalizeFormDataForSave(formData))
    };

    // Use the save-only mutation (doesn't advance to next section)
    saveOnlyMutation.mutate(candidateData);
  };

  // Handle save and continue
  const handleSaveAndContinue = () => {
    if (!formData.firstName || !formData.familyName) {
      toast({
        title: "Validation Error",
        description: "Please fill in at least First Name and Family Name before saving.",
        variant: "destructive",
      });
      return;
    }

    // Use existing file number (generated during A5 Submit for Screening)
    const fileNo = candidate?.fileNo || formData.fileNo || '';
    
    const candidateData: InsertRecruitmentCandidate = {
      id: currentCandidateId || new Date().toISOString().split('T')[0] + '-' + Date.now(),
      fileNo: fileNo,
      firstName: formData.firstName,
      middleName: formData.middleName || null,
      familyName: formData.familyName,
      dob: formData.dateOfBirth,
      nationality: formData.nationality,
      rankAppliedFor: formData.rankAppliedFor,
      presentRank: formData.presentRank,
      vesselType: formData.vesselType.join(', ') || '', // Join array to string for backend
      status: getStatusForSection(activeSection, true), // Main section submits
      applicationData: JSON.stringify(normalizeFormDataForSave(formData)) // Save all form data as JSON
    };

    console.log('🔥 Saving form data - additionalInfo:', formData.additionalInfo);
    console.log('🔥 Complete form data:', formData);

    saveMutation.mutate(candidateData);
  };

  // Handle A5 submit for screening - special case to navigate to B
  const handleA5SubmitForScreening = async () => {
    if (!formData.firstName || !formData.familyName) {
      toast({
        title: "Validation Error", 
        description: "Please fill in at least First Name and Family Name before saving.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Generate file number for new candidates who don't have one yet
      // File No format: R-YYYY-0001 (sequential, resets each year)
      let fileNo = candidate?.fileNo || formData.fileNo;
      
      // Only generate new file number if candidate doesn't have one (first time submitting for screening)
      const needsNewFileNo = !fileNo || !fileNo.startsWith('R-');
      if (needsNewFileNo) {
        const fileNoResponse = await fetch('/api/recruitment-candidates/next-file-number');
        if (!fileNoResponse.ok) {
          throw new Error('Failed to generate file number');
        }
        const fileNoData = await fileNoResponse.json();
        fileNo = fileNoData.fileNo;
      }
      
      const candidateData: InsertRecruitmentCandidate = {
        id: currentCandidateId || new Date().toISOString().split('T')[0] + '-' + Date.now(),
        fileNo: fileNo,
        firstName: formData.firstName,
        middleName: formData.middleName || null,
        familyName: formData.familyName,
        dob: formData.dateOfBirth,
        nationality: formData.nationality,
        rankAppliedFor: formData.rankAppliedFor,
        presentRank: formData.presentRank,
        vesselType: formData.vesselType.join(', ') || '', // Join array to string for backend
        status: getStatusForSection('A5', true), // A5 Submit for Screening
        applicationData: JSON.stringify(normalizeFormDataForSave({ ...formData, fileNo })) // Save all form data as JSON including fileNo
      };

      console.log('🔥 A5 Submit for Screening - saving form data:', formData);
      console.log('📋 Generated File No:', fileNo);

      // Handle the save and navigation manually for A5
      if (currentCandidateId) {
        // Update existing candidate (PATCH)
        console.log('🔄 PATCH - Updating existing candidate:', currentCandidateId);
        const res = await fetch(`/api/recruitment-candidates/${currentCandidateId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(candidateData)
        });
        
        if (!res.ok) throw new Error('Failed to update candidate');
        
        // Update form data with the generated file number for subsequent saves
        if (needsNewFileNo) {
          updateFormData('fileNo', fileNo);
        }
        
        toast({
          title: "Success",
          description: "Candidate submitted for screening successfully!",
        });
        // Force immediate refetch of the data
        queryClient.refetchQueries({ queryKey: ['/api/recruitment-candidates'] });
        // Navigate specifically to Part B for A5 submissions and clear continuous section highlighting
        setActiveSection('B');
        setActiveContinuousSection(''); // Clear continuous section highlighting
      } else {
        // Create new candidate (POST)
        console.log('✨ POST - Creating new candidate');
        const res = await fetch('/api/recruitment-candidates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(candidateData)
        });
        
        if (!res.ok) throw new Error('Failed to create candidate');
        const savedCandidate = await res.json();
        
        // Store the ID after first creation (fixes duplicate bug)
        if (savedCandidate.id) {
          console.log('💾 Storing candidate ID for future updates:', savedCandidate.id);
          setCurrentCandidateId(savedCandidate.id);
        }
        
        // Update form data with the generated file number for subsequent saves
        if (needsNewFileNo) {
          updateFormData('fileNo', fileNo);
        }
        
        toast({
          title: "Success",
          description: "Candidate submitted for screening successfully!",
        });
        // Force immediate refetch of the data
        queryClient.refetchQueries({ queryKey: ['/api/recruitment-candidates'] });
        // Navigate specifically to Part B for A5 submissions and clear continuous section highlighting
        setActiveSection('B');
        setActiveContinuousSection(''); // Clear continuous section highlighting
      }
    } catch (error) {
      console.error('Error saving candidate:', error);
      toast({
        title: "Error",
        description: "Failed to save candidate. Please check your database connection and try again.",
        variant: "destructive",
      });
    }
  };

  const [editingSections, setEditingSections] = useState({
    'A1.1': false,
    'A1.2': false,
    'A1.3': false,
  });

  // Refs for click outside detection
  const sectionA11Ref = useRef<HTMLDivElement>(null);
  const sectionA12Ref = useRef<HTMLDivElement>(null);
  const sectionA13Ref = useRef<HTMLDivElement>(null);

  // State for uploaded photo
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  // State for editing/new comment UI only (not for data storage)
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
  const [editingB6InterviewComment, setEditingB6InterviewComment] = useState<string | null>(candidate ? '1' : null);
  const [editingB8Comment, setEditingB8Comment] = useState<string | null>(null);
  const [newB8Comment, setNewB8Comment] = useState<{[key: string]: string}>({});

  // Dialog states for Add from Database functionality
  const [isLicenseDialogOpen, setIsLicenseDialogOpen] = useState(false);
  const [isTrainingDialogOpen, setIsTrainingDialogOpen] = useState(false);
  const [isTravelDocDialogOpen, setIsTravelDocDialogOpen] = useState(false);
  const [isVisaDialogOpen, setIsVisaDialogOpen] = useState(false);
  const [isB7TrainingDialogOpen, setIsB7TrainingDialogOpen] = useState(false);
  
  // Attachment dialog state - stores the id and type of item being edited
  const [attachmentDialog, setAttachmentDialog] = useState<{
    open: boolean;
    type: 'document' | 'visa' | 'education' | 'license' | 'training' | 'seaService' | 'additionalInfo' | 'b1' | 'b2' | 'b3' | 'b4' | 'b5' | 'b6' | 'b8' | null;
    itemId: string | null;
    itemName: string;
  }>({ open: false, type: null, itemId: null, itemName: '' });

  // Mapping for interviewer values to display names
  const interviewerDisplayNames: {[key: string]: string} = {
    'capt-nick': 'Capt. Nick, Marine Superintendent',
    'john-doe': 'John Doe, HR Manager', 
    'sarah-smith': 'Sarah Smith, Technical Manager'
  };

  // Parse saved application data if editing existing candidate
  const savedData = candidate?.applicationData ? (() => {
    try {
      return JSON.parse(candidate.applicationData);
    } catch {
      return {};
    }
  })() : {};

  const [formData, setFormData] = useState<FormData>({
    // Initialize with candidate data or empty for new candidates
    uploadedPhoto: savedData.uploadedPhoto || '', // Load saved photo
    firstName: candidate?.firstName || '',
    middleName: candidate?.middleName || '',
    familyName: candidate?.familyName || '',
    nationality: candidate?.nationality || '',
    presentRank: candidate?.presentRank || '',
    vesselType: (() => {
      // Handle both string and array formats for vesselType
      const candidateVessel = candidate?.vesselType;
      const savedVessel = savedData.vesselType;
      
      if (candidateVessel) {
        return typeof candidateVessel === 'string' ? candidateVessel.split(', ').filter(Boolean) : candidateVessel;
      }
      if (savedVessel) {
        return Array.isArray(savedVessel) ? savedVessel : savedVessel.split(', ').filter(Boolean);
      }
      return [];
    })(),
    dateOfBirth: candidate?.dob || '',
    placeOfBirthCity: savedData.placeOfBirthCity || '',
    placeOfBirthCountry: savedData.placeOfBirthCountry || '',
    ageInYears: savedData.ageInYears || '',
    heightCm: savedData.heightCm || '',
    weightKg: savedData.weightKg || '',
    nativeLanguage: savedData.nativeLanguage || '',
    foreignLanguages: savedData.foreignLanguages || '',
    englishProficiency: savedData.englishProficiency || '',
    rankAppliedFor: candidate?.rankAppliedFor || '',
    manningAgent: savedData.manningAgent || '',
    fileNo: candidate?.fileNo || '',
    
    // A1.2 Address & Contact Info - load from saved data
    countryOfResidence: savedData.countryOfResidence || '',
    nearestAirport: savedData.nearestAirport || '',
    residentialAddressLine1: savedData.residentialAddressLine1 || '',
    residentialAddressLine2: savedData.residentialAddressLine2 || '',
    contactLandline: savedData.contactLandline || '',
    mobile: savedData.mobile || '',
    email: savedData.email || '',
    
    // A1.3 Family and NOK - load from saved data  
    maritalStatus: savedData.maritalStatus || '',
    numberOfDependentChildren: savedData.numberOfDependentChildren || '',
    fatherName: savedData.fatherName || '',
    motherName: savedData.motherName || '',
    spouseFirstName: savedData.spouseFirstName || '',
    spouseMiddleName: savedData.spouseMiddleName || '',
    spouseFamilyName: savedData.spouseFamilyName || '',
    spouseDateOfBirth: savedData.spouseDateOfBirth || '',
    children: savedData.children || [],
    nokFirstName: savedData.nokFirstName || '',
    nokMiddleName: savedData.nokMiddleName || '',
    nokFamilyName: savedData.nokFamilyName || '',
    nokTelephone: savedData.nokTelephone || '',
    nokEmail: savedData.nokEmail || '',
    nokAddress: savedData.nokAddress || '',
    nokRelationship: savedData.nokRelationship || '',
    
    // A2.1 Documents - load from saved data
    documents: savedData.documents || [],
    
    // A2.2 Visas - load from saved data
    visas: savedData.visas || [],
    
    // A3.1 Education - load from saved data
    education: savedData.education || [],
    
    // A3.2 Licenses - load from saved data
    licenses: savedData.licenses || [],
    
    // A3.3 Training courses - load from saved data
    trainingCourses: savedData.trainingCourses || [],
    
    // A4.1 Sea service - load from saved data
    seaService: savedData.seaService || [],

    // A5 Additional information - load from saved data (normalize to include attachments)
    additionalInfo: (savedData.additionalInfo || []).map((info: { id: string; information: string; response: string; attachments?: FileAttachment[] }) => ({
      ...info,
      attachments: info.attachments || []
    })),

    // Part B - Office Screening - load from saved data
    b1AgeMeetsCriteria: savedData.b1AgeMeetsCriteria || '',
    b1RankMeetsCriteria: savedData.b1RankMeetsCriteria || '',
    b1CertificatesValid: savedData.b1CertificatesValid || '',
    b1Shortlisted: savedData.b1Shortlisted || '',
    b1Comments: savedData.b1Comments || {},
    b1Attachments: savedData.b1Attachments || [],
    b1SubmittedBy: savedData.b1SubmittedBy || '',
    b1SubmittedDate: savedData.b1SubmittedDate || '',
    
    // B2 Reference Checks - load from saved data
    b2ReferenceChecksCompleted: savedData.b2ReferenceChecksCompleted || '',
    b2CurrentEmployerFeedback: savedData.b2CurrentEmployerFeedback || '',
    b2Comments: savedData.b2Comments || {},
    b2References: savedData.b2References || [{ id: '1', date: '', nameDesignation: '', contactInfo: '' }],
    b2Attachments: savedData.b2Attachments || [],
    b2SubmittedBy: savedData.b2SubmittedBy || '',
    b2SubmittedDate: savedData.b2SubmittedDate || '',
    
    // B3 Background Security Checks - load from saved data
    b3SecurityChecksCompleted: savedData.b3SecurityChecksCompleted || '',
    b3SecurityChecksResults: savedData.b3SecurityChecksResults || '',
    b3Comments: savedData.b3Comments || {},
    b3Authorities: savedData.b3Authorities || [{ id: '1', date: '', authority: '' }],
    b3Attachments: savedData.b3Attachments || [],
    b3SubmittedBy: savedData.b3SubmittedBy || '',
    b3SubmittedDate: savedData.b3SubmittedDate || '',
    
    // B4 Authentication of Certificates & Documents - load from saved data
    b4CertificatesAuthenticated: savedData.b4CertificatesAuthenticated || '',
    b4AuthenticationResults: savedData.b4AuthenticationResults || '',
    b4Comments: savedData.b4Comments || {},
    b4Certificates: savedData.b4Certificates || [{ id: '1', date: '', certificate: '', authority: '' }],
    b4Attachments: savedData.b4Attachments || [],
    b4SubmittedBy: savedData.b4SubmittedBy || '',
    b4SubmittedDate: savedData.b4SubmittedDate || '',
    
    // B5 CES/Language Test Results - load from saved data
    b5CesTestsCompleted: savedData.b5CesTestsCompleted || '',
    b5Comments: savedData.b5Comments || {},
    b5Tests: savedData.b5Tests || [{ id: '1', date: '', subject: '', score: '', result: '' }],
    b5Attachments: savedData.b5Attachments || [],
    b5SubmittedBy: savedData.b5SubmittedBy || '',
    b5SubmittedDate: savedData.b5SubmittedDate || '',
    
    // B6 Interviews - load from saved data
    b6InterviewCompleted: savedData.b6InterviewCompleted || '',
    b6Comments: savedData.b6Comments || {},
    b6Interviews: savedData.b6Interviews || [{ id: '1', date: '', interviewer: '', status: '', result: '', comments: '' }],
    b6InterviewComments: savedData.b6InterviewComments || {},
    b6Attachments: savedData.b6Attachments || [],
    b6SubmittedBy: savedData.b6SubmittedBy || '',
    b6SubmittedDate: savedData.b6SubmittedDate || '',
    
    // B7 Training Needs Identified - load from saved data
    b7TrainingNeeds: savedData.b7TrainingNeeds || [],
    b7SubmittedBy: savedData.b7SubmittedBy || '',
    b7SubmittedDate: savedData.b7SubmittedDate || '',
    
    // B8 Short Listing - load from saved data
    b8Shortlisted: savedData.b8Shortlisted || '',
    b8Comments: savedData.b8Comments || {},
    b8Attachments: savedData.b8Attachments || [],
    b8SubmittedBy: savedData.b8SubmittedBy || '',
    b8SubmittedDate: savedData.b8SubmittedDate || '',
    
    // Submit for Approval - load from saved data
    selectedApproversForSubmission: savedData.selectedApproversForSubmission || [],
    approvalSubmittedBy: savedData.approvalSubmittedBy || '',
    approvalSubmittedDate: savedData.approvalSubmittedDate || '',

    // Part C - Approval - load from saved data
    // C1 Approval
    c1Approvers: savedData.c1Approvers || [{ id: '1', date: '', approver: '', status: '', approval: '', comments: '' }],
    
    // C2 Suitable for
    c2VesselTypes: savedData.c2VesselTypes || [],
    c2FleetGroups: savedData.c2FleetGroups || [],
    
    // C3 Recruited - only load saved value if it was explicitly set by user, otherwise start unchecked
    c3RecruitmentStatus: savedData.c3RecruitmentStatus && savedData.c3SubmittedDate ? savedData.c3RecruitmentStatus : '',
    c3AssignedGroups: savedData.c3AssignedGroups || [],
    c3SubmittedBy: savedData.c3SubmittedBy || '',
    c3SubmittedDate: savedData.c3SubmittedDate || ''
  });

  // Use ref to track editing sections to avoid re-render loops
  const editingSectionsRef = useRef(editingSections);
  editingSectionsRef.current = editingSections;

  // Handle click outside to auto-save sections
  // PERFORMANCE FIX: Use ref instead of state in dependency array to prevent infinite loops
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Check if the click is on a dropdown portal or select content
      const isDropdownClick = (target as Element)?.closest('[data-radix-select-content]') || 
                             (target as Element)?.closest('[data-radix-select-trigger]') ||
                             (target as Element)?.closest('[data-radix-popper-content-wrapper]');
      
      if (isDropdownClick) {
        return; // Don't auto-save if clicking on dropdown elements
      }
      
      // Use ref to get current state without causing re-renders
      const currentEditingSections = editingSectionsRef.current;
      
      // Check if click is outside section A1.1
      if (currentEditingSections['A1.1'] && sectionA11Ref.current && !sectionA11Ref.current.contains(target)) {
        setEditingSections(prev => ({ ...prev, 'A1.1': false }));
      }
      
      // Check if click is outside section A1.2
      if (currentEditingSections['A1.2'] && sectionA12Ref.current && !sectionA12Ref.current.contains(target)) {
        setEditingSections(prev => ({ ...prev, 'A1.2': false }));
      }
      
      // Check if click is outside section A1.3
      if (currentEditingSections['A1.3'] && sectionA13Ref.current && !sectionA13Ref.current.contains(target)) {
        setEditingSections(prev => ({ ...prev, 'A1.3': false }));
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []); // Empty dependency array - uses ref to access current state

  // Refs for A1-A5 sections for intersection observer
  const a1Ref = useRef<HTMLDivElement>(null);
  const a2Ref = useRef<HTMLDivElement>(null);
  const a3Ref = useRef<HTMLDivElement>(null);
  const a4Ref = useRef<HTMLDivElement>(null);
  const a5Ref = useRef<HTMLDivElement>(null);

  const sections = [
    { id: 'A1', title: 'Seafarers\' Particulars', number: 'A1', type: 'continuous', ref: a1Ref },
    { id: 'A2', title: 'Travel & ID Documents', number: 'A2', type: 'continuous', ref: a2Ref },
    { id: 'A3', title: 'Training & Certificates', number: 'A3', type: 'continuous', ref: a3Ref },
    { id: 'A4', title: 'Sea Service', number: 'A4', type: 'continuous', ref: a4Ref },
    { id: 'A5', title: 'Additional Information', number: 'A5', type: 'continuous', ref: a5Ref },
    { id: 'B', title: 'Company Processing', number: 'B', type: 'stepper' },
    { id: 'C', title: 'Approval', number: 'C', type: 'stepper' }
  ];

  // Intersection Observer for continuous sections
  useEffect(() => {
    // Only set up observer for continuous sections (A1-A5)
    if (activeSection === 'B' || activeSection === 'C') return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the entry with the highest intersection ratio
        let mostVisible = entries[0];
        entries.forEach(entry => {
          if (entry.intersectionRatio > mostVisible.intersectionRatio) {
            mostVisible = entry;
          }
        });

        // Update the active continuous section if there's a significant intersection
        if (mostVisible && mostVisible.intersectionRatio > 0.1) {
          const sectionId = mostVisible.target.getAttribute('data-section-id');
          if (sectionId && sectionId !== activeContinuousSection) {
            setActiveContinuousSection(sectionId);
          }
        }
      },
      {
        root: null,
        rootMargin: '-50px 0px -50px 0px',
        threshold: [0, 0.1, 0.3, 0.5, 0.7, 1.0]
      }
    );

    // Observe all A sections when in continuous mode
    const continuousSections = sections.filter(s => s.type === 'continuous');
    continuousSections.forEach(section => {
      if (section.ref?.current) {
        observer.observe(section.ref.current);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [activeSection, activeContinuousSection, sections]);

  // Function to scroll to a specific section
  const scrollToSection = (sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (section && section.ref?.current) {
      section.ref.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  // Function to handle section navigation
  const handleSectionNavigation = (sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;

    if (section.type === 'continuous') {
      // For continuous sections, stay in the continuous view and scroll to section
      if (activeSection !== 'A1') {
        setActiveSection('A1'); // Switch to continuous view
      }
      setTimeout(() => scrollToSection(sectionId), 100); // Small delay to ensure DOM is ready
    } else {
      // For stepper sections, use traditional navigation and clear continuous section highlighting
      setActiveSection(sectionId);
      setActiveContinuousSection(''); // Clear continuous section highlighting
    }
  };

  // Function to get the next section for "Save & Continue"
  const getNextSection = (currentSection: string) => {
    const currentIndex = sections.findIndex(section => section.id === currentSection);
    if (currentIndex >= 0 && currentIndex < sections.length - 1) {
      return sections[currentIndex + 1].id;
    }
    return null; // Already at last section
  };

  const toggleEditSection = (sectionId: 'A1.1' | 'A1.2' | 'A1.3') => {
    setEditingSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const updateFormData = (field: keyof FormData, value: string) => {
    setFormData(prev => {
      const newData = {
        ...prev,
        [field]: value
      };
      
      // Auto-calculate age when date of birth changes
      if (field === 'dateOfBirth' && value) {
        const birthDate = new Date(value);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          newData.ageInYears = (age - 1).toString();
        } else {
          newData.ageInYears = age.toString();
        }
      }
      
      return newData;
    });
  };

  const addChild = () => {
    setFormData(prev => ({
      ...prev,
      children: [...prev.children, {
        firstName: '',
        middleName: '',
        familyName: '',
        dateOfBirth: '',
        gender: ''
      }]
    }));
  };

  const removeChild = (index: number) => {
    setFormData(prev => ({
      ...prev,
      children: prev.children.filter((_, i) => i !== index)
    }));
  };

  const updateChild = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      children: prev.children.map((child, i) => 
        i === index ? { ...child, [field]: value } : child
      )
    }));
  };

  // Helper function to get next unique ID based on prefix
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

  // Document management functions
  const addDocument = () => {
    setFormData(prev => {
      const newDoc = {
        id: getNextId(prev.documents, 'DOC'),
        document: '',
        number: '',
        issued: '',
        expiry: '',
        issuingAuthority: ''
      };
      return {
        ...prev,
        documents: [...prev.documents, newDoc]
      };
    });
  };

  const removeDocument = (id: string) => {
    setFormData(prev => ({
      ...prev,
      documents: prev.documents.filter(doc => doc.id !== id)
    }));
  };

  const updateDocument = (id: string, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      documents: prev.documents.map(doc => 
        doc.id === id ? { ...doc, [field]: value } : doc
      )
    }));
  };

  // Visa management functions
  const addVisa = () => {
    setFormData(prev => {
      const newVisa = {
        id: getNextId(prev.visas, 'VIS'),
        issuingCountry: '',
        serialNo: '',
        issued: '',
        expiry: '',
        visaType: ''
      };
      return {
        ...prev,
        visas: [...prev.visas, newVisa]
      };
    });
  };

  const removeVisa = (id: string) => {
    setFormData(prev => ({
      ...prev,
      visas: prev.visas.filter(visa => visa.id !== id)
    }));
  };

  const updateVisa = (id: string, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      visas: prev.visas.map(visa => 
        visa.id === id ? { ...visa, [field]: value } : visa
      )
    }));
  };

  // Education management functions
  const addEducation = () => {
    setFormData(prev => {
      const newEducation = {
        id: getNextId(prev.education, 'EDU'),
        dateOfCompletion: '',
        schoolCollegeUniversity: '',
        subjectsField: '',
        qualifications: ''
      };
      return {
        ...prev,
        education: [...prev.education, newEducation]
      };
    });
  };

  const removeEducation = (id: string) => {
    setFormData(prev => ({
      ...prev,
      education: prev.education.filter(edu => edu.id !== id)
    }));
  };

  const updateEducation = (id: string, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      education: prev.education.map(edu => 
        edu.id === id ? { ...edu, [field]: value } : edu
      )
    }));
  };

  // License management functions
  const addLicense = () => {
    setFormData(prev => {
      const newLicense = {
        id: getNextId(prev.licenses, 'LIC'),
        certificateDocument: '',
        abbr: '',
        requirement: '',
        certificateNo: '',
        issuingAuthority: '',
        issued: '',
        expiry: ''
      };
      return {
        ...prev,
        licenses: [...prev.licenses, newLicense]
      };
    });
  };

  const removeLicense = (id: string) => {
    setFormData(prev => ({
      ...prev,
      licenses: prev.licenses.filter(license => license.id !== id)
    }));
  };

  const updateLicense = (id: string, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      licenses: prev.licenses.map(license => 
        license.id === id ? { ...license, [field]: value } : license
      )
    }));
  };

  // Training Course management functions
  const addTrainingCourse = () => {
    setFormData(prev => {
      const newCourse = {
        id: getNextId(prev.trainingCourses, 'TRN'),
        trainingCourse: '',
        abbr: '',
        requirement: '',
        certificateNo: '',
        issuingAuthority: '',
        issued: '',
        expiry: ''
      };
      return {
        ...prev,
        trainingCourses: [...prev.trainingCourses, newCourse]
      };
    });
  };

  const removeTrainingCourse = (id: string) => {
    setFormData(prev => ({
      ...prev,
      trainingCourses: prev.trainingCourses.filter(course => course.id !== id)
    }));
  };

  const updateTrainingCourse = (id: string, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      trainingCourses: prev.trainingCourses.map(course => 
        course.id === id ? { ...course, [field]: value } : course
      )
    }));
  };

  // Helper to get max ID number from items with a given prefix
  const getMaxIdNum = (items: Array<{id: string}>, prefix: string): number => {
    const existingNums = items
      .map(item => {
        const match = item.id.match(new RegExp(`^${prefix}-(\\d+)$`));
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => n > 0);
    return existingNums.length > 0 ? Math.max(...existingNums) : 0;
  };

  // Add from Database handlers
  const addLicensesFromDatabase = (selectedLicenses: LicenseTemplate[]) => {
    setFormData(prev => {
      const existingLicenses = prev.licenses.filter(l => l.certificateDocument.trim() !== '');
      const maxId = getMaxIdNum(prev.licenses, 'LIC');
      const newLicenses = selectedLicenses.map((license, index) => ({
        id: `LIC-${maxId + index + 1}`,
        licenseId: license.id,
        certificateDocument: license.name,
        abbr: license.abbr || '',
        requirement: license.requirement || '',
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

  const addTrainingCoursesFromDatabase = (selectedCourses: TrainingCourseTemplate[]) => {
    setFormData(prev => {
      const existingCourses = prev.trainingCourses.filter(c => c.trainingCourse.trim() !== '');
      const maxId = getMaxIdNum(prev.trainingCourses, 'TRN');
      const newCourses = selectedCourses.map((course, index) => ({
        id: `TRN-${maxId + index + 1}`,
        courseId: course.id,
        trainingCourse: course.name,
        abbr: course.abbr || '',
        requirement: course.requirement || '',
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

  // Handler for adding training courses from database to B7 Training Needs section
  const addB7TrainingFromDatabase = (selectedCourses: TrainingCourseTemplate[]) => {
    setFormData(prev => {
      const existingNeeds = prev.b7TrainingNeeds.filter(t => t.training.trim() !== '');
      const newNeeds = selectedCourses.map((course) => ({
        id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
        training: course.name,
        identifiedBy: '',
        category: course.requirement || '',
        dueDate: '',
        comments: ''
      }));
      return {
        ...prev,
        b7TrainingNeeds: [...existingNeeds, ...newNeeds]
      };
    });
    setIsB7TrainingDialogOpen(false);
  };

  const addTravelDocsFromDatabase = (selectedDocs: TravelDocumentTemplate[]) => {
    setFormData(prev => {
      const existingDocs = prev.documents.filter(d => d.document.trim() !== '');
      const maxId = getMaxIdNum(prev.documents, 'DOC');
      const newDocs = selectedDocs.map((doc, index) => ({
        id: `DOC-${maxId + index + 1}`,
        documentId: doc.id,
        document: doc.name,
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

  const addVisasFromDatabase = (selectedCountries: VisaCountryTemplate[]) => {
    setFormData(prev => {
      const existingVisas = prev.visas.filter(v => v.issuingCountry.trim() !== '');
      const maxId = getMaxIdNum(prev.visas, 'VIS');
      const newVisas = selectedCountries.map((country, index) => ({
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

  // Attachment management helper
  const openAttachmentDialog = (
    type: 'document' | 'visa' | 'education' | 'license' | 'training' | 'seaService' | 'additionalInfo' | 'b1' | 'b2' | 'b3' | 'b4' | 'b5' | 'b6' | 'b8',
    itemId: string,
    itemName: string
  ) => {
    setAttachmentDialog({ open: true, type, itemId, itemName });
  };

  const getAttachmentsForItem = (): FileAttachment[] => {
    if (!attachmentDialog.type) return [];
    
    switch (attachmentDialog.type) {
      case 'document':
        return formData.documents.find(d => d.id === attachmentDialog.itemId)?.attachments || [];
      case 'visa':
        return formData.visas.find(v => v.id === attachmentDialog.itemId)?.attachments || [];
      case 'education':
        return formData.education.find(e => e.id === attachmentDialog.itemId)?.attachments || [];
      case 'license':
        return formData.licenses.find(l => l.id === attachmentDialog.itemId)?.attachments || [];
      case 'training':
        return formData.trainingCourses.find(t => t.id === attachmentDialog.itemId)?.attachments || [];
      case 'seaService':
        return formData.seaService.find(s => s.id === attachmentDialog.itemId)?.attachments || [];
      case 'additionalInfo':
        return formData.additionalInfo.find(a => a.id === attachmentDialog.itemId)?.attachments || [];
      case 'b1':
        return formData.b1Attachments || [];
      case 'b2':
        return formData.b2Attachments || [];
      case 'b3':
        return formData.b3Attachments || [];
      case 'b4':
        return formData.b4Attachments || [];
      case 'b5':
        return formData.b5Attachments || [];
      case 'b6':
        return formData.b6Attachments || [];
      case 'b8':
        return formData.b8Attachments || [];
      default:
        return [];
    }
  };

  const updateAttachments = (attachments: FileAttachment[]) => {
    if (!attachmentDialog.type) return;

    setFormData(prev => {
      switch (attachmentDialog.type) {
        case 'document':
          return {
            ...prev,
            documents: prev.documents.map(d =>
              d.id === attachmentDialog.itemId ? { ...d, attachments } : d
            )
          };
        case 'visa':
          return {
            ...prev,
            visas: prev.visas.map(v =>
              v.id === attachmentDialog.itemId ? { ...v, attachments } : v
            )
          };
        case 'education':
          return {
            ...prev,
            education: prev.education.map(e =>
              e.id === attachmentDialog.itemId ? { ...e, attachments } : e
            )
          };
        case 'license':
          return {
            ...prev,
            licenses: prev.licenses.map(l =>
              l.id === attachmentDialog.itemId ? { ...l, attachments } : l
            )
          };
        case 'training':
          return {
            ...prev,
            trainingCourses: prev.trainingCourses.map(t =>
              t.id === attachmentDialog.itemId ? { ...t, attachments } : t
            )
          };
        case 'seaService':
          return {
            ...prev,
            seaService: prev.seaService.map(s =>
              s.id === attachmentDialog.itemId ? { ...s, attachments } : s
            )
          };
        case 'additionalInfo':
          return {
            ...prev,
            additionalInfo: prev.additionalInfo.map(a =>
              a.id === attachmentDialog.itemId ? { ...a, attachments } : a
            )
          };
        case 'b1':
          return { ...prev, b1Attachments: attachments };
        case 'b2':
          return { ...prev, b2Attachments: attachments };
        case 'b3':
          return { ...prev, b3Attachments: attachments };
        case 'b4':
          return { ...prev, b4Attachments: attachments };
        case 'b5':
          return { ...prev, b5Attachments: attachments };
        case 'b6':
          return { ...prev, b6Attachments: attachments };
        case 'b8':
          return { ...prev, b8Attachments: attachments };
        default:
          return prev;
      }
    });
  };

  // Sea Service management functions
  const addSeaService = () => {
    setFormData(prev => {
      const newService = {
        id: getNextId(prev.seaService, 'SEA'),
        vesselName: '',
        vesselType: '',
        deadweight: '',
        engineTypePower: '',
        ownerOperator: '',
        rank: '',
        from: '',
        to: '',
        periodMonths: ''
      };
      return {
        ...prev,
        seaService: [...prev.seaService, newService]
      };
    });
  };

  const removeSeaService = (id: string) => {
    setFormData(prev => ({
      ...prev,
      seaService: prev.seaService.filter(service => service.id !== id)
    }));
  };

  const updateSeaService = (id: string, field: string, value: string) => {
    setFormData(prev => {
      const updatedServices = prev.seaService.map(service => {
        if (service.id === id) {
          const updatedService = { ...service, [field]: value };
          
          // Auto-calculate period if from or to date changes
          if (field === 'from' || field === 'to') {
            updatedService.periodMonths = calculatePeriod(updatedService.from, updatedService.to);
          }
          
          return updatedService;
        }
        return service;
      });
      
      return {
        ...prev,
        seaService: updatedServices
      };
    });
  };

  // Calculate period in months between two dates
  const calculatePeriod = (fromDate: string, toDate: string): string => {
    if (!fromDate || !toDate) return '';
    
    try {
      const from = new Date(fromDate);
      const to = new Date(toDate);
      
      if (isNaN(from.getTime()) || isNaN(to.getTime())) return '';
      
      const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
      const days = to.getDate() - from.getDate();
      
      // Add fraction for partial months
      const totalMonths = months + (days / 30);
      
      return totalMonths > 0 ? `${totalMonths.toFixed(1)}M` : '';
    } catch {
      return '';
    }
  };

  // B7 Training Needs management functions
  const addB7TrainingNeed = () => {
    const newTraining = {
      id: Date.now().toString(),
      training: '',
      identifiedBy: '',
      category: '',
      dueDate: '',
      comments: ''
    };
    setFormData(prev => ({
      ...prev,
      b7TrainingNeeds: [...prev.b7TrainingNeeds, newTraining]
    }));
  };

  const removeB7TrainingNeed = (id: string) => {
    setFormData(prev => ({
      ...prev,
      b7TrainingNeeds: prev.b7TrainingNeeds.filter(training => training.id !== id)
    }));
  };

  const updateB7TrainingNeed = (id: string, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      b7TrainingNeeds: prev.b7TrainingNeeds.map(training => 
        training.id === id ? { ...training, [field]: value } : training
      )
    }));
  };

  // Submit for Approval management functions
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

  const handleSubmitForApproval = () => {
    if (formData.selectedApproversForSubmission.length === 0) {
      toast({
        title: "No Approvers Selected",
        description: "Please select at least one approver before submitting for approval.",
        variant: "destructive",
      });
      return;
    }

    const currentDate = new Date().toLocaleDateString();
    
    // Create new C1 approver entries from selected approvers
    const newApprovers = formData.selectedApproversForSubmission.map((approverName, index) => ({
      id: `${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
      date: currentDate,
      approver: approverName,
      status: 'Review Pending',
      approval: '',
      comments: ''
    }));

    setFormData(prev => ({
      ...prev,
      // Replace any empty/placeholder approvers with the new ones, or append if there are already filled approvers
      c1Approvers: prev.c1Approvers.filter(a => a.approver && a.approver.trim() !== '').length > 0
        ? [...prev.c1Approvers.filter(a => a.approver && a.approver.trim() !== ''), ...newApprovers]
        : newApprovers,
      approvalSubmittedBy: currentUserDisplay,
      approvalSubmittedDate: currentDate
    }));

    // Save the data
    setTimeout(() => {
      handleSaveOnly();
    }, 100);

    toast({
      title: "Submitted for Approval",
      description: `Application has been submitted to ${formData.selectedApproversForSubmission.length} approver(s).`,
    });
  };

  // Part C - Approval management functions
  const addC1Approver = () => {
    const newApprover = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      date: '',
      approver: '',
      status: '',
      approval: '',
      comments: ''
    };
    setFormData(prev => ({
      ...prev,
      c1Approvers: [...prev.c1Approvers, newApprover]
    }));
  };

  const removeC1Approver = (id: string) => {
    setFormData(prev => ({
      ...prev,
      c1Approvers: prev.c1Approvers.filter(approver => approver.id !== id)
    }));
  };

  const updateC1Approver = (id: string, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      c1Approvers: prev.c1Approvers.map(approver => 
        approver.id === id ? { ...approver, [field]: value } : approver
      )
    }));
  };

  const addC2VesselType = (vesselType: string) => {
    if (!formData.c2VesselTypes.includes(vesselType)) {
      setFormData(prev => ({
        ...prev,
        c2VesselTypes: [...prev.c2VesselTypes, vesselType]
      }));
    }
  };

  const removeC2VesselType = (vesselType: string) => {
    setFormData(prev => ({
      ...prev,
      c2VesselTypes: prev.c2VesselTypes.filter(type => type !== vesselType)
    }));
  };

  const addC2FleetGroup = (fleetGroup: string) => {
    if (!formData.c2FleetGroups.includes(fleetGroup)) {
      setFormData(prev => ({
        ...prev,
        c2FleetGroups: [...prev.c2FleetGroups, fleetGroup]
      }));
    }
  };

  const removeC2FleetGroup = (fleetGroup: string) => {
    setFormData(prev => ({
      ...prev,
      c2FleetGroups: prev.c2FleetGroups.filter(group => group !== fleetGroup)
    }));
  };

  const addC3AssignedGroup = (group: string) => {
    if (!formData.c3AssignedGroups.includes(group)) {
      setFormData(prev => ({
        ...prev,
        c3AssignedGroups: [...prev.c3AssignedGroups, group]
      }));
    }
  };

  const removeC3AssignedGroup = (group: string) => {
    setFormData(prev => ({
      ...prev,
      c3AssignedGroups: prev.c3AssignedGroups.filter(g => g !== group)
    }));
  };

  // Additional Information management functions
  const addAdditionalInfo = () => {
    setFormData(prev => {
      const newId = getNextId(prev.additionalInfo, 'A5');
      const newInfo = {
        id: newId,
        information: '',
        response: '',
        attachments: []
      };
      return {
        ...prev,
        additionalInfo: [...prev.additionalInfo, newInfo]
      };
    });
  };

  const removeAdditionalInfo = (id: string) => {
    setFormData(prev => ({
      ...prev,
      additionalInfo: prev.additionalInfo.filter(info => info.id !== id)
    }));
  };

  const updateAdditionalInfo = (id: string, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      additionalInfo: prev.additionalInfo.map(info => 
        info.id === id ? { ...info, [field]: value } : info
      )
    }));
  };

  // Fetch vessel types from external API (Master 004)
  const { data: externalVesselTypesData } = useExternalVesselTypes();
  
  // Extract vessel type names from external API response
  const vesselTypeMasterData = useMemo(() => {
    // API returns 'vesseltypes' (lowercase) with vesselType field
    const vesselTypes = (externalVesselTypesData as any)?.vesseltypes || (externalVesselTypesData as any)?.vesselTypes || externalVesselTypesData || [];
    if (vesselTypes.length > 0) {
      return vesselTypes.map((vt: any) => vt.vesselType || vt.name).filter(Boolean);
    }
    return [];
  }, [externalVesselTypesData]);

  // Fetch Vessels from external API (Master 014)
  const { data: externalVesselsData, isLoading: isLoadingVessels } = useExternalVessels();

  // Fetch Fleet Groups from external API (Master 015)
  const { data: externalFleetGroupsData, isLoading: isLoadingFleetGroups } = useExternalFleetGroups();

  // Combined vessel/fleet options for C2.2 and C3.2 dropdowns
  const isLoadingVesselFleetData = isLoadingVessels || isLoadingFleetGroups;
  
  const vesselFleetOptions = useMemo(() => {
    const options: Array<{ value: string; label: string; category: 'vessel' | 'fleet' }> = [];
    const addedValues = new Set<string>(); // Track duplicates
    
    // Helper to add option if valid and not duplicate
    const addOption = (name: string, category: 'vessel' | 'fleet') => {
      const trimmedName = name?.trim();
      if (trimmedName && trimmedName.length > 0 && !addedValues.has(trimmedName)) {
        addedValues.add(trimmedName);
        options.push({ value: trimmedName, label: trimmedName, category });
      }
    };
    
    // Add vessels from external API (Master 014)
    const vessels = (externalVesselsData as any)?.vessels || externalVesselsData || [];
    vessels.forEach((v: any) => {
      const vesselName = v.vessel || v.name;
      if (vesselName) addOption(vesselName, 'vessel');
    });
    
    // Add fleet groups from external API (Master 015)
    const fleetGroups = (externalFleetGroupsData as any)?.fleetGroups || externalFleetGroupsData || [];
    fleetGroups.forEach((f: any) => {
      if (f.name) addOption(f.name, 'fleet');
    });
    
    return options;
  }, [externalVesselsData, externalFleetGroupsData]);

  // Fetch nationalities from external API (Master 001)
  const { data: externalNationalitiesData } = useExternalNationalities();
  
  // Extract nationality names from external API response
  const NATIONALITIES = useMemo(() => {
    const nationalities = (externalNationalitiesData as any)?.nationalities || externalNationalitiesData || [];
    if (nationalities.length > 0) {
      return nationalities.map((n: any) => n.nationality || n.countryName || n.name).filter(Boolean);
    }
    return [];
  }, [externalNationalitiesData]);

  // Fetch countries from external API (Master 020)
  const { data: externalCountriesData } = useExternalCountries();
  
  // Extract country names from external API response
  const countryMasterData: string[] = useMemo(() => {
    const countries = (externalCountriesData as any)?.countries || externalCountriesData || [];
    if (countries.length > 0) {
      return countries.map((c: any) => c.countryName || c.name).filter(Boolean).sort();
    }
    return [];
  }, [externalCountriesData]);

  // Fetch languages from external API (Master 019)
  const { data: externalLanguagesData } = useExternalLanguages();
  
  // Extract language names from external API response
  const languageMasterData = useMemo(() => {
    const languages = (externalLanguagesData as any)?.languages || externalLanguagesData || [];
    if (languages.length > 0) {
      return languages.map((l: any) => l.languageName || l.name).filter(Boolean);
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

  // Master data from #City Master# (placeholder until Crew Admin integration)
  const cityMasterData = [
    "Mumbai", "Delhi", "Kolkata", "Chennai", "Bangalore", "Hyderabad", "Pune", "Ahmedabad", "Surat", "Kanpur",
    "Jaipur", "Lucknow", "Nagpur", "Patna", "Indore", "Thane", "Bhopal", "Visakhapatnam", "Vadodara", "Firozabad",
    "Ludhiana", "Rajkot", "Agra", "Siliguri", "Nashik", "Faridabad", "Patiala", "Ghaziabad", "Kalyan", "Thrissur",
    "Raipur", "Kota", "Bareilly", "Mysore", "Aligarh", "Jalandhar", "Tiruchirappalli", "Bhubaneswar", "Salem", "Warangal",
    "Guntur", "Bhiwandi", "Saharanpur", "Gorakhpur", "Bikaner", "Amravati", "Noida", "Jamshedpur", "Bhilai", "Cuttack",
    "Kochi", "Udaipur", "Bhavnagar", "Dehradun", "Asansol", "Ranchi", "Rajpur", "Howrah", "Jabalpur", "Gwalior",
    "Vijayawada", "Jodhpur", "Madurai", "Raigarh", "Kurnool", "Malappuram", "Srinagar", "Aurangabad", "Dhanbad", "Amritsar",
    "Navi Mumbai", "Allahabad", "Ranchi", "Haora", "Coimbatore", "Jabalpur", "Gwalior", "Vijayawada", "Jodhpur", "Madurai",
    "Raigarh", "Kota", "Guwahati", "Chandigarh", "Solapur", "Hubli", "Tiruchirappalli", "Bareilly", "Moradabad", "Mysore",
    "Gurgaon", "Aligarh", "Jalandhar", "Tiruchirappalli", "Bhubaneswar", "Salem", "Mira-Bhayandar", "Thiruvananthapuram",
    "Bhiwandi", "Saharanpur", "Gorakhpur", "Guntur", "Bikaner", "Amravati", "Noida", "Jamshedpur", "Bhilai Nagar", "Warangal",
    "Cuttack", "Firozabad", "Kochi", "Bhavnagar", "Dehradun", "Durgapur", "Asansol", "Rourkela", "Nanded", "Kolhapur",
    "Ajmer", "Akola", "Gulbarga", "Jamnagar", "Ujjain", "Loni", "Siliguri", "Jhansi", "Ulhasnagar", "Jammu", "Sangli"
  ];


  // Rank data now comes from shared hook useCompanyRanks
  // Vessel, Fleet Groups, and Additional Groups data now comes from API queries above (vesselFleetOptions)

  const approverMasterData = [
    'Capt. Nick, Marine Superintendent',
    'John Smith, Fleet Manager', 
    'Sarah Johnson, Technical Manager',
    'David Brown, Operations Manager',
    'Lisa Wilson, Crew Manager',
    'Michael Davis, Training Manager'
  ];

  // Photo upload handling
  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid File Type",
          description: "Please select an image file (JPG, PNG, GIF)",
          variant: "destructive",
        });
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "File size must be less than 5MB",
          variant: "destructive",
        });
        return;
      }
      
      setPhotoFile(file);
      
      // Create preview URL and save to formData
      const reader = new FileReader();
      reader.onload = (e) => {
        const photoData = e.target?.result as string;
        setUploadedPhoto(photoData);
        // Save to formData so it persists when saved
        setFormData(prev => ({ ...prev, uploadedPhoto: photoData }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setUploadedPhoto(null);
    setPhotoFile(null);
    // Also remove from formData
    setFormData(prev => ({ ...prev, uploadedPhoto: '' }));
  };
  
  // Load saved photo when editing existing candidate
  useEffect(() => {
    if (formData.uploadedPhoto) {
      setUploadedPhoto(formData.uploadedPhoto);
    }
  }, [candidate?.id]);

  // Multi-select language handling
  const handleLanguageSelection = (field: 'nativeLanguage' | 'foreignLanguages', selectedLanguage: string) => {
    if (field === 'nativeLanguage') {
      // Single selection for native language
      updateFormData('nativeLanguage', selectedLanguage);
    } else {
      // Multi-selection for foreign languages
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

  // Multi-select vessel type handling
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

  const isVesselTypeSelected = (vesselType: string): boolean => {
    return formData.vesselType.includes(vesselType);
  };

  const renderA11GeneralParticulars = () => {
    const isEditing = editingSections['A1.1'];
    
    return (
      <div ref={sectionA11Ref} className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>A1.1 General Particulars</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleEditSection('A1.1')}
            className="text-gray-500 hover:text-gray-700"
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
          
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Photo Upload Area - Always available for upload */}
          <div className="lg:col-span-3 space-y-4">
            <div className="relative">
              {/* Hidden file input - always available */}
              <input
                id="photo-upload"
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              
              {uploadedPhoto ? (
                <div className="relative w-32 h-40 rounded-lg overflow-hidden border-2 border-gray-300">
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
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <label htmlFor="photo-upload" className="cursor-pointer block">
                  <div className="w-32 h-40 bg-gray-50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-colors">
                    <div className="text-center">
                      <Camera className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <div className="text-sm text-gray-500 mb-2">Upload Photo</div>
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
                  onClick={() => document.getElementById('photo-upload')?.click()}
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
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select rank" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {ranksLoading ? (
                        <SelectItem value="loading" disabled>Loading ranks...</SelectItem>
                      ) : (
                        rankNames.map(rank => (
                          <SelectItem key={rank} value={rank}>{rank}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="mt-1 text-sm text-gray-900">{formData.rankAppliedFor}</div>
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
          
          {/* Form Fields */}
          <div className="lg:col-span-9 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
            
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">Nationality</Label>
              {isEditing ? (
                <Select value={formData.nationality} onValueChange={(value) => updateFormData('nationality', value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select nationality" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {NATIONALITIES.map((nationality: string) => (
                      <SelectItem key={nationality} value={nationality}>{nationality}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="mt-1 text-sm text-gray-900">{formData.nationality}</div>
              )}
            </div>
            
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">Present Rank</Label>
              {isEditing ? (
                <Select value={formData.presentRank} onValueChange={(value) => updateFormData('presentRank', value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select rank" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {ranksLoading ? (
                      <SelectItem value="loading" disabled>Loading ranks...</SelectItem>
                    ) : (
                      rankNames.map(rank => (
                        <SelectItem key={rank} value={rank}>{rank}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <div className="mt-1 text-sm text-gray-900">{formData.presentRank}</div>
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
              <Label className="text-xs text-gray-500 tracking-wide">Native Language</Label>
              {isEditing ? (
                <Select value={formData.nativeLanguage} onValueChange={(value) => updateFormData('nativeLanguage', value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select native language" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {languageMasterData.map((language: string) => (
                      <SelectItem key={language} value={language}>{language}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="mt-1 text-sm text-gray-900">{formData.nativeLanguage}</div>
              )}
            </div>
            
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">Foreign Languages</Label>
              {isEditing ? (
                <div className="relative">
                  <Select 
                    value="" 
                    onValueChange={(value) => {
                      handleLanguageSelection('foreignLanguages', value);
                      // Prevent the select from closing by not setting a value
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
                      {languageMasterData.map((language: string) => {
                        const isSelected = isLanguageSelected('foreignLanguages', language);
                        return (
                          <SelectItem 
                            key={language} 
                            value={language} 
                            className={`cursor-pointer hover:bg-gray-50 ${isSelected ? "bg-blue-50" : ""}`}
                            onSelect={(e) => {
                              // Prevent the dropdown from closing
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
                  <SelectTrigger className="mt-1" data-testid="select-manning-agent">
                    <SelectValue placeholder="Select manning agent" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {manningAgentOptions.map((agent: any) => (
                      <SelectItem key={agent.id} value={agent.name} data-testid={`manning-agent-option-${agent.id}`}>
                        {agent.name}{agent.country ? ` (${agent.country})` : ''}
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
      </div>
    );
  };

  const renderA12AddressContact = () => {
    const isEditing = editingSections['A1.2'];
    
    return (
      <div ref={sectionA12Ref} className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>A1.2 Address & Contact Info</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleEditSection('A1.2')}
            className="text-gray-500 hover:text-gray-700"
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
          
          <div className="col-span-2">
            <Label className="text-xs text-gray-500 tracking-wide">Residential Address Line 1( House No./Building/Street )</Label>
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
          
          <div className="col-span-2">
            <Label className="text-xs text-gray-500 tracking-wide">Residential Address Line 2( City, State, PIN )</Label>
            {isEditing ? (
              <Input
                value={formData.residentialAddressLine2}
                onChange={(e) => updateFormData('residentialAddressLine2', e.target.value)}
                className="mt-1"
                placeholder="Enter city, state, PIN"
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
              />
            ) : (
              <div className="mt-1 text-sm text-gray-900">{formData.contactLandline}</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderA21TravelDocs = () => {
    return (
      <div data-section="A2" className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>A2.1 Travel and Identification Docs</h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTravelDocDialogOpen(true)}
              className="text-gray-600 border-gray-300 hover:bg-gray-50 text-xs"
              data-testid="button-add-travel-doc-from-db"
            >
              + ADD FROM DATABASE
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
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
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
                      onClick={() => openAttachmentDialog('document', doc.id, doc.document || 'Document')}
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

  const renderA22Visas = () => {
    return (
      <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>A2.2 Visas</h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsVisaDialogOpen(true)}
              className="text-gray-600 border-gray-300 hover:bg-gray-50 text-xs"
              data-testid="button-add-visa-from-db"
            >
              + ADD FROM DATABASE
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
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
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
                      onClick={() => openAttachmentDialog('visa', visa.id, visa.issuingCountry || 'Visa')}
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

  const renderA31Education = () => {
    return (
      <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>A3.1 Education</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={addEducation}
            className="text-gray-600 border-gray-300 hover:bg-gray-50"
          >
            <Plus className="h-4 w-4 mr-2" />
            ADD
          </Button>
        </div>
        
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-gray-100">
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Qualifications</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">School, College, University</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Subjects/ Field</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Date of completion</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3 w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {formData.education.map((edu) => (
              <TableRow key={edu.id} className="border-b border-gray-200">
                <TableCell className="p-3">
                  <Input
                    value={edu.qualifications}
                    onChange={(e) => updateEducation(edu.id, 'qualifications', e.target.value)}
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
                    type="date"
                    value={edu.dateOfCompletion}
                    onChange={(e) => updateEducation(edu.id, 'dateOfCompletion', e.target.value)}
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-gray-400 hover:text-blue-600 relative"
                      onClick={() => openAttachmentDialog('education', edu.id, edu.qualifications || 'Education')}
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

  const renderA32LicenseDCE = () => {
    return (
      <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>A3.2 License & DCE</h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsLicenseDialogOpen(true)}
              className="text-gray-600 border-gray-300 hover:bg-gray-50 text-xs"
              data-testid="button-add-license-from-db"
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
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">ID</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Certificate/ Document</TableHead>
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
              <TableRow key={license.id} className="border-b border-gray-200">
                <TableCell className="p-3">
                  <div className="text-[#4f5863] text-[13px]">{license.licenseId || '-'}</div>
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    value={license.certificateDocument}
                    onChange={(e) => updateLicense(license.id, 'certificateDocument', e.target.value)}
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
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
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-gray-400 hover:text-blue-600 relative"
                      onClick={() => openAttachmentDialog('license', license.id, license.certificateDocument || 'License')}
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

  const renderA33TrainingCourse = () => {
    return (
      <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>A3.3 Training Course</h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTrainingDialogOpen(true)}
              className="text-gray-600 border-gray-300 hover:bg-gray-50 text-xs"
              data-testid="button-add-training-from-db"
            >
              + ADD FROM DATABASE
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={addTrainingCourse}
              className="text-gray-600 border-gray-300 hover:bg-gray-50"
              data-testid="button-add-training"
            >
              <Plus className="h-4 w-4 mr-2" />
              ADD
            </Button>
          </div>
        </div>
        
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-gray-100">
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">ID</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Training/ Course</TableHead>
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
                  <div className="text-[#4f5863] text-[13px]">{course.id}</div>
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
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-gray-400 hover:text-blue-600 relative"
                      onClick={() => openAttachmentDialog('training', course.id, course.trainingCourse || 'Training')}
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

  const renderA41SeaService = () => {
    return (
      <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>A4.1 Details of Sea Service</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={addSeaService}
            className="text-gray-600 border-gray-300 hover:bg-gray-50"
          >
            <Plus className="h-4 w-4 mr-2" />
            ADD
          </Button>
        </div>
        
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-gray-100">
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3 w-40">Vessel Name</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3 w-28">Vessel Type</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3 w-20">Deadweight</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3 w-24">Engine Type/ Power</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3 w-24">Owner / operator</TableHead>
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
                  <Input
                    value={service.vesselName}
                    onChange={(e) => updateSeaService(service.id, 'vesselName', e.target.value)}
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                    placeholder="Enter vessel name"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <Select
                    value={service.vesselType}
                    onValueChange={(value) => updateSeaService(service.id, 'vesselType', value)}
                  >
                    <SelectTrigger className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto">
                      <SelectValue placeholder="Select vessel type" />
                    </SelectTrigger>
                    <SelectContent>
                      {vesselTypeMasterData.map((vesselType: string) => (
                        <SelectItem key={vesselType} value={vesselType}>
                          {vesselType}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    value={service.deadweight}
                    onChange={(e) => updateSeaService(service.id, 'deadweight', e.target.value)}
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    value={service.engineTypePower}
                    onChange={(e) => updateSeaService(service.id, 'engineTypePower', e.target.value)}
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    value={service.ownerOperator}
                    onChange={(e) => updateSeaService(service.id, 'ownerOperator', e.target.value)}
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <Select
                    value={service.rank}
                    onValueChange={(value) => updateSeaService(service.id, 'rank', value)}
                  >
                    <SelectTrigger className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto">
                      <SelectValue placeholder="Select rank" />
                    </SelectTrigger>
                    <SelectContent>
                      {ranksLoading ? (
                        <SelectItem value="loading" disabled>Loading ranks...</SelectItem>
                      ) : (
                        rankNames.map((rank) => (
                          <SelectItem key={rank} value={rank}>
                            {rank}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    type="date"
                    value={service.from}
                    onChange={(e) => updateSeaService(service.id, 'from', e.target.value)}
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    type="date"
                    value={service.to}
                    onChange={(e) => updateSeaService(service.id, 'to', e.target.value)}
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    value={service.periodMonths}
                    readOnly
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto bg-gray-50 cursor-not-allowed"
                    title="Auto-calculated based on From & To dates"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-gray-400 hover:text-blue-600 relative"
                      onClick={() => openAttachmentDialog('seaService', service.id, service.vesselName || 'Sea Service')}
                      data-testid={`button-attach-seaservice-${service.id}`}
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
                      onClick={() => removeSeaService(service.id)}
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

  const renderA5AdditionalInfo = () => {
    return (
      <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>A5.1 Details on Additional Information required</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={addAdditionalInfo}
            className="text-gray-600 border-gray-300 hover:bg-gray-50"
          >
            <Plus className="h-4 w-4 mr-2" />
            ADD
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
                  <Input
                    value={info.information}
                    onChange={(e) => updateAdditionalInfo(info.id, 'information', e.target.value)}
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                    placeholder="Enter information requirement"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <Input
                    value={info.response}
                    onChange={(e) => updateAdditionalInfo(info.id, 'response', e.target.value)}
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                    placeholder="Enter response"
                  />
                </TableCell>
                <TableCell className="p-3">
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-gray-400 hover:text-gray-600 relative"
                      onClick={() => openAttachmentDialog('additionalInfo', info.id, info.information || 'Additional Info')}
                      data-testid={`button-attach-additionalinfo-${info.id}`}
                    >
                      <Paperclip className="h-3 w-3" />
                      {(info.attachments?.length || 0) > 0 && (
                        <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] rounded-full h-3.5 w-3.5 flex items-center justify-center">
                          {info.attachments?.length}
                        </span>
                      )}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-red-400 hover:text-red-600"
                      onClick={() => removeAdditionalInfo(info.id)}
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
            
            <div>
              <Label className="text-xs text-gray-500 tracking-wide">NOK: Tel</Label>
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
          </div>
        </div>
      </div>
    );
  };

  // Part B Render Functions

  const renderB1InitialScreening = () => {
    const questions = [
      { id: 'b1-age', field: 'b1AgeMeetsCriteria', label: 'B1.1 Age meets Company Criteria for the Rank applied for?', hasNA: true },
      { id: 'b1-rank', field: 'b1RankMeetsCriteria', label: 'B1.2 Experience meets Company Criteria for the Rank applied for?', hasNA: true },
      { id: 'b1-cert', field: 'b1CertificatesValid', label: 'B1.3 Certificates & Documents in order & valid as per Company Criteria?', hasNA: true },
      { id: 'b1-shortlist', field: 'b1Shortlisted', label: 'B1.4 Shortlisted (Initial Screening)?', hasNA: false },
    ];

    return (
      <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>B1. Initial Screening</h3>
          <div className="cursor-help" title="Guidance for initial screening process">
            <Info className="h-4 w-4 text-gray-400" />
          </div>
        </div>
        
        <div className="space-y-4">
          {questions.map((question) => (
            <React.Fragment key={question.id}>
              <div className="flex justify-between items-center">
                <Label className="text-xs text-gray-500 tracking-wide flex-1 pr-4">
                  {question.label}
                </Label>
                <div className="flex items-center min-w-[300px]">
                  {/* Fixed width container for alignment */}
                  <div className="flex gap-6 w-[200px]">
                    <RadioGroup 
                      value={formData[question.field as keyof FormData] as string} 
                      onValueChange={(value) => updateFormData(question.field as keyof FormData, value)}
                      className="flex gap-6"
                    >
                      <div className="flex items-center space-x-2 w-[50px]">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="yes" id={`${question.id}-yes`} />
                          <Label htmlFor={`${question.id}-yes`} className="text-sm cursor-pointer">Yes</Label>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 w-[50px]">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="no" id={`${question.id}-no`} />
                          <Label htmlFor={`${question.id}-no`} className="text-sm cursor-pointer">No</Label>
                        </div>
                      </div>
                      {question.hasNA && (
                        <div className="flex items-center space-x-2 w-[50px]">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="na" id={`${question.id}-na`} />
                            <Label htmlFor={`${question.id}-na`} className="text-sm cursor-pointer">NA</Label>
                          </div>
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
                  >
                    <MessageSquare className="h-4 w-4 text-gray-400" />
                  </Button>
                </div>
              </div>

              {/* Multiple comments for this question */}
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
                            // Clear editing state if this comment was being edited
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
                          if (newB1Comment[question.id]?.trim()) {
                            // Add the comment
                            const commentId = Date.now().toString();
                            setFormData(prev => ({
                              ...prev,
                              b1Comments: {
                                ...prev.b1Comments,
                                [question.id]: [
                                  ...(prev.b1Comments[question.id] || []),
                                  {
                                    id: commentId,
                                    user: currentUserDisplay,
                                    text: newB1Comment[question.id]
                                  }
                                ]
                              }
                            }));
                          }
                          // Clear the new comment input
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
              onClick={() => openAttachmentDialog('b1', 'b1', 'B1. Initial Screening')}
              data-testid="button-b1-attachments"
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
                  <>Submitted by: {formData.b1SubmittedBy}</>
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
                  updateFormData('b1SubmittedBy', currentUserDisplay);
                  updateFormData('b1SubmittedDate', currentDate);
                  // Also save the data (but don't close form)
                  setTimeout(() => {
                    handleSaveOnly();
                  }, 100);
                }}
              >
                Submit
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderB2ReferenceChecks = () => {
    return (
      <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>B2. Reference Checks with Previous Employer</h3>
          <div className="cursor-help" title="Guidance for reference checks process">
            <Info className="h-4 w-4 text-gray-400" />
          </div>
        </div>
        
        <div className="space-y-6">
          {/* B2.1 Reference checks completed */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <Label className="text-xs text-gray-500 tracking-wide flex-1 pr-4">
                B2.1 Reference checks completed?
              </Label>
              <div className="flex items-center min-w-[300px]">
                <div className="flex gap-6 w-[200px]">
                  <RadioGroup 
                    value={formData.b2ReferenceChecksCompleted as string} 
                    onValueChange={(value) => updateFormData('b2ReferenceChecksCompleted', value)}
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
                  onClick={() => setNewB2Comment(prev => ({
                    ...prev,
                    'b2-completed': ""
                  }))}
                >
                  <MessageSquare className="h-4 w-4 text-gray-400" />
                </Button>
              </div>
            </div>

            {/* Reference details when Yes is selected */}
            {formData.b2ReferenceChecksCompleted === 'yes' && (
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
                      />
                      {index === formData.b2References.length - 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-10 w-10 p-0 border-gray-300"
                          onClick={() => {
                            const newId = (formData.b2References.length + 1).toString();
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
                          onChange={(e) => {
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
                          // Clear editing state if this comment was being edited
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
                      onChange={(e) => {
                        setNewB2Comment(prev => ({
                          ...prev,
                          'b2-completed': e.target.value
                        }));
                      }}
                      onBlur={() => {
                        if (newB2Comment['b2-completed']?.trim()) {
                          const commentId = Date.now().toString();
                          setFormData(prev => ({
                            ...prev,
                            b2Comments: {
                              ...prev.b2Comments,
                              'b2-completed': [
                                ...(prev.b2Comments['b2-completed'] || []),
                                {
                                  id: commentId,
                                  user: currentUserDisplay,
                                  text: newB2Comment['b2-completed']
                                }
                              ]
                            }
                          }));
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
                    value={formData.b2CurrentEmployerFeedback as string} 
                    onValueChange={(value) => updateFormData('b2CurrentEmployerFeedback', value)}
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
                  onClick={() => setNewB2Comment(prev => ({
                    ...prev,
                    'b2-results': ""
                  }))}
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
                          onChange={(e) => {
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
                          // Clear editing state if this comment was being edited
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
                      onChange={(e) => {
                        setNewB2Comment(prev => ({
                          ...prev,
                          'b2-results': e.target.value
                        }));
                      }}
                      onBlur={() => {
                        if (newB2Comment['b2-results']?.trim()) {
                          const commentId = Date.now().toString();
                          setFormData(prev => ({
                            ...prev,
                            b2Comments: {
                              ...prev.b2Comments,
                              'b2-results': [
                                ...(prev.b2Comments['b2-results'] || []),
                                {
                                  id: commentId,
                                  user: currentUserDisplay,
                                  text: newB2Comment['b2-results']
                                }
                              ]
                            }
                          }));
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
          <div className="flex justify-start">
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
                  <>Submitted by: {formData.b2SubmittedBy}</>
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
                  updateFormData('b2SubmittedBy', currentUserDisplay);
                  updateFormData('b2SubmittedDate', currentDate);
                  // Also save the data (but don't close form)
                  setTimeout(() => {
                    handleSaveOnly();
                  }, 100);
                }}
              >
                Submit
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderB3SecurityChecks = () => {
    return (
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
                  <div className="flex items-center space-x-2 w-[50px]">
                    <RadioGroup 
                      value={formData.b3SecurityChecksCompleted as string} 
                      onValueChange={(value) => updateFormData('b3SecurityChecksCompleted', value)}
                      className="flex"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="b3-completed-yes" />
                        <Label htmlFor="b3-completed-yes" className="text-sm cursor-pointer">Yes</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="flex items-center space-x-2 w-[50px]">
                    <RadioGroup 
                      value={formData.b3SecurityChecksCompleted as string} 
                      onValueChange={(value) => updateFormData('b3SecurityChecksCompleted', value)}
                      className="flex"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="b3-completed-no" />
                        <Label htmlFor="b3-completed-no" className="text-sm cursor-pointer">No</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="flex items-center space-x-2 w-[50px]">
                    <RadioGroup 
                      value={formData.b3SecurityChecksCompleted as string} 
                      onValueChange={(value) => updateFormData('b3SecurityChecksCompleted', value)}
                      className="flex"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="na" id="b3-completed-na" />
                        <Label htmlFor="b3-completed-na" className="text-sm cursor-pointer">NA</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 ml-4"
                  onClick={() => setNewB3Comment(prev => ({
                    ...prev,
                    'b3-completed': ""
                  }))}
                >
                  <MessageSquare className="h-4 w-4 text-gray-400" />
                </Button>
              </div>
            </div>

            {/* Authority details when Yes is selected */}
            {formData.b3SecurityChecksCompleted === 'yes' && (
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
                      />
                      {index === formData.b3Authorities.length - 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-10 w-10 p-0 border-gray-300"
                          onClick={() => {
                            const newId = (formData.b3Authorities.length + 1).toString();
                            setFormData(prev => ({
                              ...prev,
                              b3Authorities: [...prev.b3Authorities, { 
                                id: newId, 
                                date: '', 
                                authority: '' 
                              }]
                            }));
                          }}
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
                          onChange={(e) => {
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
                      onChange={(e) => {
                        setNewB3Comment(prev => ({
                          ...prev,
                          'b3-completed': e.target.value
                        }));
                      }}
                      onBlur={() => {
                        if (newB3Comment['b3-completed']?.trim()) {
                          const commentId = Date.now().toString();
                          setFormData(prev => ({
                            ...prev,
                            b3Comments: {
                              ...prev.b3Comments,
                              'b3-completed': [
                                ...(prev.b3Comments['b3-completed'] || []),
                                {
                                  id: commentId,
                                  user: currentUserDisplay,
                                  text: newB3Comment['b3-completed']
                                }
                              ]
                            }
                          }));
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
                  <div className="flex items-center space-x-2 w-[50px]">
                    <RadioGroup 
                      value={formData.b3SecurityChecksResults as string} 
                      onValueChange={(value) => updateFormData('b3SecurityChecksResults', value)}
                      className="flex"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="b3-results-yes" />
                        <Label htmlFor="b3-results-yes" className="text-sm cursor-pointer">Yes</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="flex items-center space-x-2 w-[50px]">
                    <RadioGroup 
                      value={formData.b3SecurityChecksResults as string} 
                      onValueChange={(value) => updateFormData('b3SecurityChecksResults', value)}
                      className="flex"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="b3-results-no" />
                        <Label htmlFor="b3-results-no" className="text-sm cursor-pointer">No</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="flex items-center space-x-2 w-[50px]">
                    <RadioGroup 
                      value={formData.b3SecurityChecksResults as string} 
                      onValueChange={(value) => updateFormData('b3SecurityChecksResults', value)}
                      className="flex"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="na" id="b3-results-na" />
                        <Label htmlFor="b3-results-na" className="text-sm cursor-pointer">NA</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 ml-4"
                  onClick={() => setNewB3Comment(prev => ({
                    ...prev,
                    'b3-results': ""
                  }))}
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
                          onChange={(e) => {
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
                      onChange={(e) => {
                        setNewB3Comment(prev => ({
                          ...prev,
                          'b3-results': e.target.value
                        }));
                      }}
                      onBlur={() => {
                        if (newB3Comment['b3-results']?.trim()) {
                          const commentId = Date.now().toString();
                          setFormData(prev => ({
                            ...prev,
                            b3Comments: {
                              ...prev.b3Comments,
                              'b3-results': [
                                ...(prev.b3Comments['b3-results'] || []),
                                {
                                  id: commentId,
                                  user: currentUserDisplay,
                                  text: newB3Comment['b3-results']
                                }
                              ]
                            }
                          }));
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
                  <>Submitted by: {formData.b3SubmittedBy}</>
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
                  updateFormData('b3SubmittedBy', currentUserDisplay);
                  updateFormData('b3SubmittedDate', currentDate);
                  // Also save the data (but don't close form)
                  setTimeout(() => {
                    handleSaveOnly();
                  }, 100);
                }}
              >
                Submit
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderB4Authentication = () => {
    return (
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
                  <div className="flex items-center space-x-2 w-[50px]">
                    <RadioGroup 
                      value={formData.b4CertificatesAuthenticated as string} 
                      onValueChange={(value) => updateFormData('b4CertificatesAuthenticated', value)}
                      className="flex"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="b4-authenticated-yes" />
                        <Label htmlFor="b4-authenticated-yes" className="text-sm cursor-pointer">Yes</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="flex items-center space-x-2 w-[50px]">
                    <RadioGroup 
                      value={formData.b4CertificatesAuthenticated as string} 
                      onValueChange={(value) => updateFormData('b4CertificatesAuthenticated', value)}
                      className="flex"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="b4-authenticated-no" />
                        <Label htmlFor="b4-authenticated-no" className="text-sm cursor-pointer">No</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="flex items-center space-x-2 w-[50px]">
                    <RadioGroup 
                      value={formData.b4CertificatesAuthenticated as string} 
                      onValueChange={(value) => updateFormData('b4CertificatesAuthenticated', value)}
                      className="flex"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="na" id="b4-authenticated-na" />
                        <Label htmlFor="b4-authenticated-na" className="text-sm cursor-pointer">NA</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 ml-4"
                  onClick={() => setNewB4Comment(prev => ({
                    ...prev,
                    'b4-authenticated': ""
                  }))}
                >
                  <MessageSquare className="h-4 w-4 text-gray-400" />
                </Button>
              </div>
            </div>

            {/* Certificate details when Yes is selected */}
            {formData.b4CertificatesAuthenticated === 'yes' && (
              <div className="ml-4 mb-4 space-y-3">
                {formData.b4Certificates.map((certificate, index) => (
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
                            b4Certificates: prev.b4Certificates.map(cert => 
                              cert.id === certificate.id 
                                ? { ...cert, date: e.target.value }
                                : cert
                            )
                          }));
                        }}
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
                            b4Certificates: prev.b4Certificates.map(cert => 
                              cert.id === certificate.id 
                                ? { ...cert, certificate: e.target.value }
                                : cert
                            )
                          }));
                        }}
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
                            b4Certificates: prev.b4Certificates.map(cert => 
                              cert.id === certificate.id 
                                ? { ...cert, authority: e.target.value }
                                : cert
                            )
                          }));
                        }}
                      />
                      {index === formData.b4Certificates.length - 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-10 w-10 p-0 border-gray-300"
                          onClick={() => {
                            const newId = (formData.b4Certificates.length + 1).toString();
                            setFormData(prev => ({
                              ...prev,
                              b4Certificates: [...prev.b4Certificates, { 
                                id: newId, 
                                date: '', 
                                certificate: '',
                                authority: '' 
                              }]
                            }));
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      )}
                      {formData.b4Certificates.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-10 w-10 p-0"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              b4Certificates: prev.b4Certificates.filter(cert => cert.id !== certificate.id)
                            }));
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      {formData.b4Certificates.length === 1 && (
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
                          onChange={(e) => {
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
                      onChange={(e) => {
                        setNewB4Comment(prev => ({
                          ...prev,
                          'b4-authenticated': e.target.value
                        }));
                      }}
                      onBlur={() => {
                        if (newB4Comment['b4-authenticated']?.trim()) {
                          const commentId = Date.now().toString();
                          setFormData(prev => ({
                            ...prev,
                            b4Comments: {
                              ...prev.b4Comments,
                              'b4-authenticated': [
                                ...(prev.b4Comments['b4-authenticated'] || []),
                                {
                                  id: commentId,
                                  user: currentUserDisplay,
                                  text: newB4Comment['b4-authenticated']
                                }
                              ]
                            }
                          }));
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
                  <div className="flex items-center space-x-2 w-[50px]">
                    <RadioGroup 
                      value={formData.b4AuthenticationResults as string} 
                      onValueChange={(value) => updateFormData('b4AuthenticationResults', value)}
                      className="flex"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="b4-results-yes" />
                        <Label htmlFor="b4-results-yes" className="text-sm cursor-pointer">Yes</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="flex items-center space-x-2 w-[50px]">
                    <RadioGroup 
                      value={formData.b4AuthenticationResults as string} 
                      onValueChange={(value) => updateFormData('b4AuthenticationResults', value)}
                      className="flex"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="b4-results-no" />
                        <Label htmlFor="b4-results-no" className="text-sm cursor-pointer">No</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="flex items-center space-x-2 w-[50px]">
                    <RadioGroup 
                      value={formData.b4AuthenticationResults as string} 
                      onValueChange={(value) => updateFormData('b4AuthenticationResults', value)}
                      className="flex"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="na" id="b4-results-na" />
                        <Label htmlFor="b4-results-na" className="text-sm cursor-pointer">NA</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 ml-4"
                  onClick={() => setNewB4Comment(prev => ({
                    ...prev,
                    'b4-results': ""
                  }))}
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
                          onChange={(e) => {
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
                      onChange={(e) => {
                        setNewB4Comment(prev => ({
                          ...prev,
                          'b4-results': e.target.value
                        }));
                      }}
                      onBlur={() => {
                        if (newB4Comment['b4-results']?.trim()) {
                          const commentId = Date.now().toString();
                          setFormData(prev => ({
                            ...prev,
                            b4Comments: {
                              ...prev.b4Comments,
                              'b4-results': [
                                ...(prev.b4Comments['b4-results'] || []),
                                {
                                  id: commentId,
                                  user: currentUserDisplay,
                                  text: newB4Comment['b4-results']
                                }
                              ]
                            }
                          }));
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
              onClick={() => openAttachmentDialog('b4', 'b4', 'B4. Authentication of Certificates')}
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
                  <>Submitted by: {formData.b4SubmittedBy}</>
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
                  updateFormData('b4SubmittedBy', currentUserDisplay);
                  updateFormData('b4SubmittedDate', currentDate);
                  // Also save the data (but don't close form)
                  setTimeout(() => {
                    handleSaveOnly();
                  }, 100);
                }}
              >
                Submit
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderB5CESLanguageTests = () => {
    return (
      <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>B5. CES / Language Test Results</h3>
          <div className="cursor-help" title="Guidance for CES/Language Test process">
            <Info className="h-4 w-4 text-gray-400" />
          </div>
        </div>
        
        <div className="space-y-6">
          {/* B5.1 Applicable CES/Language Tests completed */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <Label className="text-xs text-gray-500 tracking-wide flex-1 pr-4">
                B5.1 Applicable CES / Language Tests completed?
              </Label>
              <div className="flex items-center min-w-[300px]">
                <div className="flex gap-6 w-[200px]">
                  <div className="flex items-center space-x-2 w-[50px]">
                    <RadioGroup 
                      value={formData.b5CesTestsCompleted as string} 
                      onValueChange={(value) => updateFormData('b5CesTestsCompleted', value)}
                      className="flex"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="b5-completed-yes" />
                        <Label htmlFor="b5-completed-yes" className="text-sm cursor-pointer">Yes</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="flex items-center space-x-2 w-[50px]">
                    <RadioGroup 
                      value={formData.b5CesTestsCompleted as string} 
                      onValueChange={(value) => updateFormData('b5CesTestsCompleted', value)}
                      className="flex"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="b5-completed-no" />
                        <Label htmlFor="b5-completed-no" className="text-sm cursor-pointer">No</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="flex items-center space-x-2 w-[50px]">
                    <RadioGroup 
                      value={formData.b5CesTestsCompleted as string} 
                      onValueChange={(value) => updateFormData('b5CesTestsCompleted', value)}
                      className="flex"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="na" id="b5-completed-na" />
                        <Label htmlFor="b5-completed-na" className="text-sm cursor-pointer">NA</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 ml-4"
                  onClick={() => setNewB5Comment(prev => ({
                    ...prev,
                    'b5-completed': ""
                  }))}
                >
                  <MessageSquare className="h-4 w-4 text-gray-400" />
                </Button>
              </div>
            </div>

            {/* Test details when Yes is selected */}
            {formData.b5CesTestsCompleted === 'yes' && (
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
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Subject" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="english">English</SelectItem>
                          <SelectItem value="mathematics">Mathematics</SelectItem>
                          <SelectItem value="navigation">Navigation</SelectItem>
                          <SelectItem value="seamanship">Seamanship</SelectItem>
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
                        <SelectTrigger className="text-sm flex-1">
                          <SelectValue placeholder="Result" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pass">Pass</SelectItem>
                          <SelectItem value="fail">Fail</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                        </SelectContent>
                      </Select>
                      {index === formData.b5Tests.length - 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-10 w-10 p-0 border-gray-300"
                          onClick={() => {
                            const newId = (formData.b5Tests.length + 1).toString();
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
                        >
                          <Trash2 className="h-4 w-4" />
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
                          onChange={(e) => {
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
                      onChange={(e) => {
                        setNewB5Comment(prev => ({
                          ...prev,
                          'b5-completed': e.target.value
                        }));
                      }}
                      onBlur={() => {
                        if (newB5Comment['b5-completed']?.trim()) {
                          const commentId = Date.now().toString();
                          setFormData(prev => ({
                            ...prev,
                            b5Comments: {
                              ...prev.b5Comments,
                              'b5-completed': [
                                ...(prev.b5Comments['b5-completed'] || []),
                                {
                                  id: commentId,
                                  user: currentUserDisplay,
                                  text: newB5Comment['b5-completed']
                                }
                              ]
                            }
                          }));
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
              onClick={() => openAttachmentDialog('b5', 'b5', 'B5. CES/Language Test Results')}
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
                  <>Submitted by: {formData.b5SubmittedBy}</>
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
                  updateFormData('b5SubmittedBy', currentUserDisplay);
                  updateFormData('b5SubmittedDate', currentDate);
                  // Also save the data (but don't close form)
                  setTimeout(() => {
                    handleSaveOnly();
                  }, 100);
                }}
              >
                Submit
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderB6Interviews = () => {
    return (
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
                    value={formData.b6InterviewCompleted as string} 
                    onValueChange={(value) => updateFormData('b6InterviewCompleted', value)}
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
                  onClick={() => setNewB6Comment(prev => ({
                    ...prev,
                    'b6-completed': ""
                  }))}
                >
                  <MessageSquare className="h-4 w-4 text-gray-400" />
                </Button>
              </div>
            </div>

            {/* Interview details when Yes is selected */}
            {formData.b6InterviewCompleted === 'yes' && (
              <div className="ml-4 mb-4 space-y-3">
                {formData.b6Interviews.map((interview, index) => (
                  <div key={interview.id} className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                          <SelectTrigger className="text-sm">
                            <SelectValue placeholder="Interviewer" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="capt-nick">Capt. Nick, Marine Superintendent</SelectItem>
                            <SelectItem value="john-doe">John Doe, HR Manager</SelectItem>
                            <SelectItem value="sarah-smith">Sarah Smith, Technical Manager</SelectItem>
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
                          <SelectTrigger className="text-sm">
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
                          <SelectTrigger className="text-sm flex-1">
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
                              const newId = (formData.b6Interviews.length + 1).toString();
                              setFormData(prev => ({
                                ...prev,
                                b6Interviews: [...prev.b6Interviews, { 
                                  id: newId, 
                                  date: '', 
                                  interviewer: '',
                                  status: '',
                                  result: '',
                                  comments: ''
                                }],
                                b6InterviewComments: {
                                  ...prev.b6InterviewComments,
                                  [newId]: ''
                                }
                              }));
                              setEditingB6InterviewComment(newId);
                            }}
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
                              setFormData(prev => {
                                const newComments = { ...prev.b6InterviewComments };
                                delete newComments[interview.id];
                                return {
                                  ...prev,
                                  b6Interviews: prev.b6Interviews.filter(int => int.id !== interview.id),
                                  b6InterviewComments: newComments
                                };
                              });
                              if (editingB6InterviewComment === interview.id) {
                                setEditingB6InterviewComment(null);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {/* Individual interview comment - only show when interviewer is selected */}
                    {interview.interviewer && (
                      <div className="ml-4">
                        <div className="text-blue-600 italic text-[13px] mb-2">
                          {interviewerDisplayNames[interview.interviewer] || interview.interviewer}:
                        </div>
                        {editingB6InterviewComment === interview.id ? (
                          <Textarea
                            value={formData.b6InterviewComments[interview.id] || ''}
                            onChange={(e) => {
                              setFormData(prev => ({
                                ...prev,
                                b6InterviewComments: {
                                  ...prev.b6InterviewComments,
                                  [interview.id]: e.target.value
                                }
                              }));
                            }}
                            onBlur={() => setEditingB6InterviewComment(null)}
                            placeholder="Comment: Add your observations here..."
                            className="text-blue-600 italic border-blue-200 text-[13px] mb-2"
                            rows={2}
                            autoFocus
                          />
                        ) : (
                          <div 
                            className="text-blue-600 italic cursor-pointer rounded hover:bg-gray-50 text-[13px] mb-2 p-1"
                            onClick={() => setEditingB6InterviewComment(interview.id)}
                          >
                            {formData.b6InterviewComments[interview.id] || "Click to add comment..."}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Comments for B6.1 */}
            {(formData.b6Comments['b6-completed']?.length > 0 || newB6Comment['b6-completed'] !== undefined) && (
              <div className="ml-4 mb-4 space-y-2">
                {formData.b6Comments['b6-completed']?.map((comment) => (
                  <div key={comment.id} className="flex justify-between items-start">
                    <div className="flex-1 text-blue-600 italic text-[13px] p-1">
                      <span className="text-blue-600 italic text-[13px]">{comment.user}: </span>
                      {comment.text}
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
                      onChange={(e) => {
                        setNewB6Comment(prev => ({
                          ...prev,
                          'b6-completed': e.target.value
                        }));
                      }}
                      onBlur={() => {
                        if (newB6Comment['b6-completed']?.trim()) {
                          const commentId = Date.now().toString();
                          setFormData(prev => ({
                            ...prev,
                            b6Comments: {
                              ...prev.b6Comments,
                              'b6-completed': [
                                ...(prev.b6Comments['b6-completed'] || []),
                                {
                                  id: commentId,
                                  user: currentUserDisplay,
                                  text: newB6Comment['b6-completed']
                                }
                              ]
                            }
                          }));
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
                  <>Submitted by: {formData.b6SubmittedBy}</>
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
                  updateFormData('b6SubmittedBy', currentUserDisplay);
                  updateFormData('b6SubmittedDate', currentDate);
                  // Also save the data (but don't close form)
                  setTimeout(() => {
                    handleSaveOnly();
                  }, 100);
                }}
              >
                Submit
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderB7TrainingNeeds = () => {
    return (
      <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>B7. Training Needs Identified</h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsB7TrainingDialogOpen(true)}
              className="text-gray-600 border-gray-300 hover:bg-gray-50 text-xs"
              data-testid="button-add-b7-training-from-db"
            >
              + ADD FROM DATABASE
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={addB7TrainingNeed}
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
              {formData.b7TrainingNeeds.map((training) => (
                <TableRow key={training.id} className="border-b border-gray-200">
                  <TableCell className="p-3">
                    <Input
                      value={training.training}
                      onChange={(e) => updateB7TrainingNeed(training.id, 'training', e.target.value)}
                      className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                      placeholder="Enter training/course name"
                    />
                  </TableCell>
                  <TableCell className="p-3">
                    <Input
                      value={training.identifiedBy}
                      onChange={(e) => updateB7TrainingNeed(training.id, 'identifiedBy', e.target.value)}
                      className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                      placeholder="Enter identifier"
                    />
                  </TableCell>
                  <TableCell className="p-3">
                    <Select
                      value={training.category}
                      onValueChange={(value) => updateB7TrainingNeed(training.id, 'category', value)}
                    >
                      <SelectTrigger className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Mandatory">Mandatory</SelectItem>
                        <SelectItem value="Recommended">Recommended</SelectItem>
                        <SelectItem value="Optional">Optional</SelectItem>
                        <SelectItem value="Refresher">Refresher</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="p-3">
                    <Input
                      type="date"
                      value={training.dueDate}
                      onChange={(e) => updateB7TrainingNeed(training.id, 'dueDate', e.target.value)}
                      className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                    />
                  </TableCell>
                  <TableCell className="p-3">
                    <Input
                      value={training.comments}
                      onChange={(e) => updateB7TrainingNeed(training.id, 'comments', e.target.value)}
                      className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                      placeholder="Enter comments"
                    />
                  </TableCell>
                  <TableCell className="p-3">
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => removeB7TrainingNeed(training.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
                  <>Submitted by: {formData.b7SubmittedBy}</>
                ) : (
                  <span className="text-gray-400">Not yet submitted</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => {
                    const currentDate = new Date().toLocaleDateString();
                    updateFormData('b7SubmittedBy', currentUserDisplay);
                    updateFormData('b7SubmittedDate', currentDate);
                    // Also save the data (but don't close form)
                    setTimeout(() => {
                      handleSaveOnly();
                    }, 100);
                  }}
                >
                  Submit
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderB8ShortListing = () => {
    return (
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
                    value={formData.b8Shortlisted as string} 
                    onValueChange={(value) => updateFormData('b8Shortlisted', value)}
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
                          onChange={(e) => {
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
                      onChange={(e) => {
                        setNewB8Comment(prev => ({
                          ...prev,
                          'b8-shortlisted': e.target.value
                        }));
                      }}
                      onBlur={() => {
                        if (newB8Comment['b8-shortlisted']?.trim()) {
                          const commentId = Date.now().toString();
                          setFormData(prev => ({
                            ...prev,
                            b8Comments: {
                              ...prev.b8Comments,
                              'b8-shortlisted': [
                                ...(prev.b8Comments['b8-shortlisted'] || []),
                                {
                                  id: commentId,
                                  user: currentUserDisplay,
                                  text: newB8Comment['b8-shortlisted']
                                }
                              ]
                            }
                          }));
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
                  <>Submitted by: {formData.b8SubmittedBy}</>
                ) : (
                  <span className="text-gray-400">Not yet submitted</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => {
                    const currentDate = new Date().toLocaleDateString();
                    updateFormData('b8SubmittedBy', currentUserDisplay);
                    updateFormData('b8SubmittedDate', currentDate);
                    // Also save the data (but don't close form)
                    setTimeout(() => {
                      handleSaveOnly();
                    }, 100);
                  }}
                >
                  Submit
                </Button>
              </div>
            </div>
          </div>

          {/* Submit for Approval section */}
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
                      {formData.selectedApproversForSubmission.length > 0
                        ? `${formData.selectedApproversForSubmission.length} approver(s) selected`
                        : "Approver"}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[350px] p-0" align="start">
                    <div className="max-h-[300px] overflow-y-auto">
                      {approverMasterData.map((approverName) => (
                        <div
                          key={approverName}
                          className="flex items-center px-3 py-2 cursor-pointer hover:bg-gray-100"
                          onClick={() => toggleApproverSelection(approverName)}
                          data-testid={`checkbox-approver-${approverName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}
                        >
                          <Checkbox
                            checked={formData.selectedApproversForSubmission.includes(approverName)}
                            className="mr-3"
                          />
                          <span className="text-sm">{approverName}</span>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            
            {/* Show submitted by info if already submitted for approval */}
            {formData.approvalSubmittedBy && (
              <div className="text-xs text-gray-500">
                Submitted by: {formData.approvalSubmittedBy}
                {formData.approvalSubmittedDate && ` on ${formData.approvalSubmittedDate}`}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Part C - Approval render functions
  const renderC1Approval = () => {
    return (
      <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>C.1 Approval</h3>
          <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center">
            <span className="text-xs text-gray-600">i</span>
          </div>
        </div>
        
        <div className="space-y-6">
          {/* C1.1 Approved? */}
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
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Approver
              </Button>
            </div>

            {/* Approver entries */}
            <div className="ml-4 mb-4 space-y-3">
              {formData.c1Approvers.map((approver, index) => (
                <div key={approver.id} className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Input
                        type="date"
                        placeholder="Date"
                        className="text-sm"
                        value={approver.date}
                        onChange={(e) => updateC1Approver(approver.id, 'date', e.target.value)}
                      />
                    </div>
                    <div>
                      <Select
                        value={approver.approver}
                        onValueChange={(value) => updateC1Approver(approver.id, 'approver', value)}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Approver" />
                        </SelectTrigger>
                        <SelectContent>
                          {approverMasterData.map((approverName) => (
                            <SelectItem key={approverName} value={approverName}>
                              {approverName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Select
                        value={approver.status}
                        onValueChange={(value) => updateC1Approver(approver.id, 'status', value)}
                      >
                        <SelectTrigger className="text-sm">
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
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Approver comment - only show when approver is selected */}
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
    );
  };

  const renderC2Suitable = () => {
    return (
      <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>C2 Suitable for</h3>
        </div>
        
        <div className="space-y-6">
          {/* C2.1 Vessel types */}
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
                <SelectTrigger className="w-full max-w-md">
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

          {/* C2.2 Vessel Class/Fleet */}
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
    );
  };

  const renderC3Recruited = () => {
    return (
      <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>C3 Recruited & Assigned to</h3>
        </div>
        
        <div className="space-y-6">
          {/* C3.1 Recruitment confirmed */}
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

          {/* C3.2 Vessel, Vessel Class/Fleet */}
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

          {/* Submitted by section */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <div className="text-xs text-gray-500">
                Submitted by: {formData.c3SubmittedBy}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={handleC3Submit}
                  disabled={saveOnlyMutation.isPending}
                >
                  {saveOnlyMutation.isPending ? 'Saving...' : 'Submit'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render all continuous sections (A1-A5) in one scrollable container
  const renderContinuousSections = () => {
    return (
      <div className="space-y-6">
        {/* A1 Section */}
        <div ref={a1Ref} data-section-id="A1">
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="pb-4 mb-6">
                <h2 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part A1 Seafarers' Particulars</h2>
                <div style={{ color: '#16569e' }} className="text-sm">Enter details as applicable</div>
                <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
              </div>
              {/* Responsive Layout for Sections */}
              <div className="space-y-6">
                {/* External Monitor: A1.1 & A1.2 side by side, Desktop/Tablet/Mobile: stacked */}
                <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
                  <div className="2xl:col-span-1">
                    {renderA11GeneralParticulars()}
                  </div>
                  <div className="2xl:col-span-1">
                    {renderA12AddressContact()}
                  </div>
                </div>
                
                {/* A1.3 always full width below */}
                <div>
                  {renderA13FamilyNOK()}
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex justify-end gap-2 mt-6 pt-4">
                <Button 
                  className="bg-[#60A5FA] hover:bg-[#3B82F6] text-white px-8"
                  onClick={handleSaveAndContinue}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? 'Saving...' : 'Save & Continue'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* A2 Section */}
        <div ref={a2Ref} data-section-id="A2">
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="pb-4 mb-6">
                <h2 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part A2 - Travel & ID Documents</h2>
                <div style={{ color: '#16569e' }} className="text-sm">Add from the list all applicable identification & travel documents</div>
                <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
              </div>
              
              {/* A2 Sections */}
              <div className="space-y-6">
                {renderA21TravelDocs()}
                {renderA22Visas()}
              </div>
              
              {/* Action Buttons */}
              <div className="flex justify-end gap-2 mt-6 pt-4">
                <Button 
                  className="bg-[#60A5FA] hover:bg-[#3B82F6] text-white px-8"
                  onClick={handleSaveAndContinue}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? 'Saving...' : 'Save & Continue'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* A3 Section */}
        <div ref={a3Ref} data-section-id="A3">
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="pb-4 mb-6">
                <h2 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part A3 - Training & Certificates</h2>
                <div style={{ color: '#16569e' }} className="text-sm">Add Education, Competency & Training Information</div>
                <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
              </div>
              
              {/* A3 Sections */}
              <div className="space-y-6">
                {renderA31Education()}
                {renderA32LicenseDCE()}
                {renderA33TrainingCourse()}
              </div>
              
              {/* Action Buttons */}
              <div className="flex justify-end gap-2 mt-6 pt-4">
                <Button 
                  className="bg-[#60A5FA] hover:bg-[#3B82F6] text-white px-8"
                  onClick={handleSaveAndContinue}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? 'Saving...' : 'Save & Continue'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* A4 Section */}
        <div ref={a4Ref} data-section-id="A4">
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="pb-4 mb-6">
                <h2 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part A4 - Sea Service</h2>
                <div style={{ color: '#16569e' }} className="text-sm">Add Sea service details, latest on top</div>
                <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
              </div>
              
              {/* A4 Section */}
              <div className="space-y-6">
                {renderA41SeaService()}
              </div>
              
              {/* Action Buttons */}
              <div className="flex justify-end gap-2 mt-6 pt-4">
                <Button 
                  className="bg-[#60A5FA] hover:bg-[#3B82F6] text-white px-8"
                  onClick={handleSaveAndContinue}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? 'Saving...' : 'Save & Continue'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* A5 Section */}
        <div ref={a5Ref} data-section-id="A5">
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="pb-4 mb-6">
                <h2 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part A5 - Additional Information</h2>
                <div className="text-sm text-[#16569e]">Provide additional information as below</div>
                <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
              </div>
              
              {/* A5 Section */}
              <div className="space-y-6">
                {renderA5AdditionalInfo()}
              </div>
              
              {/* Action Buttons */}
              <div className="flex justify-end gap-2 mt-6 pt-4">
                <Button 
                  className="bg-green-600 hover:bg-green-700 text-white px-8"
                  onClick={handleA5SubmitForScreening}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? 'Saving...' : 'Submit for Screening'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    // If activeSection is A1-A5, render all continuous sections
    if (['A1', 'A2', 'A3', 'A4', 'A5'].includes(activeSection)) {
      return renderContinuousSections();
    }
    
    // For B and C sections, render them individually as before
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
              
              {/* B Sections */}
              <div className="space-y-6">
                {renderB1InitialScreening()}
                {renderB2ReferenceChecks()}
                {renderB3SecurityChecks()}
                {renderB4Authentication()}
                {renderB5CESLanguageTests()}
                {renderB6Interviews()}
                {renderB7TrainingNeeds()}
                {renderB8ShortListing()}
              </div>
              
              {/* Action Buttons */}
              <div className="flex justify-end gap-2 mt-6 pt-4">
                <Button 
                  className="bg-[#00AF7B] hover:bg-[#009B6B] text-white px-8"
                  onClick={() => {
                    // First populate C1.1 with selected approvers
                    handleSubmitForApproval();
                    // Then save and continue
                    handleSaveAndContinue();
                  }}
                  disabled={saveMutation.isPending}
                  data-testid="button-submit-for-approval"
                >
                  {saveMutation.isPending ? 'Saving...' : 'Submit for Approval'}
                </Button>
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
              
              {/* C Sections */}
              <div className="space-y-6">
                {renderC1Approval()}
                {renderC2Suitable()}
                {renderC3Recruited()}
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-2 sm:p-4">
      <div className="bg-white rounded-lg w-full max-w-none 2xl:max-w-[95vw] h-[calc(100vh-1rem)] sm:h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-2 sm:p-3 lg:p-4 flex items-center justify-between">
          <div className="flex items-center gap-1 sm:gap-2 lg:gap-4">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-sm sm:text-lg lg:text-xl font-bold truncate">
              <span className="hidden sm:inline">Recruitment Application - </span>
              {candidate ? `${candidate.firstName} ${candidate.familyName}` : 'New Candidate'}
            </h1>
          </div>
          <div className="flex gap-1 sm:gap-2">
            <Button 
              variant="outline" 
              size="sm"
              className="items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 text-primary-foreground shadow hover:bg-primary/90 h-8 rounded-md px-3 text-xs hidden sm:flex bg-[#5fa5fa]"
              onClick={handleSaveOnly}
              disabled={saveOnlyMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {saveOnlyMutation.isPending ? 'Saving...' : 'Save Draft'}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              className="sm:hidden"
              onClick={handleSaveOnly}
              disabled={saveOnlyMutation.isPending}
            >
              <Save className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile Horizontal Stepper */}
        <div className="block sm:hidden bg-white border-b px-4 py-3">
          <nav className="flex justify-center space-x-4">
            {sections.map((section, index) => {
              // For continuous sections, use activeContinuousSection, for steppers use activeSection
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

        <div className="flex h-full overflow-hidden">
          {/* Left Sidebar - Enhanced Stepper (Hidden on Mobile) */}
          <aside className="hidden sm:block sticky top-0 self-start basis-20 md:basis-48 lg:basis-52 shrink-0 bg-gray-50 border-r overflow-y-auto">
            <div className="p-3">
              <nav className="space-y-1">
                {sections.map((section, index) => {
                  // For continuous sections, use activeContinuousSection, for steppers use activeSection
                  const isActive = section.type === 'continuous' 
                    ? activeContinuousSection === section.id
                    : activeSection === section.id;
                  const isCompleted = false; // You can add completion logic here
                  
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
          
          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto p-2 sm:p-4 lg:p-6 bg-[#f9fafb]">
            {renderContent()}
          </div>
        </div>
      </div>
      
      {/* Selection Dialogs for Add from Database */}
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
      
      {/* B7 Training Needs - reuses same training course selection dialog */}
      <TrainingCourseSelectionDialog
        open={isB7TrainingDialogOpen}
        onClose={() => setIsB7TrainingDialogOpen(false)}
        onConfirm={addB7TrainingFromDatabase}
        existingCourseIds={[]}
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