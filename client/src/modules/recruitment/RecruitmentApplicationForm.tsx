import React, { useState, useRef, useEffect } from 'react';
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
import { ArrowLeft, Edit, Plus, Save, Trash2, Upload, Paperclip, X, Camera, Info, MessageSquare } from 'lucide-react';

interface RecruitmentCandidate {
  id: string;
  fileNo: string;
  firstName: string;
  middleName: string;
  familyName: string;
  dob: string;
  nationality: string;
  rankAppliedFor: string;
  presentRank: string;
  vesselType: string;
  status: string;
}

interface RecruitmentApplicationFormProps {
  candidate: RecruitmentCandidate;
  onClose: () => void;
}

interface FormData {
  // A1.1 General Particulars
  firstName: string;
  middleName: string;
  familyName: string;
  nationality: string;
  presentRank: string;
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
    document: string;
    number: string;
    issued: string;
    expiry: string;
    issuingAuthority: string;
  }>;

  // A2.2 Visas
  visas: Array<{
    id: string;
    issuingCountry: string;
    serialNo: string;
    issued: string;
    expiry: string;
    visaType: string;
  }>;

  // A3.1 Education
  education: Array<{
    id: string;
    dateOfCompletion: string;
    schoolCollegeUniversity: string;
    subjectsField: string;
    qualifications: string;
  }>;

  // A3.2 License & DCE
  licenses: Array<{
    id: string;
    certificateDocument: string;
    abbr: string;
    requirement: string;
    certificateNo: string;
    issuingAuthority: string;
    issued: string;
    expiry: string;
  }>;

  // A3.3 Training Course
  trainingCourses: Array<{
    id: string;
    trainingCourse: string;
    abbr: string;
    requirement: string;
    certificateNo: string;
    issuingAuthority: string;
    issued: string;
    expiry: string;
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
  }>;

  // A5 Additional Information
  additionalInfo: Array<{
    id: string;
    information: string;
    response: string;
  }>;

  // Part B - Office Screening
  b1AgeMeetsCriteria: string;
  b1RankMeetsCriteria: string;
  b1CertificatesValid: string;
  b1Shortlisted: string;
  b1Comments: string;
  b1SubmittedBy: string;
  b1SubmittedDate: string;
  
  // B2 Reference Checks fields
  b2ReferenceChecksCompleted: string;
  b2CurrentEmployerFeedback: string;
  b2SubmittedBy: string;
  b2SubmittedDate: string;
  
  // B3 Background Security Checks fields
  b3SecurityChecksCompleted: string;
  b3SecurityChecksResults: string;
  b3SubmittedBy: string;
  b3SubmittedDate: string;
  
  // B4 Authentication of Certificates & Documents fields
  b4CertificatesAuthenticated: string;
  b4AuthenticationResults: string;
  b4SubmittedBy: string;
  b4SubmittedDate: string;
  
  // B5 CES/Language Test Results fields
  b5CesTestsCompleted: string;
  b5SubmittedBy: string;
  b5SubmittedDate: string;
  
  // B6 Interviews fields
  b6InterviewCompleted: string;
  b6SubmittedBy: string;
  b6SubmittedDate: string;
  
  // B7 Training Needs Identified fields
  b7SubmittedBy: string;
  b7SubmittedDate: string;
  
  // B8 Short Listing fields
  b8Shortlisted: string;
  b8SubmittedBy: string;
  b8SubmittedDate: string;
}

