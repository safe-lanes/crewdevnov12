import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  analyzeAttachmentZip,
  convertAttachmentZip,
} from "../../server/v2/crew-pool/services/attachment-converter/converter";
import { parseAttachmentPath } from "../../server/v2/crew-pool/services/attachment-converter/parser";
import { RSMS_PROFILE_A } from "../../server/v2/crew-pool/services/attachment-converter/profiles";
import type { AttachmentConverterResolvers } from "../../server/v2/crew-pool/services/attachment-converter/resolvers";
import {
  attachmentConverterProfileSchema,
  type CrewCandidate,
  type SectionRecordCandidate,
} from "../../server/v2/crew-pool/services/attachment-converter/types";

const PDF = Buffer.from("%PDF-1.7\noriginal bytes must remain unchanged\n%%EOF");

function fakeResolvers(options?: {
  crews?: CrewCandidate[];
  records?: SectionRecordCandidate[];
}): AttachmentConverterResolvers {
  const crews = options?.crews ?? [{ crewUuid: "crew-1", employeeId: "K 1027", crewName: "AZHAR SIDDIQUE" }];
  const records = options?.records ?? [{
    section: "training",
    recordUuid: "train-1",
    crewUuid: "crew-1",
    documentName: "AFF",
    attachmentRef: "K 1027-T8_AFF",
    erpRecord: "D3 Training AFF",
  }];
  return {
    async findCrewsByName() { return crews; },
    async findRecords(_section, _crewUuid, documentName) {
      return records.filter((record) => record.documentName.trim().toUpperCase() === documentName.trim().toUpperCase());
    },
    async findRecordByUuid(section, crewUuid, recordUuid) {
      return records.find((record) => record.section === section && record.crewUuid === crewUuid && record.recordUuid === recordUuid) ?? null;
    },
  };
}

function profileWithAliases(aliases: string[]) {
  return attachmentConverterProfileSchema.parse({
    ...RSMS_PROFILE_A,
    documentCategory: { aliases: { training: aliases }, resolution: "aliases-only" },
  });
}

async function zipWith(path: string, content = PDF): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(path, content);
  return zip.generateAsync({ type: "nodebuffer" });
}

