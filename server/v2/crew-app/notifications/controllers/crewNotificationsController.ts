import { Request, Response } from "express";
import { crewNotificationsService } from "../services";

export const crewNotificationsController = {
  async list(req: Request, res: Response) {
    try {
      const notifications = await crewNotificationsService.list(req.crewUser!.crewUuid, req.crewUser!.domain);
      res.json(notifications);
    } catch (error) {
      console.error("Error listing crew notifications:", error);
      res.status(500).json({ error: "Failed to list notifications" });
    }
  },

  async unreadCount(req: Request, res: Response) {
    try {
      const count = await crewNotificationsService.unreadCount(req.crewUser!.crewUuid, req.crewUser!.domain);
      res.json({ count });
    } catch (error) {
      console.error("Error getting unread notification count:", error);
      res.status(500).json({ error: "Failed to get unread count" });
    }
  },

  async markRead(req: Request, res: Response) {
    try {
      await crewNotificationsService.markRead(req.params.notificationUuid, req.crewUser!.crewUuid);
      res.status(200).json({ success: true });
    } catch (error: any) {
      if (error?.message === "Notification not found") {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error marking notification read:", error);
      res.status(500).json({ error: "Failed to mark notification read" });
    }
  },

  async markAllRead(req: Request, res: Response) {
    try {
      await crewNotificationsService.markAllRead(req.crewUser!.crewUuid, req.crewUser!.domain);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error marking all notifications read:", error);
      res.status(500).json({ error: "Failed to mark all notifications read" });
    }
  },
};
