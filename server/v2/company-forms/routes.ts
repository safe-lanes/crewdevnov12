import { Router, type Request, type Response } from "express";
import { outstandingCompanyForms } from "./outstandingReport";
import { requirePermission } from "../../middleware/requirePermission";
import { z } from "zod";
import { companyFormSubmissionsService } from "./submissionsService";
import { fileStorageService } from "../shared/fileStorageService";
import { getBranding, saveBranding } from "./documentBranding";
import { copyStatus, downloadCopy, retryCopy } from "./documentCopyService";
import { recordHandover } from "./documentHandover";

const router = Router();
router.post("/:submissionUuid/pdf/void-notice-handover", async (req, res) => {
  const body = z.object({ fileSha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict().safeParse(req.body);
  if (!body.success || !z.string().uuid().safeParse(req.params.submissionUuid).success) {
    res.status(400).json({ message: "Select the current annotated copy. Handover identity and time are recorded by the server." }); return;
  }
  try { res.status(201).json(await recordHandover(req, req.params.submissionUuid, body.data.fileSha256, true)); }
  catch (error) { sendError(res, error); }
});
router.post("/:submissionUuid/pdf/handover", async (req, res) => {
  const body = z.object({ fileSha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict().safeParse(req.body);
  if (!body.success || !z.string().uuid().safeParse(req.params.submissionUuid).success) {
    res.status(400).json({ message: "Select the current stored copy. Handover identity and time are recorded by the server." }); return;
  }
  try { res.status(201).json(await recordHandover(req, req.params.submissionUuid, body.data.fileSha256)); }
  catch (error) { sendError(res, error); }
});
router.get("/:submissionUuid/pdf/status", async (req, res) => {
  if (!z.string().uuid().safeParse(req.params.submissionUuid).success) { res.status(400).json({ message: "Select a valid form." }); return; }
  try { res.json(await copyStatus(req, req.params.submissionUuid)); } catch (error) { sendError(res, error); }
});
router.get("/:submissionUuid/pdf", async (req, res) => {
  if (!z.string().uuid().safeParse(req.params.submissionUuid).success) { res.status(400).json({ message: "Select a valid form." }); return; }
  try {
    const bytes = await downloadCopy(req, req.params.submissionUuid);
    res.set({ "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="company-form.pdf"',
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" }).send(bytes);
  } catch (error) { sendError(res, error); }
});
router.post("/:submissionUuid/pdf/retry", async (req, res) => {
  if (!z.string().uuid().safeParse(req.params.submissionUuid).success || !z.object({}).strict().safeParse(req.body).success) {
    res.status(400).json({ message: "Supply only the form to retry." }); return;
  }
  try { res.json(await retryCopy(req, req.params.submissionUuid)); } catch (error) { sendError(res, error); }
});
router.get("/settings/branding", async (req, res) => {
  try { res.json(await getBranding(req)); } catch (error) { sendError(res, error); }
});
router.post("/settings/branding", async (req, res) => {
  try { res.json(await saveBranding(req)); } catch (error) { sendError(res, error); }
});
router.get("/outstanding", async (req, res) => {
  try { res.json(await outstandingCompanyForms(req)); }
  catch (error) { sendError(res, error); }
});
router.get("/subjects/:subjectType/:subjectRef/requirements/:requirementUuid/definition", async (req, res) => {
  const parsed = paramsSchema.extend({ requirementUuid: z.string().uuid() }).safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ message: "Select a valid form requirement." }); return; }
  try { res.json(await companyFormSubmissionsService.readRequirementDefinition({ req, ...parsed.data })); }
  catch (error) { sendError(res, error); }
});
router.post("/subjects/:subjectType/:subjectRef/checks/:eventUuid/retry", async (req, res) => {
  const parsed = paramsSchema.extend({ eventUuid: z.string().uuid() }).safeParse(req.params);
  if (!parsed.success || !z.object({}).strict().safeParse(req.body).success) {
    res.status(400).json({ error: "invalid_request", message: "Only the stage check identity may be supplied." }); return;
  }
  try { res.json(await companyFormSubmissionsService.retryStageCheck({ req, ...parsed.data })); }
  catch (error) { sendError(res, error); }
});
router.get("/subjects/:subjectType/:subjectRef/requirements", async (req, res) => {
  const parsed = paramsSchema.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: "invalid_request" }); return; }
  try { res.json(await companyFormSubmissionsService.requirements({ req, ...parsed.data })); }
  catch (error) { sendError(res, error); }
});
router.post("/subjects/:subjectType/:subjectRef/requirements/:requirementUuid/start", async (req, res) => {
  const parsed = paramsSchema.extend({ requirementUuid: z.string().uuid() }).safeParse(req.params);
  if (!parsed.success || !z.object({}).strict().safeParse(req.body).success) {
    res.status(400).json({ error: "invalid_request", message: "Only the requirement identity may be supplied." }); return;
  }
  try { res.status(201).json(await companyFormSubmissionsService.startRequirement({ req, ...parsed.data })); }
  catch (error) { sendError(res, error); }
});
router.post("/subjects/:subjectType/submission-counts", async (req, res) => {
  const body = z.object({ subjectRefs: z.array(z.string().uuid()).min(1).max(200),
    stageKey: z.string().min(1).max(100) }).strict().safeParse(req.body);
  if (!body.success || !/^[a-z][a-z0-9_]{0,99}$/.test(req.params.subjectType)) {
    res.status(400).json({ error: "invalid_request", message: "Invalid scoped form count request." }); return;
  }
  try {
    res.json(await companyFormSubmissionsService.countsForSubjects({ req, subjectType: req.params.subjectType, ...body.data }));
  } catch (error) { sendError(res, error); }
});
const subjectTypeSchema = z.string().regex(/^[a-z][a-z0-9_]{0,99}$/);
const subjectRefSchema = z.string().trim().min(1).max(200);
const paramsSchema = z.object({
  subjectType: subjectTypeSchema,
  subjectRef: subjectRefSchema,
}).strict();
const homeParamsSchema = z.object({
  subjectType: subjectTypeSchema,
  homeRef: subjectRefSchema,
}).strict();
const eligibleQuerySchema = z.object({
  stageKey: z.string().trim().min(1).max(100).optional(),
  crewUuid: z.string().uuid().optional(),
  vesselUuid: z.string().uuid().optional(),
  planUuid: z.string().uuid().optional(),
}).strict();
const createBodySchema = z.object({
  formUuid: z.string().uuid(),
  formVersionUuid: z.string().uuid(),
}).strict();
const submissionParamsSchema = z.object({
  submissionUuid: z.string().uuid(),
}).strict();
const assetParamsSchema = submissionParamsSchema.extend({
  assetUuid: z.string().uuid(),
}).strict();
const sectionParamsSchema = submissionParamsSchema.extend({
  sectionUuid: z.string().uuid(),
}).strict();
const signatureParamsSchema = sectionParamsSchema.extend({
  signatureUuid: z.string().uuid(),
}).strict();
const draftAnswerSchema = z.object({
  questionUuid: z.string().uuid(),
  value: z.union([
    z.string().max(20000),
    z.array(z.string().max(500)).max(100),
    z.boolean(),
    z.null(),
  ]),
  comment: z.string().trim().max(5000).nullable().optional(),
}).strict();
const draftBodySchema = z.object({
  answers: z.array(draftAnswerSchema).max(300),
  sectionComment: z.string().max(20000).nullable().optional(),
}).strict().superRefine((body, context) => {
  if (body.answers.length === 0 && body.sectionComment === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide at least one answer or a section comment to save.",
    });
  }
  const questionUuids = new Set<string>();
  body.answers.forEach((answer, index) => {
    if (questionUuids.has(answer.questionUuid)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["answers", index, "questionUuid"],
        message: "A question may appear only once in a draft update.",
      });
    }
    questionUuids.add(answer.questionUuid);
  });
});
const sectionSubmitBodySchema = z.object({}).strict();
const signatureBodySchema = z.object({
  signatureType: z.enum(["officer", "seafarer", "vessel_management"]),
  method: z.enum(["officer", "authenticated", "witnessed", "vessel_management"]),
  data: z.string().max(7_000_000),
  seafarerPresent: z.boolean().optional(),
}).strict();
const voidBodySchema = z.object({
  reason: z.string().trim().min(1).max(5000),
  retirementConfirmedAt: z.string().datetime().optional(),
}).strict();

