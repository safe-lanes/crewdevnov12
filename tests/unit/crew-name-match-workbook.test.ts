// @vitest-environment node
import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { buildNameReport, eligibleSheets, makeNameTemplate, MAX_BYTES, MAX_ROWS, parseNameRows, readNameWorkbook } from '../../server/v2/crew-pool/services/crew-name-match/workbook';
import { matchCrewNames, type CrewIdentity } from '../../server/v2/crew-pool/services/crew-name-match/matcher';

const makeWorkbook = () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Names');
  sheet.addRow(['Crew Name']);
  return { workbook, sheet };
};
const asBuffer = async (workbook: ExcelJS.Workbook) => Buffer.from(await workbook.xlsx.writeBuffer());
const metadata = { filename: 'names.xlsx', worksheet: 'Names', snapshotAt: '2026-10-31T00:00:00.000Z' };
const crew = (changes: Partial<CrewIdentity> = {}): CrewIdentity => ({ crewUuid: '1', empNo: '00123', firstName: 'AZHAR', middleName: null, familyName: 'SIDDIQUE', status: 'On Leave', isActive: true, archivedAt: null, isDeleted: false, ...changes });

describe('Crew Match workbook input', () => {
  it('generates a blank one-column template', async () => {
    const workbook = await readNameWorkbook(await makeNameTemplate());
    expect(eligibleSheets(workbook)).toEqual(['Crew Names']);
    expect(workbook.worksheets[0].rowCount).toBe(1);
    expect(() => parseNameRows(workbook, 'Crew Names')).toThrow('no crew names');
  });
  it('round trips original names and source rows, ignoring trailing formatting', async () => {
    const { workbook, sheet } = makeWorkbook();
    sheet.addRow(['  AZHAR SIDDIQUE  ']);
    sheet.getCell('A4').value = 'SIDDIQUE AZHAR';
    sheet.getCell('A20000').font = { bold: true };
    const loaded = await readNameWorkbook(await asBuffer(workbook));
    expect(parseNameRows(loaded, 'Names')).toEqual([
      { row: 2, name: '  AZHAR SIDDIQUE  ', error: undefined },
      { row: 3, name: '', error: 'Blank crew name.' },
      { row: 4, name: 'SIDDIQUE AZHAR', error: undefined },
    ]);
  });
  it('finds sheets but never guesses a selection', () => {
    const { workbook, sheet } = makeWorkbook();
    sheet.addRow(['NAME']);
    workbook.addWorksheet('Other').addRow(['Crew Name']);
    expect(eligibleSheets(workbook)).toEqual(['Names', 'Other']);
    expect(() => parseNameRows(workbook, '')).toThrow('Select a worksheet');
  });
  it('rejects missing or duplicated header columns', () => {
    const { workbook, sheet } = makeWorkbook();
    sheet.getCell('A1').value = 'Unknown';
    expect(() => eligibleSheets(workbook)).toThrow('No worksheet');
    sheet.getCell('A1').value = 'Crew Name';
    sheet.getCell('B1').value = ' Crew  NAME ';
    expect(() => eligibleSheets(workbook)).toThrow('multiple Crew Name');
  });
  it('marks unsupported cells for review, preserving formula as literal text', () => {
    const { workbook, sheet } = makeWorkbook();
    sheet.addRow([{ formula: '1+1', result: 2 }]);
    sheet.addRow([123]);
    sheet.addRow([new Date('2026-01-01')]);
    sheet.addRow([{ error: '#VALUE!' }]);
    sheet.addRow([{ text: 'AZHAR', hyperlink: 'https://example.invalid' }]);
    sheet.addRow([' ']);
    const rows = parseNameRows(workbook, 'Names');
    expect(rows).toHaveLength(6);
    expect(rows.every(row => row.error)).toBe(true);
    expect(rows[0].name).toBe('=1+1');
  });
  it('supports literal rich text and additional columns; accounts for missing name rows', () => {
    const { workbook, sheet } = makeWorkbook();
    sheet.getCell('B1').value = 'Notes';
    sheet.addRow([{ richText: [{ text: 'AZHAR ' }, { text: 'SIDDIQUE' }] }, 'unused']);
    sheet.addRow([null, 'name missing']);
    expect(parseNameRows(workbook, 'Names')[0].name).toBe('AZHAR SIDDIQUE');
    expect(parseNameRows(workbook, 'Names')[1].error).toBe('Blank crew name.');
  });
  it('enforces row and name limits without truncating', () => {
    const { workbook, sheet } = makeWorkbook();
    sheet.addRow(['A'.repeat(251)]);
    expect(parseNameRows(workbook, 'Names')[0]).toMatchObject({ name: 'A'.repeat(251), error: expect.stringContaining('250') });
    sheet.getCell(MAX_ROWS + 2, 1).value = 'LAST';
    expect(() => parseNameRows(workbook, 'Names')).toThrow('Maximum');
  });
  it('rejects empty, oversized, invalid and non-xlsx ZIP uploads', async () => {
    await expect(readNameWorkbook(Buffer.alloc(0))).rejects.toThrow('nonempty');
    await expect(readNameWorkbook(Buffer.alloc(MAX_BYTES + 1))).rejects.toThrow('no larger');
    await expect(readNameWorkbook(Buffer.from('not excel'))).rejects.toThrow('Cannot read');
    const zip = new JSZip(); zip.file('hello.txt', 'hello');
    await expect(readNameWorkbook(await zip.generateAsync({ type: 'nodebuffer' }))).rejects.toThrow('standard');
  });
  it('rejects macro workbooks and excessive decompressed data', async () => {
    const zip = new JSZip(); zip.file('xl/workbook.xml', 'x'); zip.file('xl/vbaProject.bin', 'x');
    await expect(readNameWorkbook(await zip.generateAsync({ type: 'nodebuffer' }))).rejects.toThrow('macro-free');
    zip.remove('xl/vbaProject.bin');
    zip.file('xl/worksheets/sheet1.xml', Buffer.alloc(51 * 1024 * 1024, 65));
    await expect(readNameWorkbook(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }))).rejects.toThrow('expanded-data');
  });
});

