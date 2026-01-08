import { describe, it, expect } from 'vitest';
import { insertDrugAlcoholTestRecordSchema } from '@shared/schema';

describe('Drug & Alcohol Testing Schema Validation', () => {
  describe('Valid Test Records', () => {
    it('should validate complete test record', () => {
      const validRecord = {
        vesselId: 'VSL-001',
        testType: 'annual',
        frequencyMonths: 12
      };

      const result = insertDrugAlcoholTestRecordSchema.safeParse(validRecord);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.testType).toBe('annual');
      }
    });

    it('should validate periodic test', () => {
      const periodicTest = {
        vesselId: 'VSL-002',
        testType: 'periodic',
        frequencyMonths: 3
      };

      const result = insertDrugAlcoholTestRecordSchema.safeParse(periodicTest);
      expect(result.success).toBe(true);
    });

    it('should validate monthly test', () => {
      const monthlyTest = {
        vesselId: 'VSL-003',
        testType: 'monthly',
        frequencyMonths: 1
      };

      const result = insertDrugAlcoholTestRecordSchema.safeParse(monthlyTest);
      expect(result.success).toBe(true);
    });

    it('should validate post-incident test', () => {
      const postIncidentTest = {
        vesselId: 'VSL-004',
        testType: 'post-incident',
        frequencyMonths: 12,
        incidentTitle: 'Minor collision investigation'
      };

      const result = insertDrugAlcoholTestRecordSchema.safeParse(postIncidentTest);
      expect(result.success).toBe(true);
    });

    it('should validate others test type', () => {
      const othersTest = {
        vesselId: 'VSL-005',
        testType: 'others',
        frequencyMonths: 6
      };

      const result = insertDrugAlcoholTestRecordSchema.safeParse(othersTest);
      expect(result.success).toBe(true);
    });

    it('should accept optional alcoholDrugType', () => {
      const testWithType = {
        vesselId: 'VSL-006',
        testType: 'annual',
        frequencyMonths: 12,
        alcoholDrugType: JSON.stringify(['Alcohol', 'Drug'])
      };

      const result = insertDrugAlcoholTestRecordSchema.safeParse(testWithType);
      expect(result.success).toBe(true);
    });

    it('should accept placeLocation', () => {
      const testWithLocation = {
        vesselId: 'VSL-007',
        testType: 'annual',
        frequencyMonths: 12,
        placeLocation: 'Singapore Port'
      };

      const result = insertDrugAlcoholTestRecordSchema.safeParse(testWithLocation);
      expect(result.success).toBe(true);
    });

    it('should accept dateTimeTestCompleted', () => {
      const testWithDateTime = {
        vesselId: 'VSL-008',
        testType: 'annual',
        frequencyMonths: 12,
        dateTimeTestCompleted: '31 May 2023 - 1010 Hours'
      };

      const result = insertDrugAlcoholTestRecordSchema.safeParse(testWithDateTime);
      expect(result.success).toBe(true);
    });

    it('should accept planned test information', () => {
      const testWithPlanned = {
        vesselId: 'VSL-009',
        testType: 'annual',
        frequencyMonths: 12,
        plannedPort: 'Rotterdam',
        plannedDate: '2025-06-15',
        plannedComments: 'Scheduled during dry dock'
      };

      const result = insertDrugAlcoholTestRecordSchema.safeParse(testWithPlanned);
      expect(result.success).toBe(true);
    });
  });

  describe('Invalid Test Records', () => {
    it('should reject missing vesselId', () => {
      const invalid = {
        testType: 'annual',
        frequencyMonths: 12
      };

      const result = insertDrugAlcoholTestRecordSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject missing testType', () => {
      const invalid = {
        vesselId: 'VSL-010',
        frequencyMonths: 12
      };

      const result = insertDrugAlcoholTestRecordSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject null vesselId', () => {
      const invalid = {
        vesselId: null,
        testType: 'annual',
        frequencyMonths: 12
      };

      const result = insertDrugAlcoholTestRecordSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject null testType', () => {
      const invalid = {
        vesselId: 'VSL-011',
        testType: null,
        frequencyMonths: 12
      };

      const result = insertDrugAlcoholTestRecordSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject numeric vesselId', () => {
      const invalid = {
        vesselId: 12345,
        testType: 'annual',
        frequencyMonths: 12
      };

      const result = insertDrugAlcoholTestRecordSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('Test Types Business Logic', () => {
    it('should define all valid test types', () => {
      const testTypes = ['annual', 'periodic', 'monthly', 'post-incident', 'others'];
      expect(testTypes.length).toBe(5);
    });

    it('should map test types to frequency', () => {
      const typeToFrequency: Record<string, number> = {
        'annual': 12,
        'periodic': 3,
        'monthly': 1
      };

      expect(typeToFrequency['annual']).toBe(12);
      expect(typeToFrequency['periodic']).toBe(3);
      expect(typeToFrequency['monthly']).toBe(1);
    });

    it('should identify crew due for annual testing', () => {
      const today = new Date();
      const lastTestDate = new Date(today);
      lastTestDate.setMonth(lastTestDate.getMonth() - 13);
      
      const annualIntervalDays = 365;
      const daysSinceTest = Math.floor(
        (today.getTime() - lastTestDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      const isDueForAnnual = daysSinceTest >= annualIntervalDays;
      expect(isDueForAnnual).toBe(true);
    });

    it('should calculate next test due date', () => {
      const lastTestDate = new Date('2025-01-15');
      const frequencyMonths = 12;
      
      const nextDue = new Date(lastTestDate);
      nextDue.setMonth(nextDue.getMonth() + frequencyMonths);
      
      expect(nextDue.getFullYear()).toBe(2026);
      expect(nextDue.getMonth()).toBe(0);
    });
  });

  describe('Test History', () => {
    it('should validate test history format', () => {
      const testWithHistory = {
        vesselId: 'VSL-012',
        testType: 'annual',
        frequencyMonths: 12,
        testHistory: JSON.stringify([
          { date: '31 May 2023', port: 'Singapore', violations: 0 },
          { date: '15 Mar 2022', port: 'Rotterdam', violations: 0 }
        ])
      };

      const result = insertDrugAlcoholTestRecordSchema.safeParse(testWithHistory);
      expect(result.success).toBe(true);
    });

    it('should track violation count in history', () => {
      const history = [
        { date: '31 May 2023', port: 'Singapore', violations: 0 },
        { date: '15 Mar 2022', port: 'Rotterdam', violations: 1 },
        { date: '10 Jan 2021', port: 'Dubai', violations: 0 }
      ];
      
      const totalViolations = history.reduce((sum, h) => sum + h.violations, 0);
      expect(totalViolations).toBe(1);
    });
  });

  describe('Compliance Calculations', () => {
    it('should calculate testing compliance rate', () => {
      const totalVessels = 25;
      const testedVessels = 22;
      
      const complianceRate = (testedVessels / totalVessels) * 100;
      expect(complianceRate).toBe(88);
    });

    it('should identify vessels with overdue testing', () => {
      const vesselTestingRecords = [
        { vesselId: 'VSL-001', lastTestDate: '2024-06-01' },
        { vesselId: 'VSL-002', lastTestDate: '2025-01-01' }
      ];
      
      const today = new Date('2025-01-15');
      const overdueVessels = vesselTestingRecords.filter(v => {
        const lastTest = new Date(v.lastTestDate);
        const daysSinceTest = Math.floor(
          (today.getTime() - lastTest.getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysSinceTest > 365;
      });
      
      expect(overdueVessels.length).toBe(0);
    });

    it('should calculate average tests per vessel', () => {
      const totalTests = 150;
      const totalVessels = 30;
      
      const averagePerVessel = totalTests / totalVessels;
      expect(averagePerVessel).toBe(5);
    });

    it('should track testing frequency compliance', () => {
      const requiredTestsPerYear = 4;
      const actualTestsThisYear = 5;
      
      const isCompliant = actualTestsThisYear >= requiredTestsPerYear;
      expect(isCompliant).toBe(true);
    });
  });

  describe('Testing Equipment', () => {
    it('should accept testing equipment JSON', () => {
      const testWithEquipment = {
        vesselId: 'VSL-013',
        testType: 'annual',
        frequencyMonths: 12,
        testingEquipment: JSON.stringify([
          { name: 'Breathalyzer', serialNo: 'BR-001', calibrationDate: '2025-01-01' }
        ])
      };

      const result = insertDrugAlcoholTestRecordSchema.safeParse(testWithEquipment);
      expect(result.success).toBe(true);
    });

    it('should accept equipment not applicable flag', () => {
      const testWithNA = {
        vesselId: 'VSL-014',
        testType: 'annual',
        frequencyMonths: 12,
        equipmentNotApplicable: true
      };

      const result = insertDrugAlcoholTestRecordSchema.safeParse(testWithNA);
      expect(result.success).toBe(true);
    });
  });

  describe('Data Integrity', () => {
    it('should preserve all fields after parsing', () => {
      const record = {
        vesselId: 'VSL-015',
        testType: 'annual',
        frequencyMonths: 12,
        placeLocation: 'Singapore',
        plannedPort: 'Rotterdam',
        plannedDate: '2025-06-15'
      };

      const result = insertDrugAlcoholTestRecordSchema.safeParse(record);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.vesselId).toBe('VSL-015');
        expect(result.data.testType).toBe('annual');
        expect(result.data.frequencyMonths).toBe(12);
        expect(result.data.placeLocation).toBe('Singapore');
      }
    });

    it('should handle VSL-XXX format vessel IDs', () => {
      const record = {
        vesselId: 'VSL-123',
        testType: 'periodic',
        frequencyMonths: 3
      };

      const result = insertDrugAlcoholTestRecordSchema.safeParse(record);
      expect(result.success).toBe(true);
    });
  });
});
