/**
 * Mounts the approval engine into Crewing (office server only). Called once from
 * server/routes.ts, which both server/index.ts and server/production.ts use, so it always runs
 * after tenantMiddleware and authMiddleware.
 *
 *   /api/v2/approval-engine/*   the engine API (registry, roles, workflows, scopes, requests, pending)
 *   /api/v2/approvals/*         Crewing host routes (role approvers lookup, config status, sample)
 *
 * Injected into the engine:
 *   tenant  = the request's tenant (AsyncLocalStorage) — tenantProvider.ts
 *   actor   = user_uuid + Access Control role from the login token — actor.ts
 *   config  = saving a chain or switching an action on/off needs Access Control EDIT on the
 *             "Approval Workflow" menu; a role with no Access Control row is refused
 *   events  = approval emails — notifier.ts
 *
 * A card that is wrong refuses to start (fail-loud), the same as Technical.
 */
import { Router, type Express, type NextFunction, type Request, type Response } from "express";
import { startEmbedded } from "../approval-engine";
import { requirePermission } from "../../middleware/requirePermission";
import { requireApprovalActor } from "./actor";
import { AlsTenantRepositoryProvider, currentEngineTenantId } from "./tenantProvider";
import { approvalEventNotifier, approvalEmailsEnabled, setNotifierCards } from "./notifier";
import { setCrewingEngine } from "./gateway";
import { listApprovalRoles, resolveRoleApproverUserIds, contactsForUsers, roleApproverDirectory } from "./roles";
import { sesConfig } from "../shared/emailService";
import type { CrewingApprovalCard } from "./cards/types";
import { crewingApprovalCards } from "./cards";
import { SAMPLE_MODULE_ID } from "./cards/sampleCard";
import { sampleApprovalRoutes } from "./cards/sampleRoutes";

export const APPROVAL_ENGINE_BASE_PATH = "/api/v2/approval-engine";
export const APPROVAL_HOST_BASE_PATH = "/api/v2/approvals";
/** Access Control menu that guards approval configuration (adm_menumaster_ac.name). */
export const APPROVAL_CONFIG_MENU = "Approval Workflow";

/**
 * Crewing has no vessel (ship) server yet. When ship–office sync lands (crew_offline), replace
 * this with its "am I a ship" check: the engine must never run on a vessel.
 */
function isShipInstance(): boolean {
  return false;
}

function safe(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => { handler(req, res).catch(next); };
}

export function mountCrewingApprovals(app: Express, cards: CrewingApprovalCard[] = crewingApprovalCards()): void {
  if (isShipInstance()) {
    console.log("🔏 Approval engine NOT mounted (vessel server — the engine runs in the office only)");
    return;
  }

  const configWrite = requirePermission(APPROVAL_CONFIG_MENU, "edit");
  const configView = requirePermission(APPROVAL_CONFIG_MENU, "view");

  // Submit and decide go ONLY through each module's own routes (gateway.ts), so the module's
  // checks always run first. The engine's generic submit/decide HTTP routes are closed here.
  app.use(APPROVAL_ENGINE_BASE_PATH, (req: Request, res: Response, next: NextFunction) => {
    if (req.method === "POST" && /^\/requests(\/[^/]+\/decide)?\/?$/.test(req.path)) {
      res.status(405).json({ error: "Submit and decide through the module's own screen, not the engine API." });
      return;
    }
    next();
  });
  // Resolve the actor from the login token before any engine route runs.
  app.use(APPROVAL_ENGINE_BASE_PATH, requireApprovalActor);

  const engine = startEmbedded(app, {
    cards,
    provider: new AlsTenantRepositoryProvider(),
    basePath: APPROVAL_ENGINE_BASE_PATH,
    resolveTenantId: () => currentEngineTenantId(),
    resolveActor: (req: Request) => req.approvalActor ?? { userId: "anonymous", role: null, userType: null },
    requireConfigWrite: (req: Request, res: Response, next: NextFunction) => { configWrite(req, res, next).catch(next); },
    onEvent: approvalEventNotifier,
  });
  setCrewingEngine(engine);
  setNotifierCards(cards);

  const host = Router();
  host.use(requireApprovalActor);

  // Who holds a role, for the admin screen's read-only "configured approvers" panel.
  //   no vesselUuid → every holder with the vessels they approve for ({ names, vesselScoped, users })
  //   vesselUuid    → the approvers a request on that vessel would get ({ names })
  host.get("/role-approvers", configView, safe(async (req, res) => {
    const roleId = typeof req.query.roleId === "string" ? req.query.roleId : "";
    const vesselUuid = typeof req.query.vesselUuid === "string" && req.query.vesselUuid ? req.query.vesselUuid : null;
    if (!roleId) { res.status(400).json({ error: "roleId is required" }); return; }
    if (!vesselUuid) {
      const directory = await roleApproverDirectory(roleId);
      if (!directory) { res.status(404).json({ error: "role not found" }); return; }
      res.json({ roleId, ...directory });
      return;
    }
    const role = (await listApprovalRoles()).find((r) => r.roleId === roleId);
    if (!role) { res.status(404).json({ error: "role not found" }); return; }
    const ids = await resolveRoleApproverUserIds(roleId, vesselUuid);
    const contacts = await contactsForUsers(ids);
    res.json({ roleId, names: ids.map((id) => contacts.get(id)?.name || id) });
  }));

  // Email delivery status for the admin screen (never shows key values).
  host.get("/config-status", configView, safe(async (_req, res) => {
    const ses = sesConfig();
    res.json({
      emailsEnabled: approvalEmailsEnabled(),
      emailChannel: ses ? (ses.mode === "json-test" ? "ses-test" : "ses") : "legacy",
      cards: cards.map((c) => ({ moduleId: c.moduleId, label: c.label })),
    });
  }));

  if (cards.some((c) => c.moduleId === SAMPLE_MODULE_ID)) {
    host.use("/sample", sampleApprovalRoutes());
  }

  app.use(APPROVAL_HOST_BASE_PATH, host);
  console.log(`🔏 Approval engine mounted at ${APPROVAL_ENGINE_BASE_PATH} (cards: ${cards.map((c) => c.moduleId).join(", ") || "none"})`);
}
