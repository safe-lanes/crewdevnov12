import { Router } from "express";
import {
  getAllCandidates,
  getCandidateById,
  createCandidate,
  updateCandidate,
  deleteCandidate,
  getVesselTypesApplied,
  addVesselTypeApplied,
  removeVesselTypeApplied,
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
  getNextOfKin,
  createNextOfKin,
  updateNextOfKin,
  deleteNextOfKin,
  getTravelDocuments,
  createTravelDocument,
  updateTravelDocument,
  deleteTravelDocument,
  getVisas,
  createVisa,
  updateVisa,
  deleteVisa,
  getCocs,
  createCoc,
  updateCoc,
  deleteCoc,
  getCops,
  createCop,
  updateCop,
  deleteCop,
  getStcwCertificates,
  createStcwCertificate,
  updateStcwCertificate,
  deleteStcwCertificate,
  getFlagEndorsements,
  createFlagEndorsement,
  updateFlagEndorsement,
  deleteFlagEndorsement,
  getMedicalCertificates,
  createMedicalCertificate,
  updateMedicalCertificate,
  deleteMedicalCertificate,
  getVaccinations,
  createVaccination,
  updateVaccination,
  deleteVaccination,
  getTrainingCertificates,
  createTrainingCertificate,
  updateTrainingCertificate,
  deleteTrainingCertificate,
  getEducation,
  createEducation,
  updateEducation,
  deleteEducation,
  getSeaServiceInternal,
  createSeaServiceInternal,
  updateSeaServiceInternal,
  deleteSeaServiceInternal,
  getSeaServiceExternal,
  createSeaServiceExternal,
  updateSeaServiceExternal,
  deleteSeaServiceExternal,
  getLicenses,
  createLicense,
  updateLicense,
  deleteLicense,
  getDocumentAttachments,
  getDocumentAttachmentsByParent,
  createDocumentAttachment,
  updateDocumentAttachment,
  deleteDocumentAttachment,
} from "../../v2/recruitment/controllers";

const router = Router();

// ============================================================================
// CANDIDATE ROUTES
// ============================================================================

router.get("/candidates", getAllCandidates);
router.post("/candidates", createCandidate);
router.get("/candidates/:id", getCandidateById);
router.put("/candidates/:id", updateCandidate);
router.delete("/candidates/:id", deleteCandidate);

// ============================================================================
// VESSEL TYPES APPLIED ROUTES
// ============================================================================

router.get("/candidates/:id/vessel-types-applied", getVesselTypesApplied);
router.post("/candidates/:id/vessel-types-applied", addVesselTypeApplied);
router.delete("/candidates/:id/vessel-types-applied/:vtaId", removeVesselTypeApplied);

// ============================================================================
// PERSONAL DETAILS ROUTES (One-to-One)
// ============================================================================

router.get("/candidates/:id/personal-details", getPersonalDetails);
router.put("/candidates/:id/personal-details", upsertPersonalDetails);

// ============================================================================
// ADDRESS ROUTES (One-to-One)
// ============================================================================

router.get("/candidates/:id/addresses", getAddress);
router.put("/candidates/:id/addresses", upsertAddress);

// ============================================================================
// FAMILY INFO ROUTES (One-to-One)
// ============================================================================

router.get("/candidates/:id/family-info", getFamilyInfo);
router.put("/candidates/:id/family-info", upsertFamilyInfo);

// ============================================================================
// CHILDREN ROUTES (One-to-Many)
// ============================================================================

router.get("/candidates/:id/children", getChildren);
router.post("/candidates/:id/children", createChild);
router.put("/candidates/:id/children/:childId", updateChild);
router.delete("/candidates/:id/children/:childId", deleteChild);

// ============================================================================
// NEXT OF KIN ROUTES (One-to-Many)
// ============================================================================

router.get("/candidates/:id/next-of-kin", getNextOfKin);
router.post("/candidates/:id/next-of-kin", createNextOfKin);
router.put("/candidates/:id/next-of-kin/:nokId", updateNextOfKin);
router.delete("/candidates/:id/next-of-kin/:nokId", deleteNextOfKin);

// ============================================================================
// PHASE 2: DOCUMENTS & CERTIFICATES ROUTES
// ============================================================================

// Travel Documents
router.get("/candidates/:recCanUuid/travel-documents", getTravelDocuments);
router.post("/candidates/:recCanUuid/travel-documents", createTravelDocument);
router.put("/candidates/:recCanUuid/travel-documents/:id", updateTravelDocument);
router.delete("/candidates/:recCanUuid/travel-documents/:id", deleteTravelDocument);

