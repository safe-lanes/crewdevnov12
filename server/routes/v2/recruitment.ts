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
  getEducation,
  createEducation,
  updateEducation,
  deleteEducation,
  getLicenses,
  createLicense,
  updateLicense,
  deleteLicense,
  getTrainingCourses,
  createTrainingCourse,
  updateTrainingCourse,
  deleteTrainingCourse,
  getSeaService,
  createSeaService,
  updateSeaService,
  deleteSeaService,
  getAdditionalInfo,
  createAdditionalInfo,
  updateAdditionalInfo,
  deleteAdditionalInfo,
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
} from "../../v2/recruitment/controllers/screeningController";

import {
  approvalsController,
  suitabilityController,
  recruitmentDecisionController,
} from "../../v2/recruitment/controllers/approvalsController";

const router = Router();

router.get("/candidates", getAllCandidates);
router.post("/candidates", createCandidate);
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

router.get("/candidates/:recCanUuid/visas", getVisas);
router.post("/candidates/:recCanUuid/visas", createVisa);
router.patch("/visas/:id", updateVisa);
router.delete("/visas/:id", deleteVisa);

router.get("/candidates/:recCanUuid/education", getEducation);
router.post("/candidates/:recCanUuid/education", createEducation);
router.patch("/education/:id", updateEducation);
router.delete("/education/:id", deleteEducation);

router.get("/candidates/:recCanUuid/licenses", getLicenses);
router.post("/candidates/:recCanUuid/licenses", createLicense);
router.patch("/licenses/:id", updateLicense);
router.delete("/licenses/:id", deleteLicense);

router.get("/candidates/:recCanUuid/training", getTrainingCourses);
router.post("/candidates/:recCanUuid/training", createTrainingCourse);
router.patch("/training/:id", updateTrainingCourse);
router.delete("/training/:id", deleteTrainingCourse);

router.get("/candidates/:recCanUuid/sea-service", getSeaService);
router.post("/candidates/:recCanUuid/sea-service", createSeaService);
router.patch("/sea-service/:id", updateSeaService);
router.delete("/sea-service/:id", deleteSeaService);

router.get("/candidates/:recCanUuid/additional-info", getAdditionalInfo);
router.post("/candidates/:recCanUuid/additional-info", createAdditionalInfo);
router.patch("/additional-info/:id", updateAdditionalInfo);
router.delete("/additional-info/:id", deleteAdditionalInfo);

router.get("/candidates/:recCanUuid/screening/b1", screeningB1Controller.get);
router.put("/candidates/:recCanUuid/screening/b1", screeningB1Controller.upsert);
router.get("/screening/b1/:b1Uuid/comments", screeningB1Controller.getComments);
router.post("/screening/b1/:b1Uuid/comments", screeningB1Controller.createComment);
router.get("/screening/b1/:b1Uuid/attachments", screeningB1Controller.getAttachments);
router.post("/screening/b1/:b1Uuid/attachments", screeningB1Controller.createAttachment);

router.get("/candidates/:recCanUuid/screening/b2", screeningB2Controller.get);
router.put("/candidates/:recCanUuid/screening/b2", screeningB2Controller.upsert);
router.get("/screening/b2/:b2Uuid/items", screeningB2Controller.getItems);
router.post("/screening/b2/:b2Uuid/items", screeningB2Controller.createItem);

router.get("/candidates/:recCanUuid/screening/b3", screeningB3Controller.get);
router.put("/candidates/:recCanUuid/screening/b3", screeningB3Controller.upsert);
router.get("/screening/b3/:b3Uuid/authorities", screeningB3Controller.getAuthorities);
router.post("/screening/b3/:b3Uuid/authorities", screeningB3Controller.createAuthority);

router.get("/candidates/:recCanUuid/screening/b4", screeningB4Controller.get);
router.put("/candidates/:recCanUuid/screening/b4", screeningB4Controller.upsert);
router.get("/screening/b4/:b4Uuid/cert-items", screeningB4Controller.getCertItems);
router.post("/screening/b4/:b4Uuid/cert-items", screeningB4Controller.createCertItem);

router.get("/candidates/:recCanUuid/screening/b5", screeningB5Controller.get);
router.put("/candidates/:recCanUuid/screening/b5", screeningB5Controller.upsert);
router.get("/screening/b5/:b5Uuid/test-items", screeningB5Controller.getTestItems);
router.post("/screening/b5/:b5Uuid/test-items", screeningB5Controller.createTestItem);

router.get("/candidates/:recCanUuid/screening/b6", screeningB6Controller.get);
router.put("/candidates/:recCanUuid/screening/b6", screeningB6Controller.upsert);
router.get("/screening/b6/:b6Uuid/interview-items", screeningB6Controller.getInterviewItems);
router.post("/screening/b6/:b6Uuid/interview-items", screeningB6Controller.createInterviewItem);

router.get("/candidates/:recCanUuid/screening/b7", screeningB7Controller.get);
router.put("/candidates/:recCanUuid/screening/b7", screeningB7Controller.upsert);
router.get("/screening/b7/:b7Uuid/training-items", screeningB7Controller.getTrainingItems);
router.post("/screening/b7/:b7Uuid/training-items", screeningB7Controller.createTrainingItem);

router.get("/candidates/:recCanUuid/screening/b8", screeningB8Controller.get);
router.put("/candidates/:recCanUuid/screening/b8", screeningB8Controller.upsert);
router.get("/screening/b8/:b8Uuid/approvers", screeningB8Controller.getApprovers);
router.post("/screening/b8/:b8Uuid/approvers", screeningB8Controller.createApprover);

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

export default router;
