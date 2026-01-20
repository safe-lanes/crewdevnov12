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
  // Phase 3: Screening B1-B8 Controllers
  getScreeningGeneralInfo,
  upsertScreeningGeneralInfo,
  getScreeningAvailability,
  createScreeningAvailability,
  updateScreeningAvailability,
  deleteScreeningAvailability,
  getScreeningSalaryHistory,
  createScreeningSalaryHistory,
  updateScreeningSalaryHistory,
  deleteScreeningSalaryHistory,
  getScreeningDocumentsChecklist,
  upsertScreeningDocumentsChecklist,
  getScreeningTechnicalSkills,
  createScreeningTechnicalSkills,
  updateScreeningTechnicalSkills,
  deleteScreeningTechnicalSkills,
  getScreeningCompetencyRatings,
  createScreeningCompetencyRatings,
  updateScreeningCompetencyRatings,
  deleteScreeningCompetencyRatings,
  getScreeningEquipmentExperience,
  createScreeningEquipmentExperience,
  updateScreeningEquipmentExperience,
  deleteScreeningEquipmentExperience,
  getScreeningLanguageProficiency,
  createScreeningLanguageProficiency,
  updateScreeningLanguageProficiency,
  deleteScreeningLanguageProficiency,
  getScreeningPracticalTests,
  createScreeningPracticalTests,
  updateScreeningPracticalTests,
  deleteScreeningPracticalTests,
  getScreeningInterviews,
  createScreeningInterviews,
  updateScreeningInterviews,
  deleteScreeningInterviews,
  getScreeningInterviewPanelists,
  createScreeningInterviewPanelists,
  updateScreeningInterviewPanelists,
  deleteScreeningInterviewPanelists,
  getScreeningInterviewQuestions,
  createScreeningInterviewQuestions,
  updateScreeningInterviewQuestions,
  deleteScreeningInterviewQuestions,
  getScreeningInterviewNotes,
  createScreeningInterviewNotes,
  updateScreeningInterviewNotes,
  deleteScreeningInterviewNotes,
  getScreeningEmployerReferences,
  createScreeningEmployerReferences,
  updateScreeningEmployerReferences,
  deleteScreeningEmployerReferences,
  getScreeningReferenceResponses,
  createScreeningReferenceResponses,
  updateScreeningReferenceResponses,
  deleteScreeningReferenceResponses,
  getScreeningPersonalReferences,
  createScreeningPersonalReferences,
  updateScreeningPersonalReferences,
  deleteScreeningPersonalReferences,
  getScreeningSeaServiceVerification,
  createScreeningSeaServiceVerification,
  updateScreeningSeaServiceVerification,
  deleteScreeningSeaServiceVerification,
  getScreeningBackgroundChecks,
  upsertScreeningBackgroundChecks,
  getScreeningCriminalRecords,
  createScreeningCriminalRecords,
  updateScreeningCriminalRecords,
  deleteScreeningCriminalRecords,
  getScreeningEmploymentVerification,
  createScreeningEmploymentVerification,
  updateScreeningEmploymentVerification,
  deleteScreeningEmploymentVerification,
  getScreeningEducationVerification,
  createScreeningEducationVerification,
  updateScreeningEducationVerification,
  deleteScreeningEducationVerification,
  getScreeningPsychometricTests,
  createScreeningPsychometricTests,
  updateScreeningPsychometricTests,
  deleteScreeningPsychometricTests,
  getScreeningPsychometricDimensions,
  createScreeningPsychometricDimensions,
  updateScreeningPsychometricDimensions,
  deleteScreeningPsychometricDimensions,
  getScreeningBehavioralAssessments,
  createScreeningBehavioralAssessments,
  updateScreeningBehavioralAssessments,
  deleteScreeningBehavioralAssessments,
  getScreeningPeme,
  createScreeningPeme,
  updateScreeningPeme,
  deleteScreeningPeme,
  getScreeningPemeResults,
  createScreeningPemeResults,
  updateScreeningPemeResults,
  deleteScreeningPemeResults,
  getScreeningDrugAlcoholTests,
  createScreeningDrugAlcoholTests,
  updateScreeningDrugAlcoholTests,
  deleteScreeningDrugAlcoholTests,
  getScreeningFinalEvaluation,
  upsertScreeningFinalEvaluation,
  getScreeningEvaluationApprovals,
  createScreeningEvaluationApprovals,
  updateScreeningEvaluationApprovals,
  deleteScreeningEvaluationApprovals,
} from "../../v2/recruitment/controllers";
import {
  hiringDecisionsController,
  offerLettersController,
  employmentContractsController,
  onboardingTasksController,
  decisionAuditTrailController,
  approvalWorkflowsController,
} from "../../v2/recruitment/controllers/approvalsController";

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

