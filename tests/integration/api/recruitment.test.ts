import { describe, it, expect, beforeAll } from 'vitest';

const API_BASE = 'http://localhost:5000';

describe('Recruitment API Integration', () => {
  let testCandidateId: string;

  beforeAll(async () => {
    const healthCheck = await fetch(`${API_BASE}/api/health`);
    if (!healthCheck.ok) {
      throw new Error('Server not running');
    }
  });

  describe('POST /api/recruitment-candidates', () => {
    it('should create new recruitment candidate', async () => {
      const candidateId = `TEST-${Date.now()}`;
      const candidate = {
        id: candidateId,
        firstName: 'John',
        familyName: 'Doe',
        dob: '1990-05-15',
        nationality: 'Indian',
        rankAppliedFor: 'Chief Engineer',
        presentRank: 'Second Engineer',
        vesselType: 'Tanker',
        status: 'Draft'
      };

      const response = await fetch(`${API_BASE}/api/recruitment-candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(candidate)
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.id).toBeDefined();
      expect(data.firstName).toBe('John');
      testCandidateId = data.id;
    });

    it('should return 400 for missing required fields', async () => {
      const incomplete = {
        firstName: 'John'
      };

      const response = await fetch(`${API_BASE}/api/recruitment-candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incomplete)
      });

      expect(response.status).toBe(400);
    });

    it('should accept candidate with all required fields', async () => {
      const candidateId = `TEST2-${Date.now()}`;
      const minimal = {
        id: candidateId,
        firstName: 'Jane',
        familyName: 'Smith',
        dob: '1985-03-20',
        nationality: 'Filipino',
        rankAppliedFor: 'AB',
        presentRank: 'OS',
        vesselType: 'Bulk Carrier',
        status: 'Draft'
      };

      const response = await fetch(`${API_BASE}/api/recruitment-candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(minimal)
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.firstName).toBe('Jane');
    });
  });

  describe('GET /api/recruitment-candidates', () => {
    it('should list all recruitment candidates', async () => {
      const response = await fetch(`${API_BASE}/api/recruitment-candidates`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should filter by status', async () => {
      const response = await fetch(
        `${API_BASE}/api/recruitment-candidates?status=Draft`
      );
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should filter by rank', async () => {
      const response = await fetch(
        `${API_BASE}/api/recruitment-candidates?rank=Chief%20Engineer`
      );
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should search by name', async () => {
      const response = await fetch(
        `${API_BASE}/api/recruitment-candidates?search=John`
      );
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('GET /api/recruitment-candidates/:id', () => {
    it('should get candidate by id', async () => {
      const candidateId = `GETTEST-${Date.now()}`;
      const createRes = await fetch(`${API_BASE}/api/recruitment-candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: candidateId,
          firstName: 'GetTest',
          familyName: 'User',
          dob: '1988-07-10',
          nationality: 'Indian',
          rankAppliedFor: 'AB',
          presentRank: 'OS',
          vesselType: 'Container',
          status: 'Draft'
        })
      });
      expect(createRes.status).toBe(201);
      const created = await createRes.json();

      const response = await fetch(`${API_BASE}/api/recruitment-candidates/${created.id}`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.firstName).toBe('GetTest');
    });

    it('should return 404 for non-existent candidate', async () => {
      const response = await fetch(`${API_BASE}/api/recruitment-candidates/NONEXISTENT-999`);
      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/recruitment-candidates/:id', () => {
    it('should update candidate status', async () => {
      const candidateId = `UPDATETEST-${Date.now()}`;
      const createRes = await fetch(`${API_BASE}/api/recruitment-candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: candidateId,
          firstName: 'Update',
          familyName: 'Test',
          dob: '1992-01-15',
          nationality: 'Indian',
          rankAppliedFor: 'AB',
          presentRank: 'OS',
          vesselType: 'Tanker',
          status: 'Draft'
        })
      });
      expect(createRes.status).toBe(201);
      const created = await createRes.json();

      const response = await fetch(
        `${API_BASE}/api/recruitment-candidates/${created.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'Applied' })
        }
      );

      expect(response.status).toBe(200);
      const updated = await response.json();
      expect(updated.status).toBe('Applied');
    });

    it('should allow partial updates', async () => {
      const candidateId = `PARTIAL-${Date.now()}`;
      const createRes = await fetch(`${API_BASE}/api/recruitment-candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: candidateId,
          firstName: 'Partial',
          familyName: 'Update',
          dob: '1991-06-20',
          nationality: 'Filipino',
          rankAppliedFor: 'OS',
          presentRank: 'Wiper',
          vesselType: 'LNG',
          status: 'Draft'
        })
      });
      expect(createRes.status).toBe(201);
      const created = await createRes.json();

      const response = await fetch(
        `${API_BASE}/api/recruitment-candidates/${created.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ middleName: 'Michael' })
        }
      );

      expect(response.status).toBe(200);
      const updated = await response.json();
      expect(updated.middleName).toBe('Michael');
    });

    it('should return 404 for non-existent candidate', async () => {
      const response = await fetch(
        `${API_BASE}/api/recruitment-candidates/NONEXISTENT-999`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'Applied' })
        }
      );

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/recruitment-candidates/:id/soft-delete', () => {
    it('should soft delete candidate', async () => {
      const candidateId = `SOFTDEL-${Date.now()}`;
      const createRes = await fetch(`${API_BASE}/api/recruitment-candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: candidateId,
          firstName: 'SoftDelete',
          familyName: 'Test',
          dob: '1993-04-12',
          nationality: 'Indonesian',
          rankAppliedFor: 'Oiler',
          presentRank: 'Wiper',
          vesselType: 'Chemical',
          status: 'Draft'
        })
      });
      expect(createRes.status).toBe(201);
      const created = await createRes.json();

      const response = await fetch(
        `${API_BASE}/api/recruitment-candidates/${created.id}/soft-delete`,
        { method: 'PATCH' }
      );

      expect([200, 204]).toContain(response.status);
    });
  });

  describe('DELETE /api/recruitment-candidates/:id', () => {
    it('should delete candidate', async () => {
      const candidateId = `DELETE-${Date.now()}`;
      const createRes = await fetch(`${API_BASE}/api/recruitment-candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: candidateId,
          firstName: 'Delete',
          familyName: 'Me',
          dob: '1994-08-25',
          nationality: 'Indian',
          rankAppliedFor: 'AB',
          presentRank: 'OS',
          vesselType: 'Tanker',
          status: 'Rejected'
        })
      });
      expect(createRes.status).toBe(201);
      const candidate = await createRes.json();

      const response = await fetch(
        `${API_BASE}/api/recruitment-candidates/${candidate.id}`,
        { method: 'DELETE' }
      );

      expect(response.status).toBe(200);
    });

    it('should handle delete for non-existent candidate', async () => {
      const response = await fetch(
        `${API_BASE}/api/recruitment-candidates/NONEXISTENT-DELETE`,
        { method: 'DELETE' }
      );

      expect([200, 404]).toContain(response.status);
    });
  });

  describe('GET /api/recruitment-candidates/next-file-number', () => {
    it('should get next file number', async () => {
      const response = await fetch(`${API_BASE}/api/recruitment-candidates/next-file-number`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(typeof data).toBe('object');
    });
  });
});
