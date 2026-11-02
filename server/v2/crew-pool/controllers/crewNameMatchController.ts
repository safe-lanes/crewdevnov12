import { Router, raw, type Request, type Response, type NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';
import { eq } from 'drizzle-orm';
import { getDb } from '../../db';
import { masterUsers } from '../../../../shared/schema';
import { crewMembersV2 } from '../../../../shared/v2/crew-pool/schema';
import { accessControlService } from '../../admin/services/accessControlService';
import { CrewMatchCapacityError, matchCrewNames } from '../services/crew-name-match/matcher';
import { buildNameReport, CrewMatchError, eligibleSheets, makeNameTemplate, MAX_BYTES, MAX_ROWS, parseNameRows, readNameWorkbook } from '../services/crew-name-match/workbook';

const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
function respondError(res: Response, error: unknown) {
  if (error instanceof CrewMatchCapacityError) return res.status(400).json({ error: error.message });
  if (error instanceof CrewMatchError) return res.status(error.status).json({ error: error.message });
  // Do not expose workbook contents, names, or database details in errors/logs.
  console.error('[crew-name-match] Request failed', error instanceof Error ? error.name : 'UnknownError');
  return res.status(500).json({ error: 'Crew matching could not complete. No report or data changes were made. Please retry.' });
}

export async function requireCrewMatchAccess(req: Request, res: Response, next: NextFunction) {
  try {
    // Match the application's explicit local-development auth mode. Never use
    // this path in production, with JWT authentication configured, or to bypass
    // role checks for a supplied user (including dev impersonation tokens).
    const devBypass = process.env.NODE_ENV === 'development'
      && process.env.AUTH_BYPASS === 'true'
      && !process.env.JWT_SECRET;
    if (!req.user && devBypass) {
      res.locals.crewMatchDb = getDb(); // Tenant scoping still applies.
      res.setHeader('Cache-Control', 'no-store');
      next();
      return;
    }
    const userId = Number(req.user?.id);
    if (!Number.isSafeInteger(userId) || userId <= 0) throw new CrewMatchError('Sign in before using Crew Match.', 401);
    const database = getDb();
    const [user] = await database.select({ role: masterUsers.role }).from(masterUsers).where(eq(masterUsers.id, userId)).limit(1);
    if (!user?.role) throw new CrewMatchError('Unable to resolve your SAIL role.', 403);
    const { permissions } = await accessControlService.getMyPermissions(undefined, user.role);
    const allowed = ['crew database', 'terminated'].every(name => permissions.some(p => p.menuName?.trim().toLowerCase() === name && p.canview));
    if (!allowed) throw new CrewMatchError('Crew Match requires view permission for both Crew Database and Terminated. A partial search would give misleading results.', 403);
    res.locals.crewMatchDb = database;
    res.setHeader('Cache-Control', 'no-store');
    next();
  } catch (error) { respondError(res, error); }
}

export const crewNameMatchController = {
  async template(_req: Request, res: Response) {
    res.locals.crewMatchProcessing = true;
    try { res.type(MIME).attachment('SAIL_Crew_Names_Template.xlsx').send(await makeNameTemplate()); }
    catch (error) { respondError(res, error); }
    finally { res.locals.crewMatchProcessing = false; res.locals.crewMatchRelease?.(); }
  },
  async inspect(req: Request, res: Response) {
    res.locals.crewMatchProcessing = true;
    try {
      const workbook = await readNameWorkbook(req.body);
      res.json({ sheets: eligibleSheets(workbook), maxRows: MAX_ROWS, maxBytes: MAX_BYTES });
    } catch (error) { respondError(res, error); }
    finally { res.locals.crewMatchProcessing = false; res.locals.crewMatchRelease?.(); }
  },
  async report(req: Request, res: Response) {
    res.locals.crewMatchProcessing = true;
    try {
      if (typeof req.query.sheet !== 'string' || typeof req.query.filename !== 'string' || req.query.filename.length > 255) {
        throw new CrewMatchError('Provide a worksheet selection and input filename (maximum 255 characters).');
      }
      const workbook = await readNameWorkbook(req.body);
      const inputs = parseNameRows(workbook, req.query.sheet);
      const database: ReturnType<typeof getDb> = res.locals.crewMatchDb;
      const snapshotAt = new Date().toISOString();
      const crews = await database.select({
        crewUuid: crewMembersV2.crewUuid, empNo: crewMembersV2.empNo,
        firstName: crewMembersV2.firstName, middleName: crewMembersV2.middleName, familyName: crewMembersV2.familyName,
        status: crewMembersV2.status, isActive: crewMembersV2.isActive, archivedAt: crewMembersV2.archivedAt, isDeleted: crewMembersV2.isDeleted,
      }).from(crewMembersV2).where(eq(crewMembersV2.isDeleted, false));
      const results = matchCrewNames(inputs, crews);
      const report = await buildNameReport(results, { filename: req.query.filename, worksheet: req.query.sheet, snapshotAt });
      res.type(MIME).attachment('SAIL_Crew_Name_Match.xlsx').send(report);
    } catch (error) { respondError(res, error); }
    finally { res.locals.crewMatchProcessing = false; res.locals.crewMatchRelease?.(); }
  },
};

// These limits apply only to this feature, not existing imports/converters.
let inFlight = 0;
export const crewNameMatchRouter = Router();
crewNameMatchRouter.use(requireCrewMatchAccess);
crewNameMatchRouter.use(rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'Too many Crew Match requests. Please wait one minute and retry.' } }));
crewNameMatchRouter.use((_req, res, next) => {
  if (inFlight >= 2) { res.status(429).json({ error: 'Crew Match is busy. Please retry shortly.' }); return; }
  inFlight++;
  let released = false;
  const release = () => { if (!released && !res.locals.crewMatchProcessing) { released = true; inFlight--; } };
  res.locals.crewMatchRelease = release;
  res.once('finish', release);
  res.once('close', release);
  next();
});
crewNameMatchRouter.get('/template', crewNameMatchController.template);
crewNameMatchRouter.use(raw({ type: 'application/octet-stream', limit: MAX_BYTES, inflate: false }));
crewNameMatchRouter.post('/inspect', crewNameMatchController.inspect);
crewNameMatchRouter.post('/report', crewNameMatchController.report);
crewNameMatchRouter.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
  if (error?.type === 'entity.too.large') { res.status(413).json({ error: `Workbook exceeds the ${MAX_BYTES}-byte upload limit.` }); return; }
  if (error?.status === 415) { res.status(415).json({ error: 'Upload an uncompressed HTTP body containing a standard .xlsx workbook.' }); return; }
  respondError(res, error);
});