// ============================================================================
// PHASE 3: SCREENING B1-B8 ROUTES
// ============================================================================

// B1: GENERAL SCREENING

// General Info (One-to-One)
router.get("/candidates/:recCanUuid/screening/general-info", getScreeningGeneralInfo);
router.put("/candidates/:recCanUuid/screening/general-info", upsertScreeningGeneralInfo);

// Availability
router.get("/candidates/:recCanUuid/screening/availability", getScreeningAvailability);
router.post("/candidates/:recCanUuid/screening/availability", createScreeningAvailability);
router.put("/candidates/:recCanUuid/screening/availability/:id", updateScreeningAvailability);
router.delete("/candidates/:recCanUuid/screening/availability/:id", deleteScreeningAvailability);

// Salary History
router.get("/candidates/:recCanUuid/screening/salary-history", getScreeningSalaryHistory);
router.post("/candidates/:recCanUuid/screening/salary-history", createScreeningSalaryHistory);
router.put("/candidates/:recCanUuid/screening/salary-history/:id", updateScreeningSalaryHistory);
router.delete("/candidates/:recCanUuid/screening/salary-history/:id", deleteScreeningSalaryHistory);

// Documents Checklist (One-to-One)
router.get("/candidates/:recCanUuid/screening/documents-checklist", getScreeningDocumentsChecklist);
router.put("/candidates/:recCanUuid/screening/documents-checklist", upsertScreeningDocumentsChecklist);

// B2: SKILLS ASSESSMENT

// Technical Skills
router.get("/candidates/:recCanUuid/screening/technical-skills", getScreeningTechnicalSkills);
router.post("/candidates/:recCanUuid/screening/technical-skills", createScreeningTechnicalSkills);
router.put("/candidates/:recCanUuid/screening/technical-skills/:id", updateScreeningTechnicalSkills);
router.delete("/candidates/:recCanUuid/screening/technical-skills/:id", deleteScreeningTechnicalSkills);

// Competency Ratings
router.get("/candidates/:recCanUuid/screening/competency-ratings", getScreeningCompetencyRatings);
router.post("/candidates/:recCanUuid/screening/competency-ratings", createScreeningCompetencyRatings);
router.put("/candidates/:recCanUuid/screening/competency-ratings/:id", updateScreeningCompetencyRatings);
router.delete("/candidates/:recCanUuid/screening/competency-ratings/:id", deleteScreeningCompetencyRatings);

// Equipment Experience
router.get("/candidates/:recCanUuid/screening/equipment-experience", getScreeningEquipmentExperience);
router.post("/candidates/:recCanUuid/screening/equipment-experience", createScreeningEquipmentExperience);
router.put("/candidates/:recCanUuid/screening/equipment-experience/:id", updateScreeningEquipmentExperience);
router.delete("/candidates/:recCanUuid/screening/equipment-experience/:id", deleteScreeningEquipmentExperience);

// Language Proficiency
router.get("/candidates/:recCanUuid/screening/language-proficiency", getScreeningLanguageProficiency);
router.post("/candidates/:recCanUuid/screening/language-proficiency", createScreeningLanguageProficiency);
router.put("/candidates/:recCanUuid/screening/language-proficiency/:id", updateScreeningLanguageProficiency);
router.delete("/candidates/:recCanUuid/screening/language-proficiency/:id", deleteScreeningLanguageProficiency);

