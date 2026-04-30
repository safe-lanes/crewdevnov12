import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import JSZip from 'jszip';
import type { ExtendedDailyRecord } from '@/modules/rest-hours/types';
import { filterViolations } from '@/modules/rest-hours/violationFilters';

const A4_WIDTH = 842;
const A4_HEIGHT = 595;
const MARGIN = 15;
const CONTENT_WIDTH = A4_WIDTH - 2 * MARGIN;

const BORDER_COLOR = rgb(0.6, 0.6, 0.6);
const RED_COLOR = rgb(0.8, 0, 0);
const PLAN_TEXT_COLOR = rgb(0.6, 0.6, 0.6);

export interface RestHoursPDFData {
  vesselName: string;
  crewMemberName: string;
  rank: string;
  monthYear: string;
  records: ExtendedDailyRecord[];
  imoNumber?: string;
  flagOfShip?: string;
  watchkeeper?: boolean;
  seafarerFullName?: string;
  complianceMode?: 'Rest' | 'Work';
  opaMode?: boolean;
  showPlanning?: boolean;
}

interface RestHoursExportSanitizeOptions {
  monthYear: string;
  signOnDate?: string | null;
  signOffDate?: string | null;
  dateLineAdjustment?: { adjustments?: unknown } | null;
}

function parseAdvancedDays(dateLineAdjustment?: { adjustments?: unknown } | null): Set<number> {
  if (!dateLineAdjustment?.adjustments) return new Set();

  try {
    const adjustments = typeof dateLineAdjustment.adjustments === 'string'
      ? JSON.parse(dateLineAdjustment.adjustments)
      : dateLineAdjustment.adjustments;

    if (!Array.isArray(adjustments)) return new Set();

    return new Set(
      adjustments
        .filter((adj: any) => adj?.type === 'advanced' && Number.isFinite(Number(adj.day)))
        .map((adj: any) => Number(adj.day))
    );
  } catch {
    return new Set();
  }
}

function getApplicableDayRange(monthYear: string, signOnDate?: string | null, signOffDate?: string | null): { from: number; to: number } {
  const [year, month] = monthYear.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = `${monthYear}-01`;
  const lastDay = `${monthYear}-${String(daysInMonth).padStart(2, '0')}`;

  let from = 1;
  let to = daysInMonth;

  if (signOnDate && signOnDate >= firstDay && signOnDate <= lastDay) {
    from = parseInt(signOnDate.split('-')[2], 10);
  }
  if (signOffDate && signOffDate >= firstDay && signOffDate <= lastDay) {
    to = parseInt(signOffDate.split('-')[2], 10);
  }

  return { from, to };
}

function blankRecordForExport(record: ExtendedDailyRecord): ExtendedDailyRecord {
  return {
    ...record,
    hours: Array(48).fill(''),
    comments: '',
    violations: [],
    violationDiagnostics: [],
    hoursOfRest24hr: undefined as unknown as number,
    hoursOfWork24hr: undefined as unknown as number,
    hoursOfRest48hr: undefined as unknown as number,
    hoursOfWork48hr: undefined as unknown as number,
    hoursOfRest7day: undefined as unknown as number,
    hoursOfWork7day: undefined as unknown as number,
    hoursOfRest96hr: undefined as unknown as number,
    hoursOfWork96hr: undefined as unknown as number,
    anyPeriodRest24hr: undefined as unknown as number,
    anyPeriodRest7day: undefined as unknown as number,
    anyPeriodWork24hr: undefined as unknown as number,
    anyPeriodWork7day: undefined as unknown as number,
  };
}

export function sanitizeRestHoursRecordsForExport(
  records: ExtendedDailyRecord[],
  options: RestHoursExportSanitizeOptions
): ExtendedDailyRecord[] {
  const applicableDayRange = getApplicableDayRange(options.monthYear, options.signOnDate, options.signOffDate);
  const advancedDays = parseAdvancedDays(options.dateLineAdjustment);

  return records.map(record => {
    const isOutOfRange = record.day < applicableDayRange.from || record.day > applicableDayRange.to;
    const isAdvanced = advancedDays.has(record.day);

    return isOutOfRange || isAdvanced ? blankRecordForExport(record) : record;
  });
}

