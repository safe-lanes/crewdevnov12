import { Router, type Request, type Response, type NextFunction } from "express";
import { getActor } from "./controllers/_auth";
import { SHIP_ALLOWED_ROUTES } from "./shipAccessPolicy";
import {
  payElementsController,
  allotmentsController,
  advancesController,
  bondItemsController,
  tenantConfigController,
  wageScalesController,
  cbaReferenceController,
  engagementsController,
  calcController,
  monthlyTransactionsController,
  portageController,
  settlementsController,
  ctmController,
  vesselPortageController,
  reportsController,
} from "./controllers";

const router = Router();

// ============================================================
// SHIP-SIDE DEFAULT-DENY GUARD (see shipAccessPolicy.ts)
//
// A marker sub-router re-registers every Ship-allowlisted route using
// Express's own matching semantics; matched requests set a flag and fall
// through. The guard middleware after it then rejects Ship actors on any
// request that did not match the allowlist. Office actors are unaffected.
// ============================================================
const SHIP_ALLOWED_FLAG = Symbol("shipRouteAllowed");

const shipAllowMarker = Router();
for (const entry of SHIP_ALLOWED_ROUTES) {
  const method = entry.method.toLowerCase() as "get" | "post" | "put" | "patch" | "delete";
  shipAllowMarker[method](entry.path, (req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { [SHIP_ALLOWED_FLAG]?: boolean })[SHIP_ALLOWED_FLAG] = true;
    next();
  });
}
router.use(shipAllowMarker);
router.use((req: Request, res: Response, next: NextFunction) => {
  const actor = getActor(req);
  if (
    actor.vesselUser &&
    !(req as Request & { [SHIP_ALLOWED_FLAG]?: boolean })[SHIP_ALLOWED_FLAG]
  ) {
    return res
      .status(403)
      .json({ error: "This action is available to office users only" });
  }
  next();
});

// ============================================
// TENANT CONFIGURATION (single row per tenant)
// ============================================
router.get("/config", tenantConfigController.get);
router.put("/config", tenantConfigController.update);
router.patch("/config", tenantConfigController.update);

// ============================================
// PAY ELEMENTS (master pay element library)
// ============================================
router.get("/pay-elements", payElementsController.getAll);
router.post("/pay-elements/seed-standard", payElementsController.seedStandard);
router.get("/pay-elements/:uuid", payElementsController.getByUuid);
router.post("/pay-elements", payElementsController.create);
router.put("/pay-elements/:uuid", payElementsController.update);
router.patch("/pay-elements/:uuid", payElementsController.update);
router.delete("/pay-elements/:uuid", payElementsController.delete);

// ============================================
// WAGE SCALES (headers + lines + lifecycle)
// ============================================
router.get("/wage-scales", wageScalesController.getAll);
router.get("/wage-scales/:uuid", wageScalesController.getByUuid);
router.post("/wage-scales", wageScalesController.create);
router.put("/wage-scales/:uuid", wageScalesController.update);
router.patch("/wage-scales/:uuid", wageScalesController.update);
router.delete("/wage-scales/:uuid", wageScalesController.delete);
router.put("/wage-scales/:uuid/lines", wageScalesController.replaceLines);
router.get("/wage-scales/:uuid/floor-check", wageScalesController.floorCheck);
router.post("/wage-scales/:uuid/activate", wageScalesController.activate);
router.post("/wage-scales/:uuid/supersede", wageScalesController.supersede);

// ============================================
// CBA REFERENCE (reference-only minimums)
// ============================================
router.get("/cba-reference", cbaReferenceController.getAll);
router.get("/cba-reference/:uuid", cbaReferenceController.getByUuid);
router.post("/cba-reference", cbaReferenceController.create);
router.put("/cba-reference/:uuid", cbaReferenceController.update);
router.patch("/cba-reference/:uuid", cbaReferenceController.update);
router.delete("/cba-reference/:uuid", cbaReferenceController.delete);

// ============================================
// ALLOTMENTS
// ============================================
router.get("/allotments", allotmentsController.getAll);
router.get("/allotments/crew/:crewUuid", allotmentsController.getByCrew);
router.get("/allotments/:uuid", allotmentsController.getByUuid);
router.post("/allotments", allotmentsController.create);
router.put("/allotments/:uuid", allotmentsController.update);
router.patch("/allotments/:uuid", allotmentsController.update);
router.post("/allotments/:uuid/suspend", allotmentsController.suspend);
router.post("/allotments/:uuid/reactivate", allotmentsController.reactivate);
router.post("/allotments/:uuid/end", allotmentsController.end);
router.delete("/allotments/:uuid", allotmentsController.delete);

// ============================================
// CASH ADVANCES
// ============================================
router.get("/advances", advancesController.getAll);
router.get("/advances/crew/:crewUuid", advancesController.getByCrew);
router.get("/advances/:uuid/detail", advancesController.getDetail);
router.get("/advances/:uuid", advancesController.getByUuid);
router.post("/advances", advancesController.create);
router.put("/advances/:uuid", advancesController.update);
router.patch("/advances/:uuid", advancesController.update);
router.post("/advances/:uuid/cancel", advancesController.cancel);
router.post("/advances/:uuid/close", advancesController.close);
router.delete("/advances/:uuid", advancesController.delete);

