import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BaseSubmoduleForm, FormSection } from '@/components/BaseSubmoduleForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { z } from 'zod';
import type { CrewMember } from '@shared/schema';

interface PromotionData {
  crewMemberId: string;
  name: string;
  currentRank: string;
  promotionToRank: string;
  vesselLeave: string;
  dob: string;
  age: string;
  nationality?: string;
}

interface SeaServiceEntry {
  id?: string;
  vessel?: string;
  vesselName?: string;
  vesselType?: string;
  deadweight?: string | number;
  engineType?: string;
  enginePower?: string;
  fromDate?: string;
  from?: string;
  toDate?: string;
  to?: string;
  period?: string;
  duration?: string;
  rank?: string;
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
  const { data: crewMember, isLoading: isLoadingCrew, error: crewError } = useQuery<CrewMember>({
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
    nationality: promotionData?.nationality || 'N/A',
  };

  // Parse sea service data from crew member
  const seaServiceData = React.useMemo<SeaServiceEntry[]>(() => {
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
        
        <div className="space-y-4">
          {/* Row 1: Name, DOB/Age, Nationality */}
          <div className="grid grid-cols-3 gap-6">
            <div>
              <Label className="text-xs text-gray-500">Name</Label>
              <div className="text-sm font-medium mt-1" data-testid="text-seafarer-name">{seafarerData.name}</div>
            </div>
            <div>
              <Label className="text-xs text-gray-500">DOB / Age</Label>
              <div className="text-sm font-medium mt-1" data-testid="text-dob-age">{seafarerData.dateOfBirth} / {seafarerData.age}</div>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Nationality</Label>
              <div className="text-sm font-medium mt-1" data-testid="text-nationality">{seafarerData.nationality}</div>
            </div>
          </div>
          
          {/* Row 2: Present Rank, Promotion to Rank */}
          <div className="grid grid-cols-3 gap-6">
            <div>
              <Label className="text-xs text-gray-500">Present Rank</Label>
              <div className="text-sm font-medium mt-1" data-testid="text-present-rank">{seafarerData.rank}</div>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Promotion to Rank</Label>
              <div className="text-sm font-medium mt-1" data-testid="text-promotion-rank">{seafarerData.promotionRank}</div>
            </div>
          </div>
        </div>
      </div>

      {/* A2: Details of Sea Service */}
      <div className="border border-[#EAEBEF] rounded-lg p-4">
        <h3 className="text-base font-medium text-[#16569e] mb-4">A2. Details of Sea Service (in Current Rank in the Company)</h3>
        
        {isLoadingCrew ? (
          <div className="text-sm text-gray-500 py-4">Loading sea service data...</div>
        ) : crewError ? (
          <div className="text-sm text-red-500 py-4">Error loading sea service data</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-xs font-normal text-gray-500">Vessel Name</TableHead>
                  <TableHead className="text-xs font-normal text-gray-500">Vessel Type</TableHead>
                  <TableHead className="text-xs font-normal text-gray-500">Deadweight</TableHead>
                  <TableHead className="text-xs font-normal text-gray-500">Engine Type/ Power</TableHead>
                  <TableHead className="text-xs font-normal text-gray-500">From</TableHead>
                  <TableHead className="text-xs font-normal text-gray-500">To</TableHead>
                  <TableHead className="text-xs font-normal text-gray-500">Period(M)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {seaServiceData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-sm text-gray-500 text-center py-4">
                      No sea service records found
                    </TableCell>
                  </TableRow>
                ) : (
                  seaServiceData.map((service: SeaServiceEntry, index: number) => (
                    <TableRow key={service.id || index}>
                      <TableCell className="text-sm" data-testid={`cell-vessel-name-${service.id || index}`}>{service.vessel || service.vesselName || 'N/A'}</TableCell>
                      <TableCell className="text-sm" data-testid={`cell-vessel-type-${service.id || index}`}>{service.vesselType || 'N/A'}</TableCell>
                      <TableCell className="text-sm" data-testid={`cell-deadweight-${service.id || index}`}>{service.deadweight || 'N/A'}</TableCell>
                      <TableCell className="text-sm" data-testid={`cell-engine-power-${service.id || index}`}>{service.engineType || service.enginePower || 'N/A'}</TableCell>
                      <TableCell className="text-sm" data-testid={`cell-from-${service.id || index}`}>{service.fromDate || service.from || 'N/A'}</TableCell>
                      <TableCell className="text-sm" data-testid={`cell-to-${service.id || index}`}>{service.toDate || service.to || 'N/A'}</TableCell>
                      <TableCell className="text-sm" data-testid={`cell-period-${service.id || index}`}>{service.period || service.duration || 'N/A'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* A3: Checklist Progress */}
      <div className="border border-[#EAEBEF] rounded-lg p-4">
        <h3 className="text-base font-medium text-[#16569e] mb-4">A3. Checklist Progress</h3>
        
        <div className="space-y-3">
          <div className="text-sm text-gray-600 mb-3">
            Note: No of verifications required for each question: <span className="text-green-600 font-medium">2</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div className="bg-[#EAB308] h-3 rounded-full" style={{ width: '60%' }}></div>
              </div>
            </div>
            <div className="text-sm font-medium text-gray-700 whitespace-nowrap">
              60% (44/110 Verifications)
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
