import JSZip from "jszip";
import { parseDateString } from "../utils/dateUtils";

export interface VesselCrewEntry {
  familyName: string;
  givenNames: string;
  rankOrRating: string;
  dob: string | null; // Formatted YYYY-MM-DD or raw string (when dobStatus is set)
  nationality?: string | null;
  /**
   * Set to "DOB_AMBIGUOUS" when the raw date string is ambiguous (both day and
   * month parts ≤ 12 so DD/MM vs MM/DD cannot be determined without locale
   * context).  In this case `dob` holds the original raw string so the admin
   * can correct it before re-uploading.
   */
  dobStatus?: string;
}

export interface VesselCrewListDoc {
  fileName: string;
  vesselName: string;
  imo: string;
  portOfJoining?: string;
  arrivalDepartureDate?: string;
  entries: VesselCrewEntry[];
  errors: string[];
  /**
   * Set to true when a 7-digit candidate was found in the header area but
   * failed the IMO Luhn checksum.  The workbook generator surfaces this as
   * `imoMatchStatus: "CHECKSUM_FAIL"` so the admin knows to verify manually.
   */
  imoChecksumFailed?: boolean;
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
 * Validate an IMO number using the standard Luhn-like checksum:
 * multiply each of the first 6 digits by 7, 6, 5, 4, 3, 2 respectively,
 * sum the products, take the last digit, compare to the 7th digit.
 */
function validateImoChecksum(sevenDigits: string): boolean {
  if (sevenDigits.length !== 7) return false;
  const weights = [7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 6; i++) {
    sum += parseInt(sevenDigits[i], 10) * weights[i];
  }
  return (sum % 10) === parseInt(sevenDigits[6], 10);
}

/**
 * Extract a valid 7-digit IMO number from a string, stripping label prefixes.
 * Returns the 7-digit string if it passes the IMO checksum, or an empty string
 * if the candidate is not exactly 7 digits or fails the checksum.
 * `checksumFailed` is set true only when a 7-digit candidate was found but
 * the checksum was wrong — callers can propagate this as a warning.
 */
function extractImoDigits(str: string | null | undefined): { imo: string; checksumFailed: boolean } {
  if (!str) return { imo: "", checksumFailed: false };
  const cleaned = str.replace(/1\.2|imo\s*number|imo\s*no\.?|imo/gi, "");
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length === 7) {
    if (validateImoChecksum(digits)) {
      return { imo: digits, checksumFailed: false };
    }
    // 7-digit candidate present but checksum failed
    return { imo: "", checksumFailed: true };
  }
  // Not exactly 7 digits — not a valid IMO candidate at all
  return { imo: "", checksumFailed: false };
}

/**
 * Classify the day/month ordering of an ambiguous DD/MM/YYYY or MM/DD/YYYY date string.
 * Returns:
 *  "YYYY-FIRST"  — year-first format, unambiguous (YYYY-MM-DD or YYYY/MM/DD)
 *  "DD-FIRST"    — first part > 12 → must be the day; parse as DD/MM/YYYY
 *  "MM-FIRST"    — second part > 12 → must be the day; parse as MM/DD/YYYY
 *  "AMBIGUOUS"   — both parts ≤ 12; cannot determine ordering without locale knowledge
 *  "OTHER"       — not a two-part numeric date (e.g. text month, Excel serial, ISO)
 */
