import { Router } from "express";
import {
  getAllCandidates,
  getCandidateById,
  getCandidateByUuid,
  createCandidate,
  updateCandidate,
  updateCandidateByUuid,
  deleteCandidate,
  deleteCandidateByUuid,
  getVesselTypesApplied,
  addVesselTypeApplied,
  removeVesselTypeApplied,
  replaceVesselTypes,
  getPersonalDetails,
  upsertPersonalDetails,
  getAddress,
  upsertAddress,
  getFamilyInfo,
  upsertFamilyInfo,
  getChildren,
  createChild,
  updateChild,
  deleteChild,
  replaceChildren,
  getNextOfKin,
  upsertNextOfKin,
  getNextFileNumber,
} from "../../v2/recruitment/controllers/candidateController";

import {
  getDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  getDocumentAttachments,
  createDocumentAttachment,
  getVisas,
  createVisa,
  updateVisa,
  deleteVisa,
  getVisaAttachments,
  createVisaAttachment,
  getEducation,
  createEducation,
  updateEducation,
  deleteEducation,
  getEducationAttachments,
  createEducationAttachment,
  getLicenses,
  createLicense,
  updateLicense,
  deleteLicense,
  getLicenseAttachments,
  createLicenseAttachment,
  getTrainingCourses,
  createTrainingCourse,
  updateTrainingCourse,
  deleteTrainingCourse,
  getTrainingAttachments,
  createTrainingAttachment,
  getSeaService,
  createSeaService,
  updateSeaService,
  deleteSeaService,
  getSeaServiceAttachments,
  createSeaServiceAttachment,
  getAdditionalInfo,
  createAdditionalInfo,
  updateAdditionalInfo,
  deleteAdditionalInfo,
  getAdditionalInfoAttachments,
  createAdditionalInfoAttachment,
  deleteDocumentAttachment,
  deleteVisaAttachment,
  deleteEducationAttachment,
  deleteLicenseAttachment,
  deleteTrainingAttachment,
  deleteSeaServiceAttachment,
  deleteAdditionalInfoAttachment,
  serveDocumentAttachment,
  serveVisaAttachment,
  serveEducationAttachment,
  serveLicenseAttachment,
  serveTrainingAttachment,
  serveSeaServiceAttachment,
  serveAdditionalInfoAttachment,
} from "../../v2/recruitment/controllers/documentsController";

import {
  screeningB1Controller,
  screeningB2Controller,
  screeningB3Controller,
  screeningB4Controller,
  screeningB5Controller,
  screeningB6Controller,
  screeningB7Controller,
  screeningB8Controller,
  screeningSummaryController,
} from "../../v2/recruitment/controllers/screeningController";

import {
  approvalsController,
  suitabilityController,
  recruitmentDecisionController,
} from "../../v2/recruitment/controllers/approvalsController";

const router = Router();

router.get("/candidates", getAllCandidates);
router.post("/candidates", createCandidate);
router.get("/candidates/next-file-number", getNextFileNumber);
router.get("/candidates/:recCanUuid", getCandidateByUuid);
router.patch("/candidates/:recCanUuid", updateCandidateByUuid);
router.delete("/candidates/:recCanUuid", deleteCandidateByUuid);

router.get("/candidates/:recCanUuid/vessel-types", getVesselTypesApplied);
router.post("/candidates/:recCanUuid/vessel-types", addVesselTypeApplied);
router.put("/candidates/:recCanUuid/vessel-types", replaceVesselTypes);
router.delete("/candidates/:recCanUuid/vessel-types/:id", removeVesselTypeApplied);

router.get("/candidates/:recCanUuid/personal-details", getPersonalDetails);
router.put("/candidates/:recCanUuid/personal-details", upsertPersonalDetails);

router.get("/candidates/:recCanUuid/address", getAddress);
router.put("/candidates/:recCanUuid/address", upsertAddress);

router.get("/candidates/:recCanUuid/family-info", getFamilyInfo);
router.put("/candidates/:recCanUuid/family-info", upsertFamilyInfo);

