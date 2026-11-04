import { Request, Response } from "express";
import { z } from "zod";
import { AppraisalResultsService, FormVersionPinError } from "../services";
import {
  AppraisalRatingVersionError,
  EffectivenessConfigurationError,
} from "../../../../shared/appraisal-effectiveness";

const service = new AppraisalResultsService();

const stage1SubmissionSchema = z.object({
  expectedFormVersionId: z.unknown().optional(),
  data: z.object({
    seafarersName: z.string().min(1),
    seafarersRank: z.string().min(1),
    nationality: z.string().nullish(),
    vessel: z.string().min(1),
    appraisalType: z.string().min(1),
    signOn: z.string().optional(),
    appraisalPeriodFrom: z.string().optional(),
    appraisalPeriodTo: z.string().optional(),
    personalityIndexCategory: z.string().optional(),
    primaryAppraiser: z.string().optional(),
    trainings: z.array(z.any()).optional(),
    targets: z.array(z.any()).optional(),
  }),
  submittedBy: z.string().optional(),
});

const stage2SubmissionSchema = z.object({
  expectedFormVersionId: z.unknown().optional(),
  data: z.object({
    trainings: z.array(z.any()).optional(),
    targets: z.array(z.any()).optional(),
    competenceAssessments: z.array(z.any()).optional(),
    behaviouralAssessments: z.array(z.any()).optional(),
    trainingNeeds: z.array(z.any()).optional(),
    recommendations: z.array(z.any()).optional(),
    appraiserComments: z.array(z.any()).optional(),
    seafarerComments: z.array(z.any()).optional(),
    ...stageSectionsShape("stage2"),
    reviewers: z.array(z.object({
      userUuid: z.string().optional(),
      reviewerName: z.string().optional(),
      designation: z.string().optional(),
    })).optional(),
  }),
  create: createBodySchema.optional(),
  // Stage 1, submitted in the same transaction when it is not done yet: the
  // form has no Stage 1 button when Part B2 is hidden.
  stage1: stage1DataSchema.optional(),
  // Accepted so older clients can still submit, but ignored: the server derives
  // the ratings from the Part C/D rows (APD-49).
  competenceRating: z.string().nullable().optional(),
  behavioralRating: z.string().nullable().optional(),
  overallRating: z.string().nullable().optional(),
});

const stage3SubmissionSchema = z.object({
  expectedFormVersionId: z.unknown().optional(),
  data: z.object({
    trainings: z.array(z.any()).optional(),
    officeReviews: z.array(z.any()).optional(),
    trainingFollowups: z.array(z.any()).optional(),
  }),
  submittedBy: z.string().optional(),
});
  data: z.object(stageSectionsShape("stage3")),
});

// Appraisals are addressed by appraisal_uuid, never the serial id: serial ids
// are assigned independently on ship and shore, so they are not portable.
const appraisalUuidSchema = z.string().uuid();

function parseAppraisalUuid(req: Request, res: Response): string | null {
  const parsed = appraisalUuidSchema.safeParse(req.params.appraisalUuid);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid appraisal id" });
    return null;
  }
  return parsed.data;
}

export class AppraisalResultsController {
  async getAll(_req: Request, res: Response) {
    try {
      const appraisals = await service.getAll();
      res.json(appraisals);
    } catch (error) {
      console.error("[Appraisals V2] Failed to fetch appraisals:", error);
      res.status(500).json({ error: "Failed to fetch appraisals" });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const appraisalUuid = parseAppraisalUuid(req, res);
      if (!appraisalUuid) return;
      const appraisal = await service.getByUuid(appraisalUuid);
      if (!appraisal) {
        return res.status(404).json({ error: "Appraisal not found" });
      }
      res.json(appraisal);
    } catch (error) {
      console.error("[Appraisals V2] Failed to fetch appraisal:", error);
      res.status(500).json({ error: "Failed to fetch appraisal" });
    }
  }

  async getByCrewMember(req: Request, res: Response) {
    try {
      const crewMemberId = req.params.crewMemberId;
      const appraisals = await service.getByCrewMember(crewMemberId);
      res.json(appraisals);
    } catch (error) {
      console.error("[Appraisals V2] Failed to fetch appraisals for crew member:", error);
      res.status(500).json({ error: "Failed to fetch appraisals for crew member" });
    }
  }

