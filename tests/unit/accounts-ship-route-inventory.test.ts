import { describe, it, expect } from "vitest";
import accountsRouter from "@server/v2/accounts/routes";
import {
  SHIP_ALLOWED_ROUTES,
  OFFICE_ONLY_ROUTES,
} from "@server/v2/accounts/shipAccessPolicy";

/**
 * Route-inventory guard for the accounts ship-access policy (Task: office-only
 * payroll actions must be default-deny for Ship users).
 *
 * Every route registered on the accounts router must be classified in
 * exactly one of SHIP_ALLOWED_ROUTES or OFFICE_ONLY_ROUTES
 * (server/v2/accounts/shipAccessPolicy.ts). An endpoint added without
 * classification FAILS this test — that is the point: an unclassified route
 * is a test failure, never a silent pass.
 */

const key = (method: string, path: string) => `${method.toUpperCase()} ${path}`;

function registeredRoutes(): string[] {
  const out: string[] = [];
  for (const layer of (accountsRouter as any).stack as any[]) {
    if (!layer.route) continue; // skip mounted middleware (guard, marker router)
    const path: string = layer.route.path;
    for (const m of Object.keys(layer.route.methods)) {
      if (m === "_all" || m === "head") continue;
      out.push(key(m, path));
    }
  }
  return out;
}

describe("accounts ship-access route inventory", () => {
  const registered = registeredRoutes();
  const allowed = SHIP_ALLOWED_ROUTES.map((e) => key(e.method, e.path));
  const officeOnly = OFFICE_ONLY_ROUTES.map((e) => key(e.method, e.path));
  const classified = new Set([...allowed, ...officeOnly]);

  it("registers a nonzero number of routes (sanity)", () => {
    expect(registered.length).toBeGreaterThan(50);
  });

  it("has no route classified in BOTH lists", () => {
    const both = allowed.filter((k) => officeOnly.includes(k));
    expect(both, `Routes in both lists: ${both.join(", ")}`).toEqual([]);
  });

  it("has no duplicate entries within a list", () => {
    expect(new Set(allowed).size).toBe(allowed.length);
    expect(new Set(officeOnly).size).toBe(officeOnly.length);
  });

  it("every registered accounts route is classified (unclassified = FAIL)", () => {
    const unclassified = registered.filter((k) => !classified.has(k));
    expect(
      unclassified,
      `Unclassified accounts routes — add each to SHIP_ALLOWED_ROUTES or ` +
        `OFFICE_ONLY_ROUTES in server/v2/accounts/shipAccessPolicy.ts:\n` +
        unclassified.join("\n"),
    ).toEqual([]);
  });

  it("every classified route actually exists on the router (no stale policy entries)", () => {
    const registeredSet = new Set(registered);
    const stale = [...classified].filter((k) => !registeredSet.has(k));
    expect(
      stale,
      `Policy entries with no matching registered route:\n${stale.join("\n")}`,
    ).toEqual([]);
  });

  it("keeps confirmed-regression endpoints office-only", () => {
    // The three endpoints confirmed reachable by a Ship JWT on 27-Jul-2026
    // (manual-test-script Appendix B.1) must stay classified office-only.
    for (const k of [
      "POST /pay-elements",
      "POST /wage-scales",
      "POST /calc/run",
    ]) {
      expect(officeOnly, `${k} must be office-only`).toContain(k);
      expect(allowed, `${k} must NOT be ship-allowed`).not.toContain(k);
    }
  });
});
