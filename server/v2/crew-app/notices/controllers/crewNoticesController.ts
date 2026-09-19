import { Request, Response } from "express";
import { z } from "zod";
import { crewNoticesService } from "../services";
import { createNoticeRequestSchema, updateNoticeRequestSchema } from "@shared/v2/crew-app/types";
import { parsePageParams } from "../../pagination";
import { sendCrewAppError } from "../../errors";

export const crewNoticesController = {
  async list(req: Request, res: Response) {
    try {
      const result = await crewNoticesService.listPublished(req.crewUser!.domain, parsePageParams(req.query));
      res.json(result);
    } catch (error) {
      sendCrewAppError(res, error, "Failed to list notices", "Error listing crew notices");
    }
  },

  async listAllForAdmin(req: Request, res: Response) {
    try {
      const result = await crewNoticesService.listAllForAdmin(req.crewUser!.domain, parsePageParams(req.query));
      res.json(result);
    } catch (error) {
      sendCrewAppError(res, error, "Failed to list notices", "Error listing crew notices for admin");
    }
  },

  async getByUuid(req: Request, res: Response) {
    try {
      const notice = await crewNoticesService.getByUuid(
        req.params.noticeUuid,
        req.crewUser!.domain,
        req.crewUser!.userType === "Admin",
      );
      res.json(notice);
    } catch (error: any) {
      sendCrewAppError(res, error, "Failed to fetch notice", "Error fetching crew notice");
    }
  },

  async create(req: Request, res: Response) {
    try {
      const data = createNoticeRequestSchema.parse(req.body);
      const notice = await crewNoticesService.create(req.crewUser!.domain, data, req.crewUser!.crewUuid);
      res.status(201).json(notice);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      sendCrewAppError(res, error, "Failed to create notice", "Error creating crew notice");
    }
  },

  async update(req: Request, res: Response) {
    try {
      const data = updateNoticeRequestSchema.parse(req.body);
      const notice = await crewNoticesService.update(
        req.params.noticeUuid,
        req.crewUser!.domain,
        data,
        req.crewUser!.crewUuid,
      );
      res.json(notice);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      sendCrewAppError(res, error, "Failed to update notice", "Error updating crew notice");
    }
  },

  async remove(req: Request, res: Response) {
    try {
      await crewNoticesService.remove(req.params.noticeUuid, req.crewUser!.domain, req.crewUser!.crewUuid);
      res.status(200).json({ success: true });
    } catch (error) {
      sendCrewAppError(res, error, "Failed to delete notice", "Error deleting crew notice");
    }
  },
};
