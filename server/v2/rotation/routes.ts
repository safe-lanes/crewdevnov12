import { Router } from "express";
import { 
  rotationCrewController, 
  rotationDraftsController, 
  rotationEntriesController,
  rotationArchiveController,
  rotationDueCrewController 
} from "./controllers";

const router = Router();

router.get("/crew/by-rank/:rank", rotationCrewController.getByRank);
router.post("/crew/compliance-filter", rotationCrewController.complianceFilter);

router.get("/proposals", rotationDraftsController.getProposals);
router.get("/drafts", rotationDraftsController.getAll);
router.get("/drafts/:draftUuid", rotationDraftsController.getByDraftUuid);
router.post("/drafts", rotationDraftsController.create);
router.patch("/drafts/:draftUuid", rotationDraftsController.update);
router.post("/drafts/:draftUuid/propose", rotationDraftsController.propose);
router.post("/drafts/:draftUuid/archive", rotationDraftsController.archive);
router.post("/drafts/:draftUuid/unarchive", rotationDraftsController.unarchive);
router.delete("/drafts/:draftUuid", rotationDraftsController.delete);

router.post("/drafts/:draftUuid/vessels", rotationDraftsController.addVessel);
router.delete("/draft-vessels/:rvUuid", rotationDraftsController.removeVessel);
router.post("/drafts/:draftUuid/ranks", rotationDraftsController.addRank);
router.delete("/draft-ranks/:rrUuid", rotationDraftsController.removeRank);

router.get("/entries/:entryUuid", rotationEntriesController.getByEntryUuid);
router.post("/entries", rotationEntriesController.create);
router.patch("/entries/:entryUuid", rotationEntriesController.update);
router.post("/entries/:entryUuid/deploy", rotationEntriesController.deploy);
router.post("/entries/:entryUuid/reject", rotationEntriesController.reject);
router.delete("/entries/:entryUuid", rotationEntriesController.delete);

router.get("/due-crew", rotationDueCrewController.getDueCrew);

router.get("/archive", rotationArchiveController.getAll);

export default router;
