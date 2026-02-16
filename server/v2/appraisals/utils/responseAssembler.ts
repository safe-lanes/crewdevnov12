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
      training: t.training,
      evaluation: t.evaluation,
      comment: t.comment,
    })),
    targets: targets.map((t, i) => ({
      id: String(i + 1),
      targetSetting: t.targetSetting,
      evaluation: t.evaluation,
      comment: t.comment,
    })),
    competenceAssessments: competenceAssessments.map((ca, i) => ({
      id: String(i + 1),
      assessmentCriteria: ca.assessmentCriteria,
      weight: ca.weight,
      effectiveness: ca.effectiveness,
      comment: ca.comment,
    })),
    behaviouralAssessments: behaviouralAssessments.map((ba, i) => ({
      id: String(i + 1),
      assessmentCriteria: ba.assessmentCriteria,
      weight: ba.weight,
      effectiveness: ba.effectiveness,
      comment: ba.comment,
    })),
    trainingNeeds: trainingNeeds.map((tn, i) => ({
      id: String(i + 1),
      training: tn.training,
      comment: tn.comment,
    })),
    recommendations: recommendations.map((r, i) => ({
      id: String(i + 1),
      question: r.question,
      answer: r.answer,
      comment: r.comment,
    })),
    appraiserComments: appraiserComments.map((ac, i) => ({
      id: String(i + 1),
      name: ac.name,
      rank: ac.rank,
      comment: ac.comment,
    })),
    seafarerComments: seafarerComments.map((sc, i) => ({
      id: String(i + 1),
      name: sc.name,
      rank: sc.rank,
      comment: sc.comment,
    })),
    officeReviews: officeReviews.map((or, i) => ({
      id: String(i + 1),
      name: or.name,
      position: or.position,
      feedback: or.feedback,
    })),
    trainingFollowups: trainingFollowups.map((tf, i) => ({
      id: String(i + 1),
      training: tf.training,
      correspondingInDB: tf.correspondingInDb,
      category: tf.category,
      status: tf.status,
      targetDate: tf.targetDate,
      comment: tf.comment,
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
    crewMemberId: appraisal.crewMemberId,
    formId: appraisal.formIdLegacy ?? (parseInt(appraisal.formUuid || "") || 1),
    appraisalType: appraisal.appraisalType,
    appraisalDate: appraisal.appraisalDate,
    appraisalData: JSON.stringify(appraisalDataObj),
    competenceRating: appraisal.competenceRating,
    behavioralRating: appraisal.behavioralRating,
    overallRating: appraisal.overallRating,
    submittedAt: appraisal.submittedAt,
    submittedBy: appraisal.submittedBy,
    status: appraisal.status,
    stageStatuses: JSON.stringify(stageStatuses),
    stagePayloads: JSON.stringify(stagePayloads),
  };
}
