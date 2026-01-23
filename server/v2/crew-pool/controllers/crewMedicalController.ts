import { Request, Response } from "express";
import { crewMedicalService } from "../services";
import {
  insertCrewPreJoiningMedicalSchema,
  insertCrewDoctorVisitSchema,
} from "@shared/v2/crew-pool/types";
import { z } from "zod";

export const crewMedicalController = {
  async getMedicals(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const medicals = await crewMedicalService.getMedicals(crewUuid);
      res.json(medicals);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to fetch medical records" });
    }
  },

  async getFitnessStatus(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const status = await crewMedicalService.getFitnessStatus(crewUuid);
      res.json(status);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to get fitness status" });
    }
  },

  async createMedical(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const validatedData = insertCrewPreJoiningMedicalSchema
        .omit({ medUuid: true, crewUuid: true })
        .parse(req.body);
      const medical = await crewMedicalService.createMedical(
        crewUuid,
        validatedData
      );
      res.status(201).json(medical);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create medical record" });
    }
  },

  async updateMedical(req: Request, res: Response) {
    try {
      const { medUuid } = req.params;
      const validatedData = insertCrewPreJoiningMedicalSchema
        .partial()
        .parse(req.body);
      const medical = await crewMedicalService.updateMedical(
        medUuid,
        validatedData
      );
      res.json(medical);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update medical record" });
    }
  },

  async deleteMedical(req: Request, res: Response) {
    try {
      const { medUuid } = req.params;
      await crewMedicalService.deleteMedical(medUuid);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete medical record" });
    }
  },

  async addMedicalAttachment(req: Request, res: Response) {
    try {
      const { medUuid } = req.params;
      const { fileName, filePath, fileType, fileSize } = req.body;

      if (!fileName || !filePath) {
        return res
          .status(400)
          .json({ error: "fileName and filePath are required" });
      }

      const attachment = await crewMedicalService.addMedicalAttachment(
        medUuid,
        {
          fileName,
          filePath,
          fileType: fileType || "application/octet-stream",
          fileSize: fileSize || "0",
        }
      );
      res.status(201).json(attachment);
    } catch (error) {
      res.status(500).json({ error: "Failed to add attachment" });
    }
  },

  async removeMedicalAttachment(req: Request, res: Response) {
    try {
      const { attUuid } = req.params;
      await crewMedicalService.removeMedicalAttachment(attUuid);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove attachment" });
    }
  },

  async getDoctorVisits(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const visits = await crewMedicalService.getDoctorVisits(crewUuid);
      res.json(visits);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to fetch doctor visits" });
    }
  },

  async createDoctorVisit(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const validatedData = insertCrewDoctorVisitSchema
        .omit({ visitUuid: true, crewUuid: true })
        .parse(req.body);
      const visit = await crewMedicalService.createVisit(
        crewUuid,
        validatedData
      );
      res.status(201).json(visit);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create doctor visit" });
    }
  },

  async updateDoctorVisit(req: Request, res: Response) {
    try {
      const { visitUuid } = req.params;
      const validatedData = insertCrewDoctorVisitSchema
        .partial()
        .parse(req.body);
      const visit = await crewMedicalService.updateVisit(
        visitUuid,
        validatedData
      );
      res.json(visit);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update doctor visit" });
    }
  },

  async deleteDoctorVisit(req: Request, res: Response) {
    try {
      const { visitUuid } = req.params;
      await crewMedicalService.deleteVisit(visitUuid);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete doctor visit" });
    }
  },

  async addDoctorVisitAttachment(req: Request, res: Response) {
    try {
      const { visitUuid } = req.params;
      const { fileName, filePath, fileType, fileSize } = req.body;

      if (!fileName || !filePath) {
        return res
          .status(400)
          .json({ error: "fileName and filePath are required" });
      }

      const attachment = await crewMedicalService.addVisitAttachment(
        visitUuid,
        {
          fileName,
          filePath,
          fileType: fileType || "application/octet-stream",
          fileSize: fileSize || "0",
        }
      );
      res.status(201).json(attachment);
    } catch (error) {
      res.status(500).json({ error: "Failed to add attachment" });
    }
  },

  async removeDoctorVisitAttachment(req: Request, res: Response) {
    try {
      const { attUuid } = req.params;
      await crewMedicalService.removeVisitAttachment(attUuid);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove attachment" });
    }
  },

  async getAllMedicalData(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const data = await crewMedicalService.getAllMedicalData(crewUuid);
      res.json(data);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to fetch medical data" });
    }
  },
};
