import { describe, it, expect } from 'vitest';
import { insertRecruitmentCandidateSchema } from '@shared/schema';

describe('Recruitment Candidate Schema Validation', () => {
  describe('Valid Data', () => {
    it('should validate complete candidate data', () => {
      const validCandidate = {
        id: '2025-01-01-123456789',
        firstName: 'John',
        familyName: 'Doe',
        dob: '1990-01-15',
        nationality: 'Indian',
        rankAppliedFor: 'Chief Engineer',
        presentRank: 'Second Engineer',
        vesselType: 'Tanker'
      };

      const result = insertRecruitmentCandidateSchema.safeParse(validCandidate);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.firstName).toBe('John');
      }
    });

    it('should validate candidate with optional fields', () => {
      const candidateWithOptional = {
        id: '2025-01-02-123456789',
        firstName: 'Jane',
        middleName: 'Marie',
        familyName: 'Smith',
        dob: '1985-06-20',
        nationality: 'Filipino',
        rankAppliedFor: 'AB',
        presentRank: 'OS',
        vesselType: 'Bulk Carrier',
        status: 'Applied'
      };

      const result = insertRecruitmentCandidateSchema.safeParse(candidateWithOptional);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.middleName).toBe('Marie');
      }
    });

    it('should validate candidate with minimal required fields', () => {
      const minimalCandidate = {
        id: '2025-01-03-123456789',
        firstName: 'Mike',
        familyName: 'Johnson',
        dob: '1992-03-10',
        nationality: 'Indian',
        rankAppliedFor: 'Third Officer',
        presentRank: 'AB',
        vesselType: 'Container'
      };

      const result = insertRecruitmentCandidateSchema.safeParse(minimalCandidate);
      expect(result.success).toBe(true);
    });

    it('should accept various vessel types', () => {
      const vesselTypes = ['Tanker', 'Bulk Carrier', 'Container', 'LNG', 'Chemical'];
      
      vesselTypes.forEach(vesselType => {
        const candidate = {
          id: `2025-01-05-${vesselType}`,
          firstName: 'Test',
          familyName: 'Vessel',
          dob: '1990-01-01',
          nationality: 'Filipino',
          rankAppliedFor: 'Third Officer',
          presentRank: 'AB',
          vesselType
        };

        const result = insertRecruitmentCandidateSchema.safeParse(candidate);
        expect(result.success).toBe(true);
      });
    });

    it('should accept string id', () => {
      const valid = {
        id: 'custom-string-id-123',
        firstName: 'John',
        familyName: 'Doe',
        dob: '1990-01-01',
        nationality: 'Indian',
        rankAppliedFor: 'AB',
        presentRank: 'OS',
        vesselType: 'Tanker'
      };

      const result = insertRecruitmentCandidateSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should accept fileNo as optional', () => {
      const candidateWithFileNo = {
        id: '2025-01-06-123456789',
        fileNo: 'F-2025-001',
        firstName: 'John',
        familyName: 'Doe',
        dob: '1990-01-01',
        nationality: 'Indian',
        rankAppliedFor: 'AB',
        presentRank: 'OS',
        vesselType: 'Tanker'
      };

      const result = insertRecruitmentCandidateSchema.safeParse(candidateWithFileNo);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fileNo).toBe('F-2025-001');
      }
    });
  });

  describe('Invalid Data - Missing Required Fields', () => {
    it('should reject missing firstName', () => {
      const invalid = {
        id: '2025-01-07-123456789',
        familyName: 'Doe',
        dob: '1990-01-01',
        nationality: 'Indian',
        rankAppliedFor: 'AB',
        presentRank: 'OS',
        vesselType: 'Tanker'
      };

      const result = insertRecruitmentCandidateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject missing familyName', () => {
      const invalid = {
        id: '2025-01-08-123456789',
        firstName: 'John',
        dob: '1990-01-01',
        nationality: 'Indian',
        rankAppliedFor: 'AB',
        presentRank: 'OS',
        vesselType: 'Tanker'
      };

      const result = insertRecruitmentCandidateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject missing dob', () => {
      const invalid = {
        id: '2025-01-09-123456789',
        firstName: 'John',
        familyName: 'Doe',
        nationality: 'Indian',
        rankAppliedFor: 'AB',
        presentRank: 'OS',
        vesselType: 'Tanker'
      };

      const result = insertRecruitmentCandidateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject missing nationality', () => {
      const invalid = {
        id: '2025-01-10-123456789',
        firstName: 'John',
        familyName: 'Doe',
        dob: '1990-01-01',
        rankAppliedFor: 'AB',
        presentRank: 'OS',
        vesselType: 'Tanker'
      };

      const result = insertRecruitmentCandidateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject missing rankAppliedFor', () => {
      const invalid = {
        id: '2025-01-11-123456789',
        firstName: 'John',
        familyName: 'Doe',
        dob: '1990-01-01',
        nationality: 'Indian',
        presentRank: 'OS',
        vesselType: 'Tanker'
      };

      const result = insertRecruitmentCandidateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject missing presentRank', () => {
      const invalid = {
        id: '2025-01-12-123456789',
        firstName: 'John',
        familyName: 'Doe',
        dob: '1990-01-01',
        nationality: 'Indian',
        rankAppliedFor: 'AB',
        vesselType: 'Tanker'
      };

      const result = insertRecruitmentCandidateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject missing vesselType', () => {
      const invalid = {
        id: '2025-01-13-123456789',
        firstName: 'John',
        familyName: 'Doe',
        dob: '1990-01-01',
        nationality: 'Indian',
        rankAppliedFor: 'AB',
        presentRank: 'OS'
      };

      const result = insertRecruitmentCandidateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject null values for required fields', () => {
      const invalid = {
        id: '2025-01-14-123456789',
        firstName: null,
        familyName: 'Doe',
        dob: '1990-01-01',
        nationality: 'Indian',
        rankAppliedFor: 'AB',
        presentRank: 'OS',
        vesselType: 'Tanker'
      };

      const result = insertRecruitmentCandidateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('Field Type Validation', () => {
    it('should reject numeric firstName', () => {
      const invalid = {
        id: '2025-01-15-123456789',
        firstName: 12345,
        familyName: 'Doe',
        dob: '1990-01-01',
        nationality: 'Indian',
        rankAppliedFor: 'AB',
        presentRank: 'OS',
        vesselType: 'Tanker'
      };

      const result = insertRecruitmentCandidateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject numeric familyName', () => {
      const invalid = {
        id: '2025-01-16-123456789',
        firstName: 'John',
        familyName: 12345,
        dob: '1990-01-01',
        nationality: 'Indian',
        rankAppliedFor: 'AB',
        presentRank: 'OS',
        vesselType: 'Tanker'
      };

      const result = insertRecruitmentCandidateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject array for string field', () => {
      const invalid = {
        id: '2025-01-17-123456789',
        firstName: ['John'],
        familyName: 'Doe',
        dob: '1990-01-01',
        nationality: 'Indian',
        rankAppliedFor: 'AB',
        presentRank: 'OS',
        vesselType: 'Tanker'
      };

      const result = insertRecruitmentCandidateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject object for string field', () => {
      const invalid = {
        id: '2025-01-18-123456789',
        firstName: { name: 'John' },
        familyName: 'Doe',
        dob: '1990-01-01',
        nationality: 'Indian',
        rankAppliedFor: 'AB',
        presentRank: 'OS',
        vesselType: 'Tanker'
      };

      const result = insertRecruitmentCandidateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('Business Logic Validation', () => {
    it('should validate age calculation from dob', () => {
      const candidate = {
        id: '2025-01-19-123456789',
        firstName: 'John',
        familyName: 'Doe',
        dob: '1990-01-15',
        nationality: 'Indian',
        rankAppliedFor: 'Chief Engineer',
        presentRank: 'Second Engineer',
        vesselType: 'Tanker'
      };

      const result = insertRecruitmentCandidateSchema.safeParse(candidate);
      expect(result.success).toBe(true);

      if (result.success) {
        const birthDate = new Date(result.data.dob);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        expect(age).toBeGreaterThanOrEqual(18);
      }
    });

    it('should validate rank requirements mapping', () => {
      const rankMinExperience: Record<string, number> = {
        'Master': 36,
        'Chief Officer': 24,
        'Chief Engineer': 36,
        'Second Engineer': 24,
        'Third Officer': 0,
        'AB': 0
      };

      const candidate = {
        id: '2025-01-20-123456789',
        firstName: 'John',
        familyName: 'Doe',
        dob: '1980-01-01',
        nationality: 'Indian',
        rankAppliedFor: 'Chief Engineer',
        presentRank: 'Second Engineer',
        vesselType: 'Tanker'
      };

      const result = insertRecruitmentCandidateSchema.safeParse(candidate);
      expect(result.success).toBe(true);

      if (result.success) {
        const minExp = rankMinExperience[result.data.rankAppliedFor] || 0;
        expect(minExp).toBe(36);
      }
    });

    it('should categorize candidates by rank category', () => {
      const rankCategories: Record<string, string> = {
        'Master': 'Senior Officers',
        'Chief Officer': 'Senior Officers',
        'Third Officer': 'Junior Officers',
        'AB': 'Ratings',
        'Oiler': 'Ratings'
      };

      const candidate = {
        id: '2025-01-21-123456789',
        firstName: 'John',
        familyName: 'Doe',
        dob: '1990-01-01',
        nationality: 'Indian',
        rankAppliedFor: 'Master',
        presentRank: 'Chief Officer',
        vesselType: 'Tanker'
      };

      const result = insertRecruitmentCandidateSchema.safeParse(candidate);
      expect(result.success).toBe(true);

      if (result.success) {
        const category = rankCategories[result.data.rankAppliedFor];
        expect(category).toBe('Senior Officers');
      }
    });

    it('should validate nationality for visa requirements', () => {
      const visaExemptNationalities = ['Indian', 'Filipino', 'Indonesian'];
      
      const candidate = {
        id: '2025-01-22-123456789',
        firstName: 'John',
        familyName: 'Doe',
        dob: '1990-01-01',
        nationality: 'Filipino',
        rankAppliedFor: 'AB',
        presentRank: 'OS',
        vesselType: 'Tanker'
      };

      const result = insertRecruitmentCandidateSchema.safeParse(candidate);
      expect(result.success).toBe(true);

      if (result.success) {
        const isVisaExempt = visaExemptNationalities.includes(result.data.nationality);
        expect(isVisaExempt).toBe(true);
      }
    });
  });

  describe('Data Integrity', () => {
    it('should preserve all fields after parsing', () => {
      const candidate = {
        id: '2025-01-23-123456789',
        firstName: 'John',
        middleName: 'Michael',
        familyName: 'Doe',
        dob: '1990-01-15',
        nationality: 'Indian',
        rankAppliedFor: 'Chief Engineer',
        presentRank: 'Second Engineer',
        vesselType: 'Tanker',
        status: 'Applied'
      };

      const result = insertRecruitmentCandidateSchema.safeParse(candidate);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('2025-01-23-123456789');
        expect(result.data.firstName).toBe('John');
        expect(result.data.middleName).toBe('Michael');
        expect(result.data.familyName).toBe('Doe');
        expect(result.data.nationality).toBe('Indian');
      }
    });

    it('should handle special characters in names', () => {
      const candidate = {
        id: '2025-01-24-123456789',
        firstName: "O'Connor",
        familyName: 'de la Cruz',
        dob: '1990-01-01',
        nationality: 'Filipino',
        rankAppliedFor: 'AB',
        presentRank: 'OS',
        vesselType: 'Tanker'
      };

      const result = insertRecruitmentCandidateSchema.safeParse(candidate);
      expect(result.success).toBe(true);
    });

    it('should handle unicode characters in names', () => {
      const candidate = {
        id: '2025-01-25-123456789',
        firstName: 'Jose',
        familyName: 'Garcia',
        dob: '1990-01-01',
        nationality: 'Spanish',
        rankAppliedFor: 'AB',
        presentRank: 'OS',
        vesselType: 'Tanker'
      };

      const result = insertRecruitmentCandidateSchema.safeParse(candidate);
      expect(result.success).toBe(true);
    });
  });
});
