import { Request, Response } from "express";
import { PromotionReviewsService } from "../services";
import { promotionReviewWritableSchema, PromotionGuardError } from "../services/promotionReviewsService";
import { getDb } from "../../db.js";
import { promoChecklistAttachmentsV2 } from "../../../../shared/v2/promotions/schema.js";
import { eq, and } from "drizzle-orm";
import { serveAttachmentFromFilePath } from "../../shared/serveAttachmentHelper.js";

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

  async runHistoricalBackfill(req: Request, res: Response) {
    try {
      // Safe by default: only writes when ?dryRun=false is explicitly passed.
      const dryRun = String(req.query.dryRun ?? "true").toLowerCase() !== "false";
      const actorUuid = req.user?.id != null ? String(req.user.id) : null;
      const result = await service.applyHistoricalBackfill({ dryRun, actorUuid });
      console.log(
        `[Promotions V2] Historical backfill ${dryRun ? "dry-run" : "live"}: ` +
          `${result.applied} applied, ${result.alreadyApplied} already applied, ` +
          `${result.ineligible} ineligible, ${result.errors.length} error(s)`,
      );
      res.json(result);
    } catch (error) {
      console.error("[Promotions V2] Failed to run historical backfill:", error);
      res.status(500).json({ error: "Failed to run historical promotion backfill" });
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

  async serveRawAttachment(req: Request, res: Response) {
    try {
      const { attUuid } = req.params;
      if (!attUuid) {
        return res.status(400).json({ error: "attUuid is required" });
      }

      const db = getDb();
      const results = await db
        .select()
        .from(promoChecklistAttachmentsV2)
        .where(
          and(
            eq(promoChecklistAttachmentsV2.attUuid, attUuid),
            eq(promoChecklistAttachmentsV2.isDeleted, false)
          )
        )
        .limit(1);

      const attachment = results[0];
      if (!attachment) {
        return res.status(404).json({ error: "Attachment not found" });
      }

      await serveAttachmentFromFilePath(res, {
        filePath: attachment.filePath,
        fileData: null,
        fileName: attachment.fileName,
        fileType: attachment.fileType,
      });
    } catch (error) {
      console.error("[Promotions V2] Failed to serve raw attachment:", error);
      res.status(500).json({ error: "Failed to serve raw attachment" });
    }
  }
}
