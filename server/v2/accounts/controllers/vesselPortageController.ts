import { Request, Response } from "express";
import { z } from "zod";
import { getActor } from "./_auth";
import { vesselPortageService } from "../services";
import { assertVesselScope } from "../services/vesselScope";

const returnSchema = z.object({
  comment: z.string().trim().min(1, "A comment is required to return a month"),
});

function handleError(res: Response, error: any, fallback: string) {
  const code = (error as { code?: string })?.code;
  if (code === "CONFLICT") return res.status(409).json({ error: error.message });
  if (code === "VALIDATION") return res.status(400).json({ error: error.message });
  if (code === "FORBIDDEN") return res.status(403).json({ error: error.message });
  if (code === "NOT_FOUND" || error.message?.includes("not found")) {
    return res.status(404).json({ error: error.message });
  }
  console.error(fallback, error);
  res.status(500).json({ error: fallback });
}

export const vesselPortageController = {
  async submit(req: Request, res: Response) {
    try {
      const { vesselUuid, period } = req.params;
      const result = await vesselPortageService.submit(
        vesselUuid,
        period,
        getActor(req),
      );
      res.json(result);
    } catch (error: any) {
      handleError(res, error, "Failed to submit month to office");
    }
  },

  async returnToVessel(req: Request, res: Response) {
    try {
      const parsed = returnSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "A comment is required", details: parsed.error.issues });
      }
      const result = await vesselPortageService.returnToVessel(
        req.params.portageUuid,
        parsed.data.comment,
        getActor(req),
      );
      res.json(result);
    } catch (error: any) {
      handleError(res, error, "Failed to return month to vessel");
    }
  },

  async getStatus(req: Request, res: Response) {
    try {
      const { vesselUuid, period } = req.params;
      const actor = getActor(req);
      assertVesselScope(actor, vesselUuid);
      const status = await vesselPortageService.getStatus(vesselUuid, period);
      res.json(status);
    } catch (error: any) {
      handleError(res, error, "Failed to load vessel package status");
    }
  },
};
