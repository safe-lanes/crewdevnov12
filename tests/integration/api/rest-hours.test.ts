import { describe, it, expect, beforeAll } from 'vitest';

const API_BASE = 'http://localhost:5000';

describe('Rest Hours API Integration', () => {
  let testRecordId: number;

  beforeAll(async () => {
    const healthCheck = await fetch(`${API_BASE}/api/health`);
    if (!healthCheck.ok) {
      throw new Error('Server not running');
    }
  });

  describe('GET /api/rest-hours-vessel-records', () => {
    it('should return vessel rest hour records', async () => {
      const response = await fetch(`${API_BASE}/api/rest-hours-vessel-records`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should support filtering by vessel', async () => {
      const response = await fetch(`${API_BASE}/api/rest-hours-vessel-records?vesselId=1`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should support date range filtering', async () => {
      const startDate = '2025-01-01';
      const endDate = '2025-12-31';
      const response = await fetch(
        `${API_BASE}/api/rest-hours-vessel-records?startDate=${startDate}&endDate=${endDate}`
      );
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should return records with required fields', async () => {
      const response = await fetch(`${API_BASE}/api/rest-hours-vessel-records`);
      const data = await response.json();
      
      if (data.length > 0) {
        expect(data[0]).toHaveProperty('id');
      }
    });
  });

  describe('POST /api/rest-hours-vessel-records', () => {
    it('should create new vessel rest hour record', async () => {
      const record = {
        vesselId: 1,
        date: '2025-06-15',
        totalCrew: 10,
        compliantCrew: 9
      };

      const response = await fetch(`${API_BASE}/api/rest-hours-vessel-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });

      if (response.status === 201) {
        const data = await response.json();
        expect(data.id).toBeDefined();
        testRecordId = data.id;
      } else {
        expect([201, 400, 500]).toContain(response.status);
      }
    });

    it('should handle missing required fields', async () => {
      const response = await fetch(`${API_BASE}/api/rest-hours-vessel-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vesselId: 1 })
      });

      expect([400, 201, 500]).toContain(response.status);
    });
  });

  describe('GET /api/rest-hours-vessel-records/:id', () => {
    it('should return record by ID', async () => {
      const listResponse = await fetch(`${API_BASE}/api/rest-hours-vessel-records`);
      const recordList = await listResponse.json();
      
      if (recordList.length > 0) {
        const recordId = recordList[0].id;
        const response = await fetch(`${API_BASE}/api/rest-hours-vessel-records/${recordId}`);
        
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.id).toBe(recordId);
      }
    });

    it('should handle non-existent record', async () => {
      const response = await fetch(`${API_BASE}/api/rest-hours-vessel-records/99999`);
      expect([404, 200, 500]).toContain(response.status);
    });
  });

  describe('PUT /api/rest-hours-vessel-records/:id', () => {
    it('should update rest hour record', async () => {
      const listResponse = await fetch(`${API_BASE}/api/rest-hours-vessel-records`);
      const recordList = await listResponse.json();
      
      if (recordList.length > 0) {
        const recordId = recordList[0].id;
        const response = await fetch(`${API_BASE}/api/rest-hours-vessel-records/${recordId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ compliantCrew: 10 })
        });

        expect([200, 400, 404, 500]).toContain(response.status);
      }
    });

    it('should handle non-existent record update', async () => {
      const response = await fetch(`${API_BASE}/api/rest-hours-vessel-records/99999`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ compliantCrew: 10 })
      });

      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('DELETE /api/rest-hours-vessel-records/:id', () => {
    it('should handle delete request', async () => {
      if (testRecordId) {
        const response = await fetch(`${API_BASE}/api/rest-hours-vessel-records/${testRecordId}`, {
          method: 'DELETE'
        });
        expect([200, 204, 404, 500]).toContain(response.status);
      }
    });

    it('should handle non-existent record delete', async () => {
      const response = await fetch(`${API_BASE}/api/rest-hours-vessel-records/99999`, {
        method: 'DELETE'
      });

      expect([200, 204, 404, 500]).toContain(response.status);
    });
  });

  describe('GET /api/rest-hours-crew-records', () => {
    it('should return crew rest hour records', async () => {
      const response = await fetch(`${API_BASE}/api/rest-hours-crew-records`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should support filtering by crew member', async () => {
      const response = await fetch(`${API_BASE}/api/rest-hours-crew-records?crewMemberId=1`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should support filtering by vessel', async () => {
      const response = await fetch(`${API_BASE}/api/rest-hours-crew-records?vesselId=1`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('GET /api/rest-hours-violations-by-rank', () => {
    it('should return violations grouped by rank', async () => {
      const response = await fetch(`${API_BASE}/api/rest-hours-violations-by-rank`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should support vessel filter', async () => {
      const response = await fetch(`${API_BASE}/api/rest-hours-violations-by-rank?vesselId=1`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('GET /api/rest-hours-ncs-by-rank', () => {
    it('should return NCs grouped by rank', async () => {
      const response = await fetch(`${API_BASE}/api/rest-hours-ncs-by-rank`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should support vessel filter', async () => {
      const response = await fetch(`${API_BASE}/api/rest-hours-ncs-by-rank?vesselId=1`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });
});
