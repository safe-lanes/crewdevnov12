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
  PageOrientation,
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

const FONT = "Arial";
const HEADER_LABEL_SIZE = 14;
const HEADER_VALUE_SIZE = 14;
const TABLE_HEADER_SIZE = 13;
const TABLE_DATA_SIZE = 13;
const TITLE_SIZE = 22;
const SUBTITLE_SIZE = 16;

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

function cellMargins() {
  return {
    top: 20,
    bottom: 20,
    left: 40,
    right: 40,
  };
}

export async function generateFALForm5Document(data: FALFormData): Promise<void> {
  const { vessel, crewMembers, imoNumber, callSign, voyageNumber, portOfArrival, dateOfArrival, flagState, lastPortOfCall, isDeparture } = data;

  const headerRow = new TableRow({
    children: [
      new TableCell({
        width: { size: 4, type: WidthType.PERCENTAGE },
        borders: createTableBorders(),
        verticalAlign: VerticalAlign.CENTER,
        margins: cellMargins(),
        children: [
          new Paragraph({ children: [new TextRun({ text: "6.", size: TABLE_HEADER_SIZE, bold: true, font: FONT })] }),
          new Paragraph({ children: [new TextRun({ text: "No.", size: TABLE_HEADER_SIZE, bold: true, font: FONT })] }),
        ],
      }),
      new TableCell({
        width: { size: 10, type: WidthType.PERCENTAGE },
        borders: createTableBorders(),
        verticalAlign: VerticalAlign.CENTER,
        margins: cellMargins(),
        children: [new Paragraph({ children: [new TextRun({ text: "7. Family name", size: TABLE_HEADER_SIZE, bold: true, font: FONT })] })],
      }),
      new TableCell({
        width: { size: 9, type: WidthType.PERCENTAGE },
        borders: createTableBorders(),
        verticalAlign: VerticalAlign.CENTER,
        margins: cellMargins(),
        children: [new Paragraph({ children: [new TextRun({ text: "8. Given names", size: TABLE_HEADER_SIZE, bold: true, font: FONT })] })],
      }),
      new TableCell({
        width: { size: 8, type: WidthType.PERCENTAGE },
        borders: createTableBorders(),
        verticalAlign: VerticalAlign.CENTER,
        margins: cellMargins(),
        children: [new Paragraph({ children: [new TextRun({ text: "9. Rank or rating", size: TABLE_HEADER_SIZE, bold: true, font: FONT })] })],
      }),
      new TableCell({
        width: { size: 9, type: WidthType.PERCENTAGE },
        borders: createTableBorders(),
        verticalAlign: VerticalAlign.CENTER,
        margins: cellMargins(),
        children: [new Paragraph({ children: [new TextRun({ text: "10. Nationality", size: TABLE_HEADER_SIZE, bold: true, font: FONT })] })],
      }),
      new TableCell({
        width: { size: 8, type: WidthType.PERCENTAGE },
        borders: createTableBorders(),
        verticalAlign: VerticalAlign.CENTER,
        margins: cellMargins(),
        children: [new Paragraph({ children: [new TextRun({ text: "11. Date of birth", size: TABLE_HEADER_SIZE, bold: true, font: FONT })] })],
      }),
      new TableCell({
        width: { size: 12, type: WidthType.PERCENTAGE },
        borders: createTableBorders(),
        verticalAlign: VerticalAlign.CENTER,
        margins: cellMargins(),
        children: [new Paragraph({ children: [new TextRun({ text: "12. Place of birth", size: TABLE_HEADER_SIZE, bold: true, font: FONT })] })],
      }),
      new TableCell({
        width: { size: 5, type: WidthType.PERCENTAGE },
        borders: createTableBorders(),
        verticalAlign: VerticalAlign.CENTER,
        margins: cellMargins(),
        children: [new Paragraph({ children: [new TextRun({ text: "13. Gender", size: TABLE_HEADER_SIZE, bold: true, font: FONT })] })],
      }),
      new TableCell({
        width: { size: 8, type: WidthType.PERCENTAGE },
        borders: createTableBorders(),
        verticalAlign: VerticalAlign.CENTER,
        margins: cellMargins(),
        children: [new Paragraph({ children: [new TextRun({ text: "14. Nature of identity document", size: TABLE_HEADER_SIZE, bold: true, font: FONT })] })],
      }),
      new TableCell({
        width: { size: 9, type: WidthType.PERCENTAGE },
        borders: createTableBorders(),
        verticalAlign: VerticalAlign.CENTER,
        margins: cellMargins(),
        children: [new Paragraph({ children: [new TextRun({ text: "15. Number of identity document", size: TABLE_HEADER_SIZE, bold: true, font: FONT })] })],
      }),
      new TableCell({
        width: { size: 9, type: WidthType.PERCENTAGE },
        borders: createTableBorders(),
        verticalAlign: VerticalAlign.CENTER,
        margins: cellMargins(),
        children: [new Paragraph({ children: [new TextRun({ text: "16. Issuing State of identity document", size: TABLE_HEADER_SIZE, bold: true, font: FONT })] })],
      }),
      new TableCell({
        width: { size: 9, type: WidthType.PERCENTAGE },
        borders: createTableBorders(),
        verticalAlign: VerticalAlign.CENTER,
        margins: cellMargins(),
        children: [new Paragraph({ children: [new TextRun({ text: "17. Expiry date of identity document", size: TABLE_HEADER_SIZE, bold: true, font: FONT })] })],
      }),
    ],
    height: { value: 400, rule: HeightRule.ATLEAST },
  });

  const crewRows = crewMembers.map((crew, index) => {
    const identityDoc = getIdentityDocumentData(crew.documents);
    const givenNames = [crew.firstName, crew.middleName].filter(Boolean).join(" ");
    
    return new TableRow({
      children: [
        new TableCell({
          borders: createTableBorders(),
          verticalAlign: VerticalAlign.CENTER,
          margins: cellMargins(),
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(index + 1), size: TABLE_DATA_SIZE, font: FONT })] })],
        }),
        new TableCell({
          borders: createTableBorders(),
          verticalAlign: VerticalAlign.CENTER,
          margins: cellMargins(),
          children: [new Paragraph({ children: [new TextRun({ text: crew.familyName || "", size: TABLE_DATA_SIZE, font: FONT })] })],
        }),
        new TableCell({
          borders: createTableBorders(),
          verticalAlign: VerticalAlign.CENTER,
          margins: cellMargins(),
          children: [new Paragraph({ children: [new TextRun({ text: givenNames, size: TABLE_DATA_SIZE, font: FONT })] })],
        }),
        new TableCell({
          borders: createTableBorders(),
          verticalAlign: VerticalAlign.CENTER,
          margins: cellMargins(),
          children: [new Paragraph({ children: [new TextRun({ text: crew.presentRank || "", size: TABLE_DATA_SIZE, font: FONT })] })],
        }),
        new TableCell({
          borders: createTableBorders(),
          verticalAlign: VerticalAlign.CENTER,
          margins: cellMargins(),
          children: [new Paragraph({ children: [new TextRun({ text: crew.nationality || "", size: TABLE_DATA_SIZE, font: FONT })] })],
        }),
        new TableCell({
          borders: createTableBorders(),
          verticalAlign: VerticalAlign.CENTER,
          margins: cellMargins(),
          children: [new Paragraph({ children: [new TextRun({ text: formatDate(crew.dateOfBirth), size: TABLE_DATA_SIZE, font: FONT })] })],
        }),
        new TableCell({
          borders: createTableBorders(),
          verticalAlign: VerticalAlign.CENTER,
          margins: cellMargins(),
          children: [new Paragraph({ children: [new TextRun({ text: crew.placeOfBirth || "", size: TABLE_DATA_SIZE, font: FONT })] })],
        }),
        new TableCell({
          borders: createTableBorders(),
          verticalAlign: VerticalAlign.CENTER,
          margins: cellMargins(),
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: crew.gender || "", size: TABLE_DATA_SIZE, font: FONT })] })],
        }),
        new TableCell({
          borders: createTableBorders(),
          verticalAlign: VerticalAlign.CENTER,
          margins: cellMargins(),
          children: [new Paragraph({ children: [new TextRun({ text: identityDoc.documentType, size: TABLE_DATA_SIZE, font: FONT })] })],
        }),
        new TableCell({
          borders: createTableBorders(),
          verticalAlign: VerticalAlign.CENTER,
          margins: cellMargins(),
          children: [new Paragraph({ children: [new TextRun({ text: identityDoc.number, size: TABLE_DATA_SIZE, font: FONT })] })],
        }),
        new TableCell({
          borders: createTableBorders(),
          verticalAlign: VerticalAlign.CENTER,
          margins: cellMargins(),
          children: [new Paragraph({ children: [new TextRun({ text: identityDoc.issuingState, size: TABLE_DATA_SIZE, font: FONT })] })],
        }),
        new TableCell({
          borders: createTableBorders(),
          verticalAlign: VerticalAlign.CENTER,
          margins: cellMargins(),
          children: [new Paragraph({ children: [new TextRun({ text: formatDate(identityDoc.expiryDate), size: TABLE_DATA_SIZE, font: FONT })] })],
        }),
      ],
      height: { value: 300, rule: HeightRule.ATLEAST },
    });
  });

  const emptyRowsNeeded = Math.max(0, 20 - crewMembers.length);
  const emptyRows = Array.from({ length: emptyRowsNeeded }, () => 
    new TableRow({
      children: Array.from({ length: 12 }, () => 
        new TableCell({
          borders: createTableBorders(),
          verticalAlign: VerticalAlign.CENTER,
          margins: cellMargins(),
          children: [new Paragraph({ children: [new TextRun({ text: "", size: TABLE_DATA_SIZE, font: FONT })] })],
        })
      ),
      height: { value: 300, rule: HeightRule.ATLEAST },
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
            verticalAlign: VerticalAlign.CENTER,
            margins: cellMargins(),
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "CREW LIST", size: TITLE_SIZE, bold: true, font: FONT })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "(IMO FAL Form 5)", size: SUBTITLE_SIZE, font: FONT })] }),
            ],
          }),
          new TableCell({
            borders: createTableBorders(),
            verticalAlign: VerticalAlign.CENTER,
            margins: cellMargins(),
            children: [
              new Paragraph({ children: [new TextRun({ text: isDeparture ? "" : "X", size: HEADER_VALUE_SIZE, bold: true, font: FONT }), new TextRun({ text: "  Arrival", size: HEADER_VALUE_SIZE, font: FONT })] }),
              new Paragraph({ children: [new TextRun({ text: isDeparture ? "X" : "", size: HEADER_VALUE_SIZE, bold: true, font: FONT }), new TextRun({ text: "  Departure", size: HEADER_VALUE_SIZE, font: FONT })] }),
            ],
          }),
          new TableCell({
            borders: createTableBorders(),
            verticalAlign: VerticalAlign.CENTER,
            margins: cellMargins(),
            children: [new Paragraph({ children: [new TextRun({ text: "Page Number", size: HEADER_LABEL_SIZE, font: FONT })] })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            borders: createTableBorders(),
            margins: cellMargins(),
            children: [
              new Paragraph({ children: [new TextRun({ text: "1.1 Name of ship", size: HEADER_LABEL_SIZE, bold: true, font: FONT })] }),
              new Paragraph({ children: [new TextRun({ text: vessel.name || "", size: HEADER_VALUE_SIZE, font: FONT })] }),
            ],
          }),
          new TableCell({
            borders: createTableBorders(),
            margins: cellMargins(),
            children: [
              new Paragraph({ children: [new TextRun({ text: "1.2 IMO number", size: HEADER_LABEL_SIZE, bold: true, font: FONT })] }),
              new Paragraph({ children: [new TextRun({ text: imoNumber || "", size: HEADER_VALUE_SIZE, font: FONT })] }),
            ],
          }),
          new TableCell({
            borders: createTableBorders(),
            margins: cellMargins(),
            children: [
              new Paragraph({ children: [new TextRun({ text: "1.3 Call sign", size: HEADER_LABEL_SIZE, bold: true, font: FONT })] }),
              new Paragraph({ children: [new TextRun({ text: callSign || "", size: HEADER_VALUE_SIZE, font: FONT })] }),
            ],
          }),
          new TableCell({
            borders: createTableBorders(),
            margins: cellMargins(),
            children: [
              new Paragraph({ children: [new TextRun({ text: "1.4 Voyage number", size: HEADER_LABEL_SIZE, bold: true, font: FONT })] }),
              new Paragraph({ children: [new TextRun({ text: voyageNumber || "", size: HEADER_VALUE_SIZE, font: FONT })] }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            borders: createTableBorders(),
            margins: cellMargins(),
            children: [
              new Paragraph({ children: [new TextRun({ text: "2. Port of arrival/departure", size: HEADER_LABEL_SIZE, bold: true, font: FONT })] }),
              new Paragraph({ children: [new TextRun({ text: portOfArrival || "", size: HEADER_VALUE_SIZE, font: FONT })] }),
            ],
          }),
          new TableCell({
            borders: createTableBorders(),
            margins: cellMargins(),
            children: [
              new Paragraph({ children: [new TextRun({ text: "3. Date of arrival/departure", size: HEADER_LABEL_SIZE, bold: true, font: FONT })] }),
              new Paragraph({ children: [new TextRun({ text: formatDate(dateOfArrival), size: HEADER_VALUE_SIZE, font: FONT })] }),
            ],
          }),
          new TableCell({
            borders: createTableBorders(),
            margins: cellMargins(),
            children: [
              new Paragraph({ children: [new TextRun({ text: "4. Flag State of ship", size: HEADER_LABEL_SIZE, bold: true, font: FONT })] }),
              new Paragraph({ children: [new TextRun({ text: flagState || "", size: HEADER_VALUE_SIZE, font: FONT })] }),
            ],
          }),
          new TableCell({
            borders: createTableBorders(),
            margins: cellMargins(),
            children: [
              new Paragraph({ children: [new TextRun({ text: "5. Last port of call", size: HEADER_LABEL_SIZE, bold: true, font: FONT })] }),
              new Paragraph({ children: [new TextRun({ text: lastPortOfCall || "", size: HEADER_VALUE_SIZE, font: FONT })] }),
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
            margins: cellMargins(),
            children: [
              new Paragraph({ children: [] }),
              new Paragraph({ children: [new TextRun({ text: "18. Date and signature by master, authorized agent or officer", size: HEADER_LABEL_SIZE, bold: true, font: FONT })] }),
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
            size: {
              orientation: PageOrientation.LANDSCAPE,
            },
            margin: {
              top: 500,
              right: 500,
              bottom: 500,
              left: 500,
            },
          },
        },
        children: [
          headerInfoTable,
          new Paragraph({ spacing: { after: 80 }, children: [] }),
          crewTable,
          new Paragraph({ spacing: { after: 80 }, children: [] }),
          signatureSection,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, "FAL_Form_5_1_IMO_Crew_List.docx");
}
