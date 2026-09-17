import { Router } from "express";
import { crewContentController } from "./controllers";
import { crewAuthMiddleware, requireCrewAdmin, requireCrewPasswordReset } from "../auth";

const router = Router();

router.get("/", crewAuthMiddleware, requireCrewPasswordReset, requireCrewAdmin, crewContentController.listAllForAdmin);
router.get("/:pageKey", crewAuthMiddleware, requireCrewPasswordReset, crewContentController.getPage);
router.put("/:pageKey", crewAuthMiddleware, requireCrewPasswordReset, requireCrewAdmin, crewContentController.upsertPage);

export default router;