// Practical Tests
router.get("/candidates/:recCanUuid/screening/practical-tests", getScreeningPracticalTests);
router.post("/candidates/:recCanUuid/screening/practical-tests", createScreeningPracticalTests);
router.put("/candidates/:recCanUuid/screening/practical-tests/:id", updateScreeningPracticalTests);
router.delete("/candidates/:recCanUuid/screening/practical-tests/:id", deleteScreeningPracticalTests);

// B3: INTERVIEW ASSESSMENT

// Interviews
router.get("/candidates/:recCanUuid/screening/interviews", getScreeningInterviews);
router.post("/candidates/:recCanUuid/screening/interviews", createScreeningInterviews);
router.put("/candidates/:recCanUuid/screening/interviews/:id", updateScreeningInterviews);
router.delete("/candidates/:recCanUuid/screening/interviews/:id", deleteScreeningInterviews);

// Interview Panelists
router.get("/candidates/:recCanUuid/screening/interview-panelists", getScreeningInterviewPanelists);
router.post("/candidates/:recCanUuid/screening/interview-panelists", createScreeningInterviewPanelists);
router.put("/candidates/:recCanUuid/screening/interview-panelists/:id", updateScreeningInterviewPanelists);
router.delete("/candidates/:recCanUuid/screening/interview-panelists/:id", deleteScreeningInterviewPanelists);

// Interview Questions
router.get("/candidates/:recCanUuid/screening/interview-questions", getScreeningInterviewQuestions);
router.post("/candidates/:recCanUuid/screening/interview-questions", createScreeningInterviewQuestions);
router.put("/candidates/:recCanUuid/screening/interview-questions/:id", updateScreeningInterviewQuestions);
router.delete("/candidates/:recCanUuid/screening/interview-questions/:id", deleteScreeningInterviewQuestions);

// Interview Notes
router.get("/candidates/:recCanUuid/screening/interview-notes", getScreeningInterviewNotes);
router.post("/candidates/:recCanUuid/screening/interview-notes", createScreeningInterviewNotes);
router.put("/candidates/:recCanUuid/screening/interview-notes/:id", updateScreeningInterviewNotes);
router.delete("/candidates/:recCanUuid/screening/interview-notes/:id", deleteScreeningInterviewNotes);

// B4: REFERENCE CHECKS

// Employer References
router.get("/candidates/:recCanUuid/screening/employer-references", getScreeningEmployerReferences);
router.post("/candidates/:recCanUuid/screening/employer-references", createScreeningEmployerReferences);
router.put("/candidates/:recCanUuid/screening/employer-references/:id", updateScreeningEmployerReferences);
router.delete("/candidates/:recCanUuid/screening/employer-references/:id", deleteScreeningEmployerReferences);

// Reference Responses
router.get("/candidates/:recCanUuid/screening/reference-responses", getScreeningReferenceResponses);
router.post("/candidates/:recCanUuid/screening/reference-responses", createScreeningReferenceResponses);
router.put("/candidates/:recCanUuid/screening/reference-responses/:id", updateScreeningReferenceResponses);
router.delete("/candidates/:recCanUuid/screening/reference-responses/:id", deleteScreeningReferenceResponses);

// Personal References
router.get("/candidates/:recCanUuid/screening/personal-references", getScreeningPersonalReferences);
router.post("/candidates/:recCanUuid/screening/personal-references", createScreeningPersonalReferences);
router.put("/candidates/:recCanUuid/screening/personal-references/:id", updateScreeningPersonalReferences);
router.delete("/candidates/:recCanUuid/screening/personal-references/:id", deleteScreeningPersonalReferences);

// Sea Service Verification
router.get("/candidates/:recCanUuid/screening/sea-service-verification", getScreeningSeaServiceVerification);
router.post("/candidates/:recCanUuid/screening/sea-service-verification", createScreeningSeaServiceVerification);
router.put("/candidates/:recCanUuid/screening/sea-service-verification/:id", updateScreeningSeaServiceVerification);
router.delete("/candidates/:recCanUuid/screening/sea-service-verification/:id", deleteScreeningSeaServiceVerification);

