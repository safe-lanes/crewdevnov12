// Shared by validation and presentation: markers must never invent requirements.
export const ROW_REQUIRED: Record<string, readonly string[]> = {
  candidate: ["firstName"], documents: ["documentName"], visas: ["countryUuid", "visaType"],
  education: ["qualifications"], licenses: ["certificateDocument"], training: ["trainingCourse"],
  sea: ["vesselName", "vesselTypeUuid", "rank", "fromDate", "toDate"],
  children: ["firstName"], vesselTypes: ["vesselTypeUuid"], additional: ["information"],
};
export function isRequiredLabel(entity: string, key: string, legacy = false): boolean {
  if (entity === "family") return legacy && ["spouseFirstName", "spouseFamilyName"].includes(key);
  if (entity === "vesselTypes" && !legacy) return false;
  return (ROW_REQUIRED[entity] || []).includes(key);
}
