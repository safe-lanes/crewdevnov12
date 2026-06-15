import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_WIDTH = A4_WIDTH - 2 * MARGIN;
const LINE_HEIGHT = 14;
const SECTION_SPACING = 16;
const PRIMARY_COLOR = rgb(22 / 255, 86 / 255, 158 / 255);
const LIGHT_GRAY = rgb(0.96, 0.96, 0.96);
const ZEBRA = rgb(0.975, 0.975, 0.98);
const BORDER_COLOR = rgb(0.82, 0.82, 0.82);
const TEXT_COLOR = rgb(0.15, 0.15, 0.15);
const LABEL_COLOR = rgb(0.35, 0.35, 0.35);
const HEADER_TEXT = rgb(0.3, 0.3, 0.3);
const FOOTER_Y = 25;
const DASH = '—';

export interface LabelValue {
  label: string;
  value: string;
}

export interface PdfTable {
  headers: string[];
  widths: number[];
  rows: string[][];
  emptyText?: string;
}

export interface AppraisalPDFPayload {
  headerFormName: string;
  docContext: string;
  appraisalNo: string;
  basicFields: LabelValue[];
  statusFields: LabelValue[];
  showB: boolean;
  showB1: boolean;
  showB2: boolean;
  showC: boolean;
  showD: boolean;
  showE: boolean;
  showF: boolean;
  showG: boolean;
  trainings: PdfTable;
  targets: PdfTable;
  competenceScore?: string;
  competence: PdfTable;
  behaviouralScore?: string;
  behavioural: PdfTable;
  trainingNeeds: PdfTable;
  overallScore?: string;
  recommendations: PdfTable;
  appraiserComments: PdfTable;
  seafarerComments: PdfTable;
  officeReviews: PdfTable;
  trainingFollowups: PdfTable;
}

type FontType = 'normal' | 'bold' | 'italic';

function sanitize(t: string): string {
  return (t || '').replace(/[\t\n\r]/g, ' ').replace(/[\x00-\x1F]/g, '');
}

function show(v: string | undefined | null): string {
  if (v === undefined || v === null || String(v).trim() === '') return DASH;
  return sanitize(String(v));
}

class PDFBuilder {
  private doc: PDFDocument;
  private page: PDFPage;
  private font: PDFFont;
  private bold: PDFFont;
  private italic: PDFFont;
  private y: number;

  constructor(doc: PDFDocument, font: PDFFont, bold: PDFFont, italic: PDFFont) {
    this.doc = doc;
    this.font = font;
    this.bold = bold;
    this.italic = italic;
    this.page = doc.addPage([A4_WIDTH, A4_HEIGHT]);
    this.y = A4_HEIGHT - MARGIN;
  }

  private pick(type: FontType): PDFFont {
    return type === 'bold' ? this.bold : type === 'italic' ? this.italic : this.font;
  }

  private newPage(): void {
    this.page = this.doc.addPage([A4_WIDTH, A4_HEIGHT]);
    this.y = A4_HEIGHT - MARGIN;
  }

  checkBreak(h = LINE_HEIGHT * 2): void {
    if (this.y - h < MARGIN + FOOTER_Y) this.newPage();
  }

  moveDown(a = LINE_HEIGHT): void {
    this.y -= a;
    this.checkBreak();
  }

  widthOf(t: string, size: number, bold = false): number {
    return (bold ? this.bold : this.font).widthOfTextAtSize(sanitize(t), size);
  }

  text(t: string, x: number, size = 9, type: FontType = 'normal', color = TEXT_COLOR): void {
    this.textAt(t, x, this.y, size, type, color);
  }

  textAt(t: string, x: number, y: number, size = 9, type: FontType = 'normal', color = TEXT_COLOR): void {
    this.page.drawText(sanitize(t), { x, y, size, font: this.pick(type), color });
  }

