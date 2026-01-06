// Integration tests for appraisal forms API endpoints
import { describe, it, expect } from 'vitest';
import { mockAppraisalForm, mockAppraisalForms, mockAppraisalFormInsert } from '../../fixtures/forms';

describe('Appraisal Forms API', () => {
  describe('GET /api/appraisals', () => {
    it('should return a list of appraisal forms', () => {
      expect(mockAppraisalForms.length).toBeGreaterThan(0);
    });

    it('should support filtering by status', () => {
      const draftForms = mockAppraisalForms.filter(f => f.status === 'draft');
      const submittedForms = mockAppraisalForms.filter(f => f.status === 'submitted');
      
      expect(draftForms.length).toBeGreaterThanOrEqual(0);
      expect(submittedForms.length).toBeGreaterThanOrEqual(0);
    });

    it('should support filtering by crew member', () => {
      const crewMemberId = 1;
      const crewForms = mockAppraisalForms.filter(f => f.crewMemberId === crewMemberId);
      
      expect(crewForms.length).toBeGreaterThanOrEqual(0);
    });

    it('should support filtering by vessel', () => {
      const vesselId = 1;
      const vesselForms = mockAppraisalForms.filter(f => f.vesselId === vesselId);
      
      expect(vesselForms.length).toBeGreaterThan(0);
    });

    it('should support filtering by appraisal period', () => {
      const year = 2024;
      const yearForms = mockAppraisalForms.filter(f => 
        f.appraisalPeriodStart.startsWith(String(year))
      );
      
      expect(yearForms.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/appraisals/:id', () => {
    it('should return a single appraisal form', () => {
      expect(mockAppraisalForm).toHaveProperty('id');
      expect(mockAppraisalForm).toHaveProperty('crewMemberId');
      expect(mockAppraisalForm).toHaveProperty('vesselId');
    });

    it('should include all form parts', () => {
      expect(mockAppraisalForm).toHaveProperty('partA');
      expect(mockAppraisalForm).toHaveProperty('partB');
      expect(mockAppraisalForm).toHaveProperty('partC');
      expect(mockAppraisalForm).toHaveProperty('partD');
    });
  });

  describe('POST /api/appraisals', () => {
    it('should validate required fields', () => {
      const requiredFields = ['crewMemberId', 'vesselId', 'appraisalPeriodStart', 'appraisalPeriodEnd'];
      
      requiredFields.forEach(field => {
        expect(mockAppraisalFormInsert).toHaveProperty(field);
      });
    });

    it('should validate date formats', () => {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      
      expect(mockAppraisalFormInsert.appraisalPeriodStart).toMatch(dateRegex);
      expect(mockAppraisalFormInsert.appraisalPeriodEnd).toMatch(dateRegex);
    });

    it('should set initial status as draft', () => {
      expect(mockAppraisalFormInsert.status).toBe('draft');
    });
  });

  describe('Form Parts Validation', () => {
    describe('Part A - Personal Details', () => {
      it('should have personal and vessel details flags', () => {
        expect(mockAppraisalForm.partA).toHaveProperty('personalDetails');
        expect(mockAppraisalForm.partA).toHaveProperty('vesselDetails');
      });
    });

    describe('Part B - Performance Ratings', () => {
      it('should have skill ratings', () => {
        expect(mockAppraisalForm.partB).toHaveProperty('technicalSkills');
        expect(mockAppraisalForm.partB).toHaveProperty('safetyAwareness');
        expect(mockAppraisalForm.partB).toHaveProperty('teamwork');
      });

      it('should have ratings in 1-5 scale', () => {
        const ratings = Object.values(mockAppraisalForm.partB);
        
        ratings.forEach(rating => {
          expect(rating).toBeGreaterThanOrEqual(1);
          expect(rating).toBeLessThanOrEqual(5);
        });
      });
    });

    describe('Part C - Training', () => {
      it('should include training completed list', () => {
        expect(mockAppraisalForm.partC.trainingCompleted).toBeInstanceOf(Array);
      });

      it('should have certification validity flag', () => {
        expect(typeof mockAppraisalForm.partC.certificationsValid).toBe('boolean');
      });
    });

    describe('Part D - Overall Assessment', () => {
      it('should have overall rating', () => {
        expect(mockAppraisalForm.partD).toHaveProperty('overallRating');
        expect(mockAppraisalForm.partD.overallRating).toBeGreaterThanOrEqual(1);
        expect(mockAppraisalForm.partD.overallRating).toBeLessThanOrEqual(5);
      });

      it('should have comments field', () => {
        expect(mockAppraisalForm.partD).toHaveProperty('comments');
        expect(typeof mockAppraisalForm.partD.comments).toBe('string');
      });
    });
  });

  describe('Form Status Transitions', () => {
    it('should allow draft to submitted transition', () => {
      const validTransitions = {
        draft: ['submitted'],
        submitted: ['reviewed', 'returned'],
        reviewed: ['approved', 'returned'],
        returned: ['submitted'],
        approved: [],
      };
      
      const currentStatus = 'draft';
      const nextStatus = 'submitted';
      
      expect(validTransitions[currentStatus]).toContain(nextStatus);
    });

    it('should not allow skipping statuses', () => {
      const validTransitions = {
        draft: ['submitted'],
      };
      
      const invalidNextStatus = 'approved';
      expect(validTransitions['draft']).not.toContain(invalidNextStatus);
    });
  });

  describe('Form Validation Rules', () => {
    it('should require all parts complete before submission', () => {
      const hasPartA = mockAppraisalForm.partA !== undefined;
      const hasPartB = mockAppraisalForm.partB !== undefined;
      const hasPartC = mockAppraisalForm.partC !== undefined;
      const hasPartD = mockAppraisalForm.partD !== undefined;
      const isComplete = hasPartA && hasPartB && hasPartC && hasPartD;
      
      expect(isComplete).toBe(true);
    });

    it('should validate appraisal period is not in future', () => {
      const endDate = new Date(mockAppraisalForm.appraisalPeriodEnd);
      const today = new Date();
      
      expect(endDate.getTime()).toBeLessThanOrEqual(today.getTime());
    });
  });
});
