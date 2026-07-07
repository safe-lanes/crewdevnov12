import { Request, Response } from "express";
import { getAuditUserUuid } from "./_auth";
import { contractsService } from "../services";

export const contractsController = {
  // GET /contracts?crewUuid=&vesselGroup=&status=
  async getAll(req: Request, res: Response) {
    try {
      const { crewUuid, vesselGroup, status } = req.query;
      const records = await contractsService.getAll({
        crewUuid: crewUuid as string | undefined,
        vesselGroup: vesselGroup as string | undefined,
        status: status as string | undefined,
      });
      res.json(records);
    } catch (error) {
      console.error("Error fetching contracts:", error);
      res.status(500).json({ error: "Failed to fetch contracts" });
    }
  },

  // GET /contract-data/:crewUuid?vesselGroup=
  async getContractData(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const vesselGroup = (req.query.vesselGroup as string) || "all-vessels";
      const auditUserUuid = getAuditUserUuid(req);
      const result = await contractsService.getContractWithElements(
        crewUuid,
        vesselGroup,
        auditUserUuid,
      );
      res.json(result);
    } catch (error: any) {
      if (error.message?.includes("required")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error fetching contract data:", error);
      res.status(500).json({ error: "Failed to fetch contract data" });
    }
  },

  async getByUuid(req: Request, res: Response) {
    try {
      const record = await contractsService.getByUuid(req.params.uuid);
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching contract:", error);
      res.status(500).json({ error: "Failed to fetch contract" });
    }
  },

  // PUT /contracts/:uuid/status
  async updateStatus(req: Request, res: Response) {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ error: "status is required" });
      }
      const record = await contractsService.updateStatus(
        req.params.uuid,
        status,
        getAuditUserUuid(req),
      );
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating contract status:", error);
      res.status(500).json({ error: "Failed to update contract status" });
    }
  },

  // PUT /contracts/:uuid/effective-date
  async updateEffectiveDate(req: Request, res: Response) {
    try {
      const { effectiveDate } = req.body;
      if (!effectiveDate) {
        return res.status(400).json({ error: "effectiveDate is required" });
      }
      const record = await contractsService.updateEffectiveDate(
        req.params.uuid,
        effectiveDate,
        getAuditUserUuid(req),
      );
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating contract effective date:", error);
      res
        .status(500)
        .json({ error: "Failed to update contract effective date" });
    }
  },
};
