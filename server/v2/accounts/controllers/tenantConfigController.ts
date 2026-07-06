import { Request, Response } from "express";
import { getAuditUserUuid } from "./_auth";
import { tenantConfigService } from "../services";
import { insertAccTenantConfigV2Schema } from "../../../../shared/v2/accounts/types";

const updateSchema = insertAccTenantConfigV2Schema.partial().omit({
  configUuid: true,
});

export const tenantConfigController = {
  async get(req: Request, res: Response) {
    try {
      const record = await tenantConfigService.get(getAuditUserUuid(req));
      res.json(record);
    } catch (error) {
      console.error("Error fetching tenant config:", error);
      res.status(500).json({ error: "Failed to fetch tenant config" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid tenant config data", details: parsed.error.issues });
      }
      const record = await tenantConfigService.update({
        ...parsed.data,
        auditUserUuid: getAuditUserUuid(req),
      });
      res.json(record);
    } catch (error) {
      console.error("Error updating tenant config:", error);
      res.status(500).json({ error: "Failed to update tenant config" });
    }
  },
};
