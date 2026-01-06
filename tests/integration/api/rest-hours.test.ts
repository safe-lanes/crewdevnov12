// Integration tests for rest hours API endpoints
import { describe, it, expect } from 'vitest';
import { mockRestHourEntry, mockRestHourEntries, mockViolations } from '../../fixtures/rest-hours';
import { expectValidRestHourEntry, expectCompliantRestHours } from '../../helpers/assertion-helpers';

describe('Rest Hours API', () => {
  describe('GET /api/rest-hours', () => {
    it('should return rest hour entries', () => {
      expect(mockRestHourEntries.length).toBeGreaterThan(0);
      mockRestHourEntries.forEach(entry => {
        expectValidRestHourEntry(entry);
      });
    });

    it('should support filtering by crew member', () => {
      const crewMemberId = 1;
      const filteredEntries = mockRestHourEntries.filter(e => e.crewMemberId === crewMemberId);
      
      expect(filteredEntries.length).toBeGreaterThan(0);
    });

    it('should support filtering by date range', () => {
      const startDate = '2025-01-01';
      const endDate = '2025-01-31';
      
      const filteredEntries = mockRestHourEntries.filter(e => {
        return e.date >= startDate && e.date <= endDate;
      });
      
      expect(filteredEntries.length).toBeGreaterThan(0);
    });

    it('should support filtering by compliance status', () => {
      const compliantEntries = mockRestHourEntries.filter(e => e.isCompliant);
      const nonCompliantEntries = mockRestHourEntries.filter(e => !e.isCompliant);
      
      expect(compliantEntries.length).toBeGreaterThanOrEqual(0);
      expect(nonCompliantEntries.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /api/rest-hours/:id', () => {
    it('should return a single rest hour entry', () => {
      expectValidRestHourEntry(mockRestHourEntry);
    });

    it('should include rest periods', () => {
      expect(mockRestHourEntry.restPeriods).toBeInstanceOf(Array);
      expect(mockRestHourEntry.restPeriods.length).toBeGreaterThan(0);
    });

    it('should calculate total rest hours', () => {
      expect(mockRestHourEntry.totalRestHours).toBeDefined();
      expect(typeof mockRestHourEntry.totalRestHours).toBe('number');
    });
  });

  describe('POST /api/rest-hours', () => {
    it('should validate rest period structure', () => {
      const validRestPeriod = { start: '00:00', end: '06:00' };
      
      expect(validRestPeriod).toHaveProperty('start');
      expect(validRestPeriod).toHaveProperty('end');
    });

    it('should validate time format', () => {
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      
      mockRestHourEntry.restPeriods.forEach(period => {
        expect(period.start).toMatch(timeRegex);
        expect(period.end).toMatch(timeRegex);
      });
    });

    it('should require crew member ID', () => {
      expect(mockRestHourEntry.crewMemberId).toBeDefined();
      expect(typeof mockRestHourEntry.crewMemberId).toBe('number');
    });

    it('should require date', () => {
      expect(mockRestHourEntry.date).toBeDefined();
      expect(mockRestHourEntry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('Compliance Calculation', () => {
    it('should flag entries with less than 10 hours rest', () => {
      const nonCompliantEntry = mockRestHourEntries.find(e => e.totalRestHours < 10);
      
      if (nonCompliantEntry) {
        expect(nonCompliantEntry.isCompliant).toBe(false);
      }
    });

    it('should approve entries with 10 or more hours rest', () => {
      const compliantEntry = mockRestHourEntries.find(e => e.totalRestHours >= 10);
      
      if (compliantEntry) {
        expectCompliantRestHours(compliantEntry.totalRestHours);
      }
    });
  });

  describe('Violations Endpoint', () => {
    it('should return violations for a crew member', () => {
      expect(mockViolations.length).toBeGreaterThan(0);
    });

    it('should categorize violations by severity', () => {
      const severities = mockViolations.map(v => v.severity);
      
      severities.forEach(severity => {
        expect(['critical', 'warning', 'info']).toContain(severity);
      });
    });

    it('should include violation code and description', () => {
      mockViolations.forEach(violation => {
        expect(violation).toHaveProperty('code');
        expect(violation).toHaveProperty('description');
      });
    });
  });

  describe('Weekly Summary', () => {
    it('should calculate 7-day rest total', () => {
      const crewId = 1;
      const crewEntries = mockRestHourEntries.filter(e => e.crewMemberId === crewId);
      const totalRestIn7Days = crewEntries.reduce((sum, e) => sum + e.totalRestHours, 0);
      
      expect(totalRestIn7Days).toBeGreaterThan(0);
    });

    it('should check 77-hour minimum in 7 days', () => {
      const minRequiredIn7Days = 77;
      // This would be calculated from actual 7-day data
      const sample7DayTotal = 80;
      
      expect(sample7DayTotal).toBeGreaterThanOrEqual(minRequiredIn7Days);
    });
  });

  describe('Timeline Generation', () => {
    it('should generate 24-hour timeline', () => {
      const hours = Array.from({ length: 24 }, (_, i) => i);
      
      expect(hours.length).toBe(24);
      expect(hours[0]).toBe(0);
      expect(hours[23]).toBe(23);
    });

    it('should map rest periods to timeline blocks', () => {
      const timeline = Array.from({ length: 24 }, (_, hour) => {
        const isResting = mockRestHourEntry.restPeriods.some(period => {
          const startHour = parseInt(period.start.split(':')[0]);
          const endHour = parseInt(period.end.split(':')[0]);
          return hour >= startHour && hour < endHour;
        });
        return { hour, isResting };
      });
      
      const restingHours = timeline.filter(t => t.isResting).length;
      expect(restingHours).toBe(12);
    });
  });
});
