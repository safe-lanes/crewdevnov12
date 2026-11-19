// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type Request } from 'express';
import supertest from 'supertest';
import ExcelJS from 'exceljs';
const mocks = vi.hoisted(() => ({ getDb: vi.fn(), permissions: vi.fn() }));
vi.mock('../../server/v2/db', () => ({ getDb: mocks.getDb }));
vi.mock('../../server/v2/admin/services/accessControlService', () => ({ accessControlService: { getMyPermissions: mocks.permissions } }));
import { crewNameMatchController, crewNameMatchRouter, requireCrewMatchAccess } from '../../server/v2/crew-pool/controllers/crewNameMatchController';
import { MAX_BYTES } from '../../server/v2/crew-pool/services/crew-name-match/workbook';

function database(records: any[] = []) {
  const builder: any = {};
  builder.from = vi.fn(() => builder);
  builder.where = vi.fn(() => builder);
  builder.limit = vi.fn(async () => [{ role: 'Admin' }]);
  builder.then = (resolve: any, reject: any) => Promise.resolve(records).then(resolve, reject);
  return { select: vi.fn(() => builder), builder };
}
function response(db?: any) {
  const res: any = { locals: { crewMatchDb: db } };
  for (const method of ['status', 'json', 'send', 'type', 'attachment', 'setHeader']) res[method] = vi.fn(() => res);
  return res;
}
const user = { user: { id: 1 } } as unknown as Request;
async function input() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Names');
  sheet.addRow(['Crew Name']); sheet.addRow(['AZHAR SIDDIQUE']);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
