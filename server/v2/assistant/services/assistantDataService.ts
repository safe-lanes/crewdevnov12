/**
 * Stage 2 live data (PILOT TRIAL): the security chain and tool dispatch behind
 *   GET  /api/v2/assistant/manifest   (service secret)
 *   POST /api/v2/assistant/execute    (service secret + signed identity)
 *
 * Order, every call:
 *   1-2  AUTHENTICATION → HTTP 401, no data: service secret; identity HMAC, expiry, issuer = ASSISTANT_INSTANCE_ID.
 *   3    company: the verified identity's tenantDomain (multi-tenant mode) → that tenant's database only.
 *   4    role re-resolved on the server (master_users → adm_rolemaster_ac), Office only, in ASSISTANT_ALLOWED_ROLES.
 *   5    menu view permission for EVERY data area the call uses (adm_roleaccess_ac).
 *   6    tool + strict argument schema; read-only snapshot transaction with a statement timeout.
 * Steps 3-6 refuse with HTTP 200 and data = {ok:false, code, error}: business refusals of an authenticated call.
 */
import type { Request } from "express";
import { appendFileSync } from "fs";
import { and, eq } from "drizzle-orm";
import { ZodError } from "zod";
import { getDb } from "../../db";
import { tenantConnectionManager } from "../../../utils/tenantConnectionManager";
import { resolveRequestRole } from "../../auth/roleResolutionService";
import { admMenuMasterAc, admRoleAccessAc } from "../../../../shared/v2/admin/schema";
import { allowedRoles } from "./assistantTokenService";
import { serviceSecretMatches, verifyAssistantIdentity, type VerifiedIdentity } from "../serviceIdentity";
import { DataTimeoutError, runReadOnly } from "../repositories/assistantDataRepository";
import { asOfDate } from "../livedata/definitions";
import { ToolRefusal, refuse, type ToolContext } from "../livedata/common";
import { assignmentsArgs, queryAssignments } from "../livedata/assignmentsArea";
import { documentsArgs, documentsNeedsVessel, queryDocuments } from "../livedata/documentsArea";
import { findCrew, findCrewArgs, resolveVessel, resolveVesselArgs } from "../livedata/lookups";
import { manifest } from "../livedata/tools";

export type Area = "vessel" | "documents" | "crewPool";
const AREA_MENUS: Record<Area, string> = { vessel: "Vessel", documents: "CP Training Certificates", crewPool: "Crew Pool" };

export type ServiceResult = { status: number; body: unknown };

export function manifestFor(req: Request): ServiceResult {
  if (!serviceSecretMatches(req.headers["x-service-secret"])) return { status: 401, body: { error: "unauthorized" } };
  return { status: 200, body: manifest() };
}

function authenticate(req: Request): { ok: true; identity: VerifiedIdentity } | { ok: false } {
  if (!serviceSecretMatches(req.headers["x-service-secret"])) return { ok: false };
  const check = verifyAssistantIdentity(
    req.headers["x-assistant-identity"],
    (process.env.ASSISTANT_IDENTITY_SIGNING_KEY || "").trim(),
    (process.env.ASSISTANT_INSTANCE_ID || "").trim(),
  );
  if (!check.ok) {
    console.warn(`[assistant-data] identity refused: ${check.reason}`);
    return { ok: false };
  }
  return { ok: true, identity: check.identity };
}

async function viewableAreas(roleId: string): Promise<Set<Area>> {
  const db = getDb();
  const rows = await db
    .select({ menu: admMenuMasterAc.name, canview: admRoleAccessAc.canview })
    .from(admRoleAccessAc)
    .innerJoin(admMenuMasterAc, eq(admMenuMasterAc.muid, admRoleAccessAc.menuId))
    .where(
      and(
        eq(admRoleAccessAc.roleId, roleId),
        eq(admRoleAccessAc.isDeleted, false),
        eq(admMenuMasterAc.isDeleted, false),
        eq(admMenuMasterAc.isActive, true),
      ),
    );
  const granted = new Set(
    rows.filter((r: { canview: boolean | null }) => r.canview === true).map((r: { menu: string }) => r.menu.trim().toLocaleLowerCase()),
  );
  const out = new Set<Area>();
  for (const [area, menu] of Object.entries(AREA_MENUS) as [Area, string][]) if (granted.has(menu.toLocaleLowerCase())) out.add(area);
  return out;
}

/** Data areas a call needs — EVERY one must be viewable (combined queries check each area they touch). */
function areasNeeded(tool: string, args: unknown): Area[] {
  if (tool === "crewing_resolve_vessel") return ["vessel"];
  if (tool === "crewing_find_crew") return ["crewPool"];
  if (tool === "crewing_query_assignments") {
    const hasDoc = !!(args && typeof args === "object" && (args as Record<string, unknown>).hasDocument);
    return hasDoc ? ["vessel", "documents"] : ["vessel"];
  }
  if (tool === "crewing_query_documents") {
    const parsed = documentsArgs.safeParse(args ?? {});
    return parsed.success && documentsNeedsVessel(parsed.data) ? ["documents", "vessel"] : ["documents"];
  }
  return [];
}

async function runTool(tool: string, args: unknown, ctx: ToolContext) {
  return runReadOnly(async (q) => {
    switch (tool) {
      case "crewing_query_assignments":
        return queryAssignments(q, ctx, assignmentsArgs.parse(args ?? {}));
      case "crewing_query_documents":
        return queryDocuments(q, ctx, documentsArgs.parse(args ?? {}));
      case "crewing_find_crew":
        return findCrew(q, ctx, findCrewArgs.parse(args ?? {}));
      case "crewing_resolve_vessel":
        return resolveVessel(q, ctx, resolveVesselArgs.parse(args ?? {}));
      default:
        throw new ToolRefusal(refuse("unknown_tool", `Unknown tool '${tool}'.`));
    }
  });
}

