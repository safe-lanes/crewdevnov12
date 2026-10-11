import { describe, expect, it } from "vitest";
import { decideFirstService } from "../../server/v2/company-forms/subjects/crewAssignmentHistory";
const refs = [{ reference: "AB_1", rankUuid: "base-rank" }];
describe("company first-service deciding values", () => {
  it("counts relief and role variants through authoritative mappings", () => {
    const result = decideFirstService([{ sea_uuid: "relief", rank: "AB_1", from_date: "2025-01-01", service_type: "company" }], "base-rank", refs, "2026-10-11");
    expect(result.firstEver).toBe(false); expect(result.firstInRank).toBe(false);
  });
  it("does not count outside-company or future service", () => {
    const result = decideFirstService([{ sea_uuid: "outside", rank: "AB_1", from_date: "2020-01-01", service_type: "other" },
      { sea_uuid: "future", rank: "AB_1", from_date: "2027-01-01", service_type: "company" }], "base-rank", refs, "2026-10-11");
    expect(result.firstEver).toBe(true); expect(result.firstInRank).toBe(true);
  });
  it("does not turn missing historical rank into first-in-rank", () => {
    const result = decideFirstService([{ sea_uuid: "unknown", rank: "AB_2", from_date: "2025-01-01", service_type: "company" }], "base-rank", refs, "2026-10-11");
    expect(result.firstEver).toBe(false); expect(result.firstInRank).toBeNull();
  });
  it("shows same-day ordering ambiguity instead of counting the current contract", () => {
    expect(decideFirstService([{ sea_uuid: "same-day", rank: "AB_1", from_date: "2026-10-11", service_type: "company" }], "base-rank", refs, "2026-10-11").firstEver).toBeNull();
  });
});
