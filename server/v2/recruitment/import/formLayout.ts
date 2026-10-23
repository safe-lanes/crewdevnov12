// Fixed single-sheet layout. Ranges are merged boxes; {r} is the record's
// first row and {s} its second row for the reference-style sea-service table.
export const FORM_SHEET = "APPLICATION FORM";
export const FORM_LAST_ROW = 207;
export const PREVIOUS_FORM_LAST_ROW = 234;
export const FORM_GUIDELINE_START = 202;
export const LOOKUP_START_COLUMN = 34; // AH, after the A:AF print area and AG gap.
export type Placement = { label: string; input: string };
type Layout = { start: number; step?: number; placements: Placement[] };
const p = (label: string, input: string): Placement => ({ label, input });
const left = (row: number) => p(`A${row}:E${row}`, `F${row}:P${row}`);
const right = (row: number, end = "AF") => p(`Q${row}:U${row}`, `V${row}:${end}${row}`);
function table(start: number, columns: string[], widths: string[]): Layout {
  return { start, placements: columns.map((col, i) => p(`${col}${start - 1}:${widths[i]}${start - 1}`, `${col}{r}:${widths[i]}{r}`)) };
}
export const LEGACY_FORM_LAYOUT: Record<string, Layout> = {
  candidate: { start: 5, placements: [left(8), left(9), left(7), left(5), right(7, "AB"), left(15), right(6, "AB"), left(6)] },
  personal: { start: 8, placements: [right(8, "AB"), right(9, "AB"), right(11), right(12), right(13), right(14), right(16), right(17)] },
  address: { start: 11, placements: [left(17), left(18), left(11), left(12), left(13), left(14), left(16)] },
  family: { start: 15, placements: [right(15), right(18), left(20), left(21), left(22), left(23), left(24), left(25)] },
  nok: { start: 20, placements: [right(20), right(21), right(22), right(24), right(25), right(26), right(23)] },
  education: table(29, ["A", "I", "Q", "Y"], ["H", "P", "X", "AF"]),
  children: table(39, ["A", "G", "K", "Q", "U"], ["F", "J", "P", "T", "X"]),
  vesselTypes: table(39, ["Y"], ["AF"]),
  sea: { start: 51, step: 2, placements: [
    p("A49:H50", "A{r}:H{s}"), p("Q49:T50", "Q{r}:T{s}"),
    p("U49:X50", "U{r}:X{s}"), p("Y49:AB50", "Y{r}:AB{s}"),
    p("AC49:AF50", "AC{r}:AF{s}"), p("M49:P50", "M{r}:P{s}"),
    p("I49:L49", "I{r}:L{r}"), p("I50:L50", "I{s}:L{s}"),
  ] },
  documents: table(134, ["A", "G", "M", "Q", "U", "AA"], ["F", "L", "P", "T", "Z", "AF"]),
  visas: table(151, ["A", "G", "M", "Q", "U", "AA"], ["F", "L", "P", "T", "Z", "AF"]),
  licenses: table(163, ["A", "E", "I", "M", "Q", "W", "AA", "AD"], ["D", "H", "L", "P", "V", "Z", "AC", "AF"]),
  training: table(180, ["A", "E", "I", "M", "Q", "W", "AA", "AD"], ["D", "H", "L", "P", "V", "Z", "AC", "AF"]),
  additional: table(212, ["A", "Q"], ["P", "AF"]),
};
export const PREVIOUS_FORM_LAYOUT: Record<string, Layout> = {
  ...LEGACY_FORM_LAYOUT,
  vesselTypes: { start: 5, placements: [right(5, "AB")] },
};
// Placement order follows the stable data contract, not visual column order.
// Never change the old layouts when moving fields in a new template revision.
export const ALIGNED_FORM_LAYOUT: Record<string, Layout> = {
  candidate: { start: 6, placements: [left(8), right(8, "AB"), left(9), left(10), left(12), left(11), right(11), left(6)] },
  personal: { start: 12, placements: [right(13), left(14), right(12), left(13), right(14), right(15), left(15), left(16)] },
  vesselTypes: { start: 10, placements: [right(10)] },
  address: { start: 19, placements: [left(19), right(19), left(21), right(21), left(22), left(20), right(20)] },
  family: { start: 25, placements: [left(25), right(25), left(26), right(26), left(27), right(27), left(28), right(28)] },
  children: table(32, ["A", "H", "O", "V", "AB"], ["G", "N", "U", "AA", "AF"]),
  nok: { start: 41, placements: [left(41), right(41), left(42), left(44), right(42), left(43), right(43)] },
  documents: table(48, ["A", "G", "M", "Q", "U", "AA"], ["F", "L", "P", "T", "Z", "AF"]),
  visas: table(66, ["A", "G", "M", "Q", "U", "AA"], ["F", "L", "P", "T", "Z", "AF"]),
  education: table(79, ["A", "I", "Q", "Y"], ["H", "P", "X", "AF"]),
  licenses: table(90, ["A", "E", "I", "M", "Q", "W", "AA", "AD"], ["D", "H", "L", "P", "V", "Z", "AC", "AF"]),
  training: table(108, ["A", "E", "I", "M", "Q", "W", "AA", "AD"], ["D", "H", "L", "P", "V", "Z", "AC", "AF"]),
  sea: table(142, ["A", "I", "M", "P", "T", "X", "AA", "AD", "F"], ["E", "L", "O", "S", "W", "Z", "AC", "AF", "H"]),
  additional: table(185, ["A", "Q"], ["P", "AF"]),
};
// Revision 6: field order remains semantic; placements set the visual order.
export const FORM_LAYOUT: Record<string, Layout> = {
  ...ALIGNED_FORM_LAYOUT,
  documents: table(48, ["A", "I", "Q", "U", "Y"], ["H", "P", "T", "X", "AF"]),
  visas: table(66, ["A", "I", "Q", "U", "Y"], ["H", "P", "T", "X", "AF"]),
  education: table(79, ["Y", "Q", "I", "A"], ["AF", "X", "P", "H"]),
  licenses: table(90, ["A", "H", "L", "P", "V", "AB", "AE"], ["G", "K", "O", "U", "AA", "AD", "AF"]),
  training: table(108, ["A", "H", "L", "P", "V", "AB", "AE"], ["G", "K", "O", "U", "AA", "AD", "AF"]),
};
export const FORM_SECTION_BANDS = [
  ["A5:AF5", "A1.1 General Particulars"],
  ["A18:AF18", "A1.2 Address & Contact Info"],
  ["A24:AF24", "A1.3 Family and NOK"],
  ["A30:AF30", "Children Information"],
  ["A40:AF40", "Next Of Kin"],
  ["A46:AF46", "A2.1 Travel & Identification Documents"],
  ["A64:AF64", "A2.2 Visas"],
  ["A77:AF77", "A3.1 Education"],
  ["A88:AF88", "A3.2 License & DCE"],
  ["A106:AF106", "A3.3 Training Course"],
  ["A139:AF139", "A4.1 Details of Sea Service"],
  ["A183:AF183", "A5.1 Details on Additional Information required"],
  ["A201:AF201", "Guidelines for Filling and Uploading"],
];
export function columnLetter(column: number): string {
  let result = "";
  while (column > 0) { column--; result = String.fromCharCode(65 + column % 26) + result; column = Math.floor(column / 26); }
  return result;
}
