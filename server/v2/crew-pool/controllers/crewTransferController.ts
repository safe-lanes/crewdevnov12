import { Request, Response } from "express";
import { crewTransferService } from "../services";

export const crewTransferController = {
  async transferFromRecruitment(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.body;

      if (!recCanUuid) {
        return res.status(400).json({ error: "recCanUuid is required" });
      }

      const result = await crewTransferService.transferFromRecruitment(
        recCanUuid
      );
      res.status(201).json(result);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes("already exists")) {
        return res.status(409).json({ error: error.message });
      }
      console.error("Error transferring from recruitment:", error);
      res.status(500).json({ error: "Failed to transfer from recruitment" });
    }
  },

  async validateTransfer(req: Request, res: Response) {
    try {
      const transferData = req.body;
      const validation = await crewTransferService.validateTransferData(
        transferData
      );
      res.json(validation);
    } catch (error) {
      console.error("Error validating transfer:", error);
      res.status(500).json({ error: "Failed to validate transfer" });
    }
  },
};
