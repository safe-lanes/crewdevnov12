import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db";
import {
  screeningGeneralInfo,
  screeningAvailability,
  screeningSalaryHistory,
  screeningDocumentsChecklist,
  screeningTechnicalSkills,
  screeningCompetencyRatings,
  screeningEquipmentExperience,
  screeningLanguageProficiency,
  screeningPracticalTests,
  screeningInterviews,
  screeningInterviewPanelists,
  screeningInterviewQuestions,
  screeningInterviewNotes,
  screeningEmployerReferences,
  screeningReferenceResponses,
  screeningPersonalReferences,
  screeningSeaServiceVerification,
  screeningBackgroundChecks,
  screeningCriminalRecords,
  screeningEmploymentVerification,
  screeningEducationVerification,
  screeningPsychometricTests,
  screeningPsychometricDimensions,
  screeningBehavioralAssessments,
  screeningPeme,
  screeningPemeResults,
  screeningDrugAlcoholTests,
  screeningFinalEvaluation,
  screeningEvaluationApprovals,
} from "@shared/v2/recruitment/schema";

type ScreeningGeneralInfo = typeof screeningGeneralInfo.$inferSelect;
type ScreeningAvailability = typeof screeningAvailability.$inferSelect;
type ScreeningSalaryHistory = typeof screeningSalaryHistory.$inferSelect;
type ScreeningDocumentsChecklist = typeof screeningDocumentsChecklist.$inferSelect;
type ScreeningTechnicalSkills = typeof screeningTechnicalSkills.$inferSelect;
type ScreeningCompetencyRatings = typeof screeningCompetencyRatings.$inferSelect;
type ScreeningEquipmentExperience = typeof screeningEquipmentExperience.$inferSelect;
type ScreeningLanguageProficiency = typeof screeningLanguageProficiency.$inferSelect;
type ScreeningPracticalTests = typeof screeningPracticalTests.$inferSelect;
type ScreeningInterviews = typeof screeningInterviews.$inferSelect;
type ScreeningInterviewPanelists = typeof screeningInterviewPanelists.$inferSelect;
type ScreeningInterviewQuestions = typeof screeningInterviewQuestions.$inferSelect;
type ScreeningInterviewNotes = typeof screeningInterviewNotes.$inferSelect;
type ScreeningEmployerReferences = typeof screeningEmployerReferences.$inferSelect;
type ScreeningReferenceResponses = typeof screeningReferenceResponses.$inferSelect;
type ScreeningPersonalReferences = typeof screeningPersonalReferences.$inferSelect;
type ScreeningSeaServiceVerification = typeof screeningSeaServiceVerification.$inferSelect;
type ScreeningBackgroundChecks = typeof screeningBackgroundChecks.$inferSelect;
type ScreeningCriminalRecords = typeof screeningCriminalRecords.$inferSelect;
type ScreeningEmploymentVerification = typeof screeningEmploymentVerification.$inferSelect;
type ScreeningEducationVerification = typeof screeningEducationVerification.$inferSelect;
type ScreeningPsychometricTests = typeof screeningPsychometricTests.$inferSelect;
type ScreeningPsychometricDimensions = typeof screeningPsychometricDimensions.$inferSelect;
type ScreeningBehavioralAssessments = typeof screeningBehavioralAssessments.$inferSelect;
type ScreeningPeme = typeof screeningPeme.$inferSelect;
type ScreeningPemeResults = typeof screeningPemeResults.$inferSelect;
type ScreeningDrugAlcoholTests = typeof screeningDrugAlcoholTests.$inferSelect;
type ScreeningFinalEvaluation = typeof screeningFinalEvaluation.$inferSelect;
type ScreeningEvaluationApprovals = typeof screeningEvaluationApprovals.$inferSelect;

// ============================================================================
// B1: GENERAL SCREENING
// ============================================================================

export const screeningGeneralInfoRepository = {
  async findByCandidate(recCanUuid: string): Promise<ScreeningGeneralInfo | null> {
    const db = getDb();
    const results = await db.select().from(screeningGeneralInfo)
      .where(and(eq(screeningGeneralInfo.recCanUuid, recCanUuid), eq(screeningGeneralInfo.isDeleted, false)));
    return results[0] || null;
  },

  async upsert(recCanUuid: string, data: Partial<Omit<ScreeningGeneralInfo, "id" | "createdAt" | "updatedAt" | "recCanUuid">>): Promise<ScreeningGeneralInfo> {
    const db = getDb();
    const existing = await this.findByCandidate(recCanUuid);
    if (existing) {
      const [updated] = await db.update(screeningGeneralInfo)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(screeningGeneralInfo.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(screeningGeneralInfo)
      .values({ sgiUuid: uuidv4(), recCanUuid, ...data })
      .returning();
    return created;
  },
};

export const screeningAvailabilityRepository = {
  async findByCandidate(recCanUuid: string): Promise<ScreeningAvailability[]> {
    const db = getDb();
    return db.select().from(screeningAvailability)
      .where(and(eq(screeningAvailability.recCanUuid, recCanUuid), eq(screeningAvailability.isDeleted, false)));
  },

  async create(recCanUuid: string, data: Partial<Omit<ScreeningAvailability, "id" | "createdAt" | "updatedAt" | "recCanUuid">>): Promise<ScreeningAvailability> {
    const db = getDb();
    const [created] = await db.insert(screeningAvailability)
      .values({ availUuid: uuidv4(), recCanUuid, ...data })
      .returning();
    return created;
  },

  async update(id: number, data: Partial<Omit<ScreeningAvailability, "id" | "createdAt" | "updatedAt">>): Promise<ScreeningAvailability | null> {
    const db = getDb();
    const [updated] = await db.update(screeningAvailability)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(screeningAvailability.id, id))
      .returning();
    return updated || null;
  },

  async delete(id: number): Promise<ScreeningAvailability | null> {
    const db = getDb();
    const [deleted] = await db.update(screeningAvailability)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(screeningAvailability.id, id))
      .returning();
    return deleted || null;
  },
};

