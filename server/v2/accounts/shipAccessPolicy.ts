/**
 * Ship-side (vessel user) access policy for the Accounts (payroll) API.
 *
 * Default-deny: a request from a Ship-identity actor (JWT userType "Ship")
 * is rejected with 403 by a router-level guard unless the route is listed in
 * SHIP_ALLOWED_ROUTES below. Office-only enforcement therefore no longer
 * depends on per-handler assertOfficeUser calls — a new endpoint added
 * without classification is office-only by default.
 *
 * EVERY route registered on the accounts router MUST be classified here in
 * exactly one of the two lists. The route-inventory test
 * (tests/unit/accounts-ship-route-inventory.test.ts) walks the router's
 * registered routes and FAILS if any route is unclassified or classified in
 * both lists. When you add an accounts endpoint, add it to one of these
 * lists deliberately.
 *
 * The allowlist reflects the §3a vessel-role policy
 * (docs/deployment-checklist.md): vessel roles may use Vessel Portage
 * (working screen), CTM, their own vessel's monthly transactions, and have
 * read-only access to the Portage Bill workspace and Payslips. Vessel
 * scoping (own vessel only) is enforced inside the allowlisted controllers
 * via assertVesselScope.
 */

export interface RoutePolicyEntry {
  /** Uppercase HTTP method, e.g. "GET". */
  method: string;
  /** Express route path exactly as registered on the accounts router. */
  path: string;
}

const r = (method: string, path: string): RoutePolicyEntry => ({
  method,
  path,
});

/** Routes a Ship-identity actor may reach (vessel scoping still applies). */
export const SHIP_ALLOWED_ROUTES: RoutePolicyEntry[] = [
  // Portage Bill — read-only workspace view (§3a: View only)
  r("GET", "/portage"),

  // Payslips — read-only (§3a: View only)
  r("GET", "/reports/payslip"),
  r("GET", "/reports/payslips"),

  // Monthly transactions — vessel entry for the user's own vessel
  // (accept/reject are office review actions and are NOT allowlisted)
  r("GET", "/monthly-transactions"),
  r("GET", "/monthly-transactions/:uuid"),
  r("POST", "/monthly-transactions/batch"),
  r("POST", "/monthly-transactions"),
  r("PUT", "/monthly-transactions/:uuid"),
  r("PATCH", "/monthly-transactions/:uuid"),
  r("DELETE", "/monthly-transactions/:uuid"),

  // Vessel portage — the vessel-side submission package
  // (return-to-vessel is an office action and is NOT allowlisted)
  r("GET", "/vessel-portage/:vesselUuid/:period/status"),
  r("POST", "/vessel-portage/:vesselUuid/:period/submit"),

  // CTM cash account — captain's cash box
  // (reconcile is an office action and is NOT allowlisted)
  r("PUT", "/ctm/lines/:lineUuid"),
  r("PATCH", "/ctm/lines/:lineUuid"),
  r("DELETE", "/ctm/lines/:lineUuid"),
  r("GET", "/ctm/:vesselUuid/:period"),
  r("PUT", "/ctm/:vesselUuid/:period"),
  r("PATCH", "/ctm/:vesselUuid/:period"),
  r("POST", "/ctm/:vesselUuid/:period/lines"),
];

/**
 * Office-only routes — Ship actors get 403 from the router-level guard.
 * Listed explicitly so the route-inventory test can prove every registered
 * route was classified on purpose.
 */
