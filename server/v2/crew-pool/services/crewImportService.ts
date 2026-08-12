/**
 * Crew Import Service
 *
 * Handles parsing, validation, and importing crew data from Excel/CSV files.
 * All column-to-field mapping happens here — the client never sees internal field names.
 *
 * SCALE & INTEGRITY:
 * - Master data is loaded ONCE into in-memory maps; validation is a single pass
 *   with zero per-cell database round-trips.
 * - Employee ID is normalized (trim + upper-case) everywhere it is used for
 *   linkage, in-file dedupe, and existing-in-DB checks, so a sub-record can never
 *   attach to the wrong crew because of letter-case or spacing.
 * - Import runs in ONE transaction with chunked, batched multi-row inserts.
 *   If ANY row fails, ALL rows are rolled back. Zero partial data.
 * - Values the user typed that cannot be matched to master data fail validation
 *   with a cell-level message — they are never silently saved as blank.
 * - After import, per-category counts are verified against the file's parsed
 *   counts inside the transaction; a mismatch rolls the whole run back.
 */
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db";
import {
  crewMembersV2,
  crewPersonalDetails,
  crewChildren,
  crewAddresses,
  crewFamilyInfo,
  crewNextOfKin,
  crewDocuments,
  crewLicenses,
  crewTrainingCourses,
  crewSeaService,
  crewVisas,
  crewEducation,
  crewVesselTypesApplied,
  crewPreJoiningMedicals,
  crewDoctorVisits,
  crewBriefings,
  crewDebriefings,
} from "../../../../shared/v2/crew-pool/schema";
import {
  masterNationalities,
  masterVesselTypes,
  masterVessels,
  masterCountries,
  masterLanguages,
} from "../../../../shared/schema";

// ============================================================================
// DATE PARSER — Accepts multiple human-friendly formats
// ============================================================================

/**
 * Parse dates from various formats the client might use.
 * Returns ISO string (YYYY-MM-DD) or null if invalid.
 */
export function parseDate(value: any): string | null {
  if (!value) return null;

  // Handle native Date objects
  if (value instanceof Date) {
    if (!isNaN(value.getTime())) {
      return value.toISOString().split("T")[0];
    }
    return null;
  }

  // Handle Excel serial date numbers (represented as numbers or strings)
  const num = Number(value);
  if (!isNaN(num) && num > 10000 && num < 70000) {
    const date = new Date((num - 25569) * 86400000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
    return null;
  }

  const str = String(value).trim();
  if (!str) return null;

  // Try ISO format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(str + "T00:00:00");
    if (!isNaN(d.getTime())) return str;
  }

  // Try DD/MM/YYYY
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, dd, mm, yyyy] = slashMatch;
    const d = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
    if (!isNaN(d.getTime())) {
      return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    }
  }

  // Try DD-MMM-YYYY or DD-MMM-YY (15-Mar-1985 / 20-May-96)
  const monthNames: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const mmmMatch = str.match(/^(\d{1,2})[- ]([A-Za-z]{3})[- ](\d{2,4})$/);
  if (mmmMatch) {
    const [, dd, mmm, yyOrYyyy] = mmmMatch;
    const mm = monthNames[mmm.toLowerCase()];
    if (mm) {
      let yyyy = yyOrYyyy;
      if (yyOrYyyy.length === 2) {
        const yearNum = parseInt(yyOrYyyy);
        // If year is >= 50, assume 19xx, else 20xx
        yyyy = String(yearNum >= 50 ? 1900 + yearNum : 2000 + yearNum);
      }
      return `${yyyy}-${mm}-${dd.padStart(2, "0")}`;
    }
  }

  // Last resort: try JS Date parsing with a year sanity guard
  const fallback = new Date(str);
  if (!isNaN(fallback.getTime())) {
    const parsedYear = fallback.getFullYear();
    if (parsedYear > 1800 && parsedYear < 2100) {
      return fallback.toISOString().split("T")[0];
    }
  }

  return null;
}

// ============================================================================
// HELPERS
// ============================================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Normalize an Employee ID for linkage/dedupe: trim surrounding spaces and
 * upper-case. Used EVERYWHERE Employee ID is compared so sub-records can never
 * bleed onto the wrong crew because of case or spacing differences.
 */
