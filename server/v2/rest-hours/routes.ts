import { Router } from "express";
import {
  vesselRecordsController,
  crewRecordsController,
  dailyRecordsController,
  commentsController,
  ncReportsController,
  fixedTasksController,
  variableTasksController,
  datelineController,
  masterDataController,
} from "./controllers";

const router = Router();

// ============================================
// VESSEL RECORDS
// ============================================
router.get("/vessel-records", vesselRecordsController.getAll);
router.get("/vessel-records/:uuid", vesselRecordsController.getByUuid);
router.post("/vessel-records", vesselRecordsController.create);
router.put("/vessel-records/:uuid", vesselRecordsController.update);
router.delete("/vessel-records/:uuid", vesselRecordsController.delete);
router.post("/vessel-records/:uuid/submit-vessel-review", vesselRecordsController.submitVesselReview);
router.post("/vessel-records/:uuid/submit-office-review", vesselRecordsController.submitOfficeReview);

// ============================================
// CREW RECORDS
// ============================================
router.get("/crew-records", crewRecordsController.getAll);
router.get("/violations-by-rank", crewRecordsController.getViolationsByRank);
router.get("/ncs-by-rank", crewRecordsController.getNcsByRank);
router.get("/crew-records/:uuid", crewRecordsController.getByUuid);
router.post("/crew-records", crewRecordsController.create);
router.put("/crew-records/:uuid", crewRecordsController.update);
router.delete("/crew-records/:uuid", crewRecordsController.delete);

// ============================================
// DAILY RECORDS
// ============================================
router.get("/daily-records", dailyRecordsController.getAll);
router.get("/daily-records/by-key/:crewMemberId/:vesselId/:monthYear", dailyRecordsController.getByKey);
router.post("/daily-records/backfill-violations", dailyRecordsController.backfillViolations);
router.get("/daily-records/:uuid", dailyRecordsController.getByUuid);
router.post("/daily-records", dailyRecordsController.create);
router.put("/daily-records/:uuid", dailyRecordsController.update);
router.delete("/daily-records/:uuid", dailyRecordsController.delete);

// ============================================
// VESSEL COMMENTS
// ============================================
router.get("/vessel-comments", commentsController.getAllVesselComments);
router.get("/vessel-comments/:uuid", commentsController.getVesselCommentByUuid);
router.post("/vessel-comments", commentsController.createVesselComment);
router.put("/vessel-comments/:uuid", commentsController.updateVesselComment);
router.delete("/vessel-comments/:uuid", commentsController.deleteVesselComment);

// ============================================
// OFFICE COMMENTS
// ============================================
router.get("/office-comments", commentsController.getAllOfficeComments);
router.get("/office-comments/:uuid", commentsController.getOfficeCommentByUuid);
router.post("/office-comments", commentsController.createOfficeComment);
router.put("/office-comments/:uuid", commentsController.updateOfficeComment);
router.delete("/office-comments/:uuid", commentsController.deleteOfficeComment);

// ============================================
// NC REPORTS
// ============================================
router.get("/nc-reports", ncReportsController.getAll);
router.get("/nc-reports/:uuid", ncReportsController.getByUuid);
router.post("/nc-reports", ncReportsController.create);
router.put("/nc-reports/:uuid", ncReportsController.update);
router.delete("/nc-reports/:uuid", ncReportsController.delete);

// ============================================
// FIXED TASKS
// ============================================
router.get("/fixed-tasks", fixedTasksController.getAll);
router.get("/fixed-tasks/by-key/:crewMemberId/:vesselId/:monthYear", fixedTasksController.getByKey);
router.get("/fixed-tasks/:uuid", fixedTasksController.getByUuid);
router.post("/fixed-tasks", fixedTasksController.create);
router.put("/fixed-tasks/:uuid", fixedTasksController.update);
router.delete("/fixed-tasks/:uuid", fixedTasksController.delete);

// ============================================
// VARIABLE TASKS
// ============================================
router.get("/variable-tasks", variableTasksController.getAll);
router.get("/variable-tasks/drafts", variableTasksController.getDrafts);
router.get("/variable-tasks/:uuid", variableTasksController.getByUuid);
router.post("/variable-tasks", variableTasksController.create);
router.put("/variable-tasks/:uuid", variableTasksController.update);
router.delete("/variable-tasks/:uuid", variableTasksController.delete);
router.post("/variable-tasks/:uuid/publish", variableTasksController.publish);

// ============================================
// DATELINE ADJUSTMENTS
// ============================================
router.get("/dateline", datelineController.getAll);
router.get("/dateline/:uuid", datelineController.getByUuid);
router.post("/dateline", datelineController.create);
router.put("/dateline/:uuid", datelineController.update);
router.delete("/dateline/:uuid", datelineController.delete);

// ============================================
// MASTER DATA (Vessels & Crew for V2)
// ============================================
router.get("/masters/vessels", masterDataController.getVessels);
router.get("/masters/crew-members", masterDataController.getCrewMembers);
router.get("/masters/crew-count-by-vessel", masterDataController.getCrewCountByVessel);

export default router;
