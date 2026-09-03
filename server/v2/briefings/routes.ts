import { Router } from "express";
import { z } from "zod";
import { briefingController } from "./controller";

const router = Router();
const uuid = z.string().uuid();
const create = z.object({ formUuid: uuid, crewUuid: uuid, vesselUuid: uuid.nullable().optional(), vesselTypeUuid: uuid.nullable().optional() }).strict();
const answer = z.object({ value: z.union([z.string().max(10000),z.array(z.string().max(500)).max(100),z.boolean(),z.null()]), comment:z.string().max(10000).nullable().optional() }).strict();
const signature = z.object({ data:z.string().max(7_000_000), name:z.string().trim().max(500).nullable().optional() }).strict();
const submit = z.object({ comment:z.string().max(10000).nullable().optional() }).strict();
function body(schema: z.ZodTypeAny, action: any) { return (req:any,res:any,next:any) => { const parsed=schema.safeParse(req.body); if(!parsed.success) return res.status(400).json({error:"Invalid request",details:parsed.error.issues}); req.body=parsed.data; return action(req,res,next); }; }
function params(keys: string[], action: any) { return (req:any,res:any,next:any) => { const parsed=z.object(Object.fromEntries(keys.map(k=>[k,uuid]))).safeParse(req.params); if(!parsed.success) return res.status(400).json({error:"Invalid UUID",details:parsed.error.issues}); return action(req,res,next); }; }
router.post("/submissions", body(create, briefingController.create));
router.get("/submissions/crew/:crewUuid", params(["crewUuid"], briefingController.list));
router.get("/submissions/:uuid", params(["uuid"], briefingController.get));
router.put("/submissions/:uuid/sections/:sectionUuid/questions/:questionUuid", params(["uuid","sectionUuid","questionUuid"], body(answer, briefingController.answer)));
router.post("/submissions/:uuid/sections/:sectionUuid/signature", params(["uuid","sectionUuid"], body(signature, briefingController.signature)));
router.delete("/submissions/:uuid/sections/:sectionUuid/signature", params(["uuid","sectionUuid"], briefingController.deleteSignature));
router.post("/submissions/:uuid/sections/:sectionUuid/submit", params(["uuid","sectionUuid"], body(submit, briefingController.submit)));
router.get("/signatures/:sigAttUuid/raw", params(["sigAttUuid"], briefingController.rawSignature));
export default router;