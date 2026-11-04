import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../server/v2/db", () => ({ getDb: vi.fn() }));

import { createDatabaseAttachmentConverterResolvers } from "../../server/v2/crew-pool/services/attachment-converter/resolvers";
import { convertAttachmentZip } from "../../server/v2/crew-pool/services/attachment-converter/converter";
import { RSMS_PROFILE_A } from "../../server/v2/crew-pool/services/attachment-converter/profiles";

const training = {
  recordUuid: "train-1", crewUuid: "crew-1", attachmentRef: "EXACT-STORED-REF",
  trainingCourse: "ADVANCED CHEMICAL TANKER TRAINING", abbr: "ADV CHEMICAL TANKER" as string | null,
  courseId: "D3-001", certificateNo: "CERT-12345",
};
const pdf = Buffer.from("%PDF-1.7\noriginal contents\n%%EOF");

// Exercise the production resolver and output pipeline with database rows supplied
// at the query boundary, rather than substituting a fake matching function.
async function convert(documentName: string, rows = [training]) {
  const database = {
    select: () => ({ from: () => ({ where: async () => rows }) }),
  };
  const resolvers = createDatabaseAttachmentConverterResolvers(database as any);
  resolvers.findCrewsByName = async () => [{
    crewUuid: "crew-1", employeeId: "K 1027", crewName: "AZHAR SIDDIQUE",
  }];
  const zip = new JSZip();
  zip.file(`AZHAR SIDDIQUE/AZHAR SIDDIQUE. ${documentName}.pdf`, pdf);
  return convertAttachmentZip(await zip.generateAsync({ type: "nodebuffer" }), RSMS_PROFILE_A, resolvers);
}

describe("D3 converter abbreviation matching", () => {
  it("matches abbr with normalized case/spacing and preserves stored ref, display name and bytes", async () => {
    const name = "adv  chemical tanker";
    const result = await convert(name, [{ ...training, abbr: "  ADV CHEMICAL TANKER  " }]);
    expect(result.convertedCount).toBe(1);
    expect(result.report[0]).toMatchObject({
      actualAttachmentRef: training.attachmentRef,
      matchedErpRecord: "D3 Training ADVANCED CHEMICAL TANKER TRAINING",
      status: "converted",
    });
    const zip = await JSZip.loadAsync(result.convertedZip);
    expect(await zip.file(`K 1027/EXACT-STORED-REF/AZHAR SIDDIQUE. ${name}.pdf`)!.async("nodebuffer")).toEqual(pdf);
  });

  it.each([training.trainingCourse, training.courseId, training.certificateNo])(
    "excludes a filename matching only another field: %s", async (name) => {
      const result = await convert(name);
      expect(result.convertedCount).toBe(0);
      expect(result.report[0].status).toBe("skipped");
      expect(Object.keys((await JSZip.loadAsync(result.convertedZip)).files)).toHaveLength(0);
    },
  );

  it.each([null, "", "   "])("does not fall back when abbr is %s", async (abbr) => {
    const result = await convert(training.trainingCourse, [{ ...training, abbr }]);
    expect(result.report[0].status).toBe("skipped");
    expect(result.convertedCount).toBe(0);
  });

  it("excludes duplicate abbreviation matches for manual review", async () => {
    const result = await convert(training.abbr!, [training, {
      ...training, recordUuid: "train-2", attachmentRef: "OTHER-STORED-REF",
    }]);
    expect(result.manualReviewCount).toBe(1);
    expect(result.convertedCount).toBe(0);
    expect(Object.keys((await JSZip.loadAsync(result.convertedZip)).files)).toHaveLength(0);
  });
});
