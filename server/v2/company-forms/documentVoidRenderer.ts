import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { sailDate } from "../../../shared/v2/forms-engine/displayFormatting";

/** Only archived bytes and immutable notice evidence enter this renderer. */
export async function appendVoidNotice(original: Buffer, evidence: any, reference: string, revision: number) {
  const pdf = await PDFDocument.load(original);
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await readFile(path.join(process.cwd(), "server/assets/fonts/DejaVuSans.ttf")), { subset: true });
  const supported = new Set(font.getCharacterSet());
  const safe = (text: string) => [...text].map(c => supported.has(c.codePointAt(0)!) ? c : "?").join("");
  const recorded = (value: unknown) => value ? String(value) : "Not recorded";
  const at = evidence.voidedAt ? new Date(evidence.voidedAt) : null;
  const when = at && Number.isFinite(at.getTime())
    ? `${sailDate(at)} ${at.toISOString().slice(11, 16)} UTC` : "Not recorded";
  const firstNotice = pdf.getPageCount();
  let page = pdf.addPage([595.28, 841.89]), y = 785;
  const line = (text: string, size = 11) => {
    if (y < 110) { page = pdf.addPage([595.28, 841.89]); y = 785; }
    page.drawText(safe(text), { x: 42, y, size, font, color: rgb(.12, .18, .24) });
    y -= size + 7;
  };
  const paragraph = (text: string) => {
    for (const raw of text.split(/\r?\n/)) {
      let buffer = "";
      for (const char of safe(raw)) {
        if (font.widthOfTextAtSize(buffer + char, 11) > 510) { line(buffer); buffer = ""; }
        buffer += char;
      }
      line(buffer);
    }
    y -= 6;
  };
  line("VOID NOTICE", 20);
  paragraph(`Document reference: ${reference}`);
  paragraph(`Notice revision: ${revision}`);
  paragraph("This form is void. The original pages are retained as historical evidence, not as a valid form.");
  paragraph(`Voided by: ${recorded(evidence.actorName)}`);
  paragraph(`Designation: ${recorded(evidence.designation)}`);
  paragraph(`Voided on: ${when}`);
  paragraph(`Reason: ${recorded(evidence.reason)}`);
  paragraph(evidence.replacementSubmissionUuid
    ? `Replacement form record: ${evidence.replacementSubmissionUuid}`
    : "No replacement yet");
  paragraph(`Original file fingerprint (SHA-256):\n${recorded(evidence.originalFileSha256)}`);
  paragraph("The annotated copy has its own file fingerprint in the archive and handover record.");
  for (let i = firstNotice; i < pdf.getPageCount(); i++) {
    const p = pdf.getPage(i);
    p.drawText(safe(`${reference} | Void notice ${revision} | Page ${i + 1} of ${pdf.getPageCount()}`),
      { x: 42, y: 38, size: 8, font });
  }
  return { bytes: Buffer.from(await pdf.save()), pageCount: pdf.getPageCount() };
}
