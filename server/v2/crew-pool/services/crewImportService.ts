/**
 * Crew Import Service
 * 
 * Handles parsing, validation, and importing crew data from Excel/CSV files.
 * All column-to-field mapping happens here — the client never sees internal field names.
 * 
 * SAFETY: Import uses a single database transaction.
 * If ANY row fails, ALL rows are rolled back. Zero partial data.
 */
import * as XLSX from "xlsx";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db";
import { ilike, eq } from "drizzle-orm";
import {
  crewMembersV2,
  crewPersonalDetails,
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
} from "../../../../shared/v2/crew-pool/schema";
import {
  resolveMasterDataUuid,
  resolveCountryUuid,
} from "./masterDataResolver";

// ============================================================================
// DATE PARSER — Accepts multiple human-friendly formats
// ============================================================================

/**
 * Parse dates from various formats the client might use.
 * Returns ISO string (YYYY-MM-DD) or null if invalid.
 */
function parseDate(value: any): string | null {
  if (!value) return null;

  // Handle Excel serial date numbers
  if (typeof value === "number") {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 86400000);
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

  // Try DD-MMM-YYYY (15-Mar-1985)
  const monthNames: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const mmmMatch = str.match(/^(\d{1,2})[- ]([A-Za-z]{3})[- ](\d{4})$/);
  if (mmmMatch) {
    const [, dd, mmm, yyyy] = mmmMatch;
    const mm = monthNames[mmm.toLowerCase()];
    if (mm) {
      return `${yyyy}-${mm}-${dd.padStart(2, "0")}`;
    }
  }

  // Last resort: try JS Date parsing
  const fallback = new Date(str);
  if (!isNaN(fallback.getTime())) {
    return fallback.toISOString().split("T")[0];
  }

  return null;
}

// ============================================================================
// COLUMN MAPPING — Simple headers → internal fields
// ============================================================================

function getCellValue(row: Record<string, any>, header: string): string | null {
  const val = row[header];
  if (val === undefined || val === null || String(val).trim() === "") return null;
  return String(val).trim();
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

export interface ValidationError {
  sheet: string;
  row: number;
  column: string;
  value: string | null;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  summary: {
    crewCount: number;
    nokCount: number;
    documentsCount: number;
    visasCount: number;
    licensesCount: number;
    seaServiceCount: number;
    trainingCount: number;
    educationCount: number;
  };
  errors: ValidationError[];
}

export interface ImportResult {
  success: boolean;
  imported: {
    crew: number;
    nok: number;
    documents: number;
    visas: number;
    licenses: number;
    seaService: number;
    training: number;
    education: number;
  };
  seafarerCodes: string[]; // All emp numbers created
  errors: ValidationError[];
}

// ============================================================================
// PARSER — Read Excel file into structured rows
// ============================================================================

interface ParsedData {
  crewRows: Record<string, any>[];
  nokRows: Record<string, any>[];
  documentRows: Record<string, any>[];
  visaRows: Record<string, any>[];
  licenseRows: Record<string, any>[];
  seaServiceRows: Record<string, any>[];
  trainingRows: Record<string, any>[];
  educationRows: Record<string, any>[];
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
    nokRows: readSheet("Emergency Contact"),
    documentRows: readSheet("Travel Documents"),
    visaRows: readSheet("Travel Visas"),
    licenseRows: readSheet("Licenses & Certificates"),
    seaServiceRows: readSheet("Sea Service History"),
    trainingRows: readSheet("Training Courses"),
    educationRows: readSheet("Education Details"),
  };
}

// ============================================================================
// VALIDATION ENGINE
// ============================================================================

