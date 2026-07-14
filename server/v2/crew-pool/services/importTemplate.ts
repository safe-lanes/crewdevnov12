/**
 * Crew Import Template Generator
 * 
 * Generates a user-friendly Excel template for client data migration.
 * All column headers use plain English — internal field mapping is handled
 * by the import service (crewImportService.ts).
 */
import ExcelJS from "exceljs";
import { getDb } from "../../db";
import {
  masterNationalities,
  masterVesselTypes,
  masterCountries,
  masterLanguages,
  masterManningAgents,
  masterVessels,
} from "../../../../shared/schema";
import { admCompanyRanksV2 } from "../../../../shared/v2/admin/schema";
import { eq } from "drizzle-orm";

// ============================================================================
// SHEET DEFINITIONS — Column headers the client sees
// ============================================================================

export const CREW_DETAILS_COLUMNS = [
  { header: "Employee ID", required: true, example: "EMP-2024-001", note: "Mandatory — must be unique" },
  { header: "First Name", required: true, example: "Rajesh", note: "" },
  { header: "Middle Name", required: false, example: "Kumar", note: "" },
  { header: "Last Name / Family Name", required: false, example: "Sharma", note: "" },
  { header: "Gender", required: false, example: "Male", note: "Male / Female" },
  { header: "Date of Birth", required: false, example: "15-Mar-1985", note: "DD-MMM-YYYY or DD/MM/YYYY" },
  { header: "Nationality", required: false, example: "Indian", note: "Must match Reference Data sheet" },
  { header: "Present Rank / Designation", required: false, example: "Master", note: "" },
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
  { header: "Foreign Languages", required: false, example: "English, French", note: "Comma-separated; each must match Reference Data sheet" },
  { header: "English Proficiency", required: false, example: "Fluent", note: "None / Basic / Intermediate / Fluent / Native" },
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

export const CHILDREN_COLUMNS = [
  { header: "Employee ID", required: true, example: "EMP-2024-001", note: "Must match Crew Details sheet" },
  { header: "First Name", required: true, example: "Aarav", note: "" },
  { header: "Middle Name", required: false, example: "Kumar", note: "" },
  { header: "Family Name", required: false, example: "Sharma", note: "" },
  { header: "Date of Birth", required: false, example: "10-Aug-2015", note: "DD-MMM-YYYY or DD/MM/YYYY" },
  { header: "Gender", required: false, example: "Male", note: "Male / Female" },
];

export const NOK_COLUMNS = [
  { header: "Employee ID", required: true, example: "EMP-2024-001", note: "Must match Crew Details sheet" },
  { header: "Contact Person First Name", required: false, example: "Priya", note: "" },
  { header: "Contact Person Family Name", required: false, example: "Sharma", note: "" },
  { header: "Relationship", required: false, example: "Spouse", note: "" },
  { header: "Phone Number", required: false, example: "+91-9876543211", note: "" },
  { header: "Email", required: false, example: "priya@email.com", note: "" },
  { header: "Address", required: false, example: "123 Marine Drive, Mumbai", note: "" },
];

export const DOCUMENTS_COLUMNS = [
  { header: "Employee ID", required: true, example: "EMP-2024-001", note: "Must match Crew Details sheet" },
  { header: "Document Name", required: true, example: "Passport", note: "" },
  { header: "Document Number", required: false, example: "J1234567", note: "" },
  { header: "Date of Issue", required: false, example: "15-Jan-2020", note: "DD-MMM-YYYY or DD/MM/YYYY" },
  { header: "Date of Expiry", required: false, example: "14-Jan-2030", note: "DD-MMM-YYYY or DD/MM/YYYY" },
  { header: "Issuing Authority", required: false, example: "Govt of India", note: "" },
  { header: "Attachment Ref", required: false, example: "EMP-2024-001-D1", note: "Auto-filled. Use as the ZIP sub-folder name for this row's file(s)." },
];

export const LICENSES_COLUMNS = [
  { header: "Employee ID", required: true, example: "EMP-2024-001", note: "Must match Crew Details sheet" },
  { header: "Certificate / Document Name", required: true, example: "COC Deck", note: "" },
  { header: "Certificate Number", required: false, example: "COC-12345", note: "" },
  { header: "Issuing Authority", required: false, example: "DG Shipping", note: "" },
  { header: "Date of Issue", required: false, example: "01-Jun-2019", note: "DD-MMM-YYYY or DD/MM/YYYY" },
  { header: "Date of Expiry", required: false, example: "01-Jun-2024", note: "DD-MMM-YYYY or DD/MM/YYYY" },
  { header: "Attachment Ref", required: false, example: "EMP-2024-001-L1", note: "Auto-filled. Use as the ZIP sub-folder name for this row's file(s)." },
];

export const SEA_SERVICE_COLUMNS = [
  { header: "Employee ID", required: true, example: "EMP-2024-001", note: "Must match Crew Details sheet" },
  { header: "Company or External?", required: false, example: "Company", note: "Company / External" },
  { header: "Vessel Name", required: true, example: "MT Pacific Star", note: "" },
  { header: "Vessel Type", required: true, example: "Oil Tanker", note: "Must match Reference Data sheet" },
  { header: "Rank Served", required: true, example: "Chief Officer", note: "" },
  { header: "Sign On Date", required: true, example: "15-Jan-2022", note: "DD-MMM-YYYY or DD/MM/YYYY" },
  { header: "Sign Off Date", required: true, example: "15-Jul-2022", note: "DD-MMM-YYYY or DD/MM/YYYY" },
  { header: "Owner / Operator", required: false, example: "Pacific Shipping", note: "" },
  { header: "Deadweight", required: false, example: "50000", note: "DWT (Number)" },
  { header: "Engine Type / Power", required: false, example: "MAN B&W 6S60MC", note: "" },
  { header: "Attachment Ref", required: false, example: "EMP-2024-001-S1", note: "Auto-filled. Use as the ZIP sub-folder name for this row's file(s)." },
];

export const TRAINING_COLUMNS = [
  { header: "Employee ID", required: true, example: "EMP-2024-001", note: "Must match Crew Details sheet" },
  { header: "Course Name", required: true, example: "STCW Basic Safety", note: "" },
  { header: "Certificate Number", required: false, example: "TC-98765", note: "" },
  { header: "Issuing Authority", required: false, example: "Maritime Academy", note: "" },
  { header: "Date of Issue", required: false, example: "20-Mar-2021", note: "DD-MMM-YYYY or DD/MM/YYYY" },
  { header: "Date of Expiry", required: false, example: "19-Mar-2026", note: "DD-MMM-YYYY or DD/MM/YYYY" },
  { header: "Attachment Ref", required: false, example: "EMP-2024-001-T1", note: "Auto-filled. Use as the ZIP sub-folder name for this row's file(s)." },
];

export const VISAS_COLUMNS = [
  { header: "Employee ID", required: true, example: "EMP-2024-001", note: "Must match Crew Details sheet" },
  { header: "Country", required: true, example: "United States", note: "Must match Reference Data sheet" },
  { header: "Visa Type", required: true, example: "C1/D", note: "" },
  { header: "Visa Number / Serial Number", required: false, example: "V9876543", note: "" },
  { header: "Date of Issue", required: false, example: "15-Jan-2023", note: "DD-MMM-YYYY or DD/MM/YYYY" },
  { header: "Date of Expiry", required: false, example: "14-Jan-2028", note: "DD-MMM-YYYY or DD/MM/YYYY" },
  { header: "Attachment Ref", required: false, example: "EMP-2024-001-V1", note: "Auto-filled. Use as the ZIP sub-folder name for this row's file(s)." },
];

export const EDUCATION_COLUMNS = [
  { header: "Employee ID", required: true, example: "EMP-2024-001", note: "Must match Crew Details sheet" },
  { header: "Institution", required: false, example: "Maritime Academy", note: "" },
  { header: "Subjects / Field of Study", required: false, example: "Marine Engineering", note: "" },
  { header: "Qualifications / Degree", required: true, example: "Bachelor of Science", note: "" },
  { header: "Date of Completion", required: false, example: "15-May-2010", note: "DD-MMM-YYYY or DD/MM/YYYY" },
  { header: "Attachment Ref", required: false, example: "EMP-2024-001-E1", note: "Auto-filled. Use as the ZIP sub-folder name for this row's file(s)." },
];

// Part F — Medical
export const MEDICALS_COLUMNS = [
  { header: "Employee ID", required: true, example: "EMP-2024-001", note: "Must match Crew Details sheet" },
  { header: "Vessel Name", required: false, example: "MT Pacific Star", note: "Matches a company vessel where possible; kept as typed otherwise" },
  { header: "Examination Date", required: false, example: "10-Jan-2024", note: "DD-MMM-YYYY or DD/MM/YYYY" },
  { header: "Blood Pressure", required: false, example: "120/80", note: "" },
  { header: "Weight", required: false, example: "72", note: "" },
  { header: "Any Medication Prescribed", required: false, example: "None", note: "" },
  { header: "Clinic/Hospital", required: false, example: "Apollo Clinic", note: "" },
  { header: "Fit For Duty", required: false, example: "Fit", note: "Fit / Unfit / Fit with Restrictions" },
  { header: "Expiry Date", required: false, example: "09-Jan-2026", note: "DD-MMM-YYYY or DD/MM/YYYY" },
  { header: "Attachment Ref", required: false, example: "EMP-2024-001-M1", note: "Auto-filled. Use as the ZIP sub-folder name for this row's file(s)." },
];

export const DOCTOR_VISITS_COLUMNS = [
  { header: "Employee ID", required: true, example: "EMP-2024-001", note: "Must match Crew Details sheet" },
  { header: "Vessel", required: false, example: "MT Pacific Star", note: "" },
  { header: "Port", required: false, example: "Singapore", note: "" },
  { header: "Visit Date", required: false, example: "15-Mar-2024", note: "DD-MMM-YYYY or DD/MM/YYYY" },
  { header: "Doctor Name", required: false, example: "Dr. Lee", note: "" },
  { header: "Clinic/Hospital", required: false, example: "Raffles Medical", note: "" },
  { header: "Reason", required: false, example: "Fever", note: "" },
  { header: "Doctor Comments", required: false, example: "Rest advised", note: "" },
  { header: "Diagnosis", required: false, example: "Viral infection", note: "" },
  { header: "Treatment", required: false, example: "Paracetamol", note: "" },
  { header: "Follow-Up Date", required: false, example: "22-Mar-2024", note: "DD-MMM-YYYY or DD/MM/YYYY" },
  { header: "Attachment Ref", required: false, example: "EMP-2024-001-DV1", note: "Auto-filled. Use as the ZIP sub-folder name for this row's file(s)." },
];

// Part G — Briefing & De-briefing
export const BRIEFINGS_COLUMNS = [
  { header: "Employee ID", required: true, example: "EMP-2024-001", note: "Must match Crew Details sheet" },
  { header: "Vessel Name", required: false, example: "MT Pacific Star", note: "Matches a company vessel where possible; kept as typed otherwise" },
  { header: "Joining Rank", required: false, example: "Chief Officer", note: "" },
  { header: "Date Sign On", required: false, example: "15-Jan-2024", note: "DD-MMM-YYYY or DD/MM/YYYY" },
  { header: "Attachment Ref", required: false, example: "EMP-2024-001-B1", note: "Auto-filled. Use as the ZIP sub-folder name for this row's file(s)." },
];

export const DEBRIEFINGS_COLUMNS = [
  { header: "Employee ID", required: true, example: "EMP-2024-001", note: "Must match Crew Details sheet" },
  { header: "Vessel Name", required: false, example: "MT Pacific Star", note: "Matches a company vessel where possible; kept as typed otherwise" },
  { header: "Rank Served", required: false, example: "Chief Officer", note: "" },
  { header: "Date Sign On", required: false, example: "15-Jan-2024", note: "DD-MMM-YYYY or DD/MM/YYYY" },
  { header: "Date Signed Off", required: false, example: "15-Jul-2024", note: "DD-MMM-YYYY or DD/MM/YYYY" },
  { header: "Reason for Sign Off", required: false, example: "Contract completion", note: "" },
  { header: "Attachment Ref", required: false, example: "EMP-2024-001-DB1", note: "Auto-filled. Use as the ZIP sub-folder name for this row's file(s)." },
];

// ============================================================================
// TEMPLATE BUILDER
// ============================================================================

/**
 * Fetch reference data from master tables for the Instructions sheet
 */
async function fetchReferenceData() {
  const db = getDb();

  const [nationalities, vesselTypes, countries, languages, ranks, manningAgents, vessels] = await Promise.all([
    db.select({ name: masterNationalities.nationality }).from(masterNationalities).where(eq(masterNationalities.isDeleted, false)),
    db.select({ name: masterVesselTypes.vesselType }).from(masterVesselTypes).where(eq(masterVesselTypes.isDeleted, false)),
    db.select({ name: masterCountries.countryName }).from(masterCountries).where(eq(masterCountries.isDeleted, false)),
    db.select({ name: masterLanguages.languageName }).from(masterLanguages).where(eq(masterLanguages.isDeleted, false)),
    db.select({ name: admCompanyRanksV2.rank }).from(admCompanyRanksV2).where(eq(admCompanyRanksV2.isDeleted, false)),
    db.select({ name: masterManningAgents.name }).from(masterManningAgents).where(eq(masterManningAgents.isDeleted, false)),
    db.select({ name: masterVessels.vessel }).from(masterVessels),
  ]);

  return {
    nationalities: Array.from(new Set(nationalities.map((n: { name: string | null }) => n.name).filter(Boolean))).sort() as string[],
    vesselTypes: Array.from(new Set(vesselTypes.map((v: { name: string | null }) => v.name).filter(Boolean))).sort() as string[],
    countries: Array.from(new Set(countries.map((c: { name: string | null }) => c.name).filter(Boolean))).sort() as string[],
    languages: Array.from(new Set(languages.map((l: { name: string | null }) => l.name).filter(Boolean))).sort() as string[],
    ranks: Array.from(new Set(ranks.map((r: { name: string | null }) => r.name).filter(Boolean))).sort() as string[],
    manningAgents: Array.from(new Set(manningAgents.map((m: { name: string | null }) => m.name).filter(Boolean))).sort() as string[],
    vessels: Array.from(new Set(vessels.map((v: { name: string | null }) => v.name).filter(Boolean))).sort() as string[],
  };
}

/**
 * Build a data sheet with headers + example row
 */
function buildDataSheet(
  wb: ExcelJS.Workbook,
  name: string,
  columns: typeof CREW_DETAILS_COLUMNS
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(name, {
    views: [{ showGridLines: true }]
  });

  // 1. Column configuration
  ws.columns = columns.map(c => ({
    header: c.header,
    key: c.header,
    width: Math.max(c.header.length, c.example?.length || 10, 15) + 3
  }));

  // 2. Format headers
  const headerRow = ws.getRow(1);
  headerRow.height = 25;
  headerRow.eachCell((cell, colNumber) => {
    const colDef = columns[colNumber - 1];
    cell.font = {
      name: "Calibri",
      bold: true,
      size: 11,
      color: { argb: "FF000000" }
    };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFD9D9D9" } },
      bottom: { style: "medium", color: { argb: "FF404040" } },
      left: { style: "thin", color: { argb: "FFD9D9D9" } },
      right: { style: "thin", color: { argb: "FFD9D9D9" } }
    };

    if (colDef.required) {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFF2CC" } // Light yellow/orange-yellow
      };
    } else {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF2F2F2" } // Light gray
      };
    }
  });

  // 3. Format example row
  const exampleRow = ws.getRow(2);
  exampleRow.height = 20;
  columns.forEach((c, colNumber) => {
    const cell = exampleRow.getCell(colNumber + 1);
    cell.value = c.example;
    cell.font = {
      name: "Calibri",
      italic: true,
      size: 11,
      color: { argb: "FF7F7F7F" }
    };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFD9D9D9" } },
      bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
      left: { style: "thin", color: { argb: "FFD9D9D9" } },
      right: { style: "thin", color: { argb: "FFD9D9D9" } }
    };
  });

  return ws;
}