// ============================================
// ENGAGEMENTS (sync + manual seniority anchor)
// ============================================
router.get("/engagements", engagementsController.list);
router.get("/engagements/:uuid/detail", engagementsController.detail);
router.post("/engagements/:uuid/pay-items", engagementsController.createPayItem);
router.patch(
  "/engagements/pay-items/:epeUuid",
  engagementsController.updatePayItem,
);
router.delete(
  "/engagements/pay-items/:epeUuid",
  engagementsController.deletePayItem,
);
router.post("/engagements/sync", engagementsController.sync);
router.post("/engagements/auto-create", engagementsController.autoCreate);
router.post("/engagements/:uuid/sign-off", engagementsController.setSignOff);
router.get("/engagements/review", engagementsController.review);
router.get("/engagements/audit", engagementsController.overlapAudit);
router.post(
  "/engagements/:uuid/timing-override",
  engagementsController.setTimingOverride,
);
router.patch("/engagements/:uuid", engagementsController.update);

// ============================================
// PORTAGE BILL LIFECYCLE (workspace + approvals)
// ============================================
router.get("/portage", portageController.getWorkspace);
router.post("/portage/:uuid/submit", portageController.submit);
router.post(
  "/portage/approvals/:approvalUuid/decision",
  portageController.decide,
);

// ============================================
// FINAL SETTLEMENTS (compute + status lifecycle)
// ============================================
router.get("/settlements", settlementsController.list);
router.post("/settlements/compute", settlementsController.compute);
router.post(
  "/settlements/approvals/:approvalUuid/decision",
  settlementsController.decide,
);
router.patch(
  "/settlements/adjustments/:adjustmentUuid",
  settlementsController.updateAdjustment,
);
router.delete(
  "/settlements/adjustments/:adjustmentUuid",
  settlementsController.deleteAdjustment,
);
router.get("/settlements/:uuid", settlementsController.get);
router.post("/settlements/:uuid/recompute", settlementsController.recompute);
router.post("/settlements/:uuid/adjustments", settlementsController.addAdjustment);
router.post("/settlements/:uuid/submit", settlementsController.submit);
router.post("/settlements/:uuid/mark-paid", settlementsController.markPaid);
router.post("/settlements/:uuid/lock", settlementsController.lock);
router.post(
  "/settlements/:uuid/revert-to-draft",
  settlementsController.revertToDraft,
);

// ============================================
// WAGE CALCULATION ENGINE + LEDGER (read-only)
// ============================================
router.post("/calc/run", calcController.run);
router.post("/calc/run-engagement", calcController.runEngagement);
router.post("/calc/adjustments", calcController.createAdjustments);
router.get("/ledger", calcController.getLedger);

// ============================================
// REPORTS (read-only ledger projections)
// ============================================
router.get("/reports/payslip", reportsController.payslip);
router.get("/reports/payslips", reportsController.payslipBatch);
router.get("/reports/gl-export", reportsController.glExport);
router.get("/reports/fleet-summary", reportsController.fleetSummary);

// ============================================
// MONTHLY TRANSACTIONS (office + vessel entry, lock-guarded)
// ============================================
router.get("/monthly-transactions", monthlyTransactionsController.getAll);
router.get("/monthly-transactions/:uuid", monthlyTransactionsController.getByUuid);
router.post(
  "/monthly-transactions/batch",
  monthlyTransactionsController.batchSave,
);
router.post("/monthly-transactions", monthlyTransactionsController.create);
router.put("/monthly-transactions/:uuid", monthlyTransactionsController.update);
router.patch("/monthly-transactions/:uuid", monthlyTransactionsController.update);
router.delete("/monthly-transactions/:uuid", monthlyTransactionsController.delete);
router.post(
  "/monthly-transactions/:uuid/accept",
  monthlyTransactionsController.accept,
);
router.post(
  "/monthly-transactions/:uuid/reject",
  monthlyTransactionsController.reject,
);

// ============================================
// VESSEL PORTAGE (vessel-side submission package)
// ============================================
router.get(
  "/vessel-portage/:vesselUuid/:period/status",
  vesselPortageController.getStatus,
);
router.post(
  "/vessel-portage/:vesselUuid/:period/submit",
  vesselPortageController.submit,
);
router.post(
  "/vessel-portage/:portageUuid/return",
  vesselPortageController.returnToVessel,
);

// ============================================
// CTM CASH ACCOUNT (header + lines, closing server-computed)
// NOTE: /ctm/lines/* must be registered before /ctm/:vesselUuid/:period.
// ============================================
router.put("/ctm/lines/:lineUuid", ctmController.updateLine);
router.patch("/ctm/lines/:lineUuid", ctmController.updateLine);
router.delete("/ctm/lines/:lineUuid", ctmController.deleteLine);
router.get("/ctm/:vesselUuid/:period", ctmController.get);
router.put("/ctm/:vesselUuid/:period", ctmController.updateHeader);
router.patch("/ctm/:vesselUuid/:period", ctmController.updateHeader);
router.post("/ctm/:vesselUuid/:period/lines", ctmController.createLine);
router.post("/ctm/:vesselUuid/:period/reconcile", ctmController.reconcile);

// ============================================
// BOND PURCHASES
// ============================================
router.get("/bond-items", bondItemsController.getAll);
router.get("/bond-items/crew/:crewUuid", bondItemsController.getByCrew);
router.get("/bond-items/:uuid", bondItemsController.getByUuid);
router.post("/bond-items", bondItemsController.create);
router.put("/bond-items/:uuid", bondItemsController.update);
router.patch("/bond-items/:uuid", bondItemsController.update);
router.delete("/bond-items/:uuid", bondItemsController.delete);

export default router;
