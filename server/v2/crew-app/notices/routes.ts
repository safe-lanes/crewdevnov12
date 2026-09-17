import { Router } from "express";
import { crewNoticesController } from "./controllers";
import { crewAuthMiddleware, requireCrewAdmin } from "../auth";

const router = Router();

router.get("/", crewAuthMiddleware, crewNoticesController.list);
router.get("/admin", crewAuthMiddleware, requireCrewAdmin, crewNoticesController.listAllForAdmin);
router.get("/:noticeUuid", crewAuthMiddleware, crewNoticesController.getByUuid);
router.post("/", crewAuthMiddleware, requireCrewAdmin, crewNoticesController.create);
router.put("/:noticeUuid", crewAuthMiddleware, requireCrewAdmin, crewNoticesController.update);
router.delete("/:noticeUuid", crewAuthMiddleware, requireCrewAdmin, crewNoticesController.remove);

export default router;
