import { Request, Response } from "express";
import {
  screeningGeneralInfoService,
  screeningAvailabilityService,
  screeningSalaryHistoryService,
  screeningDocumentsChecklistService,
  screeningTechnicalSkillsService,
  screeningCompetencyRatingsService,
  screeningEquipmentExperienceService,
  screeningLanguageProficiencyService,
  screeningPracticalTestsService,
  screeningInterviewsService,
  screeningInterviewPanelistsService,
  screeningInterviewQuestionsService,
  screeningInterviewNotesService,
  screeningEmployerReferencesService,
  screeningReferenceResponsesService,
  screeningPersonalReferencesService,
  screeningSeaServiceVerificationService,
  screeningBackgroundChecksService,
  screeningCriminalRecordsService,
  screeningEmploymentVerificationService,
  screeningEducationVerificationService,
  screeningPsychometricTestsService,
  screeningPsychometricDimensionsService,
  screeningBehavioralAssessmentsService,
  screeningPemeService,
  screeningPemeResultsService,
  screeningDrugAlcoholTestsService,
  screeningFinalEvaluationService,
  screeningEvaluationApprovalsService,
} from "../services/screeningService";

// ============================================================================
// B1: GENERAL SCREENING CONTROLLERS
// ============================================================================

// General Info (One-to-One)
export const getScreeningGeneralInfo = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningGeneralInfoService.getByCandidate(recCanUuid);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to get screening general info" });
  }
};

export const upsertScreeningGeneralInfo = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningGeneralInfoService.upsert(recCanUuid, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to upsert screening general info" });
  }
};

// Availability (One-to-Many)
export const getScreeningAvailability = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningAvailabilityService.getByCandidate(recCanUuid);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to get screening availability" });
  }
};

export const createScreeningAvailability = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningAvailabilityService.create(recCanUuid, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to create screening availability" });
  }
};

export const updateScreeningAvailability = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningAvailabilityService.update(parseInt(id), req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to update screening availability" });
  }
};

export const deleteScreeningAvailability = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningAvailabilityService.delete(parseInt(id));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to delete screening availability" });
  }
};

// Salary History (One-to-Many)
export const getScreeningSalaryHistory = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningSalaryHistoryService.getByCandidate(recCanUuid);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to get screening salary history" });
  }
};

export const createScreeningSalaryHistory = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningSalaryHistoryService.create(recCanUuid, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to create screening salary history" });
  }
};

export const updateScreeningSalaryHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningSalaryHistoryService.update(parseInt(id), req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to update screening salary history" });
  }
};

export const deleteScreeningSalaryHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningSalaryHistoryService.delete(parseInt(id));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to delete screening salary history" });
  }
};

// Documents Checklist (One-to-One)
export const getScreeningDocumentsChecklist = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningDocumentsChecklistService.getByCandidate(recCanUuid);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to get screening documents checklist" });
  }
};

export const upsertScreeningDocumentsChecklist = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningDocumentsChecklistService.upsert(recCanUuid, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to upsert screening documents checklist" });
  }
};

// ============================================================================
// B2: SKILLS ASSESSMENT CONTROLLERS
// ============================================================================

// Technical Skills
export const getScreeningTechnicalSkills = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningTechnicalSkillsService.getByCandidate(recCanUuid);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to get screening technical skills" });
  }
};

export const createScreeningTechnicalSkills = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningTechnicalSkillsService.create(recCanUuid, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to create screening technical skill" });
  }
};

export const updateScreeningTechnicalSkills = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningTechnicalSkillsService.update(parseInt(id), req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to update screening technical skill" });
  }
};

export const deleteScreeningTechnicalSkills = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningTechnicalSkillsService.delete(parseInt(id));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to delete screening technical skill" });
  }
};

// Competency Ratings
export const getScreeningCompetencyRatings = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningCompetencyRatingsService.getByCandidate(recCanUuid);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to get screening competency ratings" });
  }
};

export const createScreeningCompetencyRatings = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningCompetencyRatingsService.create(recCanUuid, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to create screening competency rating" });
  }
};

export const updateScreeningCompetencyRatings = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningCompetencyRatingsService.update(parseInt(id), req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to update screening competency rating" });
  }
};

export const deleteScreeningCompetencyRatings = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningCompetencyRatingsService.delete(parseInt(id));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to delete screening competency rating" });
  }
};

// Equipment Experience
export const getScreeningEquipmentExperience = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningEquipmentExperienceService.getByCandidate(recCanUuid);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to get screening equipment experience" });
  }
};

