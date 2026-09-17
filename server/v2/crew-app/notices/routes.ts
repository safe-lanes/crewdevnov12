import { Router } from "express";
import { crewNoticesController } from "./controllers";
import { crewAuthMiddleware, requireCrewAdmin, requireCrewPasswordReset } from "../auth";

const router = Router();

router.get("/", crewAuthMiddleware, requireCrewPasswordReset, crewNoticesController.list);
router.get("/admin", crewAuthMiddleware, requireCrewPasswordReset, requireCrewAdmin, crewNoticesController.listAllForAdmin);
router.get("/:noticeUuid", crewAuthMiddleware, requireCrewPasswordReset, crewNoticesController.getByUuid);
router.post("/", crewAuthMiddleware, requireCrewPasswordReset, requireCrewAdmin, crewNoticesController.create);
router.put("/:noticeUuid", crewAuthMiddleware, requireCrewPasswordReset, requireCrewAdmin, crewNoticesController.update);
router.delete("/:noticeUuid", crewAuthMiddleware, requireCrewPasswordReset, requireCrewAdmin, crewNoticesController.remove);

export default router;
