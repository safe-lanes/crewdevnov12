import { Router } from "express";
import { crewNotificationsController } from "./controllers";
import { crewAuthMiddleware } from "../auth";

const router = Router();

// All routes are crew-read, scoped to the caller's own crewUuid — no admin needed.
router.get("/", crewAuthMiddleware, crewNotificationsController.list);
router.get("/unread-count", crewAuthMiddleware, crewNotificationsController.unreadCount);
router.post("/:notificationUuid/read", crewAuthMiddleware, crewNotificationsController.markRead);
router.post("/read-all", crewAuthMiddleware, crewNotificationsController.markAllRead);

export default router;
