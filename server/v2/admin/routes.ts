import { Router } from "express";
import {
  formsController,
  rankGroupsController,
  availableRanksController,
  promotionHierarchiesController,
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

export default router;