export const screeningSalaryHistoryRepository = {
  async findByCandidate(recCanUuid: string): Promise<ScreeningSalaryHistory[]> {
    const db = getDb();
    return db.select().from(screeningSalaryHistory)
      .where(and(eq(screeningSalaryHistory.recCanUuid, recCanUuid), eq(screeningSalaryHistory.isDeleted, false)));
  },

  async create(recCanUuid: string, data: Partial<Omit<ScreeningSalaryHistory, "id" | "createdAt" | "updatedAt" | "recCanUuid">>): Promise<ScreeningSalaryHistory> {
    const db = getDb();
    const [created] = await db.insert(screeningSalaryHistory)
      .values({ salHistUuid: uuidv4(), recCanUuid, ...data })
      .returning();
    return created;
  },

  async update(id: number, data: Partial<Omit<ScreeningSalaryHistory, "id" | "createdAt" | "updatedAt">>): Promise<ScreeningSalaryHistory | null> {
    const db = getDb();
    const [updated] = await db.update(screeningSalaryHistory)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(screeningSalaryHistory.id, id))
      .returning();
    return updated || null;
  },

  async delete(id: number): Promise<ScreeningSalaryHistory | null> {
    const db = getDb();
    const [deleted] = await db.update(screeningSalaryHistory)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(screeningSalaryHistory.id, id))
      .returning();
    return deleted || null;
  },
};

export const screeningDocumentsChecklistRepository = {
  async findByCandidate(recCanUuid: string): Promise<ScreeningDocumentsChecklist | null> {
    const db = getDb();
    const results = await db.select().from(screeningDocumentsChecklist)
      .where(and(eq(screeningDocumentsChecklist.recCanUuid, recCanUuid), eq(screeningDocumentsChecklist.isDeleted, false)));
    return results[0] || null;
  },

  async upsert(recCanUuid: string, data: Partial<Omit<ScreeningDocumentsChecklist, "id" | "createdAt" | "updatedAt" | "recCanUuid">>): Promise<ScreeningDocumentsChecklist> {
    const db = getDb();
    const existing = await this.findByCandidate(recCanUuid);
    if (existing) {
      const [updated] = await db.update(screeningDocumentsChecklist)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(screeningDocumentsChecklist.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(screeningDocumentsChecklist)
      .values({ docCheckUuid: uuidv4(), recCanUuid, ...data })
      .returning();
    return created;
  },
};

// ============================================================================
// B2: SKILLS ASSESSMENT
// ============================================================================

export const screeningTechnicalSkillsRepository = {
  async findByCandidate(recCanUuid: string): Promise<ScreeningTechnicalSkills[]> {
    const db = getDb();
    return db.select().from(screeningTechnicalSkills)
      .where(and(eq(screeningTechnicalSkills.recCanUuid, recCanUuid), eq(screeningTechnicalSkills.isDeleted, false)));
  },

  async create(recCanUuid: string, data: Partial<Omit<ScreeningTechnicalSkills, "id" | "createdAt" | "updatedAt" | "recCanUuid">>): Promise<ScreeningTechnicalSkills> {
    const db = getDb();
    const [created] = await db.insert(screeningTechnicalSkills)
      .values({ techSkillUuid: uuidv4(), recCanUuid, ...data })
      .returning();
    return created;
  },

  async update(id: number, data: Partial<Omit<ScreeningTechnicalSkills, "id" | "createdAt" | "updatedAt">>): Promise<ScreeningTechnicalSkills | null> {
    const db = getDb();
    const [updated] = await db.update(screeningTechnicalSkills)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(screeningTechnicalSkills.id, id))
      .returning();
    return updated || null;
  },

  async delete(id: number): Promise<ScreeningTechnicalSkills | null> {
    const db = getDb();
    const [deleted] = await db.update(screeningTechnicalSkills)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(screeningTechnicalSkills.id, id))
      .returning();
    return deleted || null;
  },
};

export const screeningCompetencyRatingsRepository = {
  async findByCandidate(recCanUuid: string): Promise<ScreeningCompetencyRatings[]> {
    const db = getDb();
    return db.select().from(screeningCompetencyRatings)
      .where(and(eq(screeningCompetencyRatings.recCanUuid, recCanUuid), eq(screeningCompetencyRatings.isDeleted, false)));
  },

  async create(recCanUuid: string, data: Partial<Omit<ScreeningCompetencyRatings, "id" | "createdAt" | "updatedAt" | "recCanUuid">>): Promise<ScreeningCompetencyRatings> {
    const db = getDb();
    const [created] = await db.insert(screeningCompetencyRatings)
      .values({ compRatingUuid: uuidv4(), recCanUuid, ...data })
      .returning();
    return created;
  },

  async update(id: number, data: Partial<Omit<ScreeningCompetencyRatings, "id" | "createdAt" | "updatedAt">>): Promise<ScreeningCompetencyRatings | null> {
    const db = getDb();
    const [updated] = await db.update(screeningCompetencyRatings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(screeningCompetencyRatings.id, id))
      .returning();
    return updated || null;
  },

  async delete(id: number): Promise<ScreeningCompetencyRatings | null> {
    const db = getDb();
    const [deleted] = await db.update(screeningCompetencyRatings)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(screeningCompetencyRatings.id, id))
      .returning();
    return deleted || null;
  },
};

