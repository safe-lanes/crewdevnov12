import { registerReport } from "../registry";
import { activeCrewReport } from "./activeCrew";
import { crewByRankReport } from "./crewByRank";
import { crewByNationalityReport } from "./crewByNationality";

let registered = false;

export function registerAllReports(): void {
  if (registered) return;
  registerReport(activeCrewReport);
  registerReport(crewByRankReport);
  registerReport(crewByNationalityReport);
  registered = true;
}
