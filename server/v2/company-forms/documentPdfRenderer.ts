import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import sanitizeHtml from "sanitize-html";
import type { FrozenDocumentInput } from "../../../shared/v2/forms-engine/documentEvidence";
import { canonicalDocumentJson, sha256 } from "./documentEvidenceRepository";

export const PDF_RENDERER_VERSION = "company-form-pdf-1";
export const PDF_FONT_VERSION = "DejaVu-Sans-2.37";
const INK = rgb(.12, .18, .24), BLUE = rgb(.09, .27, .40), MUTED = rgb(.35, .40, .45);
const plain = (html: string) => sanitizeHtml(html
  .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(?:p|div|h[1-6]|tr|li)>/gi, "\n")
  .replace(/<li\b[^>]*>/gi, "• ").replace(/<\/t[dh]>/gi, " | "), {
  allowedTags: [], allowedAttributes: {}, nonTextTags: ["script", "style"],
}).replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
const recorded = (value: unknown) => value === null || value === undefined || value === "" ? "Not recorded" : String(value);
const date = (value: unknown) => {
  if (!value) return "Not recorded";
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? "Not recorded" : `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;
};

/** Pure renderer: only the frozen input and bundled, licensed fonts are read. */
export async function renderFrozenDocument(input: FrozenDocumentInput, frozenHash: string): Promise<Buffer> {
  if (sha256(canonicalDocumentJson(input)) !== frozenHash) throw new Error("Frozen record checksum does not match.");
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const root = path.join(process.cwd(), "server/assets/fonts");
  const [regularBytes, boldBytes] = await Promise.all([
    readFile(path.join(root, "DejaVuSans.ttf")), readFile(path.join(root, "DejaVuSans-Bold.ttf")),
  ]);
  const regular = await pdf.embedFont(regularBytes, { subset: true });
  const bold = await pdf.embedFont(boldBytes, { subset: true });
  const supported = new Set(regular.getCharacterSet());
  const definition = input.header.definition as any;
  const title = recorded(definition.form?.name);
  const version = recorded(definition.version?.versionNo);
  const stage = ({ before_joining: "Before joining", on_board: "On board", at_sign_off: "At sign-off" } as Record<string, string>)
    [input.source.stageKey ?? ""] ?? recorded(input.source.stageKey);
  pdf.setTitle(`${title} — v${version}`);
  pdf.setAuthor(recorded(input.header.tenant.companyName));
  pdf.setCreator(`${PDF_RENDERER_VERSION}; ${PDF_FONT_VERSION}`);
  pdf.setProducer("Frozen Company Form archive");
  pdf.setCreationDate(new Date(input.source.completedAt));
  pdf.setModificationDate(new Date(input.source.completedAt));
  let page!: PDFPage;
  let y = 0;
  const width = 499;
  const checkText = (text: string) => {
    for (const ch of Array.from(text)) {
      if (ch !== "\n" && ch !== "\t" && !supported.has(ch.codePointAt(0)!)) {
        throw new Error("The document contains characters not supported by the bundled font.");
      }
    }
  };
  const newPage = () => {
    page = pdf.addPage([595.28, 841.89]);
    page.drawText("COMPANY FORM  /  STORED COPY", { x: 48, y: 803, font: bold, size: 8, color: BLUE });
    page.drawLine({ start: { x: 48, y: 792 }, end: { x: 547, y: 792 }, thickness: 1, color: rgb(.80, .85, .88) });
    y = 768;
  };
  const ensure = (height: number) => { if (y - height < 82) newPage(); };
  const text = (value: unknown, size = 10, font: PDFFont = regular, color = INK) => {
    const content = recorded(value).replace(/\r/g, "").replace(/\t/g, "    ");
    checkText(content);
    for (const paragraph of content.split("\n")) {
      const words = paragraph.split(/\s+/);
      let line = "";
      const flush = () => {
        ensure(size * 1.55);
        if (line) page.drawText(line, { x: 48, y, font, size, color });
        y -= size * 1.55; line = "";
      };
      for (const word of words) {
        if (font.widthOfTextAtSize(`${line}${line ? " " : ""}${word}`, size) <= width) {
          line += `${line ? " " : ""}${word}`;
        } else {
          if (line) flush();
          if (font.widthOfTextAtSize(word, size) <= width) line = word;
          else for (const ch of Array.from(word)) {
            if (font.widthOfTextAtSize(line + ch, size) > width) flush();
            line += ch;
          }
        }
      }
      flush();
    }
  };
  const heading = (value: string, size = 13) => { ensure(52); y -= 10; text(value, size, bold, BLUE); y -= 4; };
  newPage();
  const logo = input.header.branding.asset;
  if (logo) {
    const bytes = Buffer.from(logo.bytesBase64, "base64");
    if (sha256(bytes) !== logo.sha256 || logo.sha256 !== input.header.branding.assetSha256)
      throw new Error("Frozen logo checksum does not match.");
    const image = logo.mediaType === "image/png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    const scale = Math.min(160 / image.width, 58 / image.height);
    page.drawImage(image, { x: 48, y: y - image.height * scale, width: image.width * scale, height: image.height * scale });
    y -= 74;
  }
  text(input.header.tenant.companyName, 12, bold);
  y -= 8; text(title, 19, bold, BLUE);
  text(`Version ${version}  ·  ${stage}`, 10, regular, MUTED);
  y -= 8;
  text(`Seafarer: ${recorded(input.header.subject.subjectLabel)}`);
  for (const field of input.header.subject.fields) text(`${field.label}: ${recorded(field.value)}`);
  text(`Completed: ${date(input.source.completedAt)}`, 9, regular, MUTED);
  const options = definition.options ?? [];
  for (const part of definition.parts ?? []) {
    const sections = (definition.sections ?? []).filter((s: any) => s.formPartUuid === part.formPartUuid);
    heading(recorded(part.partTitle), 14);
    for (const section of sections) {
      heading(recorded(section.sectionTitle), 12);
      if (!input.applicableSectionUuids.includes(section.sectionUuid)) {
        text("Not applicable", 10, regular, MUTED); continue;
      }
      for (const question of (definition.questions ?? []).filter((q: any) => q.sectionUuid === section.sectionUuid)) {
        const label = plain(question.questionText ?? "");
        if (label) text(label, 10, bold);
        if (question.contentHtml) text(plain(question.contentHtml));
        if (question.responseType === "system_field") {
          const field = input.systemFields.find((s: any) => s.questionUuid === question.questionUuid);
          text(field?.value);
        } else if (question.responseType !== "content") {
          const answer = input.answers.find((a: any) => a.questionUuid === question.questionUuid);
          let value = recorded(answer?.answerValue);
          const labels = new Map(options.filter((o: any) => o.optionSetUuid === question.optionSetUuid)
            .map((o: any) => [o.optionValue, o.optionLabel]));
          if (question.responseType === "multi_select") {
            try { value = JSON.parse(value).map((v: string) => labels.get(v) ?? v).join(", "); } catch { /* retain the recorded string */ }
          } else value = String(labels.get(value) ?? value);
          if (question.responseType === "checkbox") value = value === "true" ? "Yes" : value === "false" ? "No" : value;
          text(value);
          if (answer?.answerComment) text(`Comment: ${answer.answerComment}`, 9);
        }
        y -= 6;
      }
      const state = input.sectionStates.find((s: any) => s.sectionUuid === section.sectionUuid);
      if (state?.sectionComment) text(`Section comment: ${state.sectionComment}`, 9);
      for (const signature of input.signatures.filter((s: any) => s.record.sectionStateUuid === state?.sectionStateUuid)) {
        ensure(145);
        const r = signature.record;
        const label = ({ officer: "Company Representative", seafarer: "Seafarer", vessel_management: "Vessel Management" } as any)[String(r.signatureType)] ?? "Signatory";
        text(label, 10, bold);
        const bytes = Buffer.from(signature.asset.bytesBase64, "base64");
        if (sha256(bytes) !== signature.asset.sha256) throw new Error("Frozen signature checksum does not match.");
        const image = await pdf.embedPng(bytes);
        const scale = Math.min(180 / image.width, 48 / image.height);
        page.drawImage(image, { x: 48, y: y - 48, width: image.width * scale, height: image.height * scale });
        y -= 58;
        text(`${recorded(r.signerName)} · ${recorded(r.signerRank)}`, 9);
        text(`Signed: ${date(r.signedAt)}`, 8, regular, MUTED);
        if (r.signatureMethod === "witnessed") {
          text(`Witnessed by: ${recorded(r.witnessName)} · ${recorded(r.witnessRank)}`, 9);
          text(`Witnessed: ${date(r.signedAt)}`, 8, regular, MUTED);
        }
        y -= 12;
      }
      if (state?.submittedAt) text(`Submitted by ${recorded(state.submittedByName)} · ${date(state.submittedAt)}`, 8, regular, MUTED);
    }
  }
  for (const [index, p] of pdf.getPages().entries()) {
    p.drawLine({ start: { x: 48, y: 64 }, end: { x: 547, y: 64 }, thickness: .6, color: rgb(.80, .85, .88) });
    p.drawText("Frozen-record SHA-256", { x: 48, y: 51, font: bold, size: 7, color: MUTED });
    p.drawText(frozenHash, { x: 48, y: 39, font: regular, size: 6.8, color: MUTED });
    p.drawText(`Page ${index + 1} of ${pdf.getPageCount()}`, { x: 485, y: 51, font: regular, size: 7, color: MUTED });
  }
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}