router.get("/candidates/:recCanUuid/children", getChildren);
router.post("/candidates/:recCanUuid/children", createChild);
router.put("/candidates/:recCanUuid/children", replaceChildren);
router.patch("/candidates/:recCanUuid/children/:id", updateChild);
router.delete("/candidates/:recCanUuid/children/:id", deleteChild);

router.get("/candidates/:recCanUuid/next-of-kin", getNextOfKin);
router.put("/candidates/:recCanUuid/next-of-kin", upsertNextOfKin);

router.get("/candidates/:recCanUuid/documents", getDocuments);
router.post("/candidates/:recCanUuid/documents", createDocument);
router.patch("/documents/:id", updateDocument);
router.delete("/documents/:id", deleteDocument);
router.get("/documents/:docUuid/attachments", getDocumentAttachments);
router.post("/documents/:docUuid/attachments", createDocumentAttachment);
router.delete("/documents/attachments/:id", deleteDocumentAttachment);

router.get("/candidates/:recCanUuid/visas", getVisas);
router.post("/candidates/:recCanUuid/visas", createVisa);
router.patch("/visas/:id", updateVisa);
router.delete("/visas/:id", deleteVisa);
router.get("/visas/:visaUuid/attachments", getVisaAttachments);
router.post("/visas/:visaUuid/attachments", createVisaAttachment);
router.delete("/visas/attachments/:id", deleteVisaAttachment);

router.get("/candidates/:recCanUuid/education", getEducation);
router.post("/candidates/:recCanUuid/education", createEducation);
router.patch("/education/:id", updateEducation);
router.delete("/education/:id", deleteEducation);
router.get("/education/:eduUuid/attachments", getEducationAttachments);
router.post("/education/:eduUuid/attachments", createEducationAttachment);
router.delete("/education/attachments/:id", deleteEducationAttachment);

router.get("/candidates/:recCanUuid/licenses", getLicenses);
router.post("/candidates/:recCanUuid/licenses", createLicense);
router.patch("/licenses/:id", updateLicense);
router.delete("/licenses/:id", deleteLicense);
router.get("/licenses/:licUuid/attachments", getLicenseAttachments);
router.post("/licenses/:licUuid/attachments", createLicenseAttachment);
router.delete("/licenses/attachments/:id", deleteLicenseAttachment);

router.get("/candidates/:recCanUuid/training", getTrainingCourses);
router.post("/candidates/:recCanUuid/training", createTrainingCourse);
router.patch("/training/:id", updateTrainingCourse);
router.delete("/training/:id", deleteTrainingCourse);
router.get("/training/:trainUuid/attachments", getTrainingAttachments);
router.post("/training/:trainUuid/attachments", createTrainingAttachment);
router.delete("/training/attachments/:id", deleteTrainingAttachment);

router.get("/candidates/:recCanUuid/sea-service", getSeaService);
router.post("/candidates/:recCanUuid/sea-service", createSeaService);
router.patch("/sea-service/:id", updateSeaService);
router.delete("/sea-service/:id", deleteSeaService);
router.get("/sea-service/:seaUuid/attachments", getSeaServiceAttachments);
router.post("/sea-service/:seaUuid/attachments", createSeaServiceAttachment);
router.delete("/sea-service/attachments/:id", deleteSeaServiceAttachment);

router.get("/candidates/:recCanUuid/additional-info", getAdditionalInfo);
router.post("/candidates/:recCanUuid/additional-info", createAdditionalInfo);
router.patch("/additional-info/:id", updateAdditionalInfo);
router.delete("/additional-info/:id", deleteAdditionalInfo);
router.get("/additional-info/:infoUuid/attachments", getAdditionalInfoAttachments);
router.post("/additional-info/:infoUuid/attachments", createAdditionalInfoAttachment);
router.delete("/additional-info/attachments/:id", deleteAdditionalInfoAttachment);

router.get("/candidates/:recCanUuid/screening/summary", screeningSummaryController.get);

