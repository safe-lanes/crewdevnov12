import { Request, Response } from "express";
import { PromotionReviewsService } from "../services";
import { promotionReviewWritableSchema, PromotionGuardError } from "../services/promotionReviewsService";

const service = new PromotionReviewsService();

export class PromotionReviewsController {
  async getCriteriaMaster(_req: Request, res: Response) {
    try {
      const criteria = await service.getCriteriaMaster();
      res.json(criteria);
    } catch (error) {
      console.error("[Promotions V2] Failed to fetch criteria master:", error);
      res.status(500).json({ error: "Failed to fetch criteria master" });
    }
  }

  async getAllReviews(_req: Request, res: Response) {
    try {
      const reviews = await service.getAllReviews();
      res.json(reviews);
    } catch (error) {
      console.error("[Promotions V2] Failed to fetch reviews:", error);
      res.status(500).json({ error: "Failed to fetch promotion reviews" });
    }
  }

  async getReviewByUuid(req: Request, res: Response) {
    try {
      const { reviewUuid } = req.params;
      const review = await service.getReviewByUuid(reviewUuid);
      if (!review) return res.status(404).json({ error: "Promotion review not found" });
      res.json(review);
    } catch (error) {
      console.error("[Promotions V2] Failed to fetch review:", error);
      res.status(500).json({ error: "Failed to fetch promotion review" });
    }
  }

  async getReviewById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const review = await service.getReviewById(id);
      if (!review) return res.status(404).json({ error: "Promotion review not found" });
      res.json(review);
    } catch (error) {
      console.error("[Promotions V2] Failed to fetch review:", error);
      res.status(500).json({ error: "Failed to fetch promotion review" });
    }
  }

  async getReviewsByCrewMember(req: Request, res: Response) {
    try {
      const { crewMemberId } = req.params;
      const reviews = await service.getReviewsByCrewMember(crewMemberId);
      res.json(reviews);
    } catch (error) {
      console.error("[Promotions V2] Failed to fetch reviews for crew:", error);
      res.status(500).json({ error: "Failed to fetch promotion reviews" });
    }
  }

  async getReviewByCrewAndRank(req: Request, res: Response) {
    try {
      const { crewMemberId, promotionToRank } = req.params;
      const review = await service.getReviewByCrewAndRank(crewMemberId, decodeURIComponent(promotionToRank));
      if (!review) return res.status(404).json({ error: "Promotion review not found" });
      res.json(review);
    } catch (error) {
      console.error("[Promotions V2] Failed to fetch review:", error);
      res.status(500).json({ error: "Failed to fetch promotion review" });
    }
  }

  async createReview(req: Request, res: Response) {
    try {
      const parsed = promotionReviewWritableSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid promotion review payload", details: parsed.error.flatten() });
      }
      const review = await service.createReview(parsed.data);
      console.log(`[Promotions V2] Created review ${review?.reviewUuid} for crew ${review?.crewMemberId}`);
      res.status(201).json(review);
    } catch (error) {
      if (error instanceof PromotionGuardError) {
        return res.status(400).json({ error: error.message });
      }
      console.error("[Promotions V2] Failed to create review:", error);
      res.status(500).json({ error: "Failed to create promotion review" });
    }
  }

  async updateReview(req: Request, res: Response) {
    try {
      const { reviewUuid } = req.params;
      const parsed = promotionReviewWritableSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid promotion review payload", details: parsed.error.flatten() });
      }
      const review = await service.updateReview(reviewUuid, parsed.data);
      if (!review) return res.status(404).json({ error: "Promotion review not found" });
      console.log(`[Promotions V2] Updated review ${reviewUuid}`);
      res.json(review);
    } catch (error) {
      if (error instanceof PromotionGuardError) {
        return res.status(400).json({ error: error.message });
      }
      console.error("[Promotions V2] Failed to update review:", error);
      res.status(500).json({ error: "Failed to update promotion review" });
    }
  }

  async deleteReview(req: Request, res: Response) {
    try {
      const { reviewUuid } = req.params;
      const deleted = await service.deleteReview(reviewUuid);
      if (!deleted) return res.status(404).json({ error: "Promotion review not found" });
      console.log(`[Promotions V2] Deleted review ${reviewUuid}`);
      res.json({ success: true });
    } catch (error) {
      console.error("[Promotions V2] Failed to delete review:", error);
      res.status(500).json({ error: "Failed to delete promotion review" });
    }
  }
}
