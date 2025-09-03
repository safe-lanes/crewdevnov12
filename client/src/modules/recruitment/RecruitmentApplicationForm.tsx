import React, { useState } from 'react';
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
import { ArrowLeft, Edit, Plus, Save, Trash2, Upload } from 'lucide-react';

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
    nokRelationship: 'Wife'
  });

  const sections = [
    { id: 'A1', title: 'Seafarers\' Particulars', number: 'A1' },
    { id: 'A2', title: 'Experience', number: 'A2' },
    { id: 'A3', title: 'Certificates', number: 'A3' },
    { id: 'A4', title: 'Medical', number: 'A4' },
    { id: 'A5', title: 'References', number: 'A5' },
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
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
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

  const renderA11GeneralParticulars = () => {
    const isEditing = editingSections['A1.1'];
    
    return (
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium" style={{ color: '#16569e' }}>A1.1 General Particulars</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleEditSection('A1.1')}
            className="text-gray-500 hover:text-gray-700"
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
          
          <div className="grid grid-cols-12 gap-4">
            {/* Photo Upload Area */}
            <div className="col-span-3">
              <div className="w-32 h-40 bg-gray-200 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                <div className="text-center">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <div className="text-sm text-gray-500">Upload Photo</div>
                </div>
              </div>
            </div>
            
            {/* Form Fields */}
            <div className="col-span-9 grid grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">First Name</Label>
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
                <Label className="text-sm font-medium text-gray-700">Middle Name</Label>
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
                <Label className="text-sm font-medium text-gray-700">Family Name</Label>
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
                <Label className="text-sm font-medium text-gray-700">Nationality</Label>
                {isEditing ? (
                  <Select value={formData.nationality} onValueChange={(value) => updateFormData('nationality', value)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select nationality" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Indian">Indian</SelectItem>
                      <SelectItem value="British">British</SelectItem>
                      <SelectItem value="Philippines">Philippines</SelectItem>
                      <SelectItem value="Ukrainian">Ukrainian</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="mt-1 text-sm text-gray-900">{formData.nationality}</div>
                )}
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-700">Present Rank</Label>
                {isEditing ? (
                  <Input
                    value={formData.presentRank}
                    onChange={(e) => updateFormData('presentRank', e.target.value)}
                    className="mt-1"
                  />
                ) : (
                  <div className="mt-1 text-sm text-gray-900">{formData.presentRank}</div>
                )}
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-700">Date of birth</Label>
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
                <Label className="text-sm font-medium text-gray-700">Age( Years )</Label>
                {isEditing ? (
                  <Input
                    value={formData.ageInYears}
                    onChange={(e) => updateFormData('ageInYears', e.target.value)}
                    className="mt-1"
                  />
                ) : (
                  <div className="mt-1 text-sm text-gray-900">{formData.ageInYears}</div>
                )}
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-700">Place of birth( City )</Label>
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
                <Label className="text-sm font-medium text-gray-700">Place of birth( Country )</Label>
                {isEditing ? (
                  <Input
                    value={formData.placeOfBirthCountry}
                    onChange={(e) => updateFormData('placeOfBirthCountry', e.target.value)}
                    className="mt-1"
                  />
                ) : (
                  <div className="mt-1 text-sm text-gray-900">{formData.placeOfBirthCountry}</div>
                )}
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-700">Rank Applied For</Label>
                {isEditing ? (
                  <Input
                    value={formData.rankAppliedFor}
                    onChange={(e) => updateFormData('rankAppliedFor', e.target.value)}
                    className="mt-1"
                  />
                ) : (
                  <div className="mt-1 text-sm text-gray-900">{formData.rankAppliedFor}</div>
                )}
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-700">Height( Cm )</Label>
                {isEditing ? (
                  <Input
                    value={formData.heightCm}
                    onChange={(e) => updateFormData('heightCm', e.target.value)}
                    className="mt-1"
                  />
                ) : (
                  <div className="mt-1 text-sm text-gray-900">{formData.heightCm}</div>
                )}
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-700">Weight( kg )</Label>
                {isEditing ? (
                  <Input
                    value={formData.weightKg}
                    onChange={(e) => updateFormData('weightKg', e.target.value)}
                    className="mt-1"
                  />
                ) : (
                  <div className="mt-1 text-sm text-gray-900">{formData.weightKg}</div>
                )}
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-700">Manning Agent</Label>
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
                <Label className="text-sm font-medium text-gray-700">Native Language</Label>
                {isEditing ? (
                  <Input
                    value={formData.nativeLanguage}
                    onChange={(e) => updateFormData('nativeLanguage', e.target.value)}
                    className="mt-1"
                  />
                ) : (
                  <div className="mt-1 text-sm text-gray-900">{formData.nativeLanguage}</div>
                )}
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-700">Foreign Languages</Label>
                {isEditing ? (
                  <Input
                    value={formData.foreignLanguages}
                    onChange={(e) => updateFormData('foreignLanguages', e.target.value)}
                    className="mt-1"
                  />
                ) : (
                  <div className="mt-1 text-sm text-gray-900">{formData.foreignLanguages}</div>
                )}
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-700">English Proficiency</Label>
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
                <Label className="text-sm font-medium text-gray-700">File No</Label>
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
        </div>
      </div>
    );
  };

  const renderA12AddressContact = () => {
    const isEditing = editingSections['A1.2'];
    
    return (
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium" style={{ color: '#16569e' }}>A1.2 Address& Contact Info</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleEditSection('A1.2')}
            className="text-gray-500 hover:text-gray-700"
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
          
          <div className="grid grid-cols-4 gap-4">
            <div>
              <Label className="text-sm font-medium text-gray-700">Country of Residence</Label>
              {isEditing ? (
                <Input
                  value={formData.countryOfResidence}
                  onChange={(e) => updateFormData('countryOfResidence', e.target.value)}
                  className="mt-1"
                />
              ) : (
                <div className="mt-1 text-sm text-gray-900">{formData.countryOfResidence}</div>
              )}
            </div>
            
            <div>
              <Label className="text-sm font-medium text-gray-700">Nearest Airport</Label>
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
              <Label className="text-sm font-medium text-gray-700">Mobile</Label>
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
              <Label className="text-sm font-medium text-gray-700">Email</Label>
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
              <Label className="text-sm font-medium text-gray-700">Residential Address Line 1( House No./Building/Street )</Label>
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
              <Label className="text-sm font-medium text-gray-700">Residential Address Line 2( City, State, PIN )</Label>
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
              <Label className="text-sm font-medium text-gray-700">Contact Landline</Label>
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

  const renderA13FamilyNOK = () => {
    const isEditing = editingSections['A1.3'];
    
    return (
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium" style={{ color: '#16569e' }}>A1.3 Family and NOK</h3>
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
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">Marital Status</Label>
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
                <Label className="text-sm font-medium text-gray-700">No. of Dependant Children</Label>
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
                <Label className="text-sm font-medium text-gray-700">Father's Name</Label>
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
                <Label className="text-sm font-medium text-gray-700">Mother's Name</Label>
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
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">Spouse: First Name</Label>
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
                <Label className="text-sm font-medium text-gray-700">Middle Name</Label>
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
                <Label className="text-sm font-medium text-gray-700">Family Name</Label>
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
                <Label className="text-sm font-medium text-gray-700">Date of Birth</Label>
                {isEditing ? (
                  <Input
                    value={formData.spouseDateOfBirth}
                    onChange={(e) => updateFormData('spouseDateOfBirth', e.target.value)}
                    className="mt-1"
                  />
                ) : (
                  <div className="mt-1 text-sm text-gray-900">{formData.spouseDateOfBirth}</div>
                )}
              </div>
            </div>
            
            {/* Children */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-medium text-gray-700">Children</Label>
                {isEditing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addChild}
                    className="text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                )}
              </div>
              
              {formData.children.map((child, index) => (
                <div key={index} className="grid grid-cols-6 gap-4 mb-3 items-end">
                  <div>
                    <Label className="text-xs text-gray-600">Child {index + 1}: First Name</Label>
                    {isEditing ? (
                      <Input
                        value={child.firstName}
                        onChange={(e) => updateChild(index, 'firstName', e.target.value)}
                        className="mt-1"
                      />
                    ) : (
                      <div className="mt-1 text-sm text-gray-900">{child.firstName}</div>
                    )}
                  </div>
                  
                  <div>
                    <Label className="text-xs text-gray-600">Middle Name</Label>
                    {isEditing ? (
                      <Input
                        value={child.middleName}
                        onChange={(e) => updateChild(index, 'middleName', e.target.value)}
                        className="mt-1"
                      />
                    ) : (
                      <div className="mt-1 text-sm text-gray-900">{child.middleName}</div>
                    )}
                  </div>
                  
                  <div>
                    <Label className="text-xs text-gray-600">Family Name</Label>
                    {isEditing ? (
                      <Input
                        value={child.familyName}
                        onChange={(e) => updateChild(index, 'familyName', e.target.value)}
                        className="mt-1"
                      />
                    ) : (
                      <div className="mt-1 text-sm text-gray-900">{child.familyName}</div>
                    )}
                  </div>
                  
                  <div>
                    <Label className="text-xs text-gray-600">Date of Birth</Label>
                    {isEditing ? (
                      <Input
                        value={child.dateOfBirth}
                        onChange={(e) => updateChild(index, 'dateOfBirth', e.target.value)}
                        className="mt-1"
                      />
                    ) : (
                      <div className="mt-1 text-sm text-gray-900">{child.dateOfBirth}</div>
                    )}
                  </div>
                  
                  <div>
                    <Label className="text-xs text-gray-600">Son/ Daughter( Gender )</Label>
                    {isEditing ? (
                      <Select value={child.gender} onValueChange={(value) => updateChild(index, 'gender', value)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Son">Son</SelectItem>
                          <SelectItem value="Daughter">Daughter</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="mt-1 text-sm text-gray-900">{child.gender}</div>
                    )}
                  </div>
                  
                  {isEditing && (
                    <div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeChild(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* NOK Information */}
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">NOK: First Name</Label>
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
                <Label className="text-sm font-medium text-gray-700">Email</Label>
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
                <Label className="text-sm font-medium text-gray-700">Address (Country)</Label>
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
                <Label className="text-sm font-medium text-gray-700">relationship with Seafarer</Label>
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
                <Label className="text-sm font-medium text-gray-700">NOK: Tel</Label>
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

  const renderContent = () => {
    switch (activeSection) {
      case 'A1':
        return (
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardContent className="p-6">
              <div className="pb-4 mb-6">
                <h2 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part A1 Seafarers' Particulars</h2>
                <div style={{ color: '#16569e' }} className="text-sm">Enter details as applicable</div>
                <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
              </div>
              {renderA11GeneralParticulars()}
              {renderA12AddressContact()}
              {renderA13FamilyNOK()}
              
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
      default:
        return (
          <div className="p-6 text-center text-gray-600">
            Content for {activeSection} will be implemented in future iterations.
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-3 sm:p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg sm:text-xl font-bold">Recruitment Application - {candidate.firstName} {candidate.familyName}</h1>
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
          <div className="flex-1 overflow-y-auto p-6 bg-[#f9fafb]">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
};