// Unit tests for experience calculation logic
import { describe, it, expect } from 'vitest';

describe('Experience Calculations', () => {
  describe('Sea Service Duration', () => {
    it('should calculate total sea service in months', () => {
      const startDate = new Date('2020-01-01');
      const endDate = new Date('2025-01-01');
      
      const diffInMs = endDate.getTime() - startDate.getTime();
      const diffInMonths = Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 30.44));
      
      expect(diffInMonths).toBe(60); // 5 years = 60 months
    });

    it('should calculate service on specific vessel type', () => {
      const vesselTypeExperience = [
        { vesselType: 'Container Ship', months: 24 },
        { vesselType: 'Tanker', months: 18 },
        { vesselType: 'Bulk Carrier', months: 12 },
      ];
      
      const totalMonths = vesselTypeExperience.reduce((sum, exp) => sum + exp.months, 0);
      expect(totalMonths).toBe(54);
    });
  });

  describe('Rank Progression', () => {
    it('should calculate time in current rank', () => {
      const rankStartDate = new Date('2023-06-15');
      const currentDate = new Date('2025-01-06');
      
      const diffInMs = currentDate.getTime() - rankStartDate.getTime();
      const diffInMonths = Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 30.44));
      
      expect(diffInMonths).toBeGreaterThanOrEqual(18);
    });

    it('should determine eligibility for promotion based on experience', () => {
      const requirements = {
        minSeaService: 36, // months
        minTimeInRank: 12, // months
        requiredCertifications: ['STCW', 'GOC'],
      };
      
      const seafarerExperience = {
        totalSeaService: 48,
        timeInCurrentRank: 18,
        certifications: ['STCW', 'GOC', 'Medical'],
      };
      
      const meetsSeaService = seafarerExperience.totalSeaService >= requirements.minSeaService;
      const meetsTimeInRank = seafarerExperience.timeInCurrentRank >= requirements.minTimeInRank;
      const hasRequiredCerts = requirements.requiredCertifications.every(
        cert => seafarerExperience.certifications.includes(cert)
      );
      
      expect(meetsSeaService).toBe(true);
      expect(meetsTimeInRank).toBe(true);
      expect(hasRequiredCerts).toBe(true);
    });
  });

  describe('Performance Scoring', () => {
    it('should calculate weighted average score', () => {
      const scores = {
        technicalSkills: { score: 4, weight: 0.3 },
        safetyAwareness: { score: 5, weight: 0.25 },
        teamwork: { score: 4, weight: 0.2 },
        leadership: { score: 3, weight: 0.15 },
        communication: { score: 4, weight: 0.1 },
      };
      
      const weightedAverage = Object.values(scores).reduce(
        (sum, item) => sum + item.score * item.weight,
        0
      );
      
      expect(weightedAverage).toBeCloseTo(4.1, 1);
    });

    it('should normalize scores to 1-5 scale', () => {
      const rawScore = 85; // Percentage
      const normalizedScore = (rawScore / 100) * 4 + 1; // Maps 0-100 to 1-5
      
      expect(normalizedScore).toBeCloseTo(4.4, 1);
      expect(normalizedScore).toBeGreaterThanOrEqual(1);
      expect(normalizedScore).toBeLessThanOrEqual(5);
    });
  });

  describe('Training Compliance', () => {
    it('should check if mandatory training is complete', () => {
      const mandatoryTraining = ['STCW Basic', 'Fire Safety', 'First Aid', 'PSC'];
      const completedTraining = ['STCW Basic', 'Fire Safety', 'First Aid', 'PSC', 'Advanced Navigation'];
      
      const isCompliant = mandatoryTraining.every(
        training => completedTraining.includes(training)
      );
      
      expect(isCompliant).toBe(true);
    });

    it('should identify missing mandatory training', () => {
      const mandatoryTraining = ['STCW Basic', 'Fire Safety', 'First Aid', 'PSC'];
      const completedTraining = ['STCW Basic', 'Fire Safety'];
      
      const missingTraining = mandatoryTraining.filter(
        training => !completedTraining.includes(training)
      );
      
      expect(missingTraining).toContain('First Aid');
      expect(missingTraining).toContain('PSC');
      expect(missingTraining.length).toBe(2);
    });
  });
});