class RestHoursPDFGenerator {
  private pdfDoc!: PDFDocument;
  private currentPage!: PDFPage;
  private font!: PDFFont;
  private fontBold!: PDFFont;
  private fontOblique!: PDFFont;
  private fontBoldOblique!: PDFFont;
  private yPosition: number = A4_HEIGHT - MARGIN;
  
  private readonly dateColWidth = 28;
  private readonly dayColWidth = 24;
  private readonly halfHourCellWidth = 12;
  private readonly rhColWidth = 26;
  private readonly violationsColWidth = 38;
  private readonly commentsColWidth = 65;
  private readonly restPeriodColWidth = 28;
  
  async initialize(): Promise<void> {
    this.pdfDoc = await PDFDocument.create();
    this.font = await this.pdfDoc.embedFont(StandardFonts.Helvetica);
    this.fontBold = await this.pdfDoc.embedFont(StandardFonts.HelveticaBold);
    this.fontOblique = await this.pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    this.fontBoldOblique = await this.pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);
    this.addNewPage();
  }
  
  private addNewPage(): void {
    this.currentPage = this.pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    this.yPosition = A4_HEIGHT - MARGIN;
  }
  
  drawText(text: string, x: number, y: number, fontSize: number = 8, fontType: 'normal' | 'bold' | 'italic' | 'boldItalic' = 'normal', color = rgb(0, 0, 0)): void {
    let font = this.font;
    if (fontType === 'bold') font = this.fontBold;
    else if (fontType === 'italic') font = this.fontOblique;
    else if (fontType === 'boldItalic') font = this.fontBoldOblique;
    
    this.currentPage.drawText(text || '', {
      x,
      y,
      size: fontSize,
      font,
      color,
    });
  }
  
  drawLine(x1: number, y1: number, x2: number, y2: number, thickness: number = 0.5, color = BORDER_COLOR): void {
    this.currentPage.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness,
      color,
    });
  }
  
  drawRect(x: number, y: number, width: number, height: number, borderColor = BORDER_COLOR, fillColor?: typeof rgb extends (...args: any) => infer R ? R : never): void {
    if (fillColor) {
      this.currentPage.drawRectangle({
        x,
        y,
        width,
        height,
        color: fillColor,
      });
    }
    this.currentPage.drawRectangle({
      x,
      y,
      width,
      height,
      borderColor,
      borderWidth: 0.5,
    });
  }
  
  private drawCheckbox(x: number, y: number, checked: boolean, size: number = 8): void {
    this.drawRect(x, y, size, size, BORDER_COLOR);
    if (checked) {
      const startX = x + 1.5;
      const startY = y + size / 2;
      const midX = x + size / 3;
      const midY = y + 1.5;
      const endX = x + size - 1.5;
      const endY = y + size - 2;
      
      this.drawLine(startX, startY, midX, midY, 1, rgb(0, 0, 0));
      this.drawLine(midX, midY, endX, endY, 1, rgb(0, 0, 0));
    }
  }
  
  private getTableWidth(): number {
    const hoursColumnsWidth = 48 * this.halfHourCellWidth;
    return this.dateColWidth + this.dayColWidth + hoursColumnsWidth + 
           this.rhColWidth + this.violationsColWidth + this.commentsColWidth + 
           this.restPeriodColWidth * 2;
  }
  
  private drawDocumentHeader(data: RestHoursPDFData): number {
    const isWorkMode = data.complianceMode === 'Work';
    let currentY = this.yPosition;
    const pageWidth = A4_WIDTH;
    const leftMargin = MARGIN;
    
    this.drawLine(leftMargin, currentY, pageWidth - MARGIN, currentY, 1, rgb(0.3, 0.3, 0.3));
    currentY -= 18;
    
    const title = isWorkMode ? 'RECORD OF HOURS OF WORK' : 'RECORD OF HOURS OF REST';
    const titleWidth = this.fontBold.widthOfTextAtSize(title, 14);
    const titleX = (pageWidth - titleWidth) / 2;
    this.drawText(title, titleX, currentY, 14, 'bold');
    currentY -= 16;
    
    const col1X = leftMargin;
    const col2X = 320;
    const col3X = 560;
    const labelFontSize = 8;
    const valueFontSize = 8;
    
    this.drawText('Name Of Ship :', col1X, currentY, labelFontSize, 'bold');
    this.drawText(data.vesselName || '', col1X + 80, currentY, valueFontSize);
    
    this.drawText('IMO Number :', col2X, currentY, labelFontSize, 'bold');
    this.drawText(data.imoNumber || '', col2X + 75, currentY, valueFontSize);
    
    this.drawText('Flag of ship:', col3X, currentY, labelFontSize, 'bold');
    this.drawText(data.flagOfShip || '', col3X + 70, currentY, valueFontSize);
    currentY -= 12;
    
    this.drawText('Seafarer FullName :', col1X, currentY, labelFontSize, 'bold');
    this.drawText(data.seafarerFullName || data.crewMemberName || '', col1X + 100, currentY, valueFontSize);
    
    this.drawText('Position/Rank :', col3X, currentY, labelFontSize, 'bold');
    this.drawText(data.rank || '', col3X + 80, currentY, valueFontSize);
    currentY -= 12;
    
    this.drawText('Month and Year :', col1X, currentY, labelFontSize, 'bold');
    this.drawText(data.monthYear || '', col1X + 90, currentY, valueFontSize);
    
    this.drawText('Watchkeeper :', col3X, currentY, labelFontSize, 'bold');
    const watchkeeperX = col3X + 75;
    const isWatchkeeper = data.watchkeeper === true;
    this.drawCheckbox(watchkeeperX, currentY - 2, isWatchkeeper, 8);
    this.drawText('Yes', watchkeeperX + 12, currentY, 7);
    this.drawCheckbox(watchkeeperX + 35, currentY - 2, !isWatchkeeper, 8);
    this.drawText('No', watchkeeperX + 47, currentY, 7);
    currentY -= 12;
    
    this.drawText('Please mark periods of work with a "d", "a", and "w"', col1X, currentY, 7);
    currentY -= 10;
    
    return currentY;
  }
  
  private drawTableHeader(tableStartX: number, startY: number, complianceMode: 'Rest' | 'Work'): number {
    const isWorkMode = complianceMode === 'Work';
    const tableWidth = this.getTableWidth();
    const headerHeight = 28;
    
    this.drawRect(tableStartX, startY - headerHeight, tableWidth, headerHeight, BORDER_COLOR);
    
    let headerX = tableStartX;
    const headerTextY = startY - 10;
    const headerTextY2 = startY - 20;
    
    this.drawText('Date', headerX + 3, headerTextY, 6, 'bold');
    this.drawLine(headerX + this.dateColWidth, startY, headerX + this.dateColWidth, startY - headerHeight);
    headerX += this.dateColWidth;
    
    this.drawText('Day', headerX + 3, headerTextY, 6, 'bold');
    this.drawLine(headerX + this.dayColWidth, startY, headerX + this.dayColWidth, startY - headerHeight);
    headerX += this.dayColWidth;
    
    for (let h = 0; h < 24; h++) {
      const hourStr = h.toString().padStart(2, '0');
      this.drawText(hourStr, headerX + 3, headerTextY, 5, 'normal');
      
      const hourWidth = this.halfHourCellWidth * 2;
      this.drawLine(headerX + hourWidth, startY, headerX + hourWidth, startY - headerHeight, 0.5);
      this.drawLine(headerX + this.halfHourCellWidth, startY - headerHeight + 8, headerX + this.halfHourCellWidth, startY - headerHeight, 0.25, rgb(0.75, 0.75, 0.75));
      
      headerX += hourWidth;
    }
    
    const modeLabel = isWorkMode ? 'Work in' : 'Rest in';
    this.drawText('Hours of', headerX + 1, headerTextY + 2, 3.5, 'bold');
    this.drawText(modeLabel, headerX + 1, headerTextY2 + 9, 3.5, 'bold');
    this.drawText('24-Hours', headerX + 1, headerTextY2 + 2, 3.5, 'bold');
    this.drawText('period', headerX + 1, headerTextY2 - 5, 3.5, 'bold');
    this.drawLine(headerX + this.rhColWidth, startY, headerX + this.rhColWidth, startY - headerHeight);
    headerX += this.rhColWidth;
    
    this.drawText('Viol.', headerX + 2, headerTextY, 5, 'bold');
    this.drawLine(headerX + this.violationsColWidth, startY, headerX + this.violationsColWidth, startY - headerHeight);
    headerX += this.violationsColWidth;
    
    this.drawText('Comments', headerX + 2, headerTextY, 5, 'bold');
    this.drawLine(headerX + this.commentsColWidth, startY, headerX + this.commentsColWidth, startY - headerHeight);
    headerX += this.commentsColWidth;
    
    const restSectionWidth = this.restPeriodColWidth * 2;
    this.drawRect(headerX, startY - headerHeight, restSectionWidth, headerHeight, BORDER_COLOR);
    const anyLabel = isWorkMode ? 'Work in any' : 'Rest in any';
    this.drawText(anyLabel, headerX + 3, headerTextY, 5, 'bold');
    
    this.drawText('24hr', headerX + 3, headerTextY2, 5, 'normal');
    this.drawLine(headerX + this.restPeriodColWidth, startY - 12, headerX + this.restPeriodColWidth, startY - headerHeight);
    this.drawText('7day', headerX + this.restPeriodColWidth + 3, headerTextY2, 5, 'normal');
    
    return startY - headerHeight;
  }
  
  private normalizeHours(hours: string[] | undefined): string[] {
    const normalized = new Array(48).fill('');
    if (hours && Array.isArray(hours)) {
      for (let i = 0; i < Math.min(hours.length, 48); i++) {
        normalized[i] = hours[i] || '';
      }
    }
    return normalized;
  }
  
  private drawSecondPage(complianceMode: 'Rest' | 'Work'): void {
    const isWorkMode = complianceMode === 'Work';
    this.addNewPage();
    let currentY = this.yPosition - 30;
    const leftMargin = MARGIN + 15;
    const rightMargin = A4_WIDTH - MARGIN - 15;
    const lineWidth = rightMargin - leftMargin;
    const signatureLineWidth = 380;
    
    this.drawText('1', leftMargin, currentY, 7);
    const footnote1 = 'For completion and use in accordance with the procedures established by the competent authority in compliance with the relevant requirements of the Seafarers\' Hours of Work and the Manning of Ships Convention, 1996 (Convention No. 180).';
    this.drawWrappedText(footnote1, leftMargin + 12, currentY, 7, lineWidth - 12);
    currentY -= 30;
    
    this.drawText('2', leftMargin, currentY, 7);
    const footnote2 = 'Additional calculations or verifications may be necessary to ensure compliance with the relevant requirements of the seafarers\' Hours of Work and the Manning of Ships Convention, 1996 (Convention No. 180) and the International Convention on Standards of Training, Certification and Watchkeeping, 1978, as amended (STCW Convention).';
    this.drawWrappedText(footnote2, leftMargin + 12, currentY, 7, lineWidth - 12);
    currentY -= 50;
    
    this.drawText('The following national laws, regulations and/or collective limitations on working hours:', leftMargin, currentY, 8);
    currentY -= 25;
    
    this.drawLine(leftMargin, currentY, rightMargin, currentY, 0.5);
    currentY -= 50;
    
    const hoursType = isWorkMode ? 'hours of work' : 'hours of rest';
    const agreementText = `I agree that this record is an accurate reflection of the ${hoursType} of the seafarer concerned.`;
    this.drawText(agreementText, leftMargin, currentY, 9, 'boldItalic');
    currentY -= 30;
    
    this.drawText('Name of master or person authorized by master to sign this record', leftMargin, currentY, 8);
    this.drawLine(leftMargin + 330, currentY - 2, leftMargin + 330 + signatureLineWidth, currentY - 2, 0.5);
    currentY -= 22;
    
    this.drawText('Signature of master or authorized person', leftMargin, currentY, 8);
    this.drawLine(leftMargin + 230, currentY - 2, leftMargin + 230 + signatureLineWidth + 100, currentY - 2, 0.5);
    currentY -= 35;
    
    this.drawText('Signature of seafarer', leftMargin, currentY, 8);
    this.drawLine(leftMargin + 120, currentY - 2, leftMargin + 120 + signatureLineWidth, currentY - 2, 0.5);
  }
  
  private drawWrappedText(text: string, x: number, startY: number, fontSize: number, maxWidth: number): void {
    const words = text.split(' ');
    let line = '';
    let y = startY;
    
    for (const word of words) {
      const testLine = line + (line ? ' ' : '') + word;
      const testWidth = this.font.widthOfTextAtSize(testLine, fontSize);
      
      if (testWidth > maxWidth && line) {
        this.drawText(line, x, y, fontSize);
        line = word;
        y -= fontSize + 2;
      } else {
        line = testLine;
      }
    }
    
    if (line) {
      this.drawText(line, x, y, fontSize);
    }
  }
  
  async generate(data: RestHoursPDFData): Promise<Uint8Array> {
    await this.initialize();
    
    const complianceMode = data.complianceMode || 'Rest';
    const opaMode = data.opaMode ?? false;
    const showPlanning = data.showPlanning ?? true;
    const isWorkMode = complianceMode === 'Work';
    
    const tableStartX = MARGIN;
    const tableWidth = this.getTableWidth();
    const rowHeight = 12;
    
    let currentY = this.drawDocumentHeader(data);
    
    currentY = this.drawTableHeader(tableStartX, currentY, complianceMode);
    
    const visibleRecords = showPlanning
      ? data.records
      : data.records.filter(r => !r.isPlan);
    
    for (let i = 0; i < visibleRecords.length; i++) {
      const record = visibleRecords[i];
      
      if (currentY - rowHeight < MARGIN + 40) {
        this.addNewPage();
        currentY = this.yPosition - 10;
        
        const continuedTitle = isWorkMode
          ? 'RECORD OF HOURS OF WORK (continued)'
          : 'RECORD OF HOURS OF REST (continued)';
        this.drawText(continuedTitle, MARGIN, currentY, 10, 'bold');
        currentY -= 15;
        
        currentY = this.drawTableHeader(tableStartX, currentY, complianceMode);
      }
      
      const rowY = currentY - rowHeight;
      let cellX = tableStartX;
      
      const isPlan = record.isPlan;
      const rowBgColor = isPlan ? rgb(0.9, 0.9, 0.9) : undefined;
      const textColor = isPlan ? PLAN_TEXT_COLOR : rgb(0, 0, 0);
      
      if (rowBgColor) {
        this.drawRect(tableStartX, rowY, tableWidth, rowHeight, BORDER_COLOR, rowBgColor);
      }
      
      this.drawRect(cellX, rowY, this.dateColWidth, rowHeight, BORDER_COLOR);
      this.drawText(record.day.toString(), cellX + 8, rowY + 3, 6, 'normal', textColor);
      cellX += this.dateColWidth;
      
      this.drawRect(cellX, rowY, this.dayColWidth, rowHeight, BORDER_COLOR);
      this.drawText(record.dayOfWeek || '', cellX + 3, rowY + 3, 6, 'normal', textColor);
      cellX += this.dayColWidth;
      
      const normalizedHours = this.normalizeHours(record.hours);
      
      for (let halfHourIdx = 0; halfHourIdx < 48; halfHourIdx++) {
        const cellValue = normalizedHours[halfHourIdx];
        
        this.drawRect(cellX, rowY, this.halfHourCellWidth, rowHeight, BORDER_COLOR);
        
        if (cellValue) {
          this.drawText(cellValue.toLowerCase(), cellX + 3, rowY + 3, 5, 'normal', textColor);
        }
        
        cellX += this.halfHourCellWidth;
      }
      
      this.drawRect(cellX, rowY, this.rhColWidth, rowHeight, BORDER_COLOR);
      const hoursIn24 = isWorkMode ? record.hoursOfWork24hr : record.hoursOfRest24hr;
      this.drawText(hoursIn24?.toString() || '', cellX + 5, rowY + 3, 6, 'normal', textColor);
      cellX += this.rhColWidth;
      
      this.drawRect(cellX, rowY, this.violationsColWidth, rowHeight, BORDER_COLOR);
      if (record.violations && record.violations.length > 0) {
        const visibleViolations = filterViolations(record.violations, complianceMode, opaMode);
        if (visibleViolations.length > 0) {
          const violationsText = visibleViolations.join(', ');
          const violColor = isPlan ? PLAN_TEXT_COLOR : RED_COLOR;
          this.drawText(violationsText, cellX + 2, rowY + 3, 5, 'normal', violColor);
        }
      }
      cellX += this.violationsColWidth;
      
      this.drawRect(cellX, rowY, this.commentsColWidth, rowHeight, BORDER_COLOR);
      const truncatedComment = (record.comments || '').substring(0, 15);
      this.drawText(truncatedComment, cellX + 2, rowY + 3, 5, 'normal', textColor);
      cellX += this.commentsColWidth;
      
      this.drawRect(cellX, rowY, this.restPeriodColWidth, rowHeight, BORDER_COLOR);
      if (isWorkMode) {
        const work24hr = record.anyPeriodWork24hr?.toFixed(1) || '';
        const is24hrViolation = !isPlan && (record.anyPeriodWork24hr || 0) > 14;
        this.drawText(work24hr, cellX + 3, rowY + 3, 5, 'normal', isPlan ? PLAN_TEXT_COLOR : (is24hrViolation ? RED_COLOR : rgb(0, 0, 0)));
      } else {
        const rest24hr = record.anyPeriodRest24hr?.toFixed(1) || '';
        const is24hrViolation = !isPlan && (record.anyPeriodRest24hr || 0) < 10;
        this.drawText(rest24hr, cellX + 3, rowY + 3, 5, 'normal', isPlan ? PLAN_TEXT_COLOR : (is24hrViolation ? RED_COLOR : rgb(0, 0, 0)));
      }
      cellX += this.restPeriodColWidth;
      
      this.drawRect(cellX, rowY, this.restPeriodColWidth, rowHeight, BORDER_COLOR);
      if (isWorkMode) {
        const work7day = record.anyPeriodWork7day?.toFixed(1) || '';
        const is7dayViolation = !isPlan && (record.anyPeriodWork7day || 0) > 72;
        this.drawText(work7day, cellX + 2, rowY + 3, 5, 'normal', isPlan ? PLAN_TEXT_COLOR : (is7dayViolation ? RED_COLOR : rgb(0, 0, 0)));
      } else {
        const rest7day = record.anyPeriodRest7day?.toFixed(1) || '';
        const is7dayViolation = !isPlan && (record.anyPeriodRest7day || 0) < 77;
        this.drawText(rest7day, cellX + 2, rowY + 3, 5, 'normal', isPlan ? PLAN_TEXT_COLOR : (is7dayViolation ? RED_COLOR : rgb(0, 0, 0)));
      }
      
      currentY = rowY;
    }
    
    const legendHeight = 25;
    if (currentY - legendHeight < MARGIN + 10) {
      this.addNewPage();
      currentY = this.yPosition - 20;
    }
    
    const legendY = currentY - 15;
    this.drawText('Legend: w: Watch, a: Additional Work, d: Day Work, blank: Rest', tableStartX, legendY, 6);
    
    this.drawSecondPage(complianceMode);
    
    return this.pdfDoc.save();
  }
}

