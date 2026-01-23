import { Request, Response } from "express";
import { crewCertificatesService } from "../services";
import { insertCrewLicenseSchema } from "@shared/v2/crew-pool/types";
import { z } from "zod";

export const crewLicensesController = {
  async getAll(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const licenses = await crewCertificatesService.getLicenses(crewUuid);
      res.json(licenses);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to fetch licenses" });
    }
  },

  async getExpiring(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const { withinDays } = req.query;
      const days = withinDays ? parseInt(withinDays as string) : 30;
      const result = await crewCertificatesService.checkExpiringCertificates(
        crewUuid,
        days
      );
      res.json(result.expiringLicenses);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to fetch expiring licenses" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const validatedData = insertCrewLicenseSchema
        .omit({ licUuid: true, crewUuid: true })
        .parse(req.body);
      const license = await crewCertificatesService.createLicense(
        crewUuid,
        validatedData
      );
      res.status(201).json(license);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create license" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { licUuid } = req.params;
      const validatedData = insertCrewLicenseSchema.partial().parse(req.body);
      const license = await crewCertificatesService.updateLicense(
        licUuid,
        validatedData
      );
      res.json(license);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update license" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { licUuid } = req.params;
      await crewCertificatesService.deleteLicense(licUuid);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete license" });
    }
  },

  async addAttachment(req: Request, res: Response) {
    try {
      const { licUuid } = req.params;
      const { fileName, filePath, fileType, fileSize } = req.body;

      if (!fileName || !filePath) {
        return res
          .status(400)
          .json({ error: "fileName and filePath are required" });
      }

      const attachment = await crewCertificatesService.addLicenseAttachment(
        licUuid,
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

  async removeAttachment(req: Request, res: Response) {
    try {
      const { attUuid } = req.params;
      await crewCertificatesService.removeLicenseAttachment(attUuid);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove attachment" });
    }
  },
};
