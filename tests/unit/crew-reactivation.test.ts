import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { PgDialect } from 'drizzle-orm/pg-core';

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  resolveRole: vi.fn(),
  permissions: vi.fn(),
  list: vi.fn(),
  vessels: vi.fn(),
  otherHandler: vi.fn((_req, res) => res.json({ otherRoute: true })),
}));

// Every database boundary and unrelated controller is replaced. These tests
// exercise the real router, attachment guards and reactivation controller.
vi.mock('@server/v2/db', () => ({ getDb: mocks.getDb }));
vi.mock('@server/v2/auth/roleResolutionService', () => ({ resolveRequestRole: mocks.resolveRole }));
vi.mock('@server/v2/company-forms/trustedPrincipalService', () => ({ resolveTrustedVesselScope: mocks.vessels }));
vi.mock('@server/v2/admin/services/accessControlService', () => ({
  accessControlService: { getMyPermissions: mocks.permissions },
}));
vi.mock('@server/v2/crew-pool/services/crewMembersService', () => ({
  crewMembersService: { getTerminated: mocks.list },
}));
vi.mock('@server/v2/crew-pool/controllers', () => {
  const controller = new Proxy({}, { get: () => mocks.otherHandler });
  return Object.fromEntries([
    'crewMembersController', 'crewAssignmentsController', 'crewPersonalController',
    'crewVesselTypesController', 'crewFamilyController', 'crewDocumentsController',
    'crewVisasController', 'crewEducationController', 'crewLicensesController',
    'crewTrainingController', 'crewSeaServiceController', 'crewMedicalController',
    'crewBriefingController', 'crewTransferController', 'dashboardController',
    'crewImportController', 'attachmentConverterController',
  ].map(name => [name, controller]));
});

import crewRoutes from '@server/v2/crew-pool/routes';

const role = {
  roleId: 'trusted-role-uuid', roleName: 'Crewing Officer', roleType: 'Office',
  masterUserId: 501, masterUserType: 'Office',
};
const dialect = new PgDialect();
let db: { execute: ReturnType<typeof vi.fn>; select: ReturnType<typeof vi.fn>; transaction: ReturnType<typeof vi.fn> };

function app(authenticated = true) {
  const server = express();
  server.use(express.json());
  if (authenticated) server.use((req, _res, next) => {
    req.user = { id: 501, userType: 'Office' } as typeof req.user;
    next();
  });
  server.use('/api/v2/crew-pool', crewRoutes);
  return server;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolveRole.mockResolvedValue({ ok: true, role });
  mocks.permissions.mockResolvedValue({ permissions: [{ menuName: 'Terminated', canview: true, canedit: true }] });
  mocks.vessels.mockResolvedValue(['own-vessel']);
  mocks.list.mockResolvedValue([{ crewUuid: 'own-crew', firstName: 'Synthetic' }]);
  db = {
    execute: vi.fn(async (query) => ({
      rows: dialect.sqlToQuery(query).params.includes('forbidden-crew') ? [] : [{ canview: true }],
    })),
    select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: async () => [{
      id: 501, userUuid: 'actor-uuid', fullname: 'Trusted Actor',
    }] }) }) })),
    transaction: vi.fn(),
  };
  mocks.getDb.mockReturnValue(db);
});

afterEach(() => vi.unstubAllEnvs());

describe('crew reactivation merge integration', () => {
  it('reaches the static list route with trusted role permissions and redacts attachment JSON', async () => {
    mocks.list.mockResolvedValue([{ crewUuid: 'own-crew', attachments: [{ fileName: 'a.pdf', fileData: 'secret', filePath: '/private/a.pdf' }] }]);

    const response = await request(app()).get('/api/v2/crew-pool/crew/reactivated');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: [{ crewUuid: 'own-crew', attachments: [{ fileName: 'a.pdf' }] }] });
    expect(mocks.permissions).toHaveBeenCalledWith('trusted-role-uuid', 'Crewing Officer', 'Office');
    expect(mocks.list).toHaveBeenCalledWith(true);
    expect(mocks.otherHandler).not.toHaveBeenCalled();
  });

  it('keeps aggregate vessel scoping on the reactivated list', async () => {
    mocks.resolveRole.mockResolvedValue({ ok: true, role: { ...role, roleType: 'Ship', masterUserType: 'Ship' } });
    mocks.list.mockResolvedValue([{ crewUuid: 'own-crew' }, { crewUuid: 'forbidden-crew' }]);

    const response = await request(app()).get('/api/v2/crew-pool/crew/reactivated');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: [{ crewUuid: 'own-crew' }] });
    expect(mocks.vessels).toHaveBeenCalledWith(501);
  });

  it('retains Crew Database authorization on the new collection and existing crew routes', async () => {
    db.execute.mockResolvedValue({ rows: [{ canview: false }] });
    const list = await request(app()).get('/api/v2/crew-pool/crew/reactivated');
    const crew = await request(app()).get('/api/v2/crew-pool/crew/own-crew');

    expect(list.status).toBe(403);
    expect(crew.status).toBe(403);
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.otherHandler).not.toHaveBeenCalled();
  });

  it('denies listing without the Terminated view permission', async () => {
    mocks.permissions.mockResolvedValue({ permissions: [{ menuName: 'Terminated', canview: false, canedit: true }] });
    const response = await request(app()).get('/api/v2/crew-pool/crew/reactivated');
    expect(response.status).toBe(403);
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated mutation even with the old development bypass enabled', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('AUTH_BYPASS', 'true');
    vi.stubEnv('JWT_SECRET', '');
    const response = await request(app(false)).post('/api/v2/crew-pool/crew/own-crew/reactivate').send({ isActive: true });
    expect(response.status).toBe(401);
    expect(mocks.permissions).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('fails closed when the authenticated identity cannot resolve to a trusted role', async () => {
    mocks.resolveRole.mockResolvedValue({ ok: false, reason: 'identity_mismatch' });
    const response = await request(app()).post('/api/v2/crew-pool/crew/own-crew/reactivate?roleId=admin').send({ isActive: true });
    expect(response.status).toBe(403);
    expect(mocks.permissions).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('requires edit permission before starting a reactivation transaction', async () => {
    mocks.permissions.mockResolvedValue({ permissions: [{ menuName: 'Terminated', canview: true, canedit: false }] });
    const response = await request(app()).post('/api/v2/crew-pool/crew/own-crew/reactivate').send({ isActive: true });
    expect(response.status).toBe(403);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('reactivates and records the trusted actor within one transaction', async () => {
    const updated = { crewUuid: 'own-crew', status: 'On Leave' };
    const set = vi.fn(() => ({ where: () => ({ returning: async () => [updated] }) }));
    const values = vi.fn(async () => undefined);
    const transaction = {
      select: () => ({ from: () => ({ where: () => ({ for: async () => [{ crewUuid: 'own-crew', status: 'Terminated' }] }) }) }),
      update: () => ({ set }),
      insert: () => ({ values }),
    };
    db.transaction.mockImplementation(async callback => callback(transaction));

    const response = await request(app()).post('/api/v2/crew-pool/crew/own-crew/reactivate').send({ isActive: true, reason: ' Eligible again ' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ crew: updated });
    expect(db.transaction).toHaveBeenCalledOnce();
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ status: 'On Leave', isActive: true, notForHire: false, updatedByUuid: 'actor-uuid' }));
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ crewUuid: 'own-crew', targetStatus: 'On Leave', reason: 'Eligible again', reactivatedByUserId: '501', reactivatedByName: 'Trusted Actor' }));
  });
});
