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
  builder.moveDown(LINE_HEIGHT + 6);
  
  builder.drawText(crewName, MARGIN, 11, 'normal');
  builder.moveDown(LINE_HEIGHT);
  
  const rank = formData.presentRank || '-';
  builder.drawText(rank, MARGIN, 10, 'normal', LABEL_COLOR);
  
  if (uploadedPhoto) {
    const photoX = A4_WIDTH - MARGIN - PHOTO_WIDTH;
    const photoY = A4_HEIGHT - MARGIN;
    await builder.drawImage(uploadedPhoto, photoX, photoY, PHOTO_WIDTH, PHOTO_HEIGHT);
    
    const headerContentHeight = LINE_HEIGHT * 3 + 6;
    const photoBottomClearance = PHOTO_HEIGHT - headerContentHeight;
    if (photoBottomClearance > 0) {
      builder.moveDown(photoBottomClearance + LINE_HEIGHT);
    } else {
      builder.moveDown(LINE_HEIGHT * 2);
    }
  } else {
    builder.moveDown(LINE_HEIGHT * 2);
  }

  await drawPartA(builder, formData, dashboardData);
  drawPartB(builder, formData);
  drawPartC(builder, formData);
  drawPartD(builder, formData);
  drawPartE(builder, formData);
  drawPartF(builder, formData);

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

  builder.drawSubsectionHeader('B1.1 General Particulars');
  builder.drawFieldRow([
    { label: 'First Name', value: formData.firstName },
    { label: 'Middle Name', value: formData.middleName },
    { label: 'Family Name', value: formData.familyName },
  ]);
  builder.drawFieldRow([
    { label: 'Gender', value: formData.gender },
    { label: 'Present Rank', value: formData.presentRank },
    { label: 'Nationality', value: formData.nationality },
  ]);
  builder.drawFieldRow([
    { label: 'Vessel Type(s)', value: formData.vesselType?.join(', ') || '' },
    { label: '', value: '' },
    { label: '', value: '' },
  ]);
  builder.drawFieldRow([
    { label: 'Date of Birth', value: formatDate(formData.dateOfBirth) },
    { label: 'Age (Years)', value: formData.ageInYears },
    { label: 'Place of Birth (City)', value: formData.placeOfBirthCity },
  ]);
  builder.drawFieldRow([
    { label: 'Place of Birth (Country)', value: formData.placeOfBirthCountry },
    { label: 'Height (cm)', value: formData.heightCm },
    { label: 'Weight (kg)', value: formData.weightKg },
  ]);
  builder.drawFieldRow([
    { label: 'BMI', value: formData.bmi },
    { label: 'Native Language', value: formData.nativeLanguage },
    { label: 'Foreign Languages', value: formData.foreignLanguages },
  ]);
  builder.drawFieldRow([
    { label: 'English Proficiency', value: formData.englishProficiency },
    { label: 'Manning Agent', value: formData.manningAgent },
    { label: 'Crew Pool', value: formData.crewPool },
  ]);
  builder.drawFieldRow([
    { label: 'Employee ID', value: formData.employeeId },
    { label: '', value: '' },
    { label: '', value: '' },
  ]);

  builder.drawSubsectionHeader('B1.2 Address & Contact Info');
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

  builder.drawSubsectionHeader('B1.3 Family & Next of Kin');
  builder.drawFieldRow([
    { label: 'Marital Status', value: formData.maritalStatus },
    { label: 'No. of Dependent Children', value: formData.numberOfDependentChildren },
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

  if (formData.children && formData.children.length > 0) {
    builder.checkPageBreak(50);
    builder.drawText('Children:', MARGIN, 9, 'bold');
    builder.moveDown(LINE_HEIGHT);
    const childColWidths = [CONTENT_WIDTH * 0.25, CONTENT_WIDTH * 0.20, CONTENT_WIDTH * 0.25, CONTENT_WIDTH * 0.15, CONTENT_WIDTH * 0.15];
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
  }

  builder.moveDown(LINE_HEIGHT);
  builder.drawText('Next of Kin:', MARGIN, 9, 'bold');
  builder.moveDown(LINE_HEIGHT);
  builder.drawFieldRow([
    { label: 'First Name', value: formData.nokFirstName },
    { label: 'Middle Name', value: formData.nokMiddleName },
    { label: 'Family Name', value: formData.nokFamilyName },
  ]);
  builder.drawFieldRow([
    { label: 'Telephone', value: formData.nokTelephone },
    { label: 'Email', value: formData.nokEmail },
    { label: 'Relationship', value: formData.nokRelationship },
  ]);
  builder.drawFieldRow([
    { label: 'Address', value: formData.nokAddress },
    { label: '', value: '' },
    { label: '', value: '' },
  ]);
}

function drawPartC(builder: PDFBuilder, formData: CrewInfoFormData): void {
  builder.drawSectionHeader('PART C - TRAVEL & ID DOCUMENTS');

  builder.drawSubsectionHeader('C1. Travel & Identification Documents');
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

  builder.drawSubsectionHeader('C2. Visas');
  const visaColWidths = [CONTENT_WIDTH * 0.25, CONTENT_WIDTH * 0.20, CONTENT_WIDTH * 0.20, CONTENT_WIDTH * 0.17, CONTENT_WIDTH * 0.18];
  builder.drawTableHeader(['Country', 'Serial No', 'Type', 'Issued', 'Expiry'], visaColWidths);
  if (formData.visas && formData.visas.length > 0) {
    for (const visa of formData.visas) {
      builder.drawTableRow([
        visa.issuingCountry || '',
        visa.serialNo || '',
        visa.visaType || '',
        formatDate(visa.issued),
        formatDate(visa.expiry),
      ], visaColWidths);
    }
  } else {
    builder.drawTableRow(['-', '-', '-', '-', '-'], visaColWidths);
  }
}

function drawPartD(builder: PDFBuilder, formData: CrewInfoFormData): void {
  builder.drawSectionHeader('PART D - TRAINING & CERTIFICATES');

  builder.drawSubsectionHeader('D1. Education');
  const eduColWidths = [CONTENT_WIDTH * 0.18, CONTENT_WIDTH * 0.30, CONTENT_WIDTH * 0.27, CONTENT_WIDTH * 0.25];
  builder.drawTableHeader(['Completion Date', 'School/College/University', 'Subjects/Field', 'Qualifications'], eduColWidths);
  if (formData.education && formData.education.length > 0) {
    for (const edu of formData.education) {
      builder.drawTableRow([
        formatDate(edu.dateOfCompletion),
        edu.schoolCollegeUniversity || '',
        edu.subjectsField || '',
        edu.qualifications || '',
      ], eduColWidths);
    }
  } else {
    builder.drawTableRow(['-', '-', '-', '-'], eduColWidths);
  }

  builder.drawSubsectionHeader('D2. Licenses & DCE');
  const licColWidths = [CONTENT_WIDTH * 0.28, CONTENT_WIDTH * 0.10, CONTENT_WIDTH * 0.15, CONTENT_WIDTH * 0.12, CONTENT_WIDTH * 0.12, CONTENT_WIDTH * 0.23];
  builder.drawTableHeader(['Certificate/Document', 'Abbr', 'Certificate No', 'Issued', 'Expiry', 'Issuing Authority'], licColWidths);
  const activeLicenses = (formData.licenses || []).filter(l => !l.archivedAt);
  if (activeLicenses.length > 0) {
    for (const lic of activeLicenses) {
      builder.drawTableRow([
        lic.certificateDocument || '',
        lic.abbr || '',
        lic.certificateNo || '',
        formatDate(lic.issued),
        formatDate(lic.expiry),
        lic.issuingAuthority || '',
      ], licColWidths);
    }
  } else {
    builder.drawTableRow(['-', '-', '-', '-', '-', '-'], licColWidths);
  }

  builder.drawSubsectionHeader('D3. Training Courses');
  const trainColWidths = [CONTENT_WIDTH * 0.28, CONTENT_WIDTH * 0.10, CONTENT_WIDTH * 0.15, CONTENT_WIDTH * 0.12, CONTENT_WIDTH * 0.12, CONTENT_WIDTH * 0.23];
  builder.drawTableHeader(['Training Course', 'Abbr', 'Certificate No', 'Issued', 'Expiry', 'Issuing Authority'], trainColWidths);
  if (formData.trainingCourses && formData.trainingCourses.length > 0) {
    for (const course of formData.trainingCourses) {
      builder.drawTableRow([
        course.trainingCourse || '',
        course.abbr || '',
        course.certificateNo || '',
        formatDate(course.issued),
        formatDate(course.expiry),
        course.issuingAuthority || '',
      ], trainColWidths);
    }
  } else {
    builder.drawTableRow(['-', '-', '-', '-', '-', '-'], trainColWidths);
  }
}

function drawPartE(builder: PDFBuilder, formData: CrewInfoFormData): void {
  builder.drawSectionHeader('PART E - SEA SERVICE');

  builder.drawSubsectionHeader('E1. Current Company Sea Service');
  const seaColWidths = [CONTENT_WIDTH * 0.18, CONTENT_WIDTH * 0.14, CONTENT_WIDTH * 0.14, CONTENT_WIDTH * 0.12, CONTENT_WIDTH * 0.12, CONTENT_WIDTH * 0.12, CONTENT_WIDTH * 0.10, CONTENT_WIDTH * 0.08];
  builder.drawTableHeader(['Vessel', 'Type', 'Owner/Operator', 'Rank', 'From', 'To', 'Months', 'DWT'], seaColWidths);
  if (formData.currentCompanySeaService && formData.currentCompanySeaService.length > 0) {
    for (const service of formData.currentCompanySeaService) {
      builder.drawTableRow([
        service.vesselName || '',
        service.vesselType || '',
        service.ownerOperator || '',
        service.rank || '',
        formatDate(service.from),
        formatDate(service.to),
        service.periodMonths || '',
        service.deadweight || '',
      ], seaColWidths);
    }
  } else {
    builder.drawTableRow(['-', '-', '-', '-', '-', '-', '-', '-'], seaColWidths);
  }

  builder.drawSubsectionHeader('E2. External Sea Service');
  builder.drawTableHeader(['Vessel', 'Type', 'Owner/Operator', 'Rank', 'From', 'To', 'Months', 'DWT'], seaColWidths);
  if (formData.externalSeaService && formData.externalSeaService.length > 0) {
    for (const service of formData.externalSeaService) {
      builder.drawTableRow([
        service.vesselName || '',
        service.vesselType || '',
        service.ownerOperator || '',
        service.rank || '',
        formatDate(service.from),
        formatDate(service.to),
        service.periodMonths || '',
        service.deadweight || '',
      ], seaColWidths);
    }
  } else {
    builder.drawTableRow(['-', '-', '-', '-', '-', '-', '-', '-'], seaColWidths);
  }
}

function drawPartF(builder: PDFBuilder, formData: CrewInfoFormData): void {
  builder.drawSectionHeader('PART F - MEDICAL RECORDS');

  builder.drawSubsectionHeader('F1. Pre-Joining Medicals');
  const medColWidths = [CONTENT_WIDTH * 0.18, CONTENT_WIDTH * 0.14, CONTENT_WIDTH * 0.10, CONTENT_WIDTH * 0.10, CONTENT_WIDTH * 0.16, CONTENT_WIDTH * 0.16, CONTENT_WIDTH * 0.16];
  builder.drawTableHeader(['Vessel', 'Date', 'BP (mmHg)', 'Weight', 'Medication', 'Fitness', 'Expiry'], medColWidths);
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
  builder.drawTableHeader(['Vessel', 'Port', 'Date', 'Complaint/Illness/Injury', 'Doctor Comments'], visitColWidths);
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
