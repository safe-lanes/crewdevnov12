import { Router } from "express";
import { AlertsController } from "./controllers/alertsController";

const router = Router();
const controller = new AlertsController();

// GET /api/v2/alerts/events/for-current-user?roleName=...
router.get("/events/for-current-user", (req, res) => controller.getUnacknowledgedEventsForCurrentUser(req, res));

// POST /api/v2/alerts/events/:aeuuid/acknowledge
router.post("/events/:aeuuid/acknowledge", (req, res) => controller.acknowledgeEvent(req, res));

// POST /api/v2/alerts/scan
router.post("/scan", (req, res) => controller.runScan(req, res));

export default router;
