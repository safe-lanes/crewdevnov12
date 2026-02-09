import { Router } from "express";
import { testRecordsController } from "./controllers";

const router = Router();

router.get("/test-records", testRecordsController.getAll);
router.get("/test-records/vessel/:vesselId", testRecordsController.getByVessel);
router.get("/test-records/:uuid", testRecordsController.getByUuid);
router.post("/test-records", testRecordsController.create);
router.patch("/test-records/:uuid", testRecordsController.update);
router.delete("/test-records/:uuid", testRecordsController.delete);

export default router;
