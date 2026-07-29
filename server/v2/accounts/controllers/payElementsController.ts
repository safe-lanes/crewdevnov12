import { Request, Response } from "express";
import { getActor, getAuditUserUuid } from "./_auth";
import { payElementsService } from "../services";
import { insertAccPayElementV2Schema } from "../../../../shared/v2/accounts/types";

const updateSchema = insertAccPayElementV2Schema.partial().omit({
  payElementUuid: true,
});

/** Map a service error to the correct HTTP response. */
function handleError(error: any, res: Response, fallback: string) {
  if (error?.code === "VALIDATION") {
    return res.status(400).json({ error: error.message });
  }
  if (error?.code === "CONFLICT") {
    return res.status(409).json({ error: error.message });
  }
  if (error?.code === "REFERENCED") {
    return res
      .status(409)
      .json({ error: error.message, references: error.references });
  }
  if (error?.message?.includes("not found")) {
    return res.status(404).json({ error: error.message });
  }
  console.error(fallback, error);
  return res.status(500).json({ error: fallback });
}

export const payElementsController = {
  async getAll(req: Request, res: Response) {
    try {
      const { status, type, category } = req.query;
      const records = await payElementsService.getAll({
        status: status as string | undefined,
        type: type as string | undefined,
        category: category as string | undefined,
      });
      if (getActor(req).vesselUser) {
        // Ship actors get the element reference list without GL account
        // codes (office accounting detail the vessel screen never uses).
        return res.json(
          records.map((rec: Record<string, unknown>) => {
            const { glCode: _glCode, ...rest } = rec;
            return rest;
          }),
        );
      }
      res.json(records);
    } catch (error) {
      handleError(error, res, "Failed to fetch pay elements");
    }
  },

  async getByUuid(req: Request, res: Response) {
    try {
      const record = await payElementsService.getByUuid(req.params.uuid);
      res.json(record);
    } catch (error) {
      handleError(error, res, "Failed to fetch pay element");
    }
  },

  async create(req: Request, res: Response) {
    try {
      const parsed = insertAccPayElementV2Schema
        .omit({ payElementUuid: true })
        .safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid pay element data", details: parsed.error.issues });
      }
      const record = await payElementsService.create({
        ...parsed.data,
        auditUserUuid: getAuditUserUuid(req),
      });
      res.status(201).json(record);
    } catch (error) {
      handleError(error, res, "Failed to create pay element");
    }
  },

  async update(req: Request, res: Response) {
    try {
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid pay element data", details: parsed.error.issues });
      }
      const record = await payElementsService.update(req.params.uuid, {
        ...parsed.data,
        auditUserUuid: getAuditUserUuid(req),
      });
      res.json(record);
    } catch (error) {
      handleError(error, res, "Failed to update pay element");
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await payElementsService.delete(req.params.uuid);
      res.status(204).send();
    } catch (error) {
      handleError(error, res, "Failed to delete pay element");
    }
  },

  async seedStandard(req: Request, res: Response) {
    try {
      const records = await payElementsService.seedStandard(
        getAuditUserUuid(req),
      );
      res.status(201).json(records);
    } catch (error) {
      handleError(error, res, "Failed to seed standard pay elements");
    }
  },
};
