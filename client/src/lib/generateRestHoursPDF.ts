import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import type { ExtendedDailyRecord } from '@/modules/rest-hours/types';

// A4 Landscape dimensions (842 x 595 pts)
const A4_WIDTH = 842;
const A4_HEIGHT = 595;
const MARGIN = 15;
const CONTENT_WIDTH = A4_WIDTH - 2 * MARGIN;

// Colors
const HEADER_BG = rgb(0.9, 0.95, 1);
const BORDER_COLOR = rgb(0.6, 0.6, 0.6);
const BLUE_COLOR = rgb(0.29, 0.56, 0.89);
const RED_COLOR = rgb(0.8, 0, 0);
const LIGHT_BLUE_BG = rgb(0.9, 0.95, 1);
const WORK_COLOR = rgb(0.85, 0.95, 0.85);
const DUTY_COLOR = rgb(1, 0.95, 0.85);
const ANCHOR_COLOR = rgb(0.85, 0.85, 1);

export interface RestHoursPDFData {
  vesselName: string;
  crewMemberName: string;
  rank: string;
  monthYear: string;
  records: ExtendedDailyRecord[];
}

class RestHoursPDFGenerator {
  private pdfDoc!: PDFDocument;
  private currentPage!: PDFPage;
  private font!: PDFFont;
  private fontBold!: PDFFont;
  private yPosition: number = A4_HEIGHT - MARGIN;
  
  // Column widths (all 48 half-hour cells)
  private readonly dateColWidth = 28;
  private readonly dayColWidth = 24;
  private readonly halfHourCellWidth = 12; // Each half-hour cell
  private readonly rhColWidth = 26;
  private readonly violationsColWidth = 38;
  private readonly commentsColWidth = 65;
  private readonly restPeriodColWidth = 28;
  
  async initialize(): Promise<void> {
    this.pdfDoc = await PDFDocument.create();
    this.font = await this.pdfDoc.embedFont(StandardFonts.Helvetica);
    this.fontBold = await this.pdfDoc.embedFont(StandardFonts.HelveticaBold);
    this.addNewPage();
  }
  
  private addNewPage(): void {
    // Landscape orientation
    this.currentPage = this.pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    this.yPosition = A4_HEIGHT - MARGIN;
  }
  
