import type { Request, Response } from "express";
import { screeningService } from "../services/complianceScreeningService";

export class ScreeningController {

    /** POST /candidates/:recCanUuid/screen — screen or re-screen (overwrites the single row). */
    async screen(req: Request, res: Response) {
        try {
            const { recCanUuid } = req.params;
            const checkedByUuid = req.body?.auditUserUuid || undefined;
            const { screening, validationIssues } = await screeningService.screen(recCanUuid, checkedByUuid);
            res.status(201).json({ screening, validationIssues });
        } catch (e) {
            res.status(500).json({ error: e instanceof Error ? e.message : "Screening failed" });
        }
    }

    /** GET /candidates/:recCanUuid/screening — the single row (null if never screened). */
    async getScreening(req: Request, res: Response) {
        try {
            const screening = await screeningService.getScreening(req.params.recCanUuid);
            res.json(screening ?? null);
        } catch (e) {
            res.status(500).json({ error: e instanceof Error ? e.message : "Failed to load screening" });
        }
    }

    /** PUT /candidates/:recCanUuid/remark — edit the single remark (editable indefinitely). */
    async setRemark(req: Request, res: Response) {
        try {
            const remark = (req.body?.remark ?? "").toString().trim();
            if (!remark) return res.status(400).json({ error: "Remark text is required" });
            const updated = await screeningService.setRemark(
                req.params.recCanUuid,
                remark,
                req.body?.auditUserUuid || undefined,
            );
            if (!updated) return res.status(404).json({ error: "No screening found for this candidate" });
            res.json(updated);
        } catch (e) {
            res.status(500).json({ error: e instanceof Error ? e.message : "Failed to save remark" });
        }
    }
}
export const complianceScreeningController = new ScreeningController();