  line(x1: number, y1: number, x2: number, y2: number, thickness = 0.5, color = BORDER_COLOR): void {
    this.page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color });
  }

  rect(x: number, y: number, w: number, h: number, fill = false, fillColor = LIGHT_GRAY): void {
    if (fill) this.page.drawRectangle({ x, y, width: w, height: h, color: fillColor });
    this.page.drawRectangle({ x, y, width: w, height: h, borderColor: BORDER_COLOR, borderWidth: 0.5 });
  }

  private wrap(text: string, maxWidth: number, size: number, bold = false): string[] {
    const f = bold ? this.bold : this.font;
    const t = sanitize(text);
    if (!t) return [''];
    if (f.widthOfTextAtSize(t, size) <= maxWidth) return [t];
    const words = t.split(/\s+/);
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (f.widthOfTextAtSize(test, size) > maxWidth && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);
    const out: string[] = [];
    for (const ln of lines) {
      if (f.widthOfTextAtSize(ln, size) <= maxWidth) {
        out.push(ln);
        continue;
      }
      let rem = ln;
      while (rem && f.widthOfTextAtSize(rem, size) > maxWidth) {
        let end = rem.length;
        while (end > 1 && f.widthOfTextAtSize(rem.slice(0, end), size) > maxWidth) end--;
        out.push(rem.slice(0, end));
        rem = rem.slice(end);
      }
      if (rem) out.push(rem);
    }
    return out.length ? out : [''];
  }

  drawDocHeader(docContext: string, appraisalNo: string, formName: string): void {
    this.text(docContext.toUpperCase(), MARGIN, 8, 'normal', LABEL_COLOR);
    const noText = `APPRAISAL NO: ${appraisalNo}`;
    this.text(noText, MARGIN + CONTENT_WIDTH - this.widthOf(noText, 8), 8, 'normal', LABEL_COLOR);
    this.moveDown(LINE_HEIGHT);
    this.moveDown(4);
    this.line(MARGIN, this.y, MARGIN + CONTENT_WIDTH, this.y, 2, PRIMARY_COLOR);
    this.moveDown(8);
    const title = formName.toUpperCase();
    this.text(title, MARGIN + (CONTENT_WIDTH - this.widthOf(title, 14, true)) / 2, 14, 'bold', PRIMARY_COLOR);
    this.moveDown(10);
    this.line(MARGIN, this.y, MARGIN + CONTENT_WIDTH, this.y, 2, PRIMARY_COLOR);
    this.moveDown(LINE_HEIGHT);
  }

  drawSectionHeader(title: string): void {
    this.checkBreak(30);
    this.moveDown(SECTION_SPACING);
    this.text(title, MARGIN, 12, 'bold', PRIMARY_COLOR);
    this.moveDown(5);
    this.line(MARGIN, this.y, MARGIN + CONTENT_WIDTH, this.y, 2, PRIMARY_COLOR);
    this.moveDown(LINE_HEIGHT);
  }

  drawSubHeader(title: string): void {
    this.checkBreak(22);
    this.moveDown(8);
    this.text(title, MARGIN, 10, 'bold', PRIMARY_COLOR);
    this.moveDown(LINE_HEIGHT);
  }

  drawFieldGrid(fields: LabelValue[]): void {
    const colW = CONTENT_WIDTH / 2;
    for (let i = 0; i < fields.length; i += 2) {
      const pair = fields.slice(i, i + 2);
      const wrapped = pair.map((f) => this.wrap(show(f.value), colW - 6, 9));
      const maxLines = Math.max(1, ...wrapped.map((w) => w.length));
      const h = LINE_HEIGHT * 2 + (maxLines > 1 ? (maxLines - 1) * 11 : 0);
      this.checkBreak(h);
      let x = MARGIN;
      pair.forEach((f, idx) => {
        this.textAt(f.label, x, this.y, 8, 'normal', LABEL_COLOR);
        wrapped[idx].forEach((ln, li) => this.textAt(ln, x, this.y - 12 - li * 11, 9, 'normal'));
        x += colW;
      });
      this.moveDown(h);
    }
  }

  drawScore(label: string, value?: string): void {
    if (!value || !String(value).trim()) return;
    this.checkBreak(LINE_HEIGHT);
    const lbl = `${label}:`;
    this.text(lbl, MARGIN, 9, 'normal', LABEL_COLOR);
    this.text(String(value), MARGIN + this.widthOf(lbl, 9) + 8, 9, 'bold', PRIMARY_COLOR);
    this.moveDown(LINE_HEIGHT);
  }

  drawTable(table: PdfTable): void {
    const colW = table.widths.map((w) => w * CONTENT_WIDTH);
    this.drawRow(table.headers, colW, true, 0);
    if (!table.rows.length) {
      this.checkBreak(LINE_HEIGHT);
      this.text(table.emptyText || 'No entries.', MARGIN + 4, 8, 'italic', LABEL_COLOR);
      this.moveDown(LINE_HEIGHT);
      return;
    }
    table.rows.forEach((r, i) => this.drawRow(r, colW, false, i));
  }

  private drawRow(values: string[], colW: number[], isHeader: boolean, idx: number): void {
    const size = 7;
    const lineSpacing = 9;
    const pad = 4;
    const cellLines = values.map((v, i) => this.wrap(isHeader ? v : show(v), colW[i] - 8, size, isHeader));
    const maxLines = Math.max(1, ...cellLines.map((l) => l.length));
    const h = Math.max(16, pad + maxLines * lineSpacing + 3);
    this.checkBreak(h + 5);
    const top = this.y;
    const fill = isHeader ? LIGHT_GRAY : idx % 2 === 1 ? ZEBRA : undefined;
    this.rect(MARGIN, top - h, CONTENT_WIDTH, h, !!fill, fill || LIGHT_GRAY);
    let dx = MARGIN;
    for (let i = 0; i < colW.length - 1; i++) {
      dx += colW[i];
      this.line(dx, top - h, dx, top, 0.5);
    }
    let x = MARGIN;
    cellLines.forEach((lines, i) => {
      lines.forEach((ln, li) =>
        this.textAt(
          ln,
          x + 4,
          top - 11 - li * lineSpacing,
          size,
          isHeader ? 'bold' : 'normal',
          isHeader ? HEADER_TEXT : TEXT_COLOR,
        ),
      );
      x += colW[i];
    });
    this.moveDown(h);
  }

  finalize(): void {
    const pages = this.doc.getPages();
    const total = pages.length;
    pages.forEach((page, i) => {
      page.drawLine({
        start: { x: MARGIN, y: FOOTER_Y + 10 },
        end: { x: MARGIN + CONTENT_WIDTH, y: FOOTER_Y + 10 },
        thickness: 0.3,
        color: BORDER_COLOR,
      });
      const txt = `Page ${i + 1} of ${total}`;
      page.drawText(txt, {
        x: MARGIN + (CONTENT_WIDTH - this.font.widthOfTextAtSize(txt, 7)) / 2,
        y: FOOTER_Y,
        size: 7,
        font: this.font,
        color: LABEL_COLOR,
      });
    });
  }
}

