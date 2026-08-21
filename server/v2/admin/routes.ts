import { Router } from "express";
import {
  formsController,
  rankGroupsController,
  availableRanksController,
  promotionHierarchiesController,
  trainingMasterController,
  companyTrainingGroupsController,
  companyTrainingsController,
  companyTrainingRequirementsController,
  companyRanksController,
  vesselGroupsController,
  vesselDraftsController,
  vesselRevisionsController,
  trainingMatrixVesselDraftsController,
  trainingMatrixVesselRevisionsController,
  accessControlController,
  vesselOrgChartController,
} from "./controllers";
import { requirePermission } from "../../middleware/requirePermission";
import { requireTrustedAccessControlAdmin } from "../../middleware/requireTrustedAccessControlAdmin";

const router = Router();

router.get("/forms", requirePermission("Forms", "view"), formsController.getAll);
router.get("/forms/for-rank/:rankLabel", formsController.getFormForRank);
router.post("/forms/cleanup-duplicates", requirePermission("Forms", "delete"), formsController.cleanupDuplicates);
router.get("/forms/:id", requirePermission("Forms", "view"), formsController.getById);
router.post("/forms", requirePermission("Forms", "create"), formsController.create);
router.put("/forms/:id", requirePermission("Forms", "edit"), formsController.update);
router.patch("/forms/:id", requirePermission("Forms", "edit"), formsController.updateLockFlag);
router.delete("/forms/:id", requirePermission("Forms", "delete"), formsController.delete);

router.get("/forms/:id/versions", requirePermission("Forms", "view"), formsController.getVersions);
router.post("/forms/:id/versions", requirePermission("Forms", "create"), formsController.createVersion);

router.get("/form-versions/:versionId/configuration", formsController.getVersionConfiguration);
router.get("/form-versions/:id", requirePermission("Forms", "view"), formsController.getVersionById);
router.put("/form-versions/:id", requirePermission("Forms", "edit"), formsController.updateVersion);
router.post("/form-versions/:id/release", requirePermission("Forms", "edit"), formsController.releaseVersion);
router.delete("/form-versions/:id", requirePermission("Forms", "delete"), formsController.deleteVersion);

router.get("/rank-groups", requirePermission("Forms", "view"), rankGroupsController.getAll);
router.get("/rank-groups/check-assignment", requirePermission("Forms", "view"), rankGroupsController.checkAssignment);
router.get("/rank-groups/form/:formId", requirePermission("Forms", "view"), rankGroupsController.getByFormId);
router.get("/rank-groups/form/:formId/rank-conflicts", requirePermission("Forms", "view"), rankGroupsController.getRankConflicts);
router.get("/rank-groups/:id", requirePermission("Forms", "view"), rankGroupsController.getById);
router.post("/rank-groups", requirePermission("Forms", "create"), rankGroupsController.create);
router.put("/rank-groups/:id", requirePermission("Forms", "edit"), rankGroupsController.update);
router.put("/rank-groups/:id/configuration", requirePermission("Forms", "edit"), rankGroupsController.updateConfiguration);
router.post("/rank-groups/:id/release-configuration", requirePermission("Forms", "edit"), rankGroupsController.releaseConfiguration);
router.post("/rank-groups/:id/archive", requirePermission("Forms", "delete"), rankGroupsController.archive);
router.post("/rank-groups/:id/unarchive", requirePermission("Forms", "edit"), rankGroupsController.unarchive);
router.delete("/rank-groups/:id", requirePermission("Forms", "delete"), rankGroupsController.delete);

router.get("/available-ranks", availableRanksController.getAll);
router.post("/available-ranks", availableRanksController.create);
router.post("/available-ranks/reorder", availableRanksController.reorder);
router.put("/available-ranks/:id", availableRanksController.update);
router.delete("/available-ranks/:id", availableRanksController.delete);
router.delete("/available-ranks", availableRanksController.deleteAll);

router.get("/promotion-hierarchies", promotionHierarchiesController.getAll);
router.get("/promotion-hierarchies/:id", promotionHierarchiesController.getById);
router.post("/promotion-hierarchies", promotionHierarchiesController.create);
router.patch("/promotion-hierarchies/:id", promotionHierarchiesController.update);
router.delete("/promotion-hierarchies/:id", promotionHierarchiesController.delete);

router.get("/training-master", trainingMasterController.getAll);
router.patch("/training-master/batch", trainingMasterController.batchUpdate);
router.post("/training-master/reorder", trainingMasterController.reorder);
router.get("/training-master/:id", trainingMasterController.getById);
router.post("/training-master", trainingMasterController.create);
router.patch("/training-master/:id", trainingMasterController.update);
router.delete("/training-master/:id", trainingMasterController.delete);

router.get("/company-training-groups", companyTrainingGroupsController.getAll);
router.patch("/company-training-groups/:code", companyTrainingGroupsController.updateByCode);

