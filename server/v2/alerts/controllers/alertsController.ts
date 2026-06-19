import { Request, Response } from "express";
import { AlertsService } from "../services/alertsService";

const service = new AlertsService();

export class AlertsController {
  async getUnacknowledgedEventsForCurrentUser(req: Request, res: Response) {
    try {
      const userType = req.user?.userType || "office";
      const roleName = (req.query.roleName as string) || null;

      const events = await service.getUnacknowledgedAlertEventsForRole(userType, roleName);
      res.json(events);
    } catch (error) {
      console.error("[AlertsController] Failed to fetch alerts for current user:", error);
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  }

  async acknowledgeEvent(req: Request, res: Response) {
    try {
      const { aeuuid } = req.params;
      const userId = req.user?.id != null ? String(req.user.id) : "system";

      const updated = await service.acknowledgeAlertEvent(aeuuid, userId);
      res.json(updated);
    } catch (error) {
      console.error("[AlertsController] Failed to acknowledge alert event:", error);
      res.status(500).json({ error: "Failed to acknowledge alert" });
    }
  }

  async runScan(_req: Request, res: Response) {
    try {
      const results = await service.runScan();
      res.json(results);
    } catch (error) {
      console.error("[AlertsController] Failed to run alert scan:", error);
      res.status(500).json({ error: "Failed to run alert scan" });
    }
  }
}
