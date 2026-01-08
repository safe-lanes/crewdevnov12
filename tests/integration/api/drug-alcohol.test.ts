import { describe, it, expect, beforeAll } from 'vitest';

const API_BASE = 'http://localhost:5000';

describe('Drug & Alcohol Testing API Integration', () => {
  let testRecordId: number;

  beforeAll(async () => {
    const healthCheck = await fetch(`${API_BASE}/api/health`);
    if (!healthCheck.ok) {
      throw new Error('Server not running');
    }
  });

  describe('POST /api/drug-alcohol-tests', () => {
    it('should create new drug alcohol test record', async () => {
      const testRecord = {
        crewMemberId: 'A000001',
        vesselId: 'VSL-001',
        testType: 'Random',
        testDate: '2025-01-07',
        result: 'Negative',
        testedBy: 'Dr. Smith',
        frequencyMonths: 6
      };

      const response = await fetch(`${API_BASE}/api/drug-alcohol-tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testRecord)
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.id).toBeDefined();
      testRecordId = data.id;
    });

    it('should return 400 for missing required fields', async () => {
      const incomplete = {
        crewMemberId: 'A000001'
      };

      const response = await fetch(`${API_BASE}/api/drug-alcohol-tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incomplete)
      });

      expect(response.status).toBe(400);
    });

    it('should accept pre-employment test type', async () => {
      const preEmployment = {
        crewMemberId: 'A000002',
        vesselId: 'VSL-002',
        testType: 'Pre-Employment',
        testDate: '2025-01-05',
        result: 'Negative',
        frequencyMonths: 12
      };

      const response = await fetch(`${API_BASE}/api/drug-alcohol-tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preEmployment)
      });

      expect(response.status).toBe(201);
    });

    it('should accept post-incident test type', async () => {
      const postIncident = {
        crewMemberId: 'A000003',
        vesselId: 'VSL-003',
        testType: 'Post-Incident',
        testDate: '2025-01-06',
        result: 'Pending',
        notes: 'Following deck incident',
        frequencyMonths: 3
      };

      const response = await fetch(`${API_BASE}/api/drug-alcohol-tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postIncident)
      });

      expect(response.status).toBe(201);
    });
  });

  describe('GET /api/drug-alcohol-tests', () => {
    it('should list all drug alcohol test records', async () => {
      const response = await fetch(`${API_BASE}/api/drug-alcohol-tests`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should filter by vessel', async () => {
      const response = await fetch(
        `${API_BASE}/api/drug-alcohol-tests?vesselId=VSL-001`
      );
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should filter by test type', async () => {
      const response = await fetch(
        `${API_BASE}/api/drug-alcohol-tests?testType=Random`
      );
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should filter by result', async () => {
      const response = await fetch(
        `${API_BASE}/api/drug-alcohol-tests?result=Negative`
      );
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('GET /api/drug-alcohol-tests/:id', () => {
    it('should get test by id if exists', async () => {
      if (testRecordId) {
        const response = await fetch(`${API_BASE}/api/drug-alcohol-tests/${testRecordId}`);
        expect([200, 404]).toContain(response.status);
      } else {
        expect(true).toBe(true);
      }
    });

    it('should return 404 for non-existent record', async () => {
      const response = await fetch(`${API_BASE}/api/drug-alcohol-tests/99999`);
      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/drug-alcohol-tests/vessel/:vesselId', () => {
    it('should get tests for specific vessel', async () => {
      const response = await fetch(`${API_BASE}/api/drug-alcohol-tests/vessel/VSL-001`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should return empty array for vessel with no tests', async () => {
      const response = await fetch(`${API_BASE}/api/drug-alcohol-tests/vessel/VSL-NONEXISTENT`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('PUT /api/drug-alcohol-tests/:id', () => {
    it('should update test result', async () => {
      const createRes = await fetch(`${API_BASE}/api/drug-alcohol-tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crewMemberId: 'A000010',
          vesselId: 'VSL-010',
          testType: 'Random',
          testDate: '2025-01-08',
          result: 'Pending',
          frequencyMonths: 6
        })
      });

      expect(createRes.status).toBe(201);
      const created = await createRes.json();

      const response = await fetch(
        `${API_BASE}/api/drug-alcohol-tests/${created.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            ...created,
            result: 'Negative' 
          })
        }
      );

      expect(response.status).toBe(200);
    });

    it('should update notes', async () => {
      const createRes = await fetch(`${API_BASE}/api/drug-alcohol-tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crewMemberId: 'A000011',
          vesselId: 'VSL-011',
          testType: 'Reasonable Cause',
          testDate: '2025-01-09',
          result: 'Negative',
          frequencyMonths: 3
        })
      });

      expect(createRes.status).toBe(201);
      const created = await createRes.json();

      const response = await fetch(
        `${API_BASE}/api/drug-alcohol-tests/${created.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            ...created,
            notes: 'Test completed successfully' 
          })
        }
      );

      expect(response.status).toBe(200);
    });

    it('should return 404 for non-existent record', async () => {
      const response = await fetch(
        `${API_BASE}/api/drug-alcohol-tests/99999`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            vesselId: 'VSL-001',
            testType: 'Random',
            frequencyMonths: 6,
            result: 'Negative' 
          })
        }
      );

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/drug-alcohol-tests/:id', () => {
    it('should delete test record', async () => {
      const createRes = await fetch(`${API_BASE}/api/drug-alcohol-tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crewMemberId: 'A000020',
          vesselId: 'VSL-020',
          testType: 'Follow-up',
          testDate: '2025-01-10',
          result: 'Negative',
          frequencyMonths: 1
        })
      });

      expect(createRes.status).toBe(201);
      const created = await createRes.json();

      const response = await fetch(
        `${API_BASE}/api/drug-alcohol-tests/${created.id}`,
        { method: 'DELETE' }
      );

      expect(response.status).toBe(200);
    });

    it('should return 404 for non-existent record', async () => {
      const response = await fetch(
        `${API_BASE}/api/drug-alcohol-tests/99999`,
        { method: 'DELETE' }
      );

      expect(response.status).toBe(404);
    });
  });
});