export const screeningEquipmentExperienceRepository = {
  async findByCandidate(recCanUuid: string): Promise<ScreeningEquipmentExperience[]> {
    const db = getDb();
    return db.select().from(screeningEquipmentExperience)
      .where(and(eq(screeningEquipmentExperience.recCanUuid, recCanUuid), eq(screeningEquipmentExperience.isDeleted, false)));
  },

  async create(recCanUuid: string, data: Partial<Omit<ScreeningEquipmentExperience, "id" | "createdAt" | "updatedAt" | "recCanUuid">>): Promise<ScreeningEquipmentExperience> {
    const db = getDb();
    const [created] = await db.insert(screeningEquipmentExperience)
      .values({ equipExpUuid: uuidv4(), recCanUuid, ...data })
      .returning();
    return created;
  },

  async update(id: number, data: Partial<Omit<ScreeningEquipmentExperience, "id" | "createdAt" | "updatedAt">>): Promise<ScreeningEquipmentExperience | null> {
    const db = getDb();
    const [updated] = await db.update(screeningEquipmentExperience)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(screeningEquipmentExperience.id, id))
      .returning();
    return updated || null;
  },

  async delete(id: number): Promise<ScreeningEquipmentExperience | null> {
    const db = getDb();
    const [deleted] = await db.update(screeningEquipmentExperience)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(screeningEquipmentExperience.id, id))
      .returning();
    return deleted || null;
  },
};

export const screeningLanguageProficiencyRepository = {
  async findByCandidate(recCanUuid: string): Promise<ScreeningLanguageProficiency[]> {
    const db = getDb();
    return db.select().from(screeningLanguageProficiency)
      .where(and(eq(screeningLanguageProficiency.recCanUuid, recCanUuid), eq(screeningLanguageProficiency.isDeleted, false)));
  },

  async create(recCanUuid: string, data: Partial<Omit<ScreeningLanguageProficiency, "id" | "createdAt" | "updatedAt" | "recCanUuid">>): Promise<ScreeningLanguageProficiency> {
    const db = getDb();
    const [created] = await db.insert(screeningLanguageProficiency)
      .values({ langProfUuid: uuidv4(), recCanUuid, ...data })
      .returning();
    return created;
  },

  async update(id: number, data: Partial<Omit<ScreeningLanguageProficiency, "id" | "createdAt" | "updatedAt">>): Promise<ScreeningLanguageProficiency | null> {
    const db = getDb();
    const [updated] = await db.update(screeningLanguageProficiency)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(screeningLanguageProficiency.id, id))
      .returning();
    return updated || null;
  },

  async delete(id: number): Promise<ScreeningLanguageProficiency | null> {
    const db = getDb();
    const [deleted] = await db.update(screeningLanguageProficiency)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(screeningLanguageProficiency.id, id))
      .returning();
    return deleted || null;
  },
};

export const screeningPracticalTestsRepository = {
  async findByCandidate(recCanUuid: string): Promise<ScreeningPracticalTests[]> {
    const db = getDb();
    return db.select().from(screeningPracticalTests)
      .where(and(eq(screeningPracticalTests.recCanUuid, recCanUuid), eq(screeningPracticalTests.isDeleted, false)));
  },

  async create(recCanUuid: string, data: Partial<Omit<ScreeningPracticalTests, "id" | "createdAt" | "updatedAt" | "recCanUuid">>): Promise<ScreeningPracticalTests> {
    const db = getDb();
    const [created] = await db.insert(screeningPracticalTests)
      .values({ practTestUuid: uuidv4(), recCanUuid, ...data })
      .returning();
    return created;
  },

  async update(id: number, data: Partial<Omit<ScreeningPracticalTests, "id" | "createdAt" | "updatedAt">>): Promise<ScreeningPracticalTests | null> {
    const db = getDb();
    const [updated] = await db.update(screeningPracticalTests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(screeningPracticalTests.id, id))
      .returning();
    return updated || null;
  },

  async delete(id: number): Promise<ScreeningPracticalTests | null> {
    const db = getDb();
    const [deleted] = await db.update(screeningPracticalTests)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(screeningPracticalTests.id, id))
      .returning();
    return deleted || null;
  },
};

// ============================================================================
// B3: INTERVIEW ASSESSMENT
// ============================================================================

export const screeningInterviewsRepository = {
  async findByCandidate(recCanUuid: string): Promise<ScreeningInterviews[]> {
    const db = getDb();
    return db.select().from(screeningInterviews)
      .where(and(eq(screeningInterviews.recCanUuid, recCanUuid), eq(screeningInterviews.isDeleted, false)));
  },

  async create(recCanUuid: string, data: Partial<Omit<ScreeningInterviews, "id" | "createdAt" | "updatedAt" | "recCanUuid">>): Promise<ScreeningInterviews> {
    const db = getDb();
    const [created] = await db.insert(screeningInterviews)
      .values({ interviewUuid: uuidv4(), recCanUuid, ...data })
      .returning();
    return created;
  },

  async update(id: number, data: Partial<Omit<ScreeningInterviews, "id" | "createdAt" | "updatedAt">>): Promise<ScreeningInterviews | null> {
    const db = getDb();
    const [updated] = await db.update(screeningInterviews)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(screeningInterviews.id, id))
      .returning();
    return updated || null;
  },

  async delete(id: number): Promise<ScreeningInterviews | null> {
    const db = getDb();
    const [deleted] = await db.update(screeningInterviews)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(screeningInterviews.id, id))
      .returning();
    return deleted || null;
  },
};

