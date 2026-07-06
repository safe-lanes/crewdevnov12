import type { AppraisalResultV2 } from "../../../../shared/v2/appraisals/types";
import type { ApprTrainingV2 } from "../../../../shared/v2/appraisals/types";
import type { ApprTargetV2 } from "../../../../shared/v2/appraisals/types";
import type { ApprCompetenceAssessmentV2 } from "../../../../shared/v2/appraisals/types";
import type { ApprBehaviouralAssessmentV2 } from "../../../../shared/v2/appraisals/types";
import type { ApprTrainingNeedV2 } from "../../../../shared/v2/appraisals/types";
import type { ApprRecommendationV2 } from "../../../../shared/v2/appraisals/types";
import type { ApprAppraiserCommentV2 } from "../../../../shared/v2/appraisals/types";
import type { ApprSeafarerCommentV2 } from "../../../../shared/v2/appraisals/types";
import type { ApprOfficeReviewV2 } from "../../../../shared/v2/appraisals/types";
import type { ApprTrainingFollowupV2 } from "../../../../shared/v2/appraisals/types";

const s = (v: string | null | undefined): string => v ?? "";

export function assembleV1Response(
  appraisal: AppraisalResultV2,
  trainings: ApprTrainingV2[],
  targets: ApprTargetV2[],
  competenceAssessments: ApprCompetenceAssessmentV2[],
  behaviouralAssessments: ApprBehaviouralAssessmentV2[],
  trainingNeeds: ApprTrainingNeedV2[],
  recommendations: ApprRecommendationV2[],
  appraiserComments: ApprAppraiserCommentV2[],
  seafarerComments: ApprSeafarerCommentV2[],
  officeReviews: ApprOfficeReviewV2[],
  trainingFollowups: ApprTrainingFollowupV2[],
) {
  const appraisalDataObj: Record<string, any> = {
    seafarersName: appraisal.seafarersName,
    seafarersRank: appraisal.seafarersRank,
    nationality: appraisal.nationality,
    vessel: appraisal.vessel,
    signOn: appraisal.signOn,
    appraisalType: appraisal.appraisalType,
    appraisalPeriodFrom: appraisal.appraisalPeriodFrom,
    appraisalPeriodTo: appraisal.appraisalPeriodTo,
    personalityIndexCategory: appraisal.personalityIndexCategory,
    primaryAppraiser: appraisal.primaryAppraiser,
    trainings: trainings.map((t, i) => ({
      id: String(i + 1),
      training: s(t.training),
      evaluation: s(t.evaluation),
      comment: s(t.comment),
      source: (t as any).source || "manual",
    })),
    targets: targets.map((t, i) => ({
      id: String(i + 1),
      targetSetting: s(t.targetSetting),
      evaluation: s(t.evaluation),
      comment: s(t.comment),
    })),
    competenceAssessments: competenceAssessments.map((ca, i) => ({
      id: String(i + 1),
      assessmentCriteria: s(ca.assessmentCriteria),
      weight: ca.weight,
      effectiveness: s(ca.effectiveness),
      comment: s(ca.comment),
    })),
    behaviouralAssessments: behaviouralAssessments.map((ba, i) => ({
      id: String(i + 1),
      assessmentCriteria: s(ba.assessmentCriteria),
      weight: ba.weight,
      effectiveness: s(ba.effectiveness),
      comment: s(ba.comment),
    })),
    trainingNeeds: trainingNeeds.map((tn, i) => ({
      id: String(i + 1),
      training: s(tn.training),
      correspondingInDB: s(tn.correspondingInDb),
      identifiedByUuid: s((tn as any).identifiedByUuid),
      comment: s(tn.comment),
      addedFromDB: (tn as { source?: string }).source === "db",
    })),
    recommendations: recommendations.map((r, i) => ({
      id: String(i + 1),
      question: s(r.question),
      answer: s(r.answer),
      comment: s(r.comment),
    })),
    appraiserComments: appraiserComments.map((ac, i) => ({
      id: String(i + 1),
      name: s(ac.name),
      rank: s(ac.rank),
      comment: s(ac.comment),
    })),
    seafarerComments: seafarerComments.map((sc, i) => ({
      id: String(i + 1),
      name: s(sc.name),
      rank: s(sc.rank),
      comment: s(sc.comment),
    })),
    officeReviews: officeReviews.map((or, i) => ({
      id: String(i + 1),
      name: s(or.name),
      position: s(or.position),
      feedback: s(or.feedback),
    })),
    trainingFollowups: trainingFollowups.map((tf, i) => ({
      id: String(i + 1),
      training: s(tf.training),
      correspondingInDB: s(tf.correspondingInDb),
      identifiedByUuid: s((tf as any).identifiedByUuid),
      category: s(tf.category),
      status: s(tf.status),
      targetDate: s(tf.targetDate),
      comment: s(tf.comment),
    })),
  };

  const stageStatuses: Record<string, any> = {};
  if (appraisal.stage1Status) {
    stageStatuses.stage1 = {
      status: appraisal.stage1Status,
      submittedAt: appraisal.stage1SubmittedAt,
      submittedBy: appraisal.stage1SubmittedBy,
    };
  }
  if (appraisal.stage2Status) {
    stageStatuses.stage2 = {
      status: appraisal.stage2Status,
      submittedAt: appraisal.stage2SubmittedAt,
      submittedBy: appraisal.stage2SubmittedBy,
    };
  }
  if (appraisal.stage3Status) {
    stageStatuses.stage3 = {
      status: appraisal.stage3Status,
      submittedAt: appraisal.stage3SubmittedAt,
      submittedBy: appraisal.stage3SubmittedBy,
    };
  }

  const stagePayloads: Record<string, any> = {};
  if (appraisal.stage1Status) {
    stagePayloads.stage1 = {
      seafarersName: appraisal.seafarersName,
      seafarersRank: appraisal.seafarersRank,
      nationality: appraisal.nationality,
      vessel: appraisal.vessel,
      signOn: appraisal.signOn,
      appraisalType: appraisal.appraisalType,
      appraisalPeriodFrom: appraisal.appraisalPeriodFrom,
      appraisalPeriodTo: appraisal.appraisalPeriodTo,
      personalityIndexCategory: appraisal.personalityIndexCategory,
      primaryAppraiser: appraisal.primaryAppraiser,
      trainings: appraisalDataObj.trainings,
      targets: appraisalDataObj.targets,
    };
  }
  if (appraisal.stage2Status) {
    stagePayloads.stage2 = {
      competenceAssessments: appraisalDataObj.competenceAssessments,
      behaviouralAssessments: appraisalDataObj.behaviouralAssessments,
      trainingNeeds: appraisalDataObj.trainingNeeds,
      recommendations: appraisalDataObj.recommendations,
      appraiserComments: appraisalDataObj.appraiserComments,
      seafarerComments: appraisalDataObj.seafarerComments,
    };
  }
  if (appraisal.stage3Status) {
    stagePayloads.stage3 = {
      officeReviews: appraisalDataObj.officeReviews,
      trainingFollowups: appraisalDataObj.trainingFollowups,
    };
  }

  return {
    id: appraisal.id,
    appraisalUuid: appraisal.appraisalUuid,
    crewMemberId: appraisal.crewMemberId,
    formId: appraisal.formIdLegacy ?? (parseInt(appraisal.formUuid || "") || 1),
    formVersionId: appraisal.formVersionId ?? null,
    formVersionUuid: appraisal.formVersionUuid ?? null,
    appraisalType: appraisal.appraisalType,
    appraisalDate: appraisal.appraisalDate,
    appraisalData: JSON.stringify(appraisalDataObj),
    competenceRating: appraisal.competenceRating,
    behavioralRating: appraisal.behavioralRating,
    overallRating: appraisal.overallRating,
    submittedAt: appraisal.submittedAt,
    submittedBy: appraisal.submittedBy,
    status: appraisal.status,
    isLockForm: (appraisal as any).isLockForm ?? false,
    stageStatuses: JSON.stringify(stageStatuses),
    stagePayloads: JSON.stringify(stagePayloads),
  };
}