// B5: BACKGROUND VERIFICATION

// Background Checks (One-to-One)
router.get("/candidates/:recCanUuid/screening/background-checks", getScreeningBackgroundChecks);
router.put("/candidates/:recCanUuid/screening/background-checks", upsertScreeningBackgroundChecks);

// Criminal Records
router.get("/candidates/:recCanUuid/screening/criminal-records", getScreeningCriminalRecords);
router.post("/candidates/:recCanUuid/screening/criminal-records", createScreeningCriminalRecords);
router.put("/candidates/:recCanUuid/screening/criminal-records/:id", updateScreeningCriminalRecords);
router.delete("/candidates/:recCanUuid/screening/criminal-records/:id", deleteScreeningCriminalRecords);

// Employment Verification
router.get("/candidates/:recCanUuid/screening/employment-verification", getScreeningEmploymentVerification);
router.post("/candidates/:recCanUuid/screening/employment-verification", createScreeningEmploymentVerification);
router.put("/candidates/:recCanUuid/screening/employment-verification/:id", updateScreeningEmploymentVerification);
router.delete("/candidates/:recCanUuid/screening/employment-verification/:id", deleteScreeningEmploymentVerification);

// Education Verification
router.get("/candidates/:recCanUuid/screening/education-verification", getScreeningEducationVerification);
router.post("/candidates/:recCanUuid/screening/education-verification", createScreeningEducationVerification);
router.put("/candidates/:recCanUuid/screening/education-verification/:id", updateScreeningEducationVerification);
router.delete("/candidates/:recCanUuid/screening/education-verification/:id", deleteScreeningEducationVerification);

// B6: PSYCHOLOGICAL ASSESSMENT

// Psychometric Tests
router.get("/candidates/:recCanUuid/screening/psychometric-tests", getScreeningPsychometricTests);
router.post("/candidates/:recCanUuid/screening/psychometric-tests", createScreeningPsychometricTests);
router.put("/candidates/:recCanUuid/screening/psychometric-tests/:id", updateScreeningPsychometricTests);
router.delete("/candidates/:recCanUuid/screening/psychometric-tests/:id", deleteScreeningPsychometricTests);

// Psychometric Dimensions
router.get("/candidates/:recCanUuid/screening/psychometric-dimensions", getScreeningPsychometricDimensions);
router.post("/candidates/:recCanUuid/screening/psychometric-dimensions", createScreeningPsychometricDimensions);
router.put("/candidates/:recCanUuid/screening/psychometric-dimensions/:id", updateScreeningPsychometricDimensions);
router.delete("/candidates/:recCanUuid/screening/psychometric-dimensions/:id", deleteScreeningPsychometricDimensions);

// Behavioral Assessments
router.get("/candidates/:recCanUuid/screening/behavioral-assessments", getScreeningBehavioralAssessments);
router.post("/candidates/:recCanUuid/screening/behavioral-assessments", createScreeningBehavioralAssessments);
router.put("/candidates/:recCanUuid/screening/behavioral-assessments/:id", updateScreeningBehavioralAssessments);
router.delete("/candidates/:recCanUuid/screening/behavioral-assessments/:id", deleteScreeningBehavioralAssessments);

// B7: MEDICAL SCREENING

// PEME
router.get("/candidates/:recCanUuid/screening/peme", getScreeningPeme);
router.post("/candidates/:recCanUuid/screening/peme", createScreeningPeme);
router.put("/candidates/:recCanUuid/screening/peme/:id", updateScreeningPeme);
router.delete("/candidates/:recCanUuid/screening/peme/:id", deleteScreeningPeme);

// PEME Results
router.get("/candidates/:recCanUuid/screening/peme-results", getScreeningPemeResults);
router.post("/candidates/:recCanUuid/screening/peme-results", createScreeningPemeResults);
router.put("/candidates/:recCanUuid/screening/peme-results/:id", updateScreeningPemeResults);
router.delete("/candidates/:recCanUuid/screening/peme-results/:id", deleteScreeningPemeResults);

