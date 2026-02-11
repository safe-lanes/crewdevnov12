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
router.get("/forms/:formUuid", formsController.getByUuid);
router.post("/forms", formsController.create);
router.put("/forms/:formUuid", formsController.update);
router.delete("/forms/:formUuid", formsController.delete);

router.get("/forms/:formUuid/versions", formsController.getVersions);
router.post("/forms/:formUuid/versions", formsController.createVersion);

router.get("/rank-groups", rankGroupsController.getAll);
router.get("/rank-groups/check-assignment", rankGroupsController.checkAssignment);
router.get("/rank-groups/form/:formUuid", rankGroupsController.getByFormUuid);
router.get("/rank-groups/form/:formUuid/rank-conflicts", rankGroupsController.getRankConflicts);
router.get("/rank-groups/:rgUuid", rankGroupsController.getByUuid);
router.post("/rank-groups", rankGroupsController.create);
router.put("/rank-groups/:rgUuid", rankGroupsController.update);
router.put("/rank-groups/:rgUuid/configuration", rankGroupsController.updateConfiguration);
router.post("/rank-groups/:rgUuid/archive", rankGroupsController.archive);
router.post("/rank-groups/:rgUuid/unarchive", rankGroupsController.unarchive);
router.delete("/rank-groups/:rgUuid", rankGroupsController.delete);

router.get("/available-ranks", availableRanksController.getAll);
router.post("/available-ranks", availableRanksController.create);
router.post("/available-ranks/reorder", availableRanksController.reorder);
router.put("/available-ranks/:arUuid", availableRanksController.update);
router.delete("/available-ranks/:arUuid", availableRanksController.delete);
router.delete("/available-ranks", availableRanksController.deleteAll);

router.get("/promotion-hierarchies", promotionHierarchiesController.getAll);
router.get("/promotion-hierarchies/:phUuid", promotionHierarchiesController.getByUuid);
router.post("/promotion-hierarchies", promotionHierarchiesController.create);
router.patch("/promotion-hierarchies/:phUuid", promotionHierarchiesController.update);
router.delete("/promotion-hierarchies/:phUuid", promotionHierarchiesController.delete);

export default router;
