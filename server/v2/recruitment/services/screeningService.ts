import {
  screeningGeneralInfoRepository,
  screeningAvailabilityRepository,
  screeningSalaryHistoryRepository,
  screeningDocumentsChecklistRepository,
  screeningTechnicalSkillsRepository,
  screeningCompetencyRatingsRepository,
  screeningEquipmentExperienceRepository,
  screeningLanguageProficiencyRepository,
  screeningPracticalTestsRepository,
  screeningInterviewsRepository,
  screeningInterviewPanelistsRepository,
  screeningInterviewQuestionsRepository,
  screeningInterviewNotesRepository,
  screeningEmployerReferencesRepository,
  screeningReferenceResponsesRepository,
  screeningPersonalReferencesRepository,
  screeningSeaServiceVerificationRepository,
  screeningBackgroundChecksRepository,
  screeningCriminalRecordsRepository,
  screeningEmploymentVerificationRepository,
  screeningEducationVerificationRepository,
  screeningPsychometricTestsRepository,
  screeningPsychometricDimensionsRepository,
  screeningBehavioralAssessmentsRepository,
  screeningPemeRepository,
  screeningPemeResultsRepository,
  screeningDrugAlcoholTestsRepository,
  screeningFinalEvaluationRepository,
  screeningEvaluationApprovalsRepository,
} from "../repositories/screeningRepository";

// Helper type for create data
type CreateData<T> = Partial<Omit<T, "id" | "createdAt" | "updatedAt" | "recCanUuid">>;

// ============================================================================
// B1: GENERAL SCREENING SERVICES
// ============================================================================

export const screeningGeneralInfoService = {
  getByCandidate: (recCanUuid: string) => screeningGeneralInfoRepository.findByCandidate(recCanUuid),
  upsert: <T>(recCanUuid: string, data: CreateData<T>) => screeningGeneralInfoRepository.upsert(recCanUuid, data as any),
};

export const screeningAvailabilityService = {
  getByCandidate: (recCanUuid: string) => screeningAvailabilityRepository.findByCandidate(recCanUuid),
  create: <T>(recCanUuid: string, data: CreateData<T>) => screeningAvailabilityRepository.create(recCanUuid, data as any),
  update: <T>(id: number, data: CreateData<T>) => screeningAvailabilityRepository.update(id, data as any),
  delete: (id: number) => screeningAvailabilityRepository.delete(id),
};

export const screeningSalaryHistoryService = {
  getByCandidate: (recCanUuid: string) => screeningSalaryHistoryRepository.findByCandidate(recCanUuid),
  create: <T>(recCanUuid: string, data: CreateData<T>) => screeningSalaryHistoryRepository.create(recCanUuid, data as any),
  update: <T>(id: number, data: CreateData<T>) => screeningSalaryHistoryRepository.update(id, data as any),
  delete: (id: number) => screeningSalaryHistoryRepository.delete(id),
};

export const screeningDocumentsChecklistService = {
  getByCandidate: (recCanUuid: string) => screeningDocumentsChecklistRepository.findByCandidate(recCanUuid),
  upsert: <T>(recCanUuid: string, data: CreateData<T>) => screeningDocumentsChecklistRepository.upsert(recCanUuid, data as any),
};

// ============================================================================
// B2: SKILLS ASSESSMENT SERVICES
// ============================================================================

export const screeningTechnicalSkillsService = {
  getByCandidate: (recCanUuid: string) => screeningTechnicalSkillsRepository.findByCandidate(recCanUuid),
  create: <T>(recCanUuid: string, data: CreateData<T>) => screeningTechnicalSkillsRepository.create(recCanUuid, data as any),
  update: <T>(id: number, data: CreateData<T>) => screeningTechnicalSkillsRepository.update(id, data as any),
  delete: (id: number) => screeningTechnicalSkillsRepository.delete(id),
};

export const screeningCompetencyRatingsService = {
  getByCandidate: (recCanUuid: string) => screeningCompetencyRatingsRepository.findByCandidate(recCanUuid),
  create: <T>(recCanUuid: string, data: CreateData<T>) => screeningCompetencyRatingsRepository.create(recCanUuid, data as any),
  update: <T>(id: number, data: CreateData<T>) => screeningCompetencyRatingsRepository.update(id, data as any),
  delete: (id: number) => screeningCompetencyRatingsRepository.delete(id),
};

