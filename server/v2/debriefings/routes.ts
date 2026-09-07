import { Router } from "express";
import { z } from "zod";
import { debriefingController } from "./controller";

const router = Router();
const uuid = z.string().uuid();
const create = z.object({ debriefingUuid: uuid }).strict();
const resolveCreation = z.object({ debriefingUuid: uuid }).strict();
const partA = z.object({
  debriefingDate: z.string().date().nullable(),
  modeOfDebriefing: z.enum(["company_office", "manning_agent", "video_call"]).nullable(),
}).strict();
const partC = z.object({ officeReviewComments: z.string().max(10000).nullable() }).strict();
const answerValue = z.union([z.string().max(10000),z.array(z.string().max(500)).max(100),z.boolean(),z.null()]);
const answerItem = z.object({
  questionUuid: uuid,
  value: answerValue,
  comment: z.string().max(10000).nullable().optional(),
}).strict();
const answers = z.object({
  answers: z.union([
    z.array(answerItem).max(500),
    z.record(z.string().uuid(), z.object({
      value: answerValue,
      comment: z.string().max(10000).nullable().optional(),
    }).strict()),
  ]),
  sectionComment: z.string().max(10000).nullable().optional(),
}).strict();
const signature = z.object({
  type: z.enum(["officer", "seafarer"]),
  data: z.string().max(7_000_000),
  signerName: z.string().trim().min(1).max(500).optional(),
  signerRank: z.string().trim().min(1).max(500).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.type === "seafarer" && !value.signerName) ctx.addIssue({ code: "custom", path: ["signerName"], message: "Seafarer name is required" });
  if (value.type === "seafarer" && !value.signerRank) ctx.addIssue({ code: "custom", path: ["signerRank"], message: "Seafarer rank is required" });
});
const submit = z.object({ comment:z.string().max(10000).nullable().optional() }).strict();
function body(schema: z.ZodTypeAny, action: any) { return (req:any,res:any,next:any) => { const parsed=schema.safeParse(req.body); if(!parsed.success) return res.status(400).json({error:"Invalid request",details:parsed.error.issues}); req.body=parsed.data; return action(req,res,next); }; }
function params(keys: string[], action: any) { return (req:any,res:any,next:any) => { const parsed=z.object(Object.fromEntries(keys.map(k=>[k,k === "type" ? z.enum(["officer", "seafarer"]) : uuid]))).safeParse(req.params); if(!parsed.success) return res.status(400).json({error:"Invalid route parameters",details:parsed.error.issues}); req.params = parsed.data; return action(req,res,next); }; }
function query(schema: z.ZodTypeAny, action: any) { return (req:any,res:any,next:any) => { const parsed=schema.safeParse(req.query); if(!parsed.success) return res.status(400).json({error:"Invalid query",details:parsed.error.issues}); req.query=parsed.data; return action(req,res,next); }; }
router.get("/resolve-creation", query(resolveCreation, debriefingController.resolveCreation));
router.post("/submissions", body(create, debriefingController.create));
router.get("/submissions/crew/:crewUuid", params(["crewUuid"], debriefingController.list));
router.get("/submissions/:uuid", params(["uuid"], debriefingController.get));
router.put("/submissions/:uuid/part-a", params(["uuid"], body(partA, debriefingController.partA)));
router.put("/submissions/:uuid/part-c", params(["uuid"], body(partC, debriefingController.partC)));
router.put("/submissions/:uuid/sections/:sectionUuid/answers", params(["uuid","sectionUuid"], body(answers, debriefingController.answers)));
router.post("/submissions/:uuid/sections/:sectionUuid/signature", params(["uuid","sectionUuid"], body(signature, debriefingController.signature)));
router.delete("/submissions/:uuid/sections/:sectionUuid/signature/:type", params(["uuid","sectionUuid","type"], debriefingController.deleteSignature));
router.post("/submissions/:uuid/sections/:sectionUuid/submit", params(["uuid","sectionUuid"], body(submit, debriefingController.submit)));
router.get("/signatures/:sigAttUuid/raw", params(["sigAttUuid"], debriefingController.rawSignature));
export default router;