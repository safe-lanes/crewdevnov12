import { Router, type Request, type Response } from "express";
import { authorize, eligibleAssignees, InternalError, type Resource } from "./access";
import { history, listEntries, present, readEntry } from "./read";
import { createComment, editComment, removeEntry } from "./write";

export const internalRouter = Router();
// Never cache confidential material in shared/browser HTTP caches.
internalRouter.use((_req,res,next)=>{res.setHeader("Cache-Control","no-store");next();});
export function endpoint(fn: (req: Request,res: Response)=>Promise<void>) {
  return async (req: Request,res: Response) => {
    try { await fn(req,res); } catch(error) {
      // Do not log request bodies, database errors or snapshots containing text.
      res.status(error instanceof InternalError ? error.status : 500).json({
        message:error instanceof InternalError ? error.message : "Unable to process this internal record. Please retry or contact your administrator.",
      });
    }
  };
}
for (const resource of ["comments","actions"] as Resource[]) {
  const base = `/:crewUuid/${resource}`;
  internalRouter.get(base,endpoint(async(req,res)=>{
    const {db,actor,permissions}=await authorize(req,resource);
    res.json({rows:await listEntries(db,resource,req.params.crewUuid,permissions.candelete),
      actorUuid:actor.uuid,permissions,timeZone:"UTC"});
  }));
  internalRouter.get(`${base}/:entryUuid/history`,endpoint(async(req,res)=>{
    const {db,permissions}=await authorize(req,resource);
    res.json(await history(db,resource,req.params.crewUuid,req.params.entryUuid,permissions.candelete));
  }));
  internalRouter.get(`${base}/:entryUuid`,endpoint(async(req,res)=>{
    const {db,permissions}=await authorize(req,resource);
    res.json(present(await readEntry(db,resource,req.params.crewUuid,req.params.entryUuid),permissions.candelete));
  }));
}
internalRouter.get("/:crewUuid/assignees",endpoint(async(req,res)=>{
  const {db}=await authorize(req,"actions");
  res.json(await eligibleAssignees(db));
}));
internalRouter.post("/:crewUuid/comments",endpoint(async(req,res)=>{res.status(201).json(await createComment(req));}));
internalRouter.patch("/:crewUuid/comments/:entryUuid",endpoint(async(req,res)=>{res.json(await editComment(req));}));
for (const resource of ["comments","actions"] as Resource[]) {
  internalRouter.post(`/:crewUuid/${resource}/:entryUuid/remove`,endpoint(async(req,res)=>{
    res.json(await removeEntry(req,resource));
  }));
}
export default internalRouter;
