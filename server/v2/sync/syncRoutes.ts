// HTTP for the sync protocol and its admin (SYN-09).
//
// Two routers, mounted in server/routes.ts:
//
//   /api/sync/*       protocol, ship to office. Machine auth (instance id + API
//                     key headers), no browser session. Outside /api/v2, so the
//                     JWT and tenant middleware do not apply; the paths are also
//                     listed in server/middleware/exemptPaths.ts. Office only: a
//                     ship answers 403.
//   /api/v2/sync/*    admin, for people. JWT + an Access Control permission per
//                     route. Ship users are refused (default deny): every route
//                     here is office-only. Every route must be listed in
//                     SYNC_ADMIN_ROUTES; tests/unit/sync-routes.test.ts fails if
//                     one is added unclassified.
//
// Static paths are registered before any :param path.

import { Router, type NextFunction, type Request, type RequestHandler, type Response } from "express";
import { requirePermission } from "../../middleware/requirePermission";
import { getActor } from "../accounts/controllers/_auth";
import { getBaseDb } from "../db";
import { rhPostApply } from "./rhPostApply";
import { syncMachineAuth } from "./syncAuth";
import { listShips } from "./syncRepository";
import { getEffectiveInstanceId, isShipInstance } from "./syncRole";
import {
  SyncRequestError, complete, getStatus, initiate, preparePull, receivePush, registerShip,
  rotateShipKey, setShipActiveState, type Db, type PostApply,
} from "./syncService";

export const PROTOCOL_PATHS = ["/api/sync/initiate", "/api/sync/push", "/api/sync/pull", "/api/sync/complete"] as const;

// Admin routes, all office-only. `menu`/`action` are the Access Control permission.
export const SYNC_ADMIN_ROUTES = [
  { method: "GET", path: "/status", menu: "Admin", action: "view" },
  { method: "GET", path: "/ships", menu: "Admin", action: "view" },
  { method: "POST", path: "/ships", menu: "Admin", action: "create" },
  { method: "POST", path: "/ships/:instanceId/rotate-key", menu: "Admin", action: "edit" },
  { method: "POST", path: "/ships/:instanceId/deactivate", menu: "Admin", action: "edit" },
  { method: "POST", path: "/ships/:instanceId/activate", menu: "Admin", action: "edit" },
] as const;

interface Deps {
  getDb: () => Db;
  postApply?: PostApply;
}

const defaultDeps = (): Deps => ({ getDb: () => getBaseDb() as unknown as Db, postApply: rhPostApply });

function handle(fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler {
  return async (req, res) => {
    try {
      const out = await fn(req, res);
      if (!res.headersSent) res.json(out);
    } catch (err: any) {
      if (err instanceof SyncRequestError) return void res.status(err.status).json({ error: err.message });
      console.error(`[Sync] ${req.method} ${req.path} failed:`, err?.message ?? err);
      res.status(500).json({ error: "sync_error" });
    }
  };
}

// Ships never serve the protocol: only the office does.
export function requireShoreInstance(getDb: () => Db): RequestHandler {
  return async (_req: Request, res: Response, next: NextFunction) => {
    try {
      if (isShipInstance(await getEffectiveInstanceId(getDb()))) {
        return void res.status(403).json({ error: "not_a_shore_instance" });
      }
      next();
    } catch (err: any) {
      console.error("[Sync] instance id unavailable:", err?.message ?? err);
      res.status(503).json({ error: "sync_not_configured" });
    }
  };
}

// ------------------------------------------------------------- protocol

export function createSyncProtocolRouter(deps: Deps = defaultDeps()): Router {
  const router = Router();
  const shore = async () => getEffectiveInstanceId(deps.getDb());

  router.use(requireShoreInstance(deps.getDb));
  router.use(syncMachineAuth(deps.getDb));

  // req.syncShip is set by syncMachineAuth; it is the only source of the vessel.
  router.post("/initiate", handle(async (req) => initiate(deps.getDb(), req.syncShip!, await shore())));
  router.post("/push", handle(async (req) => receivePush(deps.getDb(), req.syncShip!, await shore(), req.body, deps.postApply)));
  router.post("/pull", handle(async (req) => preparePull(deps.getDb(), req.syncShip!, await shore(), req.body ?? {})));
  router.post("/complete", handle(async (req) => complete(deps.getDb(), req.syncShip!, await shore(), req.body)));
  return router;
}

// ----------------------------------------------------------------- admin

export function denyShipUsers(req: Request, res: Response, next: NextFunction) {
  if (getActor(req).vesselUser) {
    return void res.status(403).json({ error: "forbidden", message: "Sync administration is office-only." });
  }
  next();
}

export function createSyncAdminRouter(deps: Deps = defaultDeps()): Router {
  const router = Router();
  const perm = (path: string, method: string) => {
    const r = SYNC_ADMIN_ROUTES.find((x) => x.path === path && x.method === method)!;
    return requirePermission(r.menu, r.action);
  };

  router.use(denyShipUsers);

  router.get("/status", perm("/status", "GET"), handle(async () => {
    const db = deps.getDb();
    const id = await getEffectiveInstanceId(db);
    return getStatus(db, id, isShipInstance(id) ? "ship" : "shore");
  }));

  router.get("/ships", perm("/ships", "GET"), handle(async () => ({ ships: await listShips(deps.getDb()) })));
  router.post("/ships", perm("/ships", "POST"), handle(async (req) => registerShip(deps.getDb(), req.body ?? {})));
  router.post("/ships/:instanceId/rotate-key", perm("/ships/:instanceId/rotate-key", "POST"), handle(async (req) => rotateShipKey(deps.getDb(), req.params.instanceId)));
  router.post("/ships/:instanceId/deactivate", perm("/ships/:instanceId/deactivate", "POST"), handle(async (req) => setShipActiveState(deps.getDb(), req.params.instanceId, false)));
  router.post("/ships/:instanceId/activate", perm("/ships/:instanceId/activate", "POST"), handle(async (req) => setShipActiveState(deps.getDb(), req.params.instanceId, true)));
  return router;
}