export async function generateRestHoursPDF(data: RestHoursPDFData): Promise<void> {
  try {
    const generator = new RestHoursPDFGenerator();
    const pdfBytes = await generator.generate(data);
    
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Rest_Hour_Record_Extract.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to generate Rest Hours PDF:', error);
    throw error;
  }
}

export async function generateRestHoursPDFBytes(data: RestHoursPDFData): Promise<Uint8Array> {
  const generator = new RestHoursPDFGenerator();
  return generator.generate(data);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');
}

function formatMonthYearDisplay(monthValue: string): string {
  if (!monthValue) return '';
  const [year, month] = monthValue.split('-').map(Number);
  if (!year || !month) return monthValue;
  const date = new Date(year, month - 1, 1);
  const monthName = date.toLocaleDateString('en-US', { month: 'short' });
  return `${monthName}-${year}`;
}

export async function exportAllRestHoursPDFs(
  crewRecords: Array<{
    crewMemberId: string;
    vesselId: string;
    name: string;
    rank: string;
    monthValue: string;
    signOnDate?: string | null;
    signOffDate?: string | null;
  }>,
  vesselInfo: {
    vesselName: string;
    imoNumber?: string;
    flagOfShip?: string;
  },
  fetchDailyRecords: (
    crewMemberId: string,
    vesselId: string,
    monthYear: string
  ) => Promise<ExtendedDailyRecord[] | { records: ExtendedDailyRecord[]; watchkeeper?: boolean }>,
  onProgress?: (current: number, total: number) => void,
  options?: {
    complianceMode?: 'Rest' | 'Work';
    opaMode?: boolean;
    showPlanning?: boolean;
    dateLineAdjustment?: { adjustments?: unknown } | null;
  }
): Promise<void> {
  try {
    const zip = new JSZip();
    const total = crewRecords.length;
    
    const complianceMode = options?.complianceMode || 'Rest';
    const opaMode = options?.opaMode ?? false;
    const showPlanning = options?.showPlanning ?? true;
    
    for (let i = 0; i < crewRecords.length; i++) {
      const crew = crewRecords[i];
      
      if (onProgress) {
        onProgress(i + 1, total);
      }
      
      const monthYear = crew.monthValue;
      const monthYearDisplay = formatMonthYearDisplay(monthYear);
      const fetched = await fetchDailyRecords(crew.crewMemberId, crew.vesselId, monthYear);
      const records = Array.isArray(fetched) ? fetched : fetched.records;
      const watchkeeper = Array.isArray(fetched) ? false : (fetched.watchkeeper ?? false);
      const exportRecords = sanitizeRestHoursRecordsForExport(records, {
        monthYear,
        signOnDate: crew.signOnDate,
        signOffDate: crew.signOffDate,
        dateLineAdjustment: options?.dateLineAdjustment,
      });

      const pdfData: RestHoursPDFData = {
        vesselName: vesselInfo.vesselName,
        crewMemberName: crew.name,
        rank: crew.rank,
        monthYear: monthYearDisplay,
        records: exportRecords,
        imoNumber: vesselInfo.imoNumber,
        flagOfShip: vesselInfo.flagOfShip,
        watchkeeper,
        seafarerFullName: `${crew.rank}-${crew.name.toUpperCase()}`,
        complianceMode,
        opaMode,
        showPlanning,
      };
      
      const pdfBytes = await generateRestHoursPDFBytes(pdfData);
      
      const fileName = `Rest_Hour_Record_Extract_${sanitizeFilename(crew.rank)}_${sanitizeFilename(crew.name.toUpperCase())}_${monthYearDisplay}.pdf`;
      zip.file(fileName, pdfBytes);
    }
    
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    
    const firstMonthDisplay = formatMonthYearDisplay(crewRecords[0]?.monthValue || '');
    const link = document.createElement('a');
    link.href = url;
    link.download = `Rest_Hour_Records_Export_${sanitizeFilename(vesselInfo.vesselName)}_${firstMonthDisplay || 'Export'}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to export all Rest Hours PDFs:', error);
    throw error;
  }
}