export const OFFICE_ONLY_ROUTES: RoutePolicyEntry[] = [
  // Tenant configuration
  r("GET", "/config"),
  r("PUT", "/config"),
  r("PATCH", "/config"),

  // Pay elements (masters)
  r("GET", "/pay-elements"),
  r("POST", "/pay-elements/seed-standard"),
  r("GET", "/pay-elements/:uuid"),
  r("POST", "/pay-elements"),
  r("PUT", "/pay-elements/:uuid"),
  r("PATCH", "/pay-elements/:uuid"),
  r("DELETE", "/pay-elements/:uuid"),

  // Wage scales
  r("GET", "/wage-scales"),
  r("GET", "/wage-scales/:uuid"),
  r("POST", "/wage-scales"),
  r("PUT", "/wage-scales/:uuid"),
  r("PATCH", "/wage-scales/:uuid"),
  r("DELETE", "/wage-scales/:uuid"),
  r("PUT", "/wage-scales/:uuid/lines"),
  r("GET", "/wage-scales/:uuid/floor-check"),
  r("POST", "/wage-scales/:uuid/activate"),
  r("POST", "/wage-scales/:uuid/supersede"),

  // CBA reference
  r("GET", "/cba-reference"),
  r("GET", "/cba-reference/:uuid"),
  r("POST", "/cba-reference"),
  r("PUT", "/cba-reference/:uuid"),
  r("PATCH", "/cba-reference/:uuid"),
  r("DELETE", "/cba-reference/:uuid"),

  // Allotments
  r("GET", "/allotments"),
  r("GET", "/allotments/crew/:crewUuid"),
  r("GET", "/allotments/:uuid"),
  r("POST", "/allotments"),
  r("PUT", "/allotments/:uuid"),
  r("PATCH", "/allotments/:uuid"),
  r("POST", "/allotments/:uuid/suspend"),
  r("POST", "/allotments/:uuid/reactivate"),
  r("POST", "/allotments/:uuid/end"),
  r("DELETE", "/allotments/:uuid"),

  // Cash advances (office ledger)
  r("GET", "/advances"),
  r("GET", "/advances/crew/:crewUuid"),
  r("GET", "/advances/:uuid/detail"),
  r("GET", "/advances/:uuid"),
  r("POST", "/advances"),
  r("PUT", "/advances/:uuid"),
  r("PATCH", "/advances/:uuid"),
  r("POST", "/advances/:uuid/cancel"),
  r("POST", "/advances/:uuid/close"),
  r("DELETE", "/advances/:uuid"),

  // Engagements / contracts
  r("GET", "/engagements"),
  r("GET", "/engagements/:uuid/detail"),
  r("POST", "/engagements/:uuid/pay-items"),
  r("PATCH", "/engagements/pay-items/:epeUuid"),
  r("DELETE", "/engagements/pay-items/:epeUuid"),
  r("POST", "/engagements/sync"),
  r("GET", "/engagements/review"),
  r("GET", "/engagements/audit"),
  r("POST", "/engagements/:uuid/timing-override"),
  r("PATCH", "/engagements/:uuid"),

  // Portage bill lifecycle (office submit + approvals)
  r("POST", "/portage/:uuid/submit"),
  r("POST", "/portage/approvals/:approvalUuid/decision"),

  // Final settlements
  r("GET", "/settlements"),
  r("POST", "/settlements/compute"),
  r("POST", "/settlements/approvals/:approvalUuid/decision"),
  r("PATCH", "/settlements/adjustments/:adjustmentUuid"),
  r("DELETE", "/settlements/adjustments/:adjustmentUuid"),
  r("GET", "/settlements/:uuid"),
  r("POST", "/settlements/:uuid/recompute"),
  r("POST", "/settlements/:uuid/adjustments"),
  r("POST", "/settlements/:uuid/submit"),
  r("POST", "/settlements/:uuid/mark-paid"),
  r("POST", "/settlements/:uuid/lock"),
  r("POST", "/settlements/:uuid/revert-to-draft"),

  // Wage calculation engine + ledger
  r("POST", "/calc/run"),
  r("POST", "/calc/run-engagement"),
  r("POST", "/calc/adjustments"),
  r("GET", "/ledger"),

  // Reports (office-only projections)
  r("GET", "/reports/gl-export"),
  r("GET", "/reports/fleet-summary"),

  // Monthly transactions — office review actions
  r("POST", "/monthly-transactions/:uuid/accept"),
  r("POST", "/monthly-transactions/:uuid/reject"),

  // Vessel portage — office return action
  r("POST", "/vessel-portage/:portageUuid/return"),

  // CTM — office reconcile action
  r("POST", "/ctm/:vesselUuid/:period/reconcile"),

  // Bond purchases (office ledger)
  r("GET", "/bond-items"),
  r("GET", "/bond-items/crew/:crewUuid"),
  r("GET", "/bond-items/:uuid"),
  r("POST", "/bond-items"),
  r("PUT", "/bond-items/:uuid"),
  r("PATCH", "/bond-items/:uuid"),
  r("DELETE", "/bond-items/:uuid"),
];
