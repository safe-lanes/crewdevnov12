// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { loadCatalogs } from "../../server/v2/recruitment/import/catalogs";
const mocks = vi.hoisted(() => ({
  licenses: vi.fn(async () => [{ id: "internal-uuid", entryId: "LIC007", name: "Chief Engineer", shortCode: "CE", description: "Master default" }]),
  training: vi.fn(async () => [{ id: 197, trainingMasterId: 92, companyId: "SAF029", trainingLabel: "Company Safety Induction", abr: "CSI", requirement: "Company requirement" }]),
}));
vi.mock("../../server/v2/db", () => ({ getDb: () => ({
  select: () => ({ from: () => ({ where: async () => [] }) }),
}) }));
vi.mock("../../server/v2/masters/repositories/mastersRepository", () => ({
  MastersRepository: class { findAllLicensesDce = mocks.licenses; },
}));
vi.mock("../../server/v2/admin/repositories/companyTrainingsRepository", () => ({
  CompanyTrainingsRepository: class { findAll = mocks.training; },
}));

describe("Recruitment Excel certificate catalog sources", () => {
  it("reuses the live web-selection repositories with business IDs and the same two dependent defaults", async () => {
    const catalogs = await loadCatalogs();
    expect(mocks.licenses).toHaveBeenCalledOnce();
    expect(mocks.training).toHaveBeenCalledOnce();
    expect(catalogs.licenses).toEqual([{ label: "Chief Engineer", value: "LIC007", abbr: "CE", requirement: "Master default" }]);
    expect(catalogs.training).toEqual([{ label: "Company Safety Induction", value: "SAF029", abbr: "CSI", requirement: "Company requirement" }]);
  });
  it("propagates catalog failures instead of silently substituting a static list", async () => {
    mocks.licenses.mockRejectedValueOnce(new Error("Catalog unavailable"));
    await expect(loadCatalogs()).rejects.toThrow("Catalog unavailable");
  });
});
