import type ExcelJS from "exceljs";
import { VERSION, blocksForVersion, cellLocation, type Block, type Field, type TemplateVersion } from "./contract";
import { SPOUSE_REQUIRED } from "./requirements";

// Only these server-generated heading formulas are allowed. Cached text never
// authorizes a formula, and formulas remain forbidden in ordinary input boxes.
export function spouseHeadingFormula(block: Block, field: Field, version: TemplateVersion): string | undefined {
  if (version !== VERSION || block.entity !== "family" || !SPOUSE_REQUIRED.some(key => key === field.key)) return;
  const family = blocksForVersion(version).find(item => item.entity === "family")!;
  const marital = cellLocation(family, family.fields.findIndex(item => item.key === "maritalStatus"), 0).replace(/([A-Z]+)(\d+)/, "$$$1$$$2");
  return `IF(TRIM(${marital})="Married","${field.label} *","${field.label}")`;
}

export function matchesHeadingFormula(value: ExcelJS.CellValue, expected: string): boolean {
  if (!value || typeof value !== "object" || !("formula" in value) || typeof value.formula !== "string") return false;
  // Excel/Calc may add a leading equals sign. Do not accept arbitrary equivalent
  // expressions, shared formulas, links or forged cached text.
  return value.formula.replace(/^=/, "") === expected;
}