router.get("/candidates/:recCanUuid/screening/b1", screeningB1Controller.get);
router.put("/candidates/:recCanUuid/screening/b1", screeningB1Controller.upsert);
router.get("/screening/b1/:b1Uuid/comments", screeningB1Controller.getComments);
router.post("/screening/b1/:b1Uuid/comments", screeningB1Controller.createComment);
router.put("/screening/b1/comments/:commentUuid", screeningB1Controller.updateComment);
router.delete("/screening/b1/comments/:commentUuid", screeningB1Controller.deleteComment);
router.get("/screening/b1/:b1Uuid/attachments", screeningB1Controller.getAttachments);
router.post("/screening/b1/:b1Uuid/attachments", screeningB1Controller.createAttachment);
router.delete("/screening/b1/attachments/:id", screeningB1Controller.deleteAttachment);

router.get("/candidates/:recCanUuid/screening/b2", screeningB2Controller.get);
router.put("/candidates/:recCanUuid/screening/b2", screeningB2Controller.upsert);
router.get("/screening/b2/:b2Uuid/items", screeningB2Controller.getItems);
router.post("/screening/b2/:b2Uuid/items", screeningB2Controller.createItem);
router.put("/screening/b2/items/:refUuid", screeningB2Controller.updateItem);
router.get("/screening/b2/:b2Uuid/comments", screeningB2Controller.getComments);
router.post("/screening/b2/:b2Uuid/comments", screeningB2Controller.createComment);
router.put("/screening/b2/comments/:commentUuid", screeningB2Controller.updateComment);
router.delete("/screening/b2/comments/:commentUuid", screeningB2Controller.deleteComment);
router.delete("/screening/b2/items/:refUuid", screeningB2Controller.deleteItem);
router.get("/screening/b2/:b2Uuid/attachments", screeningB2Controller.getAttachments);
router.post("/screening/b2/:b2Uuid/attachments", screeningB2Controller.createAttachment);
router.delete("/screening/b2/attachments/:id", screeningB2Controller.deleteAttachment);

router.get("/candidates/:recCanUuid/screening/b3", screeningB3Controller.get);
router.put("/candidates/:recCanUuid/screening/b3", screeningB3Controller.upsert);
router.get("/screening/b3/:b3Uuid/authorities", screeningB3Controller.getAuthorities);
router.post("/screening/b3/:b3Uuid/authorities", screeningB3Controller.createAuthority);
router.put("/screening/b3/authorities/:authUuid", screeningB3Controller.updateAuthority);
router.get("/screening/b3/:b3Uuid/comments", screeningB3Controller.getComments);
router.post("/screening/b3/:b3Uuid/comments", screeningB3Controller.createComment);
router.put("/screening/b3/comments/:commentUuid", screeningB3Controller.updateComment);
router.delete("/screening/b3/comments/:commentUuid", screeningB3Controller.deleteComment);
router.delete("/screening/b3/authorities/:authUuid", screeningB3Controller.deleteAuthority);
router.get("/screening/b3/:b3Uuid/attachments", screeningB3Controller.getAttachments);
router.post("/screening/b3/:b3Uuid/attachments", screeningB3Controller.createAttachment);
router.delete("/screening/b3/attachments/:id", screeningB3Controller.deleteAttachment);

router.get("/candidates/:recCanUuid/screening/b4", screeningB4Controller.get);
router.put("/candidates/:recCanUuid/screening/b4", screeningB4Controller.upsert);
router.get("/screening/b4/:b4Uuid/cert-items", screeningB4Controller.getCertItems);
router.post("/screening/b4/:b4Uuid/cert-items", screeningB4Controller.createCertItem);
router.put("/screening/b4/cert-items/:certUuid", screeningB4Controller.updateCertItem);
router.get("/screening/b4/:b4Uuid/comments", screeningB4Controller.getComments);
router.post("/screening/b4/:b4Uuid/comments", screeningB4Controller.createComment);
router.put("/screening/b4/comments/:commentUuid", screeningB4Controller.updateComment);
router.delete("/screening/b4/comments/:commentUuid", screeningB4Controller.deleteComment);
router.delete("/screening/b4/certs/:certUuid", screeningB4Controller.deleteCertItem);
router.get("/screening/b4/:b4Uuid/attachments", screeningB4Controller.getAttachments);
router.post("/screening/b4/:b4Uuid/attachments", screeningB4Controller.createAttachment);
router.delete("/screening/b4/attachments/:id", screeningB4Controller.deleteAttachment);

