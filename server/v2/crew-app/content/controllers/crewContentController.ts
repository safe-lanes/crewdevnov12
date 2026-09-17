import { Request, Response } from "express";
import { z } from "zod";
import { crewContentService } from "../services";
import { contentPageKeySchema, upsertContentPageRequestSchema } from "@shared/v2/crew-app/types";

export const crewContentController = {
  async getPage(req: Request, res: Response) {
    try {
      const pageKey = contentPageKeySchema.parse(req.params.pageKey);
      const page = await crewContentService.getPage(req.crewUser!.domain, pageKey);
      res.json(page);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      if (error?.message === "Content page not found") {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching crew content page:", error);
      res.status(500).json({ error: "Failed to fetch content page" });
    }
  },

  async listAllForAdmin(req: Request, res: Response) {
    try {
      const pages = await crewContentService.listAllForAdmin(req.crewUser!.domain);
      res.json(pages);
    } catch (error) {
      console.error("Error listing crew content pages:", error);
      res.status(500).json({ error: "Failed to list content pages" });
    }
  },

  async upsertPage(req: Request, res: Response) {
    try {
      const pageKey = contentPageKeySchema.parse(req.params.pageKey);
      const data = upsertContentPageRequestSchema.parse(req.body);
      const page = await crewContentService.upsertPage(req.crewUser!.domain, pageKey, data, req.crewUser!.crewUuid);
      res.json(page);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error upserting crew content page:", error);
      res.status(500).json({ error: "Failed to save content page" });
    }
  },
};
