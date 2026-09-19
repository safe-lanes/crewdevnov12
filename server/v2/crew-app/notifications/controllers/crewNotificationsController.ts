import { Request, Response } from "express";
import { crewNotificationsService } from "../services";
import { parsePageParams } from "../../pagination";
import { sendCrewAppError } from "../../errors";

export const crewNotificationsController = {
  async list(req: Request, res: Response) {
    try {
      const result = await crewNotificationsService.list(
        req.crewUser!.crewUuid,
        req.crewUser!.domain,
        parsePageParams(req.query),
      );
      res.json(result);
    } catch (error) {
      sendCrewAppError(res, error, "Failed to list notifications", "Error listing crew notifications");
    }
  },

  async unreadCount(req: Request, res: Response) {
    try {
      const count = await crewNotificationsService.unreadCount(req.crewUser!.crewUuid, req.crewUser!.domain);
      res.json({ count });
    } catch (error) {
      sendCrewAppError(res, error, "Failed to get unread count", "Error getting unread notification count");
    }
  },

  async markRead(req: Request, res: Response) {
    try {
      await crewNotificationsService.markRead(req.params.notificationUuid, req.crewUser!.crewUuid);
      res.status(200).json({ success: true });
    } catch (error: any) {
      sendCrewAppError(res, error, "Failed to mark notification read", "Error marking notification read");
    }
  },

  async markAllRead(req: Request, res: Response) {
    try {
      await crewNotificationsService.markAllRead(req.crewUser!.crewUuid, req.crewUser!.domain);
      res.status(200).json({ success: true });
    } catch (error) {
      sendCrewAppError(res, error, "Failed to mark all notifications read", "Error marking all notifications read");
    }
  },
};
