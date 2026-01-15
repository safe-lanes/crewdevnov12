import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import JSZip from 'jszip';
import type { ExtendedDailyRecord } from '@/modules/rest-hours/types';

// A4 Landscape dimensions (842 x 595 pts)
const A4_WIDTH = 842;
const A4_HEIGHT = 595;
const MARGIN = 15;
const CONTENT_WIDTH = A4_WIDTH - 2 * MARGIN;

// Colors (black-and-white styling)
const BORDER_COLOR = rgb(0.6, 0.6, 0.6);
const RED_COLOR = rgb(0.8, 0, 0);

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
}

class RestHoursPDFGenerator {
  private pdfDoc!: PDFDocument;
  private currentPage!: PDFPage;
  private font!: PDFFont;
  private fontBold!: PDFFont;
  private fontOblique!: PDFFont;
  private fontBoldOblique!: PDFFont;
  private yPosition: number = A4_HEIGHT - MARGIN;
  
  // Column widths (all 48 half-hour cells)
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
  
  // Draw checkbox (small square with optional checkmark using stroke paths)
  private drawCheckbox(x: number, y: number, checked: boolean, size: number = 8): void {
    this.drawRect(x, y, size, size, BORDER_COLOR);
    if (checked) {
      // Draw a checkmark using lines
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
  
  // Draw document header matching reference design
  private drawDocumentHeader(data: RestHoursPDFData): number {
    let currentY = this.yPosition;
    const pageWidth = A4_WIDTH;
    const leftMargin = MARGIN;
    
    // Draw horizontal line at top
    this.drawLine(leftMargin, currentY, pageWidth - MARGIN, currentY, 1, rgb(0.3, 0.3, 0.3));
    currentY -= 18;
    
    // Centered title: "RECORD OF HOURS OF WORK"
    const title = 'RECORD OF HOURS OF WORK';
    const titleWidth = this.fontBold.widthOfTextAtSize(title, 14);
    const titleX = (pageWidth - titleWidth) / 2;
    this.drawText(title, titleX, currentY, 14, 'bold');
    currentY -= 16;
    
    // Three-column layout for metadata
    const col1X = leftMargin;
    const col2X = 320;
    const col3X = 560;
    const labelFontSize = 8;
    const valueFontSize = 8;
    
    // Row 1: Name Of Ship, IMO Number, Flag of ship
    this.drawText('Name Of Ship :', col1X, currentY, labelFontSize, 'bold');
    this.drawText(data.vesselName || '', col1X + 80, currentY, valueFontSize);
    
    this.drawText('IMO Number :', col2X, currentY, labelFontSize, 'bold');
    this.drawText(data.imoNumber || '', col2X + 75, currentY, valueFontSize);
    
    this.drawText('Flag of ship:', col3X, currentY, labelFontSize, 'bold');
    this.drawText(data.flagOfShip || '', col3X + 70, currentY, valueFontSize);
    currentY -= 12;
    
    // Row 2: Seafarer FullName, (blank), Position/Rank
    this.drawText('Seafarer FullName :', col1X, currentY, labelFontSize, 'bold');
    this.drawText(data.seafarerFullName || data.crewMemberName || '', col1X + 100, currentY, valueFontSize);
    
    this.drawText('Position/Rank :', col3X, currentY, labelFontSize, 'bold');
    this.drawText(data.rank || '', col3X + 80, currentY, valueFontSize);
    currentY -= 12;
    
    // Row 3: Month and Year, (blank), Watchkeeper with checkboxes
    this.drawText('Month and Year :', col1X, currentY, labelFontSize, 'bold');
    this.drawText(data.monthYear || '', col1X + 90, currentY, valueFontSize);
    
    this.drawText('Watchkeeper :', col3X, currentY, labelFontSize, 'bold');
    const watchkeeperX = col3X + 75;
    this.drawCheckbox(watchkeeperX, currentY - 2, false, 8);
    this.drawText('Yes', watchkeeperX + 12, currentY, 7);
    this.drawCheckbox(watchkeeperX + 35, currentY - 2, false, 8);
    this.drawText('No', watchkeeperX + 47, currentY, 7);
    currentY -= 12;
    
    // Instruction text
    this.drawText('Please mark periods of work with a "d", "a", and "w"', col1X, currentY, 7);
    currentY -= 10;
    
    return currentY;
  }
  
  // Draw table header (reusable for each page)
  private drawTableHeader(tableStartX: number, startY: number): number {
    const tableWidth = this.getTableWidth();
    const headerHeight = 28;
    
    this.drawRect(tableStartX, startY - headerHeight, tableWidth, headerHeight, BORDER_COLOR);
    
    let headerX = tableStartX;
    const headerTextY = startY - 10;
    const headerTextY2 = startY - 20;
    
    // Date column header
    this.drawText('Date', headerX + 3, headerTextY, 6, 'bold');
    this.drawLine(headerX + this.dateColWidth, startY, headerX + this.dateColWidth, startY - headerHeight);
    headerX += this.dateColWidth;
    
    // Day column header
    this.drawText('Day', headerX + 3, headerTextY, 6, 'bold');
    this.drawLine(headerX + this.dayColWidth, startY, headerX + this.dayColWidth, startY - headerHeight);
    headerX += this.dayColWidth;
    
    // Hours columns header (00-23)
    for (let h = 0; h < 24; h++) {
      const hourStr = h.toString().padStart(2, '0');
      this.drawText(hourStr, headerX + 3, headerTextY, 5, 'normal');
      
      const hourWidth = this.halfHourCellWidth * 2;
      this.drawLine(headerX + hourWidth, startY, headerX + hourWidth, startY - headerHeight, 0.5);
      this.drawLine(headerX + this.halfHourCellWidth, startY - headerHeight + 8, headerX + this.halfHourCellWidth, startY - headerHeight, 0.25, rgb(0.75, 0.75, 0.75));
      
      headerX += hourWidth;
    }
    
    // Hours of Rest in 24-Hours period column
    this.drawText('Hours of', headerX + 1, headerTextY + 2, 3.5, 'bold');
    this.drawText('Rest in', headerX + 1, headerTextY2 + 9, 3.5, 'bold');
    this.drawText('24-Hours', headerX + 1, headerTextY2 + 2, 3.5, 'bold');
    this.drawText('period', headerX + 1, headerTextY2 - 5, 3.5, 'bold');
    this.drawLine(headerX + this.rhColWidth, startY, headerX + this.rhColWidth, startY - headerHeight);
    headerX += this.rhColWidth;
    
    // Violations column
    this.drawText('Viol.', headerX + 2, headerTextY, 5, 'bold');
    this.drawLine(headerX + this.violationsColWidth, startY, headerX + this.violationsColWidth, startY - headerHeight);
    headerX += this.violationsColWidth;
    
    // Comments column
    this.drawText('Comments', headerX + 2, headerTextY, 5, 'bold');
    this.drawLine(headerX + this.commentsColWidth, startY, headerX + this.commentsColWidth, startY - headerHeight);
    headerX += this.commentsColWidth;
    
    // Hours of Rest in any section
    const restSectionWidth = this.restPeriodColWidth * 2;
    this.drawRect(headerX, startY - headerHeight, restSectionWidth, headerHeight, BORDER_COLOR);
    this.drawText('Rest in any', headerX + 3, headerTextY, 5, 'bold');
    
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
  
  // Draw the second page with footnotes and signature lines
  private drawSecondPage(): void {
    this.addNewPage();
    let currentY = this.yPosition - 30;
    const leftMargin = MARGIN + 15;
    const rightMargin = A4_WIDTH - MARGIN - 15;
    const lineWidth = rightMargin - leftMargin;
    const signatureLineWidth = 380;
    
    // Footnote 1
    this.drawText('1', leftMargin, currentY, 7);
    const footnote1 = 'For completion and use in accordance with the procedures established by the competent authority in compliance with the relevant requirements of the Seafarers\' Hours of Work and the Manning of Ships Convention, 1996 (Convention No. 180).';
    this.drawWrappedText(footnote1, leftMargin + 12, currentY, 7, lineWidth - 12);
    currentY -= 30;
    
    // Footnote 2
    this.drawText('2', leftMargin, currentY, 7);
    const footnote2 = 'Additional calculations or verifications may be necessary to ensure compliance with the relevant requirements of the seafarers\' Hours of Work and the Manning of Ships Convention, 1996 (Convention No. 180) and the International Convention on Standards of Training, Certification and Watchkeeping, 1978, as amended (STCW Convention).';
    this.drawWrappedText(footnote2, leftMargin + 12, currentY, 7, lineWidth - 12);
    currentY -= 50;
    
    // National laws section
    this.drawText('The following national laws, regulations and/or collective limitations on working hours:', leftMargin, currentY, 8);
    currentY -= 25;
    
    // Empty line for national laws input
    this.drawLine(leftMargin, currentY, rightMargin, currentY, 0.5);
    currentY -= 50;
    
    // Agreement statement (bold italic)
    const agreementText = 'I agree that this record is an accurate reflection of the hours of rest of the seafarer concerned.';
    this.drawText(agreementText, leftMargin, currentY, 9, 'boldItalic');
    currentY -= 30;
    
    // Master name line with underline
    this.drawText('Name of master or person authorized by master to sign this record', leftMargin, currentY, 8);
    this.drawLine(leftMargin + 330, currentY - 2, leftMargin + 330 + signatureLineWidth, currentY - 2, 0.5);
    currentY -= 22;
    
    // Signature of master or authorized person
    this.drawText('Signature of master or authorized person', leftMargin, currentY, 8);
    this.drawLine(leftMargin + 230, currentY - 2, leftMargin + 230 + signatureLineWidth + 100, currentY - 2, 0.5);
    currentY -= 35;
    
    // Seafarer signature (left-aligned on its own line)
    this.drawText('Signature of seafarer', leftMargin, currentY, 8);
    this.drawLine(leftMargin + 120, currentY - 2, leftMargin + 120 + signatureLineWidth, currentY - 2, 0.5);
  }
  
  // Helper to draw wrapped text
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
    
    const tableStartX = MARGIN;
    const tableWidth = this.getTableWidth();
    const rowHeight = 12;
    
    // Draw document header
    let currentY = this.drawDocumentHeader(data);
    
    // Draw table header
    currentY = this.drawTableHeader(tableStartX, currentY);
    
    // Draw data rows
    for (let i = 0; i < data.records.length; i++) {
      const record = data.records[i];
      
      // Check if we need a new page
      if (currentY - rowHeight < MARGIN + 40) {
        this.addNewPage();
        currentY = this.yPosition - 10;
        
        // Redraw header on new page
        this.drawText('RECORD OF HOURS OF WORK (continued)', MARGIN, currentY, 10, 'bold');
        currentY -= 15;
        
        currentY = this.drawTableHeader(tableStartX, currentY);
      }
      
      const rowY = currentY - rowHeight;
      let cellX = tableStartX;
      
      // Row background (based on isPlan)
      const rowBgColor = record.isPlan ? rgb(0.96, 0.96, 0.96) : undefined;
      if (rowBgColor) {
        this.drawRect(tableStartX, rowY, tableWidth, rowHeight, BORDER_COLOR, rowBgColor);
      }
      
      // Date cell
      this.drawRect(cellX, rowY, this.dateColWidth, rowHeight, BORDER_COLOR);
      this.drawText(record.day.toString(), cellX + 8, rowY + 3, 6);
      cellX += this.dateColWidth;
      
      // Day cell
      this.drawRect(cellX, rowY, this.dayColWidth, rowHeight, BORDER_COLOR);
      this.drawText(record.dayOfWeek || '', cellX + 3, rowY + 3, 6);
      cellX += this.dayColWidth;
      
      // Normalize hours array
      const normalizedHours = this.normalizeHours(record.hours);
      
      // 48 Half-hour cells (black-and-white, no background colors)
      for (let halfHourIdx = 0; halfHourIdx < 48; halfHourIdx++) {
        const cellValue = normalizedHours[halfHourIdx];
        
        this.drawRect(cellX, rowY, this.halfHourCellWidth, rowHeight, BORDER_COLOR);
        
        if (cellValue) {
          this.drawText(cellValue.toLowerCase(), cellX + 3, rowY + 3, 5);
        }
        
        cellX += this.halfHourCellWidth;
      }
      
      // RH in 24 Hr cell
      this.drawRect(cellX, rowY, this.rhColWidth, rowHeight, BORDER_COLOR);
      this.drawText(record.hoursOfRest24hr?.toString() || '', cellX + 5, rowY + 3, 6);
      cellX += this.rhColWidth;
      
      // Violations cell
      this.drawRect(cellX, rowY, this.violationsColWidth, rowHeight, BORDER_COLOR);
      if (record.violations && record.violations.length > 0) {
        const violationsText = `[${record.violations.join(',')}]`;
        this.drawText(violationsText, cellX + 2, rowY + 3, 5, 'normal', RED_COLOR);
      }
      cellX += this.violationsColWidth;
      
      // Comments cell
      this.drawRect(cellX, rowY, this.commentsColWidth, rowHeight, BORDER_COLOR);
      const truncatedComment = (record.comments || '').substring(0, 15);
      this.drawText(truncatedComment, cellX + 2, rowY + 3, 5);
      cellX += this.commentsColWidth;
      
      // 24 Hr Period cell
      this.drawRect(cellX, rowY, this.restPeriodColWidth, rowHeight, BORDER_COLOR);
      const rest24hr = record.anyPeriodRest24hr?.toFixed(1) || '';
      const is24hrViolation = (record.anyPeriodRest24hr || 0) < 10;
      this.drawText(rest24hr, cellX + 3, rowY + 3, 5, 'normal', is24hrViolation ? RED_COLOR : rgb(0, 0, 0));
      cellX += this.restPeriodColWidth;
      
      // 7 days cell
      this.drawRect(cellX, rowY, this.restPeriodColWidth, rowHeight, BORDER_COLOR);
      const rest7day = record.anyPeriodRest7day?.toFixed(1) || '';
      const is7dayViolation = (record.anyPeriodRest7day || 0) < 77;
      this.drawText(rest7day, cellX + 2, rowY + 3, 5, 'normal', is7dayViolation ? RED_COLOR : rgb(0, 0, 0));
      
      currentY = rowY;
    }
    
    // Legend
    const legendHeight = 25;
    if (currentY - legendHeight < MARGIN + 10) {
      this.addNewPage();
      currentY = this.yPosition - 20;
    }
    
    const legendY = currentY - 15;
    this.drawText('Legend: w: Watch, a: Additional Work, d: Day Work, blank: Rest', tableStartX, legendY, 6);
    
    // Draw second page with footnotes and signature lines
    this.drawSecondPage();
    
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
  }>,
  vesselInfo: {
    vesselName: string;
    imoNumber?: string;
    flagOfShip?: string;
  },
  fetchDailyRecords: (crewMemberId: string, vesselId: string, monthYear: string) => Promise<ExtendedDailyRecord[]>,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  try {
    const zip = new JSZip();
    const total = crewRecords.length;
    
    for (let i = 0; i < crewRecords.length; i++) {
      const crew = crewRecords[i];
      
      if (onProgress) {
        onProgress(i + 1, total);
      }
      
      const monthYear = crew.monthValue;
      const monthYearDisplay = formatMonthYearDisplay(monthYear);
      const records = await fetchDailyRecords(crew.crewMemberId, crew.vesselId, monthYear);
      
      const pdfData: RestHoursPDFData = {
        vesselName: vesselInfo.vesselName,
        crewMemberName: crew.name,
        rank: crew.rank,
        monthYear: monthYearDisplay,
        records: records,
        imoNumber: vesselInfo.imoNumber,
        flagOfShip: vesselInfo.flagOfShip,
        watchkeeper: false,
        seafarerFullName: `${crew.rank}-${crew.name.toUpperCase()}`,
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
