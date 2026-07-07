import { Router } from "express";
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
} from "./controllers";

const router = Router();

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
router.delete("/allotments/:uuid", allotmentsController.delete);

// ============================================
// CASH ADVANCES
// ============================================
router.get("/advances", advancesController.getAll);
router.get("/advances/crew/:crewUuid", advancesController.getByCrew);
router.get("/advances/:uuid", advancesController.getByUuid);
router.post("/advances", advancesController.create);
router.put("/advances/:uuid", advancesController.update);
router.patch("/advances/:uuid", advancesController.update);
router.delete("/advances/:uuid", advancesController.delete);

// ============================================
// ENGAGEMENTS (sync + manual seniority anchor)
// ============================================
router.post("/engagements/sync", engagementsController.sync);
router.get("/engagements/review", engagementsController.review);
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
// WAGE CALCULATION ENGINE + LEDGER (read-only)
// ============================================
router.post("/calc/run", calcController.run);
router.post("/calc/run-engagement", calcController.runEngagement);
router.post("/calc/adjustments", calcController.createAdjustments);
router.get("/ledger", calcController.getLedger);

// ============================================
// MONTHLY TRANSACTIONS (office entry, lock-guarded)
// ============================================
router.get("/monthly-transactions", monthlyTransactionsController.getAll);
router.get("/monthly-transactions/:uuid", monthlyTransactionsController.getByUuid);
router.post("/monthly-transactions", monthlyTransactionsController.create);
router.put("/monthly-transactions/:uuid", monthlyTransactionsController.update);
router.patch("/monthly-transactions/:uuid", monthlyTransactionsController.update);
router.delete("/monthly-transactions/:uuid", monthlyTransactionsController.delete);

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
