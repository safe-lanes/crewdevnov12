import { Request, Response } from "express";
import { getAuditUserUuid } from "./_auth";
import { contractPayElementsService } from "../services";
import { insertAccContractPayElementV2Schema } from "../../../../shared/v2/accounts/types";

const updateSchema = insertAccContractPayElementV2Schema.partial().omit({
  contractPayElementUuid: true,
});

export const contractPayElementsController = {
  async getByContract(req: Request, res: Response) {
    try {
      const records = await contractPayElementsService.getByContract(
        req.params.contractUuid,
      );
      res.json(records);
    } catch (error) {
      console.error("Error fetching contract pay elements:", error);
      res.status(500).json({ error: "Failed to fetch contract pay elements" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const parsed = insertAccContractPayElementV2Schema
        .omit({ contractPayElementUuid: true })
        .safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid contract pay element data",
          details: parsed.error.issues,
        });
      }
      const record = await contractPayElementsService.create({
        ...parsed.data,
        auditUserUuid: getAuditUserUuid(req),
      });
      res.status(201).json(record);
    } catch (error: any) {
      if (error.message?.includes("required")) {
        return res.status(400).json({ error: error.message });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error creating contract pay element:", error);
      res.status(500).json({ error: "Failed to create contract pay element" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid contract pay element data",
          details: parsed.error.issues,
        });
      }
      const record = await contractPayElementsService.update(req.params.uuid, {
        ...parsed.data,
        auditUserUuid: getAuditUserUuid(req),
      });
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating contract pay element:", error);
      res.status(500).json({ error: "Failed to update contract pay element" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await contractPayElementsService.delete(req.params.uuid);
      res.status(204).send();
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error deleting contract pay element:", error);
      res.status(500).json({ error: "Failed to delete contract pay element" });
    }
  },
};
