import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { companyFormSubmissionsService } from "./submissionsService";
import { fileStorageService } from "../shared/fileStorageService";

const router = Router();
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