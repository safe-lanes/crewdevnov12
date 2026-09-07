import { Router } from "express";
import { z } from "zod";
import { interviewController } from "./controller";
const router = Router(), uuid = z.string().uuid();
const create = z.object({ interviewItemUuid: uuid }).strict();
const partA = z.object({ interviewCategory: z.string().max(500).nullable(), interviewStage: z.string().max(500).nullable() }).strict();
const partC = z.object({ interviewerComments: z.string().max(10000).nullable() }).strict();
const answer = z.object({ questionUuid: uuid, value: z.union([z.string().max(10000), z.array(z.string().max(500)).max(100), z.boolean(), z.null()]), comment: z.string().max(10000).nullable().optional() }).strict();
const signature = z.object({ type:z.enum(["officer","seafarer"]), data:z.string().max(7_000_000), signerName:z.string().trim().min(1).max(500).optional(), signerRank:z.string().trim().min(1).max(500).optional() }).strict().superRefine((value, ctx) => { if(value.type === "seafarer" && !value.signerName) ctx.addIssue({code:"custom",path:["signerName"],message:"Seafarer name is required"}); if(value.type === "seafarer" && !value.signerRank) ctx.addIssue({code:"custom",path:["signerRank"],message:"Seafarer rank is required"}); });
function body(schema: z.ZodTypeAny, action: any) { return (req:any,res:any,next:any) => { const p=schema.safeParse(req.body); if(!p.success)return res.status(400).json({error:"Invalid request",details:p.error.issues}); req.body=p.data; return action(req,res,next); }; }
function params(keys:string[], action:any) { return (req:any,res:any,next:any) => { const p=z.object(Object.fromEntries(keys.map(k=>[k,k==="type"?z.enum(["officer","seafarer"]):uuid]))).safeParse(req.params); if(!p.success)return res.status(400).json({error:"Invalid route parameters",details:p.error.issues}); req.params=p.data; return action(req,res,next); }; }
function query(action:any) { return (req:any,res:any,next:any) => { const p=create.safeParse(req.query); if(!p.success)return res.status(400).json({error:"Invalid query",details:p.error.issues}); req.query=p.data; return action(req,res,next); }; }
router.get("/resolve-creation", query(interviewController.resolveCreation));
router.post("/submissions", body(create, interviewController.create));
router.get("/submissions/candidate/:recCanUuid", params(["recCanUuid"], interviewController.list));
router.get("/submissions/:uuid", params(["uuid"], interviewController.get));
router.put("/submissions/:uuid/part-a", params(["uuid"], body(partA, interviewController.partA)));
router.put("/submissions/:uuid/part-c", params(["uuid"], body(partC, interviewController.partC)));
router.put("/submissions/:uuid/sections/:sectionUuid/answers", params(["uuid","sectionUuid"], body(z.object({answers:z.array(answer).max(500),sectionComment:z.string().max(10000).nullable().optional()}).strict(), interviewController.answers)));
router.post("/submissions/:uuid/sections/:sectionUuid/signature", params(["uuid","sectionUuid"], body(signature, interviewController.signature)));
router.delete("/submissions/:uuid/sections/:sectionUuid/signature/:type", params(["uuid","sectionUuid","type"], interviewController.deleteSignature));
router.post("/submissions/:uuid/sections/:sectionUuid/submit", params(["uuid","sectionUuid"], body(z.object({comment:z.string().max(10000).nullable().optional()}).strict(), interviewController.submit)));
router.get("/signatures/:sigAttUuid/raw", params(["sigAttUuid"], interviewController.rawSignature));
export default router;