export const screeningInterviewPanelistsRepository = {
  async findByCandidate(recCanUuid: string): Promise<ScreeningInterviewPanelists[]> {
    const db = getDb();
    return db.select().from(screeningInterviewPanelists)
      .where(and(eq(screeningInterviewPanelists.recCanUuid, recCanUuid), eq(screeningInterviewPanelists.isDeleted, false)));
  },

  async findByInterview(interviewUuid: string): Promise<ScreeningInterviewPanelists[]> {
    const db = getDb();
    return db.select().from(screeningInterviewPanelists)
      .where(and(eq(screeningInterviewPanelists.interviewUuid, interviewUuid), eq(screeningInterviewPanelists.isDeleted, false)));
  },

  async create(recCanUuid: string, data: Partial<Omit<ScreeningInterviewPanelists, "id" | "createdAt" | "updatedAt" | "recCanUuid">>): Promise<ScreeningInterviewPanelists> {
    const db = getDb();
    const [created] = await db.insert(screeningInterviewPanelists)
      .values({ panelistUuid: uuidv4(), recCanUuid, ...data })
      .returning();
    return created;
  },

  async update(id: number, data: Partial<Omit<ScreeningInterviewPanelists, "id" | "createdAt" | "updatedAt">>): Promise<ScreeningInterviewPanelists | null> {
    const db = getDb();
    const [updated] = await db.update(screeningInterviewPanelists)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(screeningInterviewPanelists.id, id))
      .returning();
    return updated || null;
  },

  async delete(id: number): Promise<ScreeningInterviewPanelists | null> {
    const db = getDb();
    const [deleted] = await db.update(screeningInterviewPanelists)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(screeningInterviewPanelists.id, id))
      .returning();
    return deleted || null;
  },
};

export const screeningInterviewQuestionsRepository = {
  async findByCandidate(recCanUuid: string): Promise<ScreeningInterviewQuestions[]> {
    const db = getDb();
    return db.select().from(screeningInterviewQuestions)
      .where(and(eq(screeningInterviewQuestions.recCanUuid, recCanUuid), eq(screeningInterviewQuestions.isDeleted, false)));
  },

  async findByInterview(interviewUuid: string): Promise<ScreeningInterviewQuestions[]> {
    const db = getDb();
    return db.select().from(screeningInterviewQuestions)
      .where(and(eq(screeningInterviewQuestions.interviewUuid, interviewUuid), eq(screeningInterviewQuestions.isDeleted, false)));
  },

  async create(recCanUuid: string, data: Partial<Omit<ScreeningInterviewQuestions, "id" | "createdAt" | "updatedAt" | "recCanUuid">>): Promise<ScreeningInterviewQuestions> {
    const db = getDb();
    const [created] = await db.insert(screeningInterviewQuestions)
      .values({ intQuestUuid: uuidv4(), recCanUuid, ...data })
      .returning();
    return created;
  },

  async update(id: number, data: Partial<Omit<ScreeningInterviewQuestions, "id" | "createdAt" | "updatedAt">>): Promise<ScreeningInterviewQuestions | null> {
    const db = getDb();
    const [updated] = await db.update(screeningInterviewQuestions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(screeningInterviewQuestions.id, id))
      .returning();
    return updated || null;
  },

  async delete(id: number): Promise<ScreeningInterviewQuestions | null> {
    const db = getDb();
    const [deleted] = await db.update(screeningInterviewQuestions)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(screeningInterviewQuestions.id, id))
      .returning();
    return deleted || null;
  },
};

export const screeningInterviewNotesRepository = {
  async findByCandidate(recCanUuid: string): Promise<ScreeningInterviewNotes[]> {
    const db = getDb();
    return db.select().from(screeningInterviewNotes)
      .where(and(eq(screeningInterviewNotes.recCanUuid, recCanUuid), eq(screeningInterviewNotes.isDeleted, false)));
  },

  async findByInterview(interviewUuid: string): Promise<ScreeningInterviewNotes[]> {
    const db = getDb();
    return db.select().from(screeningInterviewNotes)
      .where(and(eq(screeningInterviewNotes.interviewUuid, interviewUuid), eq(screeningInterviewNotes.isDeleted, false)));
  },

  async create(recCanUuid: string, data: Partial<Omit<ScreeningInterviewNotes, "id" | "createdAt" | "updatedAt" | "recCanUuid">>): Promise<ScreeningInterviewNotes> {
    const db = getDb();
    const [created] = await db.insert(screeningInterviewNotes)
      .values({ intNoteUuid: uuidv4(), recCanUuid, ...data })
      .returning();
    return created;
  },

  async update(id: number, data: Partial<Omit<ScreeningInterviewNotes, "id" | "createdAt" | "updatedAt">>): Promise<ScreeningInterviewNotes | null> {
    const db = getDb();
    const [updated] = await db.update(screeningInterviewNotes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(screeningInterviewNotes.id, id))
      .returning();
    return updated || null;
  },

  async delete(id: number): Promise<ScreeningInterviewNotes | null> {
    const db = getDb();
    const [deleted] = await db.update(screeningInterviewNotes)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(screeningInterviewNotes.id, id))
      .returning();
    return deleted || null;
  },
};

// ============================================================================
// B4: REFERENCE CHECKS
// ============================================================================