const record = { crewUuid: 'crew-1', empNo: 'K 2332', firstName: 'AZHAR', middleName: null, familyName: 'SIDDIQUE', status: 'On Leave', isActive: true, archivedAt: null, isDeleted: false };
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('AUTH_BYPASS', 'false');
  vi.stubEnv('JWT_SECRET', 'test-only-secret');
  mocks.getDb.mockReset(); mocks.permissions.mockReset();
  mocks.getDb.mockReturnValue(database());
  mocks.permissions.mockResolvedValue({ permissions: [{ menuName: 'Crew Database', canview: true }, { menuName: 'Terminated', canview: true }] });
});
afterEach(() => { vi.unstubAllEnvs(); });
describe('Crew Match access', () => {
  it('rejects anonymous requests in normal authentication mode', async () => {
    const res = response(); const next = vi.fn();
    await requireCrewMatchAccess({} as Request, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mocks.getDb).not.toHaveBeenCalled(); expect(next).not.toHaveBeenCalled();
  });
  it('supports the explicitly configured development bypass without querying roles', async () => {
    vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('AUTH_BYPASS', 'true'); vi.stubEnv('JWT_SECRET', '');
    const db = database(); mocks.getDb.mockReturnValue(db);
    const res = response(); const next = vi.fn();
    await requireCrewMatchAccess({} as Request, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.locals.crewMatchDb).toBe(db);
    expect(db.select).not.toHaveBeenCalled();
    expect(mocks.permissions).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });
  it.each([
    ['production', 'true', ''],
    ['test', 'true', ''],
    ['development', 'false', ''],
    ['development', 'true', 'configured-secret'],
  ])('does not bypass authentication with NODE_ENV=%s, AUTH_BYPASS=%s, secret=%s', async (environment, bypass, secret) => {
    vi.stubEnv('NODE_ENV', environment); vi.stubEnv('AUTH_BYPASS', bypass); vi.stubEnv('JWT_SECRET', secret);
    const res = response(); const next = vi.fn();
    await requireCrewMatchAccess({} as Request, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled(); expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it('still enforces supplied-user permissions in development bypass mode', async () => {
    vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('AUTH_BYPASS', 'true'); vi.stubEnv('JWT_SECRET', '');
    mocks.permissions.mockResolvedValue({ permissions: [] });
    const res = response(); const next = vi.fn();
    await requireCrewMatchAccess(user, res, next);
    expect(res.status).toHaveBeenCalledWith(403); expect(next).not.toHaveBeenCalled();
  });
  it('does not fall back to a different database when development tenant resolution fails', async () => {
    vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('AUTH_BYPASS', 'true'); vi.stubEnv('JWT_SECRET', '');
    mocks.getDb.mockImplementation(() => { throw new Error('Missing tenant'); });
    const res = response(); const next = vi.fn();
    await requireCrewMatchAccess({} as Request, res, next);
    expect(res.status).toHaveBeenCalledWith(500); expect(next).not.toHaveBeenCalled();
  });
  it.each(['Crew Database', 'Terminated'])('requires both view permissions, including %s', async missing => {
    mocks.permissions.mockResolvedValue({ permissions: [{ menuName: missing === 'Terminated' ? 'Crew Database' : 'Terminated', canview: true }] });
    const res = response(); const next = vi.fn();
    await requireCrewMatchAccess(user, res, next);
    expect(res.status).toHaveBeenCalledWith(403); expect(next).not.toHaveBeenCalled();
  });
  it('denies unresolved users and tenant failures without falling back to partial data', async () => {
    const db = database(); db.builder.limit.mockResolvedValue([]); mocks.getDb.mockReturnValue(db);
    const res = response(); await requireCrewMatchAccess(user, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
    mocks.getDb.mockImplementation(() => { throw new Error('Missing tenant'); });
    const failed = response(); await requireCrewMatchAccess(user, failed, vi.fn());
    expect(failed.status).toHaveBeenCalledWith(500);
    expect(failed.json).not.toHaveBeenCalledWith(expect.objectContaining({ sheets: expect.anything() }));
  });
  it('keeps the request-scoped database and prevents browser caching', async () => {
    const db = database(); mocks.getDb.mockReturnValue(db);
    const res = response(); const next = vi.fn();
    await requireCrewMatchAccess(user, res, next);
    expect(next).toHaveBeenCalledOnce(); expect(res.locals.crewMatchDb).toBe(db);
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });
});

describe('Crew Match controller', () => {
  it('inspects worksheet names without querying crew records', async () => {
    const db = database(); const res = response(db);
    await crewNameMatchController.inspect({ body: await input() } as Request, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ sheets: ['Names'] }));
    expect(db.select).not.toHaveBeenCalled();
  });
  it('performs one crew read and generates an actual Excel report without a write interface', async () => {
    const db = database([record]); const res = response(db);
    await crewNameMatchController.report({ body: await input(), query: { sheet: 'Names', filename: 'input.xlsx' } } as unknown as Request, res);
    expect(db.select).toHaveBeenCalledOnce();
    expect(res.attachment).toHaveBeenCalledWith('SAIL_Crew_Name_Match.xlsx');
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(res.send.mock.calls[0][0]);
    expect(workbook.getWorksheet('Active')!.getCell('A2').value).toBe('K 2332');
  });
  it('does not turn a database failure into Not Found results', async () => {
    const db = { select: vi.fn(() => { throw new Error('Database unavailable'); }) }; const res = response(db);
    await crewNameMatchController.report({ body: await input(), query: { sheet: 'Names', filename: 'input.xlsx' } } as unknown as Request, res);
    expect(res.status).toHaveBeenCalledWith(500); expect(res.send).not.toHaveBeenCalled();
  });
  it('requires an explicit worksheet before querying any crew data', async () => {
    const db = database(); const res = response(db);
    await crewNameMatchController.report({ body: await input(), query: { filename: 'input.xlsx' } } as unknown as Request, res);
    expect(res.status).toHaveBeenCalledWith(400); expect(db.select).not.toHaveBeenCalled();
  });
  it('does not leak a different request database into a report', async () => {
    const body = await input();
    const a = response(database([record])); const b = response(database([]));
    const req = { body, query: { sheet: 'Names', filename: 'input.xlsx' } } as unknown as Request;
    await crewNameMatchController.report(req, a); await crewNameMatchController.report(req, b);
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(b.send.mock.calls[0][0]);
    expect(workbook.getWorksheet('Active')!.rowCount).toBe(1);
    expect(workbook.getWorksheet('Not Found')!.rowCount).toBe(2);
  });
});

describe('Crew Match HTTP route integration (mocked database)', () => {
  function app(signedIn = true) {
    const app = express();
    if (signedIn) app.use((req, _res, next) => { req.user = user.user; next(); });
    app.use('/crew-name-match', crewNameMatchRouter);
    return app;
  }
  it('enforces authentication before parsing uploaded data', async () => {
    const result = await supertest(app(false)).post('/crew-name-match/inspect').set('Content-Type', 'application/octet-stream').send(Buffer.from('invalid workbook'));
    expect(result.status).toBe(401);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it('returns a downloadable noncached template and inspects raw XLSX bytes', async () => {
    const server = app();
    const template = await supertest(server).get('/crew-name-match/template');
    expect(template.status).toBe(200);
    expect(template.headers['cache-control']).toBe('no-store');
    expect(template.headers['content-disposition']).toContain('SAIL_Crew_Names_Template.xlsx');
    const result = await supertest(server).post('/crew-name-match/inspect').set('Content-Type', 'application/octet-stream').send(await input());
    expect(result.status).toBe(200);
    expect(result.body.sheets).toEqual(['Names']);
  });
  it('downloads the template without a token in the existing local development mode', async () => {
    vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('AUTH_BYPASS', 'true'); vi.stubEnv('JWT_SECRET', '');
    const result = await supertest(app(false)).get('/crew-name-match/template');
    expect(result.status).toBe(200);
    expect(result.headers['content-disposition']).toContain('SAIL_Crew_Names_Template.xlsx');
    expect(mocks.permissions).not.toHaveBeenCalled();
  });
  it('returns actionable JSON for over-limit uploads', async () => {
    const result = await supertest(app()).post('/crew-name-match/inspect').set('Content-Type', 'application/octet-stream').send(Buffer.alloc(MAX_BYTES + 1));
    expect(result.status).toBe(413);
    expect(result.body.error).toContain('upload limit');
  });
  it('rejects incorrect body types rather than treating them as unmatched names', async () => {
    const result = await supertest(app()).post('/crew-name-match/inspect').send({ names: ['AZHAR'] });
    expect(result.status).toBe(400);
    expect(result.body.error).toContain('.xlsx');
  });
});
