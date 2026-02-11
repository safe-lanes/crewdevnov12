import { Request, Response } from "express";
import { formsService } from "../services";
import { insertAdmFormV2Schema, insertAdmFormVersionV2Schema } from "../../../../shared/v2/admin/types";
import { z } from "zod";

export const formsController = {
  async getAll(req: Request, res: Response) {
    try {
      const forms = await formsService.getAll();
      res.json(forms);
    } catch (error) {
      console.error("Error fetching forms:", error);
      res.status(500).json({ error: "Failed to fetch forms" });
    }
  },

  async getByUuid(req: Request, res: Response) {
    try {
      const { formUuid } = req.params;
      const form = await formsService.getByUuid(formUuid);
      res.json(form);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching form:", error);
      res.status(500).json({ error: "Failed to fetch form" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const result = insertAdmFormV2Schema
        .omit({ formUuid: true })
        .safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid form data", details: result.error.issues });
      }
      const form = await formsService.create(result.data);
      res.json(form);
    } catch (error) {
      console.error("Error creating form:", error);
      res.status(500).json({ error: "Failed to create form" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { formUuid } = req.params;
      const result = insertAdmFormV2Schema
        .omit({ formUuid: true })
        .partial()
        .safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid form data", details: result.error.issues });
      }
      const form = await formsService.update(formUuid, result.data);
      res.json(form);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating form:", error);
      res.status(500).json({ error: "Failed to update form" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { formUuid } = req.params;
      const deleted = await formsService.delete(formUuid);
      if (!deleted) {
        return res.status(404).json({ error: "Form not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting form:", error);
      res.status(500).json({ error: "Failed to delete form" });
    }
  },

  async getFormForRank(req: Request, res: Response) {
    try {
      const { rankLabel } = req.params;
      const category = req.query.category as string;
      const result = await formsService.getFormForRank(rankLabel, category);
      if (!result) {
        return res.status(404).json({ error: "No form configured for this rank" });
      }
      res.json(result);
    } catch (error) {
      console.error("Error fetching form for rank:", error);
      res.status(500).json({ error: "Failed to fetch form for rank" });
    }
  },

  async cleanupDuplicates(req: Request, res: Response) {
    try {
      const result = await formsService.cleanupDuplicates();
      res.json(result);
    } catch (error) {
      console.error("Error cleaning up duplicate forms:", error);
      res.status(500).json({ error: "Failed to cleanup duplicate forms" });
    }
  },

  async getVersions(req: Request, res: Response) {
    try {
      const { formUuid } = req.params;
      const rankGroupId = req.query.rankGroupId ? parseInt(req.query.rankGroupId as string) : undefined;
      const versions = await formsService.getVersions(formUuid, rankGroupId);
      res.json(versions);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching form versions:", error);
      res.status(500).json({ error: "Failed to fetch form versions" });
    }
  },

  async createVersion(req: Request, res: Response) {
    try {
      const { formUuid } = req.params;
      const result = insertAdmFormVersionV2Schema
        .omit({ fvUuid: true, formId: true })
        .safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid form version data", details: result.error.issues });
      }
      const version = await formsService.createVersion(formUuid, result.data);
      res.json(version);
    } catch (error: any) {
      if (error.message?.includes("not found") || error.message?.includes("required")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error creating form version:", error);
      res.status(500).json({ error: "Failed to create form version" });
    }
  },
};
