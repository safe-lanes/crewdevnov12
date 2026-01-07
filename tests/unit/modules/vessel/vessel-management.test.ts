import { describe, it, expect } from 'vitest';
import { insertVesselDraftSchema, insertVesselPlanningSchema } from '@shared/schema';

describe('Vessel Management Schema Validation', () => {
  describe('Vessel Draft - Valid Data', () => {
    it('should validate complete vessel draft', () => {
      const validDraft = {
        vesselId: 'VSL-001',
        revision: 'R1',
        draftData: JSON.stringify({ ranks: [{ id: 1, name: 'Master' }] })
      };

      const result = insertVesselDraftSchema.safeParse(validDraft);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.vesselId).toBe('VSL-001');
      }
    });

    it('should validate draft with revision R2', () => {
      const draftRevision2 = {
        vesselId: 'VSL-002',
        revision: 'R2',
        draftData: JSON.stringify({ ranks: [] })
      };

      const result = insertVesselDraftSchema.safeParse(draftRevision2);
      expect(result.success).toBe(true);
    });

    it('should accept complex draft data', () => {
      const complexDraft = {
        vesselId: 'VSL-003',
        revision: 'R3',
        draftData: JSON.stringify({
          ranks: [
            { id: 1, name: 'Master', category: 'Senior Officers' },
            { id: 2, name: 'Chief Officer', category: 'Senior Officers' },
            { id: 3, name: 'AB', category: 'Ratings' }
          ]
        })
      };

      const result = insertVesselDraftSchema.safeParse(complexDraft);
      expect(result.success).toBe(true);
    });
  });

  describe('Vessel Draft - Invalid Data', () => {
    it('should reject missing vesselId', () => {
      const invalid = {
        revision: 'R1',
        draftData: JSON.stringify({})
      };

      const result = insertVesselDraftSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject missing draftData', () => {
      const invalid = {
        vesselId: 'VSL-001',
        revision: 'R1'
      };

      const result = insertVesselDraftSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject null vesselId', () => {
      const invalid = {
        vesselId: null,
        revision: 'R1',
        draftData: JSON.stringify({})
      };

      const result = insertVesselDraftSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject null draftData', () => {
      const invalid = {
        vesselId: 'VSL-001',
        revision: 'R1',
        draftData: null
      };

      const result = insertVesselDraftSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('Vessel Planning - Valid Data', () => {
    it('should validate complete planning record', () => {
      const validPlanning = {
        vesselId: 'VSL-001',
        rankId: '1',
        rank: 'Master',
        crewMemberId: 'A000123',
        signOnDate: '2025-01-15'
      };

      const result = insertVesselPlanningSchema.safeParse(validPlanning);
      expect(result.success).toBe(true);
    });

    it('should validate planning with reliever', () => {
      const planningWithReliever = {
        vesselId: 'VSL-002',
        rankId: '2',
        rank: 'Chief Officer',
        crewMemberId: 'A000456',
        signOnDate: '2025-01-15',
        relieverCrewId: 'A000999',
        relieverCrewName: 'John Doe',
        relieverSignOnDate: '2025-07-15'
      };

      const result = insertVesselPlanningSchema.safeParse(planningWithReliever);
      expect(result.success).toBe(true);
    });

    it('should accept on board crew info', () => {
      const planningWithOnBoard = {
        vesselId: 'VSL-003',
        rankId: '3',
        rank: 'Second Officer',
        crewMemberId: 'A000789',
        signOnDate: '2025-02-01',
        onBoardCrewId: 'A000789',
        onBoardCrewName: 'Jane Smith',
        onBoardCrewNationality: 'Filipino'
      };

      const result = insertVesselPlanningSchema.safeParse(planningWithOnBoard);
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
  });

  describe('Officer Matrix Business Logic', () => {
    it('should calculate officer experience on vessel type', () => {
      const seaServiceHistory = [
        { vesselType: 'Tanker', months: 24 },
        { vesselType: 'Bulk Carrier', months: 12 },
        { vesselType: 'Tanker', months: 18 }
      ];
      
      const tankerExperience = seaServiceHistory
        .filter(s => s.vesselType === 'Tanker')
        .reduce((sum, s) => sum + s.months, 0);
      
      expect(tankerExperience).toBe(42);
    });

    it('should calculate time on board for officer matrix', () => {
      const today = new Date();
      const signOnDate = new Date(today);
      signOnDate.setMonth(signOnDate.getMonth() - 5);
      
      const monthsOnBoard = 
        (today.getFullYear() - signOnDate.getFullYear()) * 12 +
        (today.getMonth() - signOnDate.getMonth());
      
      expect(monthsOnBoard).toBe(5);
    });

    it('should identify officers with oil major experience', () => {
      const officers = [
        { id: 1, oilMajorExperience: ['Shell', 'BP'] },
        { id: 2, oilMajorExperience: [] },
        { id: 3, oilMajorExperience: ['Chevron'] }
      ];
      
      const withExperience = officers.filter(o => o.oilMajorExperience.length > 0);
      expect(withExperience.length).toBe(2);
    });

    it('should track certificate validity', () => {
      const certificateExpiry = new Date('2027-06-15');
      const today = new Date();
      
      const isValid = certificateExpiry > today;
      expect(isValid).toBe(true);
    });
  });

  describe('Vessel Filtering', () => {
    it('should filter vessels by name', () => {
      const vessels = [
        { id: 1, name: 'Vessel 3' },
        { id: 2, name: 'Vessel 5' },
        { id: 3, name: 'Tanker Alpha' }
      ];
      
      const filtered = vessels.filter(v => v.name.includes('Vessel'));
      expect(filtered.length).toBe(2);
    });

    it('should filter vessels by fleet', () => {
      const vessels = [
        { id: 1, fleet: 'Fleet A' },
        { id: 2, fleet: 'Fleet B' },
        { id: 3, fleet: 'Fleet A' }
      ];
      
      const fleetA = vessels.filter(v => v.fleet === 'Fleet A');
      expect(fleetA.length).toBe(2);
    });

    it('should filter vessels by additional group', () => {
      const vessels = [
        { id: 1, additionalGroup: 'Tankers' },
        { id: 2, additionalGroup: 'Bulk Carriers' },
        { id: 3, additionalGroup: 'Tankers' }
      ];
      
      const tankers = vessels.filter(v => v.additionalGroup === 'Tankers');
      expect(tankers.length).toBe(2);
    });
  });

  describe('Crew Handover Workflow', () => {
    it('should validate handover planning', () => {
      const handoverPlanning = {
        vesselId: 'VSL-100',
        rankId: '1',
        rank: 'Master',
        crewMemberId: 'A000100',
        signOnDate: '2025-01-15',
        signOffDate: '2025-07-15',
        relieverCrewId: 'A000200',
        takeOverDate: '2025-07-10'
      };

      const result = insertVesselPlanningSchema.safeParse(handoverPlanning);
      expect(result.success).toBe(true);
    });

    it('should track handover period', () => {
      const signOffDate = new Date('2025-07-15');
      const relieverSignOn = new Date('2025-07-10');
      
      const handoverDays = Math.abs(
        Math.ceil((signOffDate.getTime() - relieverSignOn.getTime()) / (1000 * 60 * 60 * 24))
      );
      
      expect(handoverDays).toBe(5);
    });
  });

  describe('Document Expiry', () => {
    it('should identify expired documents', () => {
      const documents = [
        { name: 'COC', expiryDate: '2024-12-31' },
        { name: 'GMDSS', expiryDate: '2025-06-15' },
        { name: 'Medical', expiryDate: '2026-01-01' }
      ];
      
      const today = new Date('2025-01-15');
      const expired = documents.filter(d => new Date(d.expiryDate) < today);
      
      expect(expired.length).toBe(1);
      expect(expired[0].name).toBe('COC');
    });

    it('should identify documents expiring soon', () => {
      const documents = [
        { name: 'COC', expiryDate: '2025-02-15' },
        { name: 'GMDSS', expiryDate: '2025-12-15' }
      ];
      
      const today = new Date('2025-01-15');
      const warningDays = 90;
      
      const expiringSoon = documents.filter(d => {
        const expiryDate = new Date(d.expiryDate);
        const daysUntilExpiry = Math.ceil(
          (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysUntilExpiry > 0 && daysUntilExpiry <= warningDays;
      });
      
      expect(expiringSoon.length).toBe(1);
    });
  });

  describe('Training Matrix', () => {
    it('should calculate training completion rate', () => {
      const requiredTrainings = 10;
      const completedTrainings = 8;
      
      const completionRate = (completedTrainings / requiredTrainings) * 100;
      expect(completionRate).toBe(80);
    });

    it('should identify missing mandatory trainings', () => {
      const mandatoryTrainings = ['STCW', 'GMDSS', 'Advanced Firefighting'];
      const completedTrainings = ['STCW', 'GMDSS'];
      
      const missing = mandatoryTrainings.filter(t => !completedTrainings.includes(t));
      expect(missing).toContain('Advanced Firefighting');
    });
  });

  describe('Data Integrity', () => {
    it('should preserve draft data after parsing', () => {
      const draft = {
        vesselId: 'VSL-INT',
        revision: 'R3',
        draftData: JSON.stringify({ test: 'data' })
      };

      const result = insertVesselDraftSchema.safeParse(draft);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.vesselId).toBe('VSL-INT');
        expect(result.data.revision).toBe('R3');
        const data = JSON.parse(result.data.draftData);
        expect(data.test).toBe('data');
      }
    });

    it('should preserve planning data after parsing', () => {
      const planning = {
        vesselId: 'VSL-INT-2',
        rankId: '5',
        rank: 'Third Officer',
        crewMemberId: 'A000500',
        signOnDate: '2025-03-01'
      };

      const result = insertVesselPlanningSchema.safeParse(planning);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.vesselId).toBe('VSL-INT-2');
        expect(result.data.rankId).toBe('5');
      }
    });
  });
});