export const createScreeningEquipmentExperience = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningEquipmentExperienceService.create(recCanUuid, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to create screening equipment experience" });
  }
};

export const updateScreeningEquipmentExperience = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningEquipmentExperienceService.update(parseInt(id), req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to update screening equipment experience" });
  }
};

export const deleteScreeningEquipmentExperience = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningEquipmentExperienceService.delete(parseInt(id));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to delete screening equipment experience" });
  }
};

// Language Proficiency
export const getScreeningLanguageProficiency = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningLanguageProficiencyService.getByCandidate(recCanUuid);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to get screening language proficiency" });
  }
};

export const createScreeningLanguageProficiency = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningLanguageProficiencyService.create(recCanUuid, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to create screening language proficiency" });
  }
};

export const updateScreeningLanguageProficiency = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningLanguageProficiencyService.update(parseInt(id), req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to update screening language proficiency" });
  }
};

export const deleteScreeningLanguageProficiency = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningLanguageProficiencyService.delete(parseInt(id));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to delete screening language proficiency" });
  }
};

// Practical Tests
export const getScreeningPracticalTests = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningPracticalTestsService.getByCandidate(recCanUuid);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to get screening practical tests" });
  }
};

export const createScreeningPracticalTests = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningPracticalTestsService.create(recCanUuid, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to create screening practical test" });
  }
};

export const updateScreeningPracticalTests = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningPracticalTestsService.update(parseInt(id), req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to update screening practical test" });
  }
};

export const deleteScreeningPracticalTests = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningPracticalTestsService.delete(parseInt(id));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to delete screening practical test" });
  }
};

// ============================================================================
// B3: INTERVIEW ASSESSMENT CONTROLLERS
// ============================================================================

// Interviews
export const getScreeningInterviews = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningInterviewsService.getByCandidate(recCanUuid);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to get screening interviews" });
  }
};

export const createScreeningInterviews = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningInterviewsService.create(recCanUuid, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to create screening interview" });
  }
};

export const updateScreeningInterviews = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningInterviewsService.update(parseInt(id), req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to update screening interview" });
  }
};

export const deleteScreeningInterviews = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningInterviewsService.delete(parseInt(id));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to delete screening interview" });
  }
};

// Interview Panelists
export const getScreeningInterviewPanelists = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningInterviewPanelistsService.getByCandidate(recCanUuid);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to get screening interview panelists" });
  }
};

export const createScreeningInterviewPanelists = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningInterviewPanelistsService.create(recCanUuid, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to create screening interview panelist" });
  }
};

export const updateScreeningInterviewPanelists = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningInterviewPanelistsService.update(parseInt(id), req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to update screening interview panelist" });
  }
};

export const deleteScreeningInterviewPanelists = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningInterviewPanelistsService.delete(parseInt(id));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to delete screening interview panelist" });
  }
};

// Interview Questions
export const getScreeningInterviewQuestions = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningInterviewQuestionsService.getByCandidate(recCanUuid);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to get screening interview questions" });
  }
};

export const createScreeningInterviewQuestions = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningInterviewQuestionsService.create(recCanUuid, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to create screening interview question" });
  }
};

export const updateScreeningInterviewQuestions = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningInterviewQuestionsService.update(parseInt(id), req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to update screening interview question" });
  }
};

export const deleteScreeningInterviewQuestions = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningInterviewQuestionsService.delete(parseInt(id));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to delete screening interview question" });
  }
};

// Interview Notes
export const getScreeningInterviewNotes = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningInterviewNotesService.getByCandidate(recCanUuid);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to get screening interview notes" });
  }
};

export const createScreeningInterviewNotes = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningInterviewNotesService.create(recCanUuid, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to create screening interview note" });
  }
};

export const updateScreeningInterviewNotes = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningInterviewNotesService.update(parseInt(id), req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to update screening interview note" });
  }
};

export const deleteScreeningInterviewNotes = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningInterviewNotesService.delete(parseInt(id));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to delete screening interview note" });
  }
};

// ============================================================================
// B4: REFERENCE CHECKS CONTROLLERS
// ============================================================================

// Employer References
export const getScreeningEmployerReferences = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningEmployerReferencesService.getByCandidate(recCanUuid);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to get screening employer references" });
  }
};

export const createScreeningEmployerReferences = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningEmployerReferencesService.create(recCanUuid, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to create screening employer reference" });
  }
};

export const updateScreeningEmployerReferences = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningEmployerReferencesService.update(parseInt(id), req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to update screening employer reference" });
  }
};