export const screeningEquipmentExperienceService = {
  getByCandidate: (recCanUuid: string) => screeningEquipmentExperienceRepository.findByCandidate(recCanUuid),
  create: <T>(recCanUuid: string, data: CreateData<T>) => screeningEquipmentExperienceRepository.create(recCanUuid, data as any),
  update: <T>(id: number, data: CreateData<T>) => screeningEquipmentExperienceRepository.update(id, data as any),
  delete: (id: number) => screeningEquipmentExperienceRepository.delete(id),
};

export const screeningLanguageProficiencyService = {
  getByCandidate: (recCanUuid: string) => screeningLanguageProficiencyRepository.findByCandidate(recCanUuid),
  create: <T>(recCanUuid: string, data: CreateData<T>) => screeningLanguageProficiencyRepository.create(recCanUuid, data as any),
  update: <T>(id: number, data: CreateData<T>) => screeningLanguageProficiencyRepository.update(id, data as any),
  delete: (id: number) => screeningLanguageProficiencyRepository.delete(id),
};

export const screeningPracticalTestsService = {
  getByCandidate: (recCanUuid: string) => screeningPracticalTestsRepository.findByCandidate(recCanUuid),
  create: <T>(recCanUuid: string, data: CreateData<T>) => screeningPracticalTestsRepository.create(recCanUuid, data as any),
  update: <T>(id: number, data: CreateData<T>) => screeningPracticalTestsRepository.update(id, data as any),
  delete: (id: number) => screeningPracticalTestsRepository.delete(id),
};

// ============================================================================
// B3: INTERVIEW ASSESSMENT SERVICES
// ============================================================================

export const screeningInterviewsService = {
  getByCandidate: (recCanUuid: string) => screeningInterviewsRepository.findByCandidate(recCanUuid),
  create: <T>(recCanUuid: string, data: CreateData<T>) => screeningInterviewsRepository.create(recCanUuid, data as any),
  update: <T>(id: number, data: CreateData<T>) => screeningInterviewsRepository.update(id, data as any),
  delete: (id: number) => screeningInterviewsRepository.delete(id),
};

export const screeningInterviewPanelistsService = {
  getByCandidate: (recCanUuid: string) => screeningInterviewPanelistsRepository.findByCandidate(recCanUuid),
  getByInterview: (interviewUuid: string) => screeningInterviewPanelistsRepository.findByInterview(interviewUuid),
  create: <T>(recCanUuid: string, data: CreateData<T>) => screeningInterviewPanelistsRepository.create(recCanUuid, data as any),
  update: <T>(id: number, data: CreateData<T>) => screeningInterviewPanelistsRepository.update(id, data as any),
  delete: (id: number) => screeningInterviewPanelistsRepository.delete(id),
};

export const screeningInterviewQuestionsService = {
  getByCandidate: (recCanUuid: string) => screeningInterviewQuestionsRepository.findByCandidate(recCanUuid),
  getByInterview: (interviewUuid: string) => screeningInterviewQuestionsRepository.findByInterview(interviewUuid),
  create: <T>(recCanUuid: string, data: CreateData<T>) => screeningInterviewQuestionsRepository.create(recCanUuid, data as any),
  update: <T>(id: number, data: CreateData<T>) => screeningInterviewQuestionsRepository.update(id, data as any),
  delete: (id: number) => screeningInterviewQuestionsRepository.delete(id),
};

export const screeningInterviewNotesService = {
  getByCandidate: (recCanUuid: string) => screeningInterviewNotesRepository.findByCandidate(recCanUuid),
  getByInterview: (interviewUuid: string) => screeningInterviewNotesRepository.findByInterview(interviewUuid),
  create: <T>(recCanUuid: string, data: CreateData<T>) => screeningInterviewNotesRepository.create(recCanUuid, data as any),
  update: <T>(id: number, data: CreateData<T>) => screeningInterviewNotesRepository.update(id, data as any),
  delete: (id: number) => screeningInterviewNotesRepository.delete(id),
};

// ============================================================================
// B4: REFERENCE CHECKS SERVICES
// ============================================================================

