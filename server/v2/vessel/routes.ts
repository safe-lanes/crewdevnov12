import { Router } from "express";
import {
  vesselPlanningController,
  vesselCrewCountController,
  vesselListController,
  complianceController,
  trainingController,
  oilMajorRulesController,
  vesselImportController,
} from "./controllers";
import { importUploadMiddleware, tenantContextGuard } from "./middleware/importUpload";

const router = Router();

// Vessel list endpoint - get all vessels from master_vessels
router.get("/list", vesselListController.getAll);

// Vessel Rank Hierarchy & Crew Assignment Import endpoints
// importUploadMiddleware intercepts multipart/form-data (field: "file") on these
// four routes only — all planning/attachment routes below are completely unaffected.
router.post("/import/parse-zip",         importUploadMiddleware, tenantContextGuard, vesselImportController.parseZip);
router.post("/import/generate-workbook", importUploadMiddleware, tenantContextGuard, vesselImportController.generateWorkbook);
router.post("/import/hierarchy",         importUploadMiddleware, tenantContextGuard, vesselImportController.importHierarchy);
router.post("/import/assignments",       importUploadMiddleware, tenantContextGuard, vesselImportController.importAssignments);

// Get all planning records for conflict detection (used by Rotation V2)
router.get("/planning", vesselPlanningController.getAll);

// Crew count endpoint - get crew on board counts for all vessels
router.get("/crew-counts", vesselCrewCountController.getCrewCounts);

// Compliance Matrix endpoints
router.get("/compliance/matrix/:vesselUuid", complianceController.getComplianceMatrix);
router.post("/compliance/matrix/:vesselUuid/simulated", complianceController.getSimulatedComplianceMatrix);

// Training Matrix endpoint - get crew training data for a vessel
router.get("/training/:vesselUuid", trainingController.getVesselCrewTrainings);

// Oil Major Rules endpoint
router.get("/oil-major-rules", oilMajorRulesController.getAll);

router.get("/:vesselUuid/planning", vesselPlanningController.getByVesselUuid);
router.get("/:vesselUuid/crew-list-export", vesselPlanningController.getCrewListExport);
// Sign-on conflict check endpoint
router.get("/planning/check-sign-on-conflict/:crewUuid", vesselPlanningController.checkSignOnConflict);

router.get("/planning/:planUuid", vesselPlanningController.getByPlanUuid);
router.post("/:vesselUuid/planning", vesselPlanningController.create);
router.patch("/planning/:planUuid", vesselPlanningController.update);
router.post("/planning/:planUuid/archive", vesselPlanningController.archive);
router.get("/planning/attachments/:attUuid/raw", vesselPlanningController.serveAttachment);
router.get("/planning/:planUuid/attachments", vesselPlanningController.getAttachments);
router.post("/planning/:planUuid/attachments", vesselPlanningController.addAttachment);
router.delete("/planning/:planUuid/attachments/:attUuid", vesselPlanningController.deleteAttachment);

// Reliever sign-on and status update endpoints
router.post("/planning/:planUuid/sign-on", vesselPlanningController.signOnReliever);
router.patch("/planning/:planUuid/reliever-status", vesselPlanningController.updateRelieverStatus);

// Sign-off endpoint - updates both vessel_planning_v2 and crew_assignments
router.post("/planning/:planUuid/sign-off", vesselPlanningController.signOffCrew);

// Officer Matrix data endpoint
router.get("/officer-matrix/:crewUuid", vesselPlanningController.getOfficerMatrixData);

export default router;