export const screeningEmployerReferencesRepository = {
  async findByCandidate(recCanUuid: string): Promise<ScreeningEmployerReferences[]> {
    const db = getDb();
    return db.select().from(screeningEmployerReferences)
      .where(and(eq(screeningEmployerReferences.recCanUuid, recCanUuid), eq(screeningEmployerReferences.isDeleted, false)));
  },

  async create(recCanUuid: string, data: Partial<Omit<ScreeningEmployerReferences, "id" | "createdAt" | "updatedAt" | "recCanUuid">>): Promise<ScreeningEmployerReferences> {
    const db = getDb();
    const [created] = await db.insert(screeningEmployerReferences)
      .values({ empRefUuid: uuidv4(), recCanUuid, ...data })
      .returning();
    return created;
  },

  async update(id: number, data: Partial<Omit<ScreeningEmployerReferences, "id" | "createdAt" | "updatedAt">>): Promise<ScreeningEmployerReferences | null> {
    const db = getDb();
    const [updated] = await db.update(screeningEmployerReferences)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(screeningEmployerReferences.id, id))
      .returning();
    return updated || null;
  },

  async delete(id: number): Promise<ScreeningEmployerReferences | null> {
    const db = getDb();
    const [deleted] = await db.update(screeningEmployerReferences)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(screeningEmployerReferences.id, id))
      .returning();
    return deleted || null;
  },
};

export const screeningReferenceResponsesRepository = {
  async findByCandidate(recCanUuid: string): Promise<ScreeningReferenceResponses[]> {
    const db = getDb();
    return db.select().from(screeningReferenceResponses)
      .where(and(eq(screeningReferenceResponses.recCanUuid, recCanUuid), eq(screeningReferenceResponses.isDeleted, false)));
  },

  async findByReference(empRefUuid: string): Promise<ScreeningReferenceResponses[]> {
    const db = getDb();
    return db.select().from(screeningReferenceResponses)
      .where(and(eq(screeningReferenceResponses.empRefUuid, empRefUuid), eq(screeningReferenceResponses.isDeleted, false)));
  },

  async create(recCanUuid: string, data: Partial<Omit<ScreeningReferenceResponses, "id" | "createdAt" | "updatedAt" | "recCanUuid">>): Promise<ScreeningReferenceResponses> {
    const db = getDb();
    const [created] = await db.insert(screeningReferenceResponses)
      .values({ refRespUuid: uuidv4(), recCanUuid, ...data })
      .returning();
    return created;
  },

  async update(id: number, data: Partial<Omit<ScreeningReferenceResponses, "id" | "createdAt" | "updatedAt">>): Promise<ScreeningReferenceResponses | null> {
    const db = getDb();
    const [updated] = await db.update(screeningReferenceResponses)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(screeningReferenceResponses.id, id))
      .returning();
    return updated || null;
  },

  async delete(id: number): Promise<ScreeningReferenceResponses | null> {
    const db = getDb();
    const [deleted] = await db.update(screeningReferenceResponses)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(screeningReferenceResponses.id, id))
      .returning();
    return deleted || null;
  },
};

export const screeningPersonalReferencesRepository = {
  async findByCandidate(recCanUuid: string): Promise<ScreeningPersonalReferences[]> {
    const db = getDb();
    return db.select().from(screeningPersonalReferences)
      .where(and(eq(screeningPersonalReferences.recCanUuid, recCanUuid), eq(screeningPersonalReferences.isDeleted, false)));
  },

  async create(recCanUuid: string, data: Partial<Omit<ScreeningPersonalReferences, "id" | "createdAt" | "updatedAt" | "recCanUuid">>): Promise<ScreeningPersonalReferences> {
    const db = getDb();
    const [created] = await db.insert(screeningPersonalReferences)
      .values({ persRefUuid: uuidv4(), recCanUuid, ...data })
      .returning();
    return created;
  },

  async update(id: number, data: Partial<Omit<ScreeningPersonalReferences, "id" | "createdAt" | "updatedAt">>): Promise<ScreeningPersonalReferences | null> {
    const db = getDb();
    const [updated] = await db.update(screeningPersonalReferences)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(screeningPersonalReferences.id, id))
      .returning();
    return updated || null;
  },

  async delete(id: number): Promise<ScreeningPersonalReferences | null> {
    const db = getDb();
    const [deleted] = await db.update(screeningPersonalReferences)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(screeningPersonalReferences.id, id))
      .returning();
    return deleted || null;
  },
};

export const screeningSeaServiceVerificationRepository = {
  async findByCandidate(recCanUuid: string): Promise<ScreeningSeaServiceVerification[]> {
    const db = getDb();
    return db.select().from(screeningSeaServiceVerification)
      .where(and(eq(screeningSeaServiceVerification.recCanUuid, recCanUuid), eq(screeningSeaServiceVerification.isDeleted, false)));
  },

  async create(recCanUuid: string, data: Partial<Omit<ScreeningSeaServiceVerification, "id" | "createdAt" | "updatedAt" | "recCanUuid">>): Promise<ScreeningSeaServiceVerification> {
    const db = getDb();
    const [created] = await db.insert(screeningSeaServiceVerification)
      .values({ ssVerifUuid: uuidv4(), recCanUuid, ...data })
      .returning();
    return created;
  },

  async update(id: number, data: Partial<Omit<ScreeningSeaServiceVerification, "id" | "createdAt" | "updatedAt">>): Promise<ScreeningSeaServiceVerification | null> {
    const db = getDb();
    const [updated] = await db.update(screeningSeaServiceVerification)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(screeningSeaServiceVerification.id, id))
      .returning();
    return updated || null;
  },

  async delete(id: number): Promise<ScreeningSeaServiceVerification | null> {
    const db = getDb();
    const [deleted] = await db.update(screeningSeaServiceVerification)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(screeningSeaServiceVerification.id, id))
      .returning();
    return deleted || null;
  },
};

// ============================================================================
// B5: BACKGROUND VERIFICATION
// ============================================================================

