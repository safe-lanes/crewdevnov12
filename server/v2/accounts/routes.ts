import { Router } from "express";
import {
  payElementsController,
  allotmentsController,
  advancesController,
  bondItemsController,
} from "./controllers";

const router = Router();

// ============================================
// PAY ELEMENTS (master pay element library)
// ============================================
router.get("/pay-elements", payElementsController.getAll);
router.get("/pay-elements/:uuid", payElementsController.getByUuid);
router.post("/pay-elements", payElementsController.create);
router.put("/pay-elements/:uuid", payElementsController.update);
router.patch("/pay-elements/:uuid", payElementsController.update);
router.delete("/pay-elements/:uuid", payElementsController.delete);

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
