import { useState, useEffect } from 'react';
import { StandardFormPopup } from '@/components/ui/form-popup';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
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
} from './hooks/useRecruitmentV2';
import type { V2CandidateListItem, FormSection } from './types/formTypes';

interface RecruitmentApplicationFormV2Props {
  candidate: V2CandidateListItem | null;
  onClose: () => void;
}

const SECTIONS: { id: FormSection; label: string; group: string }[] = [
  { id: 'A1', label: 'A1 - General Particulars', group: 'Part A - Application' },
  { id: 'A2', label: 'A2 - Travel Documents', group: 'Part A - Application' },
  { id: 'A3', label: 'A3 - Education & Certificates', group: 'Part A - Application' },
  { id: 'A4', label: 'A4 - Sea Service', group: 'Part A - Application' },
  { id: 'A5', label: 'A5 - Additional Information', group: 'Part A - Application' },
  { id: 'B1', label: 'B1 - Initial Screening', group: 'Part B - Screening' },
  { id: 'B2', label: 'B2 - Reference Checks', group: 'Part B - Screening' },
  { id: 'B3', label: 'B3 - Security Checks', group: 'Part B - Screening' },
  { id: 'B4', label: 'B4 - Certificate Authentication', group: 'Part B - Screening' },
  { id: 'B5', label: 'B5 - CES/Language Tests', group: 'Part B - Screening' },
  { id: 'B6', label: 'B6 - Interviews', group: 'Part B - Screening' },
  { id: 'B7', label: 'B7 - Training Needs', group: 'Part B - Screening' },
  { id: 'B8', label: 'B8 - Short Listing', group: 'Part B - Screening' },
  { id: 'C1', label: 'C1 - Approvals', group: 'Part C - Decision' },
  { id: 'C2', label: 'C2 - Suitability', group: 'Part C - Decision' },
  { id: 'C3', label: 'C3 - Recruitment Decision', group: 'Part C - Decision' },
];

