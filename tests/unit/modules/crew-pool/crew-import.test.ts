import { describe, it, expect, vi } from "vitest";
import { generateImportTemplate } from "../../../../server/v2/crew-pool/services/importTemplate";
import { parseDate } from "../../../../server/v2/crew-pool/services/crewImportService";

// Mock database storage/drizzle to prevent full database queries during unit tests
vi.mock("../../../../server/v2/db", () => {
  const mockData = [{ name: "Test Reference Value" }];
  
  const mockExecutor = {
    where: () => mockData,
    then: (resolve: any) => Promise.resolve(mockData).then(resolve),
  };
  
  const mockFrom = {
    where: () => mockExecutor,
    then: (resolve: any) => Promise.resolve(mockData).then(resolve),
  };

  return {
    getDb: () => ({
      select: () => ({
        from: () => mockFrom,
      }),
    }),
  };
});

describe("Crew Import — Excel Template Generation", () => {
  it("should successfully generate a styled multi-sheet Excel template buffer", async () => {
    const buffer = await generateImportTemplate();
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

describe("Crew Import — Date Parser", () => {
  it("should parse standard dates and Excel serial values correctly", () => {
    expect(parseDate("2024-05-20")).toBe("2024-05-20");
    expect(parseDate("20/05/1996")).toBe("1996-05-20");
    expect(parseDate("20-May-1996")).toBe("1996-05-20");
    expect(parseDate("20-May-96")).toBe("1996-05-20");
    expect(parseDate(35204)).toBe("1996-05-19");
    expect(parseDate("35204")).toBe("1996-05-19");
    expect(parseDate(41062)).toBe("2012-06-02");
    expect(parseDate("41062")).toBe("2012-06-02");
  });

  it("should guard against invalid/overflow years", () => {
    expect(parseDate("31-Dec-35204")).toBeNull();
    expect(parseDate("31-Dec-41062")).toBeNull();
  });
});
