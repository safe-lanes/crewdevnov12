import { beforeEach, describe, expect, it, vi } from "vitest";
import { EffectivenessConfigurationError } from "@shared/appraisal-effectiveness";

const mocks = vi.hoisted(() => ({
  tx: { execute: vi.fn() },
  transaction: vi.fn(),
  forms: { lockById: vi.fn(), updateById: vi.fn() },
  versions: {
    findById: vi.fn(),
    findDraftByFormId: vi.fn(),
    findDraftByRankGroupId: vi.fn(),
    findByFormId: vi.fn(),
    findLatestReleasedByFormId: vi.fn(),
    findLatestReleasedByRankGroupId: vi.fn(),
    create: vi.fn(),
    updateById: vi.fn(),
  },
  copyStructure: vi.fn(),
  initializeParts: vi.fn(),
  validateStructure: vi.fn(),
  copyApplicability: vi.fn(),
  validateApplicability: vi.fn(),
  validateLifecycle: vi.fn(),
  recordReleaseChanges: vi.fn(),
}));

vi.mock("@server/v2/db", () => ({ getDb: () => ({ transaction: mocks.transaction }) }));
vi.mock("@server/v2/admin/repositories/formsRepository", () => ({
  FormsRepository: class { constructor() { return mocks.forms; } },
}));
vi.mock("@server/v2/admin/repositories/formVersionsRepository", () => ({
  FormVersionsRepository: class { constructor() { return mocks.versions; } },
}));
vi.mock("@server/v2/admin/repositories/rankGroupsRepository", () => ({ RankGroupsRepository: class {} }));
vi.mock("@server/v2/admin/services/formStructureService", () => ({
  copyFormVersionStructure: mocks.copyStructure,
  validatePersistedCompanyFormStructure: mocks.validateStructure,
}));
vi.mock("@server/v2/admin/repositories/formStructureRepository", () => ({
  formStructureRepository: { initializePartsFromTemplates: mocks.initializeParts },
}));
vi.mock("@server/v2/admin/services/applicabilityService", () => ({
  copyApplicability: mocks.copyApplicability,
  validateApplicabilityRelease: mocks.validateApplicability,
}));
vi.mock("@server/v2/company-forms/lifecyclePolicy", () => ({
  validatePersistedCompanyFormLifecycle: mocks.validateLifecycle,
}));
vi.mock("@server/v2/admin/services/versionChanges", () => ({
  enrichCompanyVersions: vi.fn(),
  recordReleaseChanges: mocks.recordReleaseChanges,
}));

import {
  CompanyFormArchivedError,
  FormStageValidationError,
  formsService,
} from "@server/v2/admin/services/formsService";

const validConfiguration = JSON.stringify({ effectivenessOptions: [{ id: "excellent", label: "6- Excellent" }] });
const invalidConfiguration = JSON.stringify({ effectivenessOptions: [{ id: "excellent", label: "Excellent" }] });
const draft = {
  id: 20, formId: 4, fvUuid: "draft-version", rankGroupId: 8,
  versionNo: "02", versionDate: "29-Oct-2026", status: "draft",
  stageKey: null, configuration: validConfiguration,
};
const companyForm = { id: 4, formUuid: "company-form", category: "dynamic", name: "Contract", subjectType: null };

