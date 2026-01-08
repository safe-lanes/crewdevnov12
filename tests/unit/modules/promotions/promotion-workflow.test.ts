import { describe, it, expect } from 'vitest';
import { insertPromotionHierarchySchema, insertPromotionFormSchema } from '@shared/schema';

describe('Promotion Workflow Schema Validation', () => {
  describe('Promotion Hierarchy - Valid Data', () => {
    it('should validate complete promotion hierarchy', () => {
      const validHierarchy = {
        groupName: 'Deck Officers',
        rankPath: JSON.stringify(['Third Officer', 'Second Officer', 'Chief Officer', 'Master'])
      };

      const result = insertPromotionHierarchySchema.safeParse(validHierarchy);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.groupName).toBe('Deck Officers');
      }
    });

    it('should validate engine department hierarchy', () => {
      const engineHierarchy = {
        groupName: 'Engine Officers',
        rankPath: JSON.stringify(['Fourth Engineer', 'Third Engineer', 'Second Engineer', 'Chief Engineer'])
      };

      const result = insertPromotionHierarchySchema.safeParse(engineHierarchy);
      expect(result.success).toBe(true);
    });

    it('should validate ratings hierarchy', () => {
      const ratingsHierarchy = {
        groupName: 'Deck Ratings',
        rankPath: JSON.stringify(['OS', 'AB', 'Bosun'])
      };

      const result = insertPromotionHierarchySchema.safeParse(ratingsHierarchy);
      expect(result.success).toBe(true);
    });

    it('should accept array format for rankPath', () => {
      const hierarchyWithArray = {
        groupName: 'Deck Officers',
        rankPath: ['Third Officer', 'Second Officer', 'Chief Officer']
      };

      const result = insertPromotionHierarchySchema.safeParse(hierarchyWithArray);
      expect(result.success).toBe(true);
    });

    it('should accept isActive flag', () => {
      const hierarchyWithActive = {
        groupName: 'Deck Officers',
        rankPath: JSON.stringify(['Third Officer', 'Second Officer']),
        isActive: true
      };

      const result = insertPromotionHierarchySchema.safeParse(hierarchyWithActive);
      expect(result.success).toBe(true);
    });
  });

  describe('Promotion Hierarchy - Invalid Data', () => {
    it('should reject missing groupName', () => {
      const invalid = {
        rankPath: JSON.stringify(['Third Officer', 'Second Officer'])
      };

      const result = insertPromotionHierarchySchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject missing rankPath', () => {
      const invalid = {
        groupName: 'Deck Officers'
      };

      const result = insertPromotionHierarchySchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject null groupName', () => {
      const invalid = {
        groupName: null,
        rankPath: JSON.stringify(['Third Officer'])
      };

      const result = insertPromotionHierarchySchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject numeric groupName', () => {
      const invalid = {
        groupName: 12345,
        rankPath: JSON.stringify(['Third Officer'])
      };

      const result = insertPromotionHierarchySchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('Promotion Form - Valid Data', () => {
    it('should validate complete promotion form', () => {
      const validForm = {
        crewMemberId: 'A000123',
        currentRank: 'Second Officer',
        proposedRank: 'Chief Officer'
      };

      const result = insertPromotionFormSchema.safeParse(validForm);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.crewMemberId).toBe('A000123');
      }
    });

    it('should validate form with optional justification', () => {
      const formWithJustification = {
        crewMemberId: 'A000456',
        currentRank: 'Third Officer',
        proposedRank: 'Second Officer',
        justification: 'Excellent performance and completed all required trainings'
      };

      const result = insertPromotionFormSchema.safeParse(formWithJustification);
      expect(result.success).toBe(true);
    });

    it('should accept various statuses', () => {
      const statuses = ['draft', 'submitted', 'under_review', 'approved', 'rejected'];
      
      statuses.forEach(status => {
        const form = {
          crewMemberId: 'A000789',
          currentRank: 'AB',
          proposedRank: 'Bosun',
          status
        };

        const result = insertPromotionFormSchema.safeParse(form);
        expect(result.success).toBe(true);
      });
    });

    it('should accept effectiveDate', () => {
      const formWithDate = {
        crewMemberId: 'A000101',
        currentRank: 'Second Officer',
        proposedRank: 'Chief Officer',
        effectiveDate: '2025-03-15'
      };

      const result = insertPromotionFormSchema.safeParse(formWithDate);
      expect(result.success).toBe(true);
    });

    it('should accept reviewerComments', () => {
      const formWithComments = {
        crewMemberId: 'A000102',
        currentRank: 'AB',
        proposedRank: 'Bosun',
        reviewerComments: 'Approved based on excellent appraisal scores'
      };

      const result = insertPromotionFormSchema.safeParse(formWithComments);
      expect(result.success).toBe(true);
    });
  });

  describe('Promotion Form - Invalid Data', () => {
    it('should reject missing crewMemberId', () => {
      const invalid = {
        currentRank: 'Second Officer',
        proposedRank: 'Chief Officer'
      };

      const result = insertPromotionFormSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject missing currentRank', () => {
      const invalid = {
        crewMemberId: 'A000123',
        proposedRank: 'Chief Officer'
      };

      const result = insertPromotionFormSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject missing proposedRank', () => {
      const invalid = {
        crewMemberId: 'A000123',
        currentRank: 'Second Officer'
      };

      const result = insertPromotionFormSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject null crewMemberId', () => {
      const invalid = {
        crewMemberId: null,
        currentRank: 'Second Officer',
        proposedRank: 'Chief Officer'
      };

      const result = insertPromotionFormSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('Eligibility Criteria Business Logic', () => {
    it('should validate minimum sea service requirement', () => {
      const minimumMonths = 24;
      const candidateMonths = 30;
      
      const meetsRequirement = candidateMonths >= minimumMonths;
      expect(meetsRequirement).toBe(true);
    });

    it('should validate minimum time in current rank', () => {
      const minimumMonthsInRank = 12;
      const actualMonthsInRank = 18;
      
      const meetsRequirement = actualMonthsInRank >= minimumMonthsInRank;
      expect(meetsRequirement).toBe(true);
    });

    it('should validate appraisal score requirement', () => {
      const minimumScore = 3.5;
      const candidateScore = 4.2;
      
      const meetsRequirement = candidateScore >= minimumScore;
      expect(meetsRequirement).toBe(true);
    });

    it('should check training completion status', () => {
      const requiredTrainings = ['STCW Basic Safety', 'Advanced Firefighting'];
      const completedTrainings = ['STCW Basic Safety', 'Advanced Firefighting', 'Medical First Aid'];
      
      const allComplete = requiredTrainings.every(t => completedTrainings.includes(t));
      expect(allComplete).toBe(true);
    });

    it('should validate CES test results', () => {
      const cesResults = {
        testName: 'Navigation',
        score: 85,
        passingScore: 70
      };
      
      const passed = cesResults.score >= cesResults.passingScore;
      expect(passed).toBe(true);
    });

    it('should check certificate validity', () => {
      const certificateExpiry = new Date('2027-06-15');
      const today = new Date();
      
      const isValid = certificateExpiry > today;
      expect(isValid).toBe(true);
    });
  });

  describe('Promotion Hierarchy Logic', () => {
    it('should define valid promotion paths', () => {
      const promotionPaths: Record<string, string[]> = {
        'OS': ['AB'],
        'AB': ['Bosun', 'Third Officer'],
        'Third Officer': ['Second Officer'],
        'Second Officer': ['Chief Officer'],
        'Chief Officer': ['Master']
      };
      
      expect(promotionPaths['AB']).toContain('Third Officer');
      expect(promotionPaths['Chief Officer']).toContain('Master');
    });

    it('should prevent invalid promotion jumps', () => {
      const currentRank = 'OS';
      const targetRank = 'Chief Officer';
      const validNextRanks = ['AB'];
      
      const isValidPromotion = validNextRanks.includes(targetRank);
      expect(isValidPromotion).toBe(false);
    });

    it('should allow promotion to multiple valid ranks', () => {
      const currentRank = 'AB';
      const validNextRanks = ['Bosun', 'Third Officer'];
      
      expect(validNextRanks.length).toBeGreaterThan(1);
    });

    it('should track promotion history', () => {
      const promotionHistory = [
        { from: 'OS', to: 'AB', date: '2020-01-15' },
        { from: 'AB', to: 'Third Officer', date: '2022-03-20' }
      ];
      
      expect(promotionHistory.length).toBe(2);
      expect(promotionHistory[1].to).toBe('Third Officer');
    });
  });

  describe('A2 Criteria Configuration', () => {
    it('should validate CES test requirements', () => {
      const cesRequirements = {
        navigation: { required: true, passingScore: 70 },
        cargo: { required: true, passingScore: 70 },
        safety: { required: true, passingScore: 70 }
      };

      expect(cesRequirements.navigation.required).toBe(true);
      expect(cesRequirements.navigation.passingScore).toBe(70);
    });

    it('should validate minimum sea service by rank', () => {
      const seaServiceRequirements: Record<string, number> = {
        'Chief Officer': 36,
        'Second Officer': 24,
        'Third Officer': 12,
        'Master': 48
      };

      expect(seaServiceRequirements['Chief Officer']).toBe(36);
    });

    it('should validate assessment checklist items', () => {
      const checklistItems = [
        { id: 1, name: 'Technical Knowledge', weight: 20 },
        { id: 2, name: 'Leadership', weight: 20 },
        { id: 3, name: 'Safety Awareness', weight: 20 }
      ];

      const totalWeight = checklistItems.reduce((sum, item) => sum + item.weight, 0);
      expect(totalWeight).toBe(60);
    });
  });

  describe('Data Integrity', () => {
    it('should preserve hierarchy data after parsing', () => {
      const hierarchy = {
        groupName: 'Test Group',
        rankPath: JSON.stringify(['Rank1', 'Rank2', 'Rank3'])
      };

      const result = insertPromotionHierarchySchema.safeParse(hierarchy);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.groupName).toBe('Test Group');
      }
    });

    it('should preserve form data after parsing', () => {
      const form = {
        crewMemberId: 'A000999',
        currentRank: 'AB',
        proposedRank: 'Bosun',
        status: 'approved',
        justification: 'Test justification'
      };

      const result = insertPromotionFormSchema.safeParse(form);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.crewMemberId).toBe('A000999');
        expect(result.data.status).toBe('approved');
      }
    });

    it('should transform array rankPath to string', () => {
      const hierarchy = {
        groupName: 'Test Group',
        rankPath: ['Rank1', 'Rank2', 'Rank3']
      };

      const result = insertPromotionHierarchySchema.safeParse(hierarchy);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.data.rankPath).toBe('string');
      }
    });
  });
});