function normalizeEmpNo(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function getCellValue(row: Record<string, any>, header: string): string | null {
  const val = row[header];
  if (val === undefined || val === null || String(val).trim() === "") return null;
  return String(val).trim();
}

// ============================================================================
// MASTER DATA MAPS — loaded once, used for the whole run
// ============================================================================

interface MasterMaps {
  nationality: Map<string, string>;
  vesselType: Map<string, string>;
  country: Map<string, string>;
  language: Map<string, string>;
  vessel: Map<string, string>;
}

async function loadMasterMaps(): Promise<MasterMaps> {
  const db = getDb();

  const [nats, vts, countries, vessels, langs] = await Promise.all([
    db.select({ uuid: masterNationalities.natUuid, name: masterNationalities.nationality, code: masterNationalities.countryCode }).from(masterNationalities),
    db.select({ uuid: masterVesselTypes.vtUuid, name: masterVesselTypes.vesselType }).from(masterVesselTypes),
    db.select({ uuid: masterCountries.countryUuid, name: masterCountries.countryName }).from(masterCountries),
    db.select({ uuid: masterVessels.vesselUuid, name: masterVessels.vessel, imo: masterVessels.imoNumber }).from(masterVessels),
    db.select({ uuid: masterLanguages.langUuid, name: masterLanguages.languageName }).from(masterLanguages),
  ]);

  const key = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

  const nationality = new Map<string, string>();
  for (const n of nats) {
    if (n.name) nationality.set(key(n.name), n.uuid);
    if (n.code) nationality.set(key(n.code), n.uuid);
  }

  const vesselType = new Map<string, string>();
  for (const v of vts) if (v.name) vesselType.set(key(v.name), v.uuid);

  const country = new Map<string, string>();
  for (const c of countries) if (c.name) country.set(key(c.name), c.uuid);

  const vessel = new Map<string, string>();
  for (const v of vessels) {
    if (v.name) vessel.set(key(v.name), v.uuid);
    if (v.imo) vessel.set(key(v.imo), v.uuid);
  }

  const language = new Map<string, string>();
  for (const l of langs) if (l.name) language.set(key(l.name), l.uuid);

  return { nationality, vesselType, country, language, vessel };
}

/**
 * Resolve a typed value to a UUID from a pre-loaded map. Passes through valid
 * UUIDs. Returns null when the value is empty or not found.
 */
function resolveFromMap(map: Map<string, string>, value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  if (UUID_REGEX.test(v)) return v;
  return map.get(v.toLowerCase()) || null;
}

// ============================================================================
// VALIDATION / RESULT TYPES
// ============================================================================

export interface ValidationError {
  sheet: string;
  row: number;
  column: string;
  value: string | null;
  message: string;
  /** "manual_value" = manually typed value not found in the dropdown/master list */
  errorType?: "manual_value" | "standard";
}

export interface ImportCounts {
  crew: number;
  children: number;
  nok: number;
  documents: number;
  visas: number;
  licenses: number;
  seaService: number;
  training: number;
  education: number;
  medicals: number;
  doctorVisits: number;
  briefings: number;
  debriefings: number;
}

export interface ValidationResult {
  isValid: boolean;
  summary: ImportCounts;
  errors: ValidationError[];
}

export interface ImportResult {
  success: boolean;
  imported: ImportCounts;
  expected: ImportCounts;
  seafarerCodes: string[]; // All emp numbers created
  errors: ValidationError[];
  /** Sea service rows dropped because they were exact duplicates within the uploaded file */
  seaServiceSkipped: number;
}

function emptyCounts(): ImportCounts {
  return {
    crew: 0, children: 0, nok: 0, documents: 0, visas: 0, licenses: 0,
    seaService: 0, training: 0, education: 0,
    medicals: 0, doctorVisits: 0, briefings: 0, debriefings: 0,
  };
}

// ============================================================================
// PARSER — Read Excel file into structured rows
// ============================================================================

interface ParsedData {
  crewRows: Record<string, any>[];
  childrenRows: Record<string, any>[];
  nokRows: Record<string, any>[];
  documentRows: Record<string, any>[];
  visaRows: Record<string, any>[];
  licenseRows: Record<string, any>[];
  seaServiceRows: Record<string, any>[];
  trainingRows: Record<string, any>[];
  educationRows: Record<string, any>[];
  medicalRows: Record<string, any>[];
  doctorVisitRows: Record<string, any>[];
  briefingRows: Record<string, any>[];
  debriefingRows: Record<string, any>[];
}

function parseExcelBuffer(buffer: Buffer): ParsedData {
  const wb = XLSX.read(buffer, { type: "buffer" });

  function readSheet(name: string): Record<string, any>[] {
    const ws = wb.Sheets[name];
    if (!ws) return [];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: null });
    // Filter out completely empty rows
    return rows.filter(row =>
      Object.values(row).some(v => v !== null && v !== undefined && String(v).trim() !== "")
    );
  }

  return {
    crewRows: readSheet("Crew Details"),
    childrenRows: readSheet("Children Details"),
    nokRows: readSheet("Emergency Contact"),
    documentRows: readSheet("Travel Documents"),
    visaRows: readSheet("Travel Visas"),
    licenseRows: readSheet("Licenses & Certificates"),
    seaServiceRows: readSheet("Sea Service History"),
    trainingRows: readSheet("Training Courses"),
    educationRows: readSheet("Education Details"),
    medicalRows: readSheet("Pre-Joining Medicals"),
    doctorVisitRows: readSheet("Doctor Visits"),
    briefingRows: readSheet("Briefings"),
    debriefingRows: readSheet("De-briefings"),
  };
}

function summaryFromParsed(data: ParsedData): ImportCounts {
  return {
    crew: data.crewRows.length,
    children: data.childrenRows.length,
    nok: data.nokRows.length,
    documents: data.documentRows.length,
    visas: data.visaRows.length,
    licenses: data.licenseRows.length,
    seaService: data.seaServiceRows.length,
    training: data.trainingRows.length,
    education: data.educationRows.length,
    medicals: data.medicalRows.length,
    doctorVisits: data.doctorVisitRows.length,
    briefings: data.briefingRows.length,
    debriefings: data.debriefingRows.length,
  };
}

// ============================================================================
// PREPARE — single pass: parse → validate → (optionally) resolve rows to insert
// ============================================================================

interface ResolvedRows {
  crew: any[];
  personal: any[];
  addresses: any[];
  family: any[];
  vesselTypesApplied: any[];
  children: any[];
  nok: any[];
  documents: any[];
  visas: any[];
  licenses: any[];
  seaService: any[];
  training: any[];
  education: any[];
  medicals: any[];
  doctorVisits: any[];
  briefings: any[];
  debriefings: any[];
}

interface PreparedImport {
  errors: ValidationError[];
  summary: ImportCounts;
  seafarerCodes: string[];
  resolved: ResolvedRows | null;
  /** Sea service rows dropped during in-batch deduplication (duplicate within the file) */
  seaServiceInBatchSkipped: number;
}

/**
 * Run the whole validation pass once. When `resolve` is true, also build the
 * fully-resolved insert payloads (used by execute) so master data is only
 * looked up once and no second re-validation is needed.
 */