router.get("/candidates/:recCanUuid/screening/b5", screeningB5Controller.get);
router.put("/candidates/:recCanUuid/screening/b5", screeningB5Controller.upsert);
router.get("/screening/b5/:b5Uuid/test-items", screeningB5Controller.getTestItems);
router.post("/screening/b5/:b5Uuid/test-items", screeningB5Controller.createTestItem);
router.put("/screening/b5/test-items/:testUuid", screeningB5Controller.updateTestItem);
router.get("/screening/b5/:b5Uuid/comments", screeningB5Controller.getComments);
router.post("/screening/b5/:b5Uuid/comments", screeningB5Controller.createComment);
router.put("/screening/b5/comments/:commentUuid", screeningB5Controller.updateComment);
router.delete("/screening/b5/comments/:commentUuid", screeningB5Controller.deleteComment);
router.delete("/screening/b5/tests/:testUuid", screeningB5Controller.deleteTestItem);
router.get("/screening/b5/:b5Uuid/attachments", screeningB5Controller.getAttachments);
router.post("/screening/b5/:b5Uuid/attachments", screeningB5Controller.createAttachment);
router.delete("/screening/b5/attachments/:id", screeningB5Controller.deleteAttachment);

router.get("/candidates/:recCanUuid/screening/b6", screeningB6Controller.get);
router.put("/candidates/:recCanUuid/screening/b6", screeningB6Controller.upsert);
router.get("/screening/b6/:b6Uuid/interview-items", screeningB6Controller.getInterviewItems);
router.post("/screening/b6/:b6Uuid/interview-items", screeningB6Controller.createInterviewItem);
router.put("/screening/b6/interview-items/:intUuid", screeningB6Controller.updateInterviewItem);
router.get("/screening/b6/:b6Uuid/comments", screeningB6Controller.getComments);
router.post("/screening/b6/:b6Uuid/comments", screeningB6Controller.createComment);
router.put("/screening/b6/comments/:commentUuid", screeningB6Controller.updateComment);
router.delete("/screening/b6/comments/:commentUuid", screeningB6Controller.deleteComment);
router.delete("/screening/b6/interviews/:intUuid", screeningB6Controller.deleteInterviewItem);
router.get("/screening/b6/:b6Uuid/attachments", screeningB6Controller.getAttachments);
router.post("/screening/b6/:b6Uuid/attachments", screeningB6Controller.createAttachment);
router.delete("/screening/b6/attachments/:id", screeningB6Controller.deleteAttachment);

router.get("/candidates/:recCanUuid/screening/b7", screeningB7Controller.get);
router.put("/candidates/:recCanUuid/screening/b7", screeningB7Controller.upsert);
router.get("/screening/b7/:b7Uuid/training-items", screeningB7Controller.getTrainingItems);
router.post("/screening/b7/:b7Uuid/training-items", screeningB7Controller.createTrainingItem);
router.put("/screening/b7/training-items/:trainItemUuid", screeningB7Controller.updateTrainingItem);
router.delete("/screening/b7/training/:trainItemUuid", screeningB7Controller.deleteTrainingItem);

