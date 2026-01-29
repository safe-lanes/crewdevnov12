import { Router } from "express";
import { vesselPlanningController, vesselCrewCountController } from "./controllers";

const router = Router();

// Crew count endpoint - get crew on board counts for all vessels
router.get("/crew-counts", vesselCrewCountController.getCrewCounts);

router.get("/:vesselUuid/planning", vesselPlanningController.getByVesselUuid);
router.get("/planning/:planUuid", vesselPlanningController.getByPlanUuid);
router.post("/:vesselUuid/planning", vesselPlanningController.create);
router.patch("/planning/:planUuid", vesselPlanningController.update);
router.post("/planning/:planUuid/archive", vesselPlanningController.archive);
router.post("/planning/:planUuid/attachments", vesselPlanningController.addAttachment);
router.delete("/planning/attachments/:attUuid", vesselPlanningController.deleteAttachment);

export default router;
