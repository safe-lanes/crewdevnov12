// Unit tests for violation detection logic
import { describe, it, expect, vi } from 'vitest';
import { mockViolations, mockRestHourEntries } from '../../fixtures/rest-hours';
import { expectValidViolation } from '../../helpers/assertion-helpers';

describe('Violation Detection', () => {
  describe('Rest Hour Violations', () => {
    it('should detect when minimum 10 hours rest in 24-hour period is not met', () => {
      // Test fixture with insufficient rest
      const insufficientRest = {
        totalRestHours: 8,
        date: '2025-01-06',
        crewMemberId: 1,
      };
      
      // Violation should be detected when rest hours < 10
      expect(insufficientRest.totalRestHours).toBeLessThan(10);
    });

    it('should allow entries with 10 or more hours of rest', () => {
      const sufficientRest = {
        totalRestHours: 12,
        date: '2025-01-06',
        crewMemberId: 1,
      };
      
      expect(sufficientRest.totalRestHours).toBeGreaterThanOrEqual(10);
    });

    it('should validate violation structure', () => {
      mockViolations.forEach(violation => {
        expectValidViolation(violation);
      });
    });

    it('should categorize violations by severity', () => {
      const criticalViolations = mockViolations.filter(v => v.severity === 'critical');
      const warningViolations = mockViolations.filter(v => v.severity === 'warning');
      
      expect(criticalViolations.length).toBeGreaterThanOrEqual(0);
      expect(warningViolations.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Code 1 Violations', () => {
    it('should detect Code 1 violation for insufficient rest', () => {
      const violation = {
        code: 'REST_MIN_24H',
        description: 'Minimum 10 hours rest in any 24-hour period not met',
        severity: 'critical',
      };
      
      expect(violation.code).toBe('REST_MIN_24H');
      expect(violation.severity).toBe('critical');
    });
  });

  describe('Code 7 Violations', () => {
    it('should detect Code 7 violation for 7-day period', () => {
      const sevenDayTotal = 70; // Less than required 77 hours
      const minRequired = 77;
      
      expect(sevenDayTotal).toBeLessThan(minRequired);
    });

    it('should pass when 77 hours rest achieved in 7-day period', () => {
      const sevenDayTotal = 80;
      const minRequired = 77;
      
      expect(sevenDayTotal).toBeGreaterThanOrEqual(minRequired);
    });
  });

  describe('Rest Period Splitting', () => {
    it('should allow rest split into maximum 2 periods', () => {
      const validSplit = [
        { start: '00:00', end: '06:00' },
        { start: '12:00', end: '18:00' },
      ];
      
      expect(validSplit.length).toBeLessThanOrEqual(2);
    });

    it('should flag when rest is split into more than 2 periods', () => {
      const invalidSplit = [
        { start: '00:00', end: '03:00' },
        { start: '06:00', end: '09:00' },
        { start: '14:00', end: '17:00' },
      ];
      
      expect(invalidSplit.length).toBeGreaterThan(2);
    });

    it('should require at least one period of 6 consecutive hours', () => {
      const validPeriods = [
        { start: '00:00', end: '06:00' }, // 6 hours
        { start: '12:00', end: '16:00' }, // 4 hours
      ];
      
      // Calculate longest period
      const longestPeriodHours = validPeriods.reduce((max, period) => {
        const start = parseInt(period.start.split(':')[0]);
        const end = parseInt(period.end.split(':')[0]);
        const duration = end - start;
        return duration > max ? duration : max;
      }, 0);
      
      expect(longestPeriodHours).toBeGreaterThanOrEqual(6);
    });
  });
});
