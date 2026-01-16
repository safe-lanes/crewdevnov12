import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';

interface EquipmentEntry {
  id: string;
  equipmentId?: string;
  makeModel?: string;
  serialNo?: string;
  lastCalibrated?: string;
}

interface PersonnelEntry {
  id: string;
  rank: string;
  name: string;
  alcoholTest?: {
    checked: boolean;
    date?: string;
    time?: string;
  };
  alcoholResults?: string;
  alcoholViolation?: boolean;
  drugTest?: {
    checked: boolean;
    date?: string;
    time?: string;
  };
  drugResults?: string;
  drugViolation?: boolean;
  witness?: string;
}

interface MasterDeputySignature {
  confirmed: boolean;
  name?: string;
  date?: string;
}

interface DrugAlcoholTestFormData {
  testType: string;
  vesselId?: string;
  vesselName?: string;
  placeLocation?: string;
  alcoholDrugType?: string[];
  initiatedBy?: string;
  dateTimeTestCompleted?: string;
  incidentTitle?: string;
  incidentId?: string;
  incidentDateTime?: string;
  alcoholTestDateTime?: string;
  drugTestDateTime?: string;
  reasonForTesting?: string;
  description?: string;
  externalTestResultsDate?: string;
  equipmentNotApplicable?: boolean;
  testingEquipment?: EquipmentEntry[];
  personnelTested?: PersonnelEntry[];
  comments?: string;
  masterDeputySignature?: MasterDeputySignature;
}

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_WIDTH = A4_WIDTH - 2 * MARGIN;
const LINE_HEIGHT = 14;
const SECTION_SPACING = 16;
const PRIMARY_COLOR = rgb(22/255, 86/255, 158/255);
const LIGHT_GRAY = rgb(0.95, 0.95, 0.95);
const BORDER_COLOR = rgb(0.85, 0.85, 0.85);
const LABEL_COLOR = rgb(0.4, 0.4, 0.4);

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = date.getDate().toString().padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateTimeStr: string | undefined): string {
  if (!dateTimeStr) return '';
  try {
    const date = new Date(dateTimeStr);
    if (isNaN(date.getTime())) return dateTimeStr;
    const day = date.getDate().toString().padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  } catch {
    return dateTimeStr;
  }
}

function displayValue(value: string | undefined | null): string {
  return value && value.trim() ? value : '';
}

function getTestTypeLabel(testType: string): string {
  const labels: Record<string, string> = {
    'annual': 'Annual',
    'periodic': 'Periodic',
    'monthly': 'Monthly',
    'post-incident': 'Post Incident',
    'others': 'Others',
  };
  return labels[testType] || testType;
}

class PDFBuilder {
  private pdfDoc: PDFDocument;
  private currentPage: PDFPage;
  private font: PDFFont;
  private fontBold: PDFFont;
  private fontItalic: PDFFont;
  private yPosition: number;
  private pageNumber: number = 1;

  constructor(pdfDoc: PDFDocument, font: PDFFont, fontBold: PDFFont, fontItalic: PDFFont) {
    this.pdfDoc = pdfDoc;
    this.font = font;
    this.fontBold = fontBold;
    this.fontItalic = fontItalic;
    this.currentPage = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    this.yPosition = A4_HEIGHT - MARGIN;
  }

  checkPageBreak(requiredHeight: number = LINE_HEIGHT * 2): void {
    if (this.yPosition - requiredHeight < MARGIN + 30) {
      this.addNewPage();
    }
  }

  private addNewPage(): void {
    this.pageNumber++;
    this.currentPage = this.pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    this.yPosition = A4_HEIGHT - MARGIN;
  }

  drawText(text: string, x: number, fontSize: number = 9, fontType: 'normal' | 'bold' | 'italic' = 'normal', color = rgb(0, 0, 0)): void {
    const font = fontType === 'bold' ? this.fontBold : fontType === 'italic' ? this.fontItalic : this.font;
    this.currentPage.drawText(text || '', {
      x,
      y: this.yPosition,
      size: fontSize,
      font,
      color,
    });
  }

  drawTextAt(text: string, x: number, y: number, fontSize: number = 9, fontType: 'normal' | 'bold' | 'italic' = 'normal', color = rgb(0, 0, 0)): void {
    const font = fontType === 'bold' ? this.fontBold : fontType === 'italic' ? this.fontItalic : this.font;
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

  drawRect(x: number, y: number, width: number, height: number, fill: boolean = false, fillColor = LIGHT_GRAY): void {
    if (fill) {
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
      borderColor: BORDER_COLOR,
      borderWidth: 0.5,
    });
  }

  drawFilledCircle(x: number, y: number, radius: number): void {
    this.currentPage.drawCircle({
      x,
      y,
      size: radius,
      color: rgb(0, 0, 0),
    });
  }