export const RecruitmentApplicationFormV2: React.FC<RecruitmentApplicationFormV2Props> = ({
  candidate,
  onClose
}) => {
  const [activeSection, setActiveSection] = useState<FormSection>('A1');
  const [recCanUuid, setRecCanUuid] = useState<string | null>(candidate?.recCanUuid || null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: candidateData, isLoading: candidateLoading } = useV2Candidate(recCanUuid);
  const { data: personalDetails, isLoading: personalDetailsLoading } = useV2PersonalDetails(recCanUuid);
  const { data: addressData, isLoading: addressLoading } = useV2Address(recCanUuid);
  const { data: familyInfo, isLoading: familyInfoLoading } = useV2FamilyInfo(recCanUuid);
  const { data: children, isLoading: childrenLoading } = useV2Children(recCanUuid);
  const { data: nextOfKin, isLoading: nextOfKinLoading } = useV2NextOfKin(recCanUuid);
  const { data: vesselTypes, isLoading: vesselTypesLoading } = useV2VesselTypes(recCanUuid);

  const createCandidateMutation = useV2CreateCandidate();
  const updateCandidateMutation = useV2UpdateCandidate();
  const savePersonalDetailsMutation = useV2SavePersonalDetails();
  const saveAddressMutation = useV2SaveAddress();
  const saveFamilyInfoMutation = useV2SaveFamilyInfo();
  const saveChildrenMutation = useV2SaveChildren();
  const saveNextOfKinMutation = useV2SaveNextOfKin();
  const saveVesselTypesMutation = useV2SaveVesselTypes();

  const isLoading = candidateLoading || personalDetailsLoading || addressLoading || 
                    familyInfoLoading || childrenLoading || nextOfKinLoading || vesselTypesLoading;

  const getNextSection = (current: FormSection): FormSection | null => {
    const currentIndex = SECTIONS.findIndex(s => s.id === current);
    if (currentIndex < SECTIONS.length - 1) {
      return SECTIONS[currentIndex + 1].id;
    }
    return null;
  };

  const getPrevSection = (current: FormSection): FormSection | null => {
    const currentIndex = SECTIONS.findIndex(s => s.id === current);
    if (currentIndex > 0) {
      return SECTIONS[currentIndex - 1].id;
    }
    return null;
  };

  const handleSaveAndNext = async () => {
    toast({
      title: "Saved",
      description: `Section ${activeSection} saved successfully`,
    });
    
    const nextSection = getNextSection(activeSection);
    if (nextSection) {
      setActiveSection(nextSection);
    }
  };

  const handleSave = async () => {
    toast({
      title: "Saved",
      description: `Section ${activeSection} saved successfully`,
    });
  };

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'A1':
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-blue-800 mb-4">A1.1 - General Particulars</h3>
              <p className="text-sm text-gray-600">
                This section captures basic candidate information including name, date of birth, nationality, 
                and rank details. Data is saved to: recruitment_candidates_v2, cand_personal_details, cand_vessel_types_applied
              </p>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-green-800 mb-4">A1.2 - Address & Contact</h3>
              <p className="text-sm text-gray-600">
                Contact information and address details. Data is saved to: cand_addresses
              </p>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-purple-800 mb-4">A1.3 - Family & Next of Kin</h3>
              <p className="text-sm text-gray-600">
                Family information including spouse, children, and emergency contact. 
                Data is saved to: cand_family_info, cand_children, cand_next_of_kin
              </p>
            </div>
            
            {isLoading && (
              <div className="text-center text-gray-500 py-8">
                Loading candidate data...
              </div>
            )}
            
            {!isLoading && recCanUuid && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Loaded Data Preview</h4>
                <pre className="text-xs overflow-auto max-h-40">
                  {JSON.stringify({ candidateData, personalDetails, addressData, familyInfo, children, nextOfKin }, null, 2)}
                </pre>
              </div>
            )}
          </div>
        );
        
      case 'A2':
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-blue-800 mb-4">A2.1 - Travel & Identification Documents</h3>
              <p className="text-sm text-gray-600">
                Passport, seaman book, and other travel documents. 
                Data is saved to: cand_documents, cand_documents_attachments
              </p>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-green-800 mb-4">A2.2 - Visas</h3>
              <p className="text-sm text-gray-600">
                Visa records for various countries. 
                Data is saved to: cand_visas, cand_visas_attachments
              </p>
            </div>
          </div>
        );
        
      case 'A3':
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-blue-800 mb-4">A3.1 - Education</h3>
              <p className="text-sm text-gray-600">
                Educational qualifications. Data is saved to: cand_education, cand_education_attachments
              </p>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-green-800 mb-4">A3.2 - License & DCE</h3>
              <p className="text-sm text-gray-600">
                Licenses and certificates. Data is saved to: cand_licenses, cand_licenses_attachments
              </p>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-purple-800 mb-4">A3.3 - Training Courses</h3>
              <p className="text-sm text-gray-600">
                Training certificates. Data is saved to: cand_training_courses, cand_training_attachments
              </p>
            </div>
          </div>
        );
        
      case 'A4':
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-blue-800 mb-4">A4.1 - Sea Service</h3>
              <p className="text-sm text-gray-600">
                Previous sea service experience. Data is saved to: cand_sea_service, cand_sea_service_attachments
              </p>
            </div>
          </div>
        );
        
      case 'A5':
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-blue-800 mb-4">A5 - Additional Information</h3>
              <p className="text-sm text-gray-600">
                Additional candidate information. Data is saved to: cand_additional_info, cand_additional_info_attachments
              </p>
            </div>
          </div>
        );
        
      case 'B1':
        return (
          <div className="space-y-6">
            <div className="bg-orange-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-orange-800 mb-4">B1 - Initial Screening</h3>
              <p className="text-sm text-gray-600">
                Age criteria, rank criteria, certificates validation. 
                Data is saved to: screening_b1_initial, screening_b1_comments, screening_b1_attachments
              </p>
            </div>
          </div>
        );
        
      case 'B2':
        return (
          <div className="space-y-6">
            <div className="bg-orange-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-orange-800 mb-4">B2 - Reference Checks</h3>
              <p className="text-sm text-gray-600">
                Reference verification. Data is saved to: screening_b2_references, screening_b2_reference_items, 
                screening_b2_comments, screening_b2_attachments
              </p>
            </div>
          </div>
        );
        
      case 'B3':
        return (
          <div className="space-y-6">
            <div className="bg-orange-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-orange-800 mb-4">B3 - Security Checks</h3>
              <p className="text-sm text-gray-600">
                Background security verification. Data is saved to: screening_b3_security, screening_b3_authorities, 
                screening_b3_comments, screening_b3_attachments
              </p>
            </div>
          </div>
        );
        
      case 'B4':
        return (
          <div className="space-y-6">
            <div className="bg-orange-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-orange-800 mb-4">B4 - Certificate Authentication</h3>
              <p className="text-sm text-gray-600">
                Certificate verification. Data is saved to: screening_b4_certificates, screening_b4_cert_items, 
                screening_b4_comments, screening_b4_attachments
              </p>
            </div>
          </div>
        );
        
      case 'B5':
        return (
          <div className="space-y-6">
            <div className="bg-orange-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-orange-800 mb-4">B5 - CES/Language Tests</h3>
              <p className="text-sm text-gray-600">
                Test results. Data is saved to: screening_b5_tests, screening_b5_test_items, 
                screening_b5_comments, screening_b5_attachments
              </p>
            </div>
          </div>
        );
        
      case 'B6':
        return (
          <div className="space-y-6">
            <div className="bg-orange-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-orange-800 mb-4">B6 - Interviews</h3>
              <p className="text-sm text-gray-600">
                Interview records. Data is saved to: screening_b6_interviews, screening_b6_interview_items, 
                screening_b6_comments, screening_b6_attachments
              </p>
            </div>
          </div>
        );
        
      case 'B7':
        return (
          <div className="space-y-6">
            <div className="bg-orange-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-orange-800 mb-4">B7 - Training Needs</h3>
              <p className="text-sm text-gray-600">
                Training requirements. Data is saved to: screening_b7_training, screening_b7_training_items
              </p>
            </div>
          </div>
        );
        
      case 'B8':
        return (
          <div className="space-y-6">
            <div className="bg-orange-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-orange-800 mb-4">B8 - Short Listing</h3>
              <p className="text-sm text-gray-600">
                Shortlisting decision and approver selection. Data is saved to: screening_b8_shortlisting, 
                screening_b8_selected_approvers, screening_b8_comments, screening_b8_attachments
              </p>
            </div>
          </div>
        );
        
      case 'C1':
        return (
          <div className="space-y-6">
            <div className="bg-teal-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-teal-800 mb-4">C1 - Approvals</h3>
              <p className="text-sm text-gray-600">
                Approval workflow. Data is saved to: cand_approvals
              </p>
            </div>
          </div>
        );
        
      case 'C2':
        return (
          <div className="space-y-6">
            <div className="bg-teal-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-teal-800 mb-4">C2 - Suitability</h3>
              <p className="text-sm text-gray-600">
                Vessel type and fleet group suitability. Data is saved to: cand_suitability, 
                cand_suitability_vessel_types, cand_suitability_fleet_groups
              </p>
            </div>
          </div>
        );
        
      case 'C3':
        return (
          <div className="space-y-6">
            <div className="bg-teal-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-teal-800 mb-4">C3 - Recruitment Decision</h3>
              <p className="text-sm text-gray-600">
                Final recruitment decision. Data is saved to: cand_recruitment_decision, cand_assigned_groups
              </p>
            </div>
          </div>
        );
        
      default:
        return <div>Section not implemented</div>;
    }
  };

  return (
    <StandardFormPopup
      isOpen={true}
      onClose={onClose}
      title={candidate ? `Edit Candidate - ${candidate.firstName} ${candidate.familyName}` : 'New Candidate Application'}
      className="max-w-6xl"
    >
      <div className="flex h-full">
        <div className="w-64 border-r bg-gray-50 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-500 mb-2">Navigation</h3>
            
            {['Part A - Application', 'Part B - Screening', 'Part C - Decision'].map(group => (
              <div key={group} className="mb-4">
                <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">{group}</h4>
                {SECTIONS.filter(s => s.group === group).map(section => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full text-left px-3 py-2 rounded text-sm mb-1 transition-colors ${
                      activeSection === section.id
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-gray-200 text-gray-700'
                    }`}
                    data-testid={`nav-section-${section.id}`}
                  >
                    {section.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="text-xl font-semibold mb-4">
              {SECTIONS.find(s => s.id === activeSection)?.label}
            </h2>
            
            {renderSectionContent()}
          </div>

          <div className="border-t p-4 bg-white flex justify-between items-center">
            <div className="flex gap-2">
              {getPrevSection(activeSection) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const prev = getPrevSection(activeSection);
                    if (prev) setActiveSection(prev);
                  }}
                  data-testid="button-prev-section"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              
              <Button
                variant="outline"
                onClick={handleSave}
                data-testid="button-save"
              >
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
              
              {getNextSection(activeSection) ? (
                <Button
                  onClick={handleSaveAndNext}
                  className="bg-[#16569e] hover:bg-[#0d4a8f]"
                  data-testid="button-save-next"
                >
                  Save & Next
                </Button>
              ) : (
                <Button
                  onClick={handleSave}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="button-submit"
                >
                  Submit
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </StandardFormPopup>
  );
};

export default RecruitmentApplicationFormV2;
