import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { MAX_CANDIDATE_ROWS, OUTCOMES, RULE_VERSION, type MatchResult, type NameInput } from './matcher';

export class CrewMatchError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
function boundedSetting(name: string, fallback: number, ceiling: number) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isSafeInteger(value) && value > 0 && value <= ceiling ? value : fallback;
}
export const MAX_ROWS = boundedSetting('CREW_MATCH_MAX_ROWS', 10000, 20000);
export const MAX_BYTES = boundedSetting('CREW_MATCH_MAX_BYTES', 5 * 1024 * 1024, 10 * 1024 * 1024);
const MAX_EXPANDED_BYTES = 50 * 1024 * 1024;

// Inspect/decompress in bounded streams before ExcelJS builds the workbook model.
// No uploaded workbook is ever saved to disk or executed.
export async function readNameWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_BYTES) {
    throw new CrewMatchError(`Upload a nonempty .xlsx file no larger than ${MAX_BYTES} bytes.`);
  }
  try {
    const zip = await JSZip.loadAsync(buffer);
    const entries = Object.values(zip.files).filter(entry => !entry.dir);
    if (entries.length > 500 || !zip.file('xl/workbook.xml') || entries.some(entry => /vbaProject\.bin$/i.test(entry.name))) {
      throw new CrewMatchError('Use a standard, macro-free .xlsx workbook (maximum 500 archive entries).');
    }
    let expanded = 0;
    for (const entry of entries) {
      // JSZip 3.x exposes this on ZipObject (and uses it for nodeStream/async),
      // but its bundled JSZipObject declaration omits the method.
      const stream = (entry as typeof entry & {
        internalStream(type: 'uint8array'): JSZip.JSZipStreamHelper<Uint8Array>;
      }).internalStream('uint8array');
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Uint8Array) => {
          expanded += chunk.length;
          if (expanded > MAX_EXPANDED_BYTES) {
            stream.pause();
            reject(new CrewMatchError('Workbook exceeds the expanded-data safety limit. Use the one-column template.'));
          }
        });
        stream.on('end', resolve);
        stream.on('error', reject);
        stream.resume();
      });
    }
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    if (workbook.worksheets.length > 50) throw new CrewMatchError('Maximum 50 worksheets allowed.');
    return workbook;
  } catch (error) {
    if (error instanceof CrewMatchError) throw error;
    throw new CrewMatchError('Cannot read workbook. Upload a valid, unencrypted .xlsx file.');
  }
}

function nameColumn(sheet: ExcelJS.Worksheet): number | undefined {
  const columns: number[] = [];
  sheet.getRow(1).eachCell((cell, column) => {
    if (typeof cell.value === 'string' && cell.value.trim().replace(/\s+/g, ' ').toLowerCase() === 'crew name') columns.push(column);
  });
  if (columns.length > 1) throw new CrewMatchError(`Worksheet "${sheet.name}" has multiple Crew Name columns.`);
  return columns[0];
}
export function eligibleSheets(workbook: ExcelJS.Workbook): string[] {
  const names = workbook.worksheets.filter(sheet => nameColumn(sheet) !== undefined).map(sheet => sheet.name);
  if (!names.length) throw new CrewMatchError('No worksheet has a Crew Name header in row 1. Use the template.');
  return names;
}
export function parseNameRows(workbook: ExcelJS.Workbook, selectedSheet: string): NameInput[] {
  if (!eligibleSheets(workbook).includes(selectedSheet)) throw new CrewMatchError('Select a worksheet containing a Crew Name column.');
  const sheet = workbook.getWorksheet(selectedSheet)!;
  const column = nameColumn(sheet)!;
  let last = 1;
  sheet.eachRow(row => { if (row.hasValues) last = Math.max(last, row.number); });
  if (last === 1) throw new CrewMatchError('Selected worksheet contains no crew names.');
  if (last - 1 > MAX_ROWS) throw new CrewMatchError(`Maximum ${MAX_ROWS} input rows allowed, including gaps inside the data range.`);
  const inputs: NameInput[] = [];
  for (let row = 2; row <= last; row++) {
    const cell = sheet.getCell(row, column);
    const value = cell.value;
    let name = '';
    let error: string | undefined;
    if (typeof value === 'string') name = value;
    else if (value && typeof value === 'object' && 'richText' in value) name = value.richText.map(part => part.text).join('');
    else if (value === null || value === undefined) error = 'Blank crew name.';
    else {
      name = cell.text;
      if (typeof value === 'object' && 'formula' in value) name = '=' + value.formula;
      error = 'Crew Name must be literal text, not a formula, date, number, error, or hyperlink.';
    }
    if (name.length > 32767) throw new CrewMatchError(`Row ${row} exceeds Excel's text-cell limit; no report generated.`);
    if (!error && !name.trim()) error = 'Blank crew name.';
    if (!error && name.length > 250) error = 'Crew name exceeds 250 characters; not matched.';
    inputs.push({ row, name, error });
  }
  return inputs;
}

