import { Request, Response } from "express";
import { getActor, getAuditUserUuid } from "./_auth";
import { tenantConfigService } from "../services";
import { insertAccTenantConfigV2Schema } from "../../../../shared/v2/accounts/types";

const updateSchema = insertAccTenantConfigV2Schema.partial().omit({
  configUuid: true,
});

export const tenantConfigController = {
  async get(req: Request, res: Response) {
    try {
      const record = await tenantConfigService.get(getAuditUserUuid(req));
      if (getActor(req).vesselUser) {
        // Ship actors get ONLY the fields the Vessel Portage screen uses
        // (configurable extra entry tabs). GL codes, allotment cap,
        // preparation mode, and all other office settings are excluded.
        const rec = record as Record<string, unknown>;
        return res.json({
          extraTab1Enabled: rec?.extraTab1Enabled ?? false,
          extraTab1Label: rec?.extraTab1Label ?? null,
          extraTab1PayElementUuid: rec?.extraTab1PayElementUuid ?? null,
          extraTab2Enabled: rec?.extraTab2Enabled ?? false,
          extraTab2Label: rec?.extraTab2Label ?? null,
          extraTab2PayElementUuid: rec?.extraTab2PayElementUuid ?? null,
        });
      }
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
    } catch (error: any) {
      if (error?.code === "VALIDATION") {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error updating tenant config:", error);
      res.status(500).json({ error: "Failed to update tenant config" });
    }
  },
};
