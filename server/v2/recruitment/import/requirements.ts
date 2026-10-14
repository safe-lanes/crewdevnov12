// Shared by validation and presentation: markers must never invent requirements.
export const ROW_REQUIRED: Record<string, readonly string[]> = {
  candidate: ["firstName"], documents: ["documentName"], visas: ["countryUuid", "visaType"],
  education: ["qualifications"], licenses: ["certificateDocument"], training: ["trainingCourse"],
  sea: ["vesselName", "vesselTypeUuid", "rank", "fromDate", "toDate"],
  children: ["firstName"], vesselTypes: ["vesselTypeUuid"], additional: ["information"],
};
export const MARRIED_REQUIRED = ["spouseFirstName", "spouseFamilyName"] as const;
export function isRequiredLabel(entity: string, key: string): boolean {
  return (ROW_REQUIRED[entity] || []).includes(key)
    || (entity === "family" && (MARRIED_REQUIRED as readonly string[]).includes(key));
}
