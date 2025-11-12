// @ts-nocheck - This file contains test seed data with intentional type mismatches for development purposes.
// Not used in production - PersistentFileStorage is used instead.

import type { IStorage } from './storage';
import type {
  User, InsertUser,
  Form, InsertForm,
  RankGroup, InsertRankGroup,
  AvailableRank, InsertAvailableRank,
  CompanyRank, InsertCompanyRank,
  PromotionHierarchy, InsertPromotionHierarchy,
  CrewMember, InsertCrewMember,
  AppraisalResult, InsertAppraisalResult,
  RecruitmentCandidate, InsertRecruitmentCandidate,
  VesselGroup, InsertVesselGroup,
  VesselDraft, InsertVesselDraft,
  VesselRevision, InsertVesselRevision,
  VesselPlanning, InsertVesselPlanning,
  RotationPlan, InsertRotationPlan,
  DrugAlcoholTestRecord, InsertDrugAlcoholTestRecord,
  RestHoursVesselRecord, InsertRestHoursVesselRecord,
  RestHoursCrewRecord, InsertRestHoursCrewRecord,
  RestHoursDailyRecord, InsertRestHoursDailyRecord,
  FixedTask, InsertFixedTask,
  VariableTask, InsertVariableTask,
  VesselViolationComment, InsertVesselViolationComment,
  OfficeViolationComment, InsertOfficeViolationComment,
  NCReport, InsertNCReport,
  VesselDateLineAdjustment, InsertVesselDateLineAdjustment
} from '@shared/schema';

export { MemStorage };