export const deleteScreeningEmployerReferences = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningEmployerReferencesService.delete(parseInt(id));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to delete screening employer reference" });
  }
};

// Reference Responses
export const getScreeningReferenceResponses = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningReferenceResponsesService.getByCandidate(recCanUuid);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to get screening reference responses" });
  }
};

export const createScreeningReferenceResponses = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningReferenceResponsesService.create(recCanUuid, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to create screening reference response" });
  }
};

export const updateScreeningReferenceResponses = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningReferenceResponsesService.update(parseInt(id), req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to update screening reference response" });
  }
};

export const deleteScreeningReferenceResponses = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningReferenceResponsesService.delete(parseInt(id));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to delete screening reference response" });
  }
};

// Personal References
export const getScreeningPersonalReferences = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningPersonalReferencesService.getByCandidate(recCanUuid);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to get screening personal references" });
  }
};

export const createScreeningPersonalReferences = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningPersonalReferencesService.create(recCanUuid, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to create screening personal reference" });
  }
};

export const updateScreeningPersonalReferences = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningPersonalReferencesService.update(parseInt(id), req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to update screening personal reference" });
  }
};

export const deleteScreeningPersonalReferences = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningPersonalReferencesService.delete(parseInt(id));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to delete screening personal reference" });
  }
};

// Sea Service Verification
export const getScreeningSeaServiceVerification = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningSeaServiceVerificationService.getByCandidate(recCanUuid);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to get screening sea service verification" });
  }
};

export const createScreeningSeaServiceVerification = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningSeaServiceVerificationService.create(recCanUuid, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to create screening sea service verification" });
  }
};

export const updateScreeningSeaServiceVerification = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningSeaServiceVerificationService.update(parseInt(id), req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to update screening sea service verification" });
  }
};

export const deleteScreeningSeaServiceVerification = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningSeaServiceVerificationService.delete(parseInt(id));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to delete screening sea service verification" });
  }
};

// ============================================================================
// B5: BACKGROUND VERIFICATION CONTROLLERS
// ============================================================================

// Background Checks (One-to-One)
export const getScreeningBackgroundChecks = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningBackgroundChecksService.getByCandidate(recCanUuid);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to get screening background checks" });
  }
};

export const upsertScreeningBackgroundChecks = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningBackgroundChecksService.upsert(recCanUuid, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to upsert screening background checks" });
  }
};

// Criminal Records
export const getScreeningCriminalRecords = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningCriminalRecordsService.getByCandidate(recCanUuid);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to get screening criminal records" });
  }
};

export const createScreeningCriminalRecords = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningCriminalRecordsService.create(recCanUuid, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to create screening criminal record" });
  }
};

export const updateScreeningCriminalRecords = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningCriminalRecordsService.update(parseInt(id), req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to update screening criminal record" });
  }
};

export const deleteScreeningCriminalRecords = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningCriminalRecordsService.delete(parseInt(id));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to delete screening criminal record" });
  }
};

// Employment Verification
export const getScreeningEmploymentVerification = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningEmploymentVerificationService.getByCandidate(recCanUuid);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to get screening employment verification" });
  }
};

export const createScreeningEmploymentVerification = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningEmploymentVerificationService.create(recCanUuid, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to create screening employment verification" });
  }
};

export const updateScreeningEmploymentVerification = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningEmploymentVerificationService.update(parseInt(id), req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to update screening employment verification" });
  }
};

export const deleteScreeningEmploymentVerification = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningEmploymentVerificationService.delete(parseInt(id));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to delete screening employment verification" });
  }
};

// Education Verification
export const getScreeningEducationVerification = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningEducationVerificationService.getByCandidate(recCanUuid);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to get screening education verification" });
  }
};

export const createScreeningEducationVerification = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningEducationVerificationService.create(recCanUuid, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to create screening education verification" });
  }
};

export const updateScreeningEducationVerification = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningEducationVerificationService.update(parseInt(id), req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to update screening education verification" });
  }
};

export const deleteScreeningEducationVerification = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningEducationVerificationService.delete(parseInt(id));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to delete screening education verification" });
  }
};

// ============================================================================
// B6: PSYCHOLOGICAL ASSESSMENT CONTROLLERS
// ============================================================================

// Psychometric Tests
export const getScreeningPsychometricTests = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningPsychometricTestsService.getByCandidate(recCanUuid);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to get screening psychometric tests" });
  }
};

export const createScreeningPsychometricTests = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningPsychometricTestsService.create(recCanUuid, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to create screening psychometric test" });
  }
};

export const updateScreeningPsychometricTests = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningPsychometricTestsService.update(parseInt(id), req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to update screening psychometric test" });
  }
};

