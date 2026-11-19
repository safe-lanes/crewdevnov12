import { Router } from "express";
import { AssistantDataController } from "./controllers/assistantDataController";

/**
 * Service-to-service routes for the central assistant (stage 2 live data, PILOT TRIAL).
 *
 * Mounted in server/index.ts BEFORE tenantMiddleware/authMiddleware: the call carries no SAILERP browser token.
 * These paths are NOT added to the generic exempt list; they are authenticated here instead (service secret +
 * signed identity) and select the company from the verified identity. Every other path falls through.
 */
const router = Router();
const controller = new AssistantDataController();

router.get("/manifest", (req, res) => controller.manifest(req, res));
router.post("/execute", (req, res) => controller.execute(req, res));

export default router;