  drawText(text: string, x: number, y: number, fontSize: number = 8, fontType: 'normal' | 'bold' = 'normal', color = rgb(0, 0, 0)): void {
    const font = fontType === 'bold' ? this.fontBold : this.font;
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
  
  // Calculate total table width
  private getTableWidth(): number {
    const hoursColumnsWidth = 48 * this.halfHourCellWidth;
    return this.dateColWidth + this.dayColWidth + hoursColumnsWidth + 
           this.rhColWidth + this.violationsColWidth + this.commentsColWidth + 
           this.restPeriodColWidth * 2;
  }
  
  // Draw table header (reusable for each page)
  private drawTableHeader(tableStartX: number, startY: number): number {
    const tableWidth = this.getTableWidth();
    const headerHeight = 28;
    
    // Table header background
    this.drawRect(tableStartX, startY - headerHeight, tableWidth, headerHeight, BORDER_COLOR, HEADER_BG);
    
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
    
    // Hours columns header (00-23, each with 2 half-hour cells)
    for (let h = 0; h < 24; h++) {
      const hourStr = h.toString().padStart(2, '0');
      // Draw hour label spanning 2 cells
      this.drawText(hourStr, headerX + 3, headerTextY, 5, 'normal');
      
      // Draw vertical line after each hour (every 2 cells)
      const hourWidth = this.halfHourCellWidth * 2;
      this.drawLine(headerX + hourWidth, startY, headerX + hourWidth, startY - headerHeight, 0.5);
      
      // Draw lighter divider between half-hours
      this.drawLine(headerX + this.halfHourCellWidth, startY - headerHeight + 8, headerX + this.halfHourCellWidth, startY - headerHeight, 0.25, rgb(0.75, 0.75, 0.75));
      
      headerX += hourWidth;
    }
    
    // RH in 24 Hr column
    this.drawText('RH in', headerX + 2, headerTextY, 5, 'bold');
    this.drawText('24 Hr', headerX + 2, headerTextY2, 5, 'bold');
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
    this.drawRect(headerX, startY - headerHeight, restSectionWidth, headerHeight, BORDER_COLOR, LIGHT_BLUE_BG);
    this.drawText('Rest in any', headerX + 3, headerTextY, 5, 'bold');
    
    // Sub-headers for 24 Hr Period and 7 days
    this.drawText('24hr', headerX + 3, headerTextY2, 5, 'normal');
    this.drawLine(headerX + this.restPeriodColWidth, startY - 12, headerX + this.restPeriodColWidth, startY - headerHeight);
    this.drawText('7day', headerX + this.restPeriodColWidth + 3, headerTextY2, 5, 'normal');
    
    return startY - headerHeight;
  }
  
  // Normalize hours array to ensure exactly 48 entries
  private normalizeHours(hours: string[] | undefined): string[] {
    const normalized = new Array(48).fill('');
    if (hours && Array.isArray(hours)) {
      for (let i = 0; i < Math.min(hours.length, 48); i++) {
        normalized[i] = hours[i] || '';
      }
    }
    return normalized;
  }
  
  async generate(data: RestHoursPDFData): Promise<Uint8Array> {
    await this.initialize();
    
    const tableStartX = MARGIN;
    const tableWidth = this.getTableWidth();
    const rowHeight = 12;
    
    // Draw title header
    let currentY = this.yPosition;
    
    // Title section
    this.drawText('Record of Hours of Work or Rest', tableStartX, currentY, 11, 'bold', BLUE_COLOR);
    currentY -= 12;
    
    // Crew info section
    const infoY = currentY;
    this.drawText(`Vessel: ${data.vesselName || ''}`, tableStartX, infoY, 8);
    this.drawText(`Rank: ${data.rank || ''}`, tableStartX + 140, infoY, 8);
    this.drawText(`Name: ${data.crewMemberName || ''}`, tableStartX + 260, infoY, 8);
    this.drawText(`Month/Year: ${data.monthYear || ''}`, tableStartX + 480, infoY, 8);
    currentY -= 14;
    
    // Instruction text
    this.drawText('Please mark periods of work with a "d", "a", and "w"', tableStartX, currentY, 6);
    currentY -= 10;
    
    // Draw table header
    currentY = this.drawTableHeader(tableStartX, currentY);
    
    // Draw data rows
    for (let i = 0; i < data.records.length; i++) {
      const record = data.records[i];
      
      // Check if we need a new page
      if (currentY - rowHeight < MARGIN + 40) {
        this.addNewPage();
        currentY = this.yPosition - 10;
        
        // Redraw header on new page with title
        this.drawText('Record of Hours of Work or Rest (continued)', tableStartX, currentY, 9, 'bold', BLUE_COLOR);
        currentY -= 12;
        
        // Redraw full table header
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
      
      // Normalize hours array to ensure exactly 48 entries
      const normalizedHours = this.normalizeHours(record.hours);
      
      // 48 Half-hour cells (all individual cells rendered)
      for (let halfHourIdx = 0; halfHourIdx < 48; halfHourIdx++) {
        const cellValue = normalizedHours[halfHourIdx];
        
        // Get cell background color based on value
        const getCellBg = (val: string) => {
          if (val === 'w' || val === 'W') return WORK_COLOR;
          if (val === 'd' || val === 'D') return DUTY_COLOR;
          if (val === 'a' || val === 'A') return ANCHOR_COLOR;
          return undefined;
        };
        
        const cellBg = getCellBg(cellValue);
        this.drawRect(cellX, rowY, this.halfHourCellWidth, rowHeight, BORDER_COLOR, cellBg);
        
        // Display value
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
      
      // 24 Hr Period cell (blue background)
      this.drawRect(cellX, rowY, this.restPeriodColWidth, rowHeight, BORDER_COLOR, LIGHT_BLUE_BG);
      const rest24hr = record.anyPeriodRest24hr?.toFixed(1) || '';
      const is24hrViolation = (record.anyPeriodRest24hr || 0) < 10;
      this.drawText(rest24hr, cellX + 3, rowY + 3, 5, 'normal', is24hrViolation ? RED_COLOR : rgb(0, 0, 0));
      cellX += this.restPeriodColWidth;
      
      // 7 days cell (blue background)
      this.drawRect(cellX, rowY, this.restPeriodColWidth, rowHeight, BORDER_COLOR, LIGHT_BLUE_BG);
      const rest7day = record.anyPeriodRest7day?.toFixed(1) || '';
      const is7dayViolation = (record.anyPeriodRest7day || 0) < 77;
      this.drawText(rest7day, cellX + 2, rowY + 3, 5, 'normal', is7dayViolation ? RED_COLOR : rgb(0, 0, 0));
      
      currentY = rowY;
    }
    
    // Legend at bottom of last page - check if there's enough space
    const legendHeight = 25;
    if (currentY - legendHeight < MARGIN + 10) {
      // Not enough space, add a new page for the legend
      this.addNewPage();
      currentY = this.yPosition - 20;
    }
    
    const legendY = currentY - 15;
    this.drawText('Legend:', tableStartX, legendY, 6, 'bold');
    
    let legendX = tableStartX + 35;
    
    // Work (w) legend
    this.drawRect(legendX, legendY - 2, 8, 8, BORDER_COLOR, WORK_COLOR);
    legendX += 10;
    this.drawText('w = Work', legendX, legendY, 6);
    
    // Duty (d) legend
    legendX += 45;
    this.drawRect(legendX, legendY - 2, 8, 8, BORDER_COLOR, DUTY_COLOR);
    legendX += 10;
    this.drawText('d = Duty', legendX, legendY, 6);
    
    // Anchor (a) legend
    legendX += 45;
    this.drawRect(legendX, legendY - 2, 8, 8, BORDER_COLOR, ANCHOR_COLOR);
    legendX += 10;
    this.drawText('a = Anchor Watch', legendX, legendY, 6);
    
    // Blank = Rest legend
    legendX += 75;
    this.drawRect(legendX, legendY - 2, 8, 8, BORDER_COLOR);
    legendX += 10;
    this.drawText('blank = Rest', legendX, legendY, 6);
    
    return this.pdfDoc.save();
  }
}

export async function generateRestHoursPDF(data: RestHoursPDFData): Promise<void> {
  try {
    const generator = new RestHoursPDFGenerator();
    const pdfBytes = await generator.generate(data);
    
    // Create blob and download
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Rest_Hour_Record_Extract.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to generate Rest Hours PDF:', error);
    throw error;
  }
}
