import { Router } from "express";
import { crewNotificationsController } from "./controllers";
import { crewAuthMiddleware, requireCrewPasswordReset } from "../auth";

const router = Router();

// All routes are crew-read, scoped to the caller's own crewUuid — no admin needed.
router.get("/", crewAuthMiddleware, requireCrewPasswordReset, crewNotificationsController.list);
router.get("/unread-count", crewAuthMiddleware, requireCrewPasswordReset, crewNotificationsController.unreadCount);
router.post("/:notificationUuid/read", crewAuthMiddleware, requireCrewPasswordReset, crewNotificationsController.markRead);
router.post("/read-all", crewAuthMiddleware, requireCrewPasswordReset, crewNotificationsController.markAllRead);

export default router;
