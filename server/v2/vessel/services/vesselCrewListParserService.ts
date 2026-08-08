import JSZip from "jszip";
import { parseDateString } from "../utils/dateUtils";

export interface VesselCrewEntry {
  familyName: string;
  givenNames: string;
  rankOrRating: string;
  dob: string | null; // Formatted YYYY-MM-DD or raw string
  nationality?: string | null;
}

export interface VesselCrewListDoc {
  fileName: string;
  vesselName: string;
  imo: string;
  portOfJoining?: string;
  arrivalDepartureDate?: string;
  entries: VesselCrewEntry[];
  errors: string[];
}

/**
 * Sanitize text extracted from Word XML by stripping any residual HTML/XML tags or property strings
 */
function sanitizeXmlText(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/<[^>]*>/g, "") // Strip any residual HTML/XML tags
    .replace(/w:tcW[\s\S]*$/gi, "") // Strip any property remnants
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract clean 6 to 8 digit IMO number from a string, stripping label prefixes ("1.2", "IMO", etc.)
 */
function extractImoDigits(str: string | null | undefined): string {
  if (!str) return "";
  const cleaned = str.replace(/1\.2|imo\s*number|imo\s*no\.?|imo/gi, "");
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length >= 6 && digits.length <= 8) {
    return digits;
  }
  return "";
}


/**
 * Parse a single .docx buffer (IMO FAL Form 5 structured table)
 */
export async function parseSingleDocx(buffer: Buffer, fileName: string = "crew_list.docx"): Promise<VesselCrewListDoc> {
  const result: VesselCrewListDoc = {
    fileName,
    vesselName: "",
    imo: "",
    portOfJoining: "",
    arrivalDepartureDate: "",
    entries: [],
    errors: [],
  };

  try {
    const zip = await JSZip.loadAsync(buffer);
    const docXmlFile = zip.file("word/document.xml");
    if (!docXmlFile) {
      result.errors.push("Invalid DOCX: missing word/document.xml");
      return result;
    }

    const xml = await docXmlFile.async("string");

    // Split by table row <w:tr
    const rowParts = xml.split(/<w:tr[\s>]/);
    if (rowParts.length < 2) {
      result.errors.push("No table rows found in document");
      return result;
    }

    // Extract text per cell for each row (strictly stripping <w:tcPr> cell properties first)
    const extractedRows: string[][] = [];
    for (let i = 1; i < rowParts.length; i++) {
      const rowXml = rowParts[i];
      const cellParts = rowXml.split(/<w:tc[\s>]/).slice(1);
      const rowTexts: string[] = cellParts.map((cellXml) => {
        const cellBody = cellXml.replace(/<w:tcPr[\s\S]*?<\/w:tcPr>/gi, "");
        const textMatches = [...cellBody.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)];
        const text = textMatches.map((m) => m[1]).join("").trim();
        return sanitizeXmlText(text);
      });
      extractedRows.push(rowTexts);
    }

    let headerRowIdx = -1;
    let colFamilyName = 1;
    let colGivenNames = 2;
    let colRank = 3;
    let colNationality = 4;
    let colDob = 5;

    for (let r = 0; r < extractedRows.length; r++) {
      const row = extractedRows[r];

      // Generalized extraction for Vessel Name, IMO, Port, and Arrival/Departure Date
      for (let c = 0; c < row.length; c++) {
        const cellText = row[c];

        // 1.1 Name of ship label
        if (!result.vesselName && (cellText.includes("1.1") || /name of ship/i.test(cellText))) {
          if (c + 1 < row.length && row[c + 1] && !row[c + 1].includes("1.2") && !/imo number/i.test(row[c + 1])) {
            result.vesselName = sanitizeXmlText(row[c + 1]);
          } else {
            const stripped = cellText.replace(/.*1\.1\s*Name of ship/i, "").replace(/.*Name of ship/i, "").trim();
            if (stripped) result.vesselName = sanitizeXmlText(stripped);
          }
        }

        // 1.2 IMO number label
        if (!result.imo && (cellText.includes("1.2") || /imo number/i.test(cellText))) {
          // Check next cell
          if (c + 1 < row.length && row[c + 1]) {
            const parsedImo = extractImoDigits(row[c + 1]);
            if (parsedImo) result.imo = parsedImo;
          }
          // Check current cell if next cell didn't have valid IMO
          if (!result.imo) {
            const parsedImo = extractImoDigits(cellText);
            if (parsedImo) result.imo = parsedImo;
          }
        }

        // 2. Port of arrival/departure label
        if (!result.portOfJoining && (cellText.includes("2.") || /port of arrival/i.test(cellText))) {
          if (c + 1 < row.length && row[c + 1] && !row[c + 1].includes("3.")) {
            result.portOfJoining = sanitizeXmlText(row[c + 1]);
          }
        }

        // 3. Date of arrival/departure label
        if (!result.arrivalDepartureDate && (cellText.includes("3.") || /date of arrival/i.test(cellText))) {
          if (c + 1 < row.length && row[c + 1]) {
            // sanitizeXmlText first — the shared parseDateString does not strip XML tags
            result.arrivalDepartureDate = parseDateString(sanitizeXmlText(row[c + 1])) || sanitizeXmlText(row[c + 1]);
          }
        }
      }

      // Identify column header row for crew list table
      const fullRowText = row.join(" ");
      if (fullRowText.includes("Family name") || fullRowText.includes("Given names") || fullRowText.includes("Rank or rating")) {
        headerRowIdx = r;
        row.forEach((cell, idx) => {
          const lower = cell.toLowerCase();
          if (lower.includes("family name")) colFamilyName = idx;
          else if (lower.includes("given names") || lower.includes("first name")) colGivenNames = idx;
          else if (lower.includes("rank")) colRank = idx;
          else if (lower.includes("nationality")) colNationality = idx;
          else if (lower.includes("date of birth") || lower.includes("dob")) colDob = idx;
        });
      }
    }

    // Fallback IMO extraction (scan top header rows for IMO label or 6-8 digit IMO number)
    if (!result.imo) {
      const maxHeaderRow = headerRowIdx !== -1 ? headerRowIdx : Math.min(extractedRows.length, 5);
      for (let r = 0; r < maxHeaderRow; r++) {
        const row = extractedRows[r];
        for (let c = 0; c < row.length; c++) {
          const cellText = row[c] || "";
          const parsedImo = extractImoDigits(cellText);
          if (parsedImo) {
            result.imo = parsedImo;
            break;
          }
        }
        if (result.imo) break;
      }
    }

    // Process crew data rows (rows starting with a number in cell 0)
    const startIdx = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;
    for (let r = startIdx; r < extractedRows.length; r++) {
      const row = extractedRows[r];
      if (row.length < 3) continue;

      const firstCell = row[0]?.trim();
      const isNumericRow = /^\d+$/.test(firstCell);
      const val1 = sanitizeXmlText(row[colFamilyName]);
      const val2 = sanitizeXmlText(row[colGivenNames]);
      const rankOrRating = sanitizeXmlText(row[colRank]);
      const dobRaw = row[colDob]?.trim() || "";
      const nationality = sanitizeXmlText(row[colNationality]);

      if ((isNumericRow || (val1 && rankOrRating)) && rankOrRating && !rankOrRating.toLowerCase().includes("signature")) {
        result.entries.push({
          familyName: val1,
          givenNames: val2,
          rankOrRating,
          // sanitizeXmlText strips any residual XML tags before date parsing
          dob: parseDateString(sanitizeXmlText(dobRaw)),
          nationality: nationality || null,
        });
      }
    }
  } catch (err: any) {
    result.errors.push(`Failed to parse DOCX: ${err.message || String(err)}`);
  }

  return result;
}

