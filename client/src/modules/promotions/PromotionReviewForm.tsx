import React, { useState } from 'react';
import { BaseSubmoduleForm, FormSection } from '@/components/BaseSubmoduleForm';
import { z } from 'zod';

interface PromotionReviewFormProps {
  promotionData: any;
  onClose: () => void;
}

const promotionReviewSchema = z.object({
  // Part A - Promotion Criteria Review
  partANotes: z.string().optional(),
  
  // Part B - Approval
  partBNotes: z.string().optional(),
  
  // Part C - Execution
  partCNotes: z.string().optional(),
});

type PromotionReviewFormData = z.infer<typeof promotionReviewSchema>;

export const PromotionReviewForm: React.FC<PromotionReviewFormProps> = ({
  promotionData,
  onClose,
}) => {
  const sections = [
    { id: 'a', title: 'Part A: Promotion Criteria Review', letter: 'A' },
    { id: 'b', title: 'Part B: Approval', letter: 'B' },
    { id: 'c', title: 'Part C: Execution', letter: 'C' },
  ];

  const defaultValues: PromotionReviewFormData = {
    partANotes: '',
    partBNotes: '',
    partCNotes: '',
  };

  const handleSubmit = (data: PromotionReviewFormData) => {
    console.log('Form submitted:', data);
    // Will implement save logic later
    onClose();
  };

  return (
    <BaseSubmoduleForm
      title="Promotion Review Form"
      sections={sections}
      schema={promotionReviewSchema}
      defaultValues={defaultValues}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      {({ activeSection, form }) => (
        <>
          {activeSection === 'a' && (
            <FormSection
              title="Part A Promotion Criteria Review"
              description="In this part generally Office staff (e.g., Crewing Executive) can monitor whether various promotion criteria are being met or not. This will be like a live record that will keep on updating as information is received from various other submodules."
            >
              <div className="text-gray-500 text-sm mt-4">
                {/* Detailed fields will be added later based on user instructions */}
                <p>Promotion criteria review fields will be added here...</p>
                <div className="mt-4 p-4 bg-gray-50 rounded-md">
                  <p className="font-medium">Crew Member: {promotionData?.name || 'N/A'}</p>
                  <p className="mt-2">Current Rank: {promotionData?.currentRank || 'N/A'}</p>
                  <p>Promotion To Rank: {promotionData?.promotionToRank || 'N/A'}</p>
                </div>
              </div>
            </FormSection>
          )}

          {activeSection === 'b' && (
            <FormSection
              title="Part B Approval"
              description="Once the Promotion criteria has been fulfilled, Part A of the Form can be submitted for approval. This section will record approval from suitable approver."
            >
              <div className="text-gray-500 text-sm mt-4">
                {/* Detailed fields will be added later based on user instructions */}
                <p>Approval fields will be added here...</p>
              </div>
            </FormSection>
          )}

          {activeSection === 'c' && (
            <FormSection
              title="Part C Execution"
              description="There may be an interval between the stage that the crewmember is approved for promotion and the stage that he actually joins the ship at the next rank. This section records that."
            >
              <div className="text-gray-500 text-sm mt-4">
                {/* Detailed fields will be added later based on user instructions */}
                <p>Execution fields will be added here...</p>
              </div>
            </FormSection>
          )}
        </>
      )}
    </BaseSubmoduleForm>
  );
};