  async getPromotionRecommendations(req: Request, res: Response) {
    try {
      const crewMemberId = req.params.crewMemberId;
      // `rank` is accepted for backward compatibility but no longer used to
      // filter — the count is purely by crewId across the crew's appraisals.
      const rank = (req.query.rank as string) || "";
      const result = await service.getPromotionRecommendations(crewMemberId, rank);
      res.json(result);
    } catch (error) {
      console.error("[Appraisals V2] Failed to count promotion recommendations:", error);
      res.status(500).json({ error: "Failed to count promotion recommendations" });
    }
  }

  async create(req: Request, res: Response) {
    try {
      // Optional client-chosen id: a repeat of the same create returns the
      // appraisal it first made (200) instead of a duplicate (201).
      const requestedUuid = req.body?.appraisalUuid;
      if (requestedUuid != null && !appraisalUuidSchema.safeParse(requestedUuid).success) {
        return res.status(400).json({ error: "Invalid appraisal id" });
      }
      const actor = await resolveAppraisalActor(req);
      if (!actor) return res.status(401).json({ error: SIGN_IN_ERROR });
      const { appraisal, created } = await service.create({
        ...req.body,
        submittedBy: actor.name,
        auditUserUuid: actor.userUuid,
      });
      res.status(created ? 201 : 200).json(appraisal);
    } catch (error) {
      if (error instanceof AppraisalRatingVersionError) {
        return res.status(409).json({ error: error.message });
      }
      if (error instanceof EffectivenessConfigurationError) {
        return res.status(400).json({ error: error.message });
      }
      console.error("[Appraisals V2] Failed to create appraisal:", error);
      if (error instanceof FormVersionPinError || error instanceof CrewReferenceError || error instanceof MasterReferenceError || error instanceof AppraisalRowOwnershipError || error instanceof AppraisalRowFieldLockedError) {
        return res.status(400).json({ error: error.message });
      }
      if (error instanceof AppraisalIdConflictError) {
        return res.status(409).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to create appraisal" });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const appraisalUuid = parseAppraisalUuid(req, res);
      if (!appraisalUuid) return;
      const actor = await resolveAppraisalActor(req);
      if (!actor) return res.status(401).json({ error: SIGN_IN_ERROR });
      // A browser still running the old page sends the whole form with rows
      // keyed by position; saving that would rewrite every row.
      if (req.body?.changes === undefined && req.body?.appraisalData !== undefined) {
        return res.status(400).json({ error: "This page is out of date. Please reload it and save again." });
      }
      const parsed = saveDraftSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid appraisal changes", details: parsed.error.issues });
      }
      const changes = parsed.data.changes as AppraisalChanges;
      if (getActor(req).vesselUser && PART_G_SECTIONS.some((k) => changes.sections?.[k])) {
        return res.status(403).json({ error: PART_G_SHIP_ERROR });
      }
      const appraisal = await service.update(appraisalUuid, { changes, auditUserUuid: actor.userUuid });
      if (!appraisal) {
        return res.status(404).json({ error: "Appraisal not found" });
      }
      res.json(appraisal);
    } catch (error) {
      console.error("[Appraisals V2] Failed to update appraisal:", error);
      if (error instanceof AppraisalRatingVersionError) {
        return res.status(409).json({ error: error.message });
      }
      if (error instanceof EffectivenessConfigurationError) {
        return res.status(400).json({ error: error.message });
      }
      if (error instanceof FormVersionPinError) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update appraisal" });
    }
  }