router.get("/company-trainings", companyTrainingsController.getAll);
router.post("/company-trainings/import", companyTrainingsController.import);
router.post("/company-trainings/reorder", companyTrainingsController.reorder);
router.get("/company-trainings/:id", companyTrainingsController.getById);
router.post("/company-trainings", companyTrainingsController.create);
router.patch("/company-trainings/:id", companyTrainingsController.update);
router.delete("/company-trainings/:id", companyTrainingsController.delete);

router.get("/company-training-requirements", companyTrainingRequirementsController.getAll);
router.post("/company-training-requirements/batch", companyTrainingRequirementsController.upsertBatch);

router.get("/company-ranks", companyRanksController.getAll);
router.post("/company-ranks", companyRanksController.saveAll);
router.get("/company-ranks/by-name/:rankName", companyRanksController.getByName);

router.get("/vessel-groups", vesselGroupsController.getAll);
router.get("/vessel-groups/:id", vesselGroupsController.getById);
router.post("/vessel-groups", vesselGroupsController.create);
router.patch("/vessel-groups/:id", vesselGroupsController.update);
router.delete("/vessel-groups/:id", vesselGroupsController.delete);

router.get("/vessel-drafts", vesselDraftsController.getAll);
router.post("/vessel-drafts/upsert", vesselDraftsController.upsert);
router.get("/vessel-drafts/by-vessel/:vesselId", vesselDraftsController.getByVesselId);
router.get("/vessel-drafts/:id", vesselDraftsController.getById);
router.post("/vessel-drafts", vesselDraftsController.create);
router.patch("/vessel-drafts/:id", vesselDraftsController.update);
router.delete("/vessel-drafts/:id", vesselDraftsController.delete);

router.get("/vessel-revisions", vesselRevisionsController.getAll);
router.post("/vessel-revisions/submit", vesselRevisionsController.submit);
router.get("/vessel-revisions/by-vessel/:vesselId", vesselRevisionsController.getByVesselId);
router.get("/vessel-revisions/ranks/:vesselId", vesselRevisionsController.getRanks);
router.get("/vessel-revisions/next-revision/:vesselId", vesselRevisionsController.getNextRevision);
router.get("/vessel-revisions/:id", vesselRevisionsController.getById);
router.post("/vessel-revisions", vesselRevisionsController.create);

router.get("/training-matrix-vessel-drafts", trainingMatrixVesselDraftsController.getAll);
router.post("/training-matrix-vessel-drafts/upsert", trainingMatrixVesselDraftsController.upsert);
router.get("/training-matrix-vessel-drafts/by-vessel/:vesselId", trainingMatrixVesselDraftsController.getByVesselId);
router.get("/training-matrix-vessel-drafts/:id", trainingMatrixVesselDraftsController.getById);
router.post("/training-matrix-vessel-drafts", trainingMatrixVesselDraftsController.create);
router.patch("/training-matrix-vessel-drafts/:id", trainingMatrixVesselDraftsController.update);
router.delete("/training-matrix-vessel-drafts/:id", trainingMatrixVesselDraftsController.delete);

router.get("/training-matrix-vessel-revisions", trainingMatrixVesselRevisionsController.getAll);
router.post("/training-matrix-vessel-revisions/submit", trainingMatrixVesselRevisionsController.submit);
router.get("/training-matrix-vessel-revisions/by-vessel/:vesselId", trainingMatrixVesselRevisionsController.getByVesselId);
router.get("/training-matrix-vessel-revisions/next-revision/:vesselId", trainingMatrixVesselRevisionsController.getNextRevision);
router.get("/training-matrix-vessel-revisions/:id", trainingMatrixVesselRevisionsController.getById);
router.post("/training-matrix-vessel-revisions", trainingMatrixVesselRevisionsController.create);

router.get("/access-control/menus", accessControlController.getAllMenus);
router.post("/access-control/menus", requireTrustedAccessControlAdmin(), accessControlController.createMenu);
router.put("/access-control/menus/:muid", requireTrustedAccessControlAdmin(), accessControlController.updateMenu);
router.delete("/access-control/menus/:muid", requireTrustedAccessControlAdmin(), accessControlController.deleteMenu);

router.get("/access-control/roles", accessControlController.getAllRoles);
router.post("/access-control/roles", requireTrustedAccessControlAdmin(), accessControlController.createRole);
router.put("/access-control/roles/:ruid", requireTrustedAccessControlAdmin(), accessControlController.updateRole);
router.delete("/access-control/roles/:ruid", requireTrustedAccessControlAdmin(), accessControlController.deleteRole);

router.get("/access-control/my-permissions", accessControlController.getMyPermissions);
router.get("/access-control/roles/:ruid/permissions", requireTrustedAccessControlAdmin(), accessControlController.getPermissions);
router.put("/access-control/roles/:ruid/permissions", requireTrustedAccessControlAdmin(), accessControlController.savePermissions);

router.get("/vessel-org-chart", vesselOrgChartController.getAll);
router.get("/vessel-org-chart/rank-scope", vesselOrgChartController.getRankScope);
router.post("/vessel-org-chart", vesselOrgChartController.saveAll);

export default router;