describe("form version ratings and Company Form protections", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async (operation) => operation(mocks.tx));
    mocks.forms.lockById.mockResolvedValue({ id: 4, category: "appraisal" });
    mocks.versions.findById.mockResolvedValue({ ...draft });
    mocks.versions.updateById.mockImplementation(async (_id, data) => ({ ...draft, ...data }));
    mocks.versions.create.mockImplementation(async (data) => ({ ...draft, ...data, fvUuid: "new-version" }));
    mocks.versions.findByFormId.mockResolvedValue([]);
    mocks.validateLifecycle.mockResolvedValue([]);
  });

  it("rejects invalid rating configuration before creating a draft", async () => {
    await expect(formsService.createVersionByFormId(4, {
      rankGroupId: 8, configuration: invalidConfiguration,
    } as any)).rejects.toBeInstanceOf(EffectivenessConfigurationError);
    expect(mocks.forms.lockById).toHaveBeenCalledWith(4, mocks.tx);
    expect(mocks.versions.create).not.toHaveBeenCalled();
    expect(mocks.versions.updateById).not.toHaveBeenCalled();
  });

  it("validates the existing configuration when an update omits configuration", async () => {
    mocks.versions.findById.mockResolvedValue({ ...draft, configuration: invalidConfiguration });
    await expect(formsService.updateVersionById(20, { versionDate: "28-Oct-2026" }))
      .rejects.toBeInstanceOf(EffectivenessConfigurationError);
    expect(mocks.versions.updateById).not.toHaveBeenCalled();
  });

  it("accepts a valid replacement configuration within the locked transaction", async () => {
    mocks.versions.findById.mockResolvedValue({ ...draft, configuration: invalidConfiguration });
    await formsService.updateVersionById(20, { configuration: validConfiguration });
    expect(mocks.tx.execute).toHaveBeenCalledOnce();
    expect(mocks.versions.updateById).toHaveBeenCalledWith(20,
      expect.objectContaining({ configuration: validConfiguration }), mocks.tx);
  });

  it("rejects release of an invalid rating configuration before updating any records", async () => {
    mocks.versions.findById.mockResolvedValue({ ...draft, configuration: invalidConfiguration });
    await expect(formsService.releaseVersionById(20)).rejects.toBeInstanceOf(EffectivenessConfigurationError);
    expect(mocks.versions.updateById).not.toHaveBeenCalled();
    expect(mocks.forms.updateById).not.toHaveBeenCalled();
  });

  it("still creates rankless Company Form drafts with copied structure and applicability", async () => {
    mocks.forms.lockById.mockResolvedValue(companyForm);
    const released = { ...draft, fvUuid: "released-version", versionNo: "01", status: "released" };
    mocks.versions.findByFormId.mockResolvedValue([released]);
    mocks.versions.findLatestReleasedByFormId.mockResolvedValue(released);
    await formsService.createVersionByFormId(4, { configuration: null } as any);
    expect(mocks.versions.create).toHaveBeenCalledWith(expect.objectContaining({
      rankGroupId: null, formId: 4, status: "draft", versionNo: "02",
    }), mocks.tx);
    expect(mocks.copyStructure).toHaveBeenCalledWith("released-version", "new-version", mocks.tx);
    expect(mocks.copyApplicability).toHaveBeenCalledWith("released-version", "new-version", mocks.tx);
  });

  it("retains Company Form release validation and atomic parent metadata updates", async () => {
    mocks.forms.lockById.mockResolvedValue(companyForm);
    mocks.versions.findByFormId.mockResolvedValue([{ ...draft, status: "released" }]);
    await formsService.releaseVersionById(20, "actor");
    expect(mocks.validateStructure).toHaveBeenCalledWith("draft-version", null, mocks.tx);
    expect(mocks.validateApplicability).toHaveBeenCalledWith("draft-version", mocks.tx);
    expect(mocks.validateLifecycle).toHaveBeenCalledWith(mocks.tx, "draft-version");
    expect(mocks.recordReleaseChanges).toHaveBeenCalledWith("draft-version", null, "actor", mocks.tx);
    expect(mocks.forms.updateById).toHaveBeenCalledWith(4, {
      versionNo: "02", versionDate: "29-Oct-2026",
    }, mocks.tx);
  });

  it("continues to reject edits to archived Company Forms", async () => {
    mocks.forms.lockById.mockResolvedValue({ ...companyForm, archivedAt: new Date() });
    await expect(formsService.updateVersionById(20, { configuration: validConfiguration }))
      .rejects.toBeInstanceOf(CompanyFormArchivedError);
    expect(mocks.versions.updateById).not.toHaveBeenCalled();
  });

  it("continues to reject ownership changes and released-stage changes", async () => {
    await expect(formsService.updateVersionById(20, { rankGroupId: 9 }))
      .rejects.toBeInstanceOf(FormStageValidationError);
    mocks.versions.findById.mockResolvedValue({ ...draft, status: "released" });
    await expect(formsService.updateVersionById(20, { stageKey: "joining" }))
      .rejects.toBeInstanceOf(FormStageValidationError);
    expect(mocks.versions.updateById).not.toHaveBeenCalled();
  });
});
