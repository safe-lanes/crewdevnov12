import type ExcelJS from "exceljs";

export const FORM_COLORS = {
  text: "FF25313C", muted: "FF596773", label: "FFE7E7E7", sectionText: "FF111111",
  section: "FF808080", title: "FF808080", white: "FFFFFFFF",
  line: "FFBBC4CD", dotted: "FF9EAAB5", required: "FFC62828",
} as const;
export const FORM_LEGEND = "* Required; table fields only when a row is filled. Spouse fields are optional. Blank cells are not saved.";
export const PREVIOUS_LEGEND = "* Required; table fields only when a row is filled. Spouse fields only if Married. Blank cells are not saved.";
export const LEGACY_LEGEND = "Note: First name is required. Fill white input boxes; blank cells are not saved.";
export type BoxStyle = "input" | "label" | "section" | "title" | "note" | "meta";

export function styleBox(cell: ExcelJS.Cell, kind: BoxStyle, centered: boolean) {
  const heading = kind === "section" || kind === "title";
  cell.font = {
    name: "Calibri", size: kind === "title" ? 16 : kind === "section" ? 11 : kind === "note" || kind === "meta" ? 9 : 10,
    bold: heading || kind === "label",
    color: { argb: heading ? FORM_COLORS.sectionText : kind === "note" || kind === "meta" ? FORM_COLORS.muted : FORM_COLORS.text },
  };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb:
    kind === "title" ? FORM_COLORS.title : kind === "section" ? FORM_COLORS.section :
      kind === "label" ? FORM_COLORS.label : FORM_COLORS.white,
  } };
  cell.alignment = { vertical: "middle", horizontal: centered ? "center" : "left", wrapText: true, indent: centered ? 0 : 1 };
  const edge = { style: "thin" as const, color: { argb: FORM_COLORS.line } };
  const entryLine = { style: "dotted" as const, color: { argb: FORM_COLORS.dotted } };
  cell.border = {
    // Both sides of a shared entry-row boundary must be dotted; a thin top
    // on the next row otherwise hides the dotted bottom in Excel/Calc print.
    top: kind === "input" ? entryLine : edge, left: edge, right: edge,
    bottom: kind === "input" ? entryLine : edge,
  };
}

export function requiredLabel(label: string): ExcelJS.CellRichTextValue {
  return { richText: [
    { text: label, font: { name: "Calibri", size: 10, bold: true, color: { argb: FORM_COLORS.text } } },
    { text: " *", font: { name: "Calibri", size: 10, bold: true, color: { argb: FORM_COLORS.required } } },
  ] };
}

// Fixed text may be plain or Excel rich text, never a formula, link or cached result.
export function fixedText(value: ExcelJS.CellValue): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && Object.keys(value).length === 1 && "richText" in value
    && Array.isArray(value.richText) && value.richText.every(run => typeof run.text === "string")) {
    return value.richText.map(run => run.text).join("");
  }
  return undefined;
}
