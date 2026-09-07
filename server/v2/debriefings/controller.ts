import type { Request, Response } from "express";
import { fileStorageService } from "../shared/fileStorageService";
import { DebriefingError, debriefingService } from "./service";

function fail(res: Response, error: unknown, fallback: string) {
  if (error instanceof DebriefingError) return res.status(error.statusCode).json({ error: error.message });
  console.error(fallback, error); return res.status(500).json({ error: fallback });
}
export const debriefingController = {
  async resolveCreation(req: Request, res: Response) { try { res.json(await debriefingService.resolveCreation(req.query as { debriefingUuid: string }, req)); } catch (e) { fail(res,e,"Failed to resolve debriefing form version"); } },
  async create(req: Request, res: Response) { try { res.status(201).json(await debriefingService.create(req.body, req)); } catch (e) { fail(res,e,"Failed to create debriefing submission"); } },
  async get(req: Request, res: Response) { try { res.json(await debriefingService.read(req.params.uuid, req)); } catch (e) { fail(res,e,"Failed to fetch debriefing submission"); } },
  async list(req: Request, res: Response) { try { res.json(await debriefingService.list(req.params.crewUuid, req)); } catch (e) { fail(res,e,"Failed to list debriefing submissions"); } },
  async partA(req: Request, res: Response) { try { res.json(await debriefingService.savePartA(req.params.uuid, req.body, req)); } catch (e) { fail(res,e,"Failed to save Debriefing Part A"); } },
  async partC(req: Request, res: Response) { try { res.json(await debriefingService.savePartC(req.params.uuid, req.body, req)); } catch (e) { fail(res,e,"Failed to save Debriefing Part C"); } },
  async answers(req: Request, res: Response) { try { await debriefingService.saveAnswers(req.params.uuid, req.params.sectionUuid, req.body.answers, req.body.sectionComment, req); res.status(204).end(); } catch(e) { fail(res,e,"Failed to save debriefing answers"); } },
  async signature(req: Request, res: Response) { try { res.status(201).json({ sig_att_uuid: await debriefingService.uploadSignature(req.params.uuid, req.params.sectionUuid, req.body, req) }); } catch(e) { fail(res,e,"Failed to save signature"); } },
  async submit(req: Request, res: Response) { try { res.json(await debriefingService.submit(req.params.uuid,req.params.sectionUuid,req.body.comment,req)); } catch(e) { fail(res,e,"Failed to submit debriefing section"); } },
  async deleteSignature(req: Request, res: Response) { try { await debriefingService.deleteSignature(req.params.uuid, req.params.sectionUuid, req.params.type as "officer" | "seafarer", req); res.status(204).end(); } catch(e) { fail(res,e,"Failed to delete signature"); } },
  async rawSignature(req: Request, res: Response) {
    try {
      const att = await debriefingService.rawSignature(req.params.sigAttUuid, req);
      const { stream, mimeType } = await fileStorageService.readAttachment(att.filePath);
      res.type(mimeType); stream.pipe(res);
    } catch(e) { fail(res,e,"Failed to read signature"); }
  },
};