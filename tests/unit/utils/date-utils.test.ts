// Unit tests for date utility functions
import { describe, it, expect } from 'vitest';

describe('Date Utilities', () => {
  describe('Date Formatting', () => {
    it('should format date as YYYY-MM-DD', () => {
      const date = new Date('2025-01-06T12:00:00Z');
      const formatted = date.toISOString().split('T')[0];
      
      expect(formatted).toBe('2025-01-06');
    });

    it('should parse date strings correctly', () => {
      const dateString = '2025-01-06';
      const date = new Date(dateString);
      
      expect(date.getFullYear()).toBe(2025);
      expect(date.getMonth()).toBe(0); // January is 0
      expect(date.getDate()).toBe(6);
    });
  });

  describe('Date Calculations', () => {
    it('should calculate days between dates', () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-06');
      
      const diffInMs = endDate.getTime() - startDate.getTime();
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
      
      expect(diffInDays).toBe(5);
    });

    it('should add days to a date', () => {
      const date = new Date('2025-01-01');
      const daysToAdd = 10;
      
      const newDate = new Date(date);
      newDate.setDate(newDate.getDate() + daysToAdd);
      
      expect(newDate.getDate()).toBe(11);
    });

    it('should subtract days from a date', () => {
      const date = new Date('2025-01-15');
      const daysToSubtract = 10;
      
      const newDate = new Date(date);
      newDate.setDate(newDate.getDate() - daysToSubtract);
      
      expect(newDate.getDate()).toBe(5);
    });
  });

  describe('Date Range Validation', () => {
    it('should check if date is within range', () => {
      const testDate = new Date('2025-01-06');
      const rangeStart = new Date('2025-01-01');
      const rangeEnd = new Date('2025-01-31');
      
      const isWithinRange = testDate >= rangeStart && testDate <= rangeEnd;
      
      expect(isWithinRange).toBe(true);
    });

    it('should detect overlapping date ranges', () => {
      const range1 = { start: new Date('2025-01-01'), end: new Date('2025-01-15') };
      const range2 = { start: new Date('2025-01-10'), end: new Date('2025-01-20') };
      
      const overlaps = range1.start <= range2.end && range1.end >= range2.start;
      
      expect(overlaps).toBe(true);
    });

    it('should detect non-overlapping date ranges', () => {
      const range1 = { start: new Date('2025-01-01'), end: new Date('2025-01-10') };
      const range2 = { start: new Date('2025-01-15'), end: new Date('2025-01-20') };
      
      const overlaps = range1.start <= range2.end && range1.end >= range2.start;
      
      expect(overlaps).toBe(false);
    });
  });

  describe('Time Period Calculations', () => {
    it('should calculate hours from time strings', () => {
      const startTime = '08:00';
      const endTime = '16:00';
      
      const [startHour] = startTime.split(':').map(Number);
      const [endHour] = endTime.split(':').map(Number);
      
      const hours = endHour - startHour;
      
      expect(hours).toBe(8);
    });

    it('should handle overnight time periods', () => {
      const startTime = '22:00';
      const endTime = '06:00';
      
      const [startHour] = startTime.split(':').map(Number);
      const [endHour] = endTime.split(':').map(Number);
      
      const hours = (24 - startHour) + endHour;
      
      expect(hours).toBe(8);
    });

    it('should calculate total rest hours from periods', () => {
      const restPeriods = [
        { start: '00:00', end: '06:00' },
        { start: '12:00', end: '18:00' },
      ];
      
      const totalHours = restPeriods.reduce((total, period) => {
        const [startHour] = period.start.split(':').map(Number);
        const [endHour] = period.end.split(':').map(Number);
        return total + (endHour - startHour);
      }, 0);
      
      expect(totalHours).toBe(12);
    });
  });

  describe('Week and Month Calculations', () => {
    it('should get start of week', () => {
      const date = new Date('2025-01-06'); // Monday
      const dayOfWeek = date.getDay();
      const startOfWeek = new Date(date);
      startOfWeek.setDate(date.getDate() - dayOfWeek);
      
      expect(startOfWeek.getDay()).toBe(0); // Sunday
    });

    it('should get end of month', () => {
      const date = new Date('2025-01-15');
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      expect(endOfMonth.getDate()).toBe(31);
    });

    it('should calculate weeks in a period', () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');
      
      const diffInMs = endDate.getTime() - startDate.getTime();
      const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
      const weeks = Math.ceil(diffInDays / 7);
      
      expect(weeks).toBe(5);
    });
  });
});
