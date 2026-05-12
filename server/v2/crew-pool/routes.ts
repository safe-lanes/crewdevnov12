import { Router } from "express";
import {
  crewMembersController,
  crewAssignmentsController,
  crewPersonalController,
  crewVesselTypesController,
  crewFamilyController,
  crewDocumentsController,
  crewVisasController,
  crewEducationController,
  crewLicensesController,
  crewTrainingController,
  crewSeaServiceController,
  crewMedicalController,
  crewTransferController,
  dashboardController,
} from "./controllers";

const router = Router();

// ============================================
// CREW MEMBERS
// ============================================
router.get("/crew", crewMembersController.getAll);
router.get("/crew/enriched", crewMembersController.getAllEnriched);
router.get("/crew/details", crewMembersController.getAllWithDetails);
router.post("/crew", crewMembersController.create);
router.post("/crew/with-data", crewMembersController.createWithRelatedData);
router.get("/crew/by-emp-no/:empNo", crewMembersController.getByEmpNo);
router.get("/crew/by-emp-no/:empNo/dashboard", dashboardController.getDashboardByEmpNo);
router.get("/crew/:crewUuid", crewMembersController.getByUuid);
router.get("/crew/:crewUuid/profile", crewMembersController.getFullProfile);
router.get("/crew/:crewUuid/dashboard", dashboardController.getDashboardSummary);
router.patch("/crew/:crewUuid", crewMembersController.update);
router.patch("/crew/:crewUuid/protected", crewMembersController.updateWithProtection);
router.delete("/crew/:crewUuid", crewMembersController.delete);
router.post("/crew/:crewUuid/unarchive", crewMembersController.unarchive);
router.post("/crew/:crewUuid/terminations", crewMembersController.terminateEmployment);

// ============================================
// ASSIGNMENTS
// ============================================
router.get("/crew/:crewUuid/assignments", crewAssignmentsController.getAll);
router.get("/crew/:crewUuid/assignments/current", crewAssignmentsController.getCurrent);
router.get("/crew/:crewUuid/assignments/history", crewAssignmentsController.getHistory);
router.post("/crew/:crewUuid/assignments", crewAssignmentsController.create);
router.post("/crew/:crewUuid/assign", crewAssignmentsController.assignToVessel);
router.post("/crew/:crewUuid/sign-off", crewAssignmentsController.signOff);
router.patch("/crew/:crewUuid/assignments/:assignUuid", crewAssignmentsController.update);
router.delete("/crew/:crewUuid/assignments/:assignUuid", crewAssignmentsController.delete);

// ============================================
// VESSEL CREW (cross-reference)
// ============================================
router.get("/vessels/:vesselUuid/crew", crewAssignmentsController.getVesselCrew);

// ============================================
// VESSEL TYPES APPLIED
// ============================================
router.get("/crew/:crewUuid/vessel-types", crewVesselTypesController.getAll);
router.put("/crew/:crewUuid/vessel-types", crewVesselTypesController.sync);

// ============================================
// PERSONAL DETAILS
// ============================================
router.get("/crew/:crewUuid/personal", crewPersonalController.getPersonalDetails);
router.put("/crew/:crewUuid/personal", crewPersonalController.upsertPersonalDetails);
router.get("/crew/:crewUuid/address", crewPersonalController.getAddress);
router.put("/crew/:crewUuid/address", crewPersonalController.upsertAddress);

// ============================================
// FAMILY INFO
// ============================================
router.get("/crew/:crewUuid/family", crewFamilyController.getFamilyInfo);
router.put("/crew/:crewUuid/family", crewFamilyController.upsertFamilyInfo);
router.get("/crew/:crewUuid/children", crewFamilyController.getChildren);
router.post("/crew/:crewUuid/children", crewFamilyController.createChild);
router.patch("/crew/:crewUuid/children/:childUuid", crewFamilyController.updateChild);
router.delete("/crew/:crewUuid/children/:childUuid", crewFamilyController.deleteChild);
router.get("/crew/:crewUuid/next-of-kin", crewFamilyController.getNextOfKin);
router.put("/crew/:crewUuid/next-of-kin", crewFamilyController.upsertNextOfKin);

// ============================================
// DOCUMENTS
// ============================================
router.get("/crew/:crewUuid/documents", crewDocumentsController.getAll);
router.post("/crew/:crewUuid/documents", crewDocumentsController.create);
router.patch("/crew/:crewUuid/documents/:docUuid", crewDocumentsController.update);
router.delete("/crew/:crewUuid/documents/:docUuid", crewDocumentsController.delete);
router.post("/crew/:crewUuid/documents/:docUuid/attachments", crewDocumentsController.addAttachment);
router.delete("/crew/:crewUuid/documents/:docUuid/attachments/:attUuid", crewDocumentsController.removeAttachment);

// ============================================
// VISAS
// ============================================
router.get("/crew/:crewUuid/visas", crewVisasController.getAll);
router.get("/crew/:crewUuid/visas/expiring", crewVisasController.getExpiring);
router.post("/crew/:crewUuid/visas", crewVisasController.create);
router.patch("/crew/:crewUuid/visas/:visaUuid", crewVisasController.update);
router.delete("/crew/:crewUuid/visas/:visaUuid", crewVisasController.delete);
router.post("/crew/:crewUuid/visas/:visaUuid/attachments", crewVisasController.addAttachment);
router.delete("/crew/:crewUuid/visas/:visaUuid/attachments/:attUuid", crewVisasController.removeAttachment);

