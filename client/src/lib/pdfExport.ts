import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface PdfColumn {
  key: string;
  label: string;
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

export function downloadPdf(
  filename: string,
  title: string,
  columns: PdfColumn[],
  rows: Array<Record<string, unknown>>,
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  const marginX = 32;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title || "Report", marginX, 36);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(110);
  const generatedAt = new Date().toLocaleString();
  doc.text(`Generated: ${generatedAt}`, marginX, 52);
  doc.setTextColor(0);

  const head = [columns.map((c) => c.label)];
  const body = rows.map((row) => columns.map((c) => cellText(row[c.key])));

  autoTable(doc, {
    head,
    body,
    startY: 64,
    margin: { left: marginX, right: marginX },
    styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: [22, 86, 158], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [244, 248, 251] },
    didDrawPage: (data) => {
      const pageSize = doc.internal.pageSize;
      const pageHeight = pageSize.height || pageSize.getHeight();
      const pageWidth = pageSize.width || pageSize.getWidth();
      doc.setFontSize(8);
      doc.setTextColor(120);
      const pageNum = doc.getNumberOfPages();
      doc.text(`Page ${pageNum}`, pageWidth - marginX, pageHeight - 16, {
        align: "right",
      });
      doc.setTextColor(0);
    },
  });

  const out = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  doc.save(out);
}