// Drug Alcohol Tests
router.get("/candidates/:recCanUuid/screening/drug-alcohol-tests", getScreeningDrugAlcoholTests);
router.post("/candidates/:recCanUuid/screening/drug-alcohol-tests", createScreeningDrugAlcoholTests);
router.put("/candidates/:recCanUuid/screening/drug-alcohol-tests/:id", updateScreeningDrugAlcoholTests);
router.delete("/candidates/:recCanUuid/screening/drug-alcohol-tests/:id", deleteScreeningDrugAlcoholTests);

// B8: FINAL EVALUATION

// Final Evaluation (One-to-One)
router.get("/candidates/:recCanUuid/screening/final-evaluation", getScreeningFinalEvaluation);
router.put("/candidates/:recCanUuid/screening/final-evaluation", upsertScreeningFinalEvaluation);

// Evaluation Approvals
router.get("/candidates/:recCanUuid/screening/evaluation-approvals", getScreeningEvaluationApprovals);
router.post("/candidates/:recCanUuid/screening/evaluation-approvals", createScreeningEvaluationApprovals);
router.put("/candidates/:recCanUuid/screening/evaluation-approvals/:id", updateScreeningEvaluationApprovals);
router.delete("/candidates/:recCanUuid/screening/evaluation-approvals/:id", deleteScreeningEvaluationApprovals);

// ============================================================================
// PHASE 4: APPROVALS & DECISIONS
// ============================================================================

// Hiring Decisions (One-to-One)
router.get("/candidates/:recCanUuid/approvals/hiring-decision", hiringDecisionsController.get);
router.put("/candidates/:recCanUuid/approvals/hiring-decision", hiringDecisionsController.upsert);
router.delete("/candidates/:recCanUuid/approvals/hiring-decision/:decisionUuid", hiringDecisionsController.delete);

// Offer Letters (One-to-Many)
router.get("/candidates/:recCanUuid/approvals/offer-letters", offerLettersController.getAll);
router.post("/candidates/:recCanUuid/approvals/offer-letters", offerLettersController.create);
router.put("/candidates/:recCanUuid/approvals/offer-letters/:offerUuid", offerLettersController.update);
router.delete("/candidates/:recCanUuid/approvals/offer-letters/:offerUuid", offerLettersController.delete);

// Employment Contracts (One-to-Many)
router.get("/candidates/:recCanUuid/approvals/contracts", employmentContractsController.getAll);
router.post("/candidates/:recCanUuid/approvals/contracts", employmentContractsController.create);
router.put("/candidates/:recCanUuid/approvals/contracts/:contractUuid", employmentContractsController.update);
router.delete("/candidates/:recCanUuid/approvals/contracts/:contractUuid", employmentContractsController.delete);

// Onboarding Tasks (One-to-Many)
router.get("/candidates/:recCanUuid/approvals/onboarding-tasks", onboardingTasksController.getAll);
router.post("/candidates/:recCanUuid/approvals/onboarding-tasks", onboardingTasksController.create);
router.put("/candidates/:recCanUuid/approvals/onboarding-tasks/:taskUuid", onboardingTasksController.update);
router.delete("/candidates/:recCanUuid/approvals/onboarding-tasks/:taskUuid", onboardingTasksController.delete);

// Decision Audit Trail (One-to-Many)
router.get("/candidates/:recCanUuid/approvals/audit-trail", decisionAuditTrailController.getAll);
router.post("/candidates/:recCanUuid/approvals/audit-trail", decisionAuditTrailController.create);
router.delete("/candidates/:recCanUuid/approvals/audit-trail/:auditUuid", decisionAuditTrailController.delete);

// Approval Workflows (One-to-Many)
router.get("/candidates/:recCanUuid/approvals/workflows", approvalWorkflowsController.getAll);
router.post("/candidates/:recCanUuid/approvals/workflows", approvalWorkflowsController.create);
router.put("/candidates/:recCanUuid/approvals/workflows/:workflowUuid", approvalWorkflowsController.update);
router.delete("/candidates/:recCanUuid/approvals/workflows/:workflowUuid", approvalWorkflowsController.delete);

export default router;