  async deleteAppraisal(req: Request, res: Response) {
    try {
      const appraisalUuid = parseAppraisalUuid(req, res);
      if (!appraisalUuid) return;
      const actor = await resolveAppraisalActor(req);
      if (!actor) return res.status(401).json({ error: SIGN_IN_ERROR });
      const deleted = await service.delete(appraisalUuid, actor.userUuid);
      if (!deleted) {
        return res.status(404).json({ error: "Appraisal not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("[Appraisals V2] Failed to delete appraisal:", error);
      res.status(500).json({ error: "Failed to delete appraisal" });
    }
  }

  async submitStage1(req: Request, res: Response) {
    try {
      const appraisalUuid = parseAppraisalUuid(req, res);
      if (!appraisalUuid) return;
      const actor = await resolveAppraisalActor(req);
      if (!actor) return res.status(401).json({ error: SIGN_IN_ERROR });
      const validationResult = stage1SubmissionSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ error: "Invalid stage 1 data", details: validationResult.error.issues });
      }
      const { data, submittedBy, expectedFormVersionId } = validationResult.data;
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const appraisal = await service.submitStage(id, "stage1", { ...data, auditUserUuid, expectedFormVersionId }, submittedBy || "Unknown");
      if (!appraisal) {
        return res.status(404).json({ error: "Appraisal not found" });
      }
      res.json(appraisal);
    } catch (error: any) {
      console.error("[Appraisals V2] Stage 1 submission error:", error);
      if (error instanceof AppraisalRatingVersionError) {
        return res.status(409).json({ error: error.message });
      }
      if (error instanceof EffectivenessConfigurationError) {
        return res.status(400).json({ error: error.message });
      }
      if (error instanceof FormVersionPinError) {
        return res.status(400).json({ error: error.message });
      }
      if (error instanceof AppraisalIdConflictError) {
        return res.status(409).json({ error: error.message });
      }
      res.status(500).json({ error: error.message || "Failed to submit stage 1" });
    }
  }

  async submitStage2(req: Request, res: Response) {
    try {
      const appraisalUuid = parseAppraisalUuid(req, res);
      if (!appraisalUuid) return;
      const actor = await resolveAppraisalActor(req);
      if (!actor) return res.status(401).json({ error: SIGN_IN_ERROR });
      const validationResult = stage2SubmissionSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ error: "Invalid stage 2 data", details: validationResult.error.issues });
      }
      const { data, submittedBy, competenceRating, behavioralRating, overallRating, expectedFormVersionId } = validationResult.data;
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      // Pass through as-is: `undefined` means "client didn't send it, don't touch existing column";
      // `null` means "client explicitly cleared it". The service only writes fields that are !== undefined.
      const appraisal = await service.submitStage(id, "stage2", { ...data, auditUserUuid, expectedFormVersionId }, submittedBy || "Unknown", {
        competenceRating,
        behavioralRating,
        overallRating,
      });
      if (!appraisal) {
        return res.status(404).json({ error: "Appraisal not found" });
      }
      res.json(appraisal);
    } catch (error: any) {
      console.error("[Appraisals V2] Stage 2 submission error:", error);
      if (error instanceof AppraisalRatingVersionError) {
        return res.status(409).json({ error: error.message });
      }
      if (error instanceof EffectivenessConfigurationError) {
        return res.status(400).json({ error: error.message });
      }
      if (error instanceof FormVersionPinError) {
        return res.status(400).json({ error: error.message });
      }
      if (error instanceof AppraisalIdConflictError) {
        return res.status(409).json({ error: error.message });
      }
      res.status(500).json({ error: error.message || "Failed to submit stage 2" });
    }
  }

  async submitStage3(req: Request, res: Response) {
    try {
      const appraisalUuid = parseAppraisalUuid(req, res);
      if (!appraisalUuid) return;
      const actor = await resolveAppraisalActor(req);
      if (!actor) return res.status(401).json({ error: SIGN_IN_ERROR });
      // Stage 3 only writes Part G, which is office-owned.
      if (getActor(req).vesselUser) {
        return res.status(403).json({ error: PART_G_SHIP_ERROR });
      }
      const validationResult = stage3SubmissionSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ error: "Invalid stage 3 data", details: validationResult.error.issues });
      }
      const { data, submittedBy, expectedFormVersionId } = validationResult.data;
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const appraisal = await service.submitStage(id, "stage3", { ...data, auditUserUuid, expectedFormVersionId }, submittedBy || "Unknown");
      if (!appraisal) {
        return res.status(404).json({ error: "Appraisal not found" });
      }
      res.json(appraisal);
    } catch (error: any) {
      console.error("[Appraisals V2] Stage 3 submission error:", error);
      if (error instanceof AppraisalRatingVersionError) {
        return res.status(409).json({ error: error.message });
      }
      if (error instanceof EffectivenessConfigurationError) {
        return res.status(400).json({ error: error.message });
      }
      if (error instanceof FormVersionPinError) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: error.message || "Failed to submit stage 3" });
    }
  }
}