describe("client attachment converter", () => {
  it("normalizes RSMS Profile A input without embedding output naming rules", () => {
    const parsed = parseAttachmentPath(
      RSMS_PROFILE_A,
      "client-export/AZHAR SIDDIQUE/AZHAR SIDDIQUE. AFF.pdf",
    );

    expect(parsed.error).toBeUndefined();
    expect(parsed.input).toMatchObject({
      originalFilePath: "client-export/AZHAR SIDDIQUE/AZHAR SIDDIQUE. AFF.pdf",
      extractedCrewName: "AZHAR SIDDIQUE",
      extractedEmployeeId: null,
      extractedDocumentName: "AFF",
      detectedDocumentCategory: "training",
      originalFilename: "AZHAR SIDDIQUE. AFF.pdf",
    });
  });

  it("reuses the same parser, resolver contract, report, and output builder for another declarative profile", async () => {
    const profile = profileWithAliases(["COURSE ALPHA"]);
    const source = await zipWith("wrapper/AZHAR SIDDIQUE/AZHAR SIDDIQUE. COURSE ALPHA.pdf");
    const resolvers = fakeResolvers({
      records: [{
        section: "training",
        recordUuid: "train-2",
        crewUuid: "crew-1",
        documentName: "COURSE ALPHA",
        attachmentRef: "K 1027-T9_ALPHA",
        erpRecord: "D3 Training COURSE ALPHA",
      }],
    });

    const result = await convertAttachmentZip(source, profile, resolvers);
    const converted = await JSZip.loadAsync(result.convertedZip);

    expect(result.convertedCount).toBe(1);
    expect(result.report[0]).toMatchObject({
      status: "converted",
      actualAttachmentRef: "K 1027-T9_ALPHA",
      convertedDestinationPath: "K 1027/K 1027-T9_ALPHA/AZHAR SIDDIQUE. COURSE ALPHA.pdf",
    });
    expect(await converted.file("K 1027/K 1027-T9_ALPHA/AZHAR SIDDIQUE. COURSE ALPHA.pdf")!.async("nodebuffer")).toEqual(PDF);
  });

  it("resolves a course filename through the active D3 Training section", async () => {
    const source = await zipWith("AZHAR SIDDIQUE/AZHAR SIDDIQUE. ADV OIL TANKER.pdf");
    const result = await convertAttachmentZip(
      source,
      RSMS_PROFILE_A,
      fakeResolvers({
        records: [{
          section: "training",
          recordUuid: "train-oil",
          crewUuid: "crew-1",
          documentName: "ADV OIL TANKER",
          attachmentRef: "K 1027-T10_OIL",
          erpRecord: "D3 Training ADV OIL TANKER",
        }],
      }),
    );

    expect(result.convertedCount).toBe(1);
    expect(result.report[0]).toMatchObject({
      documentCategory: "training",
      actualAttachmentRef: "K 1027-T10_OIL",
    });
  });

  it("emits backend file-processing progress rather than only upload progress", async () => {
    const source = await zipWith("AZHAR SIDDIQUE/AZHAR SIDDIQUE. AFF.pdf");
    const progress: Array<{ completed: number; total: number; percent: number; stage: string }> = [];
    await analyzeAttachmentZip(source, RSMS_PROFILE_A, fakeResolvers(), [], (event) => progress.push(event));

    expect(progress[0]).toMatchObject({ completed: 0, total: 1, percent: 0, stage: "analysis" });
    expect(progress.at(-1)).toMatchObject({ completed: 1, total: 1, percent: 100, stage: "analysis" });
  });

  it("does not include ambiguous mappings in the converted ZIP", async () => {
    const source = await zipWith("AZHAR SIDDIQUE/AZHAR SIDDIQUE. AFF.pdf");
    const result = await convertAttachmentZip(
      source,
      profileWithAliases(["AFF"]),
      fakeResolvers({
        records: [
          { section: "training", recordUuid: "train-1", crewUuid: "crew-1", documentName: "AFF", attachmentRef: "REF-1", erpRecord: "D3 Training 1" },
          { section: "training", recordUuid: "train-2", crewUuid: "crew-1", documentName: "AFF", attachmentRef: "REF-2", erpRecord: "D3 Training 2" },
        ],
      }),
    );

    const converted = await JSZip.loadAsync(result.convertedZip);
    expect(result.manualReviewCount).toBe(1);
    expect(result.convertedCount).toBe(0);
    expect(Object.keys(converted.files)).toHaveLength(0);
    expect(result.report[0].status).toBe("manual_review");
  });

  it("requires a validated manual resolution for an unknown category", async () => {
    const source = await zipWith("AZHAR SIDDIQUE/AZHAR SIDDIQUE. UNKNOWN.pdf");
    const profile = profileWithAliases(["AFF"]);
    const result = await analyzeAttachmentZip(source, profile, fakeResolvers());

    expect(result.files[0].status).toBe("manual_review");
    expect(result.files[0].reason).toContain("approved category alias");
  });

  it("accepts a manual resolution only after revalidating the exact stored ref", async () => {
    const source = await zipWith("AZHAR SIDDIQUE/AZHAR SIDDIQUE. UNKNOWN.pdf");
    const profile = profileWithAliases(["AFF"]);
    const result = await convertAttachmentZip(source, profile, fakeResolvers(), [{
      sourcePath: "AZHAR SIDDIQUE/AZHAR SIDDIQUE. UNKNOWN.pdf",
      crewUuid: "crew-1",
      recordUuid: "train-1",
      section: "training",
      attachmentRef: "K 1027-T8_AFF",
    }]);

    expect(result.convertedCount).toBe(1);
    expect(result.report[0]).toMatchObject({
      documentCategory: "training",
      actualAttachmentRef: "K 1027-T8_AFF",
      status: "converted",
    });
  });
});
