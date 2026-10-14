import type { Request, Response } from "express";
import { z } from "zod";
import { COMPANY_FORM_PERMISSIONS } from "../../../../shared/v2/admin/companyFormPermissions";
import { readCompanyFormGrants } from "../services/actionPermissionsService";
import { saveActionDecisions } from "../services/accessControlManagement";

const grantsSchema = z.object({
  view: z.boolean(), fill_in: z.boolean(), witness: z.boolean(),
  sign_representative: z.boolean(), void: z.boolean(), void_completed: z.boolean(),
  override_checklist: z.boolean().default(false),
}).strict();

export const actionPermissionsController = {
  async get(req: Request, res: Response) {
    try {
      res.json({ resource: "company_forms", catalogue: COMPANY_FORM_PERMISSIONS,
        grants: await readCompanyFormGrants(req.params.ruid) });
    } catch (error) {
      console.error("[ActionPermissions] read failed", error);
      res.status(500).json({ message: "Unable to read Company Forms permissions." });
    }
  },
  async save(req: Request, res: Response) {
    const parsed = z.object({ grants: grantsSchema }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Supply valid Company Forms permission flags." });
    if (!req.user || !Number.isSafeInteger(req.user.id)) return res.status(403).json({ message: "Authenticated grant editor unavailable." });
    try {
      res.json({ grants: await saveActionDecisions(req, req.params.ruid, "company_forms", parsed.data.grants) });
    } catch (error: any) {
      console.error("[ActionPermissions] save failed", error);
      res.status(error.status ?? 500).json({ message: error.status ? error.message : "Unable to save Company Forms permissions." });
    }
  },
};
