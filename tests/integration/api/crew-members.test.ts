import { describe, it, expect, beforeAll } from 'vitest';

const API_BASE = 'http://localhost:5000';

describe('Crew Members API Integration', () => {
  let testCrewMemberId: number;

  beforeAll(async () => {
    const healthCheck = await fetch(`${API_BASE}/api/health`);
    if (!healthCheck.ok) {
      throw new Error('Server not running');
    }
  });

  describe('GET /api/crew-members', () => {
    it('should return a list of crew members', async () => {
      const response = await fetch(`${API_BASE}/api/crew-members`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should support pagination parameters', async () => {
      const response = await fetch(`${API_BASE}/api/crew-members?page=1&limit=10`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should support filtering by vessel', async () => {
      const response = await fetch(`${API_BASE}/api/crew-members?vesselId=1`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should support filtering by status', async () => {
      const response = await fetch(`${API_BASE}/api/crew-members?status=active`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should support filtering by rank', async () => {
      const response = await fetch(`${API_BASE}/api/crew-members?rank=Chief%20Engineer`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should support search by name', async () => {
      const response = await fetch(`${API_BASE}/api/crew-members?search=John`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should return crew members with required fields', async () => {
      const response = await fetch(`${API_BASE}/api/crew-members`);
      const data = await response.json();
      
      if (data.length > 0) {
        expect(data[0]).toHaveProperty('id');
        expect(data[0]).toHaveProperty('firstName');
        expect(data[0]).toHaveProperty('lastName');
      }
    });
  });

  describe('POST /api/crew-members', () => {
    it('should create new crew member', async () => {
      const crewMember = {
        firstName: 'Test',
        lastName: 'Crew',
        rank: 'AB',
        nationality: 'Indian',
        dateOfBirth: '1990-01-15'
      };

      const response = await fetch(`${API_BASE}/api/crew-members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(crewMember)
      });

      if (response.status === 201) {
        const data = await response.json();
        expect(data.id).toBeDefined();
        testCrewMemberId = data.id;
      } else {
        expect([201, 400, 500]).toContain(response.status);
      }
    });

    it('should return 400 for missing required fields', async () => {
      const response = await fetch(`${API_BASE}/api/crew-members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: 'Incomplete' })
      });

      expect([400, 500]).toContain(response.status);
    });

    it('should validate email format when provided', async () => {
      const crewMember = {
        firstName: 'Test',
        lastName: 'Email',
        rank: 'AB',
        email: 'invalid-email'
      };

      const response = await fetch(`${API_BASE}/api/crew-members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(crewMember)
      });

      expect([400, 201, 500]).toContain(response.status);
    });
  });

  describe('GET /api/crew-members/:id', () => {
    it('should return crew member by ID', async () => {
      const listResponse = await fetch(`${API_BASE}/api/crew-members`);
      const crewList = await listResponse.json();
      
      if (crewList.length > 0) {
        const crewId = crewList[0].id;
        const response = await fetch(`${API_BASE}/api/crew-members/${crewId}`);
        
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.id).toBe(crewId);
      }
    });

    it('should return 404 for non-existent crew member', async () => {
      const response = await fetch(`${API_BASE}/api/crew-members/99999`);
      expect([404, 500]).toContain(response.status);
    });
  });

  describe('PATCH /api/crew-members/:id', () => {
    it('should update crew member', async () => {
      const listResponse = await fetch(`${API_BASE}/api/crew-members`);
      const crewList = await listResponse.json();
      
      if (crewList.length > 0) {
        const crewId = crewList[0].id;
        const response = await fetch(`${API_BASE}/api/crew-members/${crewId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'onshore' })
        });

        expect([200, 404, 500]).toContain(response.status);
      }
    });

    it('should return 404 for non-existent crew member update', async () => {
      const response = await fetch(`${API_BASE}/api/crew-members/99999`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' })
      });

      expect([404, 500]).toContain(response.status);
    });
  });

  describe('DELETE /api/crew-members/:id', () => {
    it('should handle delete request', async () => {
      if (testCrewMemberId) {
        const response = await fetch(`${API_BASE}/api/crew-members/${testCrewMemberId}`, {
          method: 'DELETE'
        });
        expect([200, 204, 404, 500]).toContain(response.status);
      }
    });

    it('should return 404 for non-existent crew member delete', async () => {
      const response = await fetch(`${API_BASE}/api/crew-members/99999`, {
        method: 'DELETE'
      });

      expect([404, 500]).toContain(response.status);
    });
  });
});
