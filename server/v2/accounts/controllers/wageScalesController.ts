import { Request, Response } from "express";
import { getAuditUserUuid } from "./_auth";
import { wageScalesService } from "../services";
import { insertAccWageScaleV2Schema } from "../../../../shared/v2/accounts/types";
import { z } from "zod";

const updateHeaderSchema = insertAccWageScaleV2Schema.partial().omit({
  scaleUuid: true,
});

const lineInputSchema = z.object({
  rankId: z.string().min(1),
  nationalityUuid: z.string().nullish(),
  experienceMinMonths: z.number().int().nullish(),
  experienceMaxMonths: z.number().int().nullish(),
  payElementUuid: z.string().min(1),
  amount: z.string().nullish(),
  rate: z.string().nullish(),
  sortOrder: z.number().int().nullish(),
});

const linesBodySchema = z.object({ lines: z.array(lineInputSchema) });
const activateBodySchema = z.object({ acknowledge: z.boolean().optional() });
const supersedeBodySchema = z.object({
  effectiveTo: z.string().nullish(),
  effectiveFrom: z.string().nullish(),
});

/** Map a service error to the correct HTTP response. */
function handleError(error: any, res: Response, fallback: string) {
  if (error?.code === "VALIDATION") {
    return res.status(400).json({ error: error.message });
  }
  if (error?.code === "CONFLICT") {
    return res.status(409).json({ error: error.message });
  }
  if (error?.code === "FLOOR_VIOLATIONS") {
    return res
      .status(409)
      .json({ error: error.message, violations: error.violations });
  }
  if (error?.message?.includes("not found")) {
    return res.status(404).json({ error: error.message });
  }
  console.error(fallback, error);
  return res.status(500).json({ error: fallback });
}

export const wageScalesController = {
  async getAll(req: Request, res: Response) {
    try {
      const { status } = req.query;
      const records = await wageScalesService.getAll({
        status: status as string | undefined,
      });
      res.json(records);
    } catch (error) {
      handleError(error, res, "Failed to fetch wage scales");
    }
  },

  async getByUuid(req: Request, res: Response) {
    try {
      const record = await wageScalesService.getDetail(req.params.uuid);
      res.json(record);
    } catch (error) {
      handleError(error, res, "Failed to fetch wage scale");
    }
  },

  async create(req: Request, res: Response) {
    try {
      const parsed = insertAccWageScaleV2Schema
        .omit({ scaleUuid: true })
        .safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid wage scale data", details: parsed.error.issues });
      }
      const record = await wageScalesService.create({
        ...parsed.data,
        auditUserUuid: getAuditUserUuid(req),
      });
      res.status(201).json(record);
    } catch (error) {
      handleError(error, res, "Failed to create wage scale");
    }
  },

  async update(req: Request, res: Response) {
    try {
      const parsed = updateHeaderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid wage scale data", details: parsed.error.issues });
      }
      const record = await wageScalesService.update(req.params.uuid, {
        ...parsed.data,
        auditUserUuid: getAuditUserUuid(req),
      });
      res.json(record);
    } catch (error) {
      handleError(error, res, "Failed to update wage scale");
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await wageScalesService.delete(req.params.uuid);
      res.status(204).send();
    } catch (error) {
      handleError(error, res, "Failed to delete wage scale");
    }
  },

  async replaceLines(req: Request, res: Response) {
    try {
      const parsed = linesBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid wage scale lines", details: parsed.error.issues });
      }
      const lines = await wageScalesService.replaceLines(
        req.params.uuid,
        parsed.data.lines,
        getAuditUserUuid(req),
      );
      res.json(lines);
    } catch (error) {
      handleError(error, res, "Failed to save wage scale lines");
    }
  },

  async floorCheck(req: Request, res: Response) {
    try {
      const violations = await wageScalesService.floorCheck(req.params.uuid);
      res.json({ violations, ok: violations.length === 0 });
    } catch (error) {
      handleError(error, res, "Failed to run floor check");
    }
  },

  async activate(req: Request, res: Response) {
    try {
      const parsed = activateBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid activation request", details: parsed.error.issues });
      }
      const result = await wageScalesService.activate(req.params.uuid, {
        acknowledge: parsed.data.acknowledge,
        auditUserUuid: getAuditUserUuid(req),
      });
      res.json(result);
    } catch (error) {
      handleError(error, res, "Failed to activate wage scale");
    }
  },

  async supersede(req: Request, res: Response) {
    try {
      const parsed = supersedeBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid supersede request", details: parsed.error.issues });
      }
      const record = await wageScalesService.supersede(req.params.uuid, {
        effectiveTo: parsed.data.effectiveTo ?? undefined,
        effectiveFrom: parsed.data.effectiveFrom ?? undefined,
        auditUserUuid: getAuditUserUuid(req),
      });
      res.status(201).json(record);
    } catch (error) {
      handleError(error, res, "Failed to supersede wage scale");
    }
  },
};
