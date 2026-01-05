/**
 * Static data for maritime ranks and related constants
 */

export interface RankCategory {
  id: string;
  name: string;
  ranks: string[];
}

export const RANK_CATEGORIES: RankCategory[] = [
  {
    id: 'senior-officers',
    name: 'Senior Officers',
    ranks: [
      'Master',
      'Chief Officer',
      'Chief Engineer',
      'Second Officer',
      'Second Engineer',
    ],
  },
  {
    id: 'junior-officers',
    name: 'Junior Officers',
    ranks: [
      'Third Officer',
      'Third Engineer',
      'Fourth Engineer',
      'Deck Cadet',
      'Engine Cadet',
    ],
  },
  {
    id: 'ratings',
    name: 'Ratings',
    ranks: [
      'Bosun',
      'Able Bodied Seaman',
      'Ordinary Seaman',
      'Oiler',
      'Wiper',
      'Cook',
      'Steward',
    ],
  },
];

export const ALL_RANKS = RANK_CATEGORIES.flatMap(category => category.ranks);

export const APPRAISAL_TYPES = [
  'Interim Appraisal',
  'Final Appraisal',
  'Probationary Review',
  'Annual Review',
] as const;

export const RATING_SCALES = {
  EXCELLENT: { value: 5, label: 'Excellent', color: '#22c55e' },
  GOOD: { value: 4, label: 'Good', color: '#3b82f6' },
  SATISFACTORY: { value: 3, label: 'Satisfactory', color: '#f59e0b' },
  NEEDS_IMPROVEMENT: { value: 2, label: 'Needs Improvement', color: '#ef4444' },
  UNSATISFACTORY: { value: 1, label: 'Unsatisfactory', color: '#dc2626' },
} as const;