export async function generateAppraisalPDF(p: AppraisalPDFPayload, seafarerName: string): Promise<void> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const b = new PDFBuilder(doc, font, bold, italic);

  b.drawDocHeader(p.docContext, p.appraisalNo, p.headerFormName);

  b.drawSectionHeader('A. Seafarer Information');
  b.drawSubHeader('A1. Basic');
  b.drawFieldGrid(p.basicFields);
  b.drawSubHeader('A2. Status');
  b.drawFieldGrid(p.statusFields);

  if (p.showB) {
    b.drawSectionHeader('B. Information at Start of Appraisal Period');
    if (p.showB1) {
      b.drawSubHeader('B1. Trainings');
      b.drawTable(p.trainings);
    }
    if (p.showB2) {
      b.drawSubHeader('B2. Targets');
      b.drawTable(p.targets);
    }
  }

  if (p.showC) {
    b.drawSectionHeader('C. Competence Assessment');
    b.drawScore('Competence Section Score', p.competenceScore);
    b.drawTable(p.competence);
  }

  if (p.showD) {
    b.drawSectionHeader('D. Behavioural Assessment');
    b.drawScore('Behavioural Section Score', p.behaviouralScore);
    b.drawTable(p.behavioural);
  }

  if (p.showE) {
    b.drawSectionHeader('E. Training Needs & Development');
    b.drawTable(p.trainingNeeds);
  }

  if (p.showF) {
    b.drawSectionHeader('F. Comments & Recommendations');
    b.drawSubHeader('F1. Overall Score');
    b.drawScore('Final Overall Score', p.overallScore);
    b.drawSubHeader("F2. Appraiser's Recommendations");
    b.drawTable(p.recommendations);
    b.drawSubHeader('F3. Appraiser Comments');
    b.drawTable(p.appraiserComments);
    b.drawSubHeader('F4. Seafarer Comments');
    b.drawTable(p.seafarerComments);
  }

  if (p.showG) {
    b.drawSectionHeader('G. Office Review & Followup');
    b.drawSubHeader('G1. Office Reviews');
    b.drawTable(p.officeReviews);
    b.drawSubHeader('G2. Training Followups');
    b.drawTable(p.trainingFollowups);
  }

  b.finalize();

  const bytes = await doc.save();
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Appraisal_Form_${seafarerName.replace(/\s+/g, '_')}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
