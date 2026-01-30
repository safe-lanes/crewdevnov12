import { Router } from "express";
import { vesselPlanningController, vesselCrewCountController, vesselListController } from "./controllers";

const router = Router();

// Vessel list endpoint - get all vessels from master_vessels
router.get("/list", vesselListController.getAll);

// Crew count endpoint - get crew on board counts for all vessels
router.get("/crew-counts", vesselCrewCountController.getCrewCounts);

router.get("/:vesselUuid/planning", vesselPlanningController.getByVesselUuid);
router.get("/planning/:planUuid", vesselPlanningController.getByPlanUuid);
router.post("/:vesselUuid/planning", vesselPlanningController.create);
router.patch("/planning/:planUuid", vesselPlanningController.update);
router.post("/planning/:planUuid/archive", vesselPlanningController.archive);
router.post("/planning/:planUuid/attachments", vesselPlanningController.addAttachment);
router.delete("/planning/attachments/:attUuid", vesselPlanningController.deleteAttachment);

// Reliever sign-on and status update endpoints
router.post("/planning/:planUuid/sign-on", vesselPlanningController.signOnReliever);
router.patch("/planning/:planUuid/reliever-status", vesselPlanningController.updateRelieverStatus);

// Sign-off endpoint - updates both vessel_planning_v2 and crew_assignments
router.post("/planning/:planUuid/sign-off", vesselPlanningController.signOffCrew);

// Officer Matrix data endpoint
router.get("/officer-matrix/:crewUuid", vesselPlanningController.getOfficerMatrixData);

export default router;