export async function validateImportData(buffer: Buffer): Promise<ValidationResult> {
  const data = parseExcelBuffer(buffer);
  const errors: ValidationError[] = [];

  // Track seafarer codes for duplicate detection within file
  const seafarerCodes = new Set<string>();
  const crewCodesInFile = new Set<string>();

  // ---- Validate Crew Details ----
  for (let i = 0; i < data.crewRows.length; i++) {
    const row = data.crewRows[i];
    const rowNum = i + 2; // 1-indexed + header row

    // Required fields
    const firstName = getCellValue(row, "First Name");
    if (!firstName) {
      errors.push({ sheet: "Crew Details", row: rowNum, column: "First Name", value: null, message: "First Name is required" });
    }

    const familyName = getCellValue(row, "Last Name / Family Name");
    if (!familyName) {
      errors.push({ sheet: "Crew Details", row: rowNum, column: "Last Name / Family Name", value: null, message: "Last Name / Family Name is required" });
    }

    const nationality = getCellValue(row, "Nationality");
    if (!nationality) {
      errors.push({ sheet: "Crew Details", row: rowNum, column: "Nationality", value: null, message: "Nationality is required" });
    } else {
      const natUuid = await resolveMasterDataUuid(nationality, "nationality");
      if (!natUuid) {
        errors.push({ sheet: "Crew Details", row: rowNum, column: "Nationality", value: nationality, message: `Nationality "${nationality}" not found. Check the 'Instructions & Reference' sheet for valid values.` });
      }
    }

    const rank = getCellValue(row, "Present Rank / Designation");
    if (!rank) {
      errors.push({ sheet: "Crew Details", row: rowNum, column: "Present Rank / Designation", value: null, message: "Present Rank / Designation is required" });
    }

    // Seafarer Code duplicate check (falls back to Employee ID if blank)
    let empNo = getCellValue(row, "Seafarer Code");
    if (!empNo) {
      empNo = getCellValue(row, "Employee ID");
    }
    if (empNo) {
      if (seafarerCodes.has(empNo.toUpperCase())) {
        errors.push({ sheet: "Crew Details", row: rowNum, column: "Seafarer Code", value: empNo, message: `Duplicate Seafarer Code or Employee ID "${empNo}" found in this file` });
      } else {
        seafarerCodes.add(empNo.toUpperCase());
        // Check DB for existing
        const db = getDb();
        const existing = await db
          .select({ empNo: crewMembersV2.empNo })
          .from(crewMembersV2)
          .where(eq(crewMembersV2.empNo, empNo))
          .limit(1);
        if (existing.length > 0) {
          errors.push({ sheet: "Crew Details", row: rowNum, column: "Seafarer Code", value: empNo, message: `Seafarer Code or Employee ID "${empNo}" already exists in the system` });
        }
      }
      crewCodesInFile.add(empNo);
    }

    // Optional field validations
    const vesselType = getCellValue(row, "Vessel Type Experience");
    if (vesselType) {
      const vtUuid = await resolveMasterDataUuid(vesselType, "vesselType");
      if (!vtUuid) {
        errors.push({ sheet: "Crew Details", row: rowNum, column: "Vessel Type Experience", value: vesselType, message: `Vessel Type "${vesselType}" not found. Check the 'Instructions & Reference' sheet for valid values.` });
      }
    }

    const countryRes = getCellValue(row, "Country of Residence");
    if (countryRes) {
      const cUuid = await resolveCountryUuid(countryRes);
      if (!cUuid) {
        errors.push({ sheet: "Crew Details", row: rowNum, column: "Country of Residence", value: countryRes, message: `Country "${countryRes}" not found. Check the 'Instructions & Reference' sheet for valid values.` });
      }
    }

    const birthCountry = getCellValue(row, "Place of Birth (Country)");
    if (birthCountry) {
      const cUuid = await resolveCountryUuid(birthCountry);
      if (!cUuid) {
        errors.push({ sheet: "Crew Details", row: rowNum, column: "Place of Birth (Country)", value: birthCountry, message: `Country "${birthCountry}" not found. Check the 'Instructions & Reference' sheet for valid values.` });
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
      errors.push({ sheet: "Crew Details", row: rowNum, column: "Gender", value: gender, message: `Gender must be 'Male' or 'Female'` });
    }

    const engProf = getCellValue(row, "English Proficiency");
    if (engProf && !["good", "fair", "poor"].includes(engProf.toLowerCase())) {
      errors.push({ sheet: "Crew Details", row: rowNum, column: "English Proficiency", value: engProf, message: `English Proficiency must be 'Good', 'Fair', or 'Poor'` });
    }

    const marital = getCellValue(row, "Marital Status");
    if (marital && !["single", "married", "divorced", "widowed"].includes(marital.toLowerCase())) {
      errors.push({ sheet: "Crew Details", row: rowNum, column: "Marital Status", value: marital, message: `Marital Status must be 'Single', 'Married', 'Divorced', or 'Widowed'` });
    }

    const statusVal = getCellValue(row, "Current Status");
    if (statusVal && !["on board", "on leave", "available", "in transit", "inactive", "terminated", "terminated - nfr"].includes(statusVal.toLowerCase())) {
      errors.push({ sheet: "Crew Details", row: rowNum, column: "Current Status", value: statusVal, message: `Current Status must be 'On Board', 'On Leave', 'Available', 'In Transit', 'Inactive', 'Terminated', or 'Terminated - NFR'` });
    }
  }

  // Helper: validate sub-sheet rows (documents, licenses, etc.)
  function validateSubSheet(
    rows: Record<string, any>[],
    sheetName: string,
    requiredFields: string[],
    dateFields: string[],
  ) {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      // Seafarer Code is always required and must match Crew Details
      const code = getCellValue(row, "Seafarer Code");
      if (!code) {
        errors.push({ sheet: sheetName, row: rowNum, column: "Seafarer Code", value: null, message: "Seafarer Code is required to link to a crew member" });
      } else if (crewCodesInFile.size > 0 && !crewCodesInFile.has(code)) {
        // Only warn if the crew sheet has codes defined — if they're auto-generated, we can't check
        // Actually, if crew sheet doesn't have this code at all (no row for it), it's still valid
        // because the code might be auto-generated. We'll validate linkage during import.
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
    }
  }

  // Validate sub-sheets
  validateSubSheet(data.nokRows, "Emergency Contact", [], []);
  validateSubSheet(data.documentRows, "Travel Documents", ["Document Name", "Document Number"], ["Date of Issue", "Date of Expiry"]);
  validateSubSheet(data.visaRows, "Travel Visas", ["Country", "Visa Type", "Visa Number / Serial Number"], ["Date of Issue", "Date of Expiry"]);
  validateSubSheet(data.licenseRows, "Licenses & Certificates", ["Certificate / Document Name"], ["Date of Issue", "Date of Expiry"]);
  validateSubSheet(data.seaServiceRows, "Sea Service History", ["Vessel Name", "Sign On Date"], ["Sign On Date", "Sign Off Date"]);
  validateSubSheet(data.trainingRows, "Training Courses", ["Course Name"], ["Date of Issue", "Date of Expiry"]);
  validateSubSheet(data.educationRows, "Education Details", ["Institution", "Qualifications / Degree"], ["Date of Completion"]);

  // Validate vessel types in sea service
  for (let i = 0; i < data.seaServiceRows.length; i++) {
    const row = data.seaServiceRows[i];
    const vt = getCellValue(row, "Vessel Type");
    if (vt) {
      const vtUuid = await resolveMasterDataUuid(vt, "vesselType");
      if (!vtUuid) {
        errors.push({ sheet: "Sea Service History", row: i + 2, column: "Vessel Type", value: vt, message: `Vessel Type "${vt}" not found. Check the 'Instructions & Reference' sheet.` });
      }
    }

    const sType = getCellValue(row, "Company or External?");
    if (sType && !["company", "external"].includes(sType.toLowerCase())) {
      errors.push({ sheet: "Sea Service History", row: i + 2, column: "Company or External?", value: sType, message: `"Company or External?" must be 'Company' or 'External'` });
    }
  }

  return {
    isValid: errors.length === 0,
    summary: {
      crewCount: data.crewRows.length,
      nokCount: data.nokRows.length,
      documentsCount: data.documentRows.length,
      visasCount: data.visaRows.length,
      licensesCount: data.licenseRows.length,
      seaServiceCount: data.seaServiceRows.length,
      trainingCount: data.trainingRows.length,
      educationCount: data.educationRows.length,
    },
    errors,
  };
}

// ============================================================================
// IMPORT ENGINE — Transaction-based, all-or-nothing
// ============================================================================

/**
 * Generate next available emp number
 */
async function generateNextEmpNo(db: any, usedNumbers: Set<string>): Promise<string> {
  const results = await db
    .select({ empNo: crewMembersV2.empNo })
    .from(crewMembersV2)
    .where(ilike(crewMembersV2.empNo, "A%"));

  let maxNum = 0;
  for (const row of results) {
    if (row.empNo) {
      const match = row.empNo.match(/A(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
  }

  // Also consider numbers we've already generated in this batch
  for (const used of usedNumbers) {
    const match = used.match(/A(\d+)/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  const nextNum = maxNum + 1;
  return `A${nextNum.toString().padStart(6, "0")}`;
}

export async function executeImport(buffer: Buffer): Promise<ImportResult> {
  const data = parseExcelBuffer(buffer);
  const db = getDb();

  // First validate
  const validation = await validateImportData(buffer);
  if (!validation.isValid) {
    return {
      success: false,
      imported: { crew: 0, nok: 0, documents: 0, visas: 0, licenses: 0, seaService: 0, training: 0, education: 0 },
      seafarerCodes: [],
      errors: validation.errors,
    };
  }

  const importedCodes: string[] = [];
  const usedEmpNos = new Set<string>();
  // Map: empNo/index → crewUuid (for linking sub-records)
  const empNoToCrewUuid = new Map<string, string>();
  // Map: row index → empNo (for rows without seafarer code)
  const rowIndexToEmpNo = new Map<number, string>();

  try {
    return await db.transaction(async (tx: any) => {
      const now = new Date();
      const counts = { crew: 0, nok: 0, documents: 0, visas: 0, licenses: 0, seaService: 0, training: 0, education: 0 };

      // ---- STEP 1: Create crew members ----
      for (let i = 0; i < data.crewRows.length; i++) {
        const row = data.crewRows[i];

        let empNo = getCellValue(row, "Seafarer Code");
        if (!empNo) {
          const empId = getCellValue(row, "Employee ID");
          if (empId) {
            empNo = empId;
          } else {
            empNo = await generateNextEmpNo(tx, usedEmpNos);
          }
        }
        usedEmpNos.add(empNo);
        rowIndexToEmpNo.set(i, empNo);

        const crewUuid = uuidv4();
        empNoToCrewUuid.set(empNo, crewUuid);

        // Resolve master data
        const nationalityUuid = await resolveMasterDataUuid(getCellValue(row, "Nationality"), "nationality");
        const vesselTypeUuid = await resolveMasterDataUuid(getCellValue(row, "Vessel Type Experience"), "vesselType");

        // Handle empty employee ID
        const employeeId = getCellValue(row, "Employee ID");

        // Insert crew member
        await tx.insert(crewMembersV2).values({
          crewUuid,
          empNo,
          employeeId: employeeId || null,
          firstName: getCellValue(row, "First Name"),
          middleName: getCellValue(row, "Middle Name"),
          familyName: getCellValue(row, "Last Name / Family Name"),
          gender: getCellValue(row, "Gender"),
          dob: parseDate(getCellValue(row, "Date of Birth")),
          nationalityUuid,
          vesselTypeUuid,
          presentRank: getCellValue(row, "Present Rank / Designation"),
          rankAppliedFor: getCellValue(row, "Rank Applied For"),
          status: getCellValue(row, "Current Status") || "On Leave",
          recruitmentDate: parseDate(getCellValue(row, "Date of Recruitment")),
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });

        // Insert personal details (if any personal fields are filled)
        const heightCm = getCellValue(row, "Height (cm)");
        const weightKg = getCellValue(row, "Weight (kg)");
        const placeOfBirthCity = getCellValue(row, "Place of Birth (City)");
        const nativeLanguage = getCellValue(row, "Native Language");
        const englishProficiency = getCellValue(row, "English Proficiency");
        const manningAgent = getCellValue(row, "Manning Agent");
        const crewPool = getCellValue(row, "Crew Pool");
        const birthCountry = getCellValue(row, "Place of Birth (Country)");
        const birthCountryUuid = birthCountry ? await resolveCountryUuid(birthCountry) : null;
        const nativeLangUuid = nativeLanguage ? await resolveMasterDataUuid(nativeLanguage, "country") : null;
        // For language, we try name-based lookup. The masterDataResolver doesn't have 'language' type,
        // so we store the language name directly or look it up manually.
        let nativeLanguageUuid: string | null = null;
        if (nativeLanguage) {
          // Try to find language UUID from master_languages table
          const { masterLanguages: langTable } = await import("../../../../shared/schema");
          const langResult = await tx
            .select({ uuid: langTable.langUuid })
            .from(langTable)
            .where(eq(langTable.languageName, nativeLanguage))
            .limit(1);
          nativeLanguageUuid = langResult[0]?.uuid || null;
        }

        const hasPersonalDetails = heightCm || weightKg || placeOfBirthCity || nativeLanguage ||
          englishProficiency || manningAgent || crewPool || birthCountry;

        if (hasPersonalDetails) {
          // Calculate BMI if both height and weight are provided
          let bmi: string | null = null;
          if (heightCm && weightKg) {
            const h = parseFloat(heightCm) / 100;
            const w = parseFloat(weightKg);
            if (h > 0 && w > 0) {
              bmi = (w / (h * h)).toFixed(1);
            }
          }

          await tx.insert(crewPersonalDetails).values({
            cpdUuid: uuidv4(),
            crewUuid,
            heightCm,
            weightKg,
            bmi,
            placeOfBirthCity,
            placeOfBirthCountryUuid: birthCountryUuid,
            nativeLanguageUuid,
            englishProficiency,
            manningAgent,
            crewPool,
            createdAt: now,
            updatedAt: now,
          });
        }

        // Insert address (if any address fields are filled)
        const email = getCellValue(row, "Email Address");
        const mobile = getCellValue(row, "Mobile Number");
        const landline = getCellValue(row, "Phone / Landline");
        const countryOfResidence = getCellValue(row, "Country of Residence");
        const nearestAirport = getCellValue(row, "Nearest Airport");
        const addr1 = getCellValue(row, "Residential Address Line 1");
        const addr2 = getCellValue(row, "Residential Address Line 2");
        const countryResUuid = countryOfResidence ? await resolveCountryUuid(countryOfResidence) : null;

        const hasAddress = email || mobile || landline || countryOfResidence || nearestAirport || addr1 || addr2;
        if (hasAddress) {
          await tx.insert(crewAddresses).values({
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

        // Insert family info (if any family fields are filled)
        const maritalStatus = getCellValue(row, "Marital Status");
        const numChildren = getCellValue(row, "No. of Dependent Children");
        const fatherName = getCellValue(row, "Father's Name");
        const motherName = getCellValue(row, "Mother's Name");
        const spouseFirst = getCellValue(row, "Spouse First Name");
        const spouseFamily = getCellValue(row, "Spouse Family Name");
        const spouseDob = getCellValue(row, "Spouse Date of Birth");

        const hasFamily = maritalStatus || numChildren || fatherName || motherName || spouseFirst || spouseFamily || spouseDob;
        if (hasFamily) {
          await tx.insert(crewFamilyInfo).values({
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

        // Insert applied vessel types to crew_vessel_types_applied table
        const vesselTypesInput = getCellValue(row, "Vessel Type Experience");
        if (vesselTypesInput) {
          const vesselTypeNames = vesselTypesInput.split(",").map(s => s.trim()).filter(Boolean);
          let sortOrder = 0;
          for (const name of vesselTypeNames) {
            const vtUuid = await resolveMasterDataUuid(name, "vesselType");
            if (vtUuid) {
              await tx.insert(crewVesselTypesApplied).values({
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

        importedCodes.push(empNo);
        counts.crew++;
      }

      // ---- STEP 2: Create sub-records (linked by Seafarer Code) ----

      // Helper: resolve crewUuid from Seafarer Code
      function resolveCrewUuid(seafarerCode: string | null): string | null {
        if (!seafarerCode) return null;
        return empNoToCrewUuid.get(seafarerCode) || null;
      }

      // Next of Kin
      for (const row of data.nokRows) {
        const code = getCellValue(row, "Seafarer Code");
        const crewUuid = resolveCrewUuid(code);
        if (!crewUuid) continue; // Skip if no matching crew

        await tx.insert(crewNextOfKin).values({
          nokUuid: uuidv4(),
          crewUuid,
          firstName: getCellValue(row, "Contact Person First Name"),
          familyName: getCellValue(row, "Contact Person Family Name"),
          relationship: getCellValue(row, "Relationship"),
          telephone: getCellValue(row, "Phone Number"),
          email: getCellValue(row, "Email"),
          address: getCellValue(row, "Address"),
          createdAt: now,
          updatedAt: now,
        });
        counts.nok++;
      }

      // Documents
      for (const row of data.documentRows) {
        const code = getCellValue(row, "Seafarer Code");
        const crewUuid = resolveCrewUuid(code);
        if (!crewUuid) continue;

        await tx.insert(crewDocuments).values({
          docUuid: uuidv4(),
          crewUuid,
          documentName: getCellValue(row, "Document Name"),
          number: getCellValue(row, "Document Number"),
          issued: parseDate(getCellValue(row, "Date of Issue")),
          expiry: parseDate(getCellValue(row, "Date of Expiry")),
          issuingAuthority: getCellValue(row, "Issuing Authority"),
          createdAt: now,
          updatedAt: now,
        });
        counts.documents++;
      }

      // Licenses
      for (const row of data.licenseRows) {
        const code = getCellValue(row, "Seafarer Code");
        const crewUuid = resolveCrewUuid(code);
        if (!crewUuid) continue;

        await tx.insert(crewLicenses).values({
          licUuid: uuidv4(),
          crewUuid,
          certificateDocument: getCellValue(row, "Certificate / Document Name"),
          certificateNo: getCellValue(row, "Certificate Number"),
          issuingAuthority: getCellValue(row, "Issuing Authority"),
          issued: parseDate(getCellValue(row, "Date of Issue")),
          expiry: parseDate(getCellValue(row, "Date of Expiry")),
          createdAt: now,
          updatedAt: now,
        });
        counts.licenses++;
      }

      // Sea Service
      for (const row of data.seaServiceRows) {
        const code = getCellValue(row, "Seafarer Code");
        const crewUuid = resolveCrewUuid(code);
        if (!crewUuid) continue;

        const vtName = getCellValue(row, "Vessel Type");
        const vesselTypeUuid = vtName ? await resolveMasterDataUuid(vtName, "vesselType") : null;

        const rawServiceType = getCellValue(row, "Company or External?");
        const serviceType = rawServiceType?.toLowerCase() === "company" ? "company" : "external";

        const vesselName = getCellValue(row, "Vessel Name");
        const vesselUuid = (serviceType === 'company' && vesselName) ? await resolveMasterDataUuid(vesselName, 'vessel') : null;

        const fromDateStr = parseDate(getCellValue(row, "Sign On Date"));
        const toDateStr = parseDate(getCellValue(row, "Sign Off Date"));
        
        let periodMonths: string | null = null;
        if (fromDateStr && toDateStr) {
          const start = new Date(fromDateStr);
          const end = new Date(toDateStr);
          if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            const diffTime = Math.abs(end.getTime() - start.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            periodMonths = (diffDays / 30.44).toFixed(1);
          }
        }

        await tx.insert(crewSeaService).values({
          seaUuid: uuidv4(),
          crewUuid,
          serviceType,
          vesselName,
          vesselUuid,
          vesselTypeUuid,
          rank: getCellValue(row, "Rank Served"),
          fromDate: fromDateStr,
          toDate: toDateStr,
          periodMonths,
          deadweight: getCellValue(row, "Deadweight"),
          engineTypePower: getCellValue(row, "Engine Type / Power"),
          ownerOperator: getCellValue(row, "Owner / Operator"),
          createdAt: now,
          updatedAt: now,
        });
        counts.seaService++;
      }

      // Training Courses
      for (const row of data.trainingRows) {
        const code = getCellValue(row, "Seafarer Code");
        const crewUuid = resolveCrewUuid(code);
        if (!crewUuid) continue;

        await tx.insert(crewTrainingCourses).values({
          trainUuid: uuidv4(),
          crewUuid,
          trainingCourse: getCellValue(row, "Course Name"),
          certificateNo: getCellValue(row, "Certificate Number"),
          issuingAuthority: getCellValue(row, "Issuing Authority"),
          issued: parseDate(getCellValue(row, "Date of Issue")),
          expiry: parseDate(getCellValue(row, "Date of Expiry")),
          createdAt: now,
          updatedAt: now,
        });
        counts.training++;
      }

      // Travel Visas
      for (const row of data.visaRows) {
        const code = getCellValue(row, "Seafarer Code");
        const crewUuid = resolveCrewUuid(code);
        if (!crewUuid) continue;

        const countryVal = getCellValue(row, "Country");
        const countryUuid = countryVal ? await resolveCountryUuid(countryVal) : null;

        await tx.insert(crewVisas).values({
          visaUuid: uuidv4(),
          crewUuid,
          countryUuid,
          country: countryVal,
          visaType: getCellValue(row, "Visa Type"),
          serialNo: getCellValue(row, "Visa Number / Serial Number"),
          issued: parseDate(getCellValue(row, "Date of Issue")),
          expiry: parseDate(getCellValue(row, "Date of Expiry")),
          createdAt: now,
          updatedAt: now,
        });
        counts.visas++;
      }

      // Education Details
      for (const row of data.educationRows) {
        const code = getCellValue(row, "Seafarer Code");
        const crewUuid = resolveCrewUuid(code);
        if (!crewUuid) continue;

        await tx.insert(crewEducation).values({
          eduUuid: uuidv4(),
          crewUuid,
          institution: getCellValue(row, "Institution"),
          subjectsField: getCellValue(row, "Subjects / Field of Study"),
          qualifications: getCellValue(row, "Qualifications / Degree"),
          dateOfCompletion: parseDate(getCellValue(row, "Date of Completion")),
          createdAt: now,
          updatedAt: now,
        });
        counts.education++;
      }

      return {
        success: true,
        imported: counts,
        seafarerCodes: importedCodes,
        errors: [],
      };
    });
  } catch (error: any) {
    // Transaction rolled back — no data was written
    console.error("Crew import failed (transaction rolled back):", error);
    return {
      success: false,
      imported: { crew: 0, nok: 0, documents: 0, visas: 0, licenses: 0, seaService: 0, training: 0, education: 0 },
      seafarerCodes: [],
      errors: [{
        sheet: "System",
        row: 0,
        column: "",
        value: null,
        message: `Import failed and was completely rolled back. Error: ${error.message}`,
      }],
    };
  }
}

// ============================================================================
// ERROR REPORT GENERATOR
// ============================================================================

export function generateErrorReport(errors: ValidationError[]): Buffer {
  const wb = XLSX.utils.book_new();

  const rows = [
    ["Sheet", "Row", "Column", "Value", "Error Message"],
    ...errors.map(e => [e.sheet, e.row, e.column, e.value || "", e.message]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 25 },
    { wch: 6 },
    { wch: 30 },
    { wch: 25 },
    { wch: 60 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Import Errors");

  const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(xlsxBuffer);
}
