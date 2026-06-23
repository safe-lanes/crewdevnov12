import { Router } from "express";
import {
  payElementsController,
  contractsController,
  contractPayElementsController,
  allotmentsController,
  advancesController,
  bondItemsController,
} from "./controllers";

const router = Router();

// ============================================
// PAY ELEMENTS (Rate Tables & Rules master library)
// ============================================
router.get("/pay-elements", payElementsController.getAll);
router.get("/pay-elements/:uuid", payElementsController.getByUuid);
router.post("/pay-elements", payElementsController.create);
router.put("/pay-elements/:uuid", payElementsController.update);
router.patch("/pay-elements/:uuid", payElementsController.update);
router.delete("/pay-elements/:uuid", payElementsController.delete);

// ============================================
// CONTRACTS
// ============================================
// Returns { contractData, earnings, deductions } for a crew member + vessel group,
// auto-creating a draft contract and inheriting master pay elements on first access.
router.get("/contract-data/:crewUuid", contractsController.getContractData);
router.get("/contracts/:uuid", contractsController.getByUuid);
router.put("/contracts/:uuid/status", contractsController.updateStatus);
router.put(
  "/contracts/:uuid/effective-date",
  contractsController.updateEffectiveDate,
);

// ============================================
// CONTRACT PAY ELEMENTS
// ============================================
router.get(
  "/contracts/:contractUuid/pay-elements",
  contractPayElementsController.getByContract,
);
router.post("/contract-pay-elements", contractPayElementsController.create);
router.put("/contract-pay-elements/:uuid", contractPayElementsController.update);
router.patch(
  "/contract-pay-elements/:uuid",
  contractPayElementsController.update,
);
router.delete(
  "/contract-pay-elements/:uuid",
  contractPayElementsController.delete,
);

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