export const RecruitmentApplicationForm: React.FC<RecruitmentApplicationFormProps> = ({
  candidate,
  onClose
}) => {
  const [activeSection, setActiveSection] = useState('A1');
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

  // State for B1 multiple comments per question
  const [b1Comments, setB1Comments] = useState<{[key: string]: Array<{user: string, text: string, id: string}>}>({
    'b1-rank': [
      {
        id: '1',
        user: 'Roxanne, Crewing Executive',
        text: 'Rank Experience does not meet the requirements. 1 month short'
      },
      {
        id: '2', 
        user: 'Joseph Hall, Crew Manager',
        text: 'Exception granted to this candidate as per discussion with Department Manager'
      }
    ]
  });
  const [editingB1Comment, setEditingB1Comment] = useState<string | null>(null);
  const [newB1Comment, setNewB1Comment] = useState<{[key: string]: string}>({});

  // State for B2 multiple comments per question
  const [b2Comments, setB2Comments] = useState<{[key: string]: Array<{user: string, text: string, id: string}>}>({});
  const [editingB2Comment, setEditingB2Comment] = useState<string | null>(null);
  const [newB2Comment, setNewB2Comment] = useState<{[key: string]: string}>({});
  const [b2References, setB2References] = useState<Array<{id: string, date: string, nameDesignation: string, contactInfo: string}>>([
    { id: '1', date: '', nameDesignation: '', contactInfo: '' }
  ]);

  // State for B3 multiple comments per question  
  const [b3Comments, setB3Comments] = useState<{[key: string]: Array<{user: string, text: string, id: string}>}>({});
  const [editingB3Comment, setEditingB3Comment] = useState<string | null>(null);
  const [newB3Comment, setNewB3Comment] = useState<{[key: string]: string}>({});
  const [b3Authorities, setB3Authorities] = useState<Array<{id: string, date: string, authority: string}>>([
    { id: '1', date: '', authority: '' }
  ]);

  // State for B4 multiple comments per question  
  const [b4Comments, setB4Comments] = useState<{[key: string]: Array<{user: string, text: string, id: string}>}>({});
  const [editingB4Comment, setEditingB4Comment] = useState<string | null>(null);
  const [newB4Comment, setNewB4Comment] = useState<{[key: string]: string}>({});
  const [b4Certificates, setB4Certificates] = useState<Array<{id: string, date: string, certificate: string, authority: string}>>([
    { id: '1', date: '', certificate: '', authority: '' }
  ]);

  // State for B5 multiple comments per question
  const [b5Comments, setB5Comments] = useState<{[key: string]: Array<{user: string, text: string, id: string}>}>({});
  const [editingB5Comment, setEditingB5Comment] = useState<string | null>(null);
  const [newB5Comment, setNewB5Comment] = useState<{[key: string]: string}>({});
  const [b5Tests, setB5Tests] = useState<Array<{id: string, date: string, subject: string, score: string, result: string}>>([
    { id: '1', date: '', subject: '', score: '', result: '' }
  ]);

  // State for B6 multiple comments per question
  const [b6Comments, setB6Comments] = useState<{[key: string]: Array<{user: string, text: string, id: string}>}>({});
  const [editingB6Comment, setEditingB6Comment] = useState<string | null>(null);
  const [newB6Comment, setNewB6Comment] = useState<{[key: string]: string}>({});
  const [b6Interviews, setB6Interviews] = useState<Array<{id: string, date: string, interviewer: string, status: string, result: string, comments: string}>>([
    { id: '1', date: '', interviewer: '', status: '', result: '', comments: '' }
  ]);
  
  // State for individual interview comments (editable)
  const [b6InterviewComments, setB6InterviewComments] = useState<{[key: string]: string}>({
    '1': 'Overall Candidate reflected a strong understanding of the Navigation & cargo operations.'
  });
  const [editingB6InterviewComment, setEditingB6InterviewComment] = useState<string | null>('1'); // Default to editing mode for first interview

  // Mapping for interviewer values to display names
  const interviewerDisplayNames: {[key: string]: string} = {
    'capt-nick': 'Capt. Nick, Marine Superintendent',
    'john-doe': 'John Doe, HR Manager', 
    'sarah-smith': 'Sarah Smith, Technical Manager'
  };

  // State for B7 Training Needs
  const [b7TrainingNeeds, setB7TrainingNeeds] = useState<Array<{id: string, training: string, identifiedBy: string, category: string, dueDate: string, comments: string}>>([
    { id: '1', training: 'Basic Safety Training', identifiedBy: 'Port State Control', category: 'Mandatory', dueDate: '2024-01-30', comments: 'Required for STCW compliance' },
    { id: '2', training: 'Advanced Fire Fighting', identifiedBy: 'Safety Officer', category: 'Recommended', dueDate: '2024-03-15', comments: 'Due for renewal' }
  ]);

  // State for B8 multiple comments per question
  const [b8Comments, setB8Comments] = useState<{[key: string]: Array<{user: string, text: string, id: string}>}>({});
  const [editingB8Comment, setEditingB8Comment] = useState<string | null>(null);
  const [newB8Comment, setNewB8Comment] = useState<{[key: string]: string}>({});

  const [formData, setFormData] = useState<FormData>({
    // Initialize with candidate data
    firstName: candidate.firstName || '',
    middleName: candidate.middleName || '',
    familyName: candidate.familyName || '',
    nationality: candidate.nationality || '',
    presentRank: candidate.presentRank || '',
    dateOfBirth: candidate.dob || '',
    placeOfBirthCity: 'Delhi',
    placeOfBirthCountry: 'India',
    ageInYears: '44',
    heightCm: '175',
    weightKg: '85',
    nativeLanguage: 'Hindi',
    foreignLanguages: 'English, Spanish',
    englishProficiency: 'Good',
    rankAppliedFor: candidate.rankAppliedFor || '',
    manningAgent: 'ABC Crew Services',
    fileNo: candidate.fileNo || '',
    
    // A1.2 defaults
    countryOfResidence: 'India',
    nearestAirport: 'Delhi',
    residentialAddressLine1: 'House No XX, Building/ Street XX',
    residentialAddressLine2: 'City XX, State XX',
    contactLandline: '175 5656 8899',
    mobile: '078 000 0000',
    email: 'abc@gmail.com',
    
    // A1.3 defaults
    maritalStatus: 'Married',
    numberOfDependentChildren: '2',
    fatherName: 'Brij Kohli',
    motherName: 'Sunita Kohli',
    spouseFirstName: 'Mira',
    spouseMiddleName: 'Kumari',
    spouseFamilyName: 'Kohli',
    spouseDateOfBirth: '02 Feb 1978',
    children: [
      {
        firstName: 'Sneh',
        middleName: 'Singh',
        familyName: 'Kohli',
        dateOfBirth: '15 Feb 2005',
        gender: 'Son'
      },
      {
        firstName: 'Sita',
        middleName: '',
        familyName: 'Kohli',
        dateOfBirth: '08 Mar 2007',
        gender: 'Daughter'
      }
    ],
    nokFirstName: 'Sunita',
    nokMiddleName: '',
    nokFamilyName: 'Kohli',
    nokTelephone: '+91 76543212',
    nokEmail: 'sunita@gmail.com',
    nokAddress: 'House No XX, Building/ Street XX, City, State',
    nokRelationship: 'Wife',
    
    // A2.1 Default documents
    documents: [
      { id: '1', document: 'Passport', number: 'Z1398745', issued: '30 Jan 2022', expiry: '23 Mar 2032', issuingAuthority: 'MOFA Govt. of India' },
      { id: '2', document: 'National Seaman\'s Book', number: 'Z1398745', issued: '30 Jan 2022', expiry: '23 Mar 2032', issuingAuthority: 'Shipping Office Govt. Of India' },
      { id: '3', document: 'Yellow Fever Vaccination', number: 'Z1398745', issued: '30 Jan 2022', expiry: '23 Mar 2032', issuingAuthority: 'Liberian Maritime Authority' },
      { id: '4', document: 'INDOS No.( Indian personnel only )', number: 'Z1398745', issued: '30 Jan 2022', expiry: '23 Mar 2032', issuingAuthority: 'DMA' }
    ],
    
    // A2.2 Default visas
    visas: [
      { id: '1', issuingCountry: 'U.S.A', serialNo: 'UHR 2345678', issued: 'dd/mm/yyyy', expiry: 'dd/mm/yyyy', visaType: 'B1 B2' },
      { id: '2', issuingCountry: 'Australia', serialNo: 'SMH 2345678', issued: 'dd/mm/yyyy', expiry: 'dd/mm/yyyy', visaType: 'ABC' },
      { id: '3', issuingCountry: 'Schengen', serialNo: 'SCH 2345678', issued: 'dd/mm/yyyy', expiry: 'dd/mm/yyyy', visaType: 'Multi' }
    ],
    
    // A3.1 Default education
    education: [
      { id: '1', dateOfCompletion: '30 Jan 2022', schoolCollegeUniversity: 'University of XX', subjectsField: 'Marine Engineering', qualifications: 'B.Tech' },
      { id: '2', dateOfCompletion: '30 Jan 2018', schoolCollegeUniversity: 'XYZ High School', subjectsField: 'Science', qualifications: '12 th' }
    ],
    
    // A3.2 Default licenses
    licenses: [
      { id: 'A 01', certificateDocument: 'Certificate of Competency', abbr: 'COC', requirement: 'STCW II & III', certificateNo: 'BAH 2345678', issuingAuthority: 'Authority 1', issued: '30 Jan 2022', expiry: '23 Mar 2032' },
      { id: 'A 02', certificateDocument: 'DCE Oil', abbr: 'DCEO', requirement: 'STCW IV/2', certificateNo: 'BAH 2345678', issuingAuthority: 'Authority 2', issued: '30 Jan 2022', expiry: '23 Mar 2032' }
    ],
    
    // A3.3 Default training courses
    trainingCourses: [
      { id: 'A 01', trainingCourse: 'Risk Assessment', abbr: 'COC', requirement: 'STCW II & III', certificateNo: 'BAH 2345678', issuingAuthority: 'Authority 1', issued: '30 Jan 2022', expiry: '23 Mar 2032' },
      { id: 'A 02', trainingCourse: 'Safety Officer', abbr: 'DCEO', requirement: 'STCW IV/2', certificateNo: 'BAH 2345678', issuingAuthority: 'Authority 2', issued: '30 Jan 2022', expiry: '23 Mar 2032' }
    ],
    
    // A4.1 Default sea service records (with proper date format)
    seaService: [
      { id: '1', vesselName: 'SS Mariner', vesselType: 'Cargo', deadweight: '20000 DWT', engineTypePower: 'MAN B&W / 16000 kW', ownerOperator: 'Oceanic Shipping Co.', rank: 'Captain', from: '2023-01-01', to: '2023-03-31', periodMonths: '3.0M' },
      { id: '2', vesselName: 'MV Neptune', vesselType: 'Tanker', deadweight: '30000 DWT', engineTypePower: 'Wartsila / 18000 kW', ownerOperator: 'Blue Wave Ltd.', rank: 'First Mate', from: '2023-04-01', to: '2023-06-30', periodMonths: '3.0M' },
      { id: '3', vesselName: 'SS Voyager', vesselType: 'Container', deadweight: '25000 DWT', engineTypePower: 'Sulzer / 14000 kW', ownerOperator: 'Global Maritime Inc.', rank: 'Chief Engineer', from: '2023-07-01', to: '2023-09-30', periodMonths: '3.0M' },
      { id: '4', vesselName: 'MV Explorer', vesselType: 'Bulk', deadweight: '28000 DWT', engineTypePower: 'MAN B&W / 15000 kW', ownerOperator: 'Seaspan Corporation', rank: 'Navigator', from: '2023-10-01', to: '2023-12-31', periodMonths: '3.0M' },
      { id: '5', vesselName: 'SS Discovery', vesselType: 'Oil Tanker', deadweight: '35000 DWT', engineTypePower: 'Wartsila / 20000 kW', ownerOperator: 'Maritime Solutions Ltd.', rank: 'Second Mate', from: '2024-01-01', to: '2024-03-31', periodMonths: '3.0M' },
      { id: '6', vesselName: 'MV Pioneer', vesselType: 'Cargo', deadweight: '22000 DWT', engineTypePower: 'Sulzer / 17000 kW', ownerOperator: 'Ocean Fleet Corp.', rank: 'Bosun', from: '2024-04-01', to: '2024-06-30', periodMonths: '3.0M' },
      { id: '7', vesselName: 'SS Adventurer', vesselType: 'Container', deadweight: '27000 DWT', engineTypePower: 'MAN B&W / 16000 kW', ownerOperator: 'Global Maritime Inc.', rank: 'Deckhand', from: '2024-07-01', to: '2024-09-30', periodMonths: '3.0M' },
      { id: '8', vesselName: 'MV Navigator', vesselType: 'Bulk Carrier', deadweight: '24000 DWT', engineTypePower: 'Wartsila / 18000 kW', ownerOperator: 'Seaspan Corporation', rank: 'Able Seaman', from: '2024-10-01', to: '2024-12-31', periodMonths: '3.0M' },
      { id: '9', vesselName: 'SS Endeavor', vesselType: 'Oil Tanker', deadweight: '32000 DWT', engineTypePower: 'Sulzer / 19000 kW', ownerOperator: 'Maritime Solutions Ltd.', rank: 'Chief Officer', from: '2025-01-01', to: '2025-03-31', periodMonths: '3.0M' },
      { id: '10', vesselName: 'MV Explorer', vesselType: 'Tanker', deadweight: '31000 DWT', engineTypePower: 'Wartsila / 17000 kW', ownerOperator: 'Blue Wave Ltd.', rank: 'Third Mate', from: '2025-04-01', to: '2025-06-30', periodMonths: '3.0M' }
    ],

    // A5 Default additional information (configured from Crew Admin)
    additionalInfo: [
      { id: 'A5.1', information: 'Cargoes Carried', response: '' },
      { id: 'A5.2', information: 'Trading Pattern', response: '' },
      { id: 'A5.3', information: 'Nationalities sailed with', response: '' }
    ],

    // Part B - Office Screening defaults
    b1AgeMeetsCriteria: '',
    b1RankMeetsCriteria: '',
    b1CertificatesValid: '',
    b1Shortlisted: '',
    b1Comments: '',
    b1SubmittedBy: '',
    b1SubmittedDate: '',
    
    // B2 Reference Checks defaults
    b2ReferenceChecksCompleted: '',
    b2CurrentEmployerFeedback: '',
    b2SubmittedBy: '',
    b2SubmittedDate: '',
    
    // B3 Background Security Checks defaults
    b3SecurityChecksCompleted: '',
    b3SecurityChecksResults: '',
    b3SubmittedBy: '',
    b3SubmittedDate: '',
    
    // B4 Authentication of Certificates & Documents defaults
    b4CertificatesAuthenticated: '',
    b4AuthenticationResults: '',
    b4SubmittedBy: '',
    b4SubmittedDate: '',
    
    // B5 CES/Language Test Results defaults
    b5CesTestsCompleted: '',
    b5SubmittedBy: '',
    b5SubmittedDate: '',
    
    // B6 Interviews defaults
    b6InterviewCompleted: '',
    b6SubmittedBy: '',
    b6SubmittedDate: '',
    
    // B7 Training Needs Identified defaults
    b7SubmittedBy: '',
    b7SubmittedDate: '',
    
    // B8 Short Listing defaults
    b8Shortlisted: '',
    b8SubmittedBy: '',
    b8SubmittedDate: ''
  });

  // Handle click outside to auto-save sections
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
      
      // Check if click is outside section A1.1
      if (editingSections['A1.1'] && sectionA11Ref.current && !sectionA11Ref.current.contains(target)) {
        setEditingSections(prev => ({ ...prev, 'A1.1': false }));
      }
      
      // Check if click is outside section A1.2
      if (editingSections['A1.2'] && sectionA12Ref.current && !sectionA12Ref.current.contains(target)) {
        setEditingSections(prev => ({ ...prev, 'A1.2': false }));
      }
      
      // Check if click is outside section A1.3
      if (editingSections['A1.3'] && sectionA13Ref.current && !sectionA13Ref.current.contains(target)) {
        setEditingSections(prev => ({ ...prev, 'A1.3': false }));
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editingSections]);

  const sections = [
    { id: 'A1', title: 'Seafarers\' Particulars', number: 'A1' },
    { id: 'A2', title: 'Travel & ID Documents', number: 'A2' },
    { id: 'A3', title: 'Training & Certificates', number: 'A3' },
    { id: 'A4', title: 'Sea Service', number: 'A4' },
    { id: 'A5', title: 'Additional Information', number: 'A5' },
    { id: 'B', title: 'Company Processing', number: 'B' },
    { id: 'C', title: 'Approval', number: 'C' }
  ];

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

  // Document management functions
  const addDocument = () => {
    const newDoc = {
      id: Date.now().toString(),
      document: '',
      number: '',
      issued: '',
      expiry: '',
      issuingAuthority: ''
    };
    setFormData(prev => ({
      ...prev,
      documents: [...prev.documents, newDoc]
    }));
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
    const newVisa = {
      id: Date.now().toString(),
      issuingCountry: '',
      serialNo: '',
      issued: '',
      expiry: '',
      visaType: ''
    };
    setFormData(prev => ({
      ...prev,
      visas: [...prev.visas, newVisa]
    }));
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
    const newEducation = {
      id: Date.now().toString(),
      dateOfCompletion: '',
      schoolCollegeUniversity: '',
      subjectsField: '',
      qualifications: ''
    };
    setFormData(prev => ({
      ...prev,
      education: [...prev.education, newEducation]
    }));
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
    const newLicense = {
      id: `A ${String(formData.licenses.length + 1).padStart(2, '0')}`,
      certificateDocument: '',
      abbr: '',
      requirement: '',
      certificateNo: '',
      issuingAuthority: '',
      issued: '',
      expiry: ''
    };
    setFormData(prev => ({
      ...prev,
      licenses: [...prev.licenses, newLicense]
    }));
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
    const newCourse = {
      id: `A ${String(formData.trainingCourses.length + 1).padStart(2, '0')}`,
      trainingCourse: '',
      abbr: '',
      requirement: '',
      certificateNo: '',
      issuingAuthority: '',
      issued: '',
      expiry: ''
    };
    setFormData(prev => ({
      ...prev,
      trainingCourses: [...prev.trainingCourses, newCourse]
    }));
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

  // Sea Service management functions
  const addSeaService = () => {
    const newService = {
      id: Date.now().toString(),
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
    setFormData(prev => ({
      ...prev,
      seaService: [...prev.seaService, newService]
    }));
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
    setB7TrainingNeeds(prev => [...prev, newTraining]);
  };

  const removeB7TrainingNeed = (id: string) => {
    setB7TrainingNeeds(prev => prev.filter(training => training.id !== id));
  };

  const updateB7TrainingNeed = (id: string, field: string, value: string) => {
    setB7TrainingNeeds(prev => prev.map(training => 
      training.id === id ? { ...training, [field]: value } : training
    ));
  };

  // Additional Information management functions
  const addAdditionalInfo = () => {
    const newInfo = {
      id: `A5.${formData.additionalInfo.length + 1}`,
      information: '',
      response: ''
    };
    setFormData(prev => ({
      ...prev,
      additionalInfo: [...prev.additionalInfo, newInfo]
    }));
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

  // Comprehensive nationality list matching AppraisalForm standards
  const NATIONALITIES = [
    "Afghan", "Albanian", "Algerian", "American", "Andorran", "Angolan", "Antiguan", "Argentine", "Armenian", "Australian",
    "Austrian", "Azerbaijani", "Bahamian", "Bahraini", "Bangladeshi", "Barbadian", "Belarusian", "Belgian", "Belizean", "Beninese",
    "Bhutanese", "Bolivian", "Bosnian", "Brazilian", "British", "Bruneian", "Bulgarian", "Burkinabe", "Burmese", "Burundian",
    "Cambodian", "Cameroonian", "Canadian", "Cape Verdean", "Central African", "Chadian", "Chilean", "Chinese", "Colombian", "Comoran",
    "Congolese", "Costa Rican", "Croatian", "Cuban", "Cypriot", "Czech", "Danish", "Djibouti", "Dominican", "Dutch",
    "East Timorese", "Ecuadorean", "Egyptian", "Emirian", "Equatorial Guinean", "Eritrean", "Estonian", "Ethiopian", "Fijian", "Filipino",
    "Finnish", "French", "Gabonese", "Gambian", "Georgian", "German", "Ghanaian", "Greek", "Grenadian", "Guatemalan",
    "Guinea-Bissauan", "Guinean", "Guyanese", "Haitian", "Herzegovinian", "Honduran", "Hungarian", "I-Kiribati", "Icelander", "Indian",
    "Indonesian", "Iranian", "Iraqi", "Irish", "Israeli", "Italian", "Ivorian", "Jamaican", "Japanese", "Jordanian",
    "Kazakhstani", "Kenyan", "Kittian and Nevisian", "Kuwaiti", "Kyrgyz", "Laotian", "Latvian", "Lebanese", "Liberian", "Libyan",
    "Liechtensteiner", "Lithuanian", "Luxembourger", "Macedonian", "Malagasy", "Malawian", "Malaysian", "Maldivan", "Malian", "Maltese",
    "Marshallese", "Mauritanian", "Mauritian", "Mexican", "Micronesian", "Moldovan", "Monacan", "Mongolian", "Moroccan", "Mosotho",
    "Motswana", "Mozambican", "Namibian", "Nauruan", "Nepalese", "New Zealander", "Nicaraguan", "Nigerian", "Nigerien", "North Korean",
    "Northern Irish", "Norwegian", "Omani", "Pakistani", "Palauan", "Panamanian", "Papua New Guinean", "Paraguayan", "Peruvian", "Polish",
    "Portuguese", "Qatari", "Romanian", "Russian", "Rwandan", "Saint Lucian", "Salvadoran", "Samoan", "San Marinese", "Sao Tomean",
    "Saudi", "Scottish", "Senegalese", "Serbian", "Seychellois", "Sierra Leonean", "Singaporean", "Slovakian", "Slovenian", "Solomon Islander",
    "Somali", "South African", "South Korean", "Spanish", "Sri Lankan", "Sudanese", "Surinamer", "Swazi", "Swedish", "Swiss",
    "Syrian", "Taiwanese", "Tajik", "Tanzanian", "Thai", "Togolese", "Tongan", "Trinidadian or Tobagonian", "Tunisian", "Turkish",
    "Tuvaluan", "Ugandan", "Ukrainian", "Uruguayan", "Uzbekistani", "Venezuelan", "Vietnamese", "Welsh", "Yemenite", "Zambian", "Zimbabwean"
  ];

  // Master data from #Country Master# (placeholder until Crew Admin integration)
  const countryMasterData = [
    "Afghanistan", "Albania", "Algeria", "United States", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia",
    "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin",
    "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Brazil", "United Kingdom", "Brunei", "Bulgaria", "Burkina Faso", "Myanmar", "Burundi",
    "Cambodia", "Cameroon", "Canada", "Cape Verde", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros",
    "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominican Republic", "Netherlands",
    "East Timor", "Ecuador", "Egypt", "United Arab Emirates", "Equatorial Guinea", "Eritrea", "Estonia", "Ethiopia", "Fiji", "Philippines",
    "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala",
    "Guinea-Bissau", "Guinea", "Guyana", "Haiti", "Bosnia and Herzegovina", "Honduras", "Hungary", "Kiribati", "Iceland", "India",
    "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Ivory Coast", "Jamaica", "Japan", "Jordan",
    "Kazakhstan", "Kenya", "Saint Kitts and Nevis", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Liberia", "Libya",
    "Liechtenstein", "Lithuania", "Luxembourg", "North Macedonia", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta",
    "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Morocco", "Lesotho",
    "Botswana", "Mozambique", "Namibia", "Nauru", "Nepal", "New Zealand", "Nicaragua", "Nigeria", "Niger", "North Korea",
    "Northern Ireland", "Norway", "Oman", "Pakistan", "Palau", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Poland",
    "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Lucia", "El Salvador", "Samoa", "San Marino", "Sao Tome and Principe",
    "Saudi Arabia", "Scotland", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands",
    "Somalia", "South Africa", "South Korea", "Spain", "Sri Lanka", "Sudan", "Suriname", "Eswatini", "Sweden", "Switzerland",
    "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey",
    "Tuvalu", "Uganda", "Ukraine", "Uruguay", "Uzbekistan", "Venezuela", "Vietnam", "Wales", "Yemen", "Zambia", "Zimbabwe"
  ];

  // Master data from #Language Master# (placeholder until Crew Admin integration)  
  const languageMasterData = [
    "English", "Mandarin Chinese", "Spanish", "Hindi", "Arabic", "Portuguese", "Bengali", "Russian", "Japanese", "French",
    "German", "Korean", "Italian", "Vietnamese", "Turkish", "Polish", "Dutch", "Greek", "Czech", "Romanian",
    "Hungarian", "Swedish", "Norwegian", "Danish", "Finnish", "Hebrew", "Thai", "Malay", "Indonesian", "Filipino",
    "Urdu", "Persian", "Ukrainian", "Croatian", "Serbian", "Bulgarian", "Slovak", "Slovenian", "Lithuanian", "Latvian",
    "Estonian", "Georgian", "Armenian", "Kazakh", "Uzbek", "Mongolian", "Nepali", "Sinhala", "Tamil", "Telugu",
    "Marathi", "Gujarati", "Punjabi", "Malayalam", "Kannada", "Oriya", "Assamese", "Swahili", "Amharic", "Yoruba",
    "Igbo", "Hausa", "Zulu", "Afrikaans", "Xhosa", "Sesotho", "Setswana", "Shona", "Ndebele", "Venda"
  ];

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

  // Placeholder master data (until Crew Admin masters are created)
  const vesselTypeMasterData = [
    'Cargo', 'Tanker', 'Container', 'Bulk Carrier', 'Oil Tanker', 'Chemical Tanker',
    'Gas Carrier', 'Ro-Ro', 'Passenger', 'Cruise', 'Ferry', 'Offshore',
    'Tug', 'Dredger', 'Research Vessel', 'Naval Vessel'
  ];

  const rankMasterData = [
    'Captain', 'Chief Officer', 'First Mate', 'Second Mate', 'Third Mate',
    'Chief Engineer', 'Second Engineer', 'Third Engineer', 'Navigator',
    'Bosun', 'Able Seaman', 'Ordinary Seaman', 'Deckhand', 'Radio Officer',
    'Electrical Officer', 'Cadet', 'Motorman', 'Oiler', 'Wiper', 'Cook'
  ];

  // Photo upload handling
  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }
      
      setPhotoFile(file);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedPhoto(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setUploadedPhoto(null);
    setPhotoFile(null);
  };

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
          {/* Photo Upload Area */}
          <div className="lg:col-span-3 space-y-4">
            <div className="relative">
              {uploadedPhoto ? (
                <div className="relative w-32 h-40 rounded-lg overflow-hidden border-2 border-gray-300">
                  <img 
                    src={uploadedPhoto} 
                    alt="Uploaded photo" 
                    className="w-full h-full object-cover"
                  />
                  {isEditing && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6"
                      onClick={removePhoto}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ) : (
                <div className="w-32 h-40 bg-gray-50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors">
                  <div className="text-center">
                    <Camera className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <div className="text-sm text-gray-500 mb-2">Upload Photo</div>
                    {isEditing && (
                      <label htmlFor="photo-upload" className="cursor-pointer">
                        <input
                          id="photo-upload"
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="hidden"
                        />
                        <div className="text-xs text-blue-600 hover:text-blue-800">Choose file</div>
                      </label>
                    )}
                  </div>
                </div>
              )}
              {isEditing && uploadedPhoto && (
                <label htmlFor="photo-upload" className="mt-2 block">
                  <input
                    id="photo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    className="w-full text-xs"
                    onClick={() => document.getElementById('photo-upload')?.click()}
                  >
                    Change Photo
                  </Button>
                </label>
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
                      {rankMasterData.map(rank => (
                        <SelectItem key={rank} value={rank}>{rank}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="mt-1 text-sm text-gray-900">{formData.rankAppliedFor}</div>
                )}
              </div>
              
              <div>
                <Label className="text-xs text-gray-500 tracking-wide">Manning Agent</Label>
                {isEditing ? (
                  <Input
                    value={formData.manningAgent}
                    onChange={(e) => updateFormData('manningAgent', e.target.value)}
                    className="mt-1"
                  />
                ) : (
                  <div className="mt-1 text-sm text-gray-900">{formData.manningAgent}</div>
                )}
              </div>
              
              <div>
                <Label className="text-xs text-gray-500 tracking-wide">File No</Label>
                {isEditing ? (
                  <Input
                    value={formData.fileNo}
                    onChange={(e) => updateFormData('fileNo', e.target.value)}
                    className="mt-1"
                  />
                ) : (
                  <div className="mt-1 text-sm text-gray-900">{formData.fileNo}</div>
                )}
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
              <Label className="text-xs text-gray-500 tracking-wide">Present Rank</Label>
              {isEditing ? (
                <Select value={formData.presentRank} onValueChange={(value) => updateFormData('presentRank', value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select rank" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {rankMasterData.map(rank => (
                      <SelectItem key={rank} value={rank}>{rank}</SelectItem>
                    ))}
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
                    {languageMasterData.map(language => (
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
                      {languageMasterData.map(language => {
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
                    <SelectItem value="Excellent">Excellent</SelectItem>
                    <SelectItem value="Good">Good</SelectItem>
                    <SelectItem value="Average">Average</SelectItem>
                    <SelectItem value="Poor">Poor</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="mt-1 text-sm text-gray-900">{formData.englishProficiency}</div>
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
              <Select value={formData.residentialAddressLine2} onValueChange={(value) => updateFormData('residentialAddressLine2', value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select city, state, PIN" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {cityMasterData.map(city => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
      <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>A2.1 Travel and Identification Docs</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={addDocument}
            className="text-gray-600 border-gray-300 hover:bg-gray-50"
          >
            <Plus className="h-4 w-4 mr-2" />
            ADD
          </Button>
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
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-gray-600">
                      <Paperclip className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-gray-600">
                      <Edit className="h-3 w-3" />
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
          <Button
            variant="outline"
            size="sm"
            onClick={addVisa}
            className="text-gray-600 border-gray-300 hover:bg-gray-50"
          >
            <Plus className="h-4 w-4 mr-2" />
            ADD
          </Button>
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
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-gray-600">
                      <Paperclip className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-gray-600">
                      <Edit className="h-3 w-3" />
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
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-gray-600">
                      <Paperclip className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-gray-600">
                      <Edit className="h-3 w-3" />
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
              className="text-gray-600 border-gray-300 hover:bg-gray-50 text-xs"
            >
              + ADD FROM DATABASE
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={addLicense}
              className="text-gray-600 border-gray-300 hover:bg-gray-50"
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
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Issuing Authority</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Issued</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Expiry</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3 w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {formData.licenses.map((license) => (
              <TableRow key={license.id} className="border-b border-gray-200">
                <TableCell className="p-3">
                  <div className="text-[#4f5863] text-[13px]">{license.id}</div>
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
                  <Input
                    value={license.issuingAuthority}
                    onChange={(e) => updateLicense(license.id, 'issuingAuthority', e.target.value)}
                    className="text-[#4f5863] text-[13px] border-0 shadow-none p-0 h-auto"
                  />
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
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-gray-600">
                      <Paperclip className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-gray-600">
                      <Edit className="h-3 w-3" />
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
              className="text-gray-600 border-gray-300 hover:bg-gray-50 text-xs"
            >
              + ADD FROM DATABASE
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={addTrainingCourse}
              className="text-gray-600 border-gray-300 hover:bg-gray-50"
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
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-gray-600">
                      <Paperclip className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-gray-600">
                      <Edit className="h-3 w-3" />
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
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Vessel Name</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Vessel Type</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Deadweight</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Engine Type/ Power</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Owner / operator</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Rank</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">From</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">To</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">Period(M)</TableHead>
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3 w-24">Actions</TableHead>
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
                      {vesselTypeMasterData.map((vesselType) => (
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
                      {rankMasterData.map((rank) => (
                        <SelectItem key={rank} value={rank}>
                          {rank}
                        </SelectItem>
                      ))}
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
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-gray-600">
                      <Edit className="h-3 w-3" />
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
        <div className="mb-4">
          <h3 className="text-base font-medium mb-2" style={{ color: '#16569e' }}>A5.1 Details on Additional Information required</h3>
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
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-gray-600">
                      <Paperclip className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-gray-600">
                      <Edit className="h-3 w-3" />
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
        
        <div className="mt-4 flex justify-end">
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
                    <div className="flex items-center space-x-2 w-[50px]">
                      <RadioGroup 
                        value={formData[question.field as keyof FormData] as string} 
                        onValueChange={(value) => updateFormData(question.field as keyof FormData, value)}
                        className="flex"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="yes" id={`${question.id}-yes`} />
                          <Label htmlFor={`${question.id}-yes`} className="text-sm cursor-pointer">Yes</Label>
                        </div>
                      </RadioGroup>
                    </div>
                    <div className="flex items-center space-x-2 w-[50px]">
                      <RadioGroup 
                        value={formData[question.field as keyof FormData] as string} 
                        onValueChange={(value) => updateFormData(question.field as keyof FormData, value)}
                        className="flex"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="no" id={`${question.id}-no`} />
                          <Label htmlFor={`${question.id}-no`} className="text-sm cursor-pointer">No</Label>
                        </div>
                      </RadioGroup>
                    </div>
                    {question.hasNA && (
                      <div className="flex items-center space-x-2 w-[50px]">
                        <RadioGroup 
                          value={formData[question.field as keyof FormData] as string} 
                          onValueChange={(value) => updateFormData(question.field as keyof FormData, value)}
                          className="flex"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="na" id={`${question.id}-na`} />
                            <Label htmlFor={`${question.id}-na`} className="text-sm cursor-pointer">NA</Label>
                          </div>
                        </RadioGroup>
                      </div>
                    )}
                    {!question.hasNA && <div className="w-[50px]"></div>}
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
              {(b1Comments[question.id]?.length > 0 || newB1Comment[question.id] !== undefined) && (
                <div className="ml-4 mb-4 space-y-2">
                  {/* Existing comments */}
                  {b1Comments[question.id]?.map((comment) => (
                    <div key={comment.id} className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="text-blue-600 italic text-[13px] mb-2">{comment.user}:</div>
                        {editingB1Comment === comment.id ? (
                          <Textarea
                            value={comment.text}
                            onChange={(e) => {
                              setB1Comments(prev => ({
                                ...prev,
                                [question.id]: prev[question.id]?.map(c => 
                                  c.id === comment.id ? { ...c, text: e.target.value } : c
                                ) || []
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
                            setB1Comments(prev => ({
                              ...prev,
                              [question.id]: prev[question.id]?.filter(c => c.id !== comment.id) || []
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
                      <div className="text-sm font-medium text-gray-600 mb-2">Roxanne, Crewing Executive</div>
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
                            setB1Comments(prev => ({
                              ...prev,
                              [question.id]: [
                                ...(prev[question.id] || []),
                                {
                                  id: commentId,
                                  user: "Roxanne, Crewing Executive",
                                  text: newB1Comment[question.id]
                                }
                              ]
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

          {/* Upload button */}
          <div className="flex justify-start mt-6">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-gray-600 border-gray-300 hover:bg-gray-50"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload
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
                  updateFormData('b1SubmittedBy', 'Roxanne, Crewing Executive');
                  updateFormData('b1SubmittedDate', currentDate);
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
                  <div className="flex items-center space-x-2 w-[50px]">
                    <RadioGroup 
                      value={formData.b2ReferenceChecksCompleted as string} 
                      onValueChange={(value) => updateFormData('b2ReferenceChecksCompleted', value)}
                      className="flex"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="b2-completed-yes" />
                        <Label htmlFor="b2-completed-yes" className="text-sm cursor-pointer">Yes</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="flex items-center space-x-2 w-[50px]">
                    <RadioGroup 
                      value={formData.b2ReferenceChecksCompleted as string} 
                      onValueChange={(value) => updateFormData('b2ReferenceChecksCompleted', value)}
                      className="flex"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="b2-completed-no" />
                        <Label htmlFor="b2-completed-no" className="text-sm cursor-pointer">No</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="flex items-center space-x-2 w-[50px]">
                    <RadioGroup 
                      value={formData.b2ReferenceChecksCompleted as string} 
                      onValueChange={(value) => updateFormData('b2ReferenceChecksCompleted', value)}
                      className="flex"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="na" id="b2-completed-na" />
                        <Label htmlFor="b2-completed-na" className="text-sm cursor-pointer">NA</Label>
                      </div>
                    </RadioGroup>
                  </div>
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
                {b2References.map((reference, index) => (
                  <div key={reference.id} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Input
                        type="date"
                        placeholder="Date"
                        className="text-sm"
                        value={reference.date}
                        onChange={(e) => {
                          setB2References(prev => prev.map(ref => 
                            ref.id === reference.id 
                              ? { ...ref, date: e.target.value }
                              : ref
                          ));
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
                          setB2References(prev => prev.map(ref => 
                            ref.id === reference.id 
                              ? { ...ref, nameDesignation: e.target.value }
                              : ref
                          ));
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
                          setB2References(prev => prev.map(ref => 
                            ref.id === reference.id 
                              ? { ...ref, contactInfo: e.target.value }
                              : ref
                          ));
                        }}
                      />
                      {index === b2References.length - 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-10 w-10 p-0 border-gray-300"
                          onClick={() => {
                            const newId = (b2References.length + 1).toString();
                            setB2References(prev => [...prev, { 
                              id: newId, 
                              date: '', 
                              nameDesignation: '', 
                              contactInfo: '' 
                            }]);
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      )}
                      {b2References.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-10 w-10 p-0"
                          onClick={() => {
                            setB2References(prev => prev.filter(ref => ref.id !== reference.id));
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      {b2References.length === 1 && (
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
            {(b2Comments['b2-completed']?.length > 0 || newB2Comment['b2-completed'] !== undefined) && (
              <div className="ml-4 mb-4 space-y-2">
                {b2Comments['b2-completed']?.map((comment) => (
                  <div key={comment.id} className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="text-blue-600 italic text-[13px] mb-2">{comment.user}:</div>
                      {editingB2Comment === comment.id ? (
                        <Textarea
                          value={comment.text}
                          onChange={(e) => {
                            setB2Comments(prev => ({
                              ...prev,
                              'b2-completed': prev['b2-completed']?.map(c => 
                                c.id === comment.id ? { ...c, text: e.target.value } : c
                              ) || []
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
                          setB2Comments(prev => ({
                            ...prev,
                            'b2-completed': prev['b2-completed']?.filter(c => c.id !== comment.id) || []
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
                    <div className="text-sm font-medium text-gray-600 mb-2">Roxanne, Crewing Executive</div>
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
                          setB2Comments(prev => ({
                            ...prev,
                            'b2-completed': [
                              ...(prev['b2-completed'] || []),
                              {
                                id: commentId,
                                user: "Roxanne, Crewing Executive",
                                text: newB2Comment['b2-completed']
                              }
                            ]
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
                  <div className="flex items-center space-x-2 w-[50px]">
                    <RadioGroup 
                      value={formData.b2CurrentEmployerFeedback as string} 
                      onValueChange={(value) => updateFormData('b2CurrentEmployerFeedback', value)}
                      className="flex"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="b2-results-yes" />
                        <Label htmlFor="b2-results-yes" className="text-sm cursor-pointer">Yes</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="flex items-center space-x-2 w-[50px]">
                    <RadioGroup 
                      value={formData.b2CurrentEmployerFeedback as string} 
                      onValueChange={(value) => updateFormData('b2CurrentEmployerFeedback', value)}
                      className="flex"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="b2-results-no" />
                        <Label htmlFor="b2-results-no" className="text-sm cursor-pointer">No</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="flex items-center space-x-2 w-[50px]">
                    <RadioGroup 
                      value={formData.b2CurrentEmployerFeedback as string} 
                      onValueChange={(value) => updateFormData('b2CurrentEmployerFeedback', value)}
                      className="flex"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="na" id="b2-results-na" />
                        <Label htmlFor="b2-results-na" className="text-sm cursor-pointer">NA</Label>
                      </div>
                    </RadioGroup>
                  </div>
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
            {(b2Comments['b2-results']?.length > 0 || newB2Comment['b2-results'] !== undefined) && (
              <div className="ml-4 mb-4 space-y-2">
                {b2Comments['b2-results']?.map((comment) => (
                  <div key={comment.id} className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="text-blue-600 italic text-[13px] mb-2">{comment.user}:</div>
                      {editingB2Comment === comment.id ? (
                        <Textarea
                          value={comment.text}
                          onChange={(e) => {
                            setB2Comments(prev => ({
                              ...prev,
                              'b2-results': prev['b2-results']?.map(c => 
                                c.id === comment.id ? { ...c, text: e.target.value } : c
                              ) || []
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
                          setB2Comments(prev => ({
                            ...prev,
                            'b2-results': prev['b2-results']?.filter(c => c.id !== comment.id) || []
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
                    <div className="text-sm font-medium text-gray-600 mb-2">Roxanne, Crewing Executive</div>
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
                          setB2Comments(prev => ({
                            ...prev,
                            'b2-results': [
                              ...(prev['b2-results'] || []),
                              {
                                id: commentId,
                                user: "Roxanne, Crewing Executive",
                                text: newB2Comment['b2-results']
                              }
                            ]
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

          {/* Upload button */}
          <div className="flex justify-start">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-gray-600 border-gray-300 hover:bg-gray-50"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload
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
                  updateFormData('b2SubmittedBy', 'Roxanne, Crewing Executive');
                  updateFormData('b2SubmittedDate', currentDate);
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
                {b3Authorities.map((authority, index) => (
                  <div key={authority.id} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Input
                        type="date"
                        placeholder="Date"
                        className="text-sm"
                        value={authority.date}
                        onChange={(e) => {
                          setB3Authorities(prev => prev.map(auth => 
                            auth.id === authority.id 
                              ? { ...auth, date: e.target.value }
                              : auth
                          ));
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
                          setB3Authorities(prev => prev.map(auth => 
                            auth.id === authority.id 
                              ? { ...auth, authority: e.target.value }
                              : auth
                          ));
                        }}
                      />
                      {index === b3Authorities.length - 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-10 w-10 p-0 border-gray-300"
                          onClick={() => {
                            const newId = (b3Authorities.length + 1).toString();
                            setB3Authorities(prev => [...prev, { 
                              id: newId, 
                              date: '', 
                              authority: '' 
                            }]);
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      )}
                      {b3Authorities.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-10 w-10 p-0"
                          onClick={() => {
                            setB3Authorities(prev => prev.filter(auth => auth.id !== authority.id));
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      {b3Authorities.length === 1 && (
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
            {(b3Comments['b3-completed']?.length > 0 || newB3Comment['b3-completed'] !== undefined) && (
              <div className="ml-4 mb-4 space-y-2">
                {b3Comments['b3-completed']?.map((comment) => (
                  <div key={comment.id} className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="text-blue-600 italic text-[13px] mb-2">{comment.user}:</div>
                      {editingB3Comment === comment.id ? (
                        <Textarea
                          value={comment.text}
                          onChange={(e) => {
                            setB3Comments(prev => ({
                              ...prev,
                              'b3-completed': prev['b3-completed']?.map(c => 
                                c.id === comment.id ? { ...c, text: e.target.value } : c
                              ) || []
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
                          setB3Comments(prev => ({
                            ...prev,
                            'b3-completed': prev['b3-completed']?.filter(c => c.id !== comment.id) || []
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
                    <div className="text-sm font-medium text-gray-600 mb-2">Roxanne, Crewing Executive</div>
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
                          setB3Comments(prev => ({
                            ...prev,
                            'b3-completed': [
                              ...(prev['b3-completed'] || []),
                              {
                                id: commentId,
                                user: "Roxanne, Crewing Executive",
                                text: newB3Comment['b3-completed']
                              }
                            ]
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
            {(b3Comments['b3-results']?.length > 0 || newB3Comment['b3-results'] !== undefined) && (
              <div className="ml-4 mb-4 space-y-2">
                {b3Comments['b3-results']?.map((comment) => (
                  <div key={comment.id} className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="text-blue-600 italic text-[13px] mb-2">{comment.user}:</div>
                      {editingB3Comment === comment.id ? (
                        <Textarea
                          value={comment.text}
                          onChange={(e) => {
                            setB3Comments(prev => ({
                              ...prev,
                              'b3-results': prev['b3-results']?.map(c => 
                                c.id === comment.id ? { ...c, text: e.target.value } : c
                              ) || []
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
                          setB3Comments(prev => ({
                            ...prev,
                            'b3-results': prev['b3-results']?.filter(c => c.id !== comment.id) || []
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
                    <div className="text-sm font-medium text-gray-600 mb-2">Roxanne, Crewing Executive</div>
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
                          setB3Comments(prev => ({
                            ...prev,
                            'b3-results': [
                              ...(prev['b3-results'] || []),
                              {
                                id: commentId,
                                user: "Roxanne, Crewing Executive",
                                text: newB3Comment['b3-results']
                              }
                            ]
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

          {/* Upload button */}
          <div className="flex justify-start">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-gray-600 border-gray-300 hover:bg-gray-50"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload
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
                  updateFormData('b3SubmittedBy', 'Roxanne, Crewing Executive');
                  updateFormData('b3SubmittedDate', currentDate);
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
                {b4Certificates.map((certificate, index) => (
                  <div key={certificate.id} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Input
                        type="date"
                        placeholder="Date"
                        className="text-sm"
                        value={certificate.date}
                        onChange={(e) => {
                          setB4Certificates(prev => prev.map(cert => 
                            cert.id === certificate.id 
                              ? { ...cert, date: e.target.value }
                              : cert
                          ));
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
                          setB4Certificates(prev => prev.map(cert => 
                            cert.id === certificate.id 
                              ? { ...cert, certificate: e.target.value }
                              : cert
                          ));
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
                          setB4Certificates(prev => prev.map(cert => 
                            cert.id === certificate.id 
                              ? { ...cert, authority: e.target.value }
                              : cert
                          ));
                        }}
                      />
                      {index === b4Certificates.length - 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-10 w-10 p-0 border-gray-300"
                          onClick={() => {
                            const newId = (b4Certificates.length + 1).toString();
                            setB4Certificates(prev => [...prev, { 
                              id: newId, 
                              date: '', 
                              certificate: '',
                              authority: '' 
                            }]);
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      )}
                      {b4Certificates.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-10 w-10 p-0"
                          onClick={() => {
                            setB4Certificates(prev => prev.filter(cert => cert.id !== certificate.id));
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      {b4Certificates.length === 1 && (
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
            {(b4Comments['b4-authenticated']?.length > 0 || newB4Comment['b4-authenticated'] !== undefined) && (
              <div className="ml-4 mb-4 space-y-2">
                {b4Comments['b4-authenticated']?.map((comment) => (
                  <div key={comment.id} className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="text-blue-600 italic text-[13px] mb-2">{comment.user}:</div>
                      {editingB4Comment === comment.id ? (
                        <Textarea
                          value={comment.text}
                          onChange={(e) => {
                            setB4Comments(prev => ({
                              ...prev,
                              'b4-authenticated': prev['b4-authenticated']?.map(c => 
                                c.id === comment.id ? { ...c, text: e.target.value } : c
                              ) || []
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
                          setB4Comments(prev => ({
                            ...prev,
                            'b4-authenticated': prev['b4-authenticated']?.filter(c => c.id !== comment.id) || []
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
                    <div className="text-sm font-medium text-gray-600 mb-2">Roxanne, Crewing Executive</div>
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
                          setB4Comments(prev => ({
                            ...prev,
                            'b4-authenticated': [
                              ...(prev['b4-authenticated'] || []),
                              {
                                id: commentId,
                                user: "Roxanne, Crewing Executive",
                                text: newB4Comment['b4-authenticated']
                              }
                            ]
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
            {(b4Comments['b4-results']?.length > 0 || newB4Comment['b4-results'] !== undefined) && (
              <div className="ml-4 mb-4 space-y-2">
                {b4Comments['b4-results']?.map((comment) => (
                  <div key={comment.id} className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="text-blue-600 italic text-[13px] mb-2">{comment.user}:</div>
                      {editingB4Comment === comment.id ? (
                        <Textarea
                          value={comment.text}
                          onChange={(e) => {
                            setB4Comments(prev => ({
                              ...prev,
                              'b4-results': prev['b4-results']?.map(c => 
                                c.id === comment.id ? { ...c, text: e.target.value } : c
                              ) || []
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
                          setB4Comments(prev => ({
                            ...prev,
                            'b4-results': prev['b4-results']?.filter(c => c.id !== comment.id) || []
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
                    <div className="text-sm font-medium text-gray-600 mb-2">Roxanne, Crewing Executive</div>
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
                          setB4Comments(prev => ({
                            ...prev,
                            'b4-results': [
                              ...(prev['b4-results'] || []),
                              {
                                id: commentId,
                                user: "Roxanne, Crewing Executive",
                                text: newB4Comment['b4-results']
                              }
                            ]
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

          {/* Upload button */}
          <div className="flex justify-start">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-gray-600 border-gray-300 hover:bg-gray-50"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload
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
                  updateFormData('b4SubmittedBy', 'Roxanne, Crewing Executive');
                  updateFormData('b4SubmittedDate', currentDate);
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
                {b5Tests.map((test, index) => (
                  <div key={test.id} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Input
                        type="date"
                        placeholder="Date"
                        className="text-sm"
                        value={test.date}
                        onChange={(e) => {
                          setB5Tests(prev => prev.map(t => 
                            t.id === test.id 
                              ? { ...t, date: e.target.value }
                              : t
                          ));
                        }}
                      />
                    </div>
                    <div>
                      <Select
                        value={test.subject}
                        onValueChange={(value) => {
                          setB5Tests(prev => prev.map(t => 
                            t.id === test.id 
                              ? { ...t, subject: value }
                              : t
                          ));
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
                          setB5Tests(prev => prev.map(t => 
                            t.id === test.id 
                              ? { ...t, score: e.target.value }
                              : t
                          ));
                        }}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Select
                        value={test.result}
                        onValueChange={(value) => {
                          setB5Tests(prev => prev.map(t => 
                            t.id === test.id 
                              ? { ...t, result: value }
                              : t
                          ));
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
                      {index === b5Tests.length - 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-10 w-10 p-0 border-gray-300"
                          onClick={() => {
                            const newId = (b5Tests.length + 1).toString();
                            setB5Tests(prev => [...prev, { 
                              id: newId, 
                              date: '', 
                              subject: '',
                              score: '',
                              result: '' 
                            }]);
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      )}
                      {b5Tests.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-10 w-10 p-0"
                          onClick={() => {
                            setB5Tests(prev => prev.filter(t => t.id !== test.id));
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
            {(b5Comments['b5-completed']?.length > 0 || newB5Comment['b5-completed'] !== undefined) && (
              <div className="ml-4 mb-4 space-y-2">
                {b5Comments['b5-completed']?.map((comment) => (
                  <div key={comment.id} className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="text-blue-600 italic text-[13px] mb-2">{comment.user}:</div>
                      {editingB5Comment === comment.id ? (
                        <Textarea
                          value={comment.text}
                          onChange={(e) => {
                            setB5Comments(prev => ({
                              ...prev,
                              'b5-completed': prev['b5-completed']?.map(c => 
                                c.id === comment.id ? { ...c, text: e.target.value } : c
                              ) || []
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
                          setB5Comments(prev => ({
                            ...prev,
                            'b5-completed': prev['b5-completed']?.filter(c => c.id !== comment.id) || []
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
                    <div className="text-sm font-medium text-gray-600 mb-2">Roxanne, Crewing Executive</div>
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
                          setB5Comments(prev => ({
                            ...prev,
                            'b5-completed': [
                              ...(prev['b5-completed'] || []),
                              {
                                id: commentId,
                                user: "Roxanne, Crewing Executive",
                                text: newB5Comment['b5-completed']
                              }
                            ]
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

          {/* Upload button */}
          <div className="flex justify-start">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-gray-600 border-gray-300 hover:bg-gray-50"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload
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
                  updateFormData('b5SubmittedBy', 'Roxanne, Crewing Executive');
                  updateFormData('b5SubmittedDate', currentDate);
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
                  <div className="flex items-center space-x-2 w-[50px]">
                    <RadioGroup 
                      value={formData.b6InterviewCompleted as string} 
                      onValueChange={(value) => updateFormData('b6InterviewCompleted', value)}
                      className="flex"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="b6-completed-yes" />
                        <Label htmlFor="b6-completed-yes" className="text-sm cursor-pointer">Yes</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="flex items-center space-x-2 w-[50px]">
                    <RadioGroup 
                      value={formData.b6InterviewCompleted as string} 
                      onValueChange={(value) => updateFormData('b6InterviewCompleted', value)}
                      className="flex"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="b6-completed-no" />
                        <Label htmlFor="b6-completed-no" className="text-sm cursor-pointer">No</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="flex items-center space-x-2 w-[50px]">
                    <RadioGroup 
                      value={formData.b6InterviewCompleted as string} 
                      onValueChange={(value) => updateFormData('b6InterviewCompleted', value)}
                      className="flex"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="na" id="b6-completed-na" />
                        <Label htmlFor="b6-completed-na" className="text-sm cursor-pointer">NA</Label>
                      </div>
                    </RadioGroup>
                  </div>
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
                {b6Interviews.map((interview, index) => (
                  <div key={interview.id} className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <Input
                          type="date"
                          placeholder="Date"
                          className="text-sm"
                          value={interview.date}
                          onChange={(e) => {
                            setB6Interviews(prev => prev.map(int => 
                              int.id === interview.id 
                                ? { ...int, date: e.target.value }
                                : int
                            ));
                          }}
                        />
                      </div>
                      <div>
                        <Select
                          value={interview.interviewer}
                          onValueChange={(value) => {
                            setB6Interviews(prev => prev.map(int => 
                              int.id === interview.id 
                                ? { ...int, interviewer: value }
                                : int
                            ));
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
                            setB6Interviews(prev => prev.map(int => 
                              int.id === interview.id 
                                ? { ...int, status: value }
                                : int
                            ));
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
                            setB6Interviews(prev => prev.map(int => 
                              int.id === interview.id 
                                ? { ...int, result: value }
                                : int
                            ));
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
                        {index === b6Interviews.length - 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-10 w-10 p-0 border-gray-300"
                            onClick={() => {
                              const newId = (b6Interviews.length + 1).toString();
                              setB6Interviews(prev => [...prev, { 
                                id: newId, 
                                date: '', 
                                interviewer: '',
                                status: '',
                                result: '',
                                comments: ''
                              }]);
                              // Initialize comment state for new interview and set it to editing mode
                              setB6InterviewComments(prev => ({
                                ...prev,
                                [newId]: ''
                              }));
                              setEditingB6InterviewComment(newId);
                            }}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        )}
                        {b6Interviews.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-10 w-10 p-0"
                            onClick={() => {
                              setB6Interviews(prev => prev.filter(int => int.id !== interview.id));
                              // Clean up comment state for deleted interview
                              setB6InterviewComments(prev => {
                                const newComments = { ...prev };
                                delete newComments[interview.id];
                                return newComments;
                              });
                              // Clear editing state if this interview was being edited
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
                    
                    {/* Individual interview comment */}
                    <div className="ml-4">
                      <div className="text-blue-600 italic text-[13px] mb-2">
                        {interview.interviewer ? interviewerDisplayNames[interview.interviewer] || interview.interviewer : 'Capt. Nick, Marine Superintendent'}:
                      </div>
                      {editingB6InterviewComment === interview.id ? (
                        <Textarea
                          value={b6InterviewComments[interview.id] || ''}
                          onChange={(e) => {
                            setB6InterviewComments(prev => ({
                              ...prev,
                              [interview.id]: e.target.value
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
                          {b6InterviewComments[interview.id] || "Click to add comment..."}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Comments for B6.1 */}
            {(b6Comments['b6-completed']?.length > 0 || newB6Comment['b6-completed'] !== undefined) && (
              <div className="ml-4 mb-4 space-y-2">
                {b6Comments['b6-completed']?.map((comment) => (
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
                          setB6Comments(prev => ({
                            ...prev,
                            'b6-completed': prev['b6-completed']?.filter(c => c.id !== comment.id) || []
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
                    <div className="text-sm font-medium text-gray-600 mb-2">Roxanne, Crewing Executive</div>
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
                          setB6Comments(prev => ({
                            ...prev,
                            'b6-completed': [
                              ...(prev['b6-completed'] || []),
                              {
                                id: commentId,
                                user: "Roxanne, Crewing Executive",
                                text: newB6Comment['b6-completed']
                              }
                            ]
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

          {/* Upload button */}
          <div className="flex justify-start">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-gray-600 border-gray-300 hover:bg-gray-50"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload
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
                  updateFormData('b6SubmittedBy', 'Roxanne, Crewing Executive');
                  updateFormData('b6SubmittedDate', currentDate);
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
          <Button
            variant="outline"
            size="sm"
            onClick={addB7TrainingNeed}
            className="text-gray-600 border-gray-300 hover:bg-gray-50"
          >
            <Plus className="h-4 w-4 mr-2" />
            ADD
          </Button>
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
              {b7TrainingNeeds.map((training) => (
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
                  variant="outline"
                  className="text-blue-600 border-blue-600 hover:bg-blue-50"
                >
                  Save
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => {
                    const currentDate = new Date().toLocaleDateString();
                    updateFormData('b7SubmittedBy', 'Roxanne, Crewing Executive');
                    updateFormData('b7SubmittedDate', currentDate);
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
                  <div className="flex items-center space-x-2 w-[50px]">
                    <RadioGroup 
                      value={formData.b8Shortlisted as string} 
                      onValueChange={(value) => updateFormData('b8Shortlisted', value)}
                      className="flex"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="b8-shortlisted-yes" />
                        <Label htmlFor="b8-shortlisted-yes" className="text-sm cursor-pointer">Yes</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="flex items-center space-x-2 w-[50px]">
                    <RadioGroup 
                      value={formData.b8Shortlisted as string} 
                      onValueChange={(value) => updateFormData('b8Shortlisted', value)}
                      className="flex"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="b8-shortlisted-no" />
                        <Label htmlFor="b8-shortlisted-no" className="text-sm cursor-pointer">No</Label>
                      </div>
                    </RadioGroup>
                  </div>
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
            {(b8Comments['b8-shortlisted']?.length > 0 || newB8Comment['b8-shortlisted'] !== undefined) && (
              <div className="ml-4 mb-4 space-y-2">
                {b8Comments['b8-shortlisted']?.map((comment) => (
                  <div key={comment.id} className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="text-blue-600 italic text-[13px] mb-2">{comment.user}:</div>
                      {editingB8Comment === comment.id ? (
                        <Textarea
                          value={comment.text}
                          onChange={(e) => {
                            setB8Comments(prev => ({
                              ...prev,
                              'b8-shortlisted': prev['b8-shortlisted']?.map(c => 
                                c.id === comment.id ? { ...c, text: e.target.value } : c
                              ) || []
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
                          setB8Comments(prev => ({
                            ...prev,
                            'b8-shortlisted': prev['b8-shortlisted']?.filter(c => c.id !== comment.id) || []
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
                    <div className="text-sm font-medium text-gray-600 mb-2">Roxanne, Crewing Executive</div>
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
                          setB8Comments(prev => ({
                            ...prev,
                            'b8-shortlisted': [
                              ...(prev['b8-shortlisted'] || []),
                              {
                                id: commentId,
                                user: "Roxanne, Crewing Executive",
                                text: newB8Comment['b8-shortlisted']
                              }
                            ]
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

          {/* Upload button */}
          <div className="flex justify-start">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-gray-600 border-gray-300 hover:bg-gray-50"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload
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
                  variant="outline"
                  className="text-blue-600 border-blue-600 hover:bg-blue-50"
                >
                  Save
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => {
                    const currentDate = new Date().toLocaleDateString();
                    updateFormData('b8SubmittedBy', 'Roxanne, Crewing Executive');
                    updateFormData('b8SubmittedDate', currentDate);
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

  const renderContent = () => {
    switch (activeSection) {
      case 'A1':
        return (
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
                  onClick={onClose}
                >
                  Save & Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      case 'A2':
        return (
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
                  onClick={onClose}
                >
                  Save & Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      case 'A3':
        return (
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
                  onClick={onClose}
                >
                  Save & Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      case 'A4':
        return (
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
                  onClick={onClose}
                >
                  Save & Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      case 'A5':
        return (
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
                  onClick={onClose}
                >
                  Save & Submit
                </Button>
              </div>
            </CardContent>
          </Card>
        );
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg w-full max-w-none 2xl:max-w-[95vw] h-[calc(100vh-1rem)] sm:h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-2 sm:p-3 lg:p-4 flex items-center justify-between">
          <div className="flex items-center gap-1 sm:gap-2 lg:gap-4">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-sm sm:text-lg lg:text-xl font-bold truncate">
              <span className="hidden sm:inline">Recruitment Application - </span>
              {candidate.firstName} {candidate.familyName}
            </h1>
          </div>
          <div className="flex gap-1 sm:gap-2">
            <Button 
              variant="outline" 
              size="sm"
              className="items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 text-primary-foreground shadow hover:bg-primary/90 h-8 rounded-md px-3 text-xs hidden sm:flex bg-[#5fa5fa]"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              className="sm:hidden"
            >
              <Save className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex h-full overflow-hidden">
          {/* Left Sidebar - Stepper */}
          <div className="w-20 bg-gray-50 border-r overflow-y-auto">
            <div className="p-4">
              <nav className="space-y-2">
                {sections.map((section, index) => {
                  const isActive = activeSection === section.id;
                  const isCompleted = false; // You can add completion logic here
                  
                  return (
                    <div key={section.id} className="relative">
                      <button
                        onClick={() => setActiveSection(section.id)}
                        className={`w-full flex flex-col items-center p-2 rounded-lg text-center transition-colors hover:bg-gray-100 ${
                          isActive ? "bg-blue-50" : ""
                        }`}
                        title={section.title}
                      >
                        <div 
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm ${
                            isActive ? "bg-blue-600" : isCompleted ? "bg-green-500" : "bg-gray-400"
                          }`}
                        >
                          {section.number}
                        </div>
                      </button>
                      {index < sections.length - 1 && (
                        <div className="absolute left-[1.75rem] top-12 w-0.5 h-4 bg-gray-300"></div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>
          </div>
          
          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto p-2 sm:p-4 lg:p-6 bg-[#f9fafb]">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
};