import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';

interface FormData {
  uploadedPhoto: string;
  firstName: string;
  middleName: string;
  familyName: string;
  gender: string;
  nationality: string;
  presentRank: string;
  vesselType: string[];
  dateOfBirth: string;
  placeOfBirthCity: string;
  placeOfBirthCountry: string;
  ageInYears: string;
  heightCm: string;
  weightKg: string;
  nativeLanguage: string;
  foreignLanguages: string;
  englishProficiency: string;
  rankAppliedFor: string;
  manningAgent: string;
  fileNo: string;
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
  children: Array<{
    firstName: string;
    middleName: string;
    familyName: string;
    dateOfBirth: string;
    gender: string;
  }>;
  nokFirstName: string;
  nokMiddleName: string;
  nokFamilyName: string;
  nokTelephone: string;
  nokEmail: string;
  nokAddress: string;
  nokRelationship: string;
  documents: Array<{
    id: string;
    documentId?: string;
    document: string;
    number: string;
    issued: string;
    expiry: string;
    issuingAuthority: string;
  }>;
  visas: Array<{
    id: string;
    countryId?: string;
    issuingCountry: string;
    serialNo: string;
    issued: string;
    expiry: string;
    visaType: string;
  }>;
  education: Array<{
    id: string;
    dateOfCompletion: string;
    schoolCollegeUniversity: string;
    subjectsField: string;
    qualifications: string;
  }>;
  licenses: Array<{
    id: string;
    licenseId?: string;
    certificateDocument: string;
    abbr: string;
    requirement: string;
    certificateNo: string;
    issuingAuthority: string;
    issued: string;
    expiry: string;
  }>;
  trainingCourses: Array<{
    id: string;
    courseId?: string;
    trainingCourse: string;
    abbr: string;
    requirement: string;
    certificateNo: string;
    issuingAuthority: string;
    issued: string;
    expiry: string;
  }>;
  seaService: Array<{
    id: string;
    vesselName: string;
    vesselType: string;
    deadweight: string;
    engineTypePower: string;
    ownerOperator: string;
    rank: string;
    from: string;
    to: string;
    periodMonths: string;
  }>;
  additionalInfo: Array<{
    id: string;
    information: string;
    response: string;
  }>;
  b1AgeMeetsCriteria: string;
  b1RankMeetsCriteria: string;
  b1CertificatesValid: string;
  b1Shortlisted: string;
  b1Comments: {[key: string]: Array<{user: string, text: string, id: string}>};
  b1SubmittedBy: string;
  b1SubmittedDate: string;
  b2ReferenceChecksCompleted: string;
  b2CurrentEmployerFeedback: string;
  b2Comments: {[key: string]: Array<{user: string, text: string, id: string}>};
  b2References: Array<{id: string, date: string, nameDesignation: string, contactInfo: string}>;
  b2SubmittedBy: string;
  b2SubmittedDate: string;
  b3SecurityChecksCompleted: string;
  b3SecurityChecksResults: string;
  b3Comments: {[key: string]: Array<{user: string, text: string, id: string}>};
  b3Authorities: Array<{id: string, date: string, authority: string}>;
  b3SubmittedBy: string;
  b3SubmittedDate: string;
  b4CertificatesAuthenticated: string;
  b4AuthenticationResults: string;
  b4Comments: {[key: string]: Array<{user: string, text: string, id: string}>};
  b4Certificates: Array<{id: string, date: string, certificate: string, authority: string}>;
  b4SubmittedBy: string;
  b4SubmittedDate: string;
  b5CesTestsCompleted: string;
  b5Comments: {[key: string]: Array<{user: string, text: string, id: string}>};
  b5Tests: Array<{id: string, date: string, subject: string, score: string, result: string}>;
  b5SubmittedBy: string;
  b5SubmittedDate: string;
  b6InterviewCompleted: string;
  b6Comments: {[key: string]: Array<{user: string, text: string, id: string}>};
  b6Interviews: Array<{id: string, date: string, interviewer: string, status: string, result: string, comments: string}>;
  b6InterviewComments: {[key: string]: string};
  b6SubmittedBy: string;
  b6SubmittedDate: string;
  b7TrainingNeeds: Array<{id: string, training: string, identifiedBy: string, category: string, dueDate: string, comments: string}>;
  b7SubmittedBy: string;
  b7SubmittedDate: string;
  b8Shortlisted: string;
  b8Comments: {[key: string]: Array<{user: string, text: string, id: string}>};
  b8SubmittedBy: string;
  b8SubmittedDate: string;
  selectedApproversForSubmission: string[];
  approvalSubmittedBy: string;
  approvalSubmittedDate: string;
  c1Approvers: Array<{id: string, date: string, approver: string, status: string, approval: string, comments?: string}>;
  c2VesselTypes: string[];
  c2FleetGroups: string[];
  c3RecruitmentStatus: string;
  c3AssignedGroups: string[];
  c3SubmittedBy: string;
  c3SubmittedDate: string;
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
const PLACEHOLDER_COLOR = rgb(0.6, 0.6, 0.6);

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

function displayValue(value: string | undefined | null): string {
  return value && value.trim() ? value : '-';
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

  async drawImage(base64Data: string, x: number, y: number, maxWidth: number, maxHeight: number): Promise<boolean> {
    try {
      if (!base64Data) return false;
      
      const base64Clean = base64Data.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
      const imageBytes = Uint8Array.from(atob(base64Clean), c => c.charCodeAt(0));
      
      let image;
      if (base64Data.includes('data:image/png')) {
        image = await this.pdfDoc.embedPng(imageBytes);
      } else {
        image = await this.pdfDoc.embedJpg(imageBytes);
      }
      
      const aspectRatio = image.width / image.height;
      let drawWidth = maxWidth;
      let drawHeight = maxWidth / aspectRatio;
      
      if (drawHeight > maxHeight) {
        drawHeight = maxHeight;
        drawWidth = maxHeight * aspectRatio;
      }
      
      this.currentPage.drawImage(image, {
        x,
        y: y - drawHeight,
        width: drawWidth,
        height: drawHeight,
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

  drawLabelValue(label: string, value: string, x: number, width: number): void {
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
    this.checkPageBreak(30);
    let x = MARGIN;
    const headerHeight = 18;
    
    this.drawRect(MARGIN, this.yPosition - headerHeight, CONTENT_WIDTH, headerHeight, true);
    
    for (let i = 0; i < headers.length; i++) {
      this.drawTextAt(headers[i], x + 3, this.yPosition - 12, 7, 'bold', rgb(0.3, 0.3, 0.3));
      x += colWidths[i];
    }
    this.moveDown(headerHeight);
  }

  drawTableRow(values: string[], colWidths: number[], rowHeight: number = 16): void {
    this.checkPageBreak(rowHeight + 5);
    let x = MARGIN;
    
    this.drawRect(MARGIN, this.yPosition - rowHeight, CONTENT_WIDTH, rowHeight);
    
    for (let i = 0; i < values.length; i++) {
      const maxWidth = colWidths[i] - 6;
      let displayVal = displayValue(values[i]);
      const textWidth = this.font.widthOfTextAtSize(displayVal, 7);
      if (textWidth > maxWidth && displayVal.length > 3) {
        while (displayVal.length > 3 && this.font.widthOfTextAtSize(displayVal + '...', 7) > maxWidth) {
          displayVal = displayVal.slice(0, -1);
        }
        displayVal += '...';
      }
      this.drawTextAt(displayVal, x + 3, this.yPosition - 11, 7, 'normal');
      x += colWidths[i];
    }
    this.moveDown(rowHeight);
  }

  drawRadioQuestion(label: string, options: Array<{label: string, value: string}>, selectedValue: string, hasNA: boolean = false): void {
    this.checkPageBreak(20);
    this.drawText(label, MARGIN, 9, 'normal');
    
    let x = MARGIN + CONTENT_WIDTH - (hasNA ? 180 : 120);
    for (const option of options) {
      const isSelected = selectedValue?.toLowerCase() === option.value.toLowerCase();
      const nextX = this.drawRadioButton(x, this.yPosition + 3, isSelected);
      this.drawTextAt(option.label, nextX, this.yPosition, 8, 'normal');
      x += hasNA ? 55 : 50;
    }
    this.moveDown(LINE_HEIGHT + 4);
  }

  drawComment(user: string, text: string): void {
    if (!text || !text.trim()) return;
    this.checkPageBreak(30);
    this.drawText(`${user}:`, MARGIN + 20, 8, 'italic', rgb(0.2, 0.4, 0.8));
    this.moveDown(12);
    
    const maxWidth = CONTENT_WIDTH - 40;
    const words = text.split(' ');
    let line = '';
    
    for (const word of words) {
      const testLine = line + (line ? ' ' : '') + word;
      const width = this.fontItalic.widthOfTextAtSize(testLine, 8);
      if (width > maxWidth && line) {
        this.drawText(line, MARGIN + 20, 8, 'italic', rgb(0.2, 0.4, 0.8));
        this.moveDown(12);
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) {
      this.drawText(line, MARGIN + 20, 8, 'italic', rgb(0.2, 0.4, 0.8));
      this.moveDown(12);
    }
  }

  drawSubmissionInfo(submittedBy: string, submittedDate: string): void {
    if (submittedBy || submittedDate) {
      this.checkPageBreak();
      const text = `Submitted by: ${displayValue(submittedBy)}${submittedDate ? ` on ${formatDate(submittedDate)}` : ''}`;
      this.drawText(text, MARGIN, 8, 'normal', rgb(0.5, 0.5, 0.5));
      this.moveDown(LINE_HEIGHT);
    }
  }

  drawCommentsForQuestion(comments: {[key: string]: Array<{user: string, text: string, id: string}>}, questionId: string): void {
    const questionComments = comments?.[questionId];
    if (questionComments && questionComments.length > 0) {
      for (const comment of questionComments) {
        this.drawComment(comment.user, comment.text);
      }
    }
  }
}

export async function generateRecruitmentPDF(formData: FormData, candidateName: string): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const builder = new PDFBuilder(pdfDoc, font, fontBold, fontItalic);

  builder.drawText('RECRUITMENT APPLICATION FORM', MARGIN, 14, 'bold', PRIMARY_COLOR);
  builder.moveDown(LINE_HEIGHT * 2);

  await drawPartA(builder, formData);
  drawPartB(builder, formData);
  drawPartC(builder, formData);

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Recruitment_Form_${candidateName.replace(/\s+/g, '_')}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function drawPartA(builder: PDFBuilder, formData: FormData): Promise<void> {
  builder.drawSectionHeader('PART A - SEAFARER\'S APPLICATION');

  builder.drawSubsectionHeader('A1.1 General Particulars');
  
  const photoX = MARGIN;
  const photoY = builder.getY();
  const photoWidth = 80;
  const photoHeight = 100;
  
  let photoDrawn = false;
  if (formData.uploadedPhoto) {
    photoDrawn = await builder.drawImage(formData.uploadedPhoto, photoX, photoY, photoWidth, photoHeight);
  }
  
  if (!photoDrawn) {
    builder.drawRect(photoX, photoY - photoHeight, photoWidth, photoHeight);
    builder.drawTextAt('No Photo', photoX + 18, photoY - 55, 8, 'normal', PLACEHOLDER_COLOR);
  }
  
  const fieldStartX = MARGIN + photoWidth + 20;
  const fieldColWidth = (CONTENT_WIDTH - photoWidth - 20) / 3;
  
  let currentY = builder.getY();
  builder.drawTextAt('First Name', fieldStartX, currentY, 8, 'normal', LABEL_COLOR);
  builder.drawTextAt(displayValue(formData.firstName), fieldStartX, currentY - 12, 9, 'normal');
  
  builder.drawTextAt('Middle Name', fieldStartX + fieldColWidth, currentY, 8, 'normal', LABEL_COLOR);
  builder.drawTextAt(displayValue(formData.middleName), fieldStartX + fieldColWidth, currentY - 12, 9, 'normal');
  
  builder.drawTextAt('Family Name', fieldStartX + fieldColWidth * 2, currentY, 8, 'normal', LABEL_COLOR);
  builder.drawTextAt(displayValue(formData.familyName), fieldStartX + fieldColWidth * 2, currentY - 12, 9, 'normal');
  
  currentY -= 30;
  builder.drawTextAt('Gender', fieldStartX, currentY, 8, 'normal', LABEL_COLOR);
  builder.drawTextAt(displayValue(formData.gender), fieldStartX, currentY - 12, 9, 'normal');
  
  builder.drawTextAt('Nationality', fieldStartX + fieldColWidth, currentY, 8, 'normal', LABEL_COLOR);
  builder.drawTextAt(displayValue(formData.nationality), fieldStartX + fieldColWidth, currentY - 12, 9, 'normal');
  
  builder.drawTextAt('Date of Birth', fieldStartX + fieldColWidth * 2, currentY, 8, 'normal', LABEL_COLOR);
  builder.drawTextAt(displayValue(formatDate(formData.dateOfBirth)), fieldStartX + fieldColWidth * 2, currentY - 12, 9, 'normal');
  
  currentY -= 30;
  builder.drawTextAt('Place of Birth (City)', fieldStartX, currentY, 8, 'normal', LABEL_COLOR);
  builder.drawTextAt(displayValue(formData.placeOfBirthCity), fieldStartX, currentY - 12, 9, 'normal');
  
  builder.drawTextAt('Place of Birth (Country)', fieldStartX + fieldColWidth, currentY, 8, 'normal', LABEL_COLOR);
  builder.drawTextAt(displayValue(formData.placeOfBirthCountry), fieldStartX + fieldColWidth, currentY - 12, 9, 'normal');
  
  builder.drawTextAt('Age (Years)', fieldStartX + fieldColWidth * 2, currentY, 8, 'normal', LABEL_COLOR);
  builder.drawTextAt(displayValue(formData.ageInYears), fieldStartX + fieldColWidth * 2, currentY - 12, 9, 'normal');
  
  builder.setY(Math.min(currentY - 25, photoY - photoHeight - 10));
  
  builder.drawFieldRow([
    { label: 'Rank Applied For', value: formData.rankAppliedFor },
    { label: 'Present Rank', value: formData.presentRank },
    { label: 'Vessel Type', value: formData.vesselType?.join(', ') || '' },
  ]);
  
  builder.drawFieldRow([
    { label: 'Height (cm)', value: formData.heightCm },
    { label: 'Weight (kg)', value: formData.weightKg },
    { label: 'File No', value: formData.fileNo },
  ]);
  
  builder.drawFieldRow([
    { label: 'Native Language', value: formData.nativeLanguage },
    { label: 'Foreign Languages', value: formData.foreignLanguages },
    { label: 'English Proficiency', value: formData.englishProficiency },
  ]);
  
  builder.drawFieldRow([
    { label: 'Manning Agent', value: formData.manningAgent },
    { label: '', value: '' },
    { label: '', value: '' },
  ]);

  builder.drawSubsectionHeader('A1.2 Address & Contact Information');
  builder.drawFieldRow([
    { label: 'Country of Residence', value: formData.countryOfResidence },
    { label: 'Nearest Airport', value: formData.nearestAirport },
    { label: '', value: '' },
  ]);
  builder.drawFieldRow([
    { label: 'Address Line 1', value: formData.residentialAddressLine1 },
    { label: 'Address Line 2', value: formData.residentialAddressLine2 },
    { label: '', value: '' },
  ]);
  builder.drawFieldRow([
    { label: 'Landline', value: formData.contactLandline },
    { label: 'Mobile', value: formData.mobile },
    { label: 'Email', value: formData.email },
  ]);

  builder.drawSubsectionHeader('A1.3 Family & Next of Kin');
  builder.drawFieldRow([
    { label: 'Marital Status', value: formData.maritalStatus },
    { label: 'Dependent Children', value: formData.numberOfDependentChildren },
    { label: '', value: '' },
  ]);
  builder.drawFieldRow([
    { label: 'Father\'s Name', value: formData.fatherName },
    { label: 'Mother\'s Name', value: formData.motherName },
    { label: '', value: '' },
  ]);
  
  builder.drawFieldRow([
    { label: 'Spouse First Name', value: formData.spouseFirstName },
    { label: 'Spouse Middle Name', value: formData.spouseMiddleName },
    { label: 'Spouse Family Name', value: formData.spouseFamilyName },
  ]);
  builder.drawFieldRow([
    { label: 'Spouse Date of Birth', value: formatDate(formData.spouseDateOfBirth) },
    { label: '', value: '' },
    { label: '', value: '' },
  ]);
  
  builder.checkPageBreak(50);
  builder.drawText('Children:', MARGIN, 9, 'bold');
  builder.moveDown(LINE_HEIGHT);
  if (formData.children && formData.children.length > 0) {
    const childColWidths = [CONTENT_WIDTH * 0.25, CONTENT_WIDTH * 0.20, CONTENT_WIDTH * 0.25, CONTENT_WIDTH * 0.18, CONTENT_WIDTH * 0.12];
    builder.drawTableHeader(['First Name', 'Middle Name', 'Family Name', 'Date of Birth', 'Gender'], childColWidths);
    for (const child of formData.children) {
      builder.drawTableRow([
        child.firstName || '',
        child.middleName || '',
        child.familyName || '',
        formatDate(child.dateOfBirth),
        child.gender || '',
      ], childColWidths);
    }
  } else {
    builder.drawText('No children recorded', MARGIN + 10, 8, 'italic', PLACEHOLDER_COLOR);
    builder.moveDown(LINE_HEIGHT);
  }
  
  builder.moveDown(10);
  builder.drawText('Next of Kin:', MARGIN, 9, 'bold');
  builder.moveDown(LINE_HEIGHT);
  builder.drawFieldRow([
    { label: 'NOK First Name', value: formData.nokFirstName },
    { label: 'NOK Middle Name', value: formData.nokMiddleName },
    { label: 'NOK Family Name', value: formData.nokFamilyName },
  ]);
  builder.drawFieldRow([
    { label: 'NOK Relationship', value: formData.nokRelationship },
    { label: 'NOK Telephone', value: formData.nokTelephone },
    { label: 'NOK Email', value: formData.nokEmail },
  ]);
  builder.drawFieldRow([
    { label: 'NOK Address', value: formData.nokAddress },
    { label: '', value: '' },
    { label: '', value: '' },
  ]);

  builder.drawSubsectionHeader('A2.1 Travel & Identification Documents');
  if (formData.documents && formData.documents.length > 0) {
    const docColWidths = [CONTENT_WIDTH * 0.25, CONTENT_WIDTH * 0.15, CONTENT_WIDTH * 0.15, CONTENT_WIDTH * 0.15, CONTENT_WIDTH * 0.30];
    builder.drawTableHeader(['Document', 'Number', 'Issued', 'Expiry', 'Issuing Authority'], docColWidths);
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
    builder.drawText('No documents recorded', MARGIN + 10, 8, 'italic', PLACEHOLDER_COLOR);
    builder.moveDown(LINE_HEIGHT);
  }

  builder.drawSubsectionHeader('A2.2 Visas');
  if (formData.visas && formData.visas.length > 0) {
    const visaColWidths = [CONTENT_WIDTH * 0.25, CONTENT_WIDTH * 0.20, CONTENT_WIDTH * 0.15, CONTENT_WIDTH * 0.15, CONTENT_WIDTH * 0.25];
    builder.drawTableHeader(['Issuing Country', 'Serial No', 'Issued', 'Expiry', 'Visa Type'], visaColWidths);
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
    builder.drawText('No visas recorded', MARGIN + 10, 8, 'italic', PLACEHOLDER_COLOR);
    builder.moveDown(LINE_HEIGHT);
  }

  builder.drawSubsectionHeader('A3.1 Education');
  if (formData.education && formData.education.length > 0) {
    const eduColWidths = [CONTENT_WIDTH * 0.18, CONTENT_WIDTH * 0.32, CONTENT_WIDTH * 0.25, CONTENT_WIDTH * 0.25];
    builder.drawTableHeader(['Date of Completion', 'School/College/University', 'Subjects/Field', 'Qualifications'], eduColWidths);
    for (const edu of formData.education) {
      builder.drawTableRow([
        formatDate(edu.dateOfCompletion),
        edu.schoolCollegeUniversity || '',
        edu.subjectsField || '',
        edu.qualifications || '',
      ], eduColWidths);
    }
  } else {
    builder.drawText('No education records', MARGIN + 10, 8, 'italic', PLACEHOLDER_COLOR);
    builder.moveDown(LINE_HEIGHT);
  }

  builder.drawSubsectionHeader('A3.2 License & DCE');
  if (formData.licenses && formData.licenses.length > 0) {
    const licColWidths = [CONTENT_WIDTH * 0.22, CONTENT_WIDTH * 0.08, CONTENT_WIDTH * 0.08, CONTENT_WIDTH * 0.14, CONTENT_WIDTH * 0.20, CONTENT_WIDTH * 0.14, CONTENT_WIDTH * 0.14];
    builder.drawTableHeader(['Certificate/Document', 'Abbr', 'Req', 'Cert No', 'Issuing Auth', 'Issued', 'Expiry'], licColWidths);
    for (const lic of formData.licenses) {
      builder.drawTableRow([
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
    builder.drawText('No licenses recorded', MARGIN + 10, 8, 'italic', PLACEHOLDER_COLOR);
    builder.moveDown(LINE_HEIGHT);
  }

  builder.drawSubsectionHeader('A3.3 Training Courses');
  if (formData.trainingCourses && formData.trainingCourses.length > 0) {
    const trainColWidths = [CONTENT_WIDTH * 0.22, CONTENT_WIDTH * 0.08, CONTENT_WIDTH * 0.08, CONTENT_WIDTH * 0.14, CONTENT_WIDTH * 0.20, CONTENT_WIDTH * 0.14, CONTENT_WIDTH * 0.14];
    builder.drawTableHeader(['Training Course', 'Abbr', 'Req', 'Cert No', 'Issuing Auth', 'Issued', 'Expiry'], trainColWidths);
    for (const course of formData.trainingCourses) {
      builder.drawTableRow([
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
    builder.drawText('No training courses recorded', MARGIN + 10, 8, 'italic', PLACEHOLDER_COLOR);
    builder.moveDown(LINE_HEIGHT);
  }

  builder.drawSubsectionHeader('A4.1 Sea Service');
  if (formData.seaService && formData.seaService.length > 0) {
    const seaColWidths = [CONTENT_WIDTH * 0.14, CONTENT_WIDTH * 0.10, CONTENT_WIDTH * 0.08, CONTENT_WIDTH * 0.10, CONTENT_WIDTH * 0.14, CONTENT_WIDTH * 0.10, CONTENT_WIDTH * 0.10, CONTENT_WIDTH * 0.10, CONTENT_WIDTH * 0.07, CONTENT_WIDTH * 0.07];
    builder.drawTableHeader(['Vessel Name', 'Vessel Type', 'DWT', 'Engine/Power', 'Owner/Operator', 'Rank', 'From', 'To', 'Months', ''], seaColWidths);
    for (const service of formData.seaService) {
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
        '',
      ], seaColWidths);
    }
  } else {
    builder.drawText('No sea service records', MARGIN + 10, 8, 'italic', PLACEHOLDER_COLOR);
    builder.moveDown(LINE_HEIGHT);
  }

  builder.drawSubsectionHeader('A5 Additional Information');
  if (formData.additionalInfo && formData.additionalInfo.length > 0) {
    for (const info of formData.additionalInfo) {
      builder.checkPageBreak(40);
      builder.drawText(displayValue(info.information), MARGIN, 9, 'bold');
      builder.moveDown(LINE_HEIGHT);
      builder.drawText(displayValue(info.response), MARGIN + 10, 9, 'normal');
      builder.moveDown(LINE_HEIGHT);
    }
  } else {
    builder.drawText('No additional information', MARGIN + 10, 8, 'italic', PLACEHOLDER_COLOR);
    builder.moveDown(LINE_HEIGHT);
  }
}

function drawPartB(builder: PDFBuilder, formData: FormData): void {
  builder.drawSectionHeader('PART B - OFFICE SCREENING');

  builder.drawSubsectionHeader('B1. Initial Screening');
  builder.drawRadioQuestion('B1.1 Age meets Company Criteria for the Rank applied for?',
    [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }, { label: 'NA', value: 'na' }],
    formData.b1AgeMeetsCriteria, true);
  builder.drawCommentsForQuestion(formData.b1Comments, 'b1-age');

  builder.drawRadioQuestion('B1.2 Experience meets Company Criteria for the Rank applied for?',
    [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }, { label: 'NA', value: 'na' }],
    formData.b1RankMeetsCriteria, true);
  builder.drawCommentsForQuestion(formData.b1Comments, 'b1-rank');

  builder.drawRadioQuestion('B1.3 Certificates & Documents in order & valid as per Company Criteria?',
    [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }, { label: 'NA', value: 'na' }],
    formData.b1CertificatesValid, true);
  builder.drawCommentsForQuestion(formData.b1Comments, 'b1-cert');

  builder.drawRadioQuestion('B1.4 Shortlisted (Initial Screening)?',
    [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }],
    formData.b1Shortlisted, false);
  builder.drawCommentsForQuestion(formData.b1Comments, 'b1-shortlist');

  builder.drawSubmissionInfo(formData.b1SubmittedBy, formData.b1SubmittedDate);

  builder.drawSubsectionHeader('B2. Reference Checks');
  builder.drawRadioQuestion('B2.1 Reference checks completed?',
    [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }],
    formData.b2ReferenceChecksCompleted, false);
  builder.drawCommentsForQuestion(formData.b2Comments, 'b2-ref');

  builder.drawRadioQuestion('B2.2 Current employer feedback positive?',
    [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }, { label: 'NA', value: 'na' }],
    formData.b2CurrentEmployerFeedback, true);
  builder.drawCommentsForQuestion(formData.b2Comments, 'b2-feedback');

  builder.checkPageBreak(50);
  builder.drawText('References:', MARGIN, 9, 'bold');
  builder.moveDown(LINE_HEIGHT);
  if (formData.b2References && formData.b2References.length > 0) {
    const refColWidths = [CONTENT_WIDTH * 0.20, CONTENT_WIDTH * 0.40, CONTENT_WIDTH * 0.40];
    builder.drawTableHeader(['Date', 'Name/Designation', 'Contact Info'], refColWidths);
    for (const ref of formData.b2References) {
      builder.drawTableRow([formatDate(ref.date), ref.nameDesignation || '', ref.contactInfo || ''], refColWidths);
    }
  } else {
    builder.drawText('No references recorded', MARGIN + 10, 8, 'italic', PLACEHOLDER_COLOR);
    builder.moveDown(LINE_HEIGHT);
  }
  builder.drawSubmissionInfo(formData.b2SubmittedBy, formData.b2SubmittedDate);

  builder.drawSubsectionHeader('B3. Background Security Checks');
  builder.drawRadioQuestion('B3.1 Security checks completed?',
    [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }],
    formData.b3SecurityChecksCompleted, false);
  builder.drawCommentsForQuestion(formData.b3Comments, 'b3-sec');

  builder.drawRadioQuestion('B3.2 Security checks results positive?',
    [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }, { label: 'NA', value: 'na' }],
    formData.b3SecurityChecksResults, true);
  builder.drawCommentsForQuestion(formData.b3Comments, 'b3-results');

  builder.checkPageBreak(50);
  builder.drawText('Authorities Consulted:', MARGIN, 9, 'bold');
  builder.moveDown(LINE_HEIGHT);
  if (formData.b3Authorities && formData.b3Authorities.length > 0) {
    const authColWidths = [CONTENT_WIDTH * 0.30, CONTENT_WIDTH * 0.70];
    builder.drawTableHeader(['Date', 'Authority'], authColWidths);
    for (const auth of formData.b3Authorities) {
      builder.drawTableRow([formatDate(auth.date), auth.authority || ''], authColWidths);
    }
  } else {
    builder.drawText('No authorities recorded', MARGIN + 10, 8, 'italic', PLACEHOLDER_COLOR);
    builder.moveDown(LINE_HEIGHT);
  }
  builder.drawSubmissionInfo(formData.b3SubmittedBy, formData.b3SubmittedDate);

  builder.drawSubsectionHeader('B4. Authentication of Certificates & Documents');
  builder.drawRadioQuestion('B4.1 Certificates authenticated?',
    [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }],
    formData.b4CertificatesAuthenticated, false);
  builder.drawCommentsForQuestion(formData.b4Comments, 'b4-auth');

  builder.drawRadioQuestion('B4.2 Authentication results positive?',
    [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }, { label: 'NA', value: 'na' }],
    formData.b4AuthenticationResults, true);
  builder.drawCommentsForQuestion(formData.b4Comments, 'b4-results');

