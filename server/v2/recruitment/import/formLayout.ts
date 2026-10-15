// Fixed single-sheet layout. Ranges are merged boxes; {r} is the record's
// first row and {s} its second row for the reference-style sea-service table.
export const FORM_SHEET = "APPLICATION FORM";
export const FORM_LAST_ROW = 234;
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
export const FORM_LAYOUT: Record<string, Layout> = {
  ...LEGACY_FORM_LAYOUT,
  vesselTypes: { start: 5, placements: [right(5, "AB")] },
};
export function columnLetter(column: number): string {
  let result = "";
  while (column > 0) { column--; result = String.fromCharCode(65 + column % 26) + result; column = Math.floor(column / 26); }
  return result;
}