function sendError(res: Response, error: unknown): void {
  if (
    error &&
    typeof error === "object" &&
    "statusCode" in error &&
    typeof error.statusCode === "number" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    const code = "code" in error && typeof error.code === "string" ? error.code : "error";
    res.status(error.statusCode).json({ error: code, message: error.message });
    return;
  }
  console.error("[CompanyForms] submission request failed:", error);
  res.status(500).json({
    error: "server_error",
    message: "Unable to process the Company Form request.",
  });
}

function parseParams<T extends z.ZodTypeAny>(
  schema: T,
  req: Request,
  res: Response,
): z.infer<T> | undefined {
  const parsed = schema.safeParse(req.params);
  if (parsed.success) return parsed.data;
  res.status(400).json({ error: "invalid_request", message: "Invalid route parameters.", details: parsed.error.issues });
  return undefined;
}

router.get("/:submissionUuid/attachments/:assetUuid/raw", async (req, res) => {
  const params = parseParams(assetParamsSchema, req, res);
  if (!params) return;
  try {
    const attachment = await companyFormSubmissionsService.readSubmissionAsset({
      req,
      submissionUuid: params.submissionUuid,
      assetUuid: params.assetUuid,
    });
    const { stream, mimeType } = await fileStorageService.readAttachment(attachment.filePath);
    res.type(mimeType);
    stream.pipe(res);
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/subjects/:subjectType/:subjectRef/dimensions", requirePermission("Forms", "view"), async (req, res) => {
  const params = parseParams(paramsSchema, req, res);
  if (!params) return;
  try { res.json(await companyFormSubmissionsService.dimensions({ req, ...params })); }
  catch (error) { sendError(res, error); }
});

router.get("/:submissionUuid/form", async (req, res) => {
  const params = parseParams(submissionParamsSchema, req, res);
  if (!params) return;
  try {
    res.json(await companyFormSubmissionsService.readSubmissionForm({
      req,
      submissionUuid: params.submissionUuid,
    }));
  } catch (error) {
    sendError(res, error);
  }
});

router.put("/:submissionUuid/sections/:sectionUuid/answers", async (req, res) => {
  const params = parseParams(sectionParamsSchema, req, res);
  if (!params) return;
  const body = draftBodySchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({
      error: "invalid_request",
      message: "Invalid Company Form draft update.",
      details: body.error.issues,
    });
    return;
  }
  try {
    await companyFormSubmissionsService.updateDraftAnswers({
      req,
      submissionUuid: params.submissionUuid,
      sectionUuid: params.sectionUuid,
      answers: body.data.answers,
      sectionComment: body.data.sectionComment,
    });
    res.status(204).end();
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/:submissionUuid/sections/:sectionUuid/submit", async (req, res) => {
  const params = parseParams(sectionParamsSchema, req, res);
  if (!params) return;
  const body = sectionSubmitBodySchema.safeParse(req.body ?? {});
  if (!body.success) {
    res.status(400).json({ error: "invalid_request", message: "Section submission accepts no request fields." });
    return;
  }
  try {
    res.json(await companyFormSubmissionsService.submitSection({
      req,
      submissionUuid: params.submissionUuid,
      sectionUuid: params.sectionUuid,
    }));
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/:submissionUuid/sections/:sectionUuid/signatures", async (req, res) => {
  const params = parseParams(sectionParamsSchema, req, res);
  if (!params) return;
  const body = signatureBodySchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({
      error: "invalid_request",
      message: "Invalid Company Form signature.",
      details: body.error.issues,
    });
    return;
  }
  try {
    res.status(201).json(await companyFormSubmissionsService.saveSignature({
      req,
      submissionUuid: params.submissionUuid,
      sectionUuid: params.sectionUuid,
      ...body.data,
    }));
  } catch (error) {
    sendError(res, error);
  }
});

router.delete("/:submissionUuid/sections/:sectionUuid/signatures/:signatureUuid", async (req, res) => {
  const params = parseParams(signatureParamsSchema, req, res);
  if (!params) return;
  try {
    await companyFormSubmissionsService.removeSignature({
      req,
      submissionUuid: params.submissionUuid,
      sectionUuid: params.sectionUuid,
      signatureUuid: params.signatureUuid,
    });
    res.status(204).end();
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/:submissionUuid/void", async (req, res) => {
  const params = parseParams(submissionParamsSchema, req, res);
  if (!params) return;
  const body = voidBodySchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({
      error: "invalid_request",
      message: "A written Company Form void reason is required.",
      details: body.error.issues,
    });
    return;
  }
  try {
    await companyFormSubmissionsService.voidSubmission({
      req,
      submissionUuid: params.submissionUuid,
      reason: body.data.reason,
      retirementConfirmedAt: body.data.retirementConfirmedAt,
    });
    res.status(204).end();
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/:submissionUuid", async (req, res) => {
  const params = parseParams(submissionParamsSchema, req, res);
  if (!params) return;
  try {
    res.json(await companyFormSubmissionsService.readSubmission({
      req,
      submissionUuid: params.submissionUuid,
    }));
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/subjects/:subjectType/:subjectRef/eligible-forms", async (req, res) => {
  const params = parseParams(paramsSchema, req, res);
  if (!params) return;
  const query = eligibleQuerySchema.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "invalid_request", message: "Invalid query parameters.", details: query.error.issues });
    return;
  }
  try {
    res.json(await companyFormSubmissionsService.eligibleForms({
      req,
      subjectType: params.subjectType,
      subjectRef: params.subjectRef,
      stageKey: query.data.stageKey,
    }));
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/subjects/:subjectType/:subjectRef/submissions", async (req, res) => {
  const params = parseParams(paramsSchema, req, res);
  if (!params) return;
  const body = createBodySchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "invalid_request", message: "Invalid Company Form start request.", details: body.error.issues });
    return;
  }
  try {
    res.status(201).json(await companyFormSubmissionsService.create({
      req,
      subjectType: params.subjectType,
      subjectRef: params.subjectRef,
      formUuid: body.data.formUuid,
      formVersionUuid: body.data.formVersionUuid,
    }));
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/subjects/:subjectType/:subjectRef/submissions/count", async (req, res) => {
  const params = parseParams(paramsSchema, req, res);
  if (!params) return;
  try {
    res.json(await companyFormSubmissionsService.countForSubject({
      req,
      subjectType: params.subjectType,
      subjectRef: params.subjectRef,
    }));
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/subjects/:subjectType/:subjectRef/submissions", async (req, res) => {
  const params = parseParams(paramsSchema, req, res);
  if (!params) return;
  try {
    res.json(await companyFormSubmissionsService.listForSubject({
      req,
      subjectType: params.subjectType,
      subjectRef: params.subjectRef,
    }));
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/subjects/:subjectType/home/:homeRef/submissions", async (req, res) => {
  const params = parseParams(homeParamsSchema, req, res);
  if (!params) return;
  try {
    res.json(await companyFormSubmissionsService.listForHome({
      req,
      subjectType: params.subjectType,
      homeRef: params.homeRef,
    }));
  } catch (error) {
    sendError(res, error);
  }
});

export default router;