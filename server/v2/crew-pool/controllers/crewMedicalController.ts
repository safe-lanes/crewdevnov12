import { Request, Response } from "express";
import { crewMedicalService } from "../services";
import {
  insertCrewPreJoiningMedicalSchema,
  insertCrewDoctorVisitSchema,
} from "@shared/v2/crew-pool/types";
import { z } from "zod";
import {
  fileStorageService,
  AttachmentValidationError,
} from "../../shared/fileStorageService.js";
import {
  serveAttachmentFromFilePath,
  decodeStoredFile,
} from "../../shared/serveAttachmentHelper.js";

function normalizeForServe(att: {
  fileName?: string | null;
  fileType?: string | null;
  filePath?: string | null;
  fileData?: string | null;
}) {
  const filePathIsDataUrl = !!att.filePath && att.filePath.startsWith("data:");
  return {
    filePath: filePathIsDataUrl ? null : att.filePath ?? null,
    fileData: att.fileData ?? (filePathIsDataUrl ? att.filePath ?? null : null),
    fileName: att.fileName ?? null,
    fileType: att.fileType ?? null,
  };
}

async function persistIncoming(
  moduleName: string,
  fileName: string,
  rawValue: string,
  fileType?: string | null,
): Promise<{ filePath: string; fileData: null }> {
  const decoded = decodeStoredFile(rawValue, fileType);
  if (decoded) {
    const filePath = await fileStorageService.writeAttachment(
      moduleName,
      fileName,
      decoded.buffer,
    );
    return { filePath, fileData: null };
  }
  return { filePath: rawValue, fileData: null };
}

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
      const { fileName, filePath, fileUrl, fileType, mimeType, fileSize } = req.body;
      const rawValue = filePath || fileUrl || "";
      const resolvedFileType = fileType || mimeType || "application/octet-stream";

      if (!fileName || !rawValue) {
        return res
          .status(400)
          .json({ error: "fileName and filePath/fileUrl are required" });
      }

      const stored = await persistIncoming(
        "crew-pool/crew-medical",
        fileName,
        rawValue,
        resolvedFileType,
      );

      const attachment = await crewMedicalService.addMedicalAttachment(
        medUuid,
        {
          fileName,
          filePath: stored.filePath,
          fileData: stored.fileData,
          fileType: resolvedFileType,
          fileSize: fileSize || "0",
        }
      );
      res.status(201).json(attachment);
    } catch (error) {
      if (error instanceof AttachmentValidationError) {
        return res.status(400).json({ error: error.message });
      }
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

  async serveMedicalAttachment(req: Request, res: Response) {
    try {
      const { attUuid } = req.params;
      const attachment =
        await crewMedicalService.getMedicalAttachmentFile(attUuid);
      await serveAttachmentFromFilePath(res, normalizeForServe(attachment));
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: "Attachment not found" });
      }
      return res.status(500).json({ error: "Failed to load attachment" });
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
      const { fileName, filePath, fileUrl, fileType, mimeType, fileSize } = req.body;
      const rawValue = filePath || fileUrl || "";
      const resolvedFileType = fileType || mimeType || "application/octet-stream";

      if (!fileName || !rawValue) {
        return res
          .status(400)
          .json({ error: "fileName and filePath/fileUrl are required" });
      }

      const stored = await persistIncoming(
        "crew-pool/crew-doctor-visits",
        fileName,
        rawValue,
        resolvedFileType,
      );

      const attachment = await crewMedicalService.addVisitAttachment(
        visitUuid,
        {
          fileName,
          filePath: stored.filePath,
          fileData: stored.fileData,
          fileType: resolvedFileType,
          fileSize: fileSize || "0",
        }
      );
      res.status(201).json(attachment);
    } catch (error) {
      if (error instanceof AttachmentValidationError) {
        return res.status(400).json({ error: error.message });
      }
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

  async serveDoctorVisitAttachment(req: Request, res: Response) {
    try {
      const { attUuid } = req.params;
      const attachment =
        await crewMedicalService.getVisitAttachmentFile(attUuid);
      await serveAttachmentFromFilePath(res, normalizeForServe(attachment));
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: "Attachment not found" });
      }
      return res.status(500).json({ error: "Failed to load attachment" });
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