  drawEmptyCircle(x: number, y: number, radius: number): void {
    this.currentPage.drawCircle({
      x,
      y,
      size: radius,
      borderColor: rgb(0.4, 0.4, 0.4),
      borderWidth: 0.5,
    });
  }

  drawRadioButton(x: number, y: number, selected: boolean): number {
    this.drawEmptyCircle(x, y, 4);
    if (selected) {
      this.drawFilledCircle(x, y, 2.5);
    }
    return x + 8;
  }

  drawCheckbox(x: number, y: number, checked: boolean): number {
    this.currentPage.drawRectangle({
      x: x - 4,
      y: y - 4,
      width: 8,
      height: 8,
      borderColor: rgb(0.4, 0.4, 0.4),
      borderWidth: 0.5,
    });
    if (checked) {
      // Draw X using lines instead of unsupported checkmark character
      this.currentPage.drawLine({
        start: { x: x - 2, y: y - 2 },
        end: { x: x + 2, y: y + 2 },
        thickness: 1,
        color: rgb(0, 0, 0),
      });
      this.currentPage.drawLine({
        start: { x: x + 2, y: y - 2 },
        end: { x: x - 2, y: y + 2 },
        thickness: 1,
        color: rgb(0, 0, 0),
      });
    }
    return x + 12;
  }

  moveDown(amount: number = LINE_HEIGHT): void {
    this.yPosition -= amount;
    this.checkPageBreak();
  }

  getY(): number {
    return this.yPosition;
  }

  setY(y: number): void {
    this.yPosition = y;
  }

  drawSectionHeader(title: string): void {
    this.checkPageBreak(30);
    this.moveDown(SECTION_SPACING);
    this.drawText(title, MARGIN, 12, 'bold', PRIMARY_COLOR);
    this.moveDown(5);
    this.drawLine(MARGIN, this.yPosition, MARGIN + CONTENT_WIDTH, this.yPosition, 2, PRIMARY_COLOR);
    this.moveDown(LINE_HEIGHT);
  }

  drawSubsectionHeader(title: string): void {
    this.checkPageBreak(25);
    this.moveDown(10);
    this.drawText(title, MARGIN, 10, 'bold', PRIMARY_COLOR);
    this.moveDown(LINE_HEIGHT);
  }

  drawLabelValue(label: string, value: string, x: number): void {
    this.drawTextAt(label, x, this.yPosition, 8, 'normal', LABEL_COLOR);
    this.drawTextAt(displayValue(value), x, this.yPosition - 12, 9, 'normal');
  }

  drawFieldRow(fields: Array<{label: string, value: string}>, colWidth: number = CONTENT_WIDTH / 3): void {
    this.checkPageBreak();
    let x = MARGIN;
    for (const field of fields) {
      if (field.label) {
        this.drawTextAt(field.label, x, this.yPosition, 8, 'normal', LABEL_COLOR);
        this.drawTextAt(displayValue(field.value), x, this.yPosition - 12, 9, 'normal');
      }
      x += colWidth;
    }
    this.moveDown(LINE_HEIGHT * 2);
  }

  drawTableHeader(headers: string[], colWidths: number[]): void {
    this.checkPageBreak(LINE_HEIGHT * 3);
    const headerHeight = 20;
    let x = MARGIN;
    
    this.drawRect(MARGIN, this.yPosition - headerHeight, CONTENT_WIDTH, headerHeight, true);
    
    for (let i = 0; i < headers.length; i++) {
      this.drawTextAt(headers[i], x + 3, this.yPosition - 14, 7, 'bold');
      x += colWidths[i];
      if (i < headers.length - 1) {
        this.drawLine(x, this.yPosition, x, this.yPosition - headerHeight);
      }
    }
    
    this.moveDown(headerHeight);
  }

  drawTableRow(values: string[], colWidths: number[], rowHeight: number = 18): void {
    this.checkPageBreak(rowHeight);
    let x = MARGIN;
    
    this.drawRect(MARGIN, this.yPosition - rowHeight, CONTENT_WIDTH, rowHeight);
    
    for (let i = 0; i < values.length; i++) {
      const maxWidth = colWidths[i] - 6;
      let text = values[i] || '';
      if (this.font.widthOfTextAtSize(text, 8) > maxWidth) {
        while (text.length > 0 && this.font.widthOfTextAtSize(text + '...', 8) > maxWidth) {
          text = text.slice(0, -1);
        }
        text += '...';
      }
      this.drawTextAt(text, x + 3, this.yPosition - 12, 8);
      x += colWidths[i];
      if (i < values.length - 1) {
        this.drawLine(x, this.yPosition, x, this.yPosition - rowHeight);
      }
    }
    
    this.moveDown(rowHeight);
  }

  getPageNumber(): number {
    return this.pageNumber;
  }
}