function classifyDobFormat(raw: string): "YYYY-FIRST" | "DD-FIRST" | "MM-FIRST" | "AMBIGUOUS" | "OTHER" {
  if (/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/.test(raw)) return "YYYY-FIRST";
  const m = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (!m) return "OTHER";
  const a = parseInt(m[1], 10);
  const b = parseInt(m[2], 10);
  if (a > 12) return "DD-FIRST";   // first part can't be a month number
  if (b > 12) return "MM-FIRST";   // second part can't be a month number → month is first
  return "AMBIGUOUS";
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

    // Extract text per cell for each row with vertically merged cell propagation.
    // A cell containing <w:vMerge/> without w:val="restart" is a continuation
    // row of a vertically merged block — the cell holds no text of its own.
    // We propagate the value from the same GRID column in the previous row so
    // that vessel name / IMO values spanning merged header cells are not silently
    // dropped on continuation rows.
    //
    // Grid columns vs array index: Word tables track column positions by grid
    // index, not by cell array index.  A cell with <w:gridSpan w:val="N"/>
    // occupies N grid columns, so subsequent cells shift their array index
    // relative to their grid column.  Using array index for propagation would
    // map continuation cells to the wrong value whenever any cell in the row
    // spans multiple columns.  We therefore track a running gridCol offset and
    // store the previous row as a Map<gridCol, text> for correct lookup.
    const extractedRows: string[][] = [];
    // Maps grid column → extracted text for the most recently processed row.
    let prevRowByGridCol: Map<number, string> = new Map();

    for (let i = 1; i < rowParts.length; i++) {
      const rowXml = rowParts[i];
      const cellParts = rowXml.split(/<w:tc[\s>]/).slice(1);

      const rowTexts: string[] = [];
      const currentRowByGridCol: Map<number, string> = new Map();
      let gridCol = 0; // running grid-column offset for this row

      for (const cellXml of cellParts) {
        // <w:gridSpan w:val="N"/> — how many grid columns this cell occupies.
        // Absent means 1 (the common case of a single-column cell).
        const gridSpanMatch = cellXml.match(/<w:gridSpan\s+w:val\s*=\s*["']?(\d+)["']?\s*\/?>/i);
        const gridSpan = gridSpanMatch ? Math.max(1, parseInt(gridSpanMatch[1], 10)) : 1;

        // Detect vMerge: self-closing <w:vMerge/> OR paired <w:vMerge ...>
        // A restart merge (<w:vMerge w:val="restart"/>) starts the block and
        // HAS content; a bare <w:vMerge/> is a continuation and should inherit.
        const vMergeTag = cellXml.match(/<w:vMerge([^/>\s][^>]*)?\s*\/?>/i)?.[0] || "";
        const hasVMerge = vMergeTag.length > 0;
        const isRestart = /w:val\s*=\s*["']restart["']/i.test(vMergeTag);

        let text: string;
        if (hasVMerge && !isRestart && prevRowByGridCol.has(gridCol)) {
          // Propagate from the same grid column in the previous row — correct
          // regardless of how many cells span how many columns in either row.
          text = prevRowByGridCol.get(gridCol)!;
        } else {
          const cellBody = cellXml.replace(/<w:tcPr[\s\S]*?<\/w:tcPr>/gi, "");
          const textMatches = [...cellBody.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)];
          text = sanitizeXmlText(textMatches.map((m) => m[1]).join("").trim());
        }

        rowTexts.push(text);
        // Register this value at every grid column the cell spans so that
        // continuation cells in subsequent rows find it at any spanned position.
        for (let span = 0; span < gridSpan; span++) {
          currentRowByGridCol.set(gridCol + span, text);
        }
        gridCol += gridSpan;
      }

      extractedRows.push(rowTexts);
      prevRowByGridCol = currentRowByGridCol;
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
          // Check next cell first
          if (c + 1 < row.length && row[c + 1]) {
            const { imo: parsedImo, checksumFailed } = extractImoDigits(row[c + 1]);
            if (parsedImo) result.imo = parsedImo;
            if (checksumFailed) result.imoChecksumFailed = true;
          }
          // Check current cell if next cell didn't have a valid IMO
          if (!result.imo) {
            const { imo: parsedImo, checksumFailed } = extractImoDigits(cellText);
            if (parsedImo) result.imo = parsedImo;
            if (checksumFailed) result.imoChecksumFailed = true;
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

    // Fallback IMO extraction (scan top header rows for a valid 7-digit IMO)
    if (!result.imo) {
      const maxHeaderRow = headerRowIdx !== -1 ? headerRowIdx : Math.min(extractedRows.length, 5);
      outer:
      for (let r = 0; r < maxHeaderRow; r++) {
        for (const cellText of extractedRows[r]) {
          const { imo: parsedImo, checksumFailed } = extractImoDigits(cellText || "");
          if (parsedImo) {
            result.imo = parsedImo;
            break outer;
          }
          if (checksumFailed) result.imoChecksumFailed = true;
        }
      }
      // If a 7-digit candidate was found but failed the checksum, emit a non-fatal
      // warning so the workbook can surface CHECKSUM_FAIL status for this vessel.
      if (!result.imo && result.imoChecksumFailed) {
        result.errors.push(
          "IMO checksum failed: a 7-digit number was found in the header area but " +
          "did not pass the IMO Luhn checksum. The vessel will be matched by name only; " +
          "verify and correct the IMO manually before re-importing."
        );
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
        // ── DOB format detection ──────────────────────────────────────────────
        // Explicitly classify day/month ordering before calling parseDateString.
        // When both parts are ≤ 12 the format is ambiguous; we keep the raw
        // string and set dobStatus so the workbook can flag the cell for manual
        // review instead of silently picking the wrong date.
        const sanitizedDob = sanitizeXmlText(dobRaw);
        let parsedDob: string | null = null;
        let dobStatus: string | undefined;

        if (sanitizedDob) {
          const fmt = classifyDobFormat(sanitizedDob);
          if (fmt === "AMBIGUOUS") {
            dobStatus = "DOB_AMBIGUOUS";
            result.errors.push(
              `DOB "${sanitizedDob}" is ambiguous (both day and month parts are ≤ 12; ` +
              `DD/MM vs MM/DD cannot be determined). Kept as raw value — correct it in ` +
              `the workbook before re-uploading.`
            );
          } else if (fmt === "YYYY-FIRST") {
            // parseDateString only recognises the padded hyphen form (YYYY-MM-DD).
            // Slash-separated or unpadded year-first variants (e.g. 1990/01/02 or
            // 1990-1-2) fall through to its DD/MM matcher and produce a wrong value.
            // Normalise directly: split on the separator and zero-pad each part.
            const parts = sanitizedDob.split(/[-\/]/);
            parsedDob = `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
          } else if (fmt === "MM-FIRST") {
            // Second part > 12 means it can't be a month, so first part IS the month.
            // parseDateString always assumes DD-first, so we must invert the parts.
            const parts = sanitizedDob.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/)!;
            parsedDob = `${parts[3]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
          } else {
            // DD-FIRST or OTHER — parseDateString handles these correctly
            parsedDob = parseDateString(sanitizedDob);
          }
        }

        result.entries.push({
          familyName: val1,
          givenNames: val2,
          rankOrRating,
          dob: parsedDob ?? (dobStatus ? sanitizedDob : null),
          nationality: nationality || null,
          ...(dobStatus ? { dobStatus } : {}),
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