/** Steps 4-6 inside the company's database context. */
async function authorizedExecute(identity: VerifiedIdentity, tool: string, args: unknown, requestId: string): Promise<unknown> {
  if ((identity.userType || "").trim().toLocaleLowerCase() !== "office") {
    return refuse("not_allowed", "Live data is available to office users only.");
  }
  const fakeReq = { user: { id: Number(identity.userId), userType: identity.userType } } as unknown as Request;
  const resolution = await resolveRequestRole(fakeReq);
  if (!resolution.ok) return refuse("not_allowed", `Your role could not be confirmed (${resolution.reason}).`);
  if (!allowedRoles().includes(resolution.role.roleName.trim().toLocaleLowerCase())) {
    return refuse("not_allowed", "Your role is not allowed to use live data in the assistant.");
  }
  if (!["crewing_query_assignments", "crewing_query_documents", "crewing_find_crew", "crewing_resolve_vessel"].includes(tool)) {
    return refuse("unknown_tool", `Unknown tool '${tool}'.`);
  }
  const areas = await viewableAreas(resolution.role.roleId);
  const missing = areasNeeded(tool, args).filter((a) => !areas.has(a));
  if (missing.length) {
    return refuse("not_allowed", `Your role cannot view: ${missing.map((m) => AREA_MENUS[m]).join(", ")}.`);
  }
  const ctx: ToolContext = { asOf: asOfDate(), canView: (a) => areas.has(a) };
  const started = Date.now();
  const out = await (async () => {
    try {
      return await runTool(tool, args, ctx);
    } catch (err: unknown) {
      if (err instanceof ToolRefusal) return err.refusal;
      if (err instanceof ZodError) {
        return refuse("invalid_args", "Invalid arguments: " + err.issues.map((i) => `${i.path.join(".") || "args"} ${i.message}`).join("; "));
      }
      if (err instanceof DataTimeoutError) {
        return refuse("timeout", "The query took too long and was stopped — no result. Try a narrower question (one vessel or a shorter period).");
      }
      console.error(`[assistant-data] ${requestId} ${tool} failed:`, err);
      return refuse("failed", "The data could not be read — no result.");
    }
  })();
  const ms = Date.now() - started;
  console.log(`[assistant-data] ${requestId} ${tool} user=${identity.userId} role=${resolution.role.roleName} ` +
    `tenant=${tenantConnectionManager.getCurrentTenantId() ?? "single"} argKeys=${Object.keys((args as object) ?? {}).join(",")} ${ms}ms`);
  return out;
}

/** PILOT TRIAL ONLY: full arguments + result summary to a local file, so expected-vs-actual can compare the selected
 *  query. Off unless ASSISTANT_TRIAL_ARG_LOG names a file; never enabled outside the isolated pilot. */
function trialArgLog(requestId: string, tool: string, args: unknown, out: unknown, ms: number) {
  const file = process.env.ASSISTANT_TRIAL_ARG_LOG;
  if (!file || process.env.NODE_ENV === "production") return;
  const o = (out ?? {}) as Record<string, unknown>;
  const line = { t: new Date().toISOString(), requestId, tool, args, ok: o.ok, code: o.code, total: o.total, totals: o.totals,
    groupsTotal: o.groupsTotal, returned: o.returned, nextOffset: o.nextOffset, excluded: o.excluded, ms };
  try {
    appendFileSync(file, JSON.stringify(line) + "\n");
  } catch {
    /* logging never breaks a call */
  }
}

export async function execute(req: Request): Promise<ServiceResult> {
  const auth = authenticate(req);
  if (!auth.ok) return { status: 401, body: { error: "unauthorized" } };
  const identity = auth.identity;
  const body = (req.body ?? {}) as { tool?: unknown; args?: unknown; requestId?: unknown };
  const tool = typeof body.tool === "string" ? body.tool : "";
  const requestId = typeof body.requestId === "string" ? body.requestId.slice(0, 64) : "-";
  const started = Date.now();
  const done = (result: unknown): ServiceResult => {
    trialArgLog(requestId, tool, body.args, result, Date.now() - started); // every authenticated outcome, refusals included
    return { status: 200, body: wrap(result) };
  };

  if (!tenantConnectionManager.isMultiTenantEnabled) {
    return done(await authorizedExecute(identity, tool, body.args, requestId));
  }
  const domain = (identity.tenantDomain || "").trim();
  if (!domain) return done(refuse("company_unavailable", "The identity carries no company."));
  let tuid: string;
  try {
    tuid = (await tenantConnectionManager.resolveTenant(domain)).tuid;
  } catch {
    return done(refuse("company_unavailable", "Your company is not available for live data."));
  }
  if (identity.tuid && identity.tuid !== tuid) {
    console.warn(`[assistant-data] ${requestId} identity tuid does not match its domain — refused`);
    return { status: 401, body: { error: "unauthorized" } };
  }
  const out = await tenantConnectionManager.runInTenantContext(tuid, () => authorizedExecute(identity, tool, body.args, requestId), domain);
  return done(out);
}

/**
 * Envelope of every AUTHENTICATED call: {ok:true, data}. The assistant hands only `data` to the model and keeps
 * nothing but the error text of a top-level ok:false (agent.call_tool) — so business refusals travel INSIDE data
 * ({ok:false, code, error, details}) to keep their code and structured details (e.g. vessel candidates, whose
 * `vesselName` keys the assistant's masker recognises; inside a plain error string they would not be masked).
 */
function wrap(result: unknown) {
  return { ok: true, data: result };
}
