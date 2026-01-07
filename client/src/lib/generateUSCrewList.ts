import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';

interface CrewMemberData {
  id: string;
  firstName?: string;
  middleName?: string;
  familyName?: string;
  presentRank?: string;
  nationality?: string;
  dateOfBirth?: string;
  documents?: string;
  signOnDate?: string;
}

interface VesselData {
  id: number;
  name: string;
  vesselType?: string;
  nationality?: string;
  officialNumber?: string;
}

interface USCrewListData {
  vessel: VesselData;
  crewMembers: CrewMemberData[];
  lastForeignPort?: string;
  dateSailedFromForeignPort?: string;
  dateOfArrival?: string;
  arrivalPort?: string;
  agentAtArrival?: string;
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const day = date.getDate().toString().padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return '';
  }
}

function getIdentityDocumentNumber(documentsData: string | object | undefined): string {
  if (!documentsData) return '';
  
  let documents: any[];
  
  try {
    if (typeof documentsData === 'string') {
      if (!documentsData.trim()) return '';
      documents = JSON.parse(documentsData);
    } else if (Array.isArray(documentsData)) {
      documents = documentsData;
    } else {
      return '';
    }
    
    if (!Array.isArray(documents) || documents.length === 0) {
      return '';
    }
    
    // Priority 1: Look for passport
    const passport = documents.find((doc: any) => {
      const docName = (doc.document || '').toLowerCase();
      return docName.includes("passport");
    });
    
    if (passport && passport.number) {
      return passport.number;
    }
    
    // Priority 2: Look for seaman's book or CDC
    const seamansBook = documents.find((doc: any) => {
      const docName = (doc.document || '').toLowerCase();
      return docName.includes("seaman") || docName.includes("cdc") || docName.includes("identity");
    });
    
    if (seamansBook && seamansBook.number) {
      return seamansBook.number;
    }
    
    // Priority 3: Use first document with a number
    const firstWithNumber = documents.find((doc: any) => doc.number);
    if (firstWithNumber) {
      return firstWithNumber.number;
    }
    
    return '';
  } catch {
    return '';
  }
}

async function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number = 8
) {
  page.drawText(text, { x, y, size, font, color: rgb(0, 0, 0) });
}

async function drawLine(
  page: PDFPage,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness: 0.5,
    color: rgb(0, 0, 0),
  });
}

async function drawRect(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number
) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    borderColor: rgb(0, 0, 0),
    borderWidth: 0.5,
  });
}

