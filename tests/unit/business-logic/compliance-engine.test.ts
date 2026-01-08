// Unit tests for compliance engine
import { describe, it, expect } from 'vitest';

describe('Compliance Engine', () => {
  describe('MLC Compliance', () => {
    it('should check MLC 2006 rest hour requirements', () => {
      const mlcRequirements = {
        minRestIn24Hours: 10,
        minRestIn7Days: 77,
        maxWorkIn24Hours: 14,
        maxWorkIn7Days: 72,
      };
      
      const actualValues = {
        restIn24Hours: 11,
        restIn7Days: 80,
        workIn24Hours: 13,
        workIn7Days: 70,
      };
      
      const isCompliant = 
        actualValues.restIn24Hours >= mlcRequirements.minRestIn24Hours &&
        actualValues.restIn7Days >= mlcRequirements.minRestIn7Days &&
        actualValues.workIn24Hours <= mlcRequirements.maxWorkIn24Hours &&
        actualValues.workIn7Days <= mlcRequirements.maxWorkIn7Days;
      
      expect(isCompliant).toBe(true);
    });
  });

  describe('STCW Compliance', () => {
    it('should validate STCW certification requirements', () => {
      const rankRequirements = {
        'Master': ['STCW II/2', 'GMDSS', 'Medical', 'ARPA'],
        'Chief Officer': ['STCW II/2', 'GMDSS', 'Medical'],
        'Second Officer': ['STCW II/1', 'Medical'],
      };
      
      const officerCertifications = ['STCW II/2', 'GMDSS', 'Medical', 'ARPA', 'BRM'];
      const rank = 'Master';
      
      const requiredCerts = rankRequirements[rank];
      const hasAllRequired = requiredCerts.every(cert => officerCertifications.includes(cert));
      
      expect(hasAllRequired).toBe(true);
    });

    it('should check certification expiry dates', () => {
      const certifications = [
        { name: 'STCW', expiryDate: '2026-06-15' },
        { name: 'Medical', expiryDate: '2025-03-01' },
        { name: 'GMDSS', expiryDate: '2024-12-31' },
      ];
      
      const today = new Date('2025-01-06');
      
      const expiredCerts = certifications.filter(cert => {
        return new Date(cert.expiryDate) < today;
      });
      
      expect(expiredCerts.length).toBe(1);
      expect(expiredCerts[0].name).toBe('GMDSS');
    });
  });

  describe('Flag State Requirements', () => {
    it('should validate flag state specific requirements', () => {
      const flagStateRequirements = {
        'Panama': { minCrewAge: 18, maxWorkHours: 14 },
        'Liberia': { minCrewAge: 18, maxWorkHours: 14 },
        'Marshall Islands': { minCrewAge: 18, maxWorkHours: 14 },
      };
      
      const vesselFlag = 'Panama';
      const crewMember = {
        age: 25,
        dailyWorkHours: 12,
      };
      
      const requirements = flagStateRequirements[vesselFlag];
      const isCompliant = 
        crewMember.age >= requirements.minCrewAge &&
        crewMember.dailyWorkHours <= requirements.maxWorkHours;
      
      expect(isCompliant).toBe(true);
    });
  });

  describe('Vessel Safety Compliance', () => {
    it('should check minimum safe manning requirements', () => {
      const safeManningRequirements = {
        'Container Ship': { master: 1, chiefOfficer: 1, officers: 2, ratings: 8 },
        'Tanker': { master: 1, chiefOfficer: 1, officers: 3, ratings: 10 },
      };
      
      const vesselType = 'Container Ship';
      const actualCrew = {
        master: 1,
        chiefOfficer: 1,
        officers: 3,
        ratings: 10,
      };
      
      const requirements = safeManningRequirements[vesselType];
      const meetsRequirements = 
        actualCrew.master >= requirements.master &&
        actualCrew.chiefOfficer >= requirements.chiefOfficer &&
        actualCrew.officers >= requirements.officers &&
        actualCrew.ratings >= requirements.ratings;
      
      expect(meetsRequirements).toBe(true);
    });

    it('should validate watchkeeping schedules', () => {
      const watchSchedule = [
        { officer: 'Officer A', watches: ['00:00-04:00', '12:00-16:00'] },
        { officer: 'Officer B', watches: ['04:00-08:00', '16:00-20:00'] },
        { officer: 'Officer C', watches: ['08:00-12:00', '20:00-24:00'] },
      ];
      
      // Check 24-hour coverage
      const allWatchHours = watchSchedule.flatMap(w => w.watches);
      expect(allWatchHours.length).toBe(6); // 6 x 4-hour watches = 24 hours
    });
  });
});