  builder.checkPageBreak(50);
  builder.drawText('Certificates Authenticated:', MARGIN, 9, 'bold');
  builder.moveDown(LINE_HEIGHT);
  if (formData.b4Certificates && formData.b4Certificates.length > 0) {
    const certColWidths = [CONTENT_WIDTH * 0.20, CONTENT_WIDTH * 0.40, CONTENT_WIDTH * 0.40];
    builder.drawTableHeader(['Date', 'Certificate', 'Authority'], certColWidths);
    for (const cert of formData.b4Certificates) {
      builder.drawTableRow([formatDate(cert.date), cert.certificate || '', cert.authority || ''], certColWidths);
    }
  } else {
    builder.drawText('No certificates recorded', MARGIN + 10, 8, 'italic', PLACEHOLDER_COLOR);
    builder.moveDown(LINE_HEIGHT);
  }
  builder.drawSubmissionInfo(formData.b4SubmittedBy, formData.b4SubmittedDate);

  builder.drawSubsectionHeader('B5. CES/Language Test Results');
  builder.drawRadioQuestion('B5.1 CES tests completed?',
    [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }],
    formData.b5CesTestsCompleted, false);
  builder.drawCommentsForQuestion(formData.b5Comments, 'b5-ces');

  builder.checkPageBreak(50);
  builder.drawText('Test Results:', MARGIN, 9, 'bold');
  builder.moveDown(LINE_HEIGHT);
  if (formData.b5Tests && formData.b5Tests.length > 0) {
    const testColWidths = [CONTENT_WIDTH * 0.20, CONTENT_WIDTH * 0.35, CONTENT_WIDTH * 0.15, CONTENT_WIDTH * 0.30];
    builder.drawTableHeader(['Date', 'Subject', 'Score', 'Result'], testColWidths);
    for (const test of formData.b5Tests) {
      builder.drawTableRow([formatDate(test.date), test.subject || '', test.score || '', test.result || ''], testColWidths);
    }
  } else {
    builder.drawText('No test results recorded', MARGIN + 10, 8, 'italic', PLACEHOLDER_COLOR);
    builder.moveDown(LINE_HEIGHT);
  }
  builder.drawSubmissionInfo(formData.b5SubmittedBy, formData.b5SubmittedDate);

  builder.drawSubsectionHeader('B6. Interviews');
  builder.drawRadioQuestion('B6.1 Interview completed?',
    [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }],
    formData.b6InterviewCompleted, false);
  builder.drawCommentsForQuestion(formData.b6Comments, 'b6-int');

  builder.checkPageBreak(50);
  builder.drawText('Interview Records:', MARGIN, 9, 'bold');
  builder.moveDown(LINE_HEIGHT);
  if (formData.b6Interviews && formData.b6Interviews.length > 0) {
    const intColWidths = [CONTENT_WIDTH * 0.12, CONTENT_WIDTH * 0.22, CONTENT_WIDTH * 0.18, CONTENT_WIDTH * 0.15, CONTENT_WIDTH * 0.33];
    builder.drawTableHeader(['Date', 'Interviewer', 'Status', 'Result', 'Comments'], intColWidths);
    for (const interview of formData.b6Interviews) {
      builder.drawTableRow([
        formatDate(interview.date),
        interview.interviewer || '',
        interview.status || '',
        interview.result || '',
        interview.comments || '',
      ], intColWidths);
    }
  } else {
    builder.drawText('No interview records', MARGIN + 10, 8, 'italic', PLACEHOLDER_COLOR);
    builder.moveDown(LINE_HEIGHT);
  }
  builder.drawSubmissionInfo(formData.b6SubmittedBy, formData.b6SubmittedDate);

  builder.drawSubsectionHeader('B7. Training Needs Identified');
  if (formData.b7TrainingNeeds && formData.b7TrainingNeeds.length > 0) {
    const trainColWidths = [CONTENT_WIDTH * 0.25, CONTENT_WIDTH * 0.18, CONTENT_WIDTH * 0.15, CONTENT_WIDTH * 0.15, CONTENT_WIDTH * 0.27];
    builder.drawTableHeader(['Training', 'Identified By', 'Category', 'Due Date', 'Comments'], trainColWidths);
    for (const need of formData.b7TrainingNeeds) {
      builder.drawTableRow([
        need.training || '',
        need.identifiedBy || '',
        need.category || '',
        formatDate(need.dueDate),
        need.comments || '',
      ], trainColWidths);
    }
  } else {
    builder.drawText('No training needs identified', MARGIN + 10, 8, 'italic', PLACEHOLDER_COLOR);
    builder.moveDown(LINE_HEIGHT);
  }
  builder.drawSubmissionInfo(formData.b7SubmittedBy, formData.b7SubmittedDate);

  builder.drawSubsectionHeader('B8. Short Listing');
  builder.drawRadioQuestion('B8.1 Shortlisted for approval?',
    [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }],
    formData.b8Shortlisted, false);
  builder.drawCommentsForQuestion(formData.b8Comments, 'b8-shortlist');
  builder.drawSubmissionInfo(formData.b8SubmittedBy, formData.b8SubmittedDate);

  if (formData.approvalSubmittedBy) {
    builder.moveDown(10);
    builder.checkPageBreak(40);
    builder.drawText('Submit for Approval', MARGIN, 10, 'bold', PRIMARY_COLOR);
    builder.moveDown(LINE_HEIGHT);
    builder.drawText(`Submitted by: ${displayValue(formData.approvalSubmittedBy)}${formData.approvalSubmittedDate ? ` on ${formatDate(formData.approvalSubmittedDate)}` : ''}`, MARGIN, 9, 'normal');
    builder.moveDown(LINE_HEIGHT);
    if (formData.selectedApproversForSubmission && formData.selectedApproversForSubmission.length > 0) {
      builder.drawText(`Selected Approvers: ${formData.selectedApproversForSubmission.join(', ')}`, MARGIN, 9, 'normal');
      builder.moveDown(LINE_HEIGHT);
    }
  }
}

