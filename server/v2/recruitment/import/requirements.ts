// Shared by validation and presentation: markers must never invent requirements.
export const ROW_REQUIRED: Record<string, readonly string[]> = {
  candidate: ["firstName"], documents: ["documentName"], visas: ["countryUuid", "visaType"],
  education: ["qualifications"], licenses: ["certificateDocument"], training: ["trainingCourse"],
  sea: ["vesselName", "vesselTypeUuid", "rank", "fromDate", "toDate"],
  vesselTypes: ["vesselTypeUuid"],
};
export const SPOUSE_REQUIRED = ["spouseFirstName", "spouseFamilyName"] as const;
export function isRequiredLabel(entity: string, key: string, legacy = false, historical = false): boolean {
  if (entity === "family") return legacy && ["spouseFirstName", "spouseFamilyName"].includes(key);
  // Old downloaded headings remain valid, even though validation now follows the application.
  if (historical && entity === "children") return key === "firstName";
  if (historical && entity === "additional") return key === "information";
  if (entity === "vesselTypes" && !legacy) return false;
  return (ROW_REQUIRED[entity] || []).includes(key);
}