export async function generateUSCrewListDocument(data: USCrewListData): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const pageWidth = 612; // Letter size
  const pageHeight = 792;
  const margin = 30;
  const contentWidth = pageWidth - (margin * 2);
  
  // Calculate rows per page (first page has header, continuation pages have simpler header)
  const rowHeight = 18;
  const headerHeight = 220; // Space for form header on first page
  const continuationHeaderHeight = 60; // Space for continuation header
  const footerHeight = 100; // Space for footer/certification
  
  const crewMembers = data.crewMembers;
  const totalCrew = crewMembers.length;
  
  // Calculate how many crew fit on first page vs continuation pages
  const firstPageRows = Math.floor((pageHeight - margin - headerHeight - footerHeight) / rowHeight);
  const continuationPageRows = Math.floor((pageHeight - margin - continuationHeaderHeight - 40) / rowHeight);
  
  let crewIndex = 0;
  let pageNum = 1;
  
  while (crewIndex < totalCrew || pageNum === 1) {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    const form = pdfDoc.getForm();
    let y = pageHeight - margin;
    
    if (pageNum === 1) {
      // === PAGE 1 HEADER ===
      
      // Title
      await drawText(page, 'DEPARTMENT OF HOMELAND SECURITY', pageWidth / 2 - 80, y, fontBold, 9);
      y -= 12;
      await drawText(page, 'U.S. Customs and Border Protection', pageWidth / 2 - 70, y, font, 8);
      y -= 12;
      await drawText(page, 'PASSENGER LIST - CREW LIST', pageWidth / 2 - 55, y, fontBold, 9);
      y -= 14;
      
      // Instructions paragraph
      const instructionText = 'Prior to arrival in the United States, complete a separate form for a) working crew; and b) passengers and supernumeraries.';
      await drawText(page, instructionText, margin, y, font, 6);
      y -= 18;
      
      // Vessel Information Row 1
      const vesselInfoY = y;
      await drawRect(page, margin, y - 30, contentWidth / 3 - 5, 30);
      await drawText(page, 'Vessel Name:', margin + 3, y - 10, font, 7);
      const vesselNameField = form.createTextField('vesselName');
      vesselNameField.setText(data.vessel.name || '');
      vesselNameField.addToPage(page, { x: margin + 3, y: y - 28, width: contentWidth / 3 - 15, height: 14 });
      
      await drawRect(page, margin + contentWidth / 3, y - 30, contentWidth / 3 - 5, 30);
      await drawText(page, 'Nationality:', margin + contentWidth / 3 + 3, y - 10, font, 7);
      const nationalityField = form.createTextField('vesselNationality');
      nationalityField.setText(data.vessel.nationality || '');
      nationalityField.addToPage(page, { x: margin + contentWidth / 3 + 3, y: y - 28, width: contentWidth / 3 - 15, height: 14 });
      
      await drawRect(page, margin + (contentWidth / 3) * 2, y - 30, contentWidth / 3, 30);
      await drawText(page, 'Official Number:', margin + (contentWidth / 3) * 2 + 3, y - 10, font, 7);
      const officialNumField = form.createTextField('officialNumber');
      officialNumField.setText(data.vessel.officialNumber || '');
      officialNumField.addToPage(page, { x: margin + (contentWidth / 3) * 2 + 3, y: y - 28, width: contentWidth / 3 - 10, height: 14 });
      
      y -= 35;
      
      // Vessel Information Row 2
      await drawRect(page, margin, y - 30, contentWidth / 2 - 5, 30);
      await drawText(page, 'Last Foreign Port (Place and Country):', margin + 3, y - 10, font, 7);
      const lastPortField = form.createTextField('lastForeignPort');
      lastPortField.setText(data.lastForeignPort || '');
      lastPortField.addToPage(page, { x: margin + 3, y: y - 28, width: contentWidth / 2 - 15, height: 14 });
      
      await drawRect(page, margin + contentWidth / 2, y - 30, contentWidth / 6, 30);
      await drawText(page, 'Date Sailed:', margin + contentWidth / 2 + 3, y - 10, font, 7);
      const dateSailedField = form.createTextField('dateSailed');
      dateSailedField.setText(data.dateSailedFromForeignPort || '');
      dateSailedField.addToPage(page, { x: margin + contentWidth / 2 + 3, y: y - 28, width: contentWidth / 6 - 10, height: 14 });
      
      await drawRect(page, margin + contentWidth / 2 + contentWidth / 6, y - 30, contentWidth / 6, 30);
      await drawText(page, 'Date of Arrival:', margin + contentWidth / 2 + contentWidth / 6 + 3, y - 10, font, 7);
      const dateArrivalField = form.createTextField('dateOfArrival');
      dateArrivalField.setText(data.dateOfArrival || '');
      dateArrivalField.addToPage(page, { x: margin + contentWidth / 2 + contentWidth / 6 + 3, y: y - 28, width: contentWidth / 6 - 10, height: 14 });
      
      await drawRect(page, margin + contentWidth / 2 + (contentWidth / 6) * 2, y - 30, contentWidth / 6, 30);
      await drawText(page, 'Arrival Port:', margin + contentWidth / 2 + (contentWidth / 6) * 2 + 3, y - 10, font, 7);
      const arrivalPortField = form.createTextField('arrivalPort');
      arrivalPortField.setText(data.arrivalPort || '');
      arrivalPortField.addToPage(page, { x: margin + contentWidth / 2 + (contentWidth / 6) * 2 + 3, y: y - 28, width: contentWidth / 6 - 10, height: 14 });
      
      y -= 35;
      
      // Vessel Information Row 3
      await drawRect(page, margin, y - 30, contentWidth / 6, 30);
      await drawText(page, 'No. of Crew (incl. Master):', margin + 3, y - 10, font, 7);
      const crewCountField = form.createTextField('crewCount');
      crewCountField.setText(totalCrew.toString());
      crewCountField.addToPage(page, { x: margin + 3, y: y - 28, width: contentWidth / 6 - 10, height: 14 });
      
      await drawRect(page, margin + contentWidth / 6, y - 30, contentWidth / 6, 30);
      await drawText(page, 'No. of Passengers:', margin + contentWidth / 6 + 3, y - 10, font, 7);
      const passengerCountField = form.createTextField('passengerCount');
      passengerCountField.setText('0');
      passengerCountField.addToPage(page, { x: margin + contentWidth / 6 + 3, y: y - 28, width: contentWidth / 6 - 10, height: 14 });
      
      await drawRect(page, margin + (contentWidth / 6) * 2, y - 30, (contentWidth / 6) * 4, 30);
      await drawText(page, 'Agent at Arrival (Name & Address):', margin + (contentWidth / 6) * 2 + 3, y - 10, font, 7);
      const agentField = form.createTextField('agentAtArrival');
      agentField.setText(data.agentAtArrival || '');
      agentField.addToPage(page, { x: margin + (contentWidth / 6) * 2 + 3, y: y - 28, width: (contentWidth / 6) * 4 - 10, height: 14 });
      
      y -= 40;
      
      // CREW LIST checkbox indicator
      await drawText(page, 'CREW LIST', margin, y, fontBold, 8);
      await drawRect(page, margin + 60, y - 3, 10, 10);
      await drawText(page, 'X', margin + 63, y - 1, fontBold, 8);
      y -= 18;
      
    } else {
      // === CONTINUATION PAGE HEADER ===
      await drawText(page, 'PASSENGER LIST - CREW LIST - Continuation Sheet', pageWidth / 2 - 100, y, fontBold, 10);
      y -= 15;
      
      // Vessel info row for continuation
      await drawRect(page, margin, y - 25, contentWidth / 3, 25);
      await drawText(page, 'Vessel Name:', margin + 3, y - 10, font, 7);
      await drawText(page, data.vessel.name || '', margin + 60, y - 10, font, 8);
      
      await drawRect(page, margin + contentWidth / 3, y - 25, contentWidth / 3, 25);
      await drawText(page, 'Arrival Port in U.S.:', margin + contentWidth / 3 + 3, y - 10, font, 7);
      
      await drawRect(page, margin + (contentWidth / 3) * 2, y - 25, contentWidth / 3, 25);
      await drawText(page, 'Arrival Date:', margin + (contentWidth / 3) * 2 + 3, y - 10, font, 7);
      
      y -= 35;
    }
    
    // === CREW TABLE ===
    const tableStartY = y;
    // Calculate column widths to fit within contentWidth (552px for letter size with 30px margins)
    // Total: 95 + 85 + 55 + 85 + 70 + 55 + 55 + 52 = 552
    const colWidths = [95, 85, 55, 85, 70, 55, 55, 52];
    // Columns: Family Name, First Name & Initial, Date of Birth, Nationality/Document#, Position, Date Joined, Date Separated, DHS Use
    
    // Table Header
    const tableHeaderHeight = 35;
    let xPos = margin;
    
    await drawRect(page, margin, y - tableHeaderHeight, contentWidth, tableHeaderHeight);
    
    // Column headers
    const headers = [
      'Family Name',
      'First Name & Initial',
      'Date of\nBirth',
      'Nationality/\nDocument #',
      'Position or Title\n(Crew Only)',
      'Date\nJoined\n(Crew Only)',
      'Date\nSeparated\n(Crew Only)',
      'Inspection Status\n(DHS Use Only)'
    ];
    
    xPos = margin;
    for (let i = 0; i < headers.length; i++) {
      const colWidth = colWidths[i];
      const lines = headers[i].split('\n');
      let headerY = y - 10;
      for (const line of lines) {
        await drawText(page, line, xPos + 2, headerY, fontBold, 5.5);
        headerY -= 7;
      }
      if (i < headers.length - 1) {
        await drawLine(page, xPos + colWidth, y, xPos + colWidth, y - tableHeaderHeight);
      }
      xPos += colWidth;
    }
    
    y -= tableHeaderHeight;
    
    // Crew rows
    const maxRows = pageNum === 1 ? firstPageRows : continuationPageRows;
    let rowsOnPage = 0;
    
    while (crewIndex < totalCrew && rowsOnPage < maxRows) {
      const crew = crewMembers[crewIndex];
      
      // Draw row border
      await drawRect(page, margin, y - rowHeight, contentWidth, rowHeight);
      
      xPos = margin;
      
      // Family Name
      await drawText(page, crew.familyName || '', xPos + 3, y - 12, font, 7);
      await drawLine(page, xPos + colWidths[0], y, xPos + colWidths[0], y - rowHeight);
      xPos += colWidths[0];
      
      // First Name & Initial (combine firstName, middleName initial)
      const middleInitial = crew.middleName ? ` ${crew.middleName.charAt(0)}.` : '';
      const fullFirstName = `${crew.firstName || ''}${middleInitial}`;
      await drawText(page, fullFirstName, xPos + 3, y - 12, font, 7);
      await drawLine(page, xPos + colWidths[1], y, xPos + colWidths[1], y - rowHeight);
      xPos += colWidths[1];
      
      // Date of Birth
      await drawText(page, formatDate(crew.dateOfBirth), xPos + 3, y - 12, font, 7);
      await drawLine(page, xPos + colWidths[2], y, xPos + colWidths[2], y - rowHeight);
      xPos += colWidths[2];
      
      // Nationality / Document # - format: "Filipino / ABC123456"
      const docNumber = getIdentityDocumentNumber(crew.documents);
      const nationalityDoc = docNumber 
        ? `${crew.nationality || ''} / ${docNumber}`
        : crew.nationality || '';
      await drawText(page, nationalityDoc, xPos + 3, y - 12, font, 6);
      await drawLine(page, xPos + colWidths[3], y, xPos + colWidths[3], y - rowHeight);
      xPos += colWidths[3];
      
      // Position or Title
      await drawText(page, crew.presentRank || '', xPos + 3, y - 12, font, 7);
      await drawLine(page, xPos + colWidths[4], y, xPos + colWidths[4], y - rowHeight);
      xPos += colWidths[4];
      
      // Date Joined - use signOnDate
      await drawText(page, formatDate(crew.signOnDate), xPos + 3, y - 12, font, 7);
      await drawLine(page, xPos + colWidths[5], y, xPos + colWidths[5], y - rowHeight);
      xPos += colWidths[5];
      
      // Date Separated (fillable field)
      const separatedFieldName = `dateSeparated_${crewIndex}`;
      const separatedField = form.createTextField(separatedFieldName);
      separatedField.addToPage(page, { x: xPos + 2, y: y - rowHeight + 2, width: colWidths[6] - 4, height: rowHeight - 4 });
      await drawLine(page, xPos + colWidths[6], y, xPos + colWidths[6], y - rowHeight);
      xPos += colWidths[6];
      
      // DHS Use Only (checkbox area)
      const checkboxSize = 8;
      await drawRect(page, xPos + 10, y - 13, checkboxSize, checkboxSize);
      
      y -= rowHeight;
      crewIndex++;
      rowsOnPage++;
    }
    
    // Draw empty rows to fill the page
    const emptyRowsNeeded = maxRows - rowsOnPage;
    for (let i = 0; i < emptyRowsNeeded && y > margin + footerHeight; i++) {
      await drawRect(page, margin, y - rowHeight, contentWidth, rowHeight);
      
      xPos = margin;
      // Draw all column separators except the last one
      for (let j = 0; j < colWidths.length - 1; j++) {
        xPos += colWidths[j];
        await drawLine(page, xPos, y, xPos, y - rowHeight);
      }
      
      // DHS checkbox in last column
      const lastColStart = margin + colWidths.slice(0, -1).reduce((a, b) => a + b, 0);
      await drawRect(page, lastColStart + 15, y - 13, 8, 8);
      
      y -= rowHeight;
    }
    
    // === PAGE 1 FOOTER ===
    if (pageNum === 1) {
      y = margin + 80;
      
      // Receipt section
      await drawText(page, 'RECEIPT FOR CREW LIST (CBP Use Only)', margin, y, fontBold, 7);
      y -= 12;
      await drawText(page, 'I-418 Receipt Number (POE - YYMMDD - Badge # - Military Time):', margin, y, font, 6);
      const receiptField = form.createTextField('receiptNumber');
      receiptField.addToPage(page, { x: margin + 250, y: y - 3, width: 150, height: 12 });
      
      y -= 20;
      await drawText(page, 'CBP Port of Arrival (address):', margin, y, font, 7);
      const cbpPortField = form.createTextField('cbpPortAddress');
      cbpPortField.addToPage(page, { x: margin + 120, y: y - 3, width: 300, height: 12 });
      
      y -= 20;
      
      // Summary of Departure section
      await drawRect(page, margin, y - 45, contentWidth, 45);
      await drawText(page, 'SUMMARY OF DEPARTURE', margin + 3, y - 10, fontBold, 7);
      
      await drawText(page, 'Date of Departure:', margin + 350, y - 10, font, 7);
      const depDateField = form.createTextField('departureDate');
      depDateField.addToPage(page, { x: margin + 430, y: y - 13, width: 80, height: 12 });
      
      await drawText(page, 'Port of Departure:', margin + 350, y - 25, font, 7);
      const depPortField = form.createTextField('departurePort');
      depPortField.addToPage(page, { x: margin + 430, y: y - 28, width: 80, height: 12 });
      
      await drawText(page, 'Total Added Crew:', margin + 350, y - 40, font, 7);
      const addedCrewField = form.createTextField('totalAddedCrew');
      addedCrewField.addToPage(page, { x: margin + 430, y: y - 43, width: 40, height: 12 });
      
      await drawText(page, 'Total Separated:', margin + 480, y - 40, font, 7);
      const separatedCrewField = form.createTextField('totalSeparatedCrew');
      separatedCrewField.addToPage(page, { x: margin + 540, y: y - 43, width: 30, height: 12 });
      
      y -= 55;
      
      // Form footer
      await drawText(page, `CBP Form I-418 (09/24)`, margin, margin, font, 7);
      await drawText(page, `Page ${pageNum} of ${Math.ceil((totalCrew - firstPageRows) / continuationPageRows) + 1}`, pageWidth - margin - 50, margin, font, 7);
    } else {
      // Continuation page footer
      await drawText(page, `CBP Form I-418 (09/24)`, margin, margin, font, 7);
      await drawText(page, `Page ${pageNum}`, pageWidth - margin - 30, margin, font, 7);
    }
    
    pageNum++;
    
    // Break if we've processed all crew
    if (crewIndex >= totalCrew && pageNum > 1) break;
  }
  
  // Flatten some fields if needed, but keep form fields editable
  const pdfBytes = await pdfDoc.save();
  
  // Create download
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  
  const vesselName = data.vessel.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'Vessel';
  const dateStr = new Date().toISOString().split('T')[0];
  link.download = `US_Crew_List_${vesselName}_${dateStr}.pdf`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