// ============================================
// EDUCATION
// ============================================
router.get("/crew/:crewUuid/education", crewEducationController.getAll);
router.post("/crew/:crewUuid/education", crewEducationController.create);
router.patch("/crew/:crewUuid/education/:eduUuid", crewEducationController.update);
router.delete("/crew/:crewUuid/education/:eduUuid", crewEducationController.delete);
router.post("/crew/:crewUuid/education/:eduUuid/attachments", crewEducationController.addAttachment);
router.delete("/crew/:crewUuid/education/:eduUuid/attachments/:attUuid", crewEducationController.removeAttachment);

// ============================================
// LICENSES
// ============================================
router.get("/crew/:crewUuid/licenses", crewLicensesController.getAll);
router.get("/crew/:crewUuid/licenses/expiring", crewLicensesController.getExpiring);
router.post("/crew/:crewUuid/licenses", crewLicensesController.create);
router.patch("/crew/:crewUuid/licenses/:licUuid", crewLicensesController.update);
router.delete("/crew/:crewUuid/licenses/:licUuid", crewLicensesController.delete);
router.patch("/crew/:crewUuid/licenses/:licUuid/archive", crewLicensesController.archive);
router.patch("/crew/:crewUuid/licenses/:licUuid/unarchive", crewLicensesController.unarchive);
router.post("/crew/:crewUuid/licenses/:licUuid/attachments", crewLicensesController.addAttachment);
router.delete("/crew/:crewUuid/licenses/:licUuid/attachments/:attUuid", crewLicensesController.removeAttachment);

// ============================================
// TRAINING
// ============================================
router.get("/crew/:crewUuid/training", crewTrainingController.getAll);
router.get("/crew/:crewUuid/training/expiring", crewTrainingController.getExpiring);
router.post("/crew/:crewUuid/training", crewTrainingController.create);
router.patch("/crew/:crewUuid/training/:trainUuid", crewTrainingController.update);
router.delete("/crew/:crewUuid/training/:trainUuid", crewTrainingController.delete);
router.post("/crew/:crewUuid/training/:trainUuid/attachments", crewTrainingController.addAttachment);
router.delete("/crew/:crewUuid/training/:trainUuid/attachments/:attUuid", crewTrainingController.removeAttachment);

// ============================================
// SEA SERVICE
// ============================================
router.get("/crew/:crewUuid/sea-service", crewSeaServiceController.getAll);
router.get("/crew/:crewUuid/sea-service/by-type", crewSeaServiceController.getByType);
router.get("/crew/:crewUuid/sea-service/experience", crewSeaServiceController.getTotalExperience);
router.post("/crew/:crewUuid/sea-service", crewSeaServiceController.create);
router.patch("/crew/:crewUuid/sea-service/:seaUuid", crewSeaServiceController.update);
router.delete("/crew/:crewUuid/sea-service/:seaUuid", crewSeaServiceController.delete);
router.post("/crew/:crewUuid/sea-service/:seaUuid/attachments", crewSeaServiceController.addAttachment);
router.delete("/crew/:crewUuid/sea-service/:seaUuid/attachments/:attUuid", crewSeaServiceController.removeAttachment);

// ============================================
// MEDICALS
// ============================================
router.get("/crew/:crewUuid/medicals", crewMedicalController.getMedicals);
router.get("/crew/:crewUuid/medicals/fitness-status", crewMedicalController.getFitnessStatus);
router.get("/crew/:crewUuid/medicals/all", crewMedicalController.getAllMedicalData);
router.post("/crew/:crewUuid/medicals", crewMedicalController.createMedical);
router.patch("/crew/:crewUuid/medicals/:medUuid", crewMedicalController.updateMedical);
router.delete("/crew/:crewUuid/medicals/:medUuid", crewMedicalController.deleteMedical);
router.post("/crew/:crewUuid/medicals/:medUuid/attachments", crewMedicalController.addMedicalAttachment);
router.delete("/crew/:crewUuid/medicals/:medUuid/attachments/:attUuid", crewMedicalController.removeMedicalAttachment);

// ============================================
// DOCTOR VISITS
// ============================================
router.get("/crew/:crewUuid/doctor-visits", crewMedicalController.getDoctorVisits);
router.post("/crew/:crewUuid/doctor-visits", crewMedicalController.createDoctorVisit);
router.patch("/crew/:crewUuid/doctor-visits/:visitUuid", crewMedicalController.updateDoctorVisit);
router.delete("/crew/:crewUuid/doctor-visits/:visitUuid", crewMedicalController.deleteDoctorVisit);
router.post("/crew/:crewUuid/doctor-visits/:visitUuid/attachments", crewMedicalController.addDoctorVisitAttachment);
router.delete("/crew/:crewUuid/doctor-visits/:visitUuid/attachments/:attUuid", crewMedicalController.removeDoctorVisitAttachment);

// ============================================
// TRANSFER FROM RECRUITMENT
// ============================================
router.post("/transfer/recruitment", crewTransferController.transferFromRecruitment);
router.get("/transfer/recruitment/:recCanUuid/check-duplicate", crewTransferController.checkDuplicate);
router.post("/transfer/validate", crewTransferController.validateTransfer);

export default router;
