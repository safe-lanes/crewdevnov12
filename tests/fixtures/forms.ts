// Test fixtures for appraisal forms data

export const mockAppraisalForm = {
  id: 1,
  crewMemberId: 1,
  vesselId: 1,
  appraisalPeriodStart: '2024-01-01',
  appraisalPeriodEnd: '2024-12-31',
  status: 'draft',
  partA: {
    personalDetails: true,
    vesselDetails: true,
  },
  partB: {
    technicalSkills: 4,
    safetyAwareness: 5,
    teamwork: 4,
  },
  partC: {
    trainingCompleted: ['STCW Basic', 'Fire Safety'],
    certificationsValid: true,
  },
  partD: {
    overallRating: 4,
    comments: 'Good performance throughout the year.',
  },
};

export const mockAppraisalForms = [
  mockAppraisalForm,
  {
    id: 2,
    crewMemberId: 2,
    vesselId: 1,
    appraisalPeriodStart: '2024-01-01',
    appraisalPeriodEnd: '2024-12-31',
    status: 'submitted',
    partA: {
      personalDetails: true,
      vesselDetails: true,
    },
    partB: {
      technicalSkills: 5,
      safetyAwareness: 5,
      teamwork: 5,
    },
    partC: {
      trainingCompleted: ['STCW Advanced', 'Leadership'],
      certificationsValid: true,
    },
    partD: {
      overallRating: 5,
      comments: 'Excellent performance. Recommended for promotion.',
    },
  },
];

export const mockAppraisalFormInsert = {
  crewMemberId: 3,
  vesselId: 2,
  appraisalPeriodStart: '2025-01-01',
  appraisalPeriodEnd: '2025-12-31',
  status: 'draft',
};
