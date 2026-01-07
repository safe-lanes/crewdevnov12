import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  WidthType,
  AlignmentType,
  BorderStyle,
  HeightRule,
  VerticalAlign,
} from "docx";
import { saveAs } from "file-saver";

interface CrewMemberData {
  id: string;
  firstName?: string;
  middleName?: string;
  familyName?: string;
  presentRank?: string;
  nationality?: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  gender?: string;
  documents?: string;
}

interface VesselData {
  id: number;
  name: string;
  vesselType?: string;
}

interface FALFormData {
  vessel: VesselData;
  crewMembers: CrewMemberData[];
  imoNumber?: string;
  callSign?: string;
  voyageNumber?: string;
  portOfArrival?: string;
  dateOfArrival?: string;
  flagState?: string;
  lastPortOfCall?: string;
  isDeparture?: boolean;
}

function createTableBorders() {
  return {
    top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
    left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
    right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  };
}

function getIdentityDocumentData(documentsData: string | object | undefined): { 
  documentType: string; 
  number: string; 
  issuingState: string; 
  expiryDate: string 
} {
  const emptyResult = { documentType: "", number: "", issuingState: "", expiryDate: "" };
  
  if (!documentsData) {
    return emptyResult;
  }
  
  let documents: any[];
  
  try {
    if (typeof documentsData === 'string') {
      if (!documentsData.trim()) return emptyResult;
      documents = JSON.parse(documentsData);
    } else if (Array.isArray(documentsData)) {
      documents = documentsData;
    } else {
      return emptyResult;
    }
    
    if (!Array.isArray(documents) || documents.length === 0) {
      return emptyResult;
    }
    
    // Priority 1: Look for passport
    const passport = documents.find((doc: any) => {
      const docName = (doc.document || '').toLowerCase();
      return docName.includes("passport");
    });
    
    if (passport) {
      return {
        documentType: passport.document || "Passport",
        number: passport.number || "",
        issuingState: passport.issuingAuthority || "",
        expiryDate: passport.expiry || "",
      };
    }
    
    // Priority 2: Look for seaman's book or CDC
    const seamansBook = documents.find((doc: any) => {
      const docName = (doc.document || '').toLowerCase();
      return docName.includes("seaman") || docName.includes("cdc") || docName.includes("identity");
    });
    
    if (seamansBook) {
      return {
        documentType: seamansBook.document || "Seaman's Book",
        number: seamansBook.number || "",
        issuingState: seamansBook.issuingAuthority || "",
        expiryDate: seamansBook.expiry || "",
      };
    }
    
    // Fallback: Use first available document
    const firstDoc = documents[0];
    if (firstDoc) {
      return {
        documentType: firstDoc.document || "",
        number: firstDoc.number || "",
        issuingState: firstDoc.issuingAuthority || "",
        expiryDate: firstDoc.expiry || "",
      };
    }
  } catch (e) {
    console.error("Error parsing documents:", e);
  }
  
  return emptyResult;
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return dateString;
  }
}

