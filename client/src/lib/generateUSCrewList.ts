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
    
    const passport = documents.find((doc: any) => {
      const docName = (doc.document || '').toLowerCase();
      return docName.includes("passport");
    });
    
    if (passport && passport.number) {
      return passport.number;
    }
    
    const seamansBook = documents.find((doc: any) => {
      const docName = (doc.document || '').toLowerCase();
      return docName.includes("seaman") || docName.includes("cdc") || docName.includes("identity");
    });
    
    if (seamansBook && seamansBook.number) {
      return seamansBook.number;
    }
    
    const firstWithNumber = documents.find((doc: any) => doc.number);
    if (firstWithNumber) {
      return firstWithNumber.number;
    }
    
    return '';
  } catch {
    return '';
  }
}

export async function generateUSCrewListDocument(data: USCrewListData): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  
  const pageWidth = 792;
  const pageHeight = 612;
  const margin = 25;
  const contentWidth = 742;
  
  const form = pdfDoc.getForm();
  const crewMembers = data.crewMembers;
  const totalCrew = crewMembers.length;
  
  const drawText = (page: PDFPage, text: string, x: number, y: number, f: PDFFont, size: number = 7) => {
    page.drawText(text, { x, y, size, font: f, color: rgb(0, 0, 0) });
  };
  
  const drawLine = (page: PDFPage, x1: number, y1: number, x2: number, y2: number, thickness: number = 0.5) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color: rgb(0, 0, 0) });
  };
  
  const drawRect = (page: PDFPage, x: number, y: number, width: number, height: number) => {
    page.drawRectangle({ x, y, width, height, borderColor: rgb(0, 0, 0), borderWidth: 0.5 });
  };
  
  const drawCheckbox = (page: PDFPage, x: number, y: number, size: number = 8, checked: boolean = false) => {
    drawRect(page, x, y, size, size);
    if (checked) {
      drawText(page, 'X', x + 2, y + 1, fontBold, 7);
    }
  };
  
  const drawStampWatermark = (page: PDFPage) => {
    const stampText = 'Replica';
    const stampFontSize = 12;
    const textWidth = fontBold.widthOfTextAtSize(stampText, stampFontSize);
    const textHeight = stampFontSize;
    const paddingX = 8;
    const paddingY = 4;
    const stampWidth = textWidth + paddingX * 2;
    const stampHeight = textHeight + paddingY * 2;
    const stampX = pageWidth - margin - stampWidth - 5;
    const stampY = pageHeight - margin + 3;
    const redColor = rgb(0.8, 0, 0);
    
    page.drawRectangle({
      x: stampX,
      y: stampY,
      width: stampWidth,
      height: stampHeight,
      borderColor: redColor,
      borderWidth: 2,
      color: undefined,
      borderOpacity: 1,
    });
    
    page.drawText(stampText, {
      x: stampX + paddingX,
      y: stampY + paddingY + 2,
      size: stampFontSize,
      font: fontBold,
      color: redColor,
    });
  };

  // ========== PAGE 1 ==========
  const page1 = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;
  
  drawStampWatermark(page1);
  
  // Header
  drawText(page1, 'DEPARTMENT OF HOMELAND SECURITY', pageWidth / 2 - 75, y, fontBold, 9);
  y -= 11;
  drawText(page1, 'U.S. Customs and Border Protection', pageWidth / 2 - 65, y, font, 8);
  y -= 11;
  drawText(page1, 'PASSENGER LIST - CREW LIST', pageWidth / 2 - 55, y, fontBold, 9);
  y -= 12;
  
  // Instructions paragraph
  const instr1 = 'Prior to arrival in the United States, complete a separate form for a) working crew; and b) passengers and supernumeraries. In addition to its initial completion, the crew list shall be updated to reflect crew';
  const instr2 = 'changes and other relevant activity (or lack thereof) until the vessel departs the United States.';
  drawText(page1, instr1, margin, y, font, 5.5);
  y -= 8;
  drawText(page1, instr2, margin, y, font, 5.5);
  y -= 12;
  
  // Row 1: Vessel Name | Nationality | Official Number
  const row1Height = 30;
  const col3Width = contentWidth / 3;
  const labelOffsetY = 7;
  const fieldHeight = 12;
  const fieldBottomPad = 2;
  
  drawRect(page1, margin, y - row1Height, col3Width, row1Height);
  drawText(page1, 'Vessel Name:', margin + 3, y - labelOffsetY, font, 6);
  const vesselNameField = form.createTextField('vesselName');
  vesselNameField.setText(data.vessel.name || '');
  vesselNameField.addToPage(page1, { x: margin + 3, y: y - row1Height + fieldBottomPad, width: col3Width - 8, height: fieldHeight });
  
  drawRect(page1, margin + col3Width, y - row1Height, col3Width, row1Height);
  drawText(page1, 'Nationality:', margin + col3Width + 3, y - labelOffsetY, font, 6);
  const nationalityField = form.createTextField('vesselNationality');
  nationalityField.setText(data.vessel.nationality || '');
  nationalityField.addToPage(page1, { x: margin + col3Width + 3, y: y - row1Height + fieldBottomPad, width: col3Width - 8, height: fieldHeight });
  
  drawRect(page1, margin + col3Width * 2, y - row1Height, col3Width, row1Height);
  drawText(page1, 'Official Number:', margin + col3Width * 2 + 3, y - labelOffsetY, font, 6);
  const officialNumField = form.createTextField('officialNumber');
  officialNumField.setText(data.vessel.officialNumber || '');
  officialNumField.addToPage(page1, { x: margin + col3Width * 2 + 3, y: y - row1Height + fieldBottomPad, width: col3Width - 8, height: fieldHeight });
  
  y -= row1Height;
  
  // Row 2: Last Foreign Port | Date Sailed | Date of Arrival | Arrival Port
  const row2Height = 30;
  const lastPortWidth = contentWidth * 0.40;
  const dateSailedWidth = contentWidth * 0.20;
  const dateArrivalWidth = contentWidth * 0.20;
  const arrivalPortWidth = contentWidth * 0.20;
  
  drawRect(page1, margin, y - row2Height, lastPortWidth, row2Height);
  drawText(page1, 'Last Foreign Port (Place and Country):', margin + 3, y - labelOffsetY, font, 6);
  const lastPortField = form.createTextField('lastForeignPort');
  lastPortField.setText(data.lastForeignPort || '');
  lastPortField.addToPage(page1, { x: margin + 3, y: y - row2Height + fieldBottomPad, width: lastPortWidth - 8, height: fieldHeight });
  
  drawRect(page1, margin + lastPortWidth, y - row2Height, dateSailedWidth, row2Height);
  drawText(page1, 'Date Sailed from Foreign Port:', margin + lastPortWidth + 3, y - labelOffsetY, font, 5);
  const dateSailedField = form.createTextField('dateSailed');
  dateSailedField.setText(data.dateSailedFromForeignPort || '');
  dateSailedField.addToPage(page1, { x: margin + lastPortWidth + 3, y: y - row2Height + fieldBottomPad, width: dateSailedWidth - 8, height: fieldHeight });
  
  drawRect(page1, margin + lastPortWidth + dateSailedWidth, y - row2Height, dateArrivalWidth, row2Height);
  drawText(page1, 'Date of Arrival in U.S.:', margin + lastPortWidth + dateSailedWidth + 3, y - labelOffsetY, font, 5);
  const dateArrivalField = form.createTextField('dateOfArrival');
  dateArrivalField.setText(data.dateOfArrival || '');
  dateArrivalField.addToPage(page1, { x: margin + lastPortWidth + dateSailedWidth + 3, y: y - row2Height + fieldBottomPad, width: dateArrivalWidth - 8, height: fieldHeight });
  
  drawRect(page1, margin + lastPortWidth + dateSailedWidth + dateArrivalWidth, y - row2Height, arrivalPortWidth, row2Height);
  drawText(page1, 'Arrival Port:', margin + lastPortWidth + dateSailedWidth + dateArrivalWidth + 3, y - labelOffsetY, font, 6);
  const arrivalPortField = form.createTextField('arrivalPort');
  arrivalPortField.setText(data.arrivalPort || '');
  arrivalPortField.addToPage(page1, { x: margin + lastPortWidth + dateSailedWidth + dateArrivalWidth + 3, y: y - row2Height + fieldBottomPad, width: arrivalPortWidth - 8, height: fieldHeight });
  
  y -= row2Height;
  
  // Row 3: No. of Crew | No. of Passengers | Agent at Arrival
  const row3Height = 30;
  const crewCountWidth = contentWidth * 0.18;
  const passengerCountWidth = contentWidth * 0.15;
  const agentWidth = contentWidth * 0.67;
  
  drawRect(page1, margin, y - row3Height, crewCountWidth, row3Height);
  drawText(page1, 'No. of Crew (including Master):', margin + 3, y - labelOffsetY, font, 5);
  const crewCountField = form.createTextField('crewCount');
  crewCountField.setText(totalCrew.toString());
  crewCountField.addToPage(page1, { x: margin + 3, y: y - row3Height + fieldBottomPad, width: crewCountWidth - 8, height: fieldHeight });
  
  drawRect(page1, margin + crewCountWidth, y - row3Height, passengerCountWidth, row3Height);
  drawText(page1, 'No. of Passengers:', margin + crewCountWidth + 3, y - labelOffsetY, font, 5);
  const passengerCountField = form.createTextField('passengerCount');
  passengerCountField.setText('');
  passengerCountField.addToPage(page1, { x: margin + crewCountWidth + 3, y: y - row3Height + fieldBottomPad, width: passengerCountWidth - 8, height: fieldHeight });
  
  drawRect(page1, margin + crewCountWidth + passengerCountWidth, y - row3Height, agentWidth, row3Height);
  drawText(page1, 'Agent at Arrival (Name & Address):', margin + crewCountWidth + passengerCountWidth + 3, y - labelOffsetY, font, 5);
  const agentField = form.createTextField('agentAtArrival');
  agentField.setText(data.agentAtArrival || '');
  agentField.addToPage(page1, { x: margin + crewCountWidth + passengerCountWidth + 3, y: y - row3Height + fieldBottomPad, width: agentWidth - 8, height: fieldHeight });
  
  y -= row3Height;
  
  // Row 4: Longshore work question
  const row4Height = 18;
  drawRect(page1, margin, y - row4Height, contentWidth, row4Height);
  drawText(page1, 'Will crew perform longshore work while vessel is in the United States?', margin + 3, y - 12, font, 6);
  drawText(page1, 'NO', margin + 270, y - 12, fontBold, 6);
  drawCheckbox(page1, margin + 285, y - 14, 8, false);
  drawText(page1, 'YES', margin + 305, y - 12, fontBold, 6);
  drawCheckbox(page1, margin + 325, y - 14, 8, false);
  drawText(page1, '(Provide applicable INA Section 258 Exemption):', margin + 345, y - 12, font, 5);
  const exemptionField = form.createTextField('inaExemption');
  exemptionField.addToPage(page1, { x: margin + 530, y: y - row4Height + 3, width: contentWidth - 530 - 5, height: 12 });
  
  y -= row4Height;
  
  // Proposed Itinerary Section
  y -= 8;
  drawText(page1, 'PROPOSED ITINERARY', pageWidth / 2 - 40, y, fontBold, 7);
  y -= 4;
  
  const itineraryHeaderHeight = 16;
  const itineraryRowHeight = 16;
  const itineraryRows = 3;
  const nextPortWidth = contentWidth * 0.30;
  const arrivalDateWidth = contentWidth * 0.15;
  const vesselAgentWidth = contentWidth * 0.55;
  
  // Itinerary header
  drawRect(page1, margin, y - itineraryHeaderHeight, nextPortWidth, itineraryHeaderHeight);
  drawText(page1, 'Next U.S. Port(s)', margin + 20, y - 11, fontBold, 6);
  
  drawRect(page1, margin + nextPortWidth, y - itineraryHeaderHeight, arrivalDateWidth, itineraryHeaderHeight);
  drawText(page1, 'Arrival Date', margin + nextPortWidth + 15, y - 11, fontBold, 6);
  
  drawRect(page1, margin + nextPortWidth + arrivalDateWidth, y - itineraryHeaderHeight, vesselAgentWidth, itineraryHeaderHeight);
  drawText(page1, 'Vessel Agent (Name and Address)', margin + nextPortWidth + arrivalDateWidth + 80, y - 11, fontBold, 6);
  
  y -= itineraryHeaderHeight;
  
  // Itinerary rows (empty, fillable)
  for (let i = 0; i < itineraryRows; i++) {
    drawRect(page1, margin, y - itineraryRowHeight, nextPortWidth, itineraryRowHeight);
    const nextPortFieldName = `nextPort_${i}`;
    const nextPortF = form.createTextField(nextPortFieldName);
    nextPortF.addToPage(page1, { x: margin + 2, y: y - itineraryRowHeight + 2, width: nextPortWidth - 6, height: 12 });
    
    drawRect(page1, margin + nextPortWidth, y - itineraryRowHeight, arrivalDateWidth, itineraryRowHeight);
    const arrDateFieldName = `arrivalDate_${i}`;
    const arrDateF = form.createTextField(arrDateFieldName);
    arrDateF.addToPage(page1, { x: margin + nextPortWidth + 2, y: y - itineraryRowHeight + 2, width: arrivalDateWidth - 6, height: 12 });
    
    drawRect(page1, margin + nextPortWidth + arrivalDateWidth, y - itineraryRowHeight, vesselAgentWidth, itineraryRowHeight);
    const vesselAgentFieldName = `vesselAgent_${i}`;
    const vesselAgentF = form.createTextField(vesselAgentFieldName);
    vesselAgentF.addToPage(page1, { x: margin + nextPortWidth + arrivalDateWidth + 2, y: y - itineraryRowHeight + 2, width: vesselAgentWidth - 6, height: 12 });
    
    y -= itineraryRowHeight;
  }
  
  y -= 10;
  
  // PASSENGER LIST / CREW LIST checkboxes
  drawCheckbox(page1, margin + 5, y - 2, 10, false);
  drawText(page1, 'PASSENGER LIST', margin + 20, y, fontBold, 7);
  
  drawCheckbox(page1, margin + 105, y - 2, 10, true);
  drawText(page1, 'CREW LIST', margin + 120, y, fontBold, 7);
  
  y -= 14;
  
  // List instruction text
  const listInstr1 = 'List individuals alphabetically. Crew who join the vessel subsequent to its arrival while in the United States must be added to the original list and the appropriate date recorded in the "Date Joined" column.';
  const listInstr2 = 'The "Date Separated" column must be used when a listed crewman is separated from the vessel while it is in the United States. Any crewman designated as "REFUSED" in the "DHS Use Only" column is to';
  const listInstr3 = 'be detained on the vessel at all times.';
  drawText(page1, listInstr1, margin, y, font, 5);
  y -= 7;
  drawText(page1, listInstr2, margin, y, font, 5);
  y -= 7;
  drawText(page1, listInstr3, margin, y, font, 5);
  y -= 10;
  
  // Crew Table Header
  const tableHeaderHeight = 38;
  const colWidths = [80, 80, 45, 70, 70, 45, 50, 122];
  const headers = [
    ['Family Name'],
    ['First Name & Initial'],
    ['Date of', 'Birth'],
    ['Nationality/', 'Document #'],
    ['Position or Title', '(Crew Only)'],
    ['Date', 'Joined', '(Crew Only)'],
    ['Date', 'Separated', '(Crew Only)'],
    ['Inspection Status', '(DHS Use Only)', 'Checked box indicates', 'subsequent parole.']
  ];
  
  drawRect(page1, margin, y - tableHeaderHeight, contentWidth, tableHeaderHeight);
  
  let xPos = margin;
  for (let i = 0; i < colWidths.length; i++) {
    if (i > 0) {
      drawLine(page1, xPos, y, xPos, y - tableHeaderHeight);
    }
    
    const headerLines = headers[i];
    let headerY = y - 8;
    for (const line of headerLines) {
      const isSubtext = line === '(Crew Only)' || line === 'Checked box indicates' || line === 'subsequent parole.';
      drawText(page1, line, xPos + 2, headerY, isSubtext ? fontItalic : fontBold, isSubtext ? 5 : 5.5);
      headerY -= 7;
    }
    
    xPos += colWidths[i];
  }
  
  y -= tableHeaderHeight;
  
  // Crew rows on page 1
  const rowHeight = 16;
  const page1CrewRows = 8;
  let crewIndex = 0;
  
  for (let row = 0; row < page1CrewRows; row++) {
    drawRect(page1, margin, y - rowHeight, contentWidth, rowHeight);
    
    xPos = margin;
    for (let col = 0; col < colWidths.length; col++) {
      if (col > 0) {
        drawLine(page1, xPos, y, xPos, y - rowHeight);
      }
      
      if (crewIndex < totalCrew) {
        const crew = crewMembers[crewIndex];
        let cellText = '';
        
        switch (col) {
          case 0: cellText = crew.familyName || ''; break;
          case 1: 
            const middleInit = crew.middleName ? ` ${crew.middleName.charAt(0)}.` : '';
            cellText = `${crew.firstName || ''}${middleInit}`;
            break;
          case 2: cellText = formatDate(crew.dateOfBirth); break;
          case 3: 
            const docNum = getIdentityDocumentNumber(crew.documents);
            cellText = docNum ? `${crew.nationality || ''} / ${docNum}` : (crew.nationality || '');
            break;
          case 4: cellText = crew.presentRank || ''; break;
          case 5: cellText = formatDate(crew.signOnDate); break;
          case 6: break;
          case 7: break;
        }
        
        if (col < 6 && cellText) {
          drawText(page1, cellText.substring(0, col === 3 ? 20 : 15), xPos + 2, y - 10, font, 5.5);
        }
        
        if (col === 6) {
          const separatedFieldName = `dateSeparated_${crewIndex}`;
          const separatedField = form.createTextField(separatedFieldName);
          separatedField.addToPage(page1, { x: xPos + 2, y: y - rowHeight + 2, width: colWidths[col] - 4, height: rowHeight - 4 });
        }
        
        if (col === 7) {
          drawCheckbox(page1, xPos + 5, y - 12, 8, false);
        }
      } else {
        if (col === 7) {
          drawCheckbox(page1, xPos + 5, y - 12, 8, false);
        }
      }
      
      xPos += colWidths[col];
    }
    
    if (crewIndex < totalCrew) crewIndex++;
    y -= rowHeight;
  }
  
  y -= 5;
  
  // RECEIPT FOR CREW LIST section
  const receiptBoxHeight = 38;
  drawRect(page1, margin, y - receiptBoxHeight, contentWidth, receiptBoxHeight);
  drawText(page1, 'RECEIPT FOR CREW LIST (CBP Use Only).', margin + 3, y - 7, fontBold, 6);
  drawText(page1, 'I-418 Receipt Number at right indicates that the U.S. Customs and Border Protection (CBP)', margin + 138, y - 7, font, 5.5);
  drawText(page1, 'has received the CREW LIST containing the names of all members of crew, including Master, on board said vessel at time of its arrival.', margin + 3, y - 15, font, 5.5);
  drawText(page1, 'I-418 Receipt Number (POE - YYMMDD - Badge # - Military Time):', margin + 380, y - 7, font, 5);
  const receiptField = form.createTextField('receiptNumber');
  receiptField.addToPage(page1, { x: margin + 380, y: y - receiptBoxHeight + 14, width: contentWidth - 380 - 5, height: 10 });
  drawText(page1, 'CBP Port of Arrival (address):', margin + 3, y - receiptBoxHeight + 4, font, 6);
  const cbpPortField = form.createTextField('cbpPortAddress');
  cbpPortField.addToPage(page1, { x: margin + 120, y: y - receiptBoxHeight + 2, width: 250, height: 10 });
  y -= receiptBoxHeight + 3;
  
  // SUMMARY OF DEPARTURE section
  const summaryHeight = 55;
  drawRect(page1, margin, y - summaryHeight, contentWidth, summaryHeight);
  
  drawText(page1, 'SUMMARY OF DEPARTURE.', margin + 3, y - 8, fontBold, 6);
  drawText(page1, 'Vessel Agent (at Departure): Following this vessel\'s departure from the United States, ensure that crew', margin + 103, y - 8, font, 5);
  drawText(page1, 'list reflects all crew additions and separations and is promptly submitted to the U.S. Customs and Border Protection office at the port of', margin + 3, y - 16, font, 5);
  drawText(page1, 'departure. Summarize the departure circumstances by providing the following information:', margin + 3, y - 24, font, 5);
  
  drawText(page1, 'Date of Departure:', margin + 400, y - 16, font, 5);
  const depDateField = form.createTextField('departureDate');
  depDateField.addToPage(page1, { x: margin + 470, y: y - 19, width: contentWidth - 470 - 5, height: 10 });
  
  drawText(page1, 'Port of Departure:', margin + 400, y - 28, font, 5);
  const depPortField = form.createTextField('departurePort');
  depPortField.addToPage(page1, { x: margin + 470, y: y - 31, width: contentWidth - 470 - 5, height: 10 });
  
  drawText(page1, 'Agent at Departure (Name & Address):', margin + 3, y - 36, font, 5);
  const agentDepartureField = form.createTextField('agentAtDeparture');
  agentDepartureField.addToPage(page1, { x: margin + 140, y: y - 39, width: 230, height: 10 });
  
  drawText(page1, 'Total Added Crew:', margin + 400, y - 40, font, 5);
  const addedCrewField = form.createTextField('totalAddedCrew');
  addedCrewField.addToPage(page1, { x: margin + 465, y: y - 43, width: 40, height: 10 });
  
  drawText(page1, 'Total Separated Crew:', margin + 520, y - 40, font, 5);
  const separatedCrewField = form.createTextField('totalSeparatedCrew');
  separatedCrewField.addToPage(page1, { x: margin + 595, y: y - 43, width: 40, height: 10 });
  
  // Page 1 footer
  drawText(page1, 'CBP Form I-418 (09/24)', margin, margin - 5, font, 6);
  drawText(page1, 'Page 1 of 4', pageWidth - margin - 40, margin - 5, font, 6);

  // ========== PAGE 2 ==========
  const page2 = pdfDoc.addPage([pageWidth, pageHeight]);
  y = pageHeight - margin;
  
  drawStampWatermark(page2);
  
  // MASTER'S CERTIFICATION
  drawText(page2, "MASTER'S CERTIFICATION", pageWidth / 2 - 50, y, fontBold, 9);
  y -= 15;
  
  const masterCertText1 = 'MASTER: Execute the following oath before a U.S. Customs and Border Protection Officer as to all arriving passengers on all vessels and all departing crew on United States Flag Vessels, and before an';
  const masterCertText2 = 'CBP Officer authorized to administer oaths as to all departing passengers on vessels:';
  drawText(page2, masterCertText1, margin, y, font, 5.5);
  y -= 8;
  drawText(page2, masterCertText2, margin, y, font, 5.5);
  y -= 12;
  
  const oathText1 = 'I certify that the U.S. Customs and Border Protection baggage declaration requirements have been made known to incoming passengers; that any required CBP baggage declarations have been or will';
  const oathText2 = 'simultaneously herewith be filed as required by law and regulation with the proper CBP Officer; and that the responsibilities devolving upon this vessel in connection therewith, if any, have been or will be';
  const oathText3 = 'discharged as required by law or regulation before the proper CBP Officer. I further certify that there are no steerage passengers on board this vessel (46 U.S.C. 151-163).';
  drawText(page2, oathText1, margin, y, font, 5.5);
  y -= 8;
  drawText(page2, oathText2, margin, y, font, 5.5);
  y -= 8;
  drawText(page2, oathText3, margin, y, font, 5.5);
  y -= 20;
  
  drawText(page2, 'Signature of Master:', pageWidth / 2 - 50, y, font, 7);
  drawLine(page2, pageWidth / 2, y - 2, pageWidth / 2 + 150, y - 2);
  y -= 30;
  
  // CERTIFICATION OF COPY
  const certBoxHeight = 55;
  drawRect(page2, margin, y - certBoxHeight, contentWidth, certBoxHeight);
  drawText(page2, 'CERTIFICATION OF COPY OF CREW LIST OF UNITED STATES FLAG VESSEL', pageWidth / 2 - 140, y - 10, fontBold, 7);
  
  const certCopyText1 = 'I certify that this is a true copy of the original crew list of the named American vessel, which original crew list is on file in this office. Given under my hand and seal of office at the customhouse at';
  drawText(page2, certCopyText1, margin + 2, y - 22, font, 5.5);
  const certFieldY = y - certBoxHeight + 2;
  const certFieldH = 12;
  const certLocWidth = 200;
  const certGap = 30;
  const certDateWidth = 150;
  const certLocationField = form.createTextField('certLocation');
  certLocationField.addToPage(page2, { x: margin + 2, y: certFieldY, width: certLocWidth, height: certFieldH });
  drawText(page2, 'on', margin + 2 + certLocWidth + (certGap - 8) / 2, certFieldY + 3, font, 6);
  const certDateField = form.createTextField('certDate');
  certDateField.addToPage(page2, { x: margin + 2 + certLocWidth + certGap, y: certFieldY, width: certDateWidth, height: certFieldH });
  drawText(page2, '.', margin + 2 + certLocWidth + certGap + certDateWidth + 3, certFieldY + 3, font, 6);
  
  y -= certBoxHeight + 15;
  
  drawText(page2, 'Signature of CBP Officer:', pageWidth / 2 - 60, y, font, 7);
  drawLine(page2, pageWidth / 2, y - 2, pageWidth / 2 + 150, y - 2);
  y -= 25;
  
  // Continuation Sheet Header
  drawText(page2, 'PASSENGER LIST - CREW LIST - Continuation Sheet', pageWidth / 2 - 100, y, fontBold, 9);
  y -= 18;
  
  // Vessel info for continuation
  const contRowHeight = 22;
  drawRect(page2, margin, y - contRowHeight, col3Width, contRowHeight);
  drawText(page2, 'Vessel Name:', margin + 2, y - 8, font, 6);
  drawText(page2, data.vessel.name || '', margin + 50, y - 8, font, 7);
  
  drawRect(page2, margin + col3Width, y - contRowHeight, col3Width, contRowHeight);
  drawText(page2, 'Arrival Port in U.S.:', margin + col3Width + 2, y - 8, font, 6);
  
  drawRect(page2, margin + col3Width * 2, y - contRowHeight, col3Width, contRowHeight);
  drawText(page2, 'Arrival Date:', margin + col3Width * 2 + 2, y - 8, font, 6);
  
  y -= contRowHeight + 5;
  
  // Continuation table header
  drawRect(page2, margin, y - tableHeaderHeight, contentWidth, tableHeaderHeight);
  xPos = margin;
  for (let i = 0; i < colWidths.length; i++) {
    if (i > 0) drawLine(page2, xPos, y, xPos, y - tableHeaderHeight);
    const headerLines = headers[i];
    let headerY = y - 8;
    for (const line of headerLines) {
      const isSubtext = line === '(Crew Only)' || line === 'Checked box indicates' || line === 'subsequent parole.';
      drawText(page2, line, xPos + 2, headerY, isSubtext ? fontItalic : fontBold, isSubtext ? 5 : 5.5);
      headerY -= 7;
    }
    xPos += colWidths[i];
  }
  y -= tableHeaderHeight;
  
  // Continuation crew rows — calculate how many fit above footer
  const page2FooterReserve = margin + 15;
  const page2CrewRows = Math.floor((y - page2FooterReserve) / rowHeight);
  for (let row = 0; row < page2CrewRows; row++) {
    drawRect(page2, margin, y - rowHeight, contentWidth, rowHeight);
    
    xPos = margin;
    for (let col = 0; col < colWidths.length; col++) {
      if (col > 0) drawLine(page2, xPos, y, xPos, y - rowHeight);
      
      if (crewIndex < totalCrew) {
        const crew = crewMembers[crewIndex];
        let cellText = '';
        
        switch (col) {
          case 0: cellText = crew.familyName || ''; break;
          case 1: 
            const middleInit = crew.middleName ? ` ${crew.middleName.charAt(0)}.` : '';
            cellText = `${crew.firstName || ''}${middleInit}`;
            break;
          case 2: cellText = formatDate(crew.dateOfBirth); break;
          case 3: 
            const docNum = getIdentityDocumentNumber(crew.documents);
            cellText = docNum ? `${crew.nationality || ''} / ${docNum}` : (crew.nationality || '');
            break;
          case 4: cellText = crew.presentRank || ''; break;
          case 5: cellText = formatDate(crew.signOnDate); break;
        }
        
        if (col < 6 && cellText) {
          drawText(page2, cellText.substring(0, col === 3 ? 20 : 15), xPos + 2, y - 10, font, 5.5);
        }
        
        if (col === 6) {
          const separatedFieldName = `dateSeparated_p2_${crewIndex}`;
          const separatedField = form.createTextField(separatedFieldName);
          separatedField.addToPage(page2, { x: xPos + 2, y: y - rowHeight + 2, width: colWidths[col] - 4, height: rowHeight - 4 });
        }
        
        if (col === 7) {
          drawCheckbox(page2, xPos + 5, y - 12, 8, false);
        }
      } else {
        if (col === 7) {
          drawCheckbox(page2, xPos + 5, y - 12, 8, false);
        }
      }
      
      xPos += colWidths[col];
    }
    
    if (crewIndex < totalCrew) crewIndex++;
    y -= rowHeight;
  }
  
  // I-418 Receipt Number at bottom of page 2
  y -= 10;
  const receiptLabelX2 = margin + contentWidth / 2;
  drawText(page2, 'I-418 Receipt Number (DHS Use Only)', receiptLabelX2, y, font, 6);
  drawLine(page2, receiptLabelX2 + 145, y - 2, margin + contentWidth, y - 2);
  
  // Page 2 footer
  drawText(page2, 'CBP Form I-418 (09/24)', margin, margin - 5, font, 6);
  drawText(page2, 'Page 2 of 4', pageWidth - margin - 40, margin - 5, font, 6);

  // ========== PAGE 3 ==========
  const page3 = pdfDoc.addPage([pageWidth, pageHeight]);
  y = pageHeight - margin;
  
  drawStampWatermark(page3);
  
  // Continuation Sheet Header
  drawText(page3, 'PASSENGER LIST - CREW LIST - Continuation Sheet', pageWidth / 2 - 100, y, fontBold, 9);
  y -= 18;
  
  // Vessel info
  drawRect(page3, margin, y - contRowHeight, col3Width, contRowHeight);
  drawText(page3, 'Vessel Name:', margin + 2, y - 8, font, 6);
  drawText(page3, data.vessel.name || '', margin + 50, y - 8, font, 7);
  
  drawRect(page3, margin + col3Width, y - contRowHeight, col3Width, contRowHeight);
  drawText(page3, 'Arrival Port in U.S.:', margin + col3Width + 2, y - 8, font, 6);
  
  drawRect(page3, margin + col3Width * 2, y - contRowHeight, col3Width, contRowHeight);
  drawText(page3, 'Arrival Date:', margin + col3Width * 2 + 2, y - 8, font, 6);
  
  y -= contRowHeight + 5;
  
  // Table header
  drawRect(page3, margin, y - tableHeaderHeight, contentWidth, tableHeaderHeight);
  xPos = margin;
  for (let i = 0; i < colWidths.length; i++) {
    if (i > 0) drawLine(page3, xPos, y, xPos, y - tableHeaderHeight);
    const headerLines = headers[i];
    let headerY = y - 8;
    for (const line of headerLines) {
      const isSubtext = line === '(Crew Only)' || line === 'Checked box indicates' || line === 'subsequent parole.';
      drawText(page3, line, xPos + 2, headerY, isSubtext ? fontItalic : fontBold, isSubtext ? 5 : 5.5);
      headerY -= 7;
    }
    xPos += colWidths[i];
  }
  y -= tableHeaderHeight;
  
  // Page 3 crew rows — calculate how many fit above footer
  const page3FooterReserve = margin + 15;
  const page3CrewRows = Math.floor((y - page3FooterReserve) / rowHeight);
  for (let row = 0; row < page3CrewRows; row++) {
    drawRect(page3, margin, y - rowHeight, contentWidth, rowHeight);
    
    xPos = margin;
    for (let col = 0; col < colWidths.length; col++) {
      if (col > 0) drawLine(page3, xPos, y, xPos, y - rowHeight);
      
      if (crewIndex < totalCrew) {
        const crew = crewMembers[crewIndex];
        let cellText = '';
        
        switch (col) {
          case 0: cellText = crew.familyName || ''; break;
          case 1: 
            const middleInit = crew.middleName ? ` ${crew.middleName.charAt(0)}.` : '';
            cellText = `${crew.firstName || ''}${middleInit}`;
            break;
          case 2: cellText = formatDate(crew.dateOfBirth); break;
          case 3: 
            const docNum = getIdentityDocumentNumber(crew.documents);
            cellText = docNum ? `${crew.nationality || ''} / ${docNum}` : (crew.nationality || '');
            break;
          case 4: cellText = crew.presentRank || ''; break;
          case 5: cellText = formatDate(crew.signOnDate); break;
        }
        
        if (col < 6 && cellText) {
          drawText(page3, cellText.substring(0, col === 3 ? 20 : 15), xPos + 2, y - 10, font, 5.5);
        }
        
        if (col === 6) {
          const separatedFieldName = `dateSeparated_p3_${crewIndex}`;
          const separatedField = form.createTextField(separatedFieldName);
          separatedField.addToPage(page3, { x: xPos + 2, y: y - rowHeight + 2, width: colWidths[col] - 4, height: rowHeight - 4 });
        }
        
        if (col === 7) {
          drawCheckbox(page3, xPos + 5, y - 12, 8, false);
        }
      } else {
        if (col === 7) {
          drawCheckbox(page3, xPos + 5, y - 12, 8, false);
        }
      }
      
      xPos += colWidths[col];
    }
    
    if (crewIndex < totalCrew) crewIndex++;
    y -= rowHeight;
  }
  
  // I-418 Receipt Number at bottom of page 3
  y -= 10;
  const receiptLabelX3 = margin + contentWidth / 2;
  drawText(page3, 'I-418 Receipt Number (DHS Use Only)', receiptLabelX3, y, font, 6);
  drawLine(page3, receiptLabelX3 + 145, y - 2, margin + contentWidth, y - 2);
  
  // Page 3 footer
  drawText(page3, 'CBP Form I-418 (09/24)', margin, margin - 5, font, 6);
  drawText(page3, 'Page 3 of 4', pageWidth - margin - 40, margin - 5, font, 6);

  // ========== PAGE 4 - INSTRUCTIONS ==========
  const page4 = pdfDoc.addPage([pageWidth, pageHeight]);
  y = pageHeight - margin - 30;
  
  drawStampWatermark(page4);
  
  drawText(page4, 'PASSENGER LIST - CREW LIST', pageWidth / 2 - 60, y, fontBold, 10);
  y -= 15;
  drawText(page4, 'INSTRUCTIONS', pageWidth / 2 - 35, y, fontBold, 10);
  y -= 25;
  
  drawText(page4, 'ALL NAMES AND OTHER DATA INSCRIBED ON THIS FORM MUST BE IN THE ENGLISH LANGUAGE', pageWidth / 2 - 170, y, fontBold, 8);
  y -= 30;
  
  // PASSENGERS section
  drawText(page4, 'PASSENGERS:', margin + 80, y, fontBold, 7);
  drawText(page4, ' Deliver one complete alphabetical passenger list, regardless of nationality, to United States Public', margin + 140, y, font, 7);
  y -= 10;
  drawText(page4, 'Health Service, and three such lists to the United States Customs and Border Protection, on arrival at first port in the', margin + 80, y, font, 7);
  y -= 10;
  drawText(page4, 'United States.', margin + 80, y, font, 7);
  y -= 25;
  
  // CREW LIST VISA APPLICATION section
  drawText(page4, 'CREW LIST VISA APPLICATION:', margin + 80, y, fontBold, 7);
  drawText(page4, ' Submit form in duplicate to U.S. consular officer, specifying each alien crewman', margin + 210, y, font, 7);
  y -= 10;
  drawText(page4, 'not in possession of a valid individual visa or lawful resident alien card.', margin + 80, y, font, 7);
  y -= 25;
  
  // ARRIVING CREW section
  drawText(page4, 'ARRIVING CREW:', margin + 80, y, fontBold, 7);
  drawText(page4, ' Deliver one complete alphabetical crew list, regardless of nationality, to United States Public', margin + 160, y, font, 7);
  y -= 10;
  drawText(page4, 'Health Service, and three such lists to the United States Customs and Border Protection on arrival at first port in the', margin + 80, y, font, 7);
  y -= 10;
  drawText(page4, 'United States. Where a crewman is a returning resident, show his/her alien registration receipt number where', margin + 80, y, font, 7);
  y -= 10;
  drawText(page4, 'prompted for a document number.', margin + 80, y, font, 7);
  y -= 25;
  
  // CHANGES IN CREW section
  drawText(page4, 'CHANGES IN CREW:', margin + 80, y, fontBold, 7);
  drawText(page4, ' If an alien crewman is separating from the vessel while in the United States (and will not be', margin + 175, y, font, 7);
  y -= 10;
  drawText(page4, 'returning), discharge authorization must first be obtained from the United States Customs and Border Protection via', margin + 80, y, font, 7);
  y -= 10;
  drawText(page4, 'Form I-408 (Application to Pay Off or Discharge Alien Crewman) and the appropriate date of separation must be', margin + 80, y, font, 7);
  y -= 10;
  drawText(page4, 'recorded in the "Date Separated" column of this form for that crew member. If a crew member joins the vessel while', margin + 80, y, font, 7);
  y -= 10;
  drawText(page4, 'in the United States, add the crewman\'s name and other requested information at the next available blank line of the', margin + 80, y, font, 7);
  y -= 10;
  drawText(page4, 'list and record the appropriate date in the "Date Joined" column.', margin + 80, y, font, 7);
  y -= 25;
  
  // DEPARTING CREW section
  drawText(page4, 'DEPARTING CREW:', margin + 80, y, fontBold, 7);
  drawText(page4, ' When the vessel departs the United States, complete the SUMMARY OF DEPARTURE', margin + 175, y, font, 7);
  y -= 10;
  drawText(page4, 'section and deliver one complete list (whether or not there have been crew changes) to the United States Customs', margin + 80, y, font, 7);
  y -= 10;
  drawText(page4, 'and Border Protection at the port of departure.', margin + 80, y, font, 7);
  
  // Page 4 footer
  drawText(page4, 'CBP Form I-418 (09/24)', margin, margin - 5, font, 6);
  drawText(page4, 'Page 4 of 4', pageWidth - margin - 40, margin - 5, font, 6);

  // Save and download
  const pdfBytes = await pdfDoc.save();
  
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
