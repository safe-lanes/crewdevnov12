import { Router } from "express";
import { testRecordsController, attachmentsController } from "./controllers";
import { crewController } from "./controllers/crewController";

const router = Router();

router.get("/stats/violations", testRecordsController.getViolationCounts);
router.get("/test-records/violations", testRecordsController.getViolationFormSummaries);
router.get("/test-records", testRecordsController.getAll);
router.get("/test-records/vessel/:vesselId", testRecordsController.getByVessel);
router.get("/test-records/:uuid", testRecordsController.getByUuid);
router.post("/test-records", testRecordsController.create);
router.patch("/test-records/:uuid/planned", testRecordsController.updatePlannedFields);
router.patch("/test-records/:uuid", testRecordsController.update);
router.delete("/test-records/:uuid", testRecordsController.delete);

router.get("/attachments/:testRecordUuid", attachmentsController.getByTestRecord);
router.post("/attachments/:testRecordUuid", attachmentsController.create);
router.delete("/attachments/:attUuid", attachmentsController.delete);

router.get("/crew/vessel/:vesselUuid", crewController.getOnboardByVessel);

export default router;