export const deleteScreeningPsychometricTests = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningPsychometricTestsService.delete(parseInt(id));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to delete screening psychometric test" });
  }
};

// Psychometric Dimensions
export const getScreeningPsychometricDimensions = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningPsychometricDimensionsService.getByCandidate(recCanUuid);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to get screening psychometric dimensions" });
  }
};

export const createScreeningPsychometricDimensions = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningPsychometricDimensionsService.create(recCanUuid, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to create screening psychometric dimension" });
  }
};

export const updateScreeningPsychometricDimensions = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningPsychometricDimensionsService.update(parseInt(id), req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to update screening psychometric dimension" });
  }
};

export const deleteScreeningPsychometricDimensions = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningPsychometricDimensionsService.delete(parseInt(id));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to delete screening psychometric dimension" });
  }
};

// Behavioral Assessments
export const getScreeningBehavioralAssessments = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningBehavioralAssessmentsService.getByCandidate(recCanUuid);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to get screening behavioral assessments" });
  }
};

export const createScreeningBehavioralAssessments = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningBehavioralAssessmentsService.create(recCanUuid, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to create screening behavioral assessment" });
  }
};

export const updateScreeningBehavioralAssessments = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningBehavioralAssessmentsService.update(parseInt(id), req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to update screening behavioral assessment" });
  }
};

export const deleteScreeningBehavioralAssessments = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningBehavioralAssessmentsService.delete(parseInt(id));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to delete screening behavioral assessment" });
  }
};

// ============================================================================
// B7: MEDICAL SCREENING CONTROLLERS
// ============================================================================

// PEME
export const getScreeningPeme = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningPemeService.getByCandidate(recCanUuid);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to get screening PEME" });
  }
};

export const createScreeningPeme = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningPemeService.create(recCanUuid, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to create screening PEME" });
  }
};

export const updateScreeningPeme = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningPemeService.update(parseInt(id), req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to update screening PEME" });
  }
};

export const deleteScreeningPeme = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningPemeService.delete(parseInt(id));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to delete screening PEME" });
  }
};

// PEME Results
export const getScreeningPemeResults = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningPemeResultsService.getByCandidate(recCanUuid);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to get screening PEME results" });
  }
};

export const createScreeningPemeResults = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningPemeResultsService.create(recCanUuid, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to create screening PEME result" });
  }
};

export const updateScreeningPemeResults = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningPemeResultsService.update(parseInt(id), req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to update screening PEME result" });
  }
};

export const deleteScreeningPemeResults = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningPemeResultsService.delete(parseInt(id));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to delete screening PEME result" });
  }
};

// Drug Alcohol Tests
export const getScreeningDrugAlcoholTests = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningDrugAlcoholTestsService.getByCandidate(recCanUuid);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to get screening drug alcohol tests" });
  }
};

export const createScreeningDrugAlcoholTests = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningDrugAlcoholTestsService.create(recCanUuid, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to create screening drug alcohol test" });
  }
};

export const updateScreeningDrugAlcoholTests = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningDrugAlcoholTestsService.update(parseInt(id), req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to update screening drug alcohol test" });
  }
};

export const deleteScreeningDrugAlcoholTests = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningDrugAlcoholTestsService.delete(parseInt(id));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to delete screening drug alcohol test" });
  }
};

// ============================================================================
// B8: FINAL EVALUATION CONTROLLERS
// ============================================================================

// Final Evaluation (One-to-One)
export const getScreeningFinalEvaluation = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningFinalEvaluationService.getByCandidate(recCanUuid);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to get screening final evaluation" });
  }
};

export const upsertScreeningFinalEvaluation = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningFinalEvaluationService.upsert(recCanUuid, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to upsert screening final evaluation" });
  }
};

// Evaluation Approvals
export const getScreeningEvaluationApprovals = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningEvaluationApprovalsService.getByCandidate(recCanUuid);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to get screening evaluation approvals" });
  }
};

export const createScreeningEvaluationApprovals = async (req: Request, res: Response) => {
  try {
    const { recCanUuid } = req.params;
    const result = await screeningEvaluationApprovalsService.create(recCanUuid, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to create screening evaluation approval" });
  }
};

export const updateScreeningEvaluationApprovals = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningEvaluationApprovalsService.update(parseInt(id), req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to update screening evaluation approval" });
  }
};

export const deleteScreeningEvaluationApprovals = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await screeningEvaluationApprovalsService.delete(parseInt(id));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to delete screening evaluation approval" });
  }
};
