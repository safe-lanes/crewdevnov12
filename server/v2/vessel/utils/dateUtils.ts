/**
 * Shared date-parsing utility for the vessel crew-list import pipeline.
 *
 * Both the DOCX parser (vesselCrewListParserService) and the Excel import
 * service (vesselCrewListImportService) previously maintained their own
 * implementations that could silently diverge.  This single source of truth
 * replaces both local copies.
 *
 * Recognised formats (in priority order):
 *   1. YYYY-MM-DD              → returned as-is
 *   2. DD/MM/YYYY or DD-MM-YYYY
 *   3. DD-MMM-YYYY or DD-MMM-YY  (e.g. 15-Jan-1985, 01-Jan-80)
 *   4. Excel serial number      (integers 20 000–90 000)
 *   5. JS / ISO Date string fallback  (new Date(str))
 *
 * Returns YYYY-MM-DD on success, null on failure.
 * Callers that need XML/Word-table sanitisation should strip tags before
 * passing (e.g. `parseDateString(sanitizeXmlText(raw))`).
 */
export function parseDateString(str: string | null | undefined): string | null {
  if (!str) return null;
  const trimmed = String(str).trim();
  if (!trimmed) return null;

  // 1. YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // 2. DD/MM/YYYY or DD-MM-YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (slashMatch) {
    const [, dd, mm, yyyy] = slashMatch;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }

  // 3. DD-MMM-YYYY or DD-MMM-YY  (e.g. 15-Jan-1985, 10-Apr-26)
  const monthNames: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const textMatch = trimmed.match(/^(\d{1,2})[\/\s-]([a-zA-Z]{3})[\/\s-](\d{2,4})$/);
  if (textMatch) {
    const [, dd, mmm, yyyyStr] = textMatch;
    const mm = monthNames[mmm.toLowerCase()];
    let yyyy = yyyyStr;
    if (yyyy.length === 2) {
      const yrNum = parseInt(yyyy, 10);
      yyyy = yrNum > 30 ? `19${yyyy}` : `20${yyyy}`;
    }
    if (mm) return `${yyyy}-${mm}-${dd.padStart(2, "0")}`;
  }

  // 4. Excel serial number (date-only serials sit in the 20 000–90 000 range)
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const serialNum = parseFloat(trimmed);
    if (serialNum > 20000 && serialNum < 90000) {
      const dateObj = new Date((serialNum - (25567 + 2)) * 86400 * 1000);
      if (!isNaN(dateObj.getTime())) {
        const yr = dateObj.getUTCFullYear();
        const mo = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
        const da = String(dateObj.getUTCDate()).padStart(2, "0");
        return `${yr}-${mo}-${da}`;
      }
    }
  }

  // 5. Fallback: native JS / ISO Date string
  const jsDate = new Date(trimmed);
  if (!isNaN(jsDate.getTime())) {
    const yr = jsDate.getFullYear();
    const mo = String(jsDate.getMonth() + 1).padStart(2, "0");
    const da = String(jsDate.getDate()).padStart(2, "0");
    return `${yr}-${mo}-${da}`;
  }

  return null;
}
