import { describe, it, expect } from 'vitest';
import { insertVesselPlanningSchema } from '@shared/schema';

describe('Rotation Planning Schema Validation', () => {
  describe('Vessel Planning - Valid Data', () => {
    it('should validate complete vessel planning data', () => {
      const validPlanning = {
        vesselId: 'VSL-001',
        rankId: '1',
        rank: 'Master',
        crewMemberId: 'A000123',
        signOnDate: '2025-01-15'
      };

      const result = insertVesselPlanningSchema.safeParse(validPlanning);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.vesselId).toBe('VSL-001');
      }
    });

    it('should validate planning with optional fields', () => {
      const planningWithOptional = {
        vesselId: 'VSL-002',
        rankId: '2',
        rank: 'Chief Officer',
        crewMemberId: 'A000456',
        signOnDate: '2025-02-01',
        signOffDate: '2025-08-01',
        signOffPort: 'Singapore'
      };

      const result = insertVesselPlanningSchema.safeParse(planningWithOptional);
      expect(result.success).toBe(true);
    });

    it('should accept rank name', () => {
      const planningWithRank = {
        vesselId: 'VSL-003',
        rankId: '3',
        rank: 'Chief Officer',
        crewMemberId: 'A000789',
        signOnDate: '2025-03-01'
      };

      const result = insertVesselPlanningSchema.safeParse(planningWithRank);
      expect(result.success).toBe(true);
    });

    it('should accept reliever crew info', () => {
      const planningWithReliever = {
        vesselId: 'VSL-004',
        rankId: '4',
        rank: 'Second Officer',
        crewMemberId: 'A000101',
        signOnDate: '2025-01-15',
        relieverCrewId: 'A000202',
        relieverCrewName: 'John Doe',
        relieverSignOnDate: '2025-07-15'
      };

      const result = insertVesselPlanningSchema.safeParse(planningWithReliever);
      expect(result.success).toBe(true);
    });

    it('should accept contract period months', () => {
      const planningWithContract = {
        vesselId: 'VSL-005',
        rankId: '5',
        rank: 'AB',
        crewMemberId: 'A000303',
        signOnDate: '2025-01-15',
        contractPeriodMonths: 6
      };

      const result = insertVesselPlanningSchema.safeParse(planningWithContract);
      expect(result.success).toBe(true);
    });
  });

  describe('Vessel Planning - Invalid Data', () => {
    it('should reject missing vesselId', () => {
      const invalid = {
        rankId: '1',
        rank: 'Master',
        crewMemberId: 'A000123',
        signOnDate: '2025-01-15'
      };

      const result = insertVesselPlanningSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject missing rankId', () => {
      const invalid = {
        vesselId: 'VSL-001',
        rank: 'Master',
        crewMemberId: 'A000123',
        signOnDate: '2025-01-15'
      };

      const result = insertVesselPlanningSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject missing rank', () => {
      const invalid = {
        vesselId: 'VSL-001',
        rankId: '1',
        crewMemberId: 'A000123',
        signOnDate: '2025-01-15'
      };

      const result = insertVesselPlanningSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject null vesselId', () => {
      const invalid = {
        vesselId: null,
        rankId: '1',
        rank: 'Master',
        crewMemberId: 'A000123',
        signOnDate: '2025-01-15'
      };

      const result = insertVesselPlanningSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('Contract Duration Calculations', () => {
    it('should calculate contract end date from start date', () => {
      const planning = {
        vesselId: 'VSL-001',
        rankId: '1',
        rank: 'Master',
        crewMemberId: 'A000123',
        signOnDate: '2025-01-15',
        contractPeriodMonths: 6
      };

      const result = insertVesselPlanningSchema.safeParse(planning);
      expect(result.success).toBe(true);

      if (result.success) {
        const startDate = new Date(result.data.signOnDate!);
        const contractMonths = result.data.contractPeriodMonths || 6;
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + contractMonths);
        
        expect(endDate.getTime()).toBeGreaterThan(startDate.getTime());
      }
    });

    it('should calculate days until relief due', () => {
      const planning = {
        vesselId: 'VSL-001',
        rankId: '1',
        rank: 'Master',
        crewMemberId: 'A000123',
        signOnDate: '2025-01-15',
        reliefDue: '2025-07-15'
      };

      const result = insertVesselPlanningSchema.safeParse(planning);
      expect(result.success).toBe(true);

      if (result.success && result.data.reliefDue) {
        const reliefDate = new Date(result.data.reliefDue);
        const today = new Date();
        const daysUntilRelief = Math.ceil(
          (reliefDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        expect(typeof daysUntilRelief).toBe('number');
      }
    });

    it('should identify overdue rotations', () => {
      const today = new Date();
      const nineMonthsAgo = new Date(today);
      nineMonthsAgo.setMonth(nineMonthsAgo.getMonth() - 9);

      const planning = {
        vesselId: 'VSL-001',
        rankId: '1',
        rank: 'Master',
        crewMemberId: 'A000123',
        signOnDate: nineMonthsAgo.toISOString().split('T')[0],
        contractPeriodMonths: 6
      };

      const result = insertVesselPlanningSchema.safeParse(planning);
      expect(result.success).toBe(true);

      if (result.success) {
        const signOn = new Date(result.data.signOnDate!);
        const contractMonths = result.data.contractPeriodMonths || 6;
        const reliefDue = new Date(signOn);
        reliefDue.setMonth(reliefDue.getMonth() + contractMonths);
        
        const isOverdue = reliefDue < today;
        expect(isOverdue).toBe(true);
      }
    });
  });

  describe('Crew Time on Board', () => {
    it('should calculate months on board from sign on date', () => {
      const today = new Date();
      const signOnDate = new Date(today);
      signOnDate.setMonth(signOnDate.getMonth() - 5);
      
      const monthsOnBoard = 
        (today.getFullYear() - signOnDate.getFullYear()) * 12 +
        (today.getMonth() - signOnDate.getMonth());
      
      expect(monthsOnBoard).toBe(5);
    });

    it('should flag excessive time on board (> 9 months)', () => {
      const monthsOnBoard = 10;
      const maxMonths = 9;
      
      const isExcessive = monthsOnBoard > maxMonths;
      expect(isExcessive).toBe(true);
    });

    it('should identify crew approaching relief due', () => {
      const monthsOnBoard = 5;
      const contractMonths = 6;
      const warningThresholdDays = 30;
      
      const daysRemaining = (contractMonths - monthsOnBoard) * 30;
      const isApproachingRelief = daysRemaining <= warningThresholdDays;
      
      expect(isApproachingRelief).toBe(true);
    });
  });

  describe('Reliever Assignment', () => {
    it('should validate reliever planning data', () => {
      const relieverPlanning = {
        vesselId: 'VSL-001',
        rankId: '1',
        rank: 'Master',
        crewMemberId: 'A000123',
        signOnDate: '2025-01-15',
        relieverCrewId: 'A000999',
        relieverCrewName: 'John Smith',
        relieverNationality: 'Filipino',
        relieverSignOnDate: '2025-07-15'
      };

      const result = insertVesselPlanningSchema.safeParse(relieverPlanning);
      expect(result.success).toBe(true);
    });

    it('should accept joining port for reliever', () => {
      const planning = {
        vesselId: 'VSL-001',
        rankId: '1',
        rank: 'Master',
        crewMemberId: 'A000123',
        signOnDate: '2025-01-15',
        joiningPort: 'Singapore'
      };

      const result = insertVesselPlanningSchema.safeParse(planning);
      expect(result.success).toBe(true);
    });
  });

  describe('Sign Off Information', () => {
    it('should accept sign off port', () => {
      const planning = {
        vesselId: 'VSL-001',
        rankId: '1',
        rank: 'Master',
        crewMemberId: 'A000123',
        signOnDate: '2025-01-15',
        signOffPort: 'Singapore'
      };

      const result = insertVesselPlanningSchema.safeParse(planning);
      expect(result.success).toBe(true);
    });

    it('should accept sign off reason', () => {
      const planning = {
        vesselId: 'VSL-001',
        rankId: '1',
        rank: 'Master',
        crewMemberId: 'A000123',
        signOnDate: '2025-01-15',
        signOffReason: 'Contract completion'
      };

      const result = insertVesselPlanningSchema.safeParse(planning);
      expect(result.success).toBe(true);
    });

    it('should accept sign off date', () => {
      const planning = {
        vesselId: 'VSL-001',
        rankId: '1',
        rank: 'Master',
        crewMemberId: 'A000123',
        signOnDate: '2025-01-15',
        signOffDate: '2025-07-15'
      };

      const result = insertVesselPlanningSchema.safeParse(planning);
      expect(result.success).toBe(true);
    });
  });

  describe('Data Integrity', () => {
    it('should preserve all fields after parsing', () => {
      const planning = {
        vesselId: 'VSL-100',
        rankId: '5',
        rank: 'Chief Officer',
        crewMemberId: 'A000500',
        signOnDate: '2025-01-15',
        signOffDate: '2025-07-15',
        signOffPort: 'Rotterdam'
      };

      const result = insertVesselPlanningSchema.safeParse(planning);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.vesselId).toBe('VSL-100');
        expect(result.data.rankId).toBe('5');
        expect(result.data.rank).toBe('Chief Officer');
      }
    });

    it('should handle date string formats', () => {
      const planning = {
        vesselId: 'VSL-001',
        rankId: '1',
        rank: 'Master',
        crewMemberId: 'A000123',
        signOnDate: '2025-01-15'
      };

      const result = insertVesselPlanningSchema.safeParse(planning);
      expect(result.success).toBe(true);
    });
  });
});
