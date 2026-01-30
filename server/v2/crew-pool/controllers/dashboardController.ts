import type { Request, Response } from "express";
import { dashboardService } from "../services/dashboardService";

export const dashboardController = {
  async getDashboardSummary(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;

      if (!crewUuid) {
        return res.status(400).json({ error: "Crew UUID is required" });
      }

      const dashboard = await dashboardService.getDashboardSummary(crewUuid);

      if (!dashboard) {
        return res.status(404).json({ error: "Crew member not found" });
      }

      // Disable HTTP caching to ensure fresh data after sign-on/sign-off operations
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      return res.json(dashboard);
    } catch (error: any) {
      console.error("Error fetching crew dashboard:", error);
      return res.status(500).json({
        error: error.message || "Failed to fetch dashboard summary",
      });
    }
  },
};
