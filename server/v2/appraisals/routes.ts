import { Router } from "express";
import { AppraisalResultsController } from "./controllers";

const router = Router();
const controller = new AppraisalResultsController();

router.get("/", (req, res) => controller.getAll(req, res));
router.get("/crew/:crewMemberId/promotion-recommendations", (req, res) => controller.getPromotionRecommendations(req, res));
router.get("/crew/:crewMemberId", (req, res) => controller.getByCrewMember(req, res));
router.get("/:appraisalUuid", (req, res) => controller.getById(req, res));
router.post("/", (req, res) => controller.create(req, res));
router.put("/:appraisalUuid", (req, res) => controller.update(req, res));
router.delete("/:appraisalUuid", (req, res) => controller.deleteAppraisal(req, res));
router.post("/:appraisalUuid/submit-stage1", (req, res) => controller.submitStage1(req, res));
router.post("/:appraisalUuid/submit-stage2", (req, res) => controller.submitStage2(req, res));
router.post("/:appraisalUuid/submit-stage3", (req, res) => controller.submitStage3(req, res));

export default router;
