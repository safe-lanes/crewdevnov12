import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';

export interface AppraisalPDFVisibility {
  showA: boolean;
  showB: boolean;
  showB1: boolean;
  showB2: boolean;
  showC: boolean;
  showD: boolean;
  showE: boolean;
  showF: boolean;
  showG: boolean;
  showEvaluation: boolean;
  showPersonalityIndex: boolean;
}

export interface AppraisalPDFData {
  // Part A fields
  seafarersName?: string;
  seafarersRank?: string;
  nationality?: string | null;
  vessel?: string;
  signOn?: string;
  appraisalType?: string;
  appraisalPeriodFrom?: string;
  appraisalPeriodTo?: string;
  primaryAppraiser?: string;
  personalityIndexCategory?: string;

  // Part B-G arrays
  trainings?: Array<{ id?: string; training?: string; evaluation?: string; comment?: string }>;
  targets?: Array<{ id?: string; targetSetting?: string; evaluation?: string; comment?: string }>;
  competenceAssessments?: Array<{ id?: string; assessmentCriteria?: string; weight?: number; effectiveness?: string; comment?: string }>;
  behaviouralAssessments?: Array<{ id?: string; assessmentCriteria?: string; weight?: number; effectiveness?: string; comment?: string }>;
  trainingNeeds?: Array<{ id?: string; training?: string; comment?: string }>;
  recommendations?: Array<{ id?: string; question?: string; answer?: string; comment?: string }>;
  appraiserComments?: Array<{ id?: string; name?: string; rank?: string; comment?: string }>;
  seafarerComments?: Array<{ id?: string; name?: string; rank?: string; comment?: string }>;
  officeReviews?: Array<{ id?: string; name?: string; position?: string; feedback?: string }>;
  trainingFollowups?: Array<{ id?: string; training?: string; correspondingInDB?: string; category?: string; status?: string; targetDate?: string; comment?: string }>;

  // Score fields
  competenceSectionScore?: string;
  behaviouralSectionScore?: string;
  overallScore?: string;

  // Visibility flags
  visibility: AppraisalPDFVisibility;
}

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_WIDTH = A4_WIDTH - 2 * MARGIN;
const LINE_HEIGHT = 14;
const SECTION_SPACING = 16;
const PRIMARY_COLOR = rgb(22/255, 86/255, 158/255);
const PRIMARY_LIGHT = rgb(230/255, 240/255, 250/255);
const LIGHT_GRAY = rgb(0.96, 0.96, 0.96);
const BORDER_COLOR = rgb(0.82, 0.82, 0.82);
const TEXT_COLOR = rgb(0.15, 0.15, 0.15);
const LABEL_COLOR = rgb(0.35, 0.35, 0.35);
const FOOTER_Y = 25;

// On-screen dropdown labels (must mirror the Part components exactly).
const TRAINING_EVAL_LABELS: Record<string, string> = {
  '5-exceeded-expectations': '5- Exceeded Expectations',
  '4-meets-expectations': '4- Meets Expectations',
  '3-somewhat-meets-expectations': '3- Somewhat Meets Expectations',
  '2-below-expectations': '2- Below Expectations',
  '1-significantly-below-expectations': '1- Significantly Below Expectations',
};

const TARGET_EVAL_LABELS: Record<string, string> = {
  '5-exceeded-set-target': '5- Exceeded Set Target',
  '4-fully-met-target': '4- Fully Met Target',
  '3-missed-target-small-margin': '3- Missed Target by a Small Margin',
  '2-missed-target-significant-margin': '2- Missed Target by a Significant Margin',
  '1-failed-to-achieve-target': '1- Failed to Achieve Target',
};

const EFFECTIVENESS_LABELS: Record<string, string> = {
  '5-exceeds-expectations': '5- Exceeds Expectations',
  '4-meets-expectations': '4- Meets Expectations',
  '3-somewhat-meets-expectations': '3- Somewhat Meets Expectations',
  '2-below-expectations': '2- Below Expectations',
  '1-significantly-below-expectations': '1- Significantly Below Expectations',
};

