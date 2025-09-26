import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { X, Edit, Camera, Plus, Trash2, Paperclip, Save, ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface CrewMember {
  id: string;
  empNo: string;
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
}

interface FormData {
  // A1.1 General Particulars
  firstName: string;
  middleName: string;
  familyName: string;
  nationality: string;
  presentRank: string;
  dateOfBirth: string;
  ageInYears: string;
  placeOfBirthCity: string;
  placeOfBirthCountry: string;
  heightCm: string;
  weightKg: string;
  nativeLanguage: string;
  foreignLanguages: string;
  englishProficiency: string;
  rankAppliedFor: string;
  vesselType: string[];
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
  seaService: SeaService[];
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
  document: string;
  number: string;
  issued: string;
  expiry: string;
  issuingAuthority: string;
}

interface Visa {
  id: string;
  issuingCountry: string;
  serialNo: string;
  issued: string;
  expiry: string;
  visaType: string;
}

interface Education {
  id: string;
  dateOfCompletion: string;
  schoolCollegeUniversity: string;
  subjectsField: string;
  qualifications: string;
}

interface License {
  id: string;
  certificateDocument: string;
  abbr: string;
  requirement: string;
  certificateNo: string;
  issuingAuthority: string;
  issued: string;
  expiry: string;
}

interface TrainingCourse {
  id: string;
  trainingCourse: string;
  abbr: string;
  requirement: string;
  certificateNo: string;
  issuingAuthority: string;
  issued: string;
  expiry: string;
}

interface SeaService {
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
}

export const CrewInfoForm: React.FC<CrewInfoFormProps> = ({ isOpen, onClose, crewMember }) => {
  const { toast } = useToast();
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>('A1');
  const [editingSections, setEditingSections] = useState<{[key: string]: boolean}>({
    'A1.1': false,
    'A1.2': false,
    'A1.3': false
  });

  // Sections for stepper navigation  
  const sections = [
    { id: 'A1', title: 'Seafarers\' Particulars', number: 'A1' },
    { id: 'A2', title: 'Travel & ID Documents', number: 'A2' },
    { id: 'A3', title: 'Training & Certificates', number: 'A3' },
    { id: 'A4', title: 'Sea Service', number: 'A4' }
  ];

  // Refs for scroll detection
  const sectionA1Ref = useRef<HTMLDivElement>(null);
  const sectionA2Ref = useRef<HTMLDivElement>(null);
  const sectionA3Ref = useRef<HTMLDivElement>(null);
  const sectionA4Ref = useRef<HTMLDivElement>(null);

  // Master data arrays
  const VESSEL_TYPES = [
    'Bulk Carrier', 'Container', 'Oil Tanker', 'Chemical Tanker', 'Product Tanker',
    'Crude Oil Tanker', 'LPG Tanker', 'LNG Carrier', 'General Cargo', 'RoRo',
    'Passenger', 'Offshore', 'Naval', 'Research', 'Salvage/Tug'
  ];

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

  const languageMasterData = [
    "English", "Spanish", "French", "German", "Italian", "Portuguese", "Dutch", "Russian", "Chinese (Mandarin)", "Japanese",
    "Korean", "Arabic", "Hindi", "Bengali", "Urdu", "Tamil", "Telugu", "Marathi", "Gujarati", "Kannada", "Malayalam",
    "Punjabi", "Thai", "Vietnamese", "Indonesian", "Malay", "Tagalog", "Cebuano", "Polish", "Romanian", "Hungarian",
    "Czech", "Slovak", "Bulgarian", "Croatian", "Serbian", "Slovenian", "Lithuanian", "Latvian", "Estonian",
    "Finnish", "Swedish", "Norwegian", "Danish", "Greek", "Turkish", "Hebrew", "Persian (Farsi)", "Pashto", "Dari"
  ];

  const countryMasterData = [
    "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria",
    "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan",
    "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cambodia", "Cameroon",
    "Canada", "Cape Verde", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica",
    "Croatia", "Cuba", "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt",
    "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia",
    "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti",
    "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan",
    "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho",
    "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali",
    "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro",
    "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger",
    "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Panama", "Papua New Guinea", "Paraguay",
    "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia",
    "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore",
    "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan",
    "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo",
    "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom",
    "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
  ];

  const rankNames = [
    "Master", "Chief Engineer", "Chief Mate", "First Officer", "Second Officer", "Third Officer",
    "Second Engineer", "Third Engineer", "Fourth Engineer", "Electrical Officer", "Electronics Officer",
    "Able Seaman", "Ordinary Seaman", "Bosun", "Chief Cook", "Cook", "Messman", "Steward",
    "Oiler", "Wiper", "Motorman", "Fitter", "Electrician", "Pumpman", "Tank Cleaner"
  ];

  const vesselTypeMasterData = VESSEL_TYPES;

  // Initialize form data with crew member data
  const [formData, setFormData] = useState<FormData>({
    // A1.1 General Particulars
    firstName: crewMember?.firstName || '',
    middleName: crewMember?.middleName || '',
    familyName: crewMember?.familyName || '',
    nationality: crewMember?.nationality || '',
    presentRank: crewMember?.presentRank || '',
    dateOfBirth: crewMember?.dob || '',
    ageInYears: crewMember?.age || '',
    placeOfBirthCity: '',
    placeOfBirthCountry: '',
    heightCm: '',
    weightKg: '',
    nativeLanguage: '',
    foreignLanguages: '',
    englishProficiency: '',
    rankAppliedFor: '',
    vesselType: [],
    manningAgent: '',
    fileNo: crewMember?.empNo || '',
    
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
      document: '',
      number: '',
      issued: '',
      expiry: '',
      issuingAuthority: ''
    }],
    
    // A2.2 Visas
    visas: [{
      id: '1',
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
    
    // A4.1 Sea Service
    seaService: [{
      id: '1',
      vesselName: '',
      vesselType: '',
      deadweight: '',
      engineTypePower: '',
      ownerOperator: '',
      rank: '',
      from: '',
      to: '',
      periodMonths: ''
    }]
  });

  // Update form data function
  const updateFormData = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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

  // Document management
  const addDocument = () => {
    const newDoc: DocumentInfo = {
      id: (formData.documents.length + 1).toString(),
      document: '',
      number: '',
      issued: '',
      expiry: '',
      issuingAuthority: ''
    };
    setFormData(prev => ({ ...prev, documents: [...prev.documents, newDoc] }));
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
    setFormData(prev => ({
      ...prev,
      documents: prev.documents.filter(doc => doc.id !== id)
    }));
  };

  // Visa management
  const addVisa = () => {
    const newVisa: Visa = {
      id: (formData.visas.length + 1).toString(),
      issuingCountry: '',
      serialNo: '',
      issued: '',
      expiry: '',
      visaType: ''
    };
    setFormData(prev => ({ ...prev, visas: [...prev.visas, newVisa] }));
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
    setFormData(prev => ({
      ...prev,
      visas: prev.visas.filter(visa => visa.id !== id)
    }));
  };

  // Education management
  const addEducation = () => {
    const newEducation: Education = {
      id: (formData.education.length + 1).toString(),
      dateOfCompletion: '',
      schoolCollegeUniversity: '',
      subjectsField: '',
      qualifications: ''
    };
    setFormData(prev => ({ ...prev, education: [...prev.education, newEducation] }));
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
    setFormData(prev => ({
      ...prev,
      education: prev.education.filter(edu => edu.id !== id)
    }));
  };

  // License management
  const addLicense = () => {
    const newLicense: License = {
      id: (formData.licenses.length + 1).toString(),
      certificateDocument: '',
      abbr: '',
      requirement: '',
      certificateNo: '',
      issuingAuthority: '',
      issued: '',
      expiry: ''
    };
    setFormData(prev => ({ ...prev, licenses: [...prev.licenses, newLicense] }));
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
    setFormData(prev => ({
      ...prev,
      licenses: prev.licenses.filter(license => license.id !== id)
    }));
  };

  // Training course management
  const addTrainingCourse = () => {
    const newCourse: TrainingCourse = {
      id: (formData.trainingCourses.length + 1).toString(),
      trainingCourse: '',
      abbr: '',
      requirement: '',
      certificateNo: '',
      issuingAuthority: '',
      issued: '',
      expiry: ''
    };
    setFormData(prev => ({ ...prev, trainingCourses: [...prev.trainingCourses, newCourse] }));
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
    setFormData(prev => ({
      ...prev,
      trainingCourses: prev.trainingCourses.filter(course => course.id !== id)
    }));
  };

  // Sea service management
  const addSeaService = () => {
    const newService: SeaService = {
      id: (formData.seaService.length + 1).toString(),
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
    setFormData(prev => ({ ...prev, seaService: [...prev.seaService, newService] }));
  };

  const updateSeaService = (id: string, field: keyof SeaService, value: string) => {
    setFormData(prev => ({
      ...prev,
      seaService: prev.seaService.map(service => 
        service.id === id ? { ...service, [field]: value } : service
      )
    }));
  };

  const removeSeaService = (id: string) => {
    setFormData(prev => ({
      ...prev,
      seaService: prev.seaService.filter(service => service.id !== id)
    }));
  };

  // A1.1 General Particulars render function
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
                      {rankNames.map(rank => (
                        <SelectItem key={rank} value={rank}>{rank}</SelectItem>
                      ))}
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
                        {VESSEL_TYPES.map(vesselType => (
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
                    {rankNames.map(rank => (
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
            
          </div>
        </div>
      </div>
    );
  };

  // A1.2 Address & Contact Info render function
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

  // A1.3 Family and NOK render function
  const renderA13FamilyNOK = () => {
    const isEditing = editingSections['A1.3'];
    
    return (
      <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
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

  // A2.1 Travel and Identification Documents render function
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
            data-testid="button-add-travel-doc"
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

  // A2.2 Visas render function
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
            data-testid="button-add-visa"
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

  // A3.1 Education render function
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

  // A3.2 License & DCE render function
  const renderA32LicenseDCE = () => {
    return (
      <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>A3.2 License & DCE</h3>
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
        
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-gray-100">
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
            {formData.licenses.map((license) => (
              <TableRow key={license.id} className="border-b border-gray-200">
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

  // A3.3 Training Courses render function
  const renderA33TrainingCourse = () => {
    return (
      <div className="mb-6 border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium" style={{ color: '#16569e' }}>A3.3 Training Course</h3>
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
        
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-gray-100">
              <TableHead className="text-[#4f5863] text-[13px] font-medium p-3">S.No.</TableHead>
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

  // A4.1 Sea Service render function
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
            data-testid="button-add-sea-service"
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
                      {rankNames.map((rank) => (
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

  // Save Draft functionality
  const handleSaveDraft = () => {
    console.log('Saving draft for section:', activeSection, formData);
    toast({
      title: "Draft Saved",
      description: `Section ${activeSection} has been saved successfully.`,
      duration: 2000,
    });
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

  // Toggle edit section with auto-save
  const toggleEditSection = (sectionId: 'A1.1' | 'A1.2' | 'A1.3') => {
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

  const handleSave = () => {
    console.log('Saving crew info:', formData);
    onClose();
  };

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
    [sectionA1Ref, sectionA2Ref, sectionA3Ref, sectionA4Ref].forEach((ref) => {
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
      case 'A1':
        targetRef = sectionA1Ref;
        break;
      case 'A2':
        targetRef = sectionA2Ref;
        break;
      case 'A3':
        targetRef = sectionA3Ref;
        break;
      case 'A4':
        targetRef = sectionA4Ref;
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg w-full max-w-none 2xl:max-w-[95vw] h-[calc(100vh-1rem)] sm:h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-2 sm:p-3 lg:p-4 flex items-center justify-between">
          <div className="flex items-center gap-1 sm:gap-2 lg:gap-4">
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-sm sm:text-lg lg:text-xl font-bold truncate">
              <span className="hidden sm:inline">Crew Information - </span>
              {crewMember ? `${crewMember.firstName} ${crewMember.familyName}` : 'Crew Member'}
            </h1>
          </div>
          <div className="flex gap-1 sm:gap-2">
            <Button 
              variant="outline" 
              size="sm"
              className="items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 text-primary-foreground shadow hover:bg-primary/90 h-8 rounded-md px-3 text-xs hidden sm:flex bg-[#5fa5fa]"
              onClick={handleSaveDraft}
              data-testid="button-save-draft"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              className="sm:hidden"
              onClick={handleSaveDraft}
              data-testid="button-save-draft-mobile"
            >
              <Save className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex h-full overflow-hidden bg-[#f9fafb]">
          {/* Left Sidebar - Enhanced Stepper */}
          <aside className="sticky top-0 self-start basis-20 md:basis-48 lg:basis-52 shrink-0 bg-gray-50 border-r overflow-y-auto">
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
                        className={`group flex items-center w-full px-3 py-2 rounded-md transition-all border-l-4 ${
                          isActive 
                            ? "bg-blue-50 border-blue-600 text-blue-700" 
                            : "border-transparent hover:bg-gray-100 text-gray-700"
                        }`}
                        aria-current={isActive ? "step" : undefined}
                        data-testid={`button-step-${section.id}`}
                      >
                        <span 
                          className={`flex items-center justify-center w-8 h-8 rounded-full border text-sm font-semibold ${
                            isActive 
                              ? "bg-blue-600 text-white border-transparent" 
                              : "bg-gray-500 text-white border-transparent"
                          }`}
                        >
                          {section.number}
                        </span>
                        <span 
                          className="hidden md:block ml-3 text-left text-sm leading-tight"
                          data-testid={`text-step-title-${section.id}`}
                          title={section.title}
                          style={{ 
                            wordBreak: 'break-word',
                            lineHeight: '1.2',
                            maxWidth: '8rem'
                          }}
                        >
                          {section.title}
                        </span>
                      </button>
                      {index < sections.length - 1 && (
                        <div className="absolute left-7 md:left-7 top-12 w-0.5 h-2 bg-gray-300"></div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>
          </aside>
          
          {/* Main Content Area - Continuous Scroll */}
          <div className="flex-1 overflow-y-auto p-2 sm:p-4 lg:p-6 bg-[#f9fafb] space-y-6">
            {/* A1 - Seafarers' Particulars */}
            <Card className="bg-white border border-gray-200 shadow-sm" ref={sectionA1Ref} data-section="A1">
              <CardContent className="p-3 sm:p-4 lg:p-6">
                <div className="pb-4 mb-6">
                  <h2 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part A1 Seafarers' Particulars</h2>
                  <div style={{ color: '#16569e' }} className="text-sm">Enter details as applicable</div>
                  <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
                </div>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
                    <div className="2xl:col-span-1">
                      {renderA11GeneralParticulars()}
                    </div>
                    <div className="2xl:col-span-1">
                      {renderA12AddressContact()}
                    </div>
                  </div>
                  <div>
                    {renderA13FamilyNOK()}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* A2 - Travel & ID Documents */}
            <Card className="bg-white border border-gray-200 shadow-sm" ref={sectionA2Ref} data-section="A2">
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
              </CardContent>
            </Card>

            {/* A3 - Training & Certificates */}
            <Card className="bg-white border border-gray-200 shadow-sm" ref={sectionA3Ref} data-section="A3">
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
              </CardContent>
            </Card>

            {/* A4 - Sea Service */}
            <Card className="bg-white border border-gray-200 shadow-sm" ref={sectionA4Ref} data-section="A4">
              <CardContent className="p-3 sm:p-4 lg:p-6">
                <div className="pb-4 mb-6">
                  <h2 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part A4 - Sea Service</h2>
                  <div style={{ color: '#16569e' }} className="text-sm">Add Sea service details, latest on top</div>
                  <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
                </div>
                <div className="space-y-6">
                  {renderA41SeaService()}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CrewInfoForm;