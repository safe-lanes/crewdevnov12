import { Router } from "express";
import { AssistantTokenController } from "./controllers/assistantTokenController";

const router = Router();
const controller = new AssistantTokenController();

// GET /api/v2/assistant/token — short-lived identity for the shared SAIL chat widget (knowledge answers, stage 1).
// Behind the normal tenantMiddleware + authMiddleware (it is NOT an exempt path).
router.get("/token", (req, res) => controller.getToken(req, res));

export default router;
