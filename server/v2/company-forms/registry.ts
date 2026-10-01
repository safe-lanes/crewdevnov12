import { CompanyFormSubjectRegistry } from "./subjectRegistry";
import { createCrewAssignmentSubject } from "./subjects/crewAssignmentSubject";

/** Production registry contains only subjects with explicit server adapters. */
export const companyFormSubjectRegistry = new CompanyFormSubjectRegistry([
  createCrewAssignmentSubject(),
]);