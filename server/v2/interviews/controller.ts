import type { Request, Response } from "express";
import { InterviewError, interviewService } from "./service";
import { fileStorageService } from "../shared/fileStorageService";

function fail(res: Response, error: unknown, fallback: string) {
  if (error instanceof InterviewError) return res.status(error.statusCode).json({ error: error.message });
  console.error(fallback, error); return res.status(500).json({ error: fallback });
}
export const interviewController = {
  async resolveCreation(req: Request, res: Response) { try { res.json(await interviewService.resolveCreation(req.query as { interviewItemUuid: string }, req)); } catch (e) { fail(res, e, "Failed to resolve Crew Interview form version"); } },
  async create(req: Request, res: Response) { try { res.status(201).json(await interviewService.create(req.body, req)); } catch (e) { fail(res, e, "Failed to create Crew Interview submission"); } },
  async get(req: Request, res: Response) { try { res.json(await interviewService.read(req.params.uuid, req)); } catch (e) { fail(res, e, "Failed to fetch Crew Interview submission"); } },
  async list(req: Request, res: Response) { try { res.json(await interviewService.list(req.params.recCanUuid, req)); } catch (e) { fail(res, e, "Failed to list Crew Interview submissions"); } },
  async partA(req: Request, res: Response) { try { res.json(await interviewService.savePartA(req.params.uuid, req.body, req)); } catch (e) { fail(res, e, "Failed to save Crew Interview Part A"); } },
  async partC(req: Request, res: Response) { try { res.json(await interviewService.savePartC(req.params.uuid, req.body, req)); } catch (e) { fail(res, e, "Failed to save Crew Interview Part C"); } },
  async answers(req: Request, res: Response) { try { await interviewService.saveAnswers(req.params.uuid, req.params.sectionUuid, req.body.answers, req.body.sectionComment, req); res.status(204).end(); } catch (e) { fail(res, e, "Failed to save Crew Interview answers"); } },
  async submit(req: Request, res: Response) { try { await interviewService.submit(req.params.uuid, req.params.sectionUuid, req.body.comment, req); res.status(204).end(); } catch (e) { fail(res, e, "Failed to submit Crew Interview section"); } },
  async signature(req: Request, res: Response) { try { res.status(201).json({ sig_att_uuid: await interviewService.uploadSignature(req.params.uuid, req.params.sectionUuid, req.body, req) }); } catch (e) { fail(res, e, "Failed to save signature"); } },
  async deleteSignature(req: Request, res: Response) { try { await interviewService.deleteSignature(req.params.uuid, req.params.sectionUuid, req.params.type as "officer"|"seafarer", req); res.status(204).end(); } catch (e) { fail(res, e, "Failed to delete signature"); } },
  async rawSignature(req: Request, res: Response) { try { const attachment = await interviewService.rawSignature(req.params.sigAttUuid, req); const file = await fileStorageService.readAttachment(attachment.filePath); res.type(file.mimeType); file.stream.pipe(res); } catch (e) { fail(res, e, "Failed to read signature"); } },
};