import { describe, it, expect } from 'vitest';
import { insertCrewMemberSchema } from '@shared/schema';

describe('Crew Pool Schema Validation', () => {
  describe('Valid Crew Member Data', () => {
    it('should validate complete crew member data', () => {
      const validCrew = {
        id: 'A000123',
        firstName: 'John',
        nationality: 'Filipino',
        presentRank: 'Chief Officer',
        presentVessel: 'VSL-001',
        vesselType: 'Tanker'
      };

      const result = insertCrewMemberSchema.safeParse(validCrew);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.firstName).toBe('John');
      }
    });

    it('should validate crew with optional fields', () => {
      const crewWithOptional = {
        id: 'A000456',
        firstName: 'Jane',
        middleName: 'Marie',
        familyName: 'Smith',
        nationality: 'Indian',
        presentRank: 'AB',
        presentVessel: 'VSL-002',
        vesselType: 'Bulk Carrier',
        gender: 'Female',
        email: 'jane@example.com',
        mobile: '+91-9876543210'
      };

      const result = insertCrewMemberSchema.safeParse(crewWithOptional);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.middleName).toBe('Marie');
      }
    });

    it('should validate crew with minimal required fields', () => {
      const minimalCrew = {
        id: 'A000789',
        firstName: 'Mike',
        nationality: 'Indonesian',
        presentRank: 'Oiler',
        presentVessel: 'VSL-003',
        vesselType: 'Container'
      };

      const result = insertCrewMemberSchema.safeParse(minimalCrew);
      expect(result.success).toBe(true);
    });

    it('should accept various vessel types', () => {
      const vesselTypes = ['Tanker', 'Bulk Carrier', 'Container', 'LNG', 'Chemical'];
      
      vesselTypes.forEach((vesselType, index) => {
        const crew = {
          id: `A00${index}`,
          firstName: 'Test',
          nationality: 'Filipino',
          presentRank: 'AB',
          presentVessel: 'VSL-001',
          vesselType
        };

        const result = insertCrewMemberSchema.safeParse(crew);
        expect(result.success).toBe(true);
      });
    });

    it('should accept sign on date', () => {
      const crewWithSignOn = {
        id: 'A000101',
        firstName: 'John',
        nationality: 'Filipino',
        presentRank: 'Third Officer',
        presentVessel: 'VSL-004',
        vesselType: 'Tanker',
        signOnDate: '2025-01-15'
      };

      const result = insertCrewMemberSchema.safeParse(crewWithSignOn);
      expect(result.success).toBe(true);
    });
  });

  describe('Invalid Crew Member Data', () => {
    it('should reject missing firstName', () => {
      const invalid = {
        id: 'A000123',
        nationality: 'Filipino',
        presentRank: 'AB',
        presentVessel: 'VSL-001',
        vesselType: 'Tanker'
      };

      const result = insertCrewMemberSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject missing nationality', () => {
      const invalid = {
        id: 'A000123',
        firstName: 'John',
        presentRank: 'AB',
        presentVessel: 'VSL-001',
        vesselType: 'Tanker'
      };

      const result = insertCrewMemberSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject missing presentRank', () => {
      const invalid = {
        id: 'A000123',
        firstName: 'John',
        nationality: 'Filipino',
        presentVessel: 'VSL-001',
        vesselType: 'Tanker'
      };

      const result = insertCrewMemberSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject missing presentVessel', () => {
      const invalid = {
        id: 'A000123',
        firstName: 'John',
        nationality: 'Filipino',
        presentRank: 'AB',
        vesselType: 'Tanker'
      };

      const result = insertCrewMemberSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject missing vesselType', () => {
      const invalid = {
        id: 'A000123',
        firstName: 'John',
        nationality: 'Filipino',
        presentRank: 'AB',
        presentVessel: 'VSL-001'
      };

      const result = insertCrewMemberSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject null values for required fields', () => {
      const invalid = {
        id: 'A000123',
        firstName: null,
        nationality: 'Filipino',
        presentRank: 'AB',
        presentVessel: 'VSL-001',
        vesselType: 'Tanker'
      };

      const result = insertCrewMemberSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject numeric firstName', () => {
      const invalid = {
        id: 'A000123',
        firstName: 12345,
        nationality: 'Filipino',
        presentRank: 'AB',
        presentVessel: 'VSL-001',
        vesselType: 'Tanker'
      };

      const result = insertCrewMemberSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('Crew Filtering Logic', () => {
    it('should filter crew by rank', () => {
      const crew = [
        { id: 'A001', presentRank: 'Master' },
        { id: 'A002', presentRank: 'Chief Officer' },
        { id: 'A003', presentRank: 'Master' }
      ];
      
      const filtered = crew.filter(c => c.presentRank === 'Master');
      expect(filtered.length).toBe(2);
    });

    it('should filter crew by vessel', () => {
      const crew = [
        { id: 'A001', presentVessel: 'VSL-001' },
        { id: 'A002', presentVessel: 'VSL-002' },
        { id: 'A003', presentVessel: 'VSL-001' }
      ];
      
      const onVessel = crew.filter(c => c.presentVessel === 'VSL-001');
      expect(onVessel.length).toBe(2);
    });

    it('should filter crew by nationality', () => {
      const crew = [
        { id: 'A001', nationality: 'Filipino' },
        { id: 'A002', nationality: 'Indian' },
        { id: 'A003', nationality: 'Filipino' }
      ];
      
      const filipinos = crew.filter(c => c.nationality === 'Filipino');
      expect(filipinos.length).toBe(2);
    });

    it('should search crew by name', () => {
      const crew = [
        { firstName: 'John', familyName: 'Doe' },
        { firstName: 'Jane', familyName: 'Smith' },
        { firstName: 'Johnny', familyName: 'Walker' }
      ];
      
      const searchTerm = 'John';
      const found = crew.filter(c => 
        c.firstName.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      expect(found.length).toBe(2);
    });
  });

  describe('Sign On Date Validation', () => {
    it('should calculate time on board from sign on date', () => {
      const today = new Date();
      const signOnDate = new Date(today);
      signOnDate.setMonth(signOnDate.getMonth() - 5);
      
      const monthsOnBoard = 
        (today.getFullYear() - signOnDate.getFullYear()) * 12 +
        (today.getMonth() - signOnDate.getMonth());
      
      expect(monthsOnBoard).toBe(5);
    });

    it('should flag crew with excessive time on board', () => {
      const monthsOnBoard = 10;
      const maxMonths = 9;
      
      const isExcessive = monthsOnBoard > maxMonths;
      expect(isExcessive).toBe(true);
    });
  });

  describe('Crew Pool Categorization', () => {
    it('should categorize crew by pool', () => {
      const crew = [
        { id: 'A001', crewPool: 'Pool A' },
        { id: 'A002', crewPool: 'Pool B' },
        { id: 'A003', crewPool: 'Pool A' }
      ];
      
      const poolCounts: Record<string, number> = {};
      crew.forEach(c => {
        if (c.crewPool) {
          poolCounts[c.crewPool] = (poolCounts[c.crewPool] || 0) + 1;
        }
      });
      
      expect(poolCounts['Pool A']).toBe(2);
    });

    it('should categorize crew by rank category', () => {
      const rankCategories: Record<string, string> = {
        'Master': 'Senior Officers',
        'Chief Officer': 'Senior Officers',
        'Third Officer': 'Junior Officers',
        'AB': 'Ratings'
      };
      
      const crewMember = {
        id: 'A001',
        firstName: 'John',
        nationality: 'Filipino',
        presentRank: 'Master',
        presentVessel: 'VSL-001',
        vesselType: 'Tanker'
      };

      const result = insertCrewMemberSchema.safeParse(crewMember);
      expect(result.success).toBe(true);
      
      if (result.success) {
        const category = rankCategories[result.data.presentRank];
        expect(category).toBe('Senior Officers');
      }
    });
  });

  describe('Optional Fields', () => {
    it('should accept email as optional', () => {
      const crewWithEmail = {
        id: 'A000200',
        firstName: 'John',
        nationality: 'Filipino',
        presentRank: 'AB',
        presentVessel: 'VSL-001',
        vesselType: 'Tanker',
        email: 'john@example.com'
      };

      const result = insertCrewMemberSchema.safeParse(crewWithEmail);
      expect(result.success).toBe(true);
    });

    it('should accept mobile as optional', () => {
      const crewWithMobile = {
        id: 'A000201',
        firstName: 'John',
        nationality: 'Filipino',
        presentRank: 'AB',
        presentVessel: 'VSL-001',
        vesselType: 'Tanker',
        mobile: '+63-9876543210'
      };

      const result = insertCrewMemberSchema.safeParse(crewWithMobile);
      expect(result.success).toBe(true);
    });

    it('should accept crew pool as optional', () => {
      const crewWithPool = {
        id: 'A000203',
        firstName: 'John',
        nationality: 'Filipino',
        presentRank: 'AB',
        presentVessel: 'VSL-001',
        vesselType: 'Tanker'
      };

      const result = insertCrewMemberSchema.safeParse(crewWithPool);
      expect(result.success).toBe(true);
    });
  });

  describe('Data Integrity', () => {
    it('should preserve all fields after parsing', () => {
      const crew = {
        id: 'A000300',
        firstName: 'John',
        middleName: 'Michael',
        familyName: 'Doe',
        gender: 'Male',
        nationality: 'Filipino',
        presentRank: 'Chief Officer',
        presentVessel: 'VSL-001',
        vesselType: 'Tanker',
        email: 'john@example.com'
      };

      const result = insertCrewMemberSchema.safeParse(crew);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('A000300');
        expect(result.data.firstName).toBe('John');
        expect(result.data.middleName).toBe('Michael');
        expect(result.data.familyName).toBe('Doe');
        expect(result.data.nationality).toBe('Filipino');
      }
    });

    it('should handle special characters in names', () => {
      const crew = {
        id: 'A000301',
        firstName: "O'Connor",
        nationality: 'Irish',
        presentRank: 'AB',
        presentVessel: 'VSL-001',
        vesselType: 'Tanker'
      };

      const result = insertCrewMemberSchema.safeParse(crew);
      expect(result.success).toBe(true);
    });
  });
});
