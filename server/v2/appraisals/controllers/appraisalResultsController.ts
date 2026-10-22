import { Request, Response } from "express";
import { z } from "zod";
import { AppraisalResultsService, FormVersionPinError, CrewReferenceError, AppraisalIdConflictError } from "../services";

const service = new AppraisalResultsService();

const stage1SubmissionSchema = z.object({
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
  data: z.object({
    competenceAssessments: z.array(z.any()).optional(),
    behaviouralAssessments: z.array(z.any()).optional(),
    trainingNeeds: z.array(z.any()).optional(),
    recommendations: z.array(z.any()).optional(),
    appraiserComments: z.array(z.any()).optional(),
    seafarerComments: z.array(z.any()).optional(),
    reviewers: z.array(z.object({
      userUuid: z.string().optional(),
      reviewerName: z.string().optional(),
      designation: z.string().optional(),
    })).optional(),
  }),
  submittedBy: z.string().optional(),
  competenceRating: z.string().nullable().optional(),
  behavioralRating: z.string().nullable().optional(),
  overallRating: z.string().nullable().optional(),
});

const stage3SubmissionSchema = z.object({
  data: z.object({
    officeReviews: z.array(z.any()).optional(),
    trainingFollowups: z.array(z.any()).optional(),
  }),
  submittedBy: z.string().optional(),
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
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const { appraisal, created } = await service.create({ ...req.body, auditUserUuid });
      res.status(created ? 201 : 200).json(appraisal);
    } catch (error) {
      console.error("[Appraisals V2] Failed to create appraisal:", error);
      if (error instanceof FormVersionPinError || error instanceof CrewReferenceError) {
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
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const appraisal = await service.update(appraisalUuid, { ...req.body, auditUserUuid });
      if (!appraisal) {
        return res.status(404).json({ error: "Appraisal not found" });
      }
      res.json(appraisal);
    } catch (error) {
      console.error("[Appraisals V2] Failed to update appraisal:", error);
      if (error instanceof FormVersionPinError || error instanceof CrewReferenceError) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update appraisal" });
    }
  }

  async deleteAppraisal(req: Request, res: Response) {
    try {
      const appraisalUuid = parseAppraisalUuid(req, res);
      if (!appraisalUuid) return;
      const deleted = await service.delete(appraisalUuid);
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
      const validationResult = stage1SubmissionSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ error: "Invalid stage 1 data", details: validationResult.error.issues });
      }
      const { data, submittedBy } = validationResult.data;
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const appraisal = await service.submitStage(appraisalUuid, "stage1", { ...data, auditUserUuid }, submittedBy || "Unknown");
      if (!appraisal) {
        return res.status(404).json({ error: "Appraisal not found" });
      }
      res.json(appraisal);
    } catch (error: any) {
      console.error("[Appraisals V2] Stage 1 submission error:", error);
      if (error instanceof FormVersionPinError) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: error.message || "Failed to submit stage 1" });
    }
  }

  async submitStage2(req: Request, res: Response) {
    try {
      const appraisalUuid = parseAppraisalUuid(req, res);
      if (!appraisalUuid) return;
      const validationResult = stage2SubmissionSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ error: "Invalid stage 2 data", details: validationResult.error.issues });
      }
      const { data, submittedBy, competenceRating, behavioralRating, overallRating } = validationResult.data;
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      // Pass through as-is: `undefined` means "client didn't send it, don't touch existing column";
      // `null` means "client explicitly cleared it". The service only writes fields that are !== undefined.
      const appraisal = await service.submitStage(appraisalUuid, "stage2", { ...data, auditUserUuid }, submittedBy || "Unknown", {
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
      if (error instanceof FormVersionPinError) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: error.message || "Failed to submit stage 2" });
    }
  }

  async submitStage3(req: Request, res: Response) {
    try {
      const appraisalUuid = parseAppraisalUuid(req, res);
      if (!appraisalUuid) return;
      const validationResult = stage3SubmissionSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ error: "Invalid stage 3 data", details: validationResult.error.issues });
      }
      const { data, submittedBy } = validationResult.data;
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const appraisal = await service.submitStage(appraisalUuid, "stage3", { ...data, auditUserUuid }, submittedBy || "Unknown");
      if (!appraisal) {
        return res.status(404).json({ error: "Appraisal not found" });
      }
      res.json(appraisal);
    } catch (error: any) {
      console.error("[Appraisals V2] Stage 3 submission error:", error);
      if (error instanceof FormVersionPinError) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: error.message || "Failed to submit stage 3" });
    }
  }
}