export const screeningBackgroundChecksRepository = {
  async findByCandidate(recCanUuid: string): Promise<ScreeningBackgroundChecks | null> {
    const db = getDb();
    const results = await db.select().from(screeningBackgroundChecks)
      .where(and(eq(screeningBackgroundChecks.recCanUuid, recCanUuid), eq(screeningBackgroundChecks.isDeleted, false)));
    return results[0] || null;
  },

  async upsert(recCanUuid: string, data: Partial<Omit<ScreeningBackgroundChecks, "id" | "createdAt" | "updatedAt" | "recCanUuid">>): Promise<ScreeningBackgroundChecks> {
    const db = getDb();
    const existing = await this.findByCandidate(recCanUuid);
    if (existing) {
      const [updated] = await db.update(screeningBackgroundChecks)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(screeningBackgroundChecks.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(screeningBackgroundChecks)
      .values({ bgCheckUuid: uuidv4(), recCanUuid, ...data })
      .returning();
    return created;
  },
};

export const screeningCriminalRecordsRepository = {
  async findByCandidate(recCanUuid: string): Promise<ScreeningCriminalRecords[]> {
    const db = getDb();
    return db.select().from(screeningCriminalRecords)
      .where(and(eq(screeningCriminalRecords.recCanUuid, recCanUuid), eq(screeningCriminalRecords.isDeleted, false)));
  },

  async create(recCanUuid: string, data: Partial<Omit<ScreeningCriminalRecords, "id" | "createdAt" | "updatedAt" | "recCanUuid">>): Promise<ScreeningCriminalRecords> {
    const db = getDb();
    const [created] = await db.insert(screeningCriminalRecords)
      .values({ crimRecUuid: uuidv4(), recCanUuid, ...data })
      .returning();
    return created;
  },

  async update(id: number, data: Partial<Omit<ScreeningCriminalRecords, "id" | "createdAt" | "updatedAt">>): Promise<ScreeningCriminalRecords | null> {
    const db = getDb();
    const [updated] = await db.update(screeningCriminalRecords)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(screeningCriminalRecords.id, id))
      .returning();
    return updated || null;
  },

  async delete(id: number): Promise<ScreeningCriminalRecords | null> {
    const db = getDb();
    const [deleted] = await db.update(screeningCriminalRecords)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(screeningCriminalRecords.id, id))
      .returning();
    return deleted || null;
  },
};

export const screeningEmploymentVerificationRepository = {
  async findByCandidate(recCanUuid: string): Promise<ScreeningEmploymentVerification[]> {
    const db = getDb();
    return db.select().from(screeningEmploymentVerification)
      .where(and(eq(screeningEmploymentVerification.recCanUuid, recCanUuid), eq(screeningEmploymentVerification.isDeleted, false)));
  },

  async create(recCanUuid: string, data: Partial<Omit<ScreeningEmploymentVerification, "id" | "createdAt" | "updatedAt" | "recCanUuid">>): Promise<ScreeningEmploymentVerification> {
    const db = getDb();
    const [created] = await db.insert(screeningEmploymentVerification)
      .values({ empVerifUuid: uuidv4(), recCanUuid, ...data })
      .returning();
    return created;
  },

  async update(id: number, data: Partial<Omit<ScreeningEmploymentVerification, "id" | "createdAt" | "updatedAt">>): Promise<ScreeningEmploymentVerification | null> {
    const db = getDb();
    const [updated] = await db.update(screeningEmploymentVerification)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(screeningEmploymentVerification.id, id))
      .returning();
    return updated || null;
  },

  async delete(id: number): Promise<ScreeningEmploymentVerification | null> {
    const db = getDb();
    const [deleted] = await db.update(screeningEmploymentVerification)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(screeningEmploymentVerification.id, id))
      .returning();
    return deleted || null;
  },
};

export const screeningEducationVerificationRepository = {
  async findByCandidate(recCanUuid: string): Promise<ScreeningEducationVerification[]> {
    const db = getDb();
    return db.select().from(screeningEducationVerification)
      .where(and(eq(screeningEducationVerification.recCanUuid, recCanUuid), eq(screeningEducationVerification.isDeleted, false)));
  },

  async create(recCanUuid: string, data: Partial<Omit<ScreeningEducationVerification, "id" | "createdAt" | "updatedAt" | "recCanUuid">>): Promise<ScreeningEducationVerification> {
    const db = getDb();
    const [created] = await db.insert(screeningEducationVerification)
      .values({ eduVerifUuid: uuidv4(), recCanUuid, ...data })
      .returning();
    return created;
  },

  async update(id: number, data: Partial<Omit<ScreeningEducationVerification, "id" | "createdAt" | "updatedAt">>): Promise<ScreeningEducationVerification | null> {
    const db = getDb();
    const [updated] = await db.update(screeningEducationVerification)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(screeningEducationVerification.id, id))
      .returning();
    return updated || null;
  },

  async delete(id: number): Promise<ScreeningEducationVerification | null> {
    const db = getDb();
    const [deleted] = await db.update(screeningEducationVerification)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(screeningEducationVerification.id, id))
      .returning();
    return deleted || null;
  },
};

// ============================================================================
// B6: PSYCHOLOGICAL ASSESSMENT
// ============================================================================