const PRIMARY_APPRAISER_LABELS: Record<string, string> = {
  'master': 'Master',
  'chief-officer': 'Chief Officer',
  'chief-engineer': 'Chief Engineer',
  '2nd-engineer': '2nd Engineer',
  'marine-superintendent': 'Marine Superintendent',
  'technical-superintendent': 'Technical Superintendent',
  'crew-manager': 'Crew Manager',
};

const PERSONALITY_INDEX_LABELS: Record<string, string> = {
  dominance: 'Dominance',
  influence: 'Influence',
  steadiness: 'Steadiness',
  compliance: 'Compliance',
};

function mapLabel(map: Record<string, string>, value: string | undefined | null): string {
  if (!value) return '';
  return map[value] || value;
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  try {
    let date: Date;
    const ddmmyyyyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyyMatch) {
      const [, dd, mm, yyyy] = ddmmyyyyMatch;
      date = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
    } else {
      date = new Date(dateStr);
    }
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

function sanitizeText(text: string): string {
  return text.replace(/[\t\n\r]/g, ' ').replace(/[\x00-\x1F]/g, '');
}

function displayValue(value: string | undefined | null): string {
  if (!value || !value.trim()) return '-';
  return sanitizeText(value);
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
    if (this.yPosition - requiredHeight < MARGIN + FOOTER_Y) {
      this.addNewPage();
    }
  }

  private addNewPage(): void {
    this.pageNumber++;
    this.currentPage = this.pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    this.yPosition = A4_HEIGHT - MARGIN;
  }

  finalizeDocument(): void {
    const totalPages = this.pdfDoc.getPageCount();
    const pages = this.pdfDoc.getPages();
    for (let i = 0; i < totalPages; i++) {
      const page = pages[i];
      page.drawLine({
        start: { x: MARGIN, y: FOOTER_Y + 10 },
        end: { x: MARGIN + CONTENT_WIDTH, y: FOOTER_Y + 10 },
        thickness: 0.3,
        color: BORDER_COLOR,
      });
      const pageText = `Page ${i + 1} of ${totalPages}`;
      const pageTextWidth = this.font.widthOfTextAtSize(pageText, 7);
      const centerX = MARGIN + (CONTENT_WIDTH - pageTextWidth) / 2;
      page.drawText(pageText, {
        x: centerX,
        y: FOOTER_Y,
        size: 7,
        font: this.font,
        color: LABEL_COLOR,
      });
    }
  }

  drawText(text: string, x: number, fontSize: number = 9, fontType: 'normal' | 'bold' | 'italic' = 'normal', color = TEXT_COLOR): void {
    const font = fontType === 'bold' ? this.fontBold : fontType === 'italic' ? this.fontItalic : this.font;
    this.currentPage.drawText(sanitizeText(text || ''), {
      x,
      y: this.yPosition,
      size: fontSize,
      font,
      color,
    });
  }

  drawTextAt(text: string, x: number, y: number, fontSize: number = 9, fontType: 'normal' | 'bold' | 'italic' = 'normal', color = TEXT_COLOR): void {
    const font = fontType === 'bold' ? this.fontBold : fontType === 'italic' ? this.fontItalic : this.font;
    this.currentPage.drawText(sanitizeText(text || ''), {
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

  drawRect(x: number, y: number, width: number, height: number, fill: boolean = false): void {
    if (fill) {
      this.currentPage.drawRectangle({
        x,
        y,
        width,
        height,
        color: LIGHT_GRAY,
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

  drawWrappedTextAt(text: string, x: number, y: number, maxWidth: number, fontSize: number = 9, fontType: 'normal' | 'bold' | 'italic' = 'normal', color = TEXT_COLOR): number {
    const font = fontType === 'bold' ? this.fontBold : fontType === 'italic' ? this.fontItalic : this.font;
    const lines = this.wrapText(sanitizeText(text || ''), maxWidth, fontSize);
    for (let i = 0; i < lines.length; i++) {
      this.currentPage.drawText(lines[i], { x, y: y - (i * 11), size: fontSize, font, color });
    }
    return lines.length;
  }

  private wrapText(text: string, maxWidth: number, fontSize: number): string[] {
    if (this.font.widthOfTextAtSize(text, fontSize) <= maxWidth) return [text];
    const words = text.split(/([,] )/);
    const lines: string[] = [];
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine + word;
      if (this.font.widthOfTextAtSize(testLine, fontSize) > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word.trimStart();
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    const result: string[] = [];
    for (const line of lines) {
      if (this.font.widthOfTextAtSize(line, fontSize) <= maxWidth) {
        result.push(line);
      } else {
        let remaining = line;
        while (remaining && this.font.widthOfTextAtSize(remaining, fontSize) > maxWidth) {
          let end = remaining.length;
          while (end > 1 && this.font.widthOfTextAtSize(remaining.slice(0, end), fontSize) > maxWidth) {
            end--;
          }
          result.push(remaining.slice(0, end));
          remaining = remaining.slice(end);
        }
        if (remaining) result.push(remaining);
      }
    }
    return result;
  }

  drawFieldRow(fields: Array<{label: string, value: string}>, colWidth: number = CONTENT_WIDTH / 3): void {
    const maxWidth = colWidth - 6;
    let maxLinesUsed = 1;
    const fieldLines: string[][] = [];
    for (const field of fields) {
      if (field.label) {
        const val = displayValue(field.value);
        const lines = this.wrapText(val, maxWidth, 9);
        fieldLines.push(lines);
        if (lines.length > maxLinesUsed) maxLinesUsed = lines.length;
      } else {
        fieldLines.push([]);
      }
    }
    const requiredHeight = LINE_HEIGHT * 2 + (maxLinesUsed > 1 ? (maxLinesUsed - 1) * 11 : 0);
    this.checkPageBreak(requiredHeight);
    let x = MARGIN;
    let fieldIdx = 0;
    for (const field of fields) {
      if (field.label) {
        this.drawTextAt(field.label, x, this.yPosition, 8, 'normal', LABEL_COLOR);
        const lines = fieldLines[fieldIdx];
        lines.forEach((line, lineIdx) => {
          this.drawTextAt(line, x, this.yPosition - 12 - (lineIdx * 11), 9, 'normal');
        });
      }
      fieldIdx++;
      x += colWidth;
    }
    this.moveDown(requiredHeight);
  }

  private drawCellDividers(colWidths: number[], rowY: number, rowHeight: number): void {
    let x = MARGIN;
    for (let i = 0; i < colWidths.length - 1; i++) {
      x += colWidths[i];
      this.drawLine(x, rowY, x, rowY + rowHeight, 0.3, BORDER_COLOR);
    }
  }

  drawTableHeader(headers: string[], colWidths: number[]): void {
    const fontSize = 7;
    const lineSpacing = 9;
    const cellPadding = 4;
    const headerLines: string[][] = [];
    let maxLines = 1;
    for (let i = 0; i < headers.length; i++) {
      const maxWidth = colWidths[i] - 8;
      const lines = this.wrapTableCell(sanitizeText(headers[i]), maxWidth, fontSize, this.fontBold);
      headerLines.push(lines);
      if (lines.length > maxLines) maxLines = lines.length;
    }
    const headerHeight = Math.max(20, cellPadding + maxLines * lineSpacing + 5);
    this.checkPageBreak(headerHeight + 5);
    let x = MARGIN;

    this.currentPage.drawRectangle({
      x: MARGIN,
      y: this.yPosition - headerHeight,
      width: CONTENT_WIDTH,
      height: headerHeight,
      color: PRIMARY_LIGHT,
    });
    this.currentPage.drawRectangle({
      x: MARGIN,
      y: this.yPosition - headerHeight,
      width: CONTENT_WIDTH,
      height: headerHeight,
      borderColor: BORDER_COLOR,
      borderWidth: 0.5,
    });

    this.drawCellDividers(colWidths, this.yPosition - headerHeight, headerHeight);

    for (let i = 0; i < headers.length; i++) {
      const lines = headerLines[i];
      for (let li = 0; li < lines.length; li++) {
        this.drawTextAt(lines[li], x + 4, this.yPosition - 11 - (li * lineSpacing), fontSize, 'bold', TEXT_COLOR);
      }
      x += colWidths[i];
    }
    this.moveDown(headerHeight);
  }

  private wrapTableCell(text: string, maxWidth: number, fontSize: number, measureFont?: PDFFont): string[] {
    const font = measureFont || this.font;
    if (font.widthOfTextAtSize(text, fontSize) <= maxWidth) return [text];
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      if (font.widthOfTextAtSize(testLine, fontSize) > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    const result: string[] = [];
    for (const line of lines) {
      if (font.widthOfTextAtSize(line, fontSize) <= maxWidth) {
        result.push(line);
      } else {
        let remaining = line;
        while (remaining && font.widthOfTextAtSize(remaining, fontSize) > maxWidth) {
          let end = remaining.length;
          while (end > 1 && font.widthOfTextAtSize(remaining.slice(0, end), fontSize) > maxWidth) {
            end--;
          }
          result.push(remaining.slice(0, end));
          remaining = remaining.slice(end);
        }
        if (remaining) result.push(remaining);
      }
    }
    return result;
  }

  drawTableRow(values: string[], colWidths: number[], rowHeight: number = 16): void {
    const fontSize = 7;
    const lineSpacing = 9;
    const cellPadding = 4;
    const cellLines: string[][] = [];
    let maxLines = 1;
    for (let i = 0; i < values.length; i++) {
      const maxWidth = colWidths[i] - 8;
      const val = displayValue(values[i]);
      const lines = this.wrapTableCell(val, maxWidth, fontSize);
      cellLines.push(lines);
      if (lines.length > maxLines) maxLines = lines.length;
    }
    const dynamicHeight = Math.max(rowHeight, cellPadding + maxLines * lineSpacing + 3);
    this.checkPageBreak(dynamicHeight + 5);
    let x = MARGIN;

    this.drawRect(MARGIN, this.yPosition - dynamicHeight, CONTENT_WIDTH, dynamicHeight);
    this.drawCellDividers(colWidths, this.yPosition - dynamicHeight, dynamicHeight);

    for (let i = 0; i < values.length; i++) {
      const lines = cellLines[i];
      for (let li = 0; li < lines.length; li++) {
        this.drawTextAt(lines[li], x + 4, this.yPosition - 11 - (li * lineSpacing), fontSize, 'normal', TEXT_COLOR);
      }
      x += colWidths[i];
    }
    this.moveDown(dynamicHeight);
  }

  drawEmptyTableMessage(message: string): void {
    this.checkPageBreak(24);
    this.drawRect(MARGIN, this.yPosition - 20, CONTENT_WIDTH, 20);
    const textWidth = this.font.widthOfTextAtSize(sanitizeText(message), 8);
    this.drawTextAt(message, MARGIN + (CONTENT_WIDTH - textWidth) / 2, this.yPosition - 13, 8, 'italic', LABEL_COLOR);
    this.moveDown(20);
  }

  drawComment(user: string, text: string): void {
    if (!text || !text.trim()) return;
    this.checkPageBreak(30);
    this.drawText(`${user}:`, MARGIN + 20, 8, 'bold', LABEL_COLOR);
    this.moveDown(12);

    const maxWidth = CONTENT_WIDTH - 40;
    const words = sanitizeText(text).split(' ');
    let line = '';

    for (const word of words) {
      const testLine = line + (line ? ' ' : '') + word;
      const width = this.fontItalic.widthOfTextAtSize(testLine, 8);
      if (width > maxWidth && line) {
        this.drawText(line, MARGIN + 20, 8, 'italic', LABEL_COLOR);
        this.moveDown(12);
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) {
      this.drawText(line, MARGIN + 20, 8, 'italic', LABEL_COLOR);
      this.moveDown(12);
    }
  }
}

// ---------------------------------------------------------------------------
// Part drawers — each mirrors the on-screen layout of the matching component.
// ---------------------------------------------------------------------------

function drawPartA(builder: PDFBuilder, data: AppraisalPDFData): void {
  builder.drawSectionHeader("Part A: Seafarer's Information");

  builder.drawFieldRow([
    { label: "Seafarer's Name", value: displayValue(data.seafarersName) },
    { label: "Seafarer's Rank", value: displayValue(data.seafarersRank) },
    { label: 'Nationality', value: displayValue(data.nationality) },
  ]);
  builder.drawFieldRow([
    { label: 'Vessel', value: displayValue(data.vessel) },
    { label: 'Sign On Date', value: data.signOn ? formatDate(data.signOn) : '-' },
    { label: 'Appraisal Type', value: displayValue(data.appraisalType) },
  ]);
  builder.drawFieldRow([
    { label: 'Appraisal Period From', value: data.appraisalPeriodFrom ? formatDate(data.appraisalPeriodFrom) : '-' },
    { label: 'Appraisal Period To', value: data.appraisalPeriodTo ? formatDate(data.appraisalPeriodTo) : '-' },
    { label: 'Primary Appraiser', value: displayValue(mapLabel(PRIMARY_APPRAISER_LABELS, data.primaryAppraiser)) },
  ]);
  if (data.visibility.showPersonalityIndex) {
    builder.drawFieldRow([
      { label: 'Personality Index (PI) Category', value: displayValue(mapLabel(PERSONALITY_INDEX_LABELS, data.personalityIndexCategory)) },
      { label: '', value: '' },
      { label: '', value: '' },
    ]);
  }
}

function drawPartB(builder: PDFBuilder, data: AppraisalPDFData): void {
  const { showB1, showB2, showEvaluation } = data.visibility;
  builder.drawSectionHeader('Part B: Trainings & Targets');

  if (showB1) {
    builder.drawSubsectionHeader('B1. Trainings conducted prior joining vessel (To Assess Effectiveness)');
    const trainings = data.trainings ?? [];
    const headers = showEvaluation ? ['S.No', 'Training', 'Evaluation'] : ['S.No', 'Training'];
    const colWidths = showEvaluation ? [40, 315.28, 160] : [40, 475.28];
    builder.drawTableHeader(headers, colWidths);
    if (trainings.length === 0) {
      builder.drawEmptyTableMessage('No trainings added yet. Click "Add Training" to get started.');
    } else {
      trainings.forEach((t, i) => {
        const row = showEvaluation
          ? [`${i + 1}.`, displayValue(t.training), displayValue(mapLabel(TRAINING_EVAL_LABELS, t.evaluation))]
          : [`${i + 1}.`, displayValue(t.training)];
        builder.drawTableRow(row, colWidths);
        if (t.comment && t.comment.trim()) builder.drawComment('Comment', t.comment);
      });
    }
  }

  if (showB2) {
    builder.drawSubsectionHeader('B2. Target Setting');
    const targets = data.targets ?? [];
    const headers = showEvaluation ? ['S.No', 'Target Setting', 'Evaluation'] : ['S.No', 'Target Setting'];
    const colWidths = showEvaluation ? [40, 315.28, 160] : [40, 475.28];
    builder.drawTableHeader(headers, colWidths);
    if (targets.length === 0) {
      builder.drawEmptyTableMessage('No targets added yet. Click "Add Target" to get started.');
    } else {
      targets.forEach((t, i) => {
        const row = showEvaluation
          ? [`${i + 1}.`, displayValue(t.targetSetting), displayValue(mapLabel(TARGET_EVAL_LABELS, t.evaluation))]
          : [`${i + 1}.`, displayValue(t.targetSetting)];
        builder.drawTableRow(row, colWidths);
        if (t.comment && t.comment.trim()) builder.drawComment('Comment', t.comment);
      });
    }
  }
}

function drawPartC(builder: PDFBuilder, data: AppraisalPDFData): void {
  builder.drawSectionHeader('Part C: Competence Assessment (Technical Skills)');
  const rows = data.competenceAssessments ?? [];
  const colWidths = [35, 250, 70, 160.28];
  builder.drawTableHeader(['S.No', 'Assessment Criteria', 'Weight %', 'Effectiveness'], colWidths);
  if (rows.length === 0) {
    builder.drawEmptyTableMessage('No assessment criteria added yet.');
  } else {
    rows.forEach((c, i) => {
      builder.drawTableRow([
        `${i + 1}.`,
        displayValue(c.assessmentCriteria),
        c.weight != null ? String(c.weight) : '-',
        displayValue(mapLabel(EFFECTIVENESS_LABELS, c.effectiveness)),
      ], colWidths);
      if (c.comment && c.comment.trim()) builder.drawComment('Comment', c.comment);
    });
  }
  builder.moveDown(6);
  builder.drawText(`Competence Section Score: ${displayValue(data.competenceSectionScore)}`, MARGIN, 9, 'bold', PRIMARY_COLOR);
  builder.moveDown(LINE_HEIGHT);
}

function drawPartD(builder: PDFBuilder, data: AppraisalPDFData): void {
  builder.drawSectionHeader('Part D: Behavioural Assessment (Soft Skills)');
  const rows = data.behaviouralAssessments ?? [];
  const colWidths = [35, 250, 70, 160.28];
  builder.drawTableHeader(['S.No', 'Assessment Criteria', 'Weight %', 'Effectiveness'], colWidths);
  if (rows.length === 0) {
    builder.drawEmptyTableMessage('No assessment criteria added yet.');
  } else {
    rows.forEach((b, i) => {
      builder.drawTableRow([
        `${i + 1}.`,
        displayValue(b.assessmentCriteria),
        b.weight != null ? String(b.weight) : '-',
        displayValue(mapLabel(EFFECTIVENESS_LABELS, b.effectiveness)),
      ], colWidths);
      if (b.comment && b.comment.trim()) builder.drawComment('Comment', b.comment);
    });
  }
  builder.moveDown(6);
  builder.drawText(`Behavioural Section Score: ${displayValue(data.behaviouralSectionScore)}`, MARGIN, 9, 'bold', PRIMARY_COLOR);
  builder.moveDown(LINE_HEIGHT);
}

function drawPartE(builder: PDFBuilder, data: AppraisalPDFData): void {
  builder.drawSectionHeader('Part E: Training Needs & Development');
  const rows = data.trainingNeeds ?? [];
  const colWidths = [40, 475.28];
  builder.drawTableHeader(['S.No', 'Training'], colWidths);
  if (rows.length === 0) {
    builder.drawEmptyTableMessage('No training needs added yet. Click "Add Training Need" to get started.');
  } else {
    rows.forEach((t, i) => {
      builder.drawTableRow([`${i + 1}.`, displayValue(t.training)], colWidths);
      if (t.comment && t.comment.trim()) builder.drawComment('Comment', t.comment);
    });
  }
}

function drawPartF(builder: PDFBuilder, data: AppraisalPDFData): void {
  builder.drawSectionHeader('Part F: Comments & Recommendations');

  // F1. Overall Score
  builder.drawSubsectionHeader('F1. Overall Score');
  builder.drawFieldRow([
    { label: 'Competence Score', value: displayValue(data.competenceSectionScore) },
    { label: 'Behavioural Score', value: displayValue(data.behaviouralSectionScore) },
    { label: 'Overall Score', value: displayValue(data.overallScore) },
  ]);

  // F2. Appraiser's Recommendations
  builder.drawSubsectionHeader("F2. Appraiser's Recommendations");
  const recs = data.recommendations ?? [];
  const recColWidths = [35, 360.28, 120];
  builder.drawTableHeader(['S.No', 'Recommendations', 'Recommendation Answer'], recColWidths);
  if (recs.length === 0) {
    builder.drawEmptyTableMessage('No recommendations added yet.');
  } else {
    recs.forEach((r, i) => {
      builder.drawTableRow([`${i + 1}.`, displayValue(r.question), displayValue(r.answer)], recColWidths);
      if (r.comment && r.comment.trim()) builder.drawComment('Comment', r.comment);
    });
  }

  // F3. Appraiser Comments
  builder.drawSubsectionHeader('F3. Appraiser Comments');
  const appraisers = data.appraiserComments ?? [];
  if (appraisers.length === 0) {
    builder.drawEmptyTableMessage('No appraiser comments added yet.');
  } else {
    appraisers.forEach((c) => {
      const heading = `${displayValue(c.name)}${c.rank ? `, ${c.rank}` : ''}`;
      builder.drawText(heading, MARGIN, 9, 'bold', TEXT_COLOR);
      builder.moveDown(12);
      builder.drawComment('Comment', c.comment || '');
      builder.moveDown(4);
    });
  }

  // F4. Seafarer Comments
  builder.drawSubsectionHeader('F4. Seafarer Comments');
  const seafarers = data.seafarerComments ?? [];
  if (seafarers.length === 0) {
    builder.drawEmptyTableMessage('No seafarer comments added yet.');
  } else {
    seafarers.forEach((c) => {
      const heading = `${displayValue(c.name)}${c.rank ? `, ${c.rank}` : ''}`;
      builder.drawText(heading, MARGIN, 9, 'bold', TEXT_COLOR);
      builder.moveDown(12);
      builder.drawComment('Comment', c.comment || '');
      builder.moveDown(4);
    });
  }
}

function drawPartG(builder: PDFBuilder, data: AppraisalPDFData): void {
  builder.drawSectionHeader('Part G: Office Review & Followup');

  // G1. Office Reviews
  builder.drawSubsectionHeader('G1. Office Reviews');
  const reviews = data.officeReviews ?? [];
  if (reviews.length === 0) {
    builder.drawEmptyTableMessage('No office reviews added yet. Click "Add Reviewer" to get started.');
  } else {
    reviews.forEach((r) => {
      const heading = `${displayValue(r.name)}${r.position ? `, ${r.position}` : ''}`;
      builder.drawText(heading, MARGIN, 9, 'bold', TEXT_COLOR);
      builder.moveDown(12);
      builder.drawComment('Feedback', r.feedback || '');
      builder.moveDown(4);
    });
  }

  // G2. Training Followup
  builder.drawSubsectionHeader('G2. Training Followup');
  const followups = data.trainingFollowups ?? [];
  const colWidths = [28, 110, 110, 90, 77.28, 100];
  builder.drawTableHeader(['S.No', 'Training', 'Corresponding in DB', 'Category', 'Status', 'Target or Compl. Date'], colWidths);
  if (followups.length === 0) {
    builder.drawEmptyTableMessage('No training followups added yet. Click "Add New Training" to get started.');
  } else {
    followups.forEach((f, i) => {
      builder.drawTableRow([
        `${i + 1}.`,
        displayValue(f.training),
        displayValue(f.correspondingInDB),
        displayValue(f.category),
        displayValue(f.status),
        f.targetDate ? formatDate(f.targetDate) : '-',
      ], colWidths);
      if (f.comment && f.comment.trim()) builder.drawComment('Comment', f.comment);
    });
  }
}

export async function generateAppraisalPDF(data: AppraisalPDFData, name: string): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const builder = new PDFBuilder(pdfDoc, font, fontBold, fontItalic);

  builder.drawText('CREW APPRAISAL FORM', MARGIN, 14, 'bold', PRIMARY_COLOR);
  builder.moveDown(LINE_HEIGHT * 2);

  const v = data.visibility;
  if (v.showA) drawPartA(builder, data);
  if (v.showB && (v.showB1 || v.showB2)) drawPartB(builder, data);
  if (v.showC) drawPartC(builder, data);
  if (v.showD) drawPartD(builder, data);
  if (v.showE) drawPartE(builder, data);
  if (v.showF) drawPartF(builder, data);
  if (v.showG) drawPartG(builder, data);

  builder.finalizeDocument();

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Appraisal_Form_${name.replace(/\s+/g, '_')}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
