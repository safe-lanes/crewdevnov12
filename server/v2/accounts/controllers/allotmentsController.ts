import { Request, Response } from "express";
import { getAuditUserUuid } from "./_auth";
import { allotmentsService } from "../services";
import { insertAccAllotmentV2Schema } from "../../../../shared/v2/accounts/types";

const updateSchema = insertAccAllotmentV2Schema.partial().omit({
  allotmentUuid: true,
});

export const allotmentsController = {
  async getAll(req: Request, res: Response) {
    try {
      const { crewUuid, status } = req.query;
      const records = await allotmentsService.getAll({
        crewUuid: crewUuid as string | undefined,
        status: status as string | undefined,
      });
      res.json(records);
    } catch (error) {
      console.error("Error fetching allotments:", error);
      res.status(500).json({ error: "Failed to fetch allotments" });
    }
  },

  async getByCrew(req: Request, res: Response) {
    try {
      const records = await allotmentsService.getByCrew(req.params.crewUuid);
      res.json(records);
    } catch (error) {
      console.error("Error fetching crew allotments:", error);
      res.status(500).json({ error: "Failed to fetch crew allotments" });
    }
  },

  async getByUuid(req: Request, res: Response) {
    try {
      const record = await allotmentsService.getByUuid(req.params.uuid);
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching allotment:", error);
      res.status(500).json({ error: "Failed to fetch allotment" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const parsed = insertAccAllotmentV2Schema
        .omit({ allotmentUuid: true })
        .safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid allotment data", details: parsed.error.issues });
      }
      const record = await allotmentsService.create({
        ...parsed.data,
        auditUserUuid: getAuditUserUuid(req),
      });
      res.status(201).json(record);
    } catch (error: any) {
      if (error.message?.includes("required")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error creating allotment:", error);
      res.status(500).json({ error: "Failed to create allotment" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid allotment data", details: parsed.error.issues });
      }
      const record = await allotmentsService.update(req.params.uuid, {
        ...parsed.data,
        auditUserUuid: getAuditUserUuid(req),
      });
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating allotment:", error);
      res.status(500).json({ error: "Failed to update allotment" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await allotmentsService.delete(req.params.uuid);
      res.status(204).send();
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error deleting allotment:", error);
      res.status(500).json({ error: "Failed to delete allotment" });
    }
  },
};