describe('Crew Match output workbook', () => {
  it('reconciles every input row and exports exact IDs, names, status and candidate details', async () => {
    const records = [crew(), crew({ crewUuid: '2', empNo: 'K 2', firstName: 'RAVI', familyName: 'KUMAR', status: 'Terminated' }),
      crew({ crewUuid: '3', empNo: 'K 3', firstName: 'RAJ', familyName: 'SHARMA' }),
      crew({ crewUuid: '4', empNo: 'K 4', firstName: 'RAJ', familyName: 'SHARMA', status: 'Terminated' }),
      crew({ crewUuid: '5', empNo: 'K 5', firstName: 'OTHER', familyName: 'CREW', status: 'Inactive' })];
    const inputs = ['SIDDIQUE AZHAR', 'KUMAR RAVI', 'UNKNOWN', 'RAJ SHARMA', 'OTHER CREW'].map((name, i) => ({ row: i + 2, name }));
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await buildNameReport(matchCrewNames(inputs, records), metadata) as any);
    expect(workbook.worksheets.map(sheet => sheet.name)).toEqual(['Summary', 'Active', 'Terminated', 'Not Found', 'Review Required', 'Ambiguous', 'Ambiguous Candidates']);
    expect(workbook.getWorksheet('Active')!.getCell('A2').value).toBe('00123');
    expect(workbook.getWorksheet('Active')!.getCell('E2').value).toBe('SIDDIQUE AZHAR');
    expect(workbook.getWorksheet('Terminated')!.getCell('C2').value).toBe('Terminated');
    expect(workbook.getWorksheet('Not Found')!.getCell('A2').value ?? '').toBe('');
    expect(workbook.getWorksheet('Ambiguous')!.getCell('C2').value).toBe(2);
    expect(workbook.getWorksheet('Ambiguous Candidates')!.rowCount).toBe(3);
    const total = ['Active', 'Terminated', 'Not Found', 'Ambiguous', 'Review Required'].reduce((sum, name) => sum + workbook.getWorksheet(name)!.rowCount - 1, 0);
    expect(total).toBe(5);
  });
  it('keeps formula-like strings literal and repeated rows intact', async () => {
    const inputs = [{ row: 2, name: '=HYPERLINK("bad")' }, { row: 3, name: '=HYPERLINK("bad")' }];
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await buildNameReport(matchCrewNames(inputs, []), metadata) as any);
    const cell = workbook.getWorksheet('Not Found')!.getCell('E2');
    expect(cell.value).toBe(inputs[0].name);
    expect(cell.type).toBe(ExcelJS.ValueType.String);
    expect(workbook.getWorksheet('Not Found')!.rowCount).toBe(3);
  });
  it('generates and reopens a 2000-row workbook with reconciled counts', async () => {
    const inputs = Array.from({ length: 2000 }, (_, i) => ({ row: i + 2, name: `CREW ${i}` }));
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await buildNameReport(matchCrewNames(inputs, []), metadata) as any);
    expect(workbook.getWorksheet('Not Found')!.rowCount).toBe(2001);
  });
});
