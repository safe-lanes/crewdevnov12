/**
 * Crew Import Template Generator
 * 
 * Generates a user-friendly Excel template for client data migration.
 * All column headers use plain English — internal field mapping is handled
 * by the import service (crewImportService.ts).
 */
import XLSX from "xlsx-js-style";
import { getDb } from "../../db";
import {
  masterNationalities,
  masterVesselTypes,
  masterCountries,
  masterLanguages,
} from "../../../../shared/schema";
import { eq } from "drizzle-orm";

// ============================================================================
// SHEET DEFINITIONS — Column headers the client sees
// ============================================================================

export const CREW_DETAILS_COLUMNS = [
  { header: "Seafarer Code", required: false, example: "A000001", note: "Leave blank for auto-generation" },
  { header: "Employee ID", required: false, example: "EMP-2024-001", note: "" },
  { header: "First Name", required: true, example: "Rajesh", note: "" },
  { header: "Middle Name", required: false, example: "Kumar", note: "" },
  { header: "Last Name / Family Name", required: true, example: "Sharma", note: "" },
  { header: "Gender", required: false, example: "Male", note: "Male / Female" },
  { header: "Date of Birth", required: false, example: "15-Mar-1985", note: "DD-MMM-YYYY or DD/MM/YYYY" },
  { header: "Nationality", required: true, example: "Indian", note: "Must match Reference Data sheet" },
  { header: "Present Rank / Designation", required: true, example: "Master", note: "" },
  { header: "Rank Applied For", required: false, example: "Chief Officer", note: "" },
  { header: "Vessel Type Experience", required: false, example: "Oil Tanker", note: "Must match Reference Data sheet" },
  { header: "Current Status", required: false, example: "On Leave", note: "On Board / On Leave" },
  { header: "Email Address", required: false, example: "rajesh@email.com", note: "" },
  { header: "Mobile Number", required: false, example: "+91-9876543210", note: "" },
  { header: "Phone / Landline", required: false, example: "022-12345678", note: "" },
  { header: "Country of Residence", required: false, example: "India", note: "Must match Reference Data sheet" },
  { header: "Nearest Airport", required: false, example: "Mumbai (BOM)", note: "" },
  { header: "Residential Address Line 1", required: false, example: "123 Marine Drive", note: "" },
  { header: "Residential Address Line 2", required: false, example: "Colaba, Mumbai", note: "" },
  { header: "Place of Birth (City)", required: false, example: "Mumbai", note: "" },
  { header: "Place of Birth (Country)", required: false, example: "India", note: "Must match Reference Data sheet" },
  { header: "Height (cm)", required: false, example: "175", note: "" },
  { header: "Weight (kg)", required: false, example: "72", note: "" },
  { header: "Native Language", required: false, example: "Hindi", note: "Must match Reference Data sheet" },
  { header: "English Proficiency", required: false, example: "Good", note: "Good / Fair / Poor" },
  { header: "Marital Status", required: false, example: "Married", note: "Single / Married / Divorced / Widowed" },
  { header: "No. of Dependent Children", required: false, example: "2", note: "" },
  { header: "Manning Agent", required: false, example: "ABC Manning", note: "" },
  { header: "Crew Pool", required: false, example: "Pool A", note: "" },
  { header: "Date of Recruitment", required: true, example: "01-Jan-2024", note: "DD-MMM-YYYY or DD/MM/YYYY" },
  { header: "Father's Name", required: false, example: "Suresh Sharma", note: "" },
  { header: "Mother's Name", required: false, example: "Anita Sharma", note: "" },
  { header: "Spouse First Name", required: false, example: "Priya", note: "" },
  { header: "Spouse Family Name", required: false, example: "Sharma", note: "" },
  { header: "Spouse Date of Birth", required: false, example: "20-Jun-1988", note: "DD-MMM-YYYY or DD/MM/YYYY" },
];

