import { Request, Response } from "express";
import { crewTransferService } from "../services";

export const crewTransferController = {
  async transferFromRecruitment(req: Request, res: Response) {
    try {
      const { recCanUuid, empNo, crewPool, availability, status, auditUserUuid } = req.body;

      if (!recCanUuid) {
        return res.status(400).json({ error: "recCanUuid is required" });
      }

      const result = await crewTransferService.transferFromRecruitment(
        recCanUuid,
        { empNo, crewPool, availability, status, auditUserUuid }
      );
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ success: false, error: error.message });
      }
      if (error.message?.includes("already been transferred")) {
        return res.status(409).json({ success: false, error: error.message });
      }
      if (error.message?.includes("already exists")) {
        return res.status(409).json({ success: false, error: error.message });
      }
      if (error.message?.includes("status must be")) {
        return res.status(400).json({ success: false, error: error.message });
      }
      console.error("Error transferring from recruitment:", error);
      res.status(500).json({ success: false, error: "Failed to transfer from recruitment" });
    }
  },

  async checkDuplicate(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;

      if (!recCanUuid) {
        return res.status(400).json({ error: "recCanUuid is required" });
      }

      const result = await crewTransferService.checkDuplicateTransfer(recCanUuid);
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error("Error checking duplicate transfer:", error);
      res.status(500).json({ success: false, error: "Failed to check duplicate transfer" });
    }
  },

  async validateTransfer(req: Request, res: Response) {
    try {
      const transferData = req.body;
      const validation = await crewTransferService.validateTransferData(
        transferData
      );
      res.json({ success: true, data: validation });
    } catch (error) {
      console.error("Error validating transfer:", error);
      res.status(500).json({ success: false, error: "Failed to validate transfer" });
    }
  },
};
