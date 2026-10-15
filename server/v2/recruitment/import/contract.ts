// Fixed, versioned cell locations are shared by the generator and reader.
// Uploaded workbooks cannot supply field/table mappings or identity/status values.
import { FORM_LAYOUT, LEGACY_FORM_LAYOUT, FORM_SHEET, type Placement } from "./formLayout";
export const LEGACY_VERSION = "Recruitment A1-A5 / 2 — Single sheet";
export const VERSION = "Recruitment A1-A5 / 3 — Single sheet";
export type TemplateVersion = typeof VERSION | typeof LEGACY_VERSION;
export type Field = { key: string; label: string; date?: boolean; catalog?: string; certificateCatalog?: "licenses" | "training"; choices?: string[]; max?: number };
export type Block = { sheet: string; section: string; entity: string; uuid: string; fields: Field[]; rows?: number; start: number; placements: Placement[]; rowStep: number };
const f = (key: string, label: string, extra: Partial<Field> = {}): Field => ({ key, label, ...extra });
const date = (key: string, label: string) => f(key, label, { date: true });
const country = (key: string, label: string) => f(key, label, { catalog: "countries" });
const names = [f("firstName", "First name"), f("middleName", "Middle name"), f("familyName", "Family name")];
const certificateFields = [f("abbr", "Abbreviation"), f("requirement", "Requirement"), f("certificateNo", "Certificate no."), f("issuingAuthority", "Issuing authority"), country("issuingCountryUuid", "Issuing country"), date("issued", "Issued"), date("expiry", "Expiry")];
const DEFINITIONS: Omit<Block, "placements" | "rowStep">[] = [
  { sheet: "A1 Personal", section: "A1", entity: "candidate", uuid: "recCanUuid", start: 6, fields: [
    ...names, f("gender", "Gender", { choices: ["Male", "Female"] }), date("dob", "Date of birth"),
    f("nationalityUuid", "Nationality", { catalog: "nationalities" }), f("presentRank", "Present rank", { catalog: "ranks" }), f("rankAppliedFor", "Rank applied for", { catalog: "ranks" }),
  ] },
  { sheet: "A1 Personal", section: "A1", entity: "personal", uuid: "cpdUuid", start: 17, fields: [
    f("heightCm", "Height (cm)", { max: 3 }), f("weightKg", "Weight (kg)", { max: 3 }), f("placeOfBirthCity", "Birth city"), country("placeOfBirthCountryUuid", "Birth country"),
    f("nativeLanguageUuid", "Native language", { catalog: "languages" }), f("foreignLanguages", "Foreign languages", { max: 100 }),
    f("englishProficiency", "English proficiency", { choices: ["None", "Basic", "Intermediate", "Fluent", "Native"] }), f("manningAgent", "Manning agent", { catalog: "agents" }),
  ] },
  { sheet: "A1 Personal", section: "A1", entity: "address", uuid: "addrUuid", start: 28, fields: [
    country("countryOfResidenceUuid", "Country of residence"), f("nearestAirport", "Nearest airport", { max: 100 }), f("addressLine1", "Address line 1", { max: 100 }), f("addressLine2", "Address line 2", { max: 100 }),
    f("contactLandline", "Landline", { max: 20 }), f("mobile", "Mobile", { max: 20 }), f("email", "Email", { max: 100 }),
  ] },
  { sheet: "A1 Family", section: "A1", entity: "family", uuid: "famUuid", start: 6, fields: [
    f("maritalStatus", "Marital status", { choices: ["Single", "Married", "Divorced", "Widowed"] }), f("numDependentChildren", "Dependent children"),
    f("fatherName", "Father's name"), f("motherName", "Mother's name"), f("spouseFirstName", "Spouse first name"), f("spouseMiddleName", "Spouse middle name"), f("spouseFamilyName", "Spouse family name"), date("spouseDob", "Spouse birth date"),
  ] },
  { sheet: "A1 Family", section: "A1", entity: "nok", uuid: "nokUuid", start: 17, fields: [
    ...names, f("telephone", "NOK telephone", { max: 20 }), f("email", "NOK email", { max: 100 }), f("address", "NOK address", { max: 250 }), f("relationship", "Relationship"),
  ] },
  { sheet: "A1 Children", section: "A1", entity: "children", uuid: "childUuid", start: 6, rows: 8, fields: [...names, date("dob", "Birth date"), f("gender", "Gender", { choices: ["Male", "Female"] })] },
  { sheet: "A1 Vessel Types", section: "A1", entity: "vesselTypes", uuid: "cvtaUuid", start: 6, rows: 8, fields: [f("vesselTypeUuid", "Vessel type applied for", { catalog: "vesselTypes" })] },
  { sheet: "A2 Documents", section: "A2", entity: "documents", uuid: "docUuid", start: 6, rows: 15, fields: [f("documentName", "Document type"), f("number", "Number"), date("issued", "Issued"), date("expiry", "Expiry"), f("issuingAuthority", "Issuing authority"), country("issuingCountryUuid", "Issuing country")] },
  { sheet: "A2 Visas", section: "A2", entity: "visas", uuid: "visaUuid", start: 6, rows: 10, fields: [country("countryUuid", "Issuing country"), f("serialNo", "Serial no."), date("issued", "Issued"), date("expiry", "Expiry"), f("visaType", "Visa type"), f("source", "Source")] },
  { sheet: "A3 Education", section: "A3", entity: "education", uuid: "eduUuid", start: 6, rows: 8, fields: [date("dateOfCompletion", "Completion date"), f("institution", "Institution", { max: 150 }), f("subjectsField", "Subjects / field", { max: 150 }), f("qualifications", "Qualification", { max: 150 })] },
  { sheet: "A3 Licenses", section: "A3", entity: "licenses", uuid: "licUuid", start: 6, rows: 15, fields: [f("certificateDocument", "Certificate / document", { certificateCatalog: "licenses" }), ...certificateFields] },
  { sheet: "A3 Training", section: "A3", entity: "training", uuid: "trainUuid", start: 6, rows: 30, fields: [f("trainingCourse", "Training course", { certificateCatalog: "training" }), ...certificateFields] },
  { sheet: "A4 Sea Service", section: "A4", entity: "sea", uuid: "seaUuid", start: 6, rows: 40, fields: [
    f("vesselName", "Vessel name", { max: 150 }), f("vesselTypeUuid", "Vessel type", { catalog: "vesselTypes" }), f("deadweight", "Deadweight"), f("engineTypePower", "Engine type / power", { max: 100 }), f("ownerOperator", "Owner / operator", { max: 150 }), f("rank", "Rank", { catalog: "ranks" }), date("fromDate", "From"), date("toDate", "To"),
  ] },
  { sheet: "A5 Additional", section: "A5", entity: "additional", uuid: "infoUuid", start: 6, rows: 15, fields: [f("information", "Information", { max: 1000 }), f("response", "Response", { max: 1000 })] },
];
// Keep entity order stable: it is also used for duplicate-import fingerprints.
export const LEGACY_BLOCKS: Block[] = DEFINITIONS.map(block => ({
  ...block, sheet: FORM_SHEET, start: LEGACY_FORM_LAYOUT[block.entity].start,
  placements: LEGACY_FORM_LAYOUT[block.entity].placements, rowStep: LEGACY_FORM_LAYOUT[block.entity].step || 1,
}));
export const BLOCKS: Block[] = DEFINITIONS.map(block => ({
  ...block, sheet: FORM_SHEET, start: FORM_LAYOUT[block.entity].start,
  placements: FORM_LAYOUT[block.entity].placements, rowStep: FORM_LAYOUT[block.entity].step || 1,
  ...(block.entity === "vesselTypes" ? {
    rows: 1, fields: [{ ...block.fields[0], label: "Vessel types applied for" }],
  } : {}),
}));
export function blocksForVersion(version: TemplateVersion): Block[] {
  return version === LEGACY_VERSION ? LEGACY_BLOCKS : BLOCKS;
}
export type ImportError = { section?: string; sheet: string; cell: string; field: string; message: string };
export type CatalogEntry = { label: string; value: string; abbr?: string | null; requirement?: string | null };
export type Catalogs = Record<string, CatalogEntry[]>;
export type Parsed = { data: Record<string, Record<string, string>[]>; errors: ImportError[]; summary: Record<string, number>; candidateName: string; isValid: boolean; status: "Applied" };
export function cellLocation(block: Block, field: number, row: number): string {
  return inputRange(block, field, row).split(":")[0];
}
export function inputRange(block: Block, field: number, row: number): string {
  const r = block.start + row * block.rowStep;
  return block.placements[field].input.replaceAll("{r}", String(r)).replaceAll("{s}", String(r + 1));
}
export function labelLocation(block: Block, field: number): string {
  return block.placements[field].label.split(":")[0];
}
