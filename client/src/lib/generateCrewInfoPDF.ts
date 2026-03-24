import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';

interface ChildInfo {
  firstName: string;
  middleName: string;
  familyName: string;
  dateOfBirth: string;
  gender: string;
}

interface DocumentInfo {
  id: string;
  documentId: string;
  document: string;
  number: string;
  issued: string;
  expiry: string;
  issuingAuthority: string;
}

interface Visa {
  id: string;
  countryId: string;
  issuingCountry: string;
  serialNo: string;
  issued: string;
  expiry: string;
  visaType: string;
}

interface Education {
  id: string;
  dateOfCompletion: string;
  schoolCollegeUniversity: string;
  subjectsField: string;
  qualifications: string;
}

interface License {
  id: string;
  licenseId: string;
  certificateDocument: string;
  abbr: string;
  requirement: string;
  certificateNo: string;
  issuingAuthority: string;
  issued: string;
  expiry: string;
  archivedAt?: string;
  archivedReason?: string;
}

interface TrainingCourse {
  id: string;
  courseId?: string;
  companyId?: string;
  trainingCourse: string;
  abbr: string;
  requirement: string;
  certificateNo: string;
  issuingAuthority: string;
  issued: string;
  expiry: string;
}

interface SeaService {
  id: string;
  vesselName: string;
  vesselCode: string;
  vesselType: string;
  deadweight: string;
  engineTypePower: string;
  ownerOperator: string;
  rank: string;
  from: string;
  to: string;
  periodMonths: string;
  experienceCategories?: string[];
}

interface PreJoiningMedical {
  id: string;
  vesselCode: string;
  vessel: string;
  dateOfMedical: string;
  bp: string;
  weight: string;
  anyMedicationPrescribed: string;
  fitnessForDuty: string;
  expiry: string;
}

interface DoctorVisit {
  id: string;
  vessel: string;
  port: string;
  date: string;
  complaint: string;
  doctorComments: string;
}

export interface CrewInfoFormData {
  firstName: string;
  middleName: string;
  familyName: string;
  gender: string;
  nationality: string;
  presentRank: string;
  dateOfBirth: string;
  ageInYears: string;
  placeOfBirthCity: string;
  placeOfBirthCountry: string;
  heightCm: string;
  weightKg: string;
  bmi: string;
  nativeLanguage: string;
  foreignLanguages: string;
  englishProficiency: string;
  rankAppliedFor: string;
  vesselType: string[];
  manningAgent: string;
  crewPool: string;
  employeeId: string;
  nextAvailability: string;
  countryOfResidence: string;
  nearestAirport: string;
  residentialAddressLine1: string;
  residentialAddressLine2: string;
  contactLandline: string;
  mobile: string;
  email: string;
  maritalStatus: string;
  numberOfDependentChildren: string;
  fatherName: string;
  motherName: string;
  spouseFirstName: string;
  spouseMiddleName: string;
  spouseFamilyName: string;
  spouseDateOfBirth: string;
  children: ChildInfo[];
  nokFirstName: string;
  nokMiddleName: string;
  nokFamilyName: string;
  nokTelephone: string;
  nokEmail: string;
  nokAddress: string;
  nokRelationship: string;
  documents: DocumentInfo[];
  visas: Visa[];
  education: Education[];
  licenses: License[];
  trainingCourses: TrainingCourse[];
  currentCompanySeaService: SeaService[];
  externalSeaService: SeaService[];
  preJoiningMedicals: PreJoiningMedical[];
  doctorVisits: DoctorVisit[];
}

export interface DashboardData {
  status?: {
    status: string;
    vessel: string | null;
    joinedDate: string | null;
    sailingDue: string | null;
    nextAvailability?: string | null;
    nearestAirport?: string | null;
    nokInfo?: string | null;
  };
  experience?: {
    company: number;
    rank: number;
    tankers: number;
    ocw: number;
    endorsements: string | number;
  };
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