export const NOK_COLUMNS = [
  { header: "Seafarer Code", required: true, example: "A000001", note: "Must match Crew Details sheet" },
  { header: "Contact Person First Name", required: false, example: "Priya", note: "" },
  { header: "Contact Person Family Name", required: false, example: "Sharma", note: "" },
  { header: "Relationship", required: false, example: "Spouse", note: "" },
  { header: "Phone Number", required: false, example: "+91-9876543211", note: "" },
  { header: "Email", required: false, example: "priya@email.com", note: "" },
  { header: "Address", required: false, example: "123 Marine Drive, Mumbai", note: "" },
];

export const DOCUMENTS_COLUMNS = [
  { header: "Seafarer Code", required: true, example: "A000001", note: "Must match Crew Details sheet" },
  { header: "Document Name", required: true, example: "Passport", note: "" },
  { header: "Document Number", required: true, example: "J1234567", note: "" },
  { header: "Date of Issue", required: false, example: "15-Jan-2020", note: "DD-MMM-YYYY or DD/MM/YYYY" },
  { header: "Date of Expiry", required: false, example: "14-Jan-2030", note: "DD-MMM-YYYY or DD/MM/YYYY" },
  { header: "Issuing Authority", required: false, example: "Govt of India", note: "" },
];

export const LICENSES_COLUMNS = [
  { header: "Seafarer Code", required: true, example: "A000001", note: "Must match Crew Details sheet" },
  { header: "Certificate / Document Name", required: true, example: "COC Deck", note: "" },
  { header: "Certificate Number", required: false, example: "COC-12345", note: "" },
  { header: "Issuing Authority", required: false, example: "DG Shipping", note: "" },
  { header: "Date of Issue", required: false, example: "01-Jun-2019", note: "DD-MMM-YYYY or DD/MM/YYYY" },
  { header: "Date of Expiry", required: false, example: "01-Jun-2024", note: "DD-MMM-YYYY or DD/MM/YYYY" },
];

export const SEA_SERVICE_COLUMNS = [
  { header: "Seafarer Code", required: true, example: "A000001", note: "Must match Crew Details sheet" },
  { header: "Company or External?", required: false, example: "Company", note: "Company / External" },
  { header: "Vessel Name", required: true, example: "MT Pacific Star", note: "" },
  { header: "Vessel Type", required: false, example: "Oil Tanker", note: "Must match Reference Data sheet" },
  { header: "Rank Served", required: false, example: "Chief Officer", note: "" },
  { header: "Sign On Date", required: true, example: "15-Jan-2022", note: "DD-MMM-YYYY or DD/MM/YYYY" },
  { header: "Sign Off Date", required: false, example: "15-Jul-2022", note: "DD-MMM-YYYY or DD/MM/YYYY" },
  { header: "Owner / Operator", required: false, example: "Pacific Shipping", note: "" },
  { header: "Deadweight", required: false, example: "50000", note: "DWT (Number)" },
  { header: "Engine Type / Power", required: false, example: "MAN B&W 6S60MC", note: "" },
];

export const TRAINING_COLUMNS = [
  { header: "Seafarer Code", required: true, example: "A000001", note: "Must match Crew Details sheet" },
  { header: "Course Name", required: true, example: "STCW Basic Safety", note: "" },
  { header: "Certificate Number", required: false, example: "TC-98765", note: "" },
  { header: "Issuing Authority", required: false, example: "Maritime Academy", note: "" },
  { header: "Date of Issue", required: false, example: "20-Mar-2021", note: "DD-MMM-YYYY or DD/MM/YYYY" },
  { header: "Date of Expiry", required: false, example: "19-Mar-2026", note: "DD-MMM-YYYY or DD/MM/YYYY" },
];

export const VISAS_COLUMNS = [
  { header: "Seafarer Code", required: true, example: "A000001", note: "Must match Crew Details sheet" },
  { header: "Country", required: true, example: "United States", note: "Must match Reference Data sheet" },
  { header: "Visa Type", required: true, example: "C1/D", note: "" },
  { header: "Visa Number / Serial Number", required: true, example: "V9876543", note: "" },
  { header: "Date of Issue", required: false, example: "15-Jan-2023", note: "DD-MMM-YYYY or DD/MM/YYYY" },
  { header: "Date of Expiry", required: false, example: "14-Jan-2028", note: "DD-MMM-YYYY or DD/MM/YYYY" },
];

