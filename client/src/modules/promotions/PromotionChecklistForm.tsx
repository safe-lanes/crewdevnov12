import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BaseSubmoduleForm, FormSection } from '@/components/BaseSubmoduleForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { z } from 'zod';

interface PromotionData {
  crewMemberId: string;
  name: string;
  currentRank: string;
  promotionToRank: string;
  vesselLeave: string;
  dob: string;
  age: string;
}

interface PromotionChecklistFormProps {
  promotionData: PromotionData;
  onClose: () => void;
}

const promotionChecklistSchema = z.object({
  partANotes: z.string().optional(),
  partBNotes: z.string().optional(),
});

type PromotionChecklistFormData = z.infer<typeof promotionChecklistSchema>;

export const PromotionChecklistForm: React.FC<PromotionChecklistFormProps> = ({
  promotionData,
  onClose,
}) => {
  const sections = [
    { id: 'a', title: 'Part A: General', letter: 'A' },
    { id: 'b', title: 'Part B: Promotion Checklist', letter: 'B' },
  ];

  const defaultValues: PromotionChecklistFormData = {
    partANotes: '',
    partBNotes: '',
  };

  // Fetch crew member data including sea service
  const { data: crewMember, isLoading: isLoadingCrew, error: crewError } = useQuery({
    queryKey: [`/api/crew-members/${promotionData.crewMemberId}`],
    enabled: !!promotionData.crewMemberId,
  });

  // Use promotion data passed from parent
  const seafarerData = {
    name: promotionData?.name || 'N/A',
    rank: promotionData?.currentRank || 'N/A',
    promotionRank: promotionData?.promotionToRank || 'N/A',
    vessel: promotionData?.vesselLeave || 'N/A',
    dateOfBirth: promotionData?.dob || 'N/A',
    age: promotionData?.age || 'N/A',
  };

  // Parse sea service data from crew member
  const seaServiceData = React.useMemo(() => {
    if (!crewMember?.currentCompanySeaService) return [];
    try {
      const parsed = typeof crewMember.currentCompanySeaService === 'string'
        ? JSON.parse(crewMember.currentCompanySeaService)
        : crewMember.currentCompanySeaService;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [crewMember]);

  const handleSubmit = (data: PromotionChecklistFormData) => {
    console.log('Saving Promotion Checklist...', data);
    onClose();
  };

  const handleVerifyAndSubmit = () => {
    console.log('Verifying and Submitting Promotion Checklist...');
    onClose();
  };

  const renderPartA = () => (
    <div className="space-y-4">
      {/* A1: Seafarer's Information */}
      <div className="border border-[#EAEBEF] rounded-lg p-4">
        <h3 className="text-base font-medium text-[#16569e] mb-4">A1. Seafarer's Information</h3>
        
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label className="text-xs text-gray-600">Name</Label>
            <Input 
              value={seafarerData.name} 
              disabled 
              className="mt-1 bg-gray-50" 
              data-testid="input-seafarer-name"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600">Current Rank</Label>
            <Input 
              value={seafarerData.rank} 
              disabled 
              className="mt-1 bg-gray-50" 
              data-testid="input-current-rank"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600">Promotion Rank</Label>
            <Input 
              value={seafarerData.promotionRank} 
              disabled 
              className="mt-1 bg-gray-50" 
              data-testid="input-promotion-rank"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600">Current Vessel</Label>
            <Input 
              value={seafarerData.vessel} 
              disabled 
              className="mt-1 bg-gray-50" 
              data-testid="input-current-vessel"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600">Date of Birth</Label>
            <Input 
              value={seafarerData.dateOfBirth} 
              disabled 
              className="mt-1 bg-gray-50" 
              data-testid="input-dob"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600">Age</Label>
            <Input 
              value={seafarerData.age} 
              disabled 
              className="mt-1 bg-gray-50" 
              data-testid="input-age"
            />
          </div>
        </div>
      </div>

      {/* A2: Details of Sea Service */}
      <div className="border border-[#EAEBEF] rounded-lg p-4">
        <h3 className="text-base font-medium text-[#16569e] mb-4">A2. Details of Sea Service</h3>
        <p className="text-xs text-gray-500 mb-3">Imported from database</p>
        
        {isLoadingCrew ? (
          <div className="text-sm text-gray-500 py-4">Loading sea service data...</div>
        ) : crewError ? (
          <div className="text-sm text-red-500 py-4">Error loading sea service data</div>
        ) : seaServiceData.length === 0 ? (
          <div className="text-sm text-gray-500 py-4">No sea service records found</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-xs font-normal text-gray-600">Vessel</TableHead>
                  <TableHead className="text-xs font-normal text-gray-600">Rank</TableHead>
                  <TableHead className="text-xs font-normal text-gray-600">From Date</TableHead>
                  <TableHead className="text-xs font-normal text-gray-600">To Date</TableHead>
                  <TableHead className="text-xs font-normal text-gray-600">Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {seaServiceData.map((service: any, index: number) => (
                  <TableRow key={service.id || index}>
                    <TableCell className="text-sm" data-testid={`cell-vessel-${service.id || index}`}>{service.vessel || 'N/A'}</TableCell>
                    <TableCell className="text-sm" data-testid={`cell-rank-${service.id || index}`}>{service.rank || 'N/A'}</TableCell>
                    <TableCell className="text-sm" data-testid={`cell-from-${service.id || index}`}>{service.fromDate || service.from || 'N/A'}</TableCell>
                    <TableCell className="text-sm" data-testid={`cell-to-${service.id || index}`}>{service.toDate || service.to || 'N/A'}</TableCell>
                    <TableCell className="text-sm" data-testid={`cell-duration-${service.id || index}`}>{service.duration || 'N/A'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* A3: Progress of completion of this Checklist */}
      <div className="border border-[#EAEBEF] rounded-lg p-4">
        <h3 className="text-base font-medium text-[#16569e] mb-4">A3. Progress of completion of this Checklist</h3>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Overall Progress</span>
            <span className="text-sm font-medium">60%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div className="bg-yellow-500 h-3 rounded-full" style={{ width: '60%' }}></div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="text-center p-3 bg-green-50 rounded">
              <div className="text-2xl font-semibold text-green-600">8</div>
              <div className="text-xs text-gray-600 mt-1">Completed</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded">
              <div className="text-2xl font-semibold text-yellow-600">3</div>
              <div className="text-xs text-gray-600 mt-1">In Progress</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded">
              <div className="text-2xl font-semibold text-red-600">2</div>
              <div className="text-xs text-gray-600 mt-1">Pending</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPartB = () => (
    <div className="space-y-4">
      <div className="border border-[#EAEBEF] rounded-lg p-4">
        <h3 className="text-base font-medium text-[#16569e] mb-4">Promotion Checklist Tasks</h3>
        <p className="text-sm text-gray-500">Dynamic sections will be added here based on promotion requirements.</p>
        
        {/* Placeholder for dynamic checklist sections */}
        <div className="mt-4 p-6 bg-gray-50 rounded text-center">
          <p className="text-sm text-gray-400">Checklist sections will be dynamically loaded here</p>
        </div>
      </div>
    </div>
  );

  return (
    <BaseSubmoduleForm
      title="Promotion Checklist"
      sections={sections}
      schema={promotionChecklistSchema}
      defaultValues={defaultValues}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      {({ activeSection }) => (
        <>
          {activeSection === 'a' && (
            <FormSection
              title="Part A: General"
              description="This section is read only & provides information on the seafarer and summary of progress"
            >
              {renderPartA()}
            </FormSection>
          )}

          {activeSection === 'b' && (
            <FormSection
              title="Part B: Promotion Checklist"
              description="At least 2 verifications are required"
            >
              {renderPartB()}
            </FormSection>
          )}
        </>
      )}
    </BaseSubmoduleForm>
  );
};
