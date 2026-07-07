import { Request, Response } from "express";
import { z } from "zod";
import { getActor } from "./_auth";
import { ctmService } from "../services";
import { assertVesselScope, assertOfficeUser } from "../services/vesselScope";

/** Amounts arrive as string or number; numeric columns want strings. */
const amount = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? v.toFixed(2) : v));

// closing_balance is server-computed; .strict() rejects any attempt to send it.
const headerSchema = z
  .object({
    openingBalance: amount.optional(),
    receivedAmount: amount.optional(),
    currency: z.string().min(1).optional(),
  })
  .strict();

const lineCreateSchema = z
  .object({
    lineDate: z.string().nullish(),
    lineType: z.enum([
      "cash_advance_to_crew",
      "receipt",
      "expense",
      "adjustment",
    ]),
    crewUuid: z.string().nullish(),
    amount,
    currency: z.string().min(1).optional(),
    description: z.string().nullish(),
  })
  .strict();

const lineUpdateSchema = lineCreateSchema.partial();

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

export const ctmController = {
  async get(req: Request, res: Response) {
    try {
      const { vesselUuid, period } = req.params;
      const actor = getActor(req);
      assertVesselScope(actor, vesselUuid);
      const detail = await ctmService.getDetail(
        vesselUuid,
        period,
        actor.auditUserUuid,
      );
      res.json(detail);
    } catch (error: any) {
      handleError(res, error, "Failed to load CTM cash account");
    }
  },

  async updateHeader(req: Request, res: Response) {
    try {
      const parsed = headerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid CTM data", details: parsed.error.issues });
      }
      const { vesselUuid, period } = req.params;
      const actor = getActor(req);
      assertVesselScope(actor, vesselUuid);
      const detail = await ctmService.updateHeader(
        vesselUuid,
        period,
        parsed.data,
        actor.auditUserUuid,
      );
      res.json(detail);
    } catch (error: any) {
      handleError(res, error, "Failed to update CTM cash account");
    }
  },

  async createLine(req: Request, res: Response) {
    try {
      const parsed = lineCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid CTM line", details: parsed.error.issues });
      }
      const { vesselUuid, period } = req.params;
      const actor = getActor(req);
      assertVesselScope(actor, vesselUuid);
      const line = await ctmService.createLine(
        vesselUuid,
        period,
        parsed.data,
        actor.auditUserUuid,
      );
      res.status(201).json(line);
    } catch (error: any) {
      handleError(res, error, "Failed to create CTM line");
    }
  },

  async updateLine(req: Request, res: Response) {
    try {
      const parsed = lineUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid CTM line", details: parsed.error.issues });
      }
      const actor = getActor(req);
      const { ctm } = await ctmService.getLineContext(req.params.lineUuid);
      assertVesselScope(actor, ctm.vesselUuid);
      const line = await ctmService.updateLine(
        req.params.lineUuid,
        parsed.data,
        actor.auditUserUuid,
      );
      res.json(line);
    } catch (error: any) {
      handleError(res, error, "Failed to update CTM line");
    }
  },

  async deleteLine(req: Request, res: Response) {
    try {
      const actor = getActor(req);
      const { ctm } = await ctmService.getLineContext(req.params.lineUuid);
      assertVesselScope(actor, ctm.vesselUuid);
      await ctmService.deleteLine(req.params.lineUuid, actor.auditUserUuid);
      res.status(204).send();
    } catch (error: any) {
      handleError(res, error, "Failed to delete CTM line");
    }
  },

  async reconcile(req: Request, res: Response) {
    try {
      const { vesselUuid, period } = req.params;
      const actor = getActor(req);
      assertOfficeUser(actor, "Reconcile CTM");
      const ctm = await ctmService.reconcile(
        vesselUuid,
        period,
        actor.auditUserUuid,
      );
      res.json(ctm);
    } catch (error: any) {
      handleError(res, error, "Failed to reconcile CTM cash account");
    }
  },
};
