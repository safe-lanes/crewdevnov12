import { Request, Response } from "express";
import { z } from "zod";
import { crewNoticesService } from "../services";
import { createNoticeRequestSchema, updateNoticeRequestSchema } from "@shared/v2/crew-app/types";

export const crewNoticesController = {
  async list(req: Request, res: Response) {
    try {
      const notices = await crewNoticesService.listPublished(req.crewUser!.domain);
      res.json(notices);
    } catch (error) {
      console.error("Error listing crew notices:", error);
      res.status(500).json({ error: "Failed to list notices" });
    }
  },

  async listAllForAdmin(req: Request, res: Response) {
    try {
      const notices = await crewNoticesService.listAllForAdmin(req.crewUser!.domain);
      res.json(notices);
    } catch (error) {
      console.error("Error listing crew notices for admin:", error);
      res.status(500).json({ error: "Failed to list notices" });
    }
  },

  async getByUuid(req: Request, res: Response) {
    try {
      const notice = await crewNoticesService.getByUuid(req.params.noticeUuid, req.crewUser!.domain);
      res.json(notice);
    } catch (error: any) {
      if (error?.message === "Notice not found") {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching crew notice:", error);
      res.status(500).json({ error: "Failed to fetch notice" });
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
      console.error("Error creating crew notice:", error);
      res.status(500).json({ error: "Failed to create notice" });
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
      if (error?.message === "Notice not found") {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating crew notice:", error);
      res.status(500).json({ error: "Failed to update notice" });
    }
  },

  async remove(req: Request, res: Response) {
    try {
      await crewNoticesService.remove(req.params.noticeUuid, req.crewUser!.domain, req.crewUser!.crewUuid);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error deleting crew notice:", error);
      res.status(500).json({ error: "Failed to delete notice" });
    }
  },
};