export const screeningPsychometricTestsRepository = {
  async findByCandidate(recCanUuid: string): Promise<ScreeningPsychometricTests[]> {
    const db = getDb();
    return db.select().from(screeningPsychometricTests)
      .where(and(eq(screeningPsychometricTests.recCanUuid, recCanUuid), eq(screeningPsychometricTests.isDeleted, false)));
  },

  async create(recCanUuid: string, data: Partial<Omit<ScreeningPsychometricTests, "id" | "createdAt" | "updatedAt" | "recCanUuid">>): Promise<ScreeningPsychometricTests> {
    const db = getDb();
    const [created] = await db.insert(screeningPsychometricTests)
      .values({ psychTestUuid: uuidv4(), recCanUuid, ...data })
      .returning();
    return created;
  },

  async update(id: number, data: Partial<Omit<ScreeningPsychometricTests, "id" | "createdAt" | "updatedAt">>): Promise<ScreeningPsychometricTests | null> {
    const db = getDb();
    const [updated] = await db.update(screeningPsychometricTests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(screeningPsychometricTests.id, id))
      .returning();
    return updated || null;
  },

  async delete(id: number): Promise<ScreeningPsychometricTests | null> {
    const db = getDb();
    const [deleted] = await db.update(screeningPsychometricTests)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(screeningPsychometricTests.id, id))
      .returning();
    return deleted || null;
  },
};

export const screeningPsychometricDimensionsRepository = {
  async findByCandidate(recCanUuid: string): Promise<ScreeningPsychometricDimensions[]> {
    const db = getDb();
    return db.select().from(screeningPsychometricDimensions)
      .where(and(eq(screeningPsychometricDimensions.recCanUuid, recCanUuid), eq(screeningPsychometricDimensions.isDeleted, false)));
  },

  async findByTest(psychTestUuid: string): Promise<ScreeningPsychometricDimensions[]> {
    const db = getDb();
    return db.select().from(screeningPsychometricDimensions)
      .where(and(eq(screeningPsychometricDimensions.psychTestUuid, psychTestUuid), eq(screeningPsychometricDimensions.isDeleted, false)));
  },

  async create(recCanUuid: string, data: Partial<Omit<ScreeningPsychometricDimensions, "id" | "createdAt" | "updatedAt" | "recCanUuid">>): Promise<ScreeningPsychometricDimensions> {
    const db = getDb();
    const [created] = await db.insert(screeningPsychometricDimensions)
      .values({ psychDimUuid: uuidv4(), recCanUuid, ...data })
      .returning();
    return created;
  },

  async update(id: number, data: Partial<Omit<ScreeningPsychometricDimensions, "id" | "createdAt" | "updatedAt">>): Promise<ScreeningPsychometricDimensions | null> {
    const db = getDb();
    const [updated] = await db.update(screeningPsychometricDimensions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(screeningPsychometricDimensions.id, id))
      .returning();
    return updated || null;
  },

  async delete(id: number): Promise<ScreeningPsychometricDimensions | null> {
    const db = getDb();
    const [deleted] = await db.update(screeningPsychometricDimensions)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(screeningPsychometricDimensions.id, id))
      .returning();
    return deleted || null;
  },
};

export const screeningBehavioralAssessmentsRepository = {
  async findByCandidate(recCanUuid: string): Promise<ScreeningBehavioralAssessments[]> {
    const db = getDb();
    return db.select().from(screeningBehavioralAssessments)
      .where(and(eq(screeningBehavioralAssessments.recCanUuid, recCanUuid), eq(screeningBehavioralAssessments.isDeleted, false)));
  },

  async create(recCanUuid: string, data: Partial<Omit<ScreeningBehavioralAssessments, "id" | "createdAt" | "updatedAt" | "recCanUuid">>): Promise<ScreeningBehavioralAssessments> {
    const db = getDb();
    const [created] = await db.insert(screeningBehavioralAssessments)
      .values({ behAssessUuid: uuidv4(), recCanUuid, ...data })
      .returning();
    return created;
  },

  async update(id: number, data: Partial<Omit<ScreeningBehavioralAssessments, "id" | "createdAt" | "updatedAt">>): Promise<ScreeningBehavioralAssessments | null> {
    const db = getDb();
    const [updated] = await db.update(screeningBehavioralAssessments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(screeningBehavioralAssessments.id, id))
      .returning();
    return updated || null;
  },

  async delete(id: number): Promise<ScreeningBehavioralAssessments | null> {
    const db = getDb();
    const [deleted] = await db.update(screeningBehavioralAssessments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(screeningBehavioralAssessments.id, id))
      .returning();
    return deleted || null;
  },
};

// ============================================================================
// B7: MEDICAL SCREENING
// ============================================================================

export const screeningPemeRepository = {
  async findByCandidate(recCanUuid: string): Promise<ScreeningPeme[]> {
    const db = getDb();
    return db.select().from(screeningPeme)
      .where(and(eq(screeningPeme.recCanUuid, recCanUuid), eq(screeningPeme.isDeleted, false)));
  },

  async create(recCanUuid: string, data: Partial<Omit<ScreeningPeme, "id" | "createdAt" | "updatedAt" | "recCanUuid">>): Promise<ScreeningPeme> {
    const db = getDb();
    const [created] = await db.insert(screeningPeme)
      .values({ pemeUuid: uuidv4(), recCanUuid, ...data })
      .returning();
    return created;
  },

  async update(id: number, data: Partial<Omit<ScreeningPeme, "id" | "createdAt" | "updatedAt">>): Promise<ScreeningPeme | null> {
    const db = getDb();
    const [updated] = await db.update(screeningPeme)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(screeningPeme.id, id))
      .returning();
    return updated || null;
  },

  async delete(id: number): Promise<ScreeningPeme | null> {
    const db = getDb();
    const [deleted] = await db.update(screeningPeme)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(screeningPeme.id, id))
      .returning();
    return deleted || null;
  },
};

