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

  async getById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid form ID" });
      }
      const form = await formsService.getById(id);
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
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid form ID" });
      }
      const result = insertAdmFormV2Schema
        .omit({ formUuid: true })
        .partial()
        .safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid form data", details: result.error.issues });
      }
      const form = await formsService.updateById(id, result.data);
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
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid form ID" });
      }
      const deleted = await formsService.deleteById(id);
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
      const formId = parseInt(req.params.id);
      if (isNaN(formId)) {
        return res.status(400).json({ error: "Invalid form ID" });
      }
      const rankGroupId = req.query.rankGroupId ? parseInt(req.query.rankGroupId as string) : undefined;
      const versions = await formsService.getVersionsByFormId(formId, rankGroupId);
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
      const formId = parseInt(req.params.id);
      if (isNaN(formId)) {
        return res.status(400).json({ error: "Invalid form ID" });
      }
      const result = insertAdmFormVersionV2Schema
        .omit({ fvUuid: true, formId: true })
        .safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid form version data", details: result.error.issues });
      }
      const version = await formsService.createVersionByFormId(formId, result.data);
      res.json(version);
    } catch (error: any) {
      if (error.message?.includes("not found") || error.message?.includes("required")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error creating form version:", error);
      res.status(500).json({ error: "Failed to create form version" });
    }
  },

  async getVersionById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid version ID" });
      }
      const version = await formsService.getVersionById(id);
      res.json(version);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching form version:", error);
      res.status(500).json({ error: "Failed to fetch form version" });
    }
  },

  async updateVersion(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid version ID" });
      }
      const result = insertAdmFormVersionV2Schema
        .omit({ fvUuid: true })
        .partial()
        .safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid form version data", details: result.error.issues });
      }
      const version = await formsService.updateVersionById(id, result.data);
      res.json(version);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating form version:", error);
      res.status(500).json({ error: "Failed to update form version" });
    }
  },

  async releaseVersion(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid version ID" });
      }
      const version = await formsService.releaseVersionById(id);
      res.json(version);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error releasing form version:", error);
      res.status(500).json({ error: "Failed to release form version" });
    }
  },

  async deleteVersion(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid version ID" });
      }
      const deleted = await formsService.deleteVersionById(id);
      if (!deleted) {
        return res.status(404).json({ error: "Form version not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting form version:", error);
      res.status(500).json({ error: "Failed to delete form version" });
    }
  },
};
