// Unit tests for crew mapping utilities
import { describe, it, expect } from 'vitest';
import { mockCrewMembers, mockCrewMember } from '../../fixtures/crew-members';
import { mockVessels } from '../../fixtures/vessels';

describe('Crew Mapping Utilities', () => {
  describe('Crew to Vessel Assignment', () => {
    it('should map crew members to their vessels', () => {
      const crewByVessel = mockCrewMembers.reduce((acc, crew) => {
        const vesselId = crew.vesselId;
        if (!acc[vesselId]) {
          acc[vesselId] = [];
        }
        acc[vesselId].push(crew);
        return acc;
      }, {} as Record<number, typeof mockCrewMembers>);
      
      expect(crewByVessel[1]).toHaveLength(2);
      expect(crewByVessel[2]).toHaveLength(1);
    });

    it('should find vessel for a crew member', () => {
      const crewMember = mockCrewMember;
      const vessel = mockVessels.find(v => v.id === crewMember.vesselId);
      
      expect(vessel).toBeDefined();
      expect(vessel?.id).toBe(1);
    });
  });

  describe('Rank Hierarchy', () => {
    it('should order ranks by seniority', () => {
      const rankHierarchy = [
        'Master',
        'Chief Officer',
        'Second Officer',
        'Third Officer',
        'Chief Engineer',
        'Second Engineer',
        'Third Engineer',
        'Bosun',
        'AB Seaman',
        'Ordinary Seaman',
      ];
      
      const masterIndex = rankHierarchy.indexOf('Master');
      const thirdOfficerIndex = rankHierarchy.indexOf('Third Officer');
      
      expect(masterIndex).toBeLessThan(thirdOfficerIndex);
    });

    it('should group crew by department', () => {
      const deckDepartment = ['Master', 'Chief Officer', 'Second Officer', 'Third Officer', 'Bosun', 'AB Seaman'];
      const engineDepartment = ['Chief Engineer', 'Second Engineer', 'Third Engineer', 'Motorman'];
      
      const crewMemberRank = 'Chief Officer';
      const isDeck = deckDepartment.includes(crewMemberRank);
      const isEngine = engineDepartment.includes(crewMemberRank);
      
      expect(isDeck).toBe(true);
      expect(isEngine).toBe(false);
    });
  });

  describe('Crew Search and Filter', () => {
    it('should filter crew by rank', () => {
      const targetRank = 'Master';
      const masters = mockCrewMembers.filter(c => c.rank === targetRank);
      
      expect(masters.length).toBe(1);
      expect(masters[0].firstName).toBe('John');
    });

    it('should filter crew by vessel', () => {
      const targetVessel = 1;
      const crewOnVessel = mockCrewMembers.filter(c => c.vesselId === targetVessel);
      
      expect(crewOnVessel.length).toBe(2);
    });

    it('should filter active crew only', () => {
      const activeCrew = mockCrewMembers.filter(c => c.status === 'active');
      
      expect(activeCrew.length).toBe(3);
    });

    it('should search crew by name', () => {
      const searchTerm = 'john';
      const results = mockCrewMembers.filter(
        c => c.firstName.toLowerCase().includes(searchTerm) ||
             c.lastName.toLowerCase().includes(searchTerm)
      );
      
      expect(results.length).toBe(1);
      expect(results[0].firstName).toBe('John');
    });
  });

  describe('Crew Statistics', () => {
    it('should count crew per vessel', () => {
      const vesselCrewCounts = mockVessels.map(vessel => ({
        vesselId: vessel.id,
        vesselName: vessel.name,
        crewCount: mockCrewMembers.filter(c => c.vesselId === vessel.id).length,
      }));
      
      const vessel1 = vesselCrewCounts.find(v => v.vesselId === 1);
      expect(vessel1?.crewCount).toBe(2);
    });

    it('should calculate crew by nationality distribution', () => {
      const byNationality = mockCrewMembers.reduce((acc, crew) => {
        acc[crew.nationality] = (acc[crew.nationality] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      expect(byNationality['British']).toBe(1);
      expect(byNationality['American']).toBe(1);
      expect(byNationality['Spanish']).toBe(1);
    });
  });

  describe('Crew Validation', () => {
    it('should validate required crew fields', () => {
      const requiredFields = ['firstName', 'lastName', 'rank', 'vesselId'];
      const crew = mockCrewMember;
      
      const hasAllRequired = requiredFields.every(field => 
        crew[field as keyof typeof crew] !== undefined &&
        crew[field as keyof typeof crew] !== null
      );
      
      expect(hasAllRequired).toBe(true);
    });

    it('should validate email format', () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isValidEmail = emailRegex.test(mockCrewMember.email);
      
      expect(isValidEmail).toBe(true);
    });

    it('should check for duplicate crew members', () => {
      const emails = mockCrewMembers.map(c => c.email);
      const uniqueEmails = new Set(emails);
      
      expect(uniqueEmails.size).toBe(emails.length);
    });
  });
});
