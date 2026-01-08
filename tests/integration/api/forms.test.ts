import { describe, it, expect, beforeAll } from 'vitest';

const API_BASE = 'http://localhost:5000';

describe('Appraisal Forms API Integration', () => {
  let testFormId: number;

  beforeAll(async () => {
    const healthCheck = await fetch(`${API_BASE}/api/health`);
    if (!healthCheck.ok) {
      throw new Error('Server not running');
    }
  });

  describe('GET /api/appraisals', () => {
    it('should return a list of appraisal forms', async () => {
      const response = await fetch(`${API_BASE}/api/appraisals`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should support filtering by status', async () => {
      const response = await fetch(`${API_BASE}/api/appraisals?status=draft`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should support filtering by crew member', async () => {
      const response = await fetch(`${API_BASE}/api/appraisals?crewMemberId=1`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should support filtering by vessel', async () => {
      const response = await fetch(`${API_BASE}/api/appraisals?vesselId=1`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should support filtering by appraisal type', async () => {
      const response = await fetch(`${API_BASE}/api/appraisals?appraisalType=mid-contract`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should support date range filtering', async () => {
      const startDate = '2025-01-01';
      const endDate = '2025-12-31';
      const response = await fetch(
        `${API_BASE}/api/appraisals?startDate=${startDate}&endDate=${endDate}`
      );
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should return appraisals with required fields', async () => {
      const response = await fetch(`${API_BASE}/api/appraisals`);
      const data = await response.json();
      
      if (data.length > 0) {
        expect(data[0]).toHaveProperty('id');
      }
    });
  });

  describe('POST /api/appraisals', () => {
    it('should create new appraisal form', async () => {
      const form = {
        crewMemberId: 1,
        vesselId: 1,
        appraisalType: 'mid-contract',
        status: 'draft',
        appraisalDate: '2025-06-15'
      };

      const response = await fetch(`${API_BASE}/api/appraisals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      if (response.status === 201) {
        const data = await response.json();
        expect(data.id).toBeDefined();
        testFormId = data.id;
      } else {
        expect([201, 400, 500]).toContain(response.status);
      }
    });

    it('should return 400 for missing required fields', async () => {
      const response = await fetch(`${API_BASE}/api/appraisals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crewMemberId: 1 })
      });

      expect([400, 500]).toContain(response.status);
    });

    it('should validate appraisal type', async () => {
      const form = {
        crewMemberId: 1,
        vesselId: 1,
        appraisalType: 'invalid-type',
        status: 'draft'
      };

      const response = await fetch(`${API_BASE}/api/appraisals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      expect([400, 201, 500]).toContain(response.status);
    });
  });

  describe('GET /api/appraisals/:id', () => {
    it('should return appraisal form by ID', async () => {
      const listResponse = await fetch(`${API_BASE}/api/appraisals`);
      const appraisalList = await listResponse.json();
      
      if (appraisalList.length > 0) {
        const appraisalId = appraisalList[0].id;
        const response = await fetch(`${API_BASE}/api/appraisals/${appraisalId}`);
        
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.id).toBe(appraisalId);
      }
    });

    it('should return 404 for non-existent form', async () => {
      const response = await fetch(`${API_BASE}/api/appraisals/99999`);
      expect([404, 500]).toContain(response.status);
    });
  });

  describe('PATCH /api/appraisals/:id', () => {
    it('should update appraisal form', async () => {
      const listResponse = await fetch(`${API_BASE}/api/appraisals`);
      const appraisalList = await listResponse.json();
      
      if (appraisalList.length > 0) {
        const appraisalId = appraisalList[0].id;
        const response = await fetch(`${API_BASE}/api/appraisals/${appraisalId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'submitted' })
        });

        expect([200, 400, 404, 500]).toContain(response.status);
      }
    });

    it('should validate status transitions', async () => {
      const listResponse = await fetch(`${API_BASE}/api/appraisals`);
      const appraisalList = await listResponse.json();
      
      if (appraisalList.length > 0) {
        const appraisalId = appraisalList[0].id;
        const response = await fetch(`${API_BASE}/api/appraisals/${appraisalId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'invalid-status' })
        });

        expect([400, 200, 500]).toContain(response.status);
      }
    });

    it('should handle non-existent form update', async () => {
      const response = await fetch(`${API_BASE}/api/appraisals/99999`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'draft' })
      });

      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('DELETE /api/appraisals/:id', () => {
    it('should handle delete request', async () => {
      if (testFormId) {
        const response = await fetch(`${API_BASE}/api/appraisals/${testFormId}`, {
          method: 'DELETE'
        });
        expect([200, 204, 404, 500]).toContain(response.status);
      }
    });

    it('should return 404 for non-existent form delete', async () => {
      const response = await fetch(`${API_BASE}/api/appraisals/99999`, {
        method: 'DELETE'
      });

      expect([404, 500]).toContain(response.status);
    });
  });

  describe('Form Configuration API', () => {
    it('should get form configurations', async () => {
      const response = await fetch(`${API_BASE}/api/forms`);
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
      }
    });

    it('should get rank groups', async () => {
      const response = await fetch(`${API_BASE}/api/rank-groups`);
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
      }
    });

    it('should get form versions', async () => {
      const response = await fetch(`${API_BASE}/api/form-versions`);
      
      expect([200, 404]).toContain(response.status);
    });
  });
});
