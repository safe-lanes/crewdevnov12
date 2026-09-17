import { Router } from "express";
import { crewContentController } from "./controllers";
import { crewAuthMiddleware, requireCrewAdmin } from "../auth";

const router = Router();

router.get("/", crewAuthMiddleware, requireCrewAdmin, crewContentController.listAllForAdmin);
router.get("/:pageKey", crewAuthMiddleware, crewContentController.getPage);
router.put("/:pageKey", crewAuthMiddleware, requireCrewAdmin, crewContentController.upsertPage);

export default router;
