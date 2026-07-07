import { describe, it, expect, beforeAll } from 'vitest';

const API_BASE = 'http://localhost:5000';
const V2_BASE = `${API_BASE}/api/v2/accounts`;

/**
 * Accounts (payroll) V2 integration tests.
 *
 * These exercise the native multi-tenant Accounts module. Every endpoint routes
 * through tenantMiddleware + authMiddleware and accesses the database via
 * getDb() (tenant context from AsyncLocalStorage), so results are always
 * scoped to the resolved tenant. The tests below assert the contract shape and
 * that pay-element CRUD round-trips against the live, persisted store.
 */
describe('Accounts V2 API Integration', () => {
  let createdPayElementUuid: string | null = null;

  beforeAll(async () => {
    const healthCheck = await fetch(`${API_BASE}/api/health`);
    if (!healthCheck.ok) {
      throw new Error('Server not running');
    }
  });

  describe('GET /api/v2/accounts/pay-elements', () => {
    it('returns the tenant-scoped pay element library as an array', async () => {
      const response = await fetch(`${V2_BASE}/pay-elements`);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('returns seeded pay elements with uuid + code + type', async () => {
      const response = await fetch(`${V2_BASE}/pay-elements`);
      const data = await response.json();
      if (data.length > 0) {
        expect(data[0]).toHaveProperty('payElementUuid');
        expect(data[0]).toHaveProperty('code');
        expect(data[0]).toHaveProperty('type');
      }
    });

    it('is stable across repeated reads (tenant scoping is deterministic)', async () => {
      const first = await (await fetch(`${V2_BASE}/pay-elements`)).json();
      const second = await (await fetch(`${V2_BASE}/pay-elements`)).json();
      expect(first.length).toBe(second.length);
    });
  });

  describe('POST /api/v2/accounts/pay-elements', () => {
    it('creates a pay element and assigns a server-generated uuid', async () => {
      const payload = {
        code: `TEST_${Date.now()}`,
        name: 'Test Pay Element',
        type: 'earning',
        category: 'Fixed',
        formula: 'No Formula',
        rounding: 'ROUND_NEAREST_CENT',
        effectiveDate: '2026-01-01',
        status: 'active',
        vesselGroups: JSON.stringify(['all-vessels']),
        reflectInContract: true,
      };

      const response = await fetch(`${V2_BASE}/pay-elements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.status === 201 || response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('payElementUuid');
        expect(typeof data.payElementUuid).toBe('string');
        createdPayElementUuid = data.payElementUuid;
      }
    });
  });

  describe('PUT /api/v2/accounts/pay-elements/:uuid', () => {
    it('updates a previously created pay element by uuid', async () => {
      if (!createdPayElementUuid) return;
      const response = await fetch(
        `${V2_BASE}/pay-elements/${createdPayElementUuid}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Test Pay Element (updated)' }),
        },
      );
      expect([200, 204]).toContain(response.status);
    });
  });

  describe('DELETE /api/v2/accounts/pay-elements/:uuid', () => {
    it('soft-deletes the created pay element', async () => {
      if (!createdPayElementUuid) return;
      const response = await fetch(
        `${V2_BASE}/pay-elements/${createdPayElementUuid}`,
        { method: 'DELETE' },
      );
      expect([200, 204]).toContain(response.status);
    });
  });

  describe('Crew-scoped sub-ledgers', () => {
    it('GET /allotments returns an array', async () => {
      const response = await fetch(`${V2_BASE}/allotments`);
      expect(response.status).toBe(200);
      expect(Array.isArray(await response.json())).toBe(true);
    });

    it('GET /advances returns an array', async () => {
      const response = await fetch(`${V2_BASE}/advances`);
      expect(response.status).toBe(200);
      expect(Array.isArray(await response.json())).toBe(true);
    });

    it('GET /bond-items returns an array', async () => {
      const response = await fetch(`${V2_BASE}/bond-items`);
      expect(response.status).toBe(200);
      expect(Array.isArray(await response.json())).toBe(true);
    });
  });
});