  // Crop image to target aspect ratio using Canvas (center crop)
  private async cropImageToAspectRatio(base64Data: string, targetWidth: number, targetHeight: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const targetAspect = targetWidth / targetHeight;
        const imgAspect = img.width / img.height;
        
        let cropX = 0;
        let cropY = 0;
        let cropWidth = img.width;
        let cropHeight = img.height;
        
        if (imgAspect > targetAspect) {
          // Image is wider - crop sides (center crop)
          cropWidth = img.height * targetAspect;
          cropX = (img.width - cropWidth) / 2;
        } else {
          // Image is taller - crop top/bottom (center crop)
          cropHeight = img.width / targetAspect;
          cropY = (img.height - cropHeight) / 2;
        }
        
        // Create canvas with the cropped dimensions at higher resolution for quality
        const canvas = document.createElement('canvas');
        const scale = 2; // Higher resolution for better print quality
        canvas.width = targetWidth * scale;
        canvas.height = targetHeight * scale;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        // Draw the cropped portion scaled to target dimensions
        ctx.drawImage(
          img,
          cropX, cropY, cropWidth, cropHeight, // source rectangle (cropped area)
          0, 0, canvas.width, canvas.height     // destination rectangle (full canvas)
        );
        
        // Convert to PNG base64
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = base64Data;
    });
  }

  async drawImage(base64Data: string, x: number, y: number, targetWidth: number, targetHeight: number): Promise<boolean> {
    try {
      if (!base64Data) return false;
      
      // Pre-crop the image using Canvas to achieve passport-size center crop
      // This avoids distortion by cropping before embedding
      const croppedImageData = await this.cropImageToAspectRatio(base64Data, targetWidth, targetHeight);
      
      const base64Clean = croppedImageData.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
      const imageBytes = Uint8Array.from(atob(base64Clean), c => c.charCodeAt(0));
      
      // After cropping, embed as PNG (canvas outputs PNG)
      const image = await this.pdfDoc.embedPng(imageBytes);
      
      // Draw at exact target dimensions - image is already cropped to correct aspect ratio
      this.currentPage.drawImage(image, {
        x,
        y: y - targetHeight,
        width: targetWidth,
        height: targetHeight,
      });
      
      return true;
    } catch (error) {
      console.error('Failed to embed image:', error);
      return false;
    }
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

  private wrapTableCell(text: string, maxWidth: number, fontSize: number): string[] {
    if (this.font.widthOfTextAtSize(text, fontSize) <= maxWidth) return [text];
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      if (this.font.widthOfTextAtSize(testLine, fontSize) > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
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

  drawTableHeader(headers: string[], colWidths: number[]): void {
    const fontSize = 7;
    const lineSpacing = 9;
    const cellPadding = 4;
    const cellLines: string[][] = [];
    let maxLines = 1;
    for (let i = 0; i < headers.length; i++) {
      const maxWidth = colWidths[i] - 8;
      const lines = this.wrapTableCell(headers[i], maxWidth, fontSize);
      cellLines.push(lines);
      if (lines.length > maxLines) maxLines = lines.length;
    }
    const headerHeight = Math.max(20, cellPadding + maxLines * lineSpacing + 3);
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
      const lines = cellLines[i];
      for (let li = 0; li < lines.length; li++) {
        this.drawTextAt(lines[li], x + 4, this.yPosition - 11 - (li * lineSpacing), fontSize, 'bold', TEXT_COLOR);
      }
      x += colWidths[i];
    }
    this.moveDown(headerHeight);
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
}

// Passport photo dimensions: 35mm x 45mm converted to PDF points
// 1 inch = 25.4mm, 1 inch = 72 points
// 35mm = 35/25.4 * 72 ≈ 99 points, 45mm = 45/25.4 * 72 ≈ 128 points
const PHOTO_WIDTH = 99;
const PHOTO_HEIGHT = 128;

export async function generateCrewInfoPDF(
  formData: CrewInfoFormData, 
  crewName: string, 
  dashboardData?: DashboardData,
  uploadedPhoto?: string | null
): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const builder = new PDFBuilder(pdfDoc, font, fontBold, fontItalic);

  builder.drawText('CREW INFORMATION FORM', MARGIN, 14, 'bold', PRIMARY_COLOR);

  const crewId = formData.employeeId || '';
  if (crewId) {
    const crewIdLabel = 'Crew ID:';
    const crewIdText = `${crewIdLabel} ${crewId}`;
    const crewIdFontSize = 10;
    const crewIdWidth = fontBold.widthOfTextAtSize(crewIdText, crewIdFontSize);
    const photoLeftX = A4_WIDTH - MARGIN - PHOTO_WIDTH;
    const crewIdX = photoLeftX - crewIdWidth - 10;
    builder.drawTextAt(crewIdText, crewIdX, builder.getY(), crewIdFontSize, 'bold', PRIMARY_COLOR);
  }

  builder.moveDown(LINE_HEIGHT + 6);
  
  builder.drawText(crewName, MARGIN, 11, 'normal');
  builder.moveDown(LINE_HEIGHT);
  
  const rank = formData.presentRank || '-';
  builder.drawText(rank, MARGIN, 10, 'normal', LABEL_COLOR);
  builder.moveDown(LINE_HEIGHT);
  
  const textBottomY = builder.getY();
  const gap = 2;
  
  if (uploadedPhoto) {
    const photoY = A4_HEIGHT - MARGIN;
    const photoX = A4_WIDTH - MARGIN - PHOTO_WIDTH;
    await builder.drawImage(uploadedPhoto, photoX, photoY, PHOTO_WIDTH, PHOTO_HEIGHT);
    const photoBottomY = photoY - PHOTO_HEIGHT;
    builder.setY(Math.min(textBottomY, photoBottomY - gap));
  } else {
    builder.setY(textBottomY - gap);
  }

  await drawPartA(builder, formData, dashboardData);
  drawPartB(builder, formData);
  drawPartC(builder, formData);
  drawPartD(builder, formData);
  drawPartE(builder, formData);
  drawPartF(builder, formData);

  builder.finalizeDocument();

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Crew_Info_${crewName.replace(/\s+/g, '_')}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function drawPartA(
  builder: PDFBuilder, 
  formData: CrewInfoFormData, 
  dashboardData?: DashboardData
): Promise<void> {
  builder.drawSectionHeader('PART A - DASHBOARD');

  const statusData = dashboardData?.status;
  const experienceData = dashboardData?.experience;

  builder.drawSubsectionHeader('Status');
  builder.drawFieldRow([
    { label: 'Current Status', value: statusData?.status || '' },
    { label: 'Vessel', value: statusData?.vessel || '' },
    { label: 'Sign On Date', value: formatDate(statusData?.joinedDate || undefined) },
  ]);
  builder.drawFieldRow([
    { label: 'Relief Due', value: formatDate(statusData?.sailingDue || undefined) },
    { label: 'Next Availability', value: formatDate(statusData?.nextAvailability || formData.nextAvailability || undefined) },
    { label: 'Nearest Airport', value: statusData?.nearestAirport || formData.nearestAirport || '' },
  ]);
  
  const nokInfo = formData.nokFirstName 
    ? `${formData.nokFirstName} ${formData.nokFamilyName || ''}, ${formData.nokRelationship || ''}, ${formData.nokTelephone || ''}`.trim()
    : '';
  builder.drawFieldRow([
    { label: 'Next of Kin', value: nokInfo },
    { label: '', value: '' },
    { label: '', value: '' },
  ]);

  builder.drawSubsectionHeader('Experience (Years)');
  builder.drawFieldRow([
    { label: 'Company', value: experienceData?.company?.toString() || '' },
    { label: 'Rank', value: experienceData?.rank?.toString() || '' },
    { label: 'Tanker', value: experienceData?.tankers?.toString() || '' },
  ]);
  builder.drawFieldRow([
    { label: 'OOW', value: experienceData?.ocw?.toString() || '' },
    { label: 'Endorsements', value: typeof experienceData?.endorsements === 'number' ? experienceData.endorsements.toString() : experienceData?.endorsements || '' },
    { label: '', value: '' },
  ]);
}


function drawPartB(builder: PDFBuilder, formData: CrewInfoFormData): void {
  builder.drawSectionHeader('PART B - SEAFARER\'S PARTICULARS');

  builder.drawSubsectionHeader('B1 General Particulars');
  builder.drawFieldRow([
    { label: 'First Name', value: formData.firstName },
    { label: 'Middle Name', value: formData.middleName },
    { label: 'Family Name', value: formData.familyName },
  ]);
  builder.drawFieldRow([
    { label: 'Gender', value: formData.gender },
    { label: 'Rank', value: formData.presentRank },
    { label: 'Vessel Type', value: formData.vesselType?.join(', ') || '' },
  ]);
  builder.drawFieldRow([
    { label: 'Nationality', value: formData.nationality },
    { label: 'Date of birth', value: formatDate(formData.dateOfBirth) },
    { label: 'Age( Years )', value: formData.ageInYears },
  ]);
  builder.drawFieldRow([
    { label: 'Place of birth( City )', value: formData.placeOfBirthCity },
    { label: 'Place of birth( Country )', value: formData.placeOfBirthCountry },
    { label: 'Height( Cm )', value: formData.heightCm },
  ]);
  builder.drawFieldRow([
    { label: 'Weight( kg )', value: formData.weightKg },
    { label: 'BMI (Auto Generated)', value: formData.bmi },
    { label: 'Native Language', value: formData.nativeLanguage },
  ]);
  builder.drawFieldRow([
    { label: 'Foreign Languages', value: formData.foreignLanguages },
    { label: 'English Proficiency', value: formData.englishProficiency },
    { label: 'Manning Agent', value: formData.manningAgent },
  ]);

  builder.drawSubsectionHeader('B2 Address & Contact Info');
  builder.drawFieldRow([
    { label: 'Country of Residence', value: formData.countryOfResidence },
    { label: 'Nearest Airport', value: formData.nearestAirport },
    { label: 'Residential Address Line 1', value: formData.residentialAddressLine1 },
    { label: 'Residential Address Line 2', value: formData.residentialAddressLine2 },
  ], CONTENT_WIDTH / 4);
  builder.drawFieldRow([
    { label: 'Contact ( Landline )', value: formData.contactLandline },
    { label: 'Mobile', value: formData.mobile },
    { label: 'Email', value: formData.email },
    { label: '', value: '' },
  ], CONTENT_WIDTH / 4);

  builder.drawSubsectionHeader('B3 Family and NOK');
  builder.drawFieldRow([
    { label: 'Marital Status', value: formData.maritalStatus },
    { label: 'No. of Dependant Children', value: formData.numberOfDependentChildren },
    { label: 'Father\'s Name', value: formData.fatherName },
    { label: 'Mother\'s Name', value: formData.motherName },
  ], CONTENT_WIDTH / 4);
  builder.drawFieldRow([
    { label: 'Spouse First Name', value: formData.spouseFirstName },
    { label: 'Spouse Middle Name', value: formData.spouseMiddleName },
    { label: 'Spouse Family Name', value: formData.spouseFamilyName },
    { label: 'Spouse Date of Birth', value: formatDate(formData.spouseDateOfBirth) },
  ], CONTENT_WIDTH / 4);

  if (formData.children && formData.children.length > 0) {
    builder.checkPageBreak(50);
    builder.drawText('Children Information:', MARGIN, 9, 'bold');
    builder.moveDown(LINE_HEIGHT);
    const childColWidths = [CONTENT_WIDTH * 0.08, CONTENT_WIDTH * 0.22, CONTENT_WIDTH * 0.18, CONTENT_WIDTH * 0.22, CONTENT_WIDTH * 0.15, CONTENT_WIDTH * 0.15];
    builder.drawTableHeader(['S.No', 'First Name', 'Middle Name', 'Family Name', 'Date of Birth', 'Gender'], childColWidths);
    formData.children.forEach((child, index) => {
      builder.drawTableRow([
        `${index + 1}.`,
        child.firstName || '',
        child.middleName || '',
        child.familyName || '',
        formatDate(child.dateOfBirth),
        child.gender || '',
      ], childColWidths);
    });
  }

  builder.moveDown(LINE_HEIGHT);
  builder.drawText('Next of Kin:', MARGIN, 9, 'bold');
  builder.moveDown(LINE_HEIGHT);
  builder.drawFieldRow([
    { label: 'NOK: First Name', value: formData.nokFirstName },
    { label: 'NOK: Middle Name', value: formData.nokMiddleName },
    { label: 'NOK: Family Name', value: formData.nokFamilyName },
    { label: 'NOK: Relationship', value: formData.nokRelationship },
  ], CONTENT_WIDTH / 4);
  builder.drawFieldRow([
    { label: 'NOK: Telephone', value: formData.nokTelephone },
    { label: 'NOK: Email', value: formData.nokEmail },
    { label: 'NOK: Address', value: formData.nokAddress },
    { label: '', value: '' },
  ], CONTENT_WIDTH / 4);
}

function drawPartC(builder: PDFBuilder, formData: CrewInfoFormData): void {
  builder.drawSectionHeader('PART C - TRAVEL & ID DOCUMENTS');

  builder.drawSubsectionHeader('C1 Travel and Identification Docs');
  const docColWidths = [CONTENT_WIDTH * 0.25, CONTENT_WIDTH * 0.18, CONTENT_WIDTH * 0.14, CONTENT_WIDTH * 0.14, CONTENT_WIDTH * 0.29];
  builder.drawTableHeader(['Document', 'Number', 'Issued', 'Expiry', 'Issuing Authority'], docColWidths);
  if (formData.documents && formData.documents.length > 0) {
    for (const doc of formData.documents) {
      builder.drawTableRow([
        doc.document || '',
        doc.number || '',
        formatDate(doc.issued),
        formatDate(doc.expiry),
        doc.issuingAuthority || '',
      ], docColWidths);
    }
  } else {
    builder.drawTableRow(['-', '-', '-', '-', '-'], docColWidths);
  }

  builder.drawSubsectionHeader('C2 Visas');
  const visaColWidths = [CONTENT_WIDTH * 0.25, CONTENT_WIDTH * 0.20, CONTENT_WIDTH * 0.17, CONTENT_WIDTH * 0.18, CONTENT_WIDTH * 0.20];
  builder.drawTableHeader(['Issuing Country', 'S.No.( If Applicable )', 'Issued', 'Expiry', 'Visa Type'], visaColWidths);
  if (formData.visas && formData.visas.length > 0) {
    for (const visa of formData.visas) {
      builder.drawTableRow([
        visa.issuingCountry || '',
        visa.serialNo || '',
        formatDate(visa.issued),
        formatDate(visa.expiry),
        visa.visaType || '',
      ], visaColWidths);
    }
  } else {
    builder.drawTableRow(['-', '-', '-', '-', '-'], visaColWidths);
  }
}

function drawPartD(builder: PDFBuilder, formData: CrewInfoFormData): void {
  builder.drawSectionHeader('PART D - TRAINING & CERTIFICATES');

  builder.drawSubsectionHeader('D1 Education');
  const eduColWidths = [CONTENT_WIDTH * 0.25, CONTENT_WIDTH * 0.27, CONTENT_WIDTH * 0.30, CONTENT_WIDTH * 0.18];
  builder.drawTableHeader(['Qualifications', 'Subjects/Field', 'School/College/University', 'Date of Completion'], eduColWidths);
  if (formData.education && formData.education.length > 0) {
    for (const edu of formData.education) {
      builder.drawTableRow([
        edu.qualifications || '',
        edu.subjectsField || '',
        edu.schoolCollegeUniversity || '',
        formatDate(edu.dateOfCompletion),
      ], eduColWidths);
    }
  } else {
    builder.drawTableRow(['-', '-', '-', '-'], eduColWidths);
  }

  builder.drawSubsectionHeader('D2 License & DCE');
  const licColWidths = [CONTENT_WIDTH * 0.06, CONTENT_WIDTH * 0.20, CONTENT_WIDTH * 0.08, CONTENT_WIDTH * 0.10, CONTENT_WIDTH * 0.12, CONTENT_WIDTH * 0.16, CONTENT_WIDTH * 0.12, CONTENT_WIDTH * 0.16];
  builder.drawTableHeader(['ID', 'Certificate/Document', 'Abbr', 'Requirement', 'Certificate No', 'Issuing Authority', 'Issued', 'Expiry'], licColWidths);
  const allLicenses = formData.licenses || [];
  if (allLicenses.length > 0) {
    for (const lic of allLicenses) {
      builder.drawTableRow([
        lic.licenseId || '',
        lic.certificateDocument || '',
        lic.abbr || '',
        lic.requirement || '',
        lic.certificateNo || '',
        lic.issuingAuthority || '',
        formatDate(lic.issued),
        formatDate(lic.expiry),
      ], licColWidths);
    }
  } else {
    builder.drawTableRow(['-', '-', '-', '-', '-', '-', '-', '-'], licColWidths);
  }

  builder.drawSubsectionHeader('D3 Training Course');
  const trainColWidths = [CONTENT_WIDTH * 0.10, CONTENT_WIDTH * 0.18, CONTENT_WIDTH * 0.08, CONTENT_WIDTH * 0.10, CONTENT_WIDTH * 0.12, CONTENT_WIDTH * 0.16, CONTENT_WIDTH * 0.12, CONTENT_WIDTH * 0.14];
  builder.drawTableHeader(['Company ID', 'Training Course', 'Abbr', 'Requirement', 'Certificate No', 'Issuing Authority', 'Issued', 'Expiry'], trainColWidths);
  if (formData.trainingCourses && formData.trainingCourses.length > 0) {
    for (const course of formData.trainingCourses) {
      builder.drawTableRow([
        course.courseId || course.companyId || '',
        course.trainingCourse || '',
        course.abbr || '',
        course.requirement || '',
        course.certificateNo || '',
        course.issuingAuthority || '',
        formatDate(course.issued),
        formatDate(course.expiry),
      ], trainColWidths);
    }
  } else {
    builder.drawTableRow(['-', '-', '-', '-', '-', '-', '-', '-'], trainColWidths);
  }
}

function drawPartE(builder: PDFBuilder, formData: CrewInfoFormData): void {
  builder.drawSectionHeader('PART E - SEA SERVICE');

  builder.drawSubsectionHeader('E1. Details of Sea Service (Company)');
  const seaColWidths = [CONTENT_WIDTH * 0.12, CONTENT_WIDTH * 0.09, CONTENT_WIDTH * 0.07, CONTENT_WIDTH * 0.10, CONTENT_WIDTH * 0.11, CONTENT_WIDTH * 0.08, CONTENT_WIDTH * 0.11, CONTENT_WIDTH * 0.11, CONTENT_WIDTH * 0.06, CONTENT_WIDTH * 0.15];
  builder.drawTableHeader(['Vessel Name', 'Vessel Type', 'Deadweight', 'Engine Type/ Power', 'Owner / operator', 'Rank', 'From', 'To', 'Period(M)', 'Experience'], seaColWidths);
  if (formData.currentCompanySeaService && formData.currentCompanySeaService.length > 0) {
    for (const service of formData.currentCompanySeaService) {
      builder.drawTableRow([
        service.vesselName || '',
        service.vesselType || '',
        service.deadweight || '',
        service.engineTypePower || '',
        service.ownerOperator || '',
        service.rank || '',
        formatDate(service.from),
        formatDate(service.to),
        service.periodMonths || '',
        (service.experienceCategories || []).join(', '),
      ], seaColWidths);
    }
  } else {
    builder.drawTableRow(['-', '-', '-', '-', '-', '-', '-', '-', '-', '-'], seaColWidths);
  }

  builder.drawSubsectionHeader('E2. Details of Sea Service (External)');
  builder.drawTableHeader(['Vessel Name', 'Vessel Type', 'Deadweight', 'Engine Type/ Power', 'Owner / operator', 'Rank', 'From', 'To', 'Period(M)', 'Experience'], seaColWidths);
  if (formData.externalSeaService && formData.externalSeaService.length > 0) {
    for (const service of formData.externalSeaService) {
      builder.drawTableRow([
        service.vesselName || '',
        service.vesselType || '',
        service.deadweight || '',
        service.engineTypePower || '',
        service.ownerOperator || '',
        service.rank || '',
        formatDate(service.from),
        formatDate(service.to),
        service.periodMonths || '',
        (service.experienceCategories || []).join(', '),
      ], seaColWidths);
    }
  } else {
    builder.drawTableRow(['-', '-', '-', '-', '-', '-', '-', '-', '-', '-'], seaColWidths);
  }
}

function drawPartF(builder: PDFBuilder, formData: CrewInfoFormData): void {
  builder.drawSectionHeader('PART F - MEDICAL RECORDS');

  builder.drawSubsectionHeader('F1. Pre Joining Medicals');
  const medColWidths = [CONTENT_WIDTH * 0.14, CONTENT_WIDTH * 0.12, CONTENT_WIDTH * 0.10, CONTENT_WIDTH * 0.10, CONTENT_WIDTH * 0.18, CONTENT_WIDTH * 0.18, CONTENT_WIDTH * 0.18];
  builder.drawTableHeader(['Vessel', 'Date of Medical', 'BP (mmHG)', 'Weight (Kgs)', 'Any Medication Prescribed', 'Fitness for Sea Service', 'Expiry'], medColWidths);
  if (formData.preJoiningMedicals && formData.preJoiningMedicals.length > 0) {
    for (const med of formData.preJoiningMedicals) {
      builder.drawTableRow([
        med.vessel || '',
        formatDate(med.dateOfMedical),
        med.bp || '',
        med.weight || '',
        med.anyMedicationPrescribed || '',
        med.fitnessForDuty || '',
        formatDate(med.expiry),
      ], medColWidths);
    }
  } else {
    builder.drawTableRow(['-', '-', '-', '-', '-', '-', '-'], medColWidths);
  }

  builder.drawSubsectionHeader('F2. Doctor Visits');
  const visitColWidths = [CONTENT_WIDTH * 0.18, CONTENT_WIDTH * 0.14, CONTENT_WIDTH * 0.12, CONTENT_WIDTH * 0.28, CONTENT_WIDTH * 0.28];
  builder.drawTableHeader(['Vessel', 'Port', 'Date', 'Complaint / Illness / Injury', 'Doctor Comments'], visitColWidths);
  if (formData.doctorVisits && formData.doctorVisits.length > 0) {
    for (const visit of formData.doctorVisits) {
      builder.drawTableRow([
        visit.vessel || '',
        visit.port || '',
        formatDate(visit.date),
        visit.complaint || '',
        visit.doctorComments || '',
      ], visitColWidths);
    }
  } else {
    builder.drawTableRow(['-', '-', '-', '-', '-'], visitColWidths);
  }
}
