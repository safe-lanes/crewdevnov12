import { Router } from "express";
import { planningAttachmentAccess } from "../shared/operationalAttachmentAccess";
import { redactAttachmentJson } from "../shared/attachmentJsonAccess";
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
import { denyShipPlanningWrites } from "./middleware/denyShipPlanningWrites";
import { getOnboardTrainingCompliance } from "./controllers/onboardTrainingComplianceController";
import { requirePermission } from "../../middleware/requirePermission";
import { checkTrainingSuggestions } from "../training-needs/complianceSuggestionController";
import { getRelieverTrainingCompliance } from "./controllers/trainingComplianceController";
import { getTrainingChecklistHistory } from "./controllers/trainingChecklistHistoryController";

const router = Router();
router.use(planningAttachmentAccess);
router.use(redactAttachmentJson);
router.get("/planning/:planUuid/checklist-history", getTrainingChecklistHistory);

// Vessel list endpoint - get all vessels from master_vessels
router.get("/list", vesselListController.getAll);

// Vessel Rank Hierarchy & Crew Assignment Import endpoints
// importUploadMiddleware intercepts multipart/form-data (field: "file") on these
// four routes only — all planning/attachment routes below are completely unaffected.
router.post("/import/parse-zip",              importUploadMiddleware, tenantContextGuard, vesselImportController.parseZip);
router.post("/import/generate-workbook",      importUploadMiddleware, tenantContextGuard, vesselImportController.generateWorkbook);
router.post("/import/generate-workbook-from-db",                      tenantContextGuard, vesselImportController.generateWorkbookFromDb);
// VS-04: these two write planning (office-owned), so ship users get 403 before the upload is read.
router.post("/import/hierarchy",              denyShipPlanningWrites, importUploadMiddleware, tenantContextGuard, vesselImportController.importHierarchy);
router.post("/import/assignments",            denyShipPlanningWrites, importUploadMiddleware, tenantContextGuard, vesselImportController.importAssignments);
router.post("/import/first-service-backfill", tenantContextGuard,
  requirePermission("Vessel", "edit"), vesselImportController.rerunFirstService);

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
router.get("/planning/:planUuid/unlinked-reliever-clear-audit",
  requirePermission("Vessel", "delete"), vesselPlanningController.getUnlinkedRelieverClearAudit);
router.post("/planning/:planUuid/clear-unlinked-reliever",
  denyShipPlanningWrites, requirePermission("Vessel", "delete"), vesselPlanningController.clearUnlinkedReliever);
router.get("/planning/:planUuid/reliever-assignment/:assignUuid", vesselPlanningController.getRelieverAssignment);
router.get("/planning/:planUuid/reliever-assignment/:assignUuid/training-compliance", getRelieverTrainingCompliance);
router.get("/:vesselUuid/training-compliance", getOnboardTrainingCompliance);
router.post("/planning/:planUuid/reliever-assignment/:assignUuid/training-suggestions", checkTrainingSuggestions);
router.get("/planning/:planUuid/incumbent-reconciliation", vesselPlanningController.getIncumbentReconciliation);
router.post("/planning/:planUuid/incumbent-reconciliation", denyShipPlanningWrites, vesselPlanningController.reconcileIncumbentAssignment);
router.post("/:vesselUuid/planning", denyShipPlanningWrites, vesselPlanningController.create);
router.patch("/planning/:planUuid", vesselPlanningController.update);
router.post("/planning/:planUuid/defer-relief", denyShipPlanningWrites, requirePermission("Vessel", "edit"), vesselPlanningController.deferRelief);
router.post("/planning/:planUuid/archive", denyShipPlanningWrites, vesselPlanningController.archive);
router.get("/planning/attachments/:attUuid/raw", vesselPlanningController.serveAttachment);
router.get("/planning/:planUuid/attachments", vesselPlanningController.getAttachments);
// VS-04 / P0-4: plan attachments are office-only; ships get 403.
router.post("/planning/:planUuid/attachments", denyShipPlanningWrites, vesselPlanningController.addAttachment);
router.delete("/planning/:planUuid/attachments/:attUuid", denyShipPlanningWrites, vesselPlanningController.deleteAttachment);

// Reliever sign-on and status update endpoints
router.post("/planning/:planUuid/sign-on", denyShipPlanningWrites, vesselPlanningController.signOnReliever);
router.patch("/planning/:planUuid/reliever-status", denyShipPlanningWrites, vesselPlanningController.updateRelieverStatus);

// Sign-off endpoint - updates both vessel_planning_v2 and crew_assignments
router.post("/planning/:planUuid/sign-off", denyShipPlanningWrites, vesselPlanningController.signOffCrew);

// Officer Matrix data endpoint
router.get("/officer-matrix/:crewUuid", vesselPlanningController.getOfficerMatrixData);

export default router;