function addTable(workbook: ExcelJS.Workbook, name: string, headers: string[], rows: (string | number | boolean)[][]) {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = headers.map(header => ({ header, width: /Reason|Warning|Candidate|Scope|Value/.test(header) ? 65 : 25 }));
  for (const row of rows) {
    if (row.some(value => typeof value === 'string' && value.length > 32767)) throw new CrewMatchError('Report contains a value exceeding Excel limits; no partial report generated.');
    // Assigning strings produces literal XLSX string cells, never formula objects.
    sheet.addRow(row);
  }
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16569E' } };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: headers.length } };
  sheet.eachRow(row => { row.alignment = { vertical: 'top', wrapText: true }; });
  return sheet;
}
export async function makeNameTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  addTable(workbook, 'Crew Names', ['Crew Name'], []);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
export async function buildNameReport(results: MatchResult[], metadata: { filename: string; worksheet: string; snapshotAt: string }): Promise<Buffer> {
  const candidateCount = results.reduce((sum, row) => sum + row.candidates.length, 0);
  if (candidateCount > MAX_CANDIDATE_ROWS) throw new CrewMatchError('Too many candidate rows for one report. Split the input workbook; no partial results generated.');
  const workbook = new ExcelJS.Workbook();
  const counts = OUTCOMES.map(outcome => [outcome, results.filter(row => row.outcome === outcome).length] as [string, number]);
  if (counts.reduce((sum, [, count]) => sum + count, 0) !== results.length) throw new Error('Report row reconciliation failed');
  addTable(workbook, 'Summary', ['Item', 'Value'], [
    ['Input filename', metadata.filename], ['Input worksheet', metadata.worksheet],
    ['Dataset read started (UTC)', metadata.snapshotAt], ['Report generated (UTC)', new Date().toISOString()],
    ['Matching rule version', RULE_VERSION], ['Input data rows', results.length], ...counts,
    ['Scope', 'Current authorized tenant; is_deleted=false. Archived records are candidates but require review.'],
    ['Identity limitation', 'Unique name match is not independently verified identity. This report does not rename folders or import attachments.'],
    ['Not found definition', 'No direct/reverse full-name match in this scope, not proof that a person does not exist in SAIL.'],
    ['Name rules', 'First + middle + family OR family + first + middle OR first name alone/reversed when middle/family are blank. NFC, case and whitespace normalized. No fuzzy matching or dropping populated middle names.'],
    ['Status rules', 'Known termination labels take precedence. Active/On Board/On Leave require is_active=true. Other, archived or missing states require review.'],
    ['Counts', 'Each input data row occurs once across the five outcome sheets. Ambiguous Candidates contains additional detail only.'],
  ]);
  const headers = ['Employee ID', 'Name', 'Status', 'Input Row', 'Input Crew Name', 'Match Method', 'Raw SAIL Status', 'Raw Active Flag', 'Archived At', 'Reason', 'Warnings', 'Crew UUID'];
  const dateText = (value: Date | string | null) => value instanceof Date ? value.toISOString() : value ?? '';
  for (const outcome of OUTCOMES.filter(value => value !== 'Ambiguous')) {
    addTable(workbook, outcome, headers, results.filter(row => row.outcome === outcome).map(row => {
      const candidate = row.candidates[0];
      return [candidate?.crew.empNo ?? '', candidate?.name ?? row.input.name, outcome === 'Not Found' ? 'Not found' : outcome,
        row.input.row, row.input.name, candidate?.methods.join(' + ') ?? '', candidate?.crew.status ?? '',
        candidate ? String(candidate.crew.isActive) : '', dateText(candidate?.crew.archivedAt ?? null), row.reason, row.warnings.join(' '), candidate?.crew.crewUuid ?? ''];
    }));
  }
  const ambiguous = results.filter(row => row.outcome === 'Ambiguous');
  const joined = (values: string[]) => {
    const text = values.join('\n');
    return text.length <= 30000 ? text : 'Full list in Ambiguous Candidates; exceeds summary-cell limit.';
  };
  addTable(workbook, 'Ambiguous', ['Input Row', 'Input Crew Name', 'Candidate Count', 'Candidate Employee IDs', 'Candidate Names', 'Candidate Statuses', 'Reason', 'Warnings'], ambiguous.map(row => {
    const lists = [row.candidates.map(c => c.crew.empNo ?? '(missing)'), row.candidates.map(c => c.name), row.candidates.map(c => c.status)];
    const overflow = lists.some(list => list.join('\n').length > 30000);
    return [row.input.row, row.input.name, row.candidates.length, ...lists.map(list => overflow ? 'See Ambiguous Candidates for all candidates.' : joined(list)), row.reason, row.warnings.join(' ')];
  }));
  addTable(workbook, 'Ambiguous Candidates', ['Input Row', 'Input Crew Name', 'Employee ID', 'Name', 'Status', 'Match Method', 'Raw SAIL Status', 'Raw Active Flag', 'Archived At', 'Reason', 'Crew UUID'], ambiguous.flatMap(row => row.candidates.map(c => [
    row.input.row, row.input.name, c.crew.empNo ?? '', c.name, c.status, c.methods.join(' + '), c.crew.status ?? '', String(c.crew.isActive), dateText(c.crew.archivedAt), c.reason, c.crew.crewUuid,
  ])));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