function drawPartC(builder: PDFBuilder, formData: FormData): void {
  builder.drawSectionHeader('PART C - APPROVAL');

  builder.drawSubsectionHeader('C1. Approval');
  if (formData.c1Approvers && formData.c1Approvers.length > 0) {
    for (const approver of formData.c1Approvers) {
      builder.checkPageBreak(60);
      builder.drawText(`Approver: ${displayValue(approver.approver)}`, MARGIN, 9, 'bold');
      builder.moveDown(LINE_HEIGHT);
      
      builder.drawText(`Date: ${displayValue(formatDate(approver.date))}    Status: ${displayValue(approver.status)}`, MARGIN + 10, 8, 'normal', LABEL_COLOR);
      builder.moveDown(LINE_HEIGHT);
      
      builder.drawText('Approval:', MARGIN + 10, 9, 'normal');
      let x = MARGIN + 70;
      const approvalOptions = ['Yes', 'Yes, Conditional', 'No'];
      for (const opt of approvalOptions) {
        const isSelected = approver.approval === opt;
        x = builder.drawRadioButton(x, builder.getY() + 3, isSelected);
        builder.drawTextAt(opt, x, builder.getY(), 8, 'normal');
        x += opt.length * 5 + 25;
      }
      builder.moveDown(LINE_HEIGHT + 5);
      
      if (approver.comments) {
        builder.drawComment(approver.approver || 'Approver', approver.comments);
      }
      builder.moveDown(8);
    }
  } else {
    builder.drawText('No approvers assigned', MARGIN + 10, 8, 'italic', PLACEHOLDER_COLOR);
    builder.moveDown(LINE_HEIGHT);
  }

  builder.drawSubsectionHeader('C2. Suitable for');
  builder.drawText('C2.1 Vessel type(s):', MARGIN, 9, 'normal');
  builder.moveDown(LINE_HEIGHT);
  builder.drawText(formData.c2VesselTypes && formData.c2VesselTypes.length > 0 ? formData.c2VesselTypes.join(', ') : '-', MARGIN + 10, 9, 'normal');
  builder.moveDown(LINE_HEIGHT);
  
  builder.drawText('C2.2 Fleet group(s):', MARGIN, 9, 'normal');
  builder.moveDown(LINE_HEIGHT);
  builder.drawText(formData.c2FleetGroups && formData.c2FleetGroups.length > 0 ? formData.c2FleetGroups.join(', ') : '-', MARGIN + 10, 9, 'normal');
  builder.moveDown(LINE_HEIGHT);

  builder.drawSubsectionHeader('C3. Recruited');
  builder.checkPageBreak(40);
  builder.drawText('C3.1 Recruitment Decision:', MARGIN, 9, 'normal');
  let x = MARGIN + 150;
  const recruitmentOptions = [{ label: 'Yes', value: 'Yes' }, { label: 'Waitlist', value: 'Waitlist' }, { label: 'Rejected', value: 'Rejected' }];
  for (const opt of recruitmentOptions) {
    const isSelected = formData.c3RecruitmentStatus === opt.value;
    x = builder.drawRadioButton(x, builder.getY() + 3, isSelected);
    builder.drawTextAt(opt.label, x, builder.getY(), 8, 'normal');
    x += 60;
  }
  builder.moveDown(LINE_HEIGHT + 5);
  
  if (formData.c3AssignedGroups && formData.c3AssignedGroups.length > 0) {
    builder.drawText('Assigned Groups:', MARGIN, 9, 'normal');
    builder.moveDown(LINE_HEIGHT);
    builder.drawText(formData.c3AssignedGroups.join(', '), MARGIN + 10, 9, 'normal');
    builder.moveDown(LINE_HEIGHT);
  }
  
  builder.drawSubmissionInfo(formData.c3SubmittedBy, formData.c3SubmittedDate);
}