// Visas
router.get("/candidates/:recCanUuid/visas", getVisas);
router.post("/candidates/:recCanUuid/visas", createVisa);
router.put("/candidates/:recCanUuid/visas/:id", updateVisa);
router.delete("/candidates/:recCanUuid/visas/:id", deleteVisa);

// COC (Certificates of Competency)
router.get("/candidates/:recCanUuid/cocs", getCocs);
router.post("/candidates/:recCanUuid/cocs", createCoc);
router.put("/candidates/:recCanUuid/cocs/:id", updateCoc);
router.delete("/candidates/:recCanUuid/cocs/:id", deleteCoc);

// COP (Certificates of Proficiency)
router.get("/candidates/:recCanUuid/cops", getCops);
router.post("/candidates/:recCanUuid/cops", createCop);
router.put("/candidates/:recCanUuid/cops/:id", updateCop);
router.delete("/candidates/:recCanUuid/cops/:id", deleteCop);

// STCW Certificates
router.get("/candidates/:recCanUuid/stcw-certificates", getStcwCertificates);
router.post("/candidates/:recCanUuid/stcw-certificates", createStcwCertificate);
router.put("/candidates/:recCanUuid/stcw-certificates/:id", updateStcwCertificate);
router.delete("/candidates/:recCanUuid/stcw-certificates/:id", deleteStcwCertificate);

// Flag Endorsements
router.get("/candidates/:recCanUuid/flag-endorsements", getFlagEndorsements);
router.post("/candidates/:recCanUuid/flag-endorsements", createFlagEndorsement);
router.put("/candidates/:recCanUuid/flag-endorsements/:id", updateFlagEndorsement);
router.delete("/candidates/:recCanUuid/flag-endorsements/:id", deleteFlagEndorsement);

// Medical Certificates
router.get("/candidates/:recCanUuid/medical-certificates", getMedicalCertificates);
router.post("/candidates/:recCanUuid/medical-certificates", createMedicalCertificate);
router.put("/candidates/:recCanUuid/medical-certificates/:id", updateMedicalCertificate);
router.delete("/candidates/:recCanUuid/medical-certificates/:id", deleteMedicalCertificate);

// Vaccinations
router.get("/candidates/:recCanUuid/vaccinations", getVaccinations);
router.post("/candidates/:recCanUuid/vaccinations", createVaccination);
router.put("/candidates/:recCanUuid/vaccinations/:id", updateVaccination);
router.delete("/candidates/:recCanUuid/vaccinations/:id", deleteVaccination);

// Training Certificates
router.get("/candidates/:recCanUuid/training-certificates", getTrainingCertificates);
router.post("/candidates/:recCanUuid/training-certificates", createTrainingCertificate);
router.put("/candidates/:recCanUuid/training-certificates/:id", updateTrainingCertificate);
router.delete("/candidates/:recCanUuid/training-certificates/:id", deleteTrainingCertificate);

// Education
router.get("/candidates/:recCanUuid/education", getEducation);
router.post("/candidates/:recCanUuid/education", createEducation);
router.put("/candidates/:recCanUuid/education/:id", updateEducation);
router.delete("/candidates/:recCanUuid/education/:id", deleteEducation);

// Sea Service Internal
router.get("/candidates/:recCanUuid/sea-service-internal", getSeaServiceInternal);
router.post("/candidates/:recCanUuid/sea-service-internal", createSeaServiceInternal);
router.put("/candidates/:recCanUuid/sea-service-internal/:id", updateSeaServiceInternal);
router.delete("/candidates/:recCanUuid/sea-service-internal/:id", deleteSeaServiceInternal);

// Sea Service External
router.get("/candidates/:recCanUuid/sea-service-external", getSeaServiceExternal);
router.post("/candidates/:recCanUuid/sea-service-external", createSeaServiceExternal);
router.put("/candidates/:recCanUuid/sea-service-external/:id", updateSeaServiceExternal);
router.delete("/candidates/:recCanUuid/sea-service-external/:id", deleteSeaServiceExternal);

// Licenses
router.get("/candidates/:recCanUuid/licenses", getLicenses);
router.post("/candidates/:recCanUuid/licenses", createLicense);
router.put("/candidates/:recCanUuid/licenses/:id", updateLicense);
router.delete("/candidates/:recCanUuid/licenses/:id", deleteLicense);

// Document Attachments
router.get("/candidates/:recCanUuid/document-attachments", getDocumentAttachments);
router.get("/candidates/:recCanUuid/document-attachments/:parentTableName/:parentRecordUuid", getDocumentAttachmentsByParent);
router.post("/candidates/:recCanUuid/document-attachments", createDocumentAttachment);
router.put("/candidates/:recCanUuid/document-attachments/:id", updateDocumentAttachment);
router.delete("/candidates/:recCanUuid/document-attachments/:id", deleteDocumentAttachment);

export default router;
