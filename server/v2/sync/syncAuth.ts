// Machine authentication for the sync protocol (SYN-06). Ships are not people:
// they send no browser session, only two headers.
//
//   X-Sync-Instance-Id: SHIP-GASMIA
//   X-Sync-Api-Key:     <the key issued when the ship was registered>
//
// The office looks the instance up in sync_ships, compares the key's hash, and
// binds the request to that ship's one vessel. Whatever vessel a request body
// names is ignored; the service reads req.syncShip only.
//
// Every failure answers the same 401, so a caller cannot tell an unknown ship
// from a wrong key from an inactive ship.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { findShipWithHash, touchShip, type Queryable } from "./syncRepository";
import { isShipInstance } from "./syncRole";
import type { ShipIdentity } from "./syncTypes";

export const INSTANCE_HEADER = "x-sync-instance-id";
export const API_KEY_HEADER = "x-sync-api-key";

declare module "express-serve-static-core" {
  interface Request {
    syncShip?: ShipIdentity;
  }
}

export const hashApiKey = (key: string): string => createHash("sha256").update(key, "utf8").digest("hex");

// 32 random bytes, URL-safe. Shown once to the person registering the ship.
export const generateApiKey = (): string => randomBytes(32).toString("base64url");

function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

// Returns the ship when the instance is registered, active, and the key matches.
export async function authenticateShip(
  db: Queryable,
  instanceId: string | undefined,
  apiKey: string | undefined,
): Promise<ShipIdentity | null> {
  const id = (instanceId ?? "").trim();
  const key = (apiKey ?? "").trim();
  // An empty key is "not configured", never a valid key.
  if (!id || !key || !isShipInstance(id)) return null;
  const ship = await findShipWithHash(db, id);
  // Compare against a hash even when the ship is unknown, so timing does not
  // reveal which ids exist.
  const ok = sameHash(hashApiKey(key), ship?.apiKeyHash ?? hashApiKey("no-such-ship"));
  if (!ship || !ship.isActive || !ok) return null;
  return { instanceId: ship.instanceId, vesselUuid: ship.vesselUuid };
}

export function syncMachineAuth(getDb: () => Queryable) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = getDb();
      const ship = await authenticateShip(
        db,
        req.header(INSTANCE_HEADER) ?? undefined,
        req.header(API_KEY_HEADER) ?? undefined,
      );
      if (!ship) return res.status(401).json({ error: "unauthorized" });
      req.syncShip = ship;
      // Best effort: a failed last-seen stamp must not fail the call.
      touchShip(db, ship.instanceId).catch(() => {});
      next();
    } catch (err) {
      console.error("[Sync] machine auth failed:", (err as Error)?.message);
      res.status(500).json({ error: "sync_auth_error" });
    }
  };
}
