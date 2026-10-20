import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import sanitizeHtml from "sanitize-html";
import type { FrozenDocumentInput } from "../../../shared/v2/forms-engine/documentEvidence";
import { canonicalDocumentJson, sha256 } from "./documentEvidenceRepository";
import { companyFormNumbers } from "../../../shared/v2/forms-engine/displayNumbering";
import { sailDate } from "../../../shared/v2/forms-engine/displayFormatting";
import { documentHeaderFields } from "./documentHeaderDates";

export const PDF_RENDERER_VERSION = "company-form-pdf-3";
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
  return Number.isNaN(d.getTime()) ? "Not recorded" : `${sailDate(d)} ${d.toISOString().slice(11, 16)} UTC`;
};
const calendarDate = (value: unknown) => {
  if (!value || !Number.isFinite(new Date(String(value)).getTime())) return "Not recorded";
  return sailDate(String(value));
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
  const reference = recorded(input.header.documentReference);
  const structures = Object.fromEntries((definition.parts ?? []).map((p: any) => [
    p.formPartUuid, (definition.sections ?? []).filter((s: any) => s.formPartUuid === p.formPartUuid)
      .map((s: any) => ({ ...s, section_uuid: s.sectionUuid,
        questions: (definition.questions ?? []).filter((q: any) => q.sectionUuid === s.sectionUuid)
          .map((q: any) => ({ ...q, question_uuid: q.questionUuid, response_type: q.responseType })) })),
  ]));
  const numbers = companyFormNumbers<any, any, any>(definition.parts ?? [], structures);
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
    let headerY = 806;
    for (const [value, font, size] of [
      [recorded(input.header.tenant.companyName), bold, 9],
      [title, bold, 9],
      [`Seafarer: ${recorded(input.header.subject.subjectLabel)} · Version ${version}`, regular, 8],
    ] as [string, PDFFont, number][]) {
      checkText(value);
      let line = "";
      for (const word of value.replace(/\s+/g, " ").split(" ")) {
        if (font.widthOfTextAtSize(`${line}${line ? " " : ""}${word}`, size) > width && line) {
          page.drawText(line, { x: 48, y: headerY, font, size, color: BLUE }); headerY -= 13; line = "";
        }
        for (const ch of Array.from(`${line ? " " : ""}${word}`)) {
          if (font.widthOfTextAtSize(line + ch, size) > width) {
            page.drawText(line, { x: 48, y: headerY, font, size, color: BLUE }); headerY -= 13; line = "";
          }
          line += ch;
        }
      }
      if (line) { page.drawText(line, { x: 48, y: headerY, font, size, color: BLUE }); headerY -= 13; }
    }
    if (headerY < 500) throw new Error("The frozen running-header facts exceed the available page header.");
    page.drawLine({ start: { x: 48, y: headerY + 2 }, end: { x: 547, y: headerY + 2 }, thickness: 1, color: rgb(.80, .85, .88) });
    y = headerY - 21;
  };
  const ensure = (height: number) => { if (y - height < 92) newPage(); };
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
  y -= 8; text(title, 19, bold, BLUE);
  text(`Version ${version}  ·  ${stage}`, 10, regular, MUTED);
  text(`Document reference: ${reference}`, 10, bold);
  y -= 8;
  text(`Seafarer: ${recorded(input.header.subject.subjectLabel)}`);
  for (const label of ["Crew ID", "Nationality"])
    text(`${label}: ${recorded(input.header.subject.fields.find(f => f.label === label)?.value)}`);
  for (const field of documentHeaderFields(input))
    text(`${field.label}: ${/date/i.test(field.label) ? calendarDate(field.value) : recorded(field.value)}`);
  text(`Completed: ${date(input.source.completedAt)}`, 9, regular, MUTED);
  const options = definition.options ?? [];
  for (const part of definition.parts ?? []) {
    const sections = (definition.sections ?? []).filter((s: any) => s.formPartUuid === part.formPartUuid);
    heading(`${numbers.part.get(part.formPartUuid)} · ${recorded(part.partTitle)}`, 14);
    for (const section of sections) {
      heading(`${numbers.section.get(section.sectionUuid)} ${recorded(section.sectionTitle)}`, 12);
      if (!input.applicableSectionUuids.includes(section.sectionUuid)) {
        text("Not applicable", 10, regular, MUTED); continue;
      }
      for (const question of (definition.questions ?? []).filter((q: any) => q.sectionUuid === section.sectionUuid)) {
        const label = plain(question.questionText ?? "");
        if (label) text(`${numbers.question.get(question.questionUuid) ? numbers.question.get(question.questionUuid) + " " : ""}${label}`, 10, bold);
        if (question.contentHtml) text(plain(question.contentHtml));
        if (question.responseType === "system_field") {
          const field = input.systemFields.find((s: any) => s.questionUuid === question.questionUuid);
          text(/date/.test(question.systemFieldKey ?? "") ? calendarDate(field?.value) : field?.value);
        } else if (question.responseType !== "content") {
          const answer = input.answers.find((a: any) => a.questionUuid === question.questionUuid);
          let value = recorded(answer?.answerValue);
          const labels = new Map(options.filter((o: any) => o.optionSetUuid === question.optionSetUuid)
            .map((o: any) => [o.optionValue, o.optionLabel]));
          if (question.responseType === "multi_select") {
            try { value = JSON.parse(value).map((v: string) => labels.get(v) ?? v).join(", "); } catch { /* retain the recorded string */ }
          } else value = String(labels.get(value) ?? value);
          if (question.responseType === "checkbox") value = value === "true" ? "Yes" : value === "false" ? "No" : value;
          text(question.responseType === "date" ? calendarDate(value) : value);
          if (answer?.answerComment) text(`Comment: ${answer.answerComment}`, 9);
        }
        y -= 6;
      }
      const state = input.sectionStates.find((s: any) => s.sectionUuid === section.sectionUuid);
      if (state?.sectionComment) text(`Section comment: ${state.sectionComment}`, 9);
      for (const signature of input.signatures.filter((s: any) => s.record.sectionStateUuid === state?.sectionStateUuid)) {
        const r = signature.record;
        ensure(r.signatureMethod === "witnessed" ? 220 : 180);
        const label = ({ officer: "Company Representative", seafarer: "Seafarer", vessel_management: "Vessel Management" } as any)[String(r.signatureType)] ?? "Signatory";
        text(label, 10, bold);
        const bytes = Buffer.from(signature.asset.bytesBase64, "base64");
        if (sha256(bytes) !== signature.asset.sha256) throw new Error("Frozen signature checksum does not match.");
        const image = await pdf.embedPng(bytes);
        const scale = Math.min(180 / image.width, 48 / image.height);
        page.drawImage(image, { x: 48, y: y - 48, width: image.width * scale, height: image.height * scale });
        y -= 58;
        text(`Name: ${recorded(r.signerName)}`, 9);
        text(`${r.signatureType === "seafarer" ? "Rank" : "Designation"}: ${recorded(r.signerRank)}`, 9);
        text(`Signed: ${date(r.signedAt)}`, 8, regular, MUTED);
        if (r.signatureMethod === "witnessed") {
          text(`Witnessed by: ${recorded(r.witnessName)}`, 9);
          text(`Witness designation: ${recorded(r.witnessRank)}`, 9);
          text(`Witnessed: ${date(r.signedAt)}`, 8, regular, MUTED);
        }
        y -= 12;
      }
      if (state?.submittedAt) text(`Submitted by ${recorded(state.submittedByName)} · ${date(state.submittedAt)}`, 8, regular, MUTED);
    }
  }
  for (const [index, p] of pdf.getPages().entries()) {
    p.drawLine({ start: { x: 48, y: 78 }, end: { x: 547, y: 78 }, thickness: .6, color: rgb(.80, .85, .88) });
    p.drawText(`Document reference: ${reference}`, { x: 48, y: 65, font: regular, size: 7, color: MUTED });
    p.drawText("Record fingerprint (SHA-256)", { x: 48, y: 51, font: bold, size: 7, color: MUTED });
    p.drawText(frozenHash, { x: 48, y: 39, font: regular, size: 6.8, color: MUTED });
    p.drawText(`Page ${index + 1} of ${pdf.getPageCount()}`, { x: 485, y: 65, font: regular, size: 7, color: MUTED });
  }
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}
