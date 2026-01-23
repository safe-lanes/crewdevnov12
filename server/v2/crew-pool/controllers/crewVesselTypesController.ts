import { Request, Response } from "express";
import { crewProfileService } from "../services";

export const crewVesselTypesController = {
  async getAll(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const vesselTypes = await crewProfileService.getVesselTypes(crewUuid);
      res.json(vesselTypes);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to fetch vessel types" });
    }
  },

  async sync(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const { vesselTypeUuids } = req.body;

      if (!Array.isArray(vesselTypeUuids)) {
        return res
          .status(400)
          .json({ error: "vesselTypeUuids must be an array" });
      }

      const vesselTypes = await crewProfileService.syncVesselTypes(
        crewUuid,
        vesselTypeUuids
      );
      res.json(vesselTypes);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to sync vessel types" });
    }
  },
};
