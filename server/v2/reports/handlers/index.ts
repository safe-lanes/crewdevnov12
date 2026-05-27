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
  rotationPlannedReliefsReport,
} from "./rotation";
import {
  restHourViolationsReport,
  restHourComplianceReport,
} from "./restHours";
import { certsExpiringReport } from "./training";
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
  registerReport(rotationPlannedReliefsReport);

  // Rest Hours
  registerReport(restHourViolationsReport);
  registerReport(restHourComplianceReport);

  // Training
  registerReport(certsExpiringReport);

  // Vessel
  registerReport(crewOnBoardReport);
  registerReport(vesselManningStatusReport);
  registerReport(vesselVacanciesReport);
  registerReport(vesselCrewChangesReport);
  registerReport(vesselComplianceSummaryReport);

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
