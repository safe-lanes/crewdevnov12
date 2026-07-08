import { describe, it, expect, vi } from "vitest";
import { generateImportTemplate } from "../../../../server/v2/crew-pool/services/importTemplate";

// Mock database storage/drizzle to prevent full database queries during unit tests
vi.mock("../../../../server/v2/db", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => [
          { nationality: "Indian" },
          { vesselType: "Oil Tanker" },
          { countryName: "India" },
          { languageName: "Hindi" },
        ],
      }),
    }),
  }),
}));

describe("Crew Import — Excel Template Generation", () => {
  it("should successfully generate a styled multi-sheet Excel template buffer", async () => {
    const buffer = await generateImportTemplate();
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
