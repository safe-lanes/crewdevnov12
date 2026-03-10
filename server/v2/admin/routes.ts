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

const router = Router();

router.get("/forms", formsController.getAll);
router.get("/forms/for-rank/:rankLabel", formsController.getFormForRank);
router.post("/forms/cleanup-duplicates", formsController.cleanupDuplicates);
router.get("/forms/:id", formsController.getById);
router.post("/forms", formsController.create);
router.put("/forms/:id", formsController.update);
router.delete("/forms/:id", formsController.delete);

router.get("/forms/:id/versions", formsController.getVersions);
router.post("/forms/:id/versions", formsController.createVersion);

router.get("/form-versions/:id", formsController.getVersionById);
router.put("/form-versions/:id", formsController.updateVersion);
router.post("/form-versions/:id/release", formsController.releaseVersion);
router.delete("/form-versions/:id", formsController.deleteVersion);

router.get("/rank-groups", rankGroupsController.getAll);
router.get("/rank-groups/check-assignment", rankGroupsController.checkAssignment);
router.get("/rank-groups/form/:formId", rankGroupsController.getByFormId);
router.get("/rank-groups/form/:formId/rank-conflicts", rankGroupsController.getRankConflicts);
router.get("/rank-groups/:id", rankGroupsController.getById);
router.post("/rank-groups", rankGroupsController.create);
router.put("/rank-groups/:id", rankGroupsController.update);
router.put("/rank-groups/:id/configuration", rankGroupsController.updateConfiguration);
router.post("/rank-groups/:id/archive", rankGroupsController.archive);
router.post("/rank-groups/:id/unarchive", rankGroupsController.unarchive);
router.delete("/rank-groups/:id", rankGroupsController.delete);

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
router.post("/access-control/menus", accessControlController.createMenu);
router.put("/access-control/menus/:muid", accessControlController.updateMenu);
router.delete("/access-control/menus/:muid", accessControlController.deleteMenu);

router.get("/access-control/roles", accessControlController.getAllRoles);
router.post("/access-control/roles", accessControlController.createRole);
router.put("/access-control/roles/:ruid", accessControlController.updateRole);
router.delete("/access-control/roles/:ruid", accessControlController.deleteRole);

router.get("/access-control/my-permissions", accessControlController.getMyPermissions);
router.get("/access-control/roles/:ruid/permissions", accessControlController.getPermissions);
router.put("/access-control/roles/:ruid/permissions", accessControlController.savePermissions);

router.get("/vessel-org-chart", vesselOrgChartController.getAll);
router.post("/vessel-org-chart", vesselOrgChartController.saveAll);

export default router;
