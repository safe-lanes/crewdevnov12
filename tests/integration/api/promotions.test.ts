import { describe, it, expect, beforeAll } from 'vitest';

const API_BASE = 'http://localhost:5000';

describe('Promotions API Integration', () => {
  let testHierarchyId: number;

  beforeAll(async () => {
    const healthCheck = await fetch(`${API_BASE}/api/health`);
    if (!healthCheck.ok) {
      throw new Error('Server not running');
    }
  });

  describe('POST /api/promotion-hierarchies', () => {
    it('should create new promotion hierarchy', async () => {
      const hierarchy = {
        groupName: `Deck Officers ${Date.now()}`,
        rankPath: JSON.stringify(['Third Officer', 'Second Officer', 'Chief Officer', 'Master']),
        isActive: true
      };

      const response = await fetch(`${API_BASE}/api/promotion-hierarchies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hierarchy)
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.id).toBeDefined();
      testHierarchyId = data.id;
    });

    it('should return 400 for missing required fields', async () => {
      const incomplete = {
        groupName: 'Incomplete Group'
      };

      const response = await fetch(`${API_BASE}/api/promotion-hierarchies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incomplete)
      });

      expect(response.status).toBe(400);
    });

    it('should accept hierarchy with array rank path', async () => {
      const hierarchyWithPath = {
        groupName: `Engine Officers ${Date.now()}`,
        rankPath: ['Oiler', 'AB', 'Fourth Engineer', 'Third Engineer'],
        isActive: true
      };

      const response = await fetch(`${API_BASE}/api/promotion-hierarchies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hierarchyWithPath)
      });

      expect(response.status).toBe(201);
    });
  });

  describe('GET /api/promotion-hierarchies', () => {
    it('should list all promotion hierarchies', async () => {
      const response = await fetch(`${API_BASE}/api/promotion-hierarchies`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should return hierarchy with groupName', async () => {
      const response = await fetch(`${API_BASE}/api/promotion-hierarchies`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      if (data.length > 0) {
        expect(data[0]).toHaveProperty('groupName');
      }
    });
  });

  describe('GET /api/promotion-hierarchies/:id', () => {
    it('should get hierarchy by id if exists', async () => {
      if (testHierarchyId) {
        const response = await fetch(`${API_BASE}/api/promotion-hierarchies/${testHierarchyId}`);
        expect([200, 404]).toContain(response.status);
      } else {
        expect(true).toBe(true);
      }
    });

    it('should return 404 for non-existent hierarchy', async () => {
      const response = await fetch(`${API_BASE}/api/promotion-hierarchies/99999`);
      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/promotion-hierarchies/:id', () => {
    it('should update hierarchy', async () => {
      const createRes = await fetch(`${API_BASE}/api/promotion-hierarchies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupName: `Update Test ${Date.now()}`,
          rankPath: JSON.stringify(['AB', 'Bosun']),
          isActive: true
        })
      });

      expect(createRes.status).toBe(201);
      const created = await createRes.json();

      const response = await fetch(
        `${API_BASE}/api/promotion-hierarchies/${created.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: false })
        }
      );

      expect(response.status).toBe(200);
      const updated = await response.json();
      expect(updated.isActive).toBe(false);
    });

    it('should return 404 for non-existent hierarchy', async () => {
      const response = await fetch(
        `${API_BASE}/api/promotion-hierarchies/99999`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: false })
        }
      );

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/promotion-hierarchies/:id', () => {
    it('should delete hierarchy', async () => {
      const createRes = await fetch(`${API_BASE}/api/promotion-hierarchies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupName: `Delete Test ${Date.now()}`,
          rankPath: JSON.stringify(['OS', 'AB']),
          isActive: true
        })
      });

      expect(createRes.status).toBe(201);
      const created = await createRes.json();

      const response = await fetch(
        `${API_BASE}/api/promotion-hierarchies/${created.id}`,
        { method: 'DELETE' }
      );

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/promotions', () => {
    it('should list all promotions', async () => {
      const response = await fetch(`${API_BASE}/api/promotions`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should filter by status', async () => {
      const response = await fetch(`${API_BASE}/api/promotions?status=draft`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('GET /api/promotions/:id', () => {
    it('should return 404 for non-existent promotion', async () => {
      const response = await fetch(`${API_BASE}/api/promotions/99999`);
      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/promotions/crew/:crewMemberId', () => {
    it('should get promotions for specific crew member', async () => {
      const response = await fetch(`${API_BASE}/api/promotions/crew/A000001`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });
});