/**
 * Build the Instructions & Reference Data sheet
 */
function buildInstructionsSheet(
  ws: ExcelJS.Worksheet,
  refData: {
    nationalities: string[];
    vesselTypes: string[];
    countries: string[];
    languages: string[];
    ranks: string[];
    manningAgents: string[];
    vessels: string[];
  }
) {
  ws.views = [{ showGridLines: true }];
  ws.getColumn(1).width = 80;

  ws.getCell("A1").value = "CREW IMPORT TEMPLATE — INSTRUCTIONS";
  ws.getCell("A1").font = { name: "Calibri", bold: true, size: 16, color: { argb: "FF16569E" } };

  const instructions = [
    "",
    "HOW TO USE THIS TEMPLATE",
    "1. Fill in the 'Crew Details' sheet first — one row per crew member",
    "2. Use the Employee ID column to link data across sheets (Documents, Licenses, etc.)",
    "3. Employee ID is mandatory for every crew member — it cannot be left blank",
    "4. Each Employee ID must be unique across all rows (and not already exist in the system)",
    "5. Required columns are marked with yellow background in each sheet",
    "6. Dates can be in these formats: DD-MMM-YYYY (15-Mar-1985), DD/MM/YYYY (15/03/1985), or YYYY-MM-DD (1985-03-15)",
    "7. Row 2 in each sheet has example data — delete it before uploading",
    "8. Do NOT change column headers or sheet names",
    "",
    "COLOR LEGEND",
    "Yellow background = Required field (must be filled)",
    "White/Gray background = Optional field (can be left blank)",
    "Orange cell = Manually typed value not found in the dropdown list (will be reported as an error on upload)",
    "Row 2 (example) = Sample data — DELETE before uploading",
    "",
    "NOTE: You may type values manually instead of using the dropdowns. Manually typed values that do not match",
    "the Reference Data lists will be highlighted in orange and rejected during import (listed in the error report).",
    "",
    "ATTACHMENTS (OPTIONAL — UPLOADED SEPARATELY AS A ZIP)",
    "Documents, Visas, Licenses, Sea Service, Training, Education, Medicals, Doctor Visits, Briefings and",
    "De-briefings each have an auto-filled 'Attachment Ref' column. It fills in automatically as you enter the",
    "Employee ID for a row (e.g. EMP-2024-001-D1). Do NOT edit these values.",
    "After importing this workbook, upload a ZIP of the files. Inside the ZIP, place each file under a folder path:",
    "    <Employee ID>/<Attachment Ref>/<your-file.pdf>",
    "For example: EMP-2024-001/EMP-2024-001-D1/passport.pdf",
    "Allowed file types: PDF, PNG, JPEG. Max 5 MB per file. Files that do not match a row are skipped and reported.",
    "",
  ];

  instructions.forEach((inst, idx) => {
    const rowNum = idx + 2;
    const cell = ws.getCell(rowNum, 1);
    cell.value = inst;
    if (inst.startsWith("HOW TO USE") || inst.startsWith("COLOR LEGEND")) {
      cell.font = { name: "Calibri", bold: true, size: 12, color: { argb: "FF000000" } };
    } else {
      cell.font = { name: "Calibri", size: 11, color: { argb: "FF333333" } };
    }
  });

  const refStartRow = 26;
  const headers = [
    "",
    "Nationalities",
    "Vessel Types",
    "Countries",
    "Languages",
    "Genders",
    "English Proficiency",
    "Marital Status",
    "Current Status",
    "Company or External",
    "Ranks",
    "Manning Agents",
    "Company Vessels"
  ];
  const refHeaderRow = ws.getRow(refStartRow);
  refHeaderRow.values = headers;
  refHeaderRow.eachCell((cell, colNum) => {
    if (colNum > 1) {
      cell.font = { name: "Calibri", bold: true, size: 11, color: { argb: "FF000000" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9E1F2" }
      };
      cell.border = {
        bottom: { style: "medium", color: { argb: "FF000000" } }
      };
    }
  });

  const valStartRow = refStartRow + 1;

  refData.nationalities.forEach((val, idx) => {
    ws.getCell(valStartRow + idx, 2).value = val;
  });
  refData.vesselTypes.forEach((val, idx) => {
    ws.getCell(valStartRow + idx, 3).value = val;
  });
  refData.countries.forEach((val, idx) => {
    ws.getCell(valStartRow + idx, 4).value = val;
  });
  refData.languages.forEach((val, idx) => {
    ws.getCell(valStartRow + idx, 5).value = val;
  });

  const genders = ["Male", "Female"];
  genders.forEach((val, idx) => {
    ws.getCell(valStartRow + idx, 6).value = val;
  });

  const engProfs = ["None", "Basic", "Intermediate", "Fluent", "Native"];
  engProfs.forEach((val, idx) => {
    ws.getCell(valStartRow + idx, 7).value = val;
  });

  const maritals = ["Single", "Married", "Divorced", "Widowed"];
  maritals.forEach((val, idx) => {
    ws.getCell(valStartRow + idx, 8).value = val;
  });

  const statuses = ["On Board", "On Leave", "Available", "In Transit", "Inactive", "Terminated", "Terminated - NFR"];
  statuses.forEach((val, idx) => {
    ws.getCell(valStartRow + idx, 9).value = val;
  });

  const coExt = ["Company", "External"];
  coExt.forEach((val, idx) => {
    ws.getCell(valStartRow + idx, 10).value = val;
  });

  refData.ranks.forEach((val, idx) => {
    ws.getCell(valStartRow + idx, 11).value = val;
  });

  refData.manningAgents.forEach((val, idx) => {
    ws.getCell(valStartRow + idx, 12).value = val;
  });

  refData.vessels.forEach((val, idx) => {
    ws.getCell(valStartRow + idx, 13).value = val;
  });

  for (let col = 2; col <= 13; col++) {
    ws.getColumn(col).width = 20;
    const maxLen = Math.max(
      refData.nationalities.length,
      refData.countries.length,
      refData.ranks.length,
      refData.manningAgents.length,
      refData.vessels.length,
      100
    );
    for (let r = valStartRow; r <= valStartRow + maxLen; r++) {
      const cell = ws.getCell(r, col);
      if (cell.value) {
        cell.font = { name: "Calibri", size: 10, color: { argb: "FF595959" } };
      }
    }
  }
}

/**
 * Generate the complete crew import template workbook
 */
export async function generateImportTemplate(): Promise<Buffer> {
  const refData = await fetchReferenceData();

  const wb = new ExcelJS.Workbook();

  // Sheet 1: Instructions & Reference
  const instrSheet = wb.addWorksheet("Instructions & Reference");
  buildInstructionsSheet(instrSheet, refData);

  // Sheet 2: Crew Details
  const crewSheet = buildDataSheet(wb, "Crew Details", CREW_DETAILS_COLUMNS);

  // Sheet 3: Children Details
  const childrenSheet = buildDataSheet(wb, "Children Details", CHILDREN_COLUMNS);

  // Sheet 4: Emergency Contact
  const nokSheet = buildDataSheet(wb, "Emergency Contact", NOK_COLUMNS);

  // Sheet 5: Travel Documents
  const docsSheet = buildDataSheet(wb, "Travel Documents", DOCUMENTS_COLUMNS);

  // Sheet 5: Travel Visas
  const visasSheet = buildDataSheet(wb, "Travel Visas", VISAS_COLUMNS);

  // Sheet 6: Licenses & Certificates
  const licSheet = buildDataSheet(wb, "Licenses & Certificates", LICENSES_COLUMNS);

  // Sheet 7: Sea Service History
  const seaSheet = buildDataSheet(wb, "Sea Service History", SEA_SERVICE_COLUMNS);

  // Sheet 8: Training Courses
  const trainSheet = buildDataSheet(wb, "Training Courses", TRAINING_COLUMNS);

  // Sheet 9: Education Details
  const eduSheet = buildDataSheet(wb, "Education Details", EDUCATION_COLUMNS);

  // Sheet 10: Pre-Joining Medicals (Part F)
  const medicalSheet = buildDataSheet(wb, "Pre-Joining Medicals", MEDICALS_COLUMNS);

  // Sheet 11: Doctor Visits (Part F)
  const doctorVisitSheet = buildDataSheet(wb, "Doctor Visits", DOCTOR_VISITS_COLUMNS);

  // Sheet 12: Briefings (Part G)
  const briefingSheet = buildDataSheet(wb, "Briefings", BRIEFINGS_COLUMNS);

  // Sheet 13: De-briefings (Part G)
  const debriefingSheet = buildDataSheet(wb, "De-briefings", DEBRIEFINGS_COLUMNS);

  // Apply Dropdown validations
  const refStartRow = 27;
  const natFormula = `='Instructions & Reference'!$B$27:$B$${refStartRow + refData.nationalities.length - 1}`;
  const vtFormula = `='Instructions & Reference'!$C$27:$C$${refStartRow + refData.vesselTypes.length - 1}`;
  const countryFormula = `='Instructions & Reference'!$D$27:$D$${refStartRow + refData.countries.length - 1}`;
  const langFormula = `='Instructions & Reference'!$E$27:$E$${refStartRow + refData.languages.length - 1}`;
  const genderFormula = `='Instructions & Reference'!$F$27:$F$28`;
  const engProfFormula = `='Instructions & Reference'!$G$27:$G$31`;
  const maritalFormula = `='Instructions & Reference'!$H$27:$H$30`;
  const statusFormula = `='Instructions & Reference'!$I$27:$I$33`;
  const coExtFormula = `='Instructions & Reference'!$J$27:$J$28`;
  const rankFormula = `='Instructions & Reference'!$K$27:$K$${refStartRow + refData.ranks.length - 1}`;
  const manningAgentFormula = `='Instructions & Reference'!$L$27:$L$${refStartRow + refData.manningAgents.length - 1}`;
  const vesselFormula = `='Instructions & Reference'!$M$27:$M$${refStartRow + refData.vessels.length - 1}`;
  const fitForDutyFormula = `"Fit,Unfit,Fit with Restrictions"`;

  const getColIndex = (columnsList: typeof CREW_DETAILS_COLUMNS, header: string) => {
    return columnsList.findIndex(c => c.header === header) + 1;
  };

  // Convert a 1-based column index to an Excel column letter (1 → A, 27 → AA)
  const colLetter = (idx: number): string => {
    let letter = "";
    let n = idx;
    while (n > 0) {
      const rem = (n - 1) % 26;
      letter = String.fromCharCode(65 + rem) + letter;
      n = Math.floor((n - 1) / 26);
    }
    return letter;
  };

  // Orange fill for manually typed values not present in the dropdown list.
  // ExcelJS conditional formatting (DXF) uses bgColor for the visible solid
  // fill colour — the opposite of regular cell fills which use fgColor.
  const MANUAL_VALUE_FILL: ExcelJS.FillPattern = {
    type: "pattern",
    pattern: "solid",
    bgColor: { argb: "FFFFC000" },
  };

  const applyDropdown = (ws: ExcelJS.Worksheet, header: string, columnsList: typeof CREW_DETAILS_COLUMNS, formula: string) => {
    const colIdx = getColIndex(columnsList, header);
    if (colIdx > 0) {
      for (let row = 3; row <= 200; row++) {
        ws.getCell(row, colIdx).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [formula],
          // Non-blocking: user may type manual values; they get highlighted instead
          showErrorMessage: false,
        };
      }

      // Conditional formatting: highlight cells whose value is not in the reference list
      const letter = colLetter(colIdx);
      const refRange = formula.replace(/^=/, ""); // e.g. 'Instructions & Reference'!$B$27:$B$50
      ws.addConditionalFormatting({
        ref: `${letter}3:${letter}200`,
        rules: [
          {
            type: "expression",
            priority: 1,
            formulae: [`AND($${letter}3<>"",COUNTIF(${refRange},$${letter}3)=0)`],
            style: { fill: MANUAL_VALUE_FILL },
          },
        ],
      });
    }
  };

  // Crew Details sheet validations
  applyDropdown(crewSheet, "Gender", CREW_DETAILS_COLUMNS, genderFormula);
  applyDropdown(crewSheet, "English Proficiency", CREW_DETAILS_COLUMNS, engProfFormula);
  applyDropdown(crewSheet, "Marital Status", CREW_DETAILS_COLUMNS, maritalFormula);
  applyDropdown(crewSheet, "Current Status", CREW_DETAILS_COLUMNS, statusFormula);
  applyDropdown(crewSheet, "Nationality", CREW_DETAILS_COLUMNS, natFormula);
  applyDropdown(crewSheet, "Vessel Type Experience", CREW_DETAILS_COLUMNS, vtFormula);
  applyDropdown(crewSheet, "Country of Residence", CREW_DETAILS_COLUMNS, countryFormula);
  applyDropdown(crewSheet, "Place of Birth (Country)", CREW_DETAILS_COLUMNS, countryFormula);
  applyDropdown(crewSheet, "Native Language", CREW_DETAILS_COLUMNS, langFormula);
  applyDropdown(crewSheet, "Present Rank / Designation", CREW_DETAILS_COLUMNS, rankFormula);
  applyDropdown(crewSheet, "Rank Applied For", CREW_DETAILS_COLUMNS, rankFormula);
  applyDropdown(crewSheet, "Manning Agent", CREW_DETAILS_COLUMNS, manningAgentFormula);

  // Foreign Languages: dropdown picks one language, but multiple comma-separated
  // values may be typed manually. Only highlight single values not in the list
  // (comma-separated combos are validated server-side on upload).
  const flColIdx = getColIndex(CREW_DETAILS_COLUMNS, "Foreign Languages");
  if (flColIdx > 0) {
    for (let row = 3; row <= 200; row++) {
      crewSheet.getCell(row, flColIdx).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [langFormula],
        showErrorMessage: false,
      };
    }
    const flLetter = colLetter(flColIdx);
    const langRange = langFormula.replace(/^=/, "");
    crewSheet.addConditionalFormatting({
      ref: `${flLetter}3:${flLetter}200`,
      rules: [
        {
          type: "expression",
          priority: 1,
          formulae: [`AND($${flLetter}3<>"",ISERROR(FIND(",",$${flLetter}3)),COUNTIF(${langRange},$${flLetter}3)=0)`],
          style: { fill: MANUAL_VALUE_FILL },
        },
      ],
    });
  }

  // Children Details sheet validations
  applyDropdown(childrenSheet, "Gender", CHILDREN_COLUMNS, genderFormula);

  // Sea Service History sheet validations
  applyDropdown(seaSheet, "Company or External?", SEA_SERVICE_COLUMNS, coExtFormula);
  applyDropdown(seaSheet, "Vessel Type", SEA_SERVICE_COLUMNS, vtFormula);
  applyDropdown(seaSheet, "Rank Served", SEA_SERVICE_COLUMNS, rankFormula);

  // Conditional Vessel Name Dropdown: If Column B is "Company", show Company Vessels list dropdown, else free text
  const vesselColIdx = getColIndex(SEA_SERVICE_COLUMNS, "Vessel Name");
  if (vesselColIdx > 0) {
    const vesselListRange = `'Instructions & Reference'!$M$27:$M$${refStartRow + refData.vessels.length - 1}`;
    for (let row = 3; row <= 200; row++) {
      seaSheet.getCell(row, vesselColIdx).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`=IF($B${row}="Company", ${vesselListRange}, "")`],
        showErrorMessage: false // Allow custom text if External service type
      };
    }

    // Highlight manually typed vessel names for "Company" rows that don't match the vessel list
    const vLetter = colLetter(vesselColIdx);
    seaSheet.addConditionalFormatting({
      ref: `${vLetter}3:${vLetter}200`,
      rules: [
        {
          type: "expression",
          priority: 1,
          formulae: [`AND($B3="Company",$${vLetter}3<>"",COUNTIF(${vesselListRange},$${vLetter}3)=0)`],
          style: { fill: MANUAL_VALUE_FILL },
        },
      ],
    });
  }

  // Plain dropdown (no orange highlight) — for convenience fields that are NOT
  // rejected server-side when typed manually (vessel name, rank, fit-for-duty).
  const applyPlainDropdown = (ws: ExcelJS.Worksheet, header: string, columnsList: typeof CREW_DETAILS_COLUMNS, formula: string) => {
    const colIdx = getColIndex(columnsList, header);
    if (colIdx <= 0) return;
    for (let row = 3; row <= 200; row++) {
      ws.getCell(row, colIdx).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [formula],
        showErrorMessage: false,
      };
    }
  };

  // Pre-Joining Medicals (Part F)
  applyPlainDropdown(medicalSheet, "Vessel Name", MEDICALS_COLUMNS, vesselFormula);
  applyPlainDropdown(medicalSheet, "Fit For Duty", MEDICALS_COLUMNS, fitForDutyFormula);

  // Briefings (Part G)
  applyPlainDropdown(briefingSheet, "Vessel Name", BRIEFINGS_COLUMNS, vesselFormula);
  applyPlainDropdown(briefingSheet, "Joining Rank", BRIEFINGS_COLUMNS, rankFormula);

  // De-briefings (Part G)
  applyPlainDropdown(debriefingSheet, "Vessel Name", DEBRIEFINGS_COLUMNS, vesselFormula);
  applyPlainDropdown(debriefingSheet, "Rank Served", DEBRIEFINGS_COLUMNS, rankFormula);

  // Attachment Ref auto-fill: a stable, human-readable reference generated from
  // the row's Employee ID (col A) plus a per-sheet prefix and a running count.
  // The user copies this value as the ZIP sub-folder name that holds the row's
  // file(s). COUNTIF over an expanding range guarantees a unique suffix per
  // employee within the sheet, and the distinct prefix keeps refs unique across
  // sheets for the same crew. No volatile functions (RAND) so values are stable.
  const applyAttachmentRefFormula = (
    ws: ExcelJS.Worksheet,
    columnsList: typeof CREW_DETAILS_COLUMNS,
    prefix: string,
  ) => {
    const colIdx = getColIndex(columnsList, "Attachment Ref");
    if (colIdx <= 0) return;
    for (let row = 3; row <= 200; row++) {
      ws.getCell(row, colIdx).value = {
        formula: `IF($A${row}="","",$A${row}&"-${prefix}"&COUNTIF($A$3:$A${row},$A${row}))`,
        result: "",
      };
    }
  };

  applyAttachmentRefFormula(docsSheet, DOCUMENTS_COLUMNS, "D");
  applyAttachmentRefFormula(visasSheet, VISAS_COLUMNS, "V");
  applyAttachmentRefFormula(licSheet, LICENSES_COLUMNS, "L");
  applyAttachmentRefFormula(seaSheet, SEA_SERVICE_COLUMNS, "S");
  applyAttachmentRefFormula(trainSheet, TRAINING_COLUMNS, "T");
  applyAttachmentRefFormula(eduSheet, EDUCATION_COLUMNS, "E");
  applyAttachmentRefFormula(medicalSheet, MEDICALS_COLUMNS, "M");
  applyAttachmentRefFormula(doctorVisitSheet, DOCTOR_VISITS_COLUMNS, "DV");
  applyAttachmentRefFormula(briefingSheet, BRIEFINGS_COLUMNS, "B");
  applyAttachmentRefFormula(debriefingSheet, DEBRIEFINGS_COLUMNS, "DB");

  // Write to buffer
  const xlsxBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(xlsxBuffer);
}