async function prepareImport(buffer: Buffer, resolve: boolean): Promise<PreparedImport> {
  const data = parseExcelBuffer(buffer);
  const errors: ValidationError[] = [];
  const now = new Date();

  const maps = await loadMasterMaps();

  // Load existing Employee IDs once (normalized) for the DB duplicate check.
  const db = getDb();
  const existingRows = await db
    .select({ empNo: crewMembersV2.empNo })
    .from(crewMembersV2);
  const existingEmpNos = new Set<string>(existingRows.map((r: { empNo: string | null }) => normalizeEmpNo(r.empNo)));

  // Normalized set of Employee IDs seen in the Crew Details sheet (for dedupe +
  // sub-sheet linkage). Map from normalized empNo → crewUuid for linking.
  const crewCodesInFile = new Set<string>();
  const empNoToCrewUuid = new Map<string, string>();
  const seafarerCodes: string[] = [];

  const resolved: ResolvedRows | null = resolve
    ? {
        crew: [], personal: [], addresses: [], family: [], vesselTypesApplied: [],
        children: [], nok: [], documents: [], visas: [], licenses: [],
        seaService: [], training: [], education: [],
        medicals: [], doctorVisits: [], briefings: [], debriefings: [],
      }
    : null;

  // ---- Validate + resolve Crew Details ----
  for (let i = 0; i < data.crewRows.length; i++) {
    const row = data.crewRows[i];
    const rowNum = i + 2; // 1-indexed + header row

    const firstName = getCellValue(row, "First Name");
    if (!firstName) {
      errors.push({ sheet: "Crew Details", row: rowNum, column: "First Name", value: null, message: "First Name is required" });
    }

    // Nationality is optional, but must match master data when provided
    const nationality = getCellValue(row, "Nationality");
    let nationalityUuid: string | null = null;
    if (nationality) {
      nationalityUuid = resolveFromMap(maps.nationality, nationality);
      if (!nationalityUuid) {
        errors.push({ sheet: "Crew Details", row: rowNum, column: "Nationality", value: nationality, message: `Nationality "${nationality}" not found. Check the 'Instructions & Reference' sheet for valid values.`, errorType: "manual_value" });
      }
    }

    // Employee ID: mandatory + duplicate checks (normalized)
    const empNoRaw = getCellValue(row, "Employee ID");
    const empNoNorm = normalizeEmpNo(empNoRaw);
    let linkable = false;
    if (!empNoRaw) {
      errors.push({ sheet: "Crew Details", row: rowNum, column: "Employee ID", value: null, message: "Employee ID is required" });
    } else if (crewCodesInFile.has(empNoNorm)) {
      errors.push({ sheet: "Crew Details", row: rowNum, column: "Employee ID", value: empNoRaw, message: `Duplicate Employee ID "${empNoRaw}" found in this file` });
    } else {
      crewCodesInFile.add(empNoNorm);
      if (existingEmpNos.has(empNoNorm)) {
        errors.push({ sheet: "Crew Details", row: rowNum, column: "Employee ID", value: empNoRaw, message: `Employee ID "${empNoRaw}" already exists in the system` });
      } else {
        linkable = true;
      }
    }

    // Vessel Type Experience: comma-separated; each value must match master data
    const vesselTypeInput = getCellValue(row, "Vessel Type Experience");
    const vesselTypeUuids: string[] = [];
    if (vesselTypeInput) {
      const names = vesselTypeInput.split(",").map(s => s.trim()).filter(Boolean);
      for (const name of names) {
        const vtUuid = resolveFromMap(maps.vesselType, name);
        if (!vtUuid) {
          errors.push({ sheet: "Crew Details", row: rowNum, column: "Vessel Type Experience", value: name, message: `Vessel Type "${name}" not found. Check the 'Instructions & Reference' sheet for valid values.`, errorType: "manual_value" });
        } else {
          vesselTypeUuids.push(vtUuid);
        }
      }
    }

    const countryRes = getCellValue(row, "Country of Residence");
    let countryResUuid: string | null = null;
    if (countryRes) {
      countryResUuid = resolveFromMap(maps.country, countryRes);
      if (!countryResUuid) {
        errors.push({ sheet: "Crew Details", row: rowNum, column: "Country of Residence", value: countryRes, message: `Country "${countryRes}" not found. Check the 'Instructions & Reference' sheet for valid values.`, errorType: "manual_value" });
      }
    }

    const birthCountry = getCellValue(row, "Place of Birth (Country)");
    let birthCountryUuid: string | null = null;
    if (birthCountry) {
      birthCountryUuid = resolveFromMap(maps.country, birthCountry);
      if (!birthCountryUuid) {
        errors.push({ sheet: "Crew Details", row: rowNum, column: "Place of Birth (Country)", value: birthCountry, message: `Country "${birthCountry}" not found. Check the 'Instructions & Reference' sheet for valid values.`, errorType: "manual_value" });
      }
    }

    // Date format validations
    const dob = getCellValue(row, "Date of Birth");
    if (dob && !parseDate(dob)) {
      errors.push({ sheet: "Crew Details", row: rowNum, column: "Date of Birth", value: dob, message: `Invalid date format. Use DD-MMM-YYYY (15-Mar-1985), DD/MM/YYYY, or YYYY-MM-DD` });
    }

    const spouseDob = getCellValue(row, "Spouse Date of Birth");
    if (spouseDob && !parseDate(spouseDob)) {
      errors.push({ sheet: "Crew Details", row: rowNum, column: "Spouse Date of Birth", value: spouseDob, message: `Invalid date format. Use DD-MMM-YYYY, DD/MM/YYYY, or YYYY-MM-DD` });
    }

    const recruitDate = getCellValue(row, "Date of Recruitment");
    if (!recruitDate) {
      errors.push({ sheet: "Crew Details", row: rowNum, column: "Date of Recruitment", value: null, message: "Date of Recruitment is required" });
    } else if (!parseDate(recruitDate)) {
      errors.push({ sheet: "Crew Details", row: rowNum, column: "Date of Recruitment", value: recruitDate, message: `Invalid date format. Use DD-MMM-YYYY, DD/MM/YYYY, or YYYY-MM-DD` });
    }

    // Dropdown field value validations
    const gender = getCellValue(row, "Gender");
    if (gender && !["male", "female"].includes(gender.toLowerCase())) {
      errors.push({ sheet: "Crew Details", row: rowNum, column: "Gender", value: gender, message: `Gender must be 'Male' or 'Female'`, errorType: "manual_value" });
    }

    const engProf = getCellValue(row, "English Proficiency");
    if (engProf && !["none", "basic", "intermediate", "fluent", "native"].includes(engProf.toLowerCase())) {
      errors.push({ sheet: "Crew Details", row: rowNum, column: "English Proficiency", value: engProf, message: `English Proficiency must be 'None', 'Basic', 'Intermediate', 'Fluent', or 'Native'`, errorType: "manual_value" });
    }

    // Native Language: optional, but must match the languages master when provided
    const nativeLanguage = getCellValue(row, "Native Language");
    let nativeLanguageUuid: string | null = null;
    if (nativeLanguage) {
      nativeLanguageUuid = resolveFromMap(maps.language, nativeLanguage);
      if (!nativeLanguageUuid) {
        errors.push({ sheet: "Crew Details", row: rowNum, column: "Native Language", value: nativeLanguage, message: `Language "${nativeLanguage}" not found. Check the 'Instructions & Reference' sheet for valid values.`, errorType: "manual_value" });
      }
    }

    // Foreign Languages: comma-separated list, each value must match master data
    const foreignLangs = getCellValue(row, "Foreign Languages");
    if (foreignLangs) {
      const langNames = foreignLangs.split(",").map(s => s.trim()).filter(Boolean);
      for (const langName of langNames) {
        if (!resolveFromMap(maps.language, langName)) {
          errors.push({ sheet: "Crew Details", row: rowNum, column: "Foreign Languages", value: langName, message: `Language "${langName}" not found. Check the 'Instructions & Reference' sheet for valid values.`, errorType: "manual_value" });
        }
      }
    }

    const marital = getCellValue(row, "Marital Status");
    if (marital && !["single", "married", "divorced", "widowed"].includes(marital.toLowerCase())) {
      errors.push({ sheet: "Crew Details", row: rowNum, column: "Marital Status", value: marital, message: `Marital Status must be 'Single', 'Married', 'Divorced', or 'Widowed'`, errorType: "manual_value" });
    }

    const statusVal = getCellValue(row, "Current Status");
    if (statusVal && !["active", "terminated"].includes(statusVal.toLowerCase())) {
      errors.push({ sheet: "Crew Details", row: rowNum, column: "Current Status", value: statusVal, message: `Current Status must be 'Active' or 'Terminated'`, errorType: "manual_value" });
    }
    const resolvedStatus = statusVal
      ? (statusVal.toLowerCase() === "terminated" ? "Terminated" : "On Leave")
      : "On Leave";

    // ---- Build resolved insert payloads (only when a valid, linkable crew) ----
    if (resolve && resolved && linkable) {
      const crewUuid = uuidv4();
      empNoToCrewUuid.set(empNoNorm, crewUuid);
      seafarerCodes.push(empNoRaw!);

      resolved.crew.push({
        crewUuid,
        empNo: empNoRaw,
        employeeId: null,
        firstName,
        middleName: getCellValue(row, "Middle Name"),
        familyName: getCellValue(row, "Last Name / Family Name"),
        gender,
        dob: parseDate(dob),
        nationalityUuid,
        vesselTypeUuid: vesselTypeUuids[0] ?? null,
        presentRank: getCellValue(row, "Present Rank / Designation"),
        rankAppliedFor: getCellValue(row, "Rank Applied For"),
        status: resolvedStatus,
        recruitmentDate: parseDate(recruitDate),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      // Personal details (only when any personal field is filled)
      const heightCm = getCellValue(row, "Height (cm)");
      const weightKg = getCellValue(row, "Weight (kg)");
      const placeOfBirthCity = getCellValue(row, "Place of Birth (City)");
      const englishProficiency = engProf;
      const manningAgent = getCellValue(row, "Manning Agent");
      const crewPool = getCellValue(row, "Crew Pool");

      const hasPersonal = heightCm || weightKg || placeOfBirthCity || nativeLanguage ||
        foreignLangs || englishProficiency || manningAgent || crewPool || birthCountry;
      if (hasPersonal) {
        let bmi: string | null = null;
        if (heightCm && weightKg) {
          const h = parseFloat(heightCm) / 100;
          const w = parseFloat(weightKg);
          if (h > 0 && w > 0) bmi = (w / (h * h)).toFixed(1);
        }
        resolved.personal.push({
          cpdUuid: uuidv4(),
          crewUuid,
          heightCm,
          weightKg,
          bmi,
          placeOfBirthCity,
          placeOfBirthCountryUuid: birthCountryUuid,
          nativeLanguageUuid,
          foreignLanguages: foreignLangs
            ? foreignLangs.split(",").map(s => s.trim()).filter(Boolean).join(", ")
            : null,
          englishProficiency,
          manningAgent,
          crewPool,
          createdAt: now,
          updatedAt: now,
        });
      }

      // Address (only when any address field is filled)
      const email = getCellValue(row, "Email Address");
      const mobile = getCellValue(row, "Mobile Number");
      const landline = getCellValue(row, "Phone / Landline");
      const nearestAirport = getCellValue(row, "Nearest Airport");
      const addr1 = getCellValue(row, "Residential Address Line 1");
      const addr2 = getCellValue(row, "Residential Address Line 2");
      const hasAddress = email || mobile || landline || countryRes || nearestAirport || addr1 || addr2;
      if (hasAddress) {
        resolved.addresses.push({
          addrUuid: uuidv4(),
          crewUuid,
          email,
          mobile,
          contactLandline: landline,
          countryOfResidenceUuid: countryResUuid,
          nearestAirport,
          addressLine1: addr1,
          addressLine2: addr2,
          createdAt: now,
          updatedAt: now,
        });
      }

      // Family info (only when any family field is filled)
      const maritalStatus = marital;
      const numChildren = getCellValue(row, "No. of Dependent Children");
      const fatherName = getCellValue(row, "Father's Name");
      const motherName = getCellValue(row, "Mother's Name");
      const spouseFirst = getCellValue(row, "Spouse First Name");
      const spouseFamily = getCellValue(row, "Spouse Family Name");
      const hasFamily = maritalStatus || numChildren || fatherName || motherName || spouseFirst || spouseFamily || spouseDob;
      if (hasFamily) {
        resolved.family.push({
          famUuid: uuidv4(),
          crewUuid,
          maritalStatus,
          numDependentChildren: numChildren,
          fatherName,
          motherName,
          spouseFirstName: spouseFirst,
          spouseFamilyName: spouseFamily,
          spouseDob: parseDate(spouseDob),
          createdAt: now,
          updatedAt: now,
        });
      }

      // Applied vessel types
      let sortOrder = 0;
      for (const vtUuid of vesselTypeUuids) {
        resolved.vesselTypesApplied.push({
          cvtaUuid: uuidv4(),
          crewUuid,
          vesselTypeUuid: vtUuid,
          sortOrder: sortOrder++,
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }

  // Attachment Ref uniqueness tracking: within a single crew, each Attachment
  // Ref must be unique across ALL attachment-bearing sheets so the ZIP import
  // can resolve a folder name to exactly one record. Keyed by normalized empNo.
  const attachmentRefsByEmpNo = new Map<string, Map<string, { sheet: string; row: number }>>();

  // ---- Sub-sheet validation helper ----
  function validateSubSheet(
    rows: Record<string, any>[],
    sheetName: string,
    requiredFields: string[],
    dateFields: string[],
    checkAttachmentRef = false,
  ) {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const code = getCellValue(row, "Employee ID");
      if (!code) {
        errors.push({ sheet: sheetName, row: rowNum, column: "Employee ID", value: null, message: "Employee ID is required to link to a crew member" });
      } else if (!crewCodesInFile.has(normalizeEmpNo(code))) {
        errors.push({ sheet: sheetName, row: rowNum, column: "Employee ID", value: code, message: `Employee ID "${code}" does not match any row in the Crew Details sheet` });
      }

      for (const field of requiredFields) {
        if (!getCellValue(row, field)) {
          errors.push({ sheet: sheetName, row: rowNum, column: field, value: null, message: `${field} is required` });
        }
      }

      for (const field of dateFields) {
        const val = getCellValue(row, field);
        if (val && !parseDate(val)) {
          errors.push({ sheet: sheetName, row: rowNum, column: field, value: val, message: `Invalid date format. Use DD-MMM-YYYY, DD/MM/YYYY, or YYYY-MM-DD` });
        }
      }

      // Attachment Ref must be unique within a crew across all attachment sheets.
      if (checkAttachmentRef && code) {
        const ref = getCellValue(row, "Attachment Ref");
        if (ref) {
          const empKey = normalizeEmpNo(code);
          const refKey = ref.trim().toUpperCase();
          let refs = attachmentRefsByEmpNo.get(empKey);
          if (!refs) {
            refs = new Map();
            attachmentRefsByEmpNo.set(empKey, refs);
          }
          const existing = refs.get(refKey);
          if (existing) {
            errors.push({ sheet: sheetName, row: rowNum, column: "Attachment Ref", value: ref, message: `Duplicate Attachment Ref "${ref}" for this crew — already used on '${existing.sheet}' row ${existing.row}. Each Attachment Ref must be unique per crew.` });
          } else {
            refs.set(refKey, { sheet: sheetName, row: rowNum });
          }
        }
      }
    }
  }

  // ── Pre-validation in-batch deduplication of sea service rows ─────────────
  // Natural key: Employee ID + Vessel Name + Rank Served + (normalised) Sign On Date.
  // We track duplicate *indices* rather than filtering the array so that every
  // subsequent validateSubSheet call still uses the original worksheet row numbers.
  // Duplicate rows have their Attachment Ref nulled out so the attachment-ref
  // uniqueness check does not raise a false error for rows we are about to skip.
  const seaServiceDuplicateIndices = new Set<number>();
  {
    const seenSeaKeys = new Set<string>();
    data.seaServiceRows.forEach((row, idx) => {
      // Normalize the sign-on date through parseDate so that equivalent
      // representations (e.g. "20/05/2024", "20-May-2024", "2024-05-20") all
      // produce the same canonical key and therefore deduplicate correctly.
      const rawSignOn = getCellValue(row, "Sign On Date");
      const normSignOn = parseDate(rawSignOn) ?? (rawSignOn ?? "").trim();
      const key = [
        normalizeEmpNo(getCellValue(row, "Employee ID") ?? ""),
        (getCellValue(row, "Vessel Name") ?? "").trim().toLowerCase(),
        (getCellValue(row, "Rank Served") ?? "").trim().toLowerCase(),
        normSignOn,
      ].join("::");
      if (seenSeaKeys.has(key)) {
        seaServiceDuplicateIndices.add(idx);
        // Null out the attachment ref so the uniqueness check below does not
        // flag this duplicate row as a conflicting attachment ref.
        row["Attachment Ref"] = null;
      } else {
        seenSeaKeys.add(key);
      }
    });
  }

  validateSubSheet(data.childrenRows, "Children Details", ["First Name"], ["Date of Birth"]);
  validateSubSheet(data.nokRows, "Emergency Contact", [], []);
  validateSubSheet(data.documentRows, "Travel Documents", ["Document Name"], ["Date of Issue", "Date of Expiry"], true);
  validateSubSheet(data.visaRows, "Travel Visas", ["Country", "Visa Type"], ["Date of Issue", "Date of Expiry"], true);
  validateSubSheet(data.licenseRows, "Licenses & Certificates", ["Certificate / Document Name"], ["Date of Issue", "Date of Expiry"], true);
  validateSubSheet(data.seaServiceRows, "Sea Service History", ["Vessel Name", "Vessel Type", "Rank Served", "Sign On Date"], ["Sign On Date", "Sign Off Date"], true);
  validateSubSheet(data.trainingRows, "Training Courses", ["Course Name"], ["Date of Issue", "Date of Expiry"], true);
  validateSubSheet(data.educationRows, "Education Details", ["Qualifications / Degree"], ["Date of Completion"], true);
  validateSubSheet(data.medicalRows, "Pre-Joining Medicals", [], ["Examination Date", "Expiry Date"], true);
  validateSubSheet(data.doctorVisitRows, "Doctor Visits", [], ["Visit Date", "Follow-Up Date"], true);
  validateSubSheet(data.briefingRows, "Briefings", [], ["Date Sign On"], true);
  validateSubSheet(data.debriefingRows, "De-briefings", [], ["Date Sign On", "Date Signed Off"], true);

  // Children gender values
  for (let i = 0; i < data.childrenRows.length; i++) {
    const gender = getCellValue(data.childrenRows[i], "Gender");
    if (gender && !["male", "female"].includes(gender.toLowerCase())) {
      errors.push({ sheet: "Children Details", row: i + 2, column: "Gender", value: gender, message: `Gender must be 'Male' or 'Female'`, errorType: "manual_value" });
    }
  }

  // Sea service vessel type + service type values
  for (let i = 0; i < data.seaServiceRows.length; i++) {
    const row = data.seaServiceRows[i];
    const vt = getCellValue(row, "Vessel Type");
    if (vt && !resolveFromMap(maps.vesselType, vt)) {
      errors.push({ sheet: "Sea Service History", row: i + 2, column: "Vessel Type", value: vt, message: `Vessel Type "${vt}" not found. Check the 'Instructions & Reference' sheet.`, errorType: "manual_value" });
    }
    const sType = getCellValue(row, "Company or External?");
    if (sType && !["company", "external"].includes(sType.toLowerCase())) {
      errors.push({ sheet: "Sea Service History", row: i + 2, column: "Company or External?", value: sType, message: `"Company or External?" must be 'Company' or 'External'`, errorType: "manual_value" });
    }
  }

  // ---- Resolve sub-sheet rows (only when linkable to a crew in this file) ----
  if (resolve && resolved) {
    const linkOf = (row: Record<string, any>) => empNoToCrewUuid.get(normalizeEmpNo(getCellValue(row, "Employee ID"))) || null;

    for (const row of data.childrenRows) {
      const crewUuid = linkOf(row);
      if (!crewUuid) continue;
      resolved.children.push({
        childUuid: uuidv4(), crewUuid,
        firstName: getCellValue(row, "First Name"),
        middleName: getCellValue(row, "Middle Name"),
        familyName: getCellValue(row, "Family Name"),
        dob: parseDate(getCellValue(row, "Date of Birth")),
        gender: getCellValue(row, "Gender"),
        createdAt: now, updatedAt: now,
      });
    }

    for (const row of data.nokRows) {
      const crewUuid = linkOf(row);
      if (!crewUuid) continue;
      resolved.nok.push({
        nokUuid: uuidv4(), crewUuid,
        firstName: getCellValue(row, "Contact Person First Name"),
        familyName: getCellValue(row, "Contact Person Family Name"),
        relationship: getCellValue(row, "Relationship"),
        telephone: getCellValue(row, "Phone Number"),
        email: getCellValue(row, "Email"),
        address: getCellValue(row, "Address"),
        createdAt: now, updatedAt: now,
      });
    }

    for (const row of data.documentRows) {
      const crewUuid = linkOf(row);
      if (!crewUuid) continue;
      resolved.documents.push({
        docUuid: uuidv4(), crewUuid,
        attachmentRef: getCellValue(row, "Attachment Ref"),
        documentName: getCellValue(row, "Document Name"),
        number: getCellValue(row, "Document Number"),
        issued: parseDate(getCellValue(row, "Date of Issue")),
        expiry: parseDate(getCellValue(row, "Date of Expiry")),
        issuingAuthority: getCellValue(row, "Issuing Authority"),
        createdAt: now, updatedAt: now,
      });
    }

    for (const row of data.licenseRows) {
      const crewUuid = linkOf(row);
      if (!crewUuid) continue;
      resolved.licenses.push({
        licUuid: uuidv4(), crewUuid,
        attachmentRef: getCellValue(row, "Attachment Ref"),
        certificateDocument: getCellValue(row, "Certificate / Document Name"),
        certificateNo: getCellValue(row, "Certificate Number"),
        issuingAuthority: getCellValue(row, "Issuing Authority"),
        issued: parseDate(getCellValue(row, "Date of Issue")),
        expiry: parseDate(getCellValue(row, "Date of Expiry")),
        createdAt: now, updatedAt: now,
      });
    }

    for (let _ssIdx = 0; _ssIdx < data.seaServiceRows.length; _ssIdx++) {
      if (seaServiceDuplicateIndices.has(_ssIdx)) continue; // skip in-file duplicate
      const row = data.seaServiceRows[_ssIdx];
      const crewUuid = linkOf(row);
      if (!crewUuid) continue;
      const vtName = getCellValue(row, "Vessel Type");
      const rawServiceType = getCellValue(row, "Company or External?");
      const serviceType = rawServiceType?.toLowerCase() === "company" ? "company" : "external";
      const vesselName = getCellValue(row, "Vessel Name");
      const vesselUuid = serviceType === "company" ? resolveFromMap(maps.vessel, vesselName) : null;
      const fromDateStr = parseDate(getCellValue(row, "Sign On Date"));
      const toDateStr = parseDate(getCellValue(row, "Sign Off Date"));
      let periodMonths: string | null = null;
      if (fromDateStr && toDateStr) {
        const start = new Date(fromDateStr);
        const end = new Date(toDateStr);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          periodMonths = (diffDays / 30.44).toFixed(1);
        }
      }
      resolved.seaService.push({
        seaUuid: uuidv4(), crewUuid,
        attachmentRef: getCellValue(row, "Attachment Ref"),
        serviceType, vesselName, vesselUuid,
        vesselTypeUuid: resolveFromMap(maps.vesselType, vtName),
        rank: getCellValue(row, "Rank Served"),
        fromDate: fromDateStr, toDate: toDateStr, periodMonths,
        deadweight: getCellValue(row, "Deadweight"),
        engineTypePower: getCellValue(row, "Engine Type / Power"),
        ownerOperator: getCellValue(row, "Owner / Operator"),
        createdAt: now, updatedAt: now,
      });
    }

    for (const row of data.trainingRows) {
      const crewUuid = linkOf(row);
      if (!crewUuid) continue;
      resolved.training.push({
        trainUuid: uuidv4(), crewUuid,
        attachmentRef: getCellValue(row, "Attachment Ref"),
        trainingCourse: getCellValue(row, "Course Name"),
        certificateNo: getCellValue(row, "Certificate Number"),
        issuingAuthority: getCellValue(row, "Issuing Authority"),
        issued: parseDate(getCellValue(row, "Date of Issue")),
        expiry: parseDate(getCellValue(row, "Date of Expiry")),
        createdAt: now, updatedAt: now,
      });
    }

    for (const row of data.visaRows) {
      const crewUuid = linkOf(row);
      if (!crewUuid) continue;
      const countryVal = getCellValue(row, "Country");
      resolved.visas.push({
        visaUuid: uuidv4(), crewUuid,
        attachmentRef: getCellValue(row, "Attachment Ref"),
        countryUuid: resolveFromMap(maps.country, countryVal),
        country: countryVal,
        visaType: getCellValue(row, "Visa Type"),
        serialNo: getCellValue(row, "Visa Number / Serial Number"),
        issued: parseDate(getCellValue(row, "Date of Issue")),
        expiry: parseDate(getCellValue(row, "Date of Expiry")),
        createdAt: now, updatedAt: now,
      });
    }

    for (const row of data.educationRows) {
      const crewUuid = linkOf(row);
      if (!crewUuid) continue;
      resolved.education.push({
        eduUuid: uuidv4(), crewUuid,
        attachmentRef: getCellValue(row, "Attachment Ref"),
        institution: getCellValue(row, "Institution"),
        subjectsField: getCellValue(row, "Subjects / Field of Study"),
        qualifications: getCellValue(row, "Qualifications / Degree"),
        dateOfCompletion: parseDate(getCellValue(row, "Date of Completion")),
        createdAt: now, updatedAt: now,
      });
    }

    // Part F — Pre-Joining Medicals (vessel resolved when it matches master;
    // the typed vessel name is always preserved as text so nothing is lost).
    for (const row of data.medicalRows) {
      const crewUuid = linkOf(row);
      if (!crewUuid) continue;
      const vesselName = getCellValue(row, "Vessel Name");
      resolved.medicals.push({
        medUuid: uuidv4(), crewUuid,
        attachmentRef: getCellValue(row, "Attachment Ref"),
        vesselUuid: resolveFromMap(maps.vessel, vesselName),
        vesselName,
        examinationDate: parseDate(getCellValue(row, "Examination Date")),
        bp: getCellValue(row, "Blood Pressure"),
        weight: getCellValue(row, "Weight"),
        anyMedicationPrescribed: getCellValue(row, "Any Medication Prescribed"),
        clinicHospital: getCellValue(row, "Clinic/Hospital"),
        fitForDuty: getCellValue(row, "Fit For Duty"),
        expiryDate: parseDate(getCellValue(row, "Expiry Date")),
        createdAt: now, updatedAt: now,
      });
    }

    // Part F — Doctor Visits (vessel is free text)
    for (const row of data.doctorVisitRows) {
      const crewUuid = linkOf(row);
      if (!crewUuid) continue;
      resolved.doctorVisits.push({
        visitUuid: uuidv4(), crewUuid,
        attachmentRef: getCellValue(row, "Attachment Ref"),
        vessel: getCellValue(row, "Vessel"),
        port: getCellValue(row, "Port"),
        visitDate: parseDate(getCellValue(row, "Visit Date")),
        doctorName: getCellValue(row, "Doctor Name"),
        clinicHospital: getCellValue(row, "Clinic/Hospital"),
        reason: getCellValue(row, "Reason"),
        doctorComments: getCellValue(row, "Doctor Comments"),
        diagnosis: getCellValue(row, "Diagnosis"),
        treatment: getCellValue(row, "Treatment"),
        followUpDate: parseDate(getCellValue(row, "Follow-Up Date")),
        createdAt: now, updatedAt: now,
      });
    }

    // Part G — Briefings
    for (const row of data.briefingRows) {
      const crewUuid = linkOf(row);
      if (!crewUuid) continue;
      const vesselName = getCellValue(row, "Vessel Name");
      resolved.briefings.push({
        briefingUuid: uuidv4(), crewUuid,
        attachmentRef: getCellValue(row, "Attachment Ref"),
        vesselUuid: resolveFromMap(maps.vessel, vesselName),
        vesselName,
        joiningRank: getCellValue(row, "Joining Rank"),
        dateSignOn: parseDate(getCellValue(row, "Date Sign On")),
        createdAt: now, updatedAt: now,
      });
    }

    // Part G — De-briefings
    for (const row of data.debriefingRows) {
      const crewUuid = linkOf(row);
      if (!crewUuid) continue;
      const vesselName = getCellValue(row, "Vessel Name");
      resolved.debriefings.push({
        debriefingUuid: uuidv4(), crewUuid,
        attachmentRef: getCellValue(row, "Attachment Ref"),
        vesselUuid: resolveFromMap(maps.vessel, vesselName),
        vesselName,
        rankServed: getCellValue(row, "Rank Served"),
        dateSignOn: parseDate(getCellValue(row, "Date Sign On")),
        dateSignedOff: parseDate(getCellValue(row, "Date Signed Off")),
        reasonForSignOff: getCellValue(row, "Reason for Sign Off"),
        createdAt: now, updatedAt: now,
      });
    }
  }

  // data.seaServiceRows is intact (original worksheet row numbers preserved).
  // summary.seaService reflects the full raw count; seaServiceDuplicateIndices
  // holds the rows we skipped during resolution.
  const summary = summaryFromParsed(data);
  const seaServiceInBatchSkipped = seaServiceDuplicateIndices.size;

  return {
    errors,
    summary,
    seafarerCodes,
    resolved,
    seaServiceInBatchSkipped,
  };
}

// ============================================================================
// VALIDATION (public) — dry run, no data written
// ============================================================================

export async function validateImportData(buffer: Buffer): Promise<ValidationResult> {
  const prepared = await prepareImport(buffer, false);
  return {
    isValid: prepared.errors.length === 0,
    summary: prepared.summary,
    errors: prepared.errors,
  };
}

// ============================================================================
// IMPORT ENGINE — transaction-based, chunked/batched, all-or-nothing
// ============================================================================

const INSERT_CHUNK_SIZE = 500;

async function batchInsert(tx: any, table: any, rows: any[]): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += INSERT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + INSERT_CHUNK_SIZE);
    if (chunk.length === 0) continue;
    await tx.insert(table).values(chunk);
    inserted += chunk.length;
  }
  return inserted;
}

export async function executeImport(buffer: Buffer): Promise<ImportResult> {
  const prepared = await prepareImport(buffer, true);

  if (prepared.errors.length > 0 || !prepared.resolved) {
    return {
      success: false,
      imported: emptyCounts(),
      expected: prepared.summary,
      seafarerCodes: [],
      errors: prepared.errors,
      seaServiceSkipped: 0,
    };
  }

  const r = prepared.resolved;
  const db = getDb();

  // Adjust expected.seaService so the post-import count verification accounts
  // for rows legitimately skipped as in-file duplicates.
  const expected: ImportCounts = {
    ...prepared.summary,
    seaService: prepared.summary.seaService - prepared.seaServiceInBatchSkipped,
  };

  try {
    return await db.transaction(async (tx: any) => {
      const counts: ImportCounts = {
        crew: await batchInsert(tx, crewMembersV2, r.crew),
        children: 0, nok: 0, documents: 0, visas: 0, licenses: 0,
        seaService: 0, training: 0, education: 0,
        medicals: 0, doctorVisits: 0, briefings: 0, debriefings: 0,
      };

      // Crew-owned one-to-one/one-to-many detail rows
      await batchInsert(tx, crewPersonalDetails, r.personal);
      await batchInsert(tx, crewAddresses, r.addresses);
      await batchInsert(tx, crewFamilyInfo, r.family);
      await batchInsert(tx, crewVesselTypesApplied, r.vesselTypesApplied);

      counts.children = await batchInsert(tx, crewChildren, r.children);
      counts.nok = await batchInsert(tx, crewNextOfKin, r.nok);
      counts.documents = await batchInsert(tx, crewDocuments, r.documents);
      counts.visas = await batchInsert(tx, crewVisas, r.visas);
      counts.licenses = await batchInsert(tx, crewLicenses, r.licenses);
      counts.seaService = await batchInsert(tx, crewSeaService, r.seaService);
      counts.training = await batchInsert(tx, crewTrainingCourses, r.training);
      counts.education = await batchInsert(tx, crewEducation, r.education);
      counts.medicals = await batchInsert(tx, crewPreJoiningMedicals, r.medicals);
      counts.doctorVisits = await batchInsert(tx, crewDoctorVisits, r.doctorVisits);
      counts.briefings = await batchInsert(tx, crewBriefings, r.briefings);
      counts.debriefings = await batchInsert(tx, crewDebriefings, r.debriefings);

      // ---- Post-import verification (inside the transaction) ----
      // Every parsed row must have been inserted. Any shortfall rolls back.
      const mismatches: string[] = [];
      (Object.keys(expected) as (keyof ImportCounts)[]).forEach((k) => {
        if (counts[k] !== expected[k]) {
          mismatches.push(`${k}: imported ${counts[k]} of ${expected[k]}`);
        }
      });
      if (mismatches.length > 0) {
        throw new Error(`Import count verification failed — ${mismatches.join("; ")}`);
      }

      return {
        success: true,
        imported: counts,
        expected,
        seafarerCodes: prepared.seafarerCodes,
        errors: [],
        seaServiceSkipped: prepared.seaServiceInBatchSkipped,
      };
    });
  } catch (error: any) {
    // Transaction rolled back — no data was written
    console.error("Crew import failed (transaction rolled back):", error);
    return {
      success: false,
      imported: emptyCounts(),
      expected,
      seafarerCodes: [],
      errors: [{
        sheet: "System",
        row: 0,
        column: "",
        value: null,
        message: `Import failed and was completely rolled back. Error: ${error.message}`,
      }],
      seaServiceSkipped: prepared.seaServiceInBatchSkipped,
    };
  }
}

// ============================================================================
// ERROR REPORT GENERATOR
// ============================================================================

export async function generateErrorReport(errors: ValidationError[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Import Errors");

  ws.columns = [
    { header: "Sheet", key: "sheet", width: 25 },
    { header: "Row", key: "row", width: 8 },
    { header: "Column", key: "column", width: 30 },
    { header: "Value", key: "value", width: 25 },
    { header: "Error Type", key: "errorType", width: 22 },
    { header: "Error Message", key: "message", width: 70 },
  ];

  // Header styling
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.eachCell(cell => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
    cell.border = { bottom: { style: "medium", color: { argb: "FF404040" } } };
  });

  const MANUAL_FILL: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC000" } }; // orange
  const STANDARD_FILL: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC7CE" } }; // light red

  for (const e of errors) {
    const isManual = e.errorType === "manual_value";
    const row = ws.addRow({
      sheet: e.sheet,
      row: e.row,
      column: e.column,
      value: e.value || "",
      errorType: isManual ? "Unrecognized manual value" : "Data error",
      message: e.message,
    });
    row.eachCell(cell => {
      cell.fill = isManual ? MANUAL_FILL : STANDARD_FILL;
    });
  }

  // Legend
  ws.addRow([]);
  const legendTitle = ws.addRow(["Legend"]);
  legendTitle.font = { bold: true };
  const legendManual = ws.addRow(["Orange = Manually typed value not found in dropdown/master list. Not imported — pick a valid value or ask an admin to add it to master data."]);
  legendManual.getCell(1).fill = MANUAL_FILL;
  const legendStandard = ws.addRow(["Red = Other data error (missing required field, invalid date format, duplicate, etc.)"]);
  legendStandard.getCell(1).fill = STANDARD_FILL;

  const xlsxBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(xlsxBuffer);
}
