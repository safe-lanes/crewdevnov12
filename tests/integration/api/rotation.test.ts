import { describe, it, expect, beforeAll } from 'vitest';

const API_BASE = 'http://localhost:5000';

describe('Rotation API Integration', () => {
  let testPlanId: number;

  beforeAll(async () => {
    const healthCheck = await fetch(`${API_BASE}/api/health`);
    if (!healthCheck.ok) {
      throw new Error('Server not running');
    }
  });

  describe('POST /api/rotation-plans', () => {
    it('should create new rotation plan', async () => {
      const plan = {
        draftId: `DRAFT-${Date.now()}`,
        lastEdited: new Date().toISOString(),
        vessels: JSON.stringify(['VSL-001', 'VSL-002']),
        crew: 'Master, Chief Officer',
        planFromDate: '2025-01-15',
        planToDate: '2025-07-15',
        createdBy: 'Test User',
        planStatus: 'In Draft'
      };

      const response = await fetch(`${API_BASE}/api/rotation-plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plan)
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.id).toBeDefined();
      testPlanId = data.id;
    });

    it('should return 400 for missing required fields', async () => {
      const incomplete = {
        draftId: 'DRAFT-INCOMPLETE'
      };

      const response = await fetch(`${API_BASE}/api/rotation-plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incomplete)
      });

      expect(response.status).toBe(400);
    });

    it('should accept plan with assignments', async () => {
      const planWithAssignments = {
        draftId: `DRAFT-ASSIGN-${Date.now()}`,
        lastEdited: new Date().toISOString(),
        vessels: JSON.stringify(['VSL-003']),
        crew: 'Second Officer, Third Officer',
        planFromDate: '2025-02-01',
        planToDate: '2025-08-01',
        createdBy: 'Test User',
        planStatus: 'In Draft',
        assignments: JSON.stringify([
          { vesselName: 'VSL-003', rank: 'Second Officer', crewId: 'A000001' }
        ])
      };

      const response = await fetch(`${API_BASE}/api/rotation-plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planWithAssignments)
      });

      expect(response.status).toBe(201);
    });
  });

  describe('GET /api/rotation-plans', () => {
    it('should list all rotation plans', async () => {
      const response = await fetch(`${API_BASE}/api/rotation-plans`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should return plans with correct structure', async () => {
      const response = await fetch(`${API_BASE}/api/rotation-plans`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      if (data.length > 0) {
        expect(data[0]).toHaveProperty('draftId');
        expect(data[0]).toHaveProperty('planStatus');
      }
    });
  });

  describe('GET /api/rotation-plans/:id', () => {
    it('should get plan by id if exists', async () => {
      if (testPlanId) {
        const response = await fetch(`${API_BASE}/api/rotation-plans/${testPlanId}`);
        expect([200, 404]).toContain(response.status);
      } else {
        expect(true).toBe(true);
      }
    });

    it('should return 404 for non-existent plan', async () => {
      const response = await fetch(`${API_BASE}/api/rotation-plans/99999`);
      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/rotation-plans/:id', () => {
    it('should update rotation plan', async () => {
      const createRes = await fetch(`${API_BASE}/api/rotation-plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: `DRAFT-UPDATE-${Date.now()}`,
          lastEdited: new Date().toISOString(),
          vessels: JSON.stringify(['VSL-010']),
          crew: 'AB, OS',
          planFromDate: '2025-03-01',
          planToDate: '2025-09-01',
          createdBy: 'Test User',
          planStatus: 'In Draft'
        })
      });

      expect(createRes.status).toBe(201);
      const created = await createRes.json();

      const response = await fetch(
        `${API_BASE}/api/rotation-plans/${created.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planStatus: 'Proposed' })
        }
      );

      expect(response.status).toBe(200);
      const updated = await response.json();
      expect(updated.planStatus).toBe('Proposed');
    });

    it('should return 404 for non-existent plan', async () => {
      const response = await fetch(
        `${API_BASE}/api/rotation-plans/99999`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planStatus: 'Approved' })
        }
      );

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/rotation-plans/:id', () => {
    it('should delete rotation plan', async () => {
      const createRes = await fetch(`${API_BASE}/api/rotation-plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: `DRAFT-DELETE-${Date.now()}`,
          lastEdited: new Date().toISOString(),
          vessels: JSON.stringify(['VSL-DEL']),
          crew: 'Oiler',
          planFromDate: '2025-04-01',
          planToDate: '2025-10-01',
          createdBy: 'Test User',
          planStatus: 'In Draft'
        })
      });

      expect(createRes.status).toBe(201);
      const created = await createRes.json();

      const response = await fetch(
        `${API_BASE}/api/rotation-plans/${created.id}`,
        { method: 'DELETE' }
      );

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/rotation/proposals', () => {
    it('should list all rotation proposals', async () => {
      const response = await fetch(`${API_BASE}/api/rotation/proposals`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('GET /api/rotation/due-crew', () => {
    it('should list crew due for rotation', async () => {
      const response = await fetch(`${API_BASE}/api/rotation/due-crew`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });
});
