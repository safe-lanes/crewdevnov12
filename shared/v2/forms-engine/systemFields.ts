/** System fields have one shared set and one set per Company Form subject. */
export const COMPANY_FORM_SUBJECT_TYPES = ["crew_assignment"] as const;
export type CompanyFormSubjectType = typeof COMPANY_FORM_SUBJECT_TYPES[number];

export type SystemFieldDefinition = { key: string; label: string };

export const SHARED_SYSTEM_FIELDS = [
  { key: "date_of_declaration", label: "Date of declaration" },
] as const satisfies readonly SystemFieldDefinition[];

export const SUBJECT_SYSTEM_FIELDS = {
  crew_assignment: [
    { key: "seafarer_name", label: "Seafarer name" },
    { key: "rank", label: "Rank" },
    { key: "nationality", label: "Nationality" },
    { key: "vessel_to_join", label: "Vessel to join" },
    { key: "sign_on_date", label: "Sign-on date" },
  ],
} as const satisfies Record<CompanyFormSubjectType, readonly SystemFieldDefinition[]>;

export function isCompanyFormSubjectType(value: unknown): value is CompanyFormSubjectType {
  return typeof value === "string" && COMPANY_FORM_SUBJECT_TYPES.some((subject) => subject === value);
}

export function getSystemFieldsForSubject(subjectType: CompanyFormSubjectType): SystemFieldDefinition[] {
  return [...SHARED_SYSTEM_FIELDS, ...SUBJECT_SYSTEM_FIELDS[subjectType]];
}

export function getSystemField(subjectType: unknown, key: unknown): SystemFieldDefinition | undefined {
  if (!isCompanyFormSubjectType(subjectType) || typeof key !== "string") return undefined;
  return getSystemFieldsForSubject(subjectType).find((field) => field.key === key);
}