export const EDUCATION_COLUMNS = [
  { header: "Seafarer Code", required: true, example: "A000001", note: "Must match Crew Details sheet" },
  { header: "Institution", required: true, example: "Maritime Academy", note: "" },
  { header: "Subjects / Field of Study", required: false, example: "Marine Engineering", note: "" },
  { header: "Qualifications / Degree", required: true, example: "Bachelor of Science", note: "" },
  { header: "Date of Completion", required: false, example: "15-May-2010", note: "DD-MMM-YYYY or DD/MM/YYYY" },
];

// ============================================================================
// TEMPLATE BUILDER
// ============================================================================

/**
 * Fetch reference data from master tables for the Instructions sheet
 */
async function fetchReferenceData() {
  const db = getDb();

  const [nationalities, vesselTypes, countries, languages] = await Promise.all([
    db.select({ name: masterNationalities.nationality }).from(masterNationalities).where(eq(masterNationalities.isDeleted, false)),
    db.select({ name: masterVesselTypes.vesselType }).from(masterVesselTypes).where(eq(masterVesselTypes.isDeleted, false)),
    db.select({ name: masterCountries.countryName }).from(masterCountries).where(eq(masterCountries.isDeleted, false)),
    db.select({ name: masterLanguages.languageName }).from(masterLanguages).where(eq(masterLanguages.isDeleted, false)),
  ]);

  return {
    nationalities: nationalities.map((n: { name: string | null }) => n.name).filter(Boolean).sort() as string[],
    vesselTypes: vesselTypes.map((v: { name: string | null }) => v.name).filter(Boolean).sort() as string[],
    countries: countries.map((c: { name: string | null }) => c.name).filter(Boolean).sort() as string[],
    languages: languages.map((l: { name: string | null }) => l.name).filter(Boolean).sort() as string[],
  };
}

/**
 * Build a data sheet with headers + example row
 */
function buildDataSheet(
  columns: typeof CREW_DETAILS_COLUMNS,
): XLSX.WorkSheet {
  // Row 1: Headers
  const headers = columns.map(c => c.header);
  // Row 2: Example data
  const examples = columns.map(c => c.example);

  const ws = XLSX.utils.aoa_to_sheet([headers, examples]);

  // Set column widths
  ws["!cols"] = columns.map(c => ({
    wch: Math.max(c.header.length, c.example.length, 18) + 2,
  }));

  // Apply cell styles for header (row 0) and example data (row 1)
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  for (let c = range.s.c; c <= range.e.c; c++) {
    // Header styling
    const headerAddr = XLSX.utils.encode_cell({ r: 0, c });
    const headerCell = ws[headerAddr];
    if (headerCell) {
      const isRequired = columns[c]?.required;
      headerCell.s = {
        font: { bold: true, name: "Calibri", sz: 11 },
        fill: {
          fgColor: { rgb: isRequired ? "FFF2CC" : "F2F2F2" } // Yellow background for required, Light grey for optional
        },
        border: {
          top: { style: "thin", color: { rgb: "D9D9D9" } },
          bottom: { style: "medium", color: { rgb: "404040" } },
          left: { style: "thin", color: { rgb: "D9D9D9" } },
          right: { style: "thin", color: { rgb: "D9D9D9" } }
        },
        alignment: { vertical: "center", horizontal: "left" }
      };
    }

    // Example styling
    const exampleAddr = XLSX.utils.encode_cell({ r: 1, c });
    const exampleCell = ws[exampleAddr];
    if (exampleCell) {
      exampleCell.s = {
        font: { italic: true, color: { rgb: "7F7F7F" }, name: "Calibri", sz: 11 },
        alignment: { vertical: "center", horizontal: "left" }
      };
    }
  }

  return ws;
}

/**
 * Build the Instructions & Reference Data sheet
 */