export async function generateDrugAlcoholTestPDF(formData: DrugAlcoholTestFormData): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  
  const builder = new PDFBuilder(pdfDoc, font, fontBold, fontItalic);
  
  builder.drawText('Drug & Alcohol Test', MARGIN, 16, 'bold', PRIMARY_COLOR);
  builder.moveDown(10);
  builder.drawText(`Test Type: ${getTestTypeLabel(formData.testType)}`, MARGIN, 10, 'normal', LABEL_COLOR);
  builder.moveDown(LINE_HEIGHT);
  
  builder.drawSectionHeader('Part A: Basic Information');
  builder.drawText('Enter details as applicable', MARGIN, 8, 'italic', LABEL_COLOR);
  builder.moveDown(LINE_HEIGHT);
  
  builder.drawSubsectionHeader('A1. General');
  
  builder.drawFieldRow([
    { label: 'Vessel', value: formData.vesselName || '' },
    { label: 'Place / Location', value: formData.placeLocation || '' },
  ], CONTENT_WIDTH / 2);
  
  builder.checkPageBreak();
  builder.drawTextAt('Alcohol / Drug', MARGIN, builder.getY(), 8, 'normal', LABEL_COLOR);
  builder.moveDown(12);
  const alcoholDrugTypes = formData.alcoholDrugType || [];
  let radioX = MARGIN;
  radioX = builder.drawCheckbox(radioX, builder.getY() + 3, alcoholDrugTypes.includes('Alcohol'));
  builder.drawTextAt('Alcohol', radioX + 2, builder.getY(), 9);
  radioX += 60;
  radioX = builder.drawCheckbox(radioX, builder.getY() + 3, alcoholDrugTypes.includes('Drug'));
  builder.drawTextAt('Drug', radioX + 2, builder.getY(), 9);
  builder.moveDown(LINE_HEIGHT * 1.5);
  
  builder.drawFieldRow([
    { label: 'Initiated By', value: formData.initiatedBy || '' },
    { label: 'Date & Time Test Completed', value: formatDateTime(formData.dateTimeTestCompleted) },
  ], CONTENT_WIDTH / 2);
  
  if (formData.testType === 'post-incident') {
    builder.drawFieldRow([
      { label: 'Incident Title', value: formData.incidentTitle || '' },
      { label: 'Incident ID', value: formData.incidentId || '' },
      { label: 'Incident Date & Time', value: formatDateTime(formData.incidentDateTime) },
    ]);
  }
  
  if (alcoholDrugTypes.includes('Alcohol')) {
    builder.drawFieldRow([
      { label: 'Date & Time (Alcohol Test)', value: formatDateTime(formData.alcoholTestDateTime) },
      { label: '', value: '' },
    ], CONTENT_WIDTH / 2);
  }
  
  if (alcoholDrugTypes.includes('Drug')) {
    builder.drawFieldRow([
      { label: 'Date & Time (Drug Test)', value: formatDateTime(formData.drugTestDateTime) },
      { label: '', value: '' },
    ], CONTENT_WIDTH / 2);
  }
  
  if (formData.testType === 'others') {
    builder.drawFieldRow([
      { label: 'Reason for Testing', value: formData.reasonForTesting || '' },
    ], CONTENT_WIDTH);
    
    if (formData.description) {
      builder.checkPageBreak();
      builder.drawTextAt('Description', MARGIN, builder.getY(), 8, 'normal', LABEL_COLOR);
      builder.moveDown(12);
      const descLines = wrapText(formData.description, CONTENT_WIDTH - 10, font, 9);
      for (const line of descLines) {
        builder.drawText(line, MARGIN, 9);
        builder.moveDown(LINE_HEIGHT);
      }
    }
    
    builder.drawFieldRow([
      { label: 'External Test Results Date', value: formatDate(formData.externalTestResultsDate) },
    ], CONTENT_WIDTH);
  }
  
  builder.drawSubsectionHeader('A2. Testing Equipment Details (e.g. Alcohol Meter)');
  
  builder.checkPageBreak();
  builder.drawCheckbox(MARGIN, builder.getY() + 3, formData.equipmentNotApplicable || false);
  builder.drawTextAt('N/A', MARGIN + 12, builder.getY(), 9);
  builder.moveDown(LINE_HEIGHT * 1.5);
  
  if (!formData.equipmentNotApplicable && formData.testingEquipment && formData.testingEquipment.length > 0) {
    const equipmentHeaders = ['S/n', 'Equipment', 'Make/Model', 'Serial No', 'Last Calibrated'];
    const equipmentWidths = [35, 120, 130, 100, 130];
    
    builder.drawTableHeader(equipmentHeaders, equipmentWidths);
    
    formData.testingEquipment.forEach((eq, index) => {
      builder.drawTableRow([
        String(index + 1),
        eq.equipmentId || '',
        eq.makeModel || '',
        eq.serialNo || '',
        formatDate(eq.lastCalibrated),
      ], equipmentWidths);
    });
  }
  
  builder.drawSectionHeader('Part B: Personnel Details');
  builder.drawText('Enter personnel testing details', MARGIN, 8, 'italic', LABEL_COLOR);
  builder.moveDown(LINE_HEIGHT);
  
  builder.drawSubsectionHeader('B1. Personnel Tested');
  
  if (formData.personnelTested && formData.personnelTested.length > 0) {
    const showAlcohol = alcoholDrugTypes.includes('Alcohol');
    const showDrug = alcoholDrugTypes.includes('Drug');
    
    const personnelHeaders: string[] = ['S/n', 'Rank', 'Name'];
    const personnelWidths: number[] = [30, 60, 80];
    
    if (showAlcohol) {
      personnelHeaders.push('Alcohol Test', 'Results', 'Violation');
      personnelWidths.push(65, 50, 50);
    }
    if (showDrug) {
      personnelHeaders.push('Drug Test', 'Results', 'Violation');
      personnelWidths.push(65, 50, 50);
    }
    personnelHeaders.push('Witness');
    personnelWidths.push(70);
    
    const totalWidth = personnelWidths.reduce((a, b) => a + b, 0);
    const scale = CONTENT_WIDTH / totalWidth;
    const scaledWidths = personnelWidths.map(w => w * scale);
    
    builder.drawTableHeader(personnelHeaders, scaledWidths);
    
    formData.personnelTested.forEach((person, index) => {
      const rowValues: string[] = [
        String(index + 1),
        person.rank || '',
        person.name || '',
      ];
      
      if (showAlcohol) {
        const alcoholChecked = person.alcoholTest?.checked ? 'X' : '';
        const alcoholDateTime = person.alcoholTest?.date ? 
          `${formatDate(person.alcoholTest.date)}${person.alcoholTest.time ? ' ' + person.alcoholTest.time : ''}` : '';
        rowValues.push(alcoholChecked + (alcoholDateTime ? ' ' + alcoholDateTime : ''));
        rowValues.push(person.alcoholResults || '');
        rowValues.push(person.alcoholViolation ? 'Yes' : 'No');
      }
      
      if (showDrug) {
        const drugChecked = person.drugTest?.checked ? 'X' : '';
        const drugDateTime = person.drugTest?.date ?
          `${formatDate(person.drugTest.date)}${person.drugTest.time ? ' ' + person.drugTest.time : ''}` : '';
        rowValues.push(drugChecked + (drugDateTime ? ' ' + drugDateTime : ''));
        rowValues.push(person.drugResults || '');
        rowValues.push(person.drugViolation ? 'Yes' : 'No');
      }
      
      rowValues.push(person.witness || '');
      
      builder.drawTableRow(rowValues, scaledWidths, 20);
    });
  } else {
    builder.drawText('No personnel records', MARGIN, 9, 'italic', LABEL_COLOR);
    builder.moveDown(LINE_HEIGHT);
  }
  
  builder.moveDown(SECTION_SPACING);
  builder.drawSubsectionHeader('B2. Comments');
  
  builder.checkPageBreak(LINE_HEIGHT * 4);
  const commentsBoxHeight = 60;
  builder.drawRect(MARGIN, builder.getY() - commentsBoxHeight, CONTENT_WIDTH, commentsBoxHeight);
  
  if (formData.comments) {
    const commentLines = wrapText(formData.comments, CONTENT_WIDTH - 10, font, 9);
    let commentY = builder.getY() - 12;
    for (const line of commentLines.slice(0, 4)) {
      builder.drawTextAt(line, MARGIN + 5, commentY, 9);
      commentY -= LINE_HEIGHT;
    }
  }
  builder.moveDown(commentsBoxHeight + 5);
  
  builder.drawSubsectionHeader('B3. Master / Deputy Master - Digital Confirmation');
  
  builder.checkPageBreak();
  const signature = formData.masterDeputySignature;
  builder.drawCheckbox(MARGIN, builder.getY() + 3, signature?.confirmed || false);
  builder.drawTextAt('I confirm that the above information is accurate and complete.', MARGIN + 14, builder.getY(), 9);
  builder.moveDown(LINE_HEIGHT * 1.5);
  
  builder.drawFieldRow([
    { label: 'Name', value: signature?.name || '' },
    { label: 'Date', value: formatDate(signature?.date) },
  ], CONTENT_WIDTH / 2);
  
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  const testTypeLabel = getTestTypeLabel(formData.testType);
  const vesselName = formData.vesselName ? `_${formData.vesselName.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
  link.download = `Drug_Alcohol_Test_${testTypeLabel}${vesselName}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function wrapText(text: string, maxWidth: number, font: PDFFont, fontSize: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    
    if (width <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
}
