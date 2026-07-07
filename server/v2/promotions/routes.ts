import { Router } from "express";
import { PromotionReviewsController } from "./controllers";

const router = Router();
const controller = new PromotionReviewsController();

router.get("/criteria-master", (req, res) => controller.getCriteriaMaster(req, res));
router.get("/reviews", (req, res) => controller.getAllReviews(req, res));
router.get("/reviews/by-uuid/:reviewUuid", (req, res) => controller.getReviewByUuid(req, res));
router.get("/reviews/by-id/:id", (req, res) => controller.getReviewById(req, res));
router.get("/reviews/crew/:crewMemberId", (req, res) => controller.getReviewsByCrewMember(req, res));
router.get("/reviews/crew/:crewMemberId/rank/:promotionToRank", (req, res) => controller.getReviewByCrewAndRank(req, res));
router.post("/reviews/backfill", (req, res) => controller.runHistoricalBackfill(req, res));
router.post("/reviews", (req, res) => controller.createReview(req, res));
router.patch("/reviews/:reviewUuid", (req, res) => controller.updateReview(req, res));
router.delete("/reviews/:reviewUuid", (req, res) => controller.deleteReview(req, res));
router.get("/attachments/:attUuid/raw", (req, res) => controller.serveRawAttachment(req, res));

export default router;