/**
 * Parse a ZIP file containing multiple .docx crew list files
 * Optimized with chunked batching for 100+ vessel scale handling
 */
export async function parseCrewListZip(zipBuffer: Buffer): Promise<VesselCrewListDoc[]> {
  const results: VesselCrewListDoc[] = [];

  try {
    const zip = await JSZip.loadAsync(zipBuffer);
    const docxFiles = Object.keys(zip.files).filter(
      (path) => path.toLowerCase().endsWith(".docx") && !path.startsWith("__MACOSX") && !path.includes("/~$")
    );

    // Process files in chunked batches of 5 to optimize RAM and GC during 100+ vessel imports
    const BATCH_SIZE = 5;
    for (let i = 0; i < docxFiles.length; i += BATCH_SIZE) {
      const chunk = docxFiles.slice(i, i + BATCH_SIZE);
      const chunkResults = await Promise.all(
        chunk.map(async (filePath) => {
          const fileObj = zip.file(filePath);
          if (!fileObj) return null;

          const fileBuffer = await fileObj.async("nodebuffer");
          const docName = filePath.split("/").pop() || filePath;
          return parseSingleDocx(fileBuffer, docName);
        })
      );

      for (const res of chunkResults) {
        if (res) results.push(res);
      }
    }
  } catch (err: any) {
    results.push({
      fileName: "archive.zip",
      vesselName: "",
      imo: "",
      entries: [],
      errors: [`Failed to unpack ZIP archive: ${err.message || String(err)}`],
    });
  }

  return results;
}