router.get("/candidates/:recCanUuid/screening/b8", screeningB8Controller.get);
router.put("/candidates/:recCanUuid/screening/b8", screeningB8Controller.upsert);
router.get("/screening/b8/:b8Uuid/approvers", screeningB8Controller.getApprovers);
router.post("/screening/b8/:b8Uuid/approvers", screeningB8Controller.createApprover);
router.post("/screening/b8/approver-details", screeningB8Controller.getApproverDetails);
router.get("/screening/b8/:b8Uuid/comments", screeningB8Controller.getComments);
router.post("/screening/b8/:b8Uuid/comments", screeningB8Controller.createComment);
router.put("/screening/b8/comments/:commentUuid", screeningB8Controller.updateComment);
router.delete("/screening/b8/comments/:commentUuid", screeningB8Controller.deleteComment);
router.get("/screening/b8/:b8Uuid/attachments", screeningB8Controller.getAttachments);
router.post("/screening/b8/:b8Uuid/attachments", screeningB8Controller.createAttachment);
router.delete("/screening/b8/attachments/:id", screeningB8Controller.deleteAttachment);

router.get("/candidates/:recCanUuid/approvals", approvalsController.getApprovals);
router.post("/candidates/:recCanUuid/approvals", approvalsController.createApproval);
router.patch("/approvals/:id", approvalsController.updateApproval);
router.delete("/approvals/:id", approvalsController.deleteApproval);

router.get("/candidates/:recCanUuid/suitability", suitabilityController.get);
router.put("/candidates/:recCanUuid/suitability", suitabilityController.upsert);
router.get("/suitability/:suitUuid/vessel-types", suitabilityController.getVesselTypes);
router.post("/suitability/:suitUuid/vessel-types", suitabilityController.addVesselType);
router.get("/suitability/:suitUuid/fleet-groups", suitabilityController.getFleetGroups);
router.post("/suitability/:suitUuid/fleet-groups", suitabilityController.addFleetGroup);

router.get("/candidates/:recCanUuid/decision", recruitmentDecisionController.get);
router.put("/candidates/:recCanUuid/decision", recruitmentDecisionController.upsert);
router.get("/decisions/:decisionUuid/assigned-groups", recruitmentDecisionController.getAssignedGroups);
router.post("/decisions/:decisionUuid/assigned-groups", recruitmentDecisionController.addAssignedGroup);

// ============================================
// ATTACHMENT RAW STREAMING ROUTES (filesystem)
// ============================================
router.get("/documents/attachments/:attUuid/raw", serveDocumentAttachment);
router.get("/visas/attachments/:attUuid/raw", serveVisaAttachment);
router.get("/education/attachments/:attUuid/raw", serveEducationAttachment);
router.get("/licenses/attachments/:attUuid/raw", serveLicenseAttachment);
router.get("/training/attachments/:attUuid/raw", serveTrainingAttachment);
router.get("/sea-service/attachments/:attUuid/raw", serveSeaServiceAttachment);
router.get("/additional-info/attachments/:attUuid/raw", serveAdditionalInfoAttachment);
router.get("/screening/b1/attachments/:attUuid/raw", screeningB1Controller.serveAttachment);
router.get("/screening/b2/attachments/:attUuid/raw", screeningB2Controller.serveAttachment);
router.get("/screening/b3/attachments/:attUuid/raw", screeningB3Controller.serveAttachment);
router.get("/screening/b4/attachments/:attUuid/raw", screeningB4Controller.serveAttachment);
router.get("/screening/b5/attachments/:attUuid/raw", screeningB5Controller.serveAttachment);
router.get("/screening/b6/attachments/:attUuid/raw", screeningB6Controller.serveAttachment);
router.get("/screening/b8/attachments/:attUuid/raw", screeningB8Controller.serveAttachment);

// Master data endpoints for dropdowns
router.get("/fleet-groups", async (_req, res) => {
  try {
    const { getDb } = await import("../../v2/db");
    const { masterFleetGroups } = await import("@shared/schema");
    const db = getDb();
    const fleetGroups = await db.select({
      fgUuid: masterFleetGroups.fgUuid,
      name: masterFleetGroups.name,
      vessels: masterFleetGroups.vessels,
    }).from(masterFleetGroups);
    res.json({ fleetGroups });
  } catch (error) {
    console.error("Error fetching fleet groups:", error);
    res.status(500).json({ error: "Failed to fetch fleet groups" });
  }
});

export default router;
