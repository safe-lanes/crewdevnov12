export const commandClassifications = [
  "SAFE_WITH_RECONCILIATION",
  "MANUAL_RECONCILIATION_REQUIRED",
  "BLOCKED",
] as const;
export type CommandClassification = typeof commandClassifications[number];

export const commandTypes = [
  "UPDATE_CREW_PARTICULARS",
  "UPSERT_PERSONAL_DETAILS", "UPSERT_ADDRESS", "UPSERT_FAMILY_INFORMATION", "UPSERT_NEXT_OF_KIN",
  "UPDATE_CHILDREN", "UPDATE_DOCUMENTS", "UPDATE_VISAS", "UPDATE_EDUCATION",
  "UPDATE_LICENSES", "UPDATE_TRAINING", "UPDATE_SEA_SERVICE",
  "CREATE_PERSONAL", "CREATE_CONTACT", "CREATE_FAMILY", "CREATE_NEXT_OF_KIN",
  "CREATE_CHILDREN", "CREATE_DOCUMENTS", "CREATE_VISAS", "CREATE_EDUCATION",
  "CREATE_LICENSES", "CREATE_TRAINING", "CREATE_SEA_SERVICE",
  "DELETE_CHILDREN", "DELETE_DOCUMENTS", "DELETE_VISAS", "DELETE_EDUCATION",
  "DELETE_LICENSES", "DELETE_TRAINING", "DELETE_SEA_SERVICE",
  "SYNC_VESSEL_TYPES", "UNKNOWN",
] as const;
export type ErpCommandType = typeof commandTypes[number];

export interface CommandPolicy {
  classification: CommandClassification;
  reasonCode: string;
  automated: boolean;
}

const safeUpdateTypes = new Set<ErpCommandType>([
  "UPDATE_CREW_PARTICULARS", "UPDATE_CHILDREN", "UPDATE_DOCUMENTS", "UPDATE_VISAS",
  "UPDATE_EDUCATION", "UPDATE_LICENSES", "UPDATE_TRAINING", "UPDATE_SEA_SERVICE",
]);

export function deriveCommandType(section: string, action: string): ErpCommandType {
  const suffix = section.replace(/-/g, "_").toUpperCase();
  if (section === "vessel-types") return "SYNC_VESSEL_TYPES";
  if (action === "create") return (`CREATE_${suffix}` as ErpCommandType);
  if (action === "delete") return (`DELETE_${suffix}` as ErpCommandType);
  if (action !== "update") return "UNKNOWN";
  const singleton: Record<string, ErpCommandType> = {
    particulars: "UPDATE_CREW_PARTICULARS",
    personal: "UPSERT_PERSONAL_DETAILS",
    contact: "UPSERT_ADDRESS",
    family: "UPSERT_FAMILY_INFORMATION",
    "next-of-kin": "UPSERT_NEXT_OF_KIN",
  };
  return singleton[section] ?? (`UPDATE_${suffix}` as ErpCommandType);
}

export function commandPolicy(commandType: string): CommandPolicy {
  if (safeUpdateTypes.has(commandType as ErpCommandType)) {
    return { classification: "SAFE_WITH_RECONCILIATION", reasonCode: "AUTHORITATIVE_READBACK_REQUIRED", automated: true };
  }
  if (commandType.startsWith("CREATE_") || commandType.startsWith("UPSERT_")) {
    return { classification: "MANUAL_RECONCILIATION_REQUIRED", reasonCode: "UNSAFE_CREATE_NO_IDEMPOTENCY_KEY", automated: false };
  }
  if (commandType.startsWith("DELETE_")) {
    return { classification: "MANUAL_RECONCILIATION_REQUIRED", reasonCode: "NON_ATOMIC_FILE_DELETE", automated: false };
  }
  if (commandType === "SYNC_VESSEL_TYPES") {
    return { classification: "BLOCKED", reasonCode: "NON_TRANSACTIONAL_REPLACEMENT", automated: false };
  }
  return { classification: "BLOCKED", reasonCode: "NO_STABLE_RECONCILIATION_KEY", automated: false };
}