export const screeningPemeResultsRepository = {
  async findByCandidate(recCanUuid: string): Promise<ScreeningPemeResults[]> {
    const db = getDb();
    return db.select().from(screeningPemeResults)
      .where(and(eq(screeningPemeResults.recCanUuid, recCanUuid), eq(screeningPemeResults.isDeleted, false)));
  },

  async findByPeme(pemeUuid: string): Promise<ScreeningPemeResults[]> {
    const db = getDb();
    return db.select().from(screeningPemeResults)
      .where(and(eq(screeningPemeResults.pemeUuid, pemeUuid), eq(screeningPemeResults.isDeleted, false)));
  },

  async create(recCanUuid: string, data: Partial<Omit<ScreeningPemeResults, "id" | "createdAt" | "updatedAt" | "recCanUuid">>): Promise<ScreeningPemeResults> {
    const db = getDb();
    const [created] = await db.insert(screeningPemeResults)
      .values({ pemeResultUuid: uuidv4(), recCanUuid, ...data })
      .returning();
    return created;
  },

  async update(id: number, data: Partial<Omit<ScreeningPemeResults, "id" | "createdAt" | "updatedAt">>): Promise<ScreeningPemeResults | null> {
    const db = getDb();
    const [updated] = await db.update(screeningPemeResults)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(screeningPemeResults.id, id))
      .returning();
    return updated || null;
  },

  async delete(id: number): Promise<ScreeningPemeResults | null> {
    const db = getDb();
    const [deleted] = await db.update(screeningPemeResults)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(screeningPemeResults.id, id))
      .returning();
    return deleted || null;
  },
};

export const screeningDrugAlcoholTestsRepository = {
  async findByCandidate(recCanUuid: string): Promise<ScreeningDrugAlcoholTests[]> {
    const db = getDb();
    return db.select().from(screeningDrugAlcoholTests)
      .where(and(eq(screeningDrugAlcoholTests.recCanUuid, recCanUuid), eq(screeningDrugAlcoholTests.isDeleted, false)));
  },

  async create(recCanUuid: string, data: Partial<Omit<ScreeningDrugAlcoholTests, "id" | "createdAt" | "updatedAt" | "recCanUuid">>): Promise<ScreeningDrugAlcoholTests> {
    const db = getDb();
    const [created] = await db.insert(screeningDrugAlcoholTests)
      .values({ daTestUuid: uuidv4(), recCanUuid, ...data })
      .returning();
    return created;
  },

  async update(id: number, data: Partial<Omit<ScreeningDrugAlcoholTests, "id" | "createdAt" | "updatedAt">>): Promise<ScreeningDrugAlcoholTests | null> {
    const db = getDb();
    const [updated] = await db.update(screeningDrugAlcoholTests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(screeningDrugAlcoholTests.id, id))
      .returning();
    return updated || null;
  },

  async delete(id: number): Promise<ScreeningDrugAlcoholTests | null> {
    const db = getDb();
    const [deleted] = await db.update(screeningDrugAlcoholTests)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(screeningDrugAlcoholTests.id, id))
      .returning();
    return deleted || null;
  },
};

// ============================================================================
// B8: FINAL EVALUATION
// ============================================================================

export const screeningFinalEvaluationRepository = {
  async findByCandidate(recCanUuid: string): Promise<ScreeningFinalEvaluation | null> {
    const db = getDb();
    const results = await db.select().from(screeningFinalEvaluation)
      .where(and(eq(screeningFinalEvaluation.recCanUuid, recCanUuid), eq(screeningFinalEvaluation.isDeleted, false)));
    return results[0] || null;
  },

  async upsert(recCanUuid: string, data: Partial<Omit<ScreeningFinalEvaluation, "id" | "createdAt" | "updatedAt" | "recCanUuid">>): Promise<ScreeningFinalEvaluation> {
    const db = getDb();
    const existing = await this.findByCandidate(recCanUuid);
    if (existing) {
      const [updated] = await db.update(screeningFinalEvaluation)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(screeningFinalEvaluation.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(screeningFinalEvaluation)
      .values({ finalEvalUuid: uuidv4(), recCanUuid, ...data })
      .returning();
    return created;
  },
};

export const screeningEvaluationApprovalsRepository = {
  async findByCandidate(recCanUuid: string): Promise<ScreeningEvaluationApprovals[]> {
    const db = getDb();
    return db.select().from(screeningEvaluationApprovals)
      .where(and(eq(screeningEvaluationApprovals.recCanUuid, recCanUuid), eq(screeningEvaluationApprovals.isDeleted, false)));
  },

  async findByEvaluation(finalEvalUuid: string): Promise<ScreeningEvaluationApprovals[]> {
    const db = getDb();
    return db.select().from(screeningEvaluationApprovals)
      .where(and(eq(screeningEvaluationApprovals.finalEvalUuid, finalEvalUuid), eq(screeningEvaluationApprovals.isDeleted, false)));
  },

  async create(recCanUuid: string, data: Partial<Omit<ScreeningEvaluationApprovals, "id" | "createdAt" | "updatedAt" | "recCanUuid">>): Promise<ScreeningEvaluationApprovals> {
    const db = getDb();
    const [created] = await db.insert(screeningEvaluationApprovals)
      .values({ evalApprovalUuid: uuidv4(), recCanUuid, ...data })
      .returning();
    return created;
  },

  async update(id: number, data: Partial<Omit<ScreeningEvaluationApprovals, "id" | "createdAt" | "updatedAt">>): Promise<ScreeningEvaluationApprovals | null> {
    const db = getDb();
    const [updated] = await db.update(screeningEvaluationApprovals)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(screeningEvaluationApprovals.id, id))
      .returning();
    return updated || null;
  },

  async delete(id: number): Promise<ScreeningEvaluationApprovals | null> {
    const db = getDb();
    const [deleted] = await db.update(screeningEvaluationApprovals)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(screeningEvaluationApprovals.id, id))
      .returning();
    return deleted || null;
  },
};
