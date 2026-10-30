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
import { ToolRefusal, refuse, type Area, type ToolContext } from "../livedata/common";
import { assignmentsArgs, queryAssignments } from "../livedata/assignmentsArea";
import { documentsArgs, documentsNeedsVessel, queryDocuments } from "../livedata/documentsArea";
import { findCrew, findCrewArgs, resolveVessel, resolveVesselArgs } from "../livedata/lookups";
import { availabilityArgs, queryAvailability } from "../livedata/availabilityArea";
import { queryRelief, reliefArgs } from "../livedata/reliefArea";
import { queryRestHours, restHoursArgs } from "../livedata/restHoursArea";
import { queryRotation, rotationArgs } from "../livedata/rotationArea";
import { manningArgs, queryManning } from "../livedata/manningArea";
import { appraisalsArgs, queryAppraisals } from "../livedata/appraisalsArea";
import { manifest } from "../livedata/tools";

export type { Area };
/** Data area → the Access Control menu whose VIEW right it needs (Part B menus added 30-Oct-2026). */
const AREA_MENUS: Record<Area, string> = {
  vessel: "Vessel", documents: "CP Training Certificates", crewPool: "Crew Pool",
  due: "Due", restHours: "Rest Hours", rotation: "Rotation", appraisalsAll: "Appraisals All",
};
const TOOLS = [
  "crewing_query_assignments", "crewing_query_documents", "crewing_find_crew", "crewing_resolve_vessel",
  "crewing_query_availability", "crewing_query_relief_due", "crewing_query_rest_hours", "crewing_query_rotation_approvals",
  "crewing_query_manning", "crewing_query_appraisals",
] as const;

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

async function viewableAreas(roleId: string): Promise<{ view: Set<Area>; edit: Set<Area> }> {
  const db = getDb();
  const rows = await db
    .select({ menu: admMenuMasterAc.name, canview: admRoleAccessAc.canview, canedit: admRoleAccessAc.canedit })
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
  const editable = new Set(
    rows.filter((r: { canedit: boolean | null }) => r.canedit === true).map((r: { menu: string }) => r.menu.trim().toLocaleLowerCase()),
  );
  const view = new Set<Area>();
  const edit = new Set<Area>();
  for (const [area, menu] of Object.entries(AREA_MENUS) as [Area, string][]) {
    if (granted.has(menu.toLocaleLowerCase())) view.add(area);
    if (editable.has(menu.toLocaleLowerCase())) edit.add(area);
  }
  return { view, edit };
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
  // Part B (30-Oct-2026): each area needs the VIEW right of the Crewing menu it reads from
  if (tool === "crewing_query_availability") {
    const vesselFacts = !!(args && typeof args === "object" && ((args as Record<string, unknown>).vessels || (args as Record<string, unknown>).crewStatus));
    return vesselFacts ? ["crewPool", "vessel"] : ["crewPool"];
  }
  if (tool === "crewing_query_relief_due") return ["vessel", "due"];
  if (tool === "crewing_query_rest_hours") return ["restHours", "vessel"];
  if (tool === "crewing_query_rotation_approvals") return ["rotation"];
  if (tool === "crewing_query_manning") return ["vessel"];
  // Sahil, 31-Oct-2026: shore users the chatbot already allows may view appraisals across their company — no extra menu right.
  // Office-only, the role allow-list and company isolation are enforced before this point on every call.
  if (tool === "crewing_query_appraisals") return [];
  return [];
}

/** Models often send optional parameters as "", [] or null. Treat those as "not given" (recursively); unknown
 *  keys are still rejected by the strict schemas. Found in the pilot widget walk-through (documentNameContains: ""). */
export function dropEmpty(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(dropEmpty);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (x === null || x === undefined || (typeof x === "string" && x.trim() === "") || (Array.isArray(x) && x.length === 0)) continue;
      out[k] = dropEmpty(x);
    }
    return out;
  }
  return v;
}

async function runTool(tool: string, rawArgs: unknown, ctx: ToolContext) {
  const args = dropEmpty(rawArgs ?? {});
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
      case "crewing_query_availability":
        return queryAvailability(q, ctx, availabilityArgs.parse(args ?? {}));
      case "crewing_query_relief_due":
        return queryRelief(q, ctx, reliefArgs.parse(args ?? {}));
      case "crewing_query_rest_hours":
        return queryRestHours(q, ctx, restHoursArgs.parse(args ?? {}));
      case "crewing_query_rotation_approvals":
        return queryRotation(q, ctx, rotationArgs.parse(args ?? {}));
      case "crewing_query_manning":
        return queryManning(q, ctx, manningArgs.parse(args ?? {}));
      case "crewing_query_appraisals":
        return queryAppraisals(q, ctx, appraisalsArgs.parse(args ?? {}));
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
  if (!(TOOLS as readonly string[]).includes(tool)) {
    return refuse("unknown_tool", `Unknown tool '${tool}'.`);
  }
  const areas = await viewableAreas(resolution.role.roleId);
  const missing = areasNeeded(tool, dropEmpty(args ?? {})).filter((a) => !areas.view.has(a));
  if (missing.length) {
    return refuse("not_allowed", `Your role cannot view: ${missing.map((m) => AREA_MENUS[m]).join(", ")}.`);
  }
  const ctx: ToolContext = {
    asOf: asOfDate(),
    canView: (a) => areas.view.has(a),
    canEdit: (a) => areas.edit.has(a),
    // the VERIFIED identity (signed by the assistant from the user's token) — never a name or id the model supplies
    actor: { userId: String(identity.userId), role: resolution.role.roleName, userType: identity.userType ?? null },
  };
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
    groupsTotal: o.groupsTotal, returned: o.returned, nextOffset: o.nextOffset, excluded: o.excluded,
    breakdown: o.breakdown, rankConfig: o.rankConfig, summary: o.summary, ms }; // 29-Oct-2026: the expired/upcoming split and the rank-config report are scored too
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