export async function generateFALForm5Document(data: FALFormData): Promise<void> {
  const { vessel, crewMembers, imoNumber, callSign, voyageNumber, portOfArrival, dateOfArrival, flagState, lastPortOfCall, isDeparture } = data;

  const headerRow = new TableRow({
    children: [
      new TableCell({
        width: { size: 500, type: WidthType.DXA },
        borders: createTableBorders(),
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ children: [new TextRun({ text: "6. No.", size: 16, bold: true })] })],
      }),
      new TableCell({
        width: { size: 1200, type: WidthType.DXA },
        borders: createTableBorders(),
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ children: [new TextRun({ text: "7. Family name", size: 16, bold: true })] })],
      }),
      new TableCell({
        width: { size: 1200, type: WidthType.DXA },
        borders: createTableBorders(),
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ children: [new TextRun({ text: "8. Given names", size: 16, bold: true })] })],
      }),
      new TableCell({
        width: { size: 1000, type: WidthType.DXA },
        borders: createTableBorders(),
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ children: [new TextRun({ text: "9. Rank or rating", size: 16, bold: true })] })],
      }),
      new TableCell({
        width: { size: 900, type: WidthType.DXA },
        borders: createTableBorders(),
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ children: [new TextRun({ text: "10. Nationality", size: 16, bold: true })] })],
      }),
      new TableCell({
        width: { size: 900, type: WidthType.DXA },
        borders: createTableBorders(),
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ children: [new TextRun({ text: "11. Date of birth", size: 16, bold: true })] })],
      }),
      new TableCell({
        width: { size: 1000, type: WidthType.DXA },
        borders: createTableBorders(),
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ children: [new TextRun({ text: "12. Place of birth", size: 16, bold: true })] })],
      }),
      new TableCell({
        width: { size: 600, type: WidthType.DXA },
        borders: createTableBorders(),
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ children: [new TextRun({ text: "13. Gender", size: 16, bold: true })] })],
      }),
      new TableCell({
        width: { size: 1000, type: WidthType.DXA },
        borders: createTableBorders(),
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ children: [new TextRun({ text: "14. Nature of identity document", size: 16, bold: true })] })],
      }),
      new TableCell({
        width: { size: 1000, type: WidthType.DXA },
        borders: createTableBorders(),
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ children: [new TextRun({ text: "15. Number of identity document", size: 16, bold: true })] })],
      }),
      new TableCell({
        width: { size: 1000, type: WidthType.DXA },
        borders: createTableBorders(),
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ children: [new TextRun({ text: "16. Issuing State of identity document", size: 16, bold: true })] })],
      }),
      new TableCell({
        width: { size: 900, type: WidthType.DXA },
        borders: createTableBorders(),
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ children: [new TextRun({ text: "17. Expiry date of identity document", size: 16, bold: true })] })],
      }),
    ],
    height: { value: 600, rule: HeightRule.ATLEAST },
  });

  const crewRows = crewMembers.map((crew, index) => {
    const identityDoc = getIdentityDocumentData(crew.documents);
    const givenNames = [crew.firstName, crew.middleName].filter(Boolean).join(" ");
    
    return new TableRow({
      children: [
        new TableCell({
          borders: createTableBorders(),
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(index + 1), size: 18 })] })],
        }),
        new TableCell({
          borders: createTableBorders(),
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ children: [new TextRun({ text: crew.familyName || "", size: 18 })] })],
        }),
        new TableCell({
          borders: createTableBorders(),
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ children: [new TextRun({ text: givenNames, size: 18 })] })],
        }),
        new TableCell({
          borders: createTableBorders(),
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ children: [new TextRun({ text: crew.presentRank || "", size: 18 })] })],
        }),
        new TableCell({
          borders: createTableBorders(),
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ children: [new TextRun({ text: crew.nationality || "", size: 18 })] })],
        }),
        new TableCell({
          borders: createTableBorders(),
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ children: [new TextRun({ text: formatDate(crew.dateOfBirth), size: 18 })] })],
        }),
        new TableCell({
          borders: createTableBorders(),
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ children: [new TextRun({ text: crew.placeOfBirth || "", size: 18 })] })],
        }),
        new TableCell({
          borders: createTableBorders(),
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: crew.gender || "", size: 18 })] })],
        }),
        new TableCell({
          borders: createTableBorders(),
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ children: [new TextRun({ text: identityDoc.documentType, size: 18 })] })],
        }),
        new TableCell({
          borders: createTableBorders(),
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ children: [new TextRun({ text: identityDoc.number, size: 18 })] })],
        }),
        new TableCell({
          borders: createTableBorders(),
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ children: [new TextRun({ text: identityDoc.issuingState, size: 18 })] })],
        }),
        new TableCell({
          borders: createTableBorders(),
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ children: [new TextRun({ text: formatDate(identityDoc.expiryDate), size: 18 })] })],
        }),
      ],
      height: { value: 400, rule: HeightRule.ATLEAST },
    });
  });

  const emptyRowsNeeded = Math.max(0, 20 - crewMembers.length);
  const emptyRows = Array.from({ length: emptyRowsNeeded }, () => 
    new TableRow({
      children: Array.from({ length: 12 }, () => 
        new TableCell({
          borders: createTableBorders(),
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ children: [new TextRun({ text: "", size: 18 })] })],
        })
      ),
      height: { value: 400, rule: HeightRule.ATLEAST },
    })
  );

  const crewTable = new Table({
    rows: [headerRow, ...crewRows, ...emptyRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });

  const headerInfoTable = new Table({
    rows: [
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 2,
            borders: createTableBorders(),
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "CREW LIST", size: 28, bold: true })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "(IMO FAL Form 5)", size: 20 })] }),
            ],
          }),
          new TableCell({
            borders: createTableBorders(),
            children: [
              new Paragraph({ children: [new TextRun({ text: isDeparture ? "" : "X", size: 20 }), new TextRun({ text: "  Arrival", size: 18 })] }),
              new Paragraph({ children: [new TextRun({ text: isDeparture ? "X" : "", size: 20 }), new TextRun({ text: "  Departure", size: 18 })] }),
            ],
          }),
          new TableCell({
            borders: createTableBorders(),
            children: [new Paragraph({ children: [new TextRun({ text: "Page Number", size: 18 })] })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            borders: createTableBorders(),
            children: [
              new Paragraph({ children: [new TextRun({ text: "1.1 Name of ship", size: 16, bold: true })] }),
              new Paragraph({ children: [new TextRun({ text: vessel.name || "", size: 18 })] }),
            ],
          }),
          new TableCell({
            borders: createTableBorders(),
            children: [
              new Paragraph({ children: [new TextRun({ text: "1.2 IMO number", size: 16, bold: true })] }),
              new Paragraph({ children: [new TextRun({ text: imoNumber || "", size: 18 })] }),
            ],
          }),
          new TableCell({
            borders: createTableBorders(),
            children: [
              new Paragraph({ children: [new TextRun({ text: "1.3 Call sign", size: 16, bold: true })] }),
              new Paragraph({ children: [new TextRun({ text: callSign || "", size: 18 })] }),
            ],
          }),
          new TableCell({
            borders: createTableBorders(),
            children: [
              new Paragraph({ children: [new TextRun({ text: "1.4 Voyage number", size: 16, bold: true })] }),
              new Paragraph({ children: [new TextRun({ text: voyageNumber || "", size: 18 })] }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            borders: createTableBorders(),
            children: [
              new Paragraph({ children: [new TextRun({ text: "2. Port of arrival/departure", size: 16, bold: true })] }),
              new Paragraph({ children: [new TextRun({ text: portOfArrival || "", size: 18 })] }),
            ],
          }),
          new TableCell({
            borders: createTableBorders(),
            children: [
              new Paragraph({ children: [new TextRun({ text: "3. Date of arrival/departure", size: 16, bold: true })] }),
              new Paragraph({ children: [new TextRun({ text: formatDate(dateOfArrival), size: 18 })] }),
            ],
          }),
          new TableCell({
            borders: createTableBorders(),
            children: [
              new Paragraph({ children: [new TextRun({ text: "4. Flag State of ship", size: 16, bold: true })] }),
              new Paragraph({ children: [new TextRun({ text: flagState || "", size: 18 })] }),
            ],
          }),
          new TableCell({
            borders: createTableBorders(),
            children: [
              new Paragraph({ children: [new TextRun({ text: "5. Last port of call", size: 16, bold: true })] }),
              new Paragraph({ children: [new TextRun({ text: lastPortOfCall || "", size: 18 })] }),
            ],
          }),
        ],
      }),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });

  const signatureSection = new Table({
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: createTableBorders(),
            children: [
              new Paragraph({ children: [] }),
              new Paragraph({ children: [new TextRun({ text: "18. Date and signature by master, authorized agent or officer", size: 18, bold: true })] }),
              new Paragraph({ children: [] }),
              new Paragraph({ children: [] }),
              new Paragraph({ children: [] }),
            ],
          }),
        ],
      }),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children: [
          headerInfoTable,
          new Paragraph({ children: [] }),
          crewTable,
          new Paragraph({ children: [] }),
          signatureSection,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, "FAL_Form_5_1_IMO_Crew_List.docx");
}