export const screeningEmployerReferencesService = {
  getByCandidate: (recCanUuid: string) => screeningEmployerReferencesRepository.findByCandidate(recCanUuid),
  create: <T>(recCanUuid: string, data: CreateData<T>) => screeningEmployerReferencesRepository.create(recCanUuid, data as any),
  update: <T>(id: number, data: CreateData<T>) => screeningEmployerReferencesRepository.update(id, data as any),
  delete: (id: number) => screeningEmployerReferencesRepository.delete(id),
};

export const screeningReferenceResponsesService = {
  getByCandidate: (recCanUuid: string) => screeningReferenceResponsesRepository.findByCandidate(recCanUuid),
  getByReference: (empRefUuid: string) => screeningReferenceResponsesRepository.findByReference(empRefUuid),
  create: <T>(recCanUuid: string, data: CreateData<T>) => screeningReferenceResponsesRepository.create(recCanUuid, data as any),
  update: <T>(id: number, data: CreateData<T>) => screeningReferenceResponsesRepository.update(id, data as any),
  delete: (id: number) => screeningReferenceResponsesRepository.delete(id),
};

export const screeningPersonalReferencesService = {
  getByCandidate: (recCanUuid: string) => screeningPersonalReferencesRepository.findByCandidate(recCanUuid),
  create: <T>(recCanUuid: string, data: CreateData<T>) => screeningPersonalReferencesRepository.create(recCanUuid, data as any),
  update: <T>(id: number, data: CreateData<T>) => screeningPersonalReferencesRepository.update(id, data as any),
  delete: (id: number) => screeningPersonalReferencesRepository.delete(id),
};

export const screeningSeaServiceVerificationService = {
  getByCandidate: (recCanUuid: string) => screeningSeaServiceVerificationRepository.findByCandidate(recCanUuid),
  create: <T>(recCanUuid: string, data: CreateData<T>) => screeningSeaServiceVerificationRepository.create(recCanUuid, data as any),
  update: <T>(id: number, data: CreateData<T>) => screeningSeaServiceVerificationRepository.update(id, data as any),
  delete: (id: number) => screeningSeaServiceVerificationRepository.delete(id),
};

// ============================================================================
// B5: BACKGROUND VERIFICATION SERVICES
// ============================================================================

export const screeningBackgroundChecksService = {
  getByCandidate: (recCanUuid: string) => screeningBackgroundChecksRepository.findByCandidate(recCanUuid),
  upsert: <T>(recCanUuid: string, data: CreateData<T>) => screeningBackgroundChecksRepository.upsert(recCanUuid, data as any),
};

export const screeningCriminalRecordsService = {
  getByCandidate: (recCanUuid: string) => screeningCriminalRecordsRepository.findByCandidate(recCanUuid),
  create: <T>(recCanUuid: string, data: CreateData<T>) => screeningCriminalRecordsRepository.create(recCanUuid, data as any),
  update: <T>(id: number, data: CreateData<T>) => screeningCriminalRecordsRepository.update(id, data as any),
  delete: (id: number) => screeningCriminalRecordsRepository.delete(id),
};

export const screeningEmploymentVerificationService = {
  getByCandidate: (recCanUuid: string) => screeningEmploymentVerificationRepository.findByCandidate(recCanUuid),
  create: <T>(recCanUuid: string, data: CreateData<T>) => screeningEmploymentVerificationRepository.create(recCanUuid, data as any),
  update: <T>(id: number, data: CreateData<T>) => screeningEmploymentVerificationRepository.update(id, data as any),
  delete: (id: number) => screeningEmploymentVerificationRepository.delete(id),
};

export const screeningEducationVerificationService = {
  getByCandidate: (recCanUuid: string) => screeningEducationVerificationRepository.findByCandidate(recCanUuid),
  create: <T>(recCanUuid: string, data: CreateData<T>) => screeningEducationVerificationRepository.create(recCanUuid, data as any),
  update: <T>(id: number, data: CreateData<T>) => screeningEducationVerificationRepository.update(id, data as any),
  delete: (id: number) => screeningEducationVerificationRepository.delete(id),
};

// ============================================================================
// B6: PSYCHOLOGICAL ASSESSMENT SERVICES
// ============================================================================