function buildInstructionsSheet(refData: {
  nationalities: string[];
  vesselTypes: string[];
  countries: string[];
  languages: string[];
}): XLSX.WorkSheet {
  const rows: (string | undefined)[][] = [];

  // Title
  rows.push(["CREW IMPORT TEMPLATE — INSTRUCTIONS"]);
  rows.push([]);

  // General instructions
  rows.push(["HOW TO USE THIS TEMPLATE"]);
  rows.push(["1. Fill in the 'Crew Details' sheet first — one row per crew member"]);
  rows.push(["2. Use the Seafarer Code column to link data across sheets (Documents, Licenses, etc.)"]);
  rows.push(["3. Leave Seafarer Code blank for new crew — the system will auto-generate one"]);
  rows.push(["4. If you provide a Seafarer Code, it must be unique across all rows"]);
  rows.push(["5. Required columns are marked with yellow background in each sheet"]);
  rows.push(["6. Dates can be in these formats: DD-MMM-YYYY (15-Mar-1985), DD/MM/YYYY (15/03/1985), or YYYY-MM-DD (1985-03-15)"]);
  rows.push(["7. Row 2 in each sheet has example data — delete it before uploading"]);
  rows.push(["8. Do NOT change column headers or sheet names"]);
  rows.push([]);

  // Color legend
  rows.push(["COLOR LEGEND"]);
  rows.push(["Yellow background = Required field (must be filled)"]);
  rows.push(["White background = Optional field (can be left blank)"]);
  rows.push(["Row 2 (example) = Sample data — DELETE before uploading"]);
  rows.push([]);

  // Reference data sections
  const sections: [string, string[]][] = [
    ["VALID NATIONALITIES", refData.nationalities],
    ["VALID VESSEL TYPES", refData.vesselTypes],
    ["VALID COUNTRIES", refData.countries],
    ["VALID LANGUAGES", refData.languages],
    ["VALID GENDERS", ["Male", "Female"]],
    ["VALID ENGLISH PROFICIENCY", ["Good", "Fair", "Poor"]],
    ["VALID MARITAL STATUS", ["Single", "Married", "Divorced", "Widowed"]],
    ["VALID CURRENT STATUS", ["On Board", "On Leave", "Available", "In Transit", "Inactive", "Terminated", "Terminated - NFR"]],
  ];

  for (const [title, values] of sections) {
    rows.push([title]);
    for (const val of values) {
      rows.push(["  " + val]);
    }
    rows.push([]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 80 }];

  return ws;
}

/**
 * Generate the complete crew import template workbook
 */
export async function generateImportTemplate(): Promise<Buffer> {
  const refData = await fetchReferenceData();

  const wb = XLSX.utils.book_new();

  // Sheet 1: Instructions & Reference
  const instrSheet = buildInstructionsSheet(refData);
  XLSX.utils.book_append_sheet(wb, instrSheet, "Instructions & Reference");

  // Sheet 2: Crew Details
  const crewSheet = buildDataSheet(CREW_DETAILS_COLUMNS);
  XLSX.utils.book_append_sheet(wb, crewSheet, "Crew Details");

  // Sheet 3: Emergency Contact
  const nokSheet = buildDataSheet(NOK_COLUMNS);
  XLSX.utils.book_append_sheet(wb, nokSheet, "Emergency Contact");

  // Sheet 4: Travel Documents
  const docsSheet = buildDataSheet(DOCUMENTS_COLUMNS);
  XLSX.utils.book_append_sheet(wb, docsSheet, "Travel Documents");

  // Sheet 5: Travel Visas
  const visasSheet = buildDataSheet(VISAS_COLUMNS);
  XLSX.utils.book_append_sheet(wb, visasSheet, "Travel Visas");

  // Sheet 6: Licenses & Certificates
  const licSheet = buildDataSheet(LICENSES_COLUMNS);
  XLSX.utils.book_append_sheet(wb, licSheet, "Licenses & Certificates");

  // Sheet 7: Sea Service History
  const seaSheet = buildDataSheet(SEA_SERVICE_COLUMNS);
  XLSX.utils.book_append_sheet(wb, seaSheet, "Sea Service History");

  // Sheet 8: Training Courses
  const trainSheet = buildDataSheet(TRAINING_COLUMNS);
  XLSX.utils.book_append_sheet(wb, trainSheet, "Training Courses");

  // Sheet 9: Education Details
  const eduSheet = buildDataSheet(EDUCATION_COLUMNS);
  XLSX.utils.book_append_sheet(wb, eduSheet, "Education Details");

  // Write to buffer
  const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(xlsxBuffer);
}
