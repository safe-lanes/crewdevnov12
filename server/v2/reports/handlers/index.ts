import { registerReport } from "../registry";
import { activeCrewReport } from "./activeCrew";
import { crewByRankReport } from "./crewByRank";
import { crewByNationalityReport } from "./crewByNationality";
import {
  crewOnLeaveReport,
  crewAvailableToJoinReport,
  crewTerminatedReport,
  crewNotForRehireReport,
  crewContactDetailsReport,
  crewContractExpiryReport,
} from "./crewPool";
import {
  rotationOverdueReliefReport,
  rotationPlannedSignOnsReport,
  rotationPlannedReliefsReport,
} from "./rotation";
import {
  restHourViolationsReport,
  restHourComplianceReport,
} from "./restHours";
import { certsExpiringReport, trainingExpiringReport } from "./training";
import { daViolationsReport } from "./drugAlcohol";
import {
  crewOnBoardReport,
  vesselManningStatusReport,
  vesselVacanciesReport,
  vesselCrewChangesReport,
  vesselComplianceSummaryReport,
} from "./vessel";
import {
  apprPendingReport,
  apprScoresSummaryReport,
} from "./appraisals";
import { promoExecutedReport } from "./promotions";
import {
  recRecruitedReport,
  recWaitlistReport,
  recRejectedReport,
  recOffersIssuedReport,
  recJoiningStatusReport,
  recApplicationsBySourceReport,
  recMedicalPendingReport,
  recDocumentPendingReport,
} from "./recruitment";

let registered = false;

export function registerAllReports(): void {
  if (registered) return;

  // Pilot reports (Task #22)
  registerReport(activeCrewReport);
  registerReport(crewByRankReport);
  registerReport(crewByNationalityReport);

  // Crew Pool
  registerReport(crewOnLeaveReport);
  registerReport(crewAvailableToJoinReport);
  registerReport(crewTerminatedReport);
  registerReport(crewNotForRehireReport);
  registerReport(crewContactDetailsReport);
  registerReport(crewContractExpiryReport);

  // Rotation
  registerReport(rotationOverdueReliefReport);
  registerReport(rotationPlannedSignOnsReport);
  registerReport(rotationPlannedReliefsReport);

  // Rest Hours
  registerReport(restHourViolationsReport);
  registerReport(restHourComplianceReport);

  // Training
  registerReport(certsExpiringReport);
  registerReport(trainingExpiringReport);

  // Drug & Alcohol
  registerReport(daViolationsReport);

  // Vessel
  registerReport(crewOnBoardReport);
  registerReport(vesselManningStatusReport);
  registerReport(vesselVacanciesReport);
  registerReport(vesselCrewChangesReport);
  registerReport(vesselComplianceSummaryReport);

  // Promotion
  registerReport(promoExecutedReport);

  // Appraisals
  registerReport(apprPendingReport);
  registerReport(apprScoresSummaryReport);

  // Recruitment
  registerReport(recRecruitedReport);
  registerReport(recWaitlistReport);
  registerReport(recRejectedReport);
  registerReport(recOffersIssuedReport);
  registerReport(recJoiningStatusReport);
  registerReport(recApplicationsBySourceReport);
  registerReport(recMedicalPendingReport);
  registerReport(recDocumentPendingReport);

  registered = true;
}