export const screeningPsychometricTestsService = {
  getByCandidate: (recCanUuid: string) => screeningPsychometricTestsRepository.findByCandidate(recCanUuid),
  create: <T>(recCanUuid: string, data: CreateData<T>) => screeningPsychometricTestsRepository.create(recCanUuid, data as any),
  update: <T>(id: number, data: CreateData<T>) => screeningPsychometricTestsRepository.update(id, data as any),
  delete: (id: number) => screeningPsychometricTestsRepository.delete(id),
};

export const screeningPsychometricDimensionsService = {
  getByCandidate: (recCanUuid: string) => screeningPsychometricDimensionsRepository.findByCandidate(recCanUuid),
  getByTest: (psychTestUuid: string) => screeningPsychometricDimensionsRepository.findByTest(psychTestUuid),
  create: <T>(recCanUuid: string, data: CreateData<T>) => screeningPsychometricDimensionsRepository.create(recCanUuid, data as any),
  update: <T>(id: number, data: CreateData<T>) => screeningPsychometricDimensionsRepository.update(id, data as any),
  delete: (id: number) => screeningPsychometricDimensionsRepository.delete(id),
};

export const screeningBehavioralAssessmentsService = {
  getByCandidate: (recCanUuid: string) => screeningBehavioralAssessmentsRepository.findByCandidate(recCanUuid),
  create: <T>(recCanUuid: string, data: CreateData<T>) => screeningBehavioralAssessmentsRepository.create(recCanUuid, data as any),
  update: <T>(id: number, data: CreateData<T>) => screeningBehavioralAssessmentsRepository.update(id, data as any),
  delete: (id: number) => screeningBehavioralAssessmentsRepository.delete(id),
};

// ============================================================================
// B7: MEDICAL SCREENING SERVICES
// ============================================================================

export const screeningPemeService = {
  getByCandidate: (recCanUuid: string) => screeningPemeRepository.findByCandidate(recCanUuid),
  create: <T>(recCanUuid: string, data: CreateData<T>) => screeningPemeRepository.create(recCanUuid, data as any),
  update: <T>(id: number, data: CreateData<T>) => screeningPemeRepository.update(id, data as any),
  delete: (id: number) => screeningPemeRepository.delete(id),
};

export const screeningPemeResultsService = {
  getByCandidate: (recCanUuid: string) => screeningPemeResultsRepository.findByCandidate(recCanUuid),
  getByPeme: (pemeUuid: string) => screeningPemeResultsRepository.findByPeme(pemeUuid),
  create: <T>(recCanUuid: string, data: CreateData<T>) => screeningPemeResultsRepository.create(recCanUuid, data as any),
  update: <T>(id: number, data: CreateData<T>) => screeningPemeResultsRepository.update(id, data as any),
  delete: (id: number) => screeningPemeResultsRepository.delete(id),
};

export const screeningDrugAlcoholTestsService = {
  getByCandidate: (recCanUuid: string) => screeningDrugAlcoholTestsRepository.findByCandidate(recCanUuid),
  create: <T>(recCanUuid: string, data: CreateData<T>) => screeningDrugAlcoholTestsRepository.create(recCanUuid, data as any),
  update: <T>(id: number, data: CreateData<T>) => screeningDrugAlcoholTestsRepository.update(id, data as any),
  delete: (id: number) => screeningDrugAlcoholTestsRepository.delete(id),
};

// ============================================================================
// B8: FINAL EVALUATION SERVICES
// ============================================================================

export const screeningFinalEvaluationService = {
  getByCandidate: (recCanUuid: string) => screeningFinalEvaluationRepository.findByCandidate(recCanUuid),
  upsert: <T>(recCanUuid: string, data: CreateData<T>) => screeningFinalEvaluationRepository.upsert(recCanUuid, data as any),
};

export const screeningEvaluationApprovalsService = {
  getByCandidate: (recCanUuid: string) => screeningEvaluationApprovalsRepository.findByCandidate(recCanUuid),
  getByEvaluation: (finalEvalUuid: string) => screeningEvaluationApprovalsRepository.findByEvaluation(finalEvalUuid),
  create: <T>(recCanUuid: string, data: CreateData<T>) => screeningEvaluationApprovalsRepository.create(recCanUuid, data as any),
  update: <T>(id: number, data: CreateData<T>) => screeningEvaluationApprovalsRepository.update(id, data as any),
  delete: (id: number) => screeningEvaluationApprovalsRepository.delete(id),
};
