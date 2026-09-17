import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { readFileSync } from "node:fs";
import express from "express";
import supertest from "supertest";

const mocks = vi.hoisted(() => ({
  findCredential: vi.fn(),
  getCrew: vi.fn(),
  getFullProfile: vi.fn(),
  upsertPersonal: vi.fn(),
  getDocuments: vi.fn(),
  createDocument: vi.fn(),
  getDocument: vi.fn(),
  updateDocument: vi.fn(),
  deleteDocument: vi.fn(),
  getVisas: vi.fn(),
  getEducation: vi.fn(),
  getLicenses: vi.fn(),
  getLicense: vi.fn(),
  updateLicense: vi.fn(),
  getTraining: vi.fn(),
  getSeaService: vi.fn(),
  getSeaServiceRecord: vi.fn(),
  updateSeaService: vi.fn(),
  getMedicals: vi.fn(),
  getDoctorVisits: vi.fn(),
  getBriefings: vi.fn(),
  getDebriefings: vi.fn(),
  addDocumentAttachment: vi.fn(),
  removeDocumentAttachment: vi.fn(),
}));

vi.mock("@server/v2/crew-app/auth", () => ({
  crewAuthMiddleware: (req: Request, _res: Response, next: NextFunction) => {
    req.crewUser = {
      credentialId: 7,
      crewUuid: "11111111-1111-4111-8111-111111111111",
      domain: "tenant.example.com",
      userType: "Crew",
    };
    next();
  },
  requireCrewPasswordReset: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock("@server/v2/crew-app/auth/repositories/crewCredentialsRepository", () => ({
  CrewCredentialsRepository: class {
    findById = mocks.findCredential;
  },
}));

vi.mock("@server/v2/crew-pool/services", () => ({
  crewMembersService: {
    getByUuid: mocks.getCrew,
    update: vi.fn(),
  },
  crewProfileService: {
    getFullProfile: mocks.getFullProfile,
    getChildren: vi.fn(),
    getFamilyInfo: vi.fn(),
    upsertPersonalDetails: mocks.upsertPersonal,
    upsertAddress: vi.fn(),
    upsertFamilyInfo: vi.fn(),
    upsertNextOfKin: vi.fn(),
    updateChild: vi.fn(),
    createChild: vi.fn(),
    deleteChild: vi.fn(),
    syncVesselTypes: vi.fn(),
  },
  crewDocumentsService: {
    getAll: mocks.getDocuments,
    create: mocks.createDocument,
    getByUuid: mocks.getDocument,
    update: mocks.updateDocument,
    delete: mocks.deleteDocument,
    addAttachment: mocks.addDocumentAttachment,
    removeAttachment: mocks.removeDocumentAttachment,
  },
  crewVisasService: {
    getAll: mocks.getVisas,
    create: vi.fn(),
    getByUuid: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    addAttachment: vi.fn(),
    removeAttachment: vi.fn(),
  },
  crewEducationService: {
    getAll: mocks.getEducation,
    create: vi.fn(),
    getByUuid: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    addAttachment: vi.fn(),
    removeAttachment: vi.fn(),
  },
  crewCertificatesService: {
    getLicenses: mocks.getLicenses,
    createLicense: vi.fn(),
    getLicenseByUuid: mocks.getLicense,
    updateLicense: mocks.updateLicense,
    deleteLicense: vi.fn(),
    addLicenseAttachment: vi.fn(),
    removeLicenseAttachment: vi.fn(),
    getTraining: mocks.getTraining,
    createTraining: vi.fn(),
    getTrainingByUuid: vi.fn(),
    updateTraining: vi.fn(),
    deleteTraining: vi.fn(),
    addTrainingAttachment: vi.fn(),
    removeTrainingAttachment: vi.fn(),
  },
  crewSeaServiceService: {
    getAll: mocks.getSeaService,
    create: vi.fn(),
    getByUuid: mocks.getSeaServiceRecord,
    update: mocks.updateSeaService,
    delete: vi.fn(),
    addAttachment: vi.fn(),
    removeAttachment: vi.fn(),
  },
  crewMedicalService: {
    getMedicals: mocks.getMedicals,
    getDoctorVisits: mocks.getDoctorVisits,
  },
  crewBriefingService: {
    getBriefings: mocks.getBriefings,
    getDebriefings: mocks.getDebriefings,
  },
}));

import {
  collectionHandler,
  getInformation,
  sanitize,
} from "@server/v2/crew-app/crew-information/controller";
import { requireCurrentCrew } from "@server/v2/crew-app/crew-information/crewInformationGuard";
import crewInformationRoutes from "@server/v2/crew-app/crew-information/routes";

function response() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    send: vi.fn(),
  } as unknown as Response;
  vi.mocked(res.status).mockReturnValue(res);
  vi.mocked(res.json).mockReturnValue(res);
  vi.mocked(res.send).mockReturnValue(res);
  return res;
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    method: "GET",
    params: {},
    body: {},
    crewUser: {
      credentialId: 7,
      crewUuid: "11111111-1111-4111-8111-111111111111",
      domain: "tenant.example.com",
      userType: "Crew",
    },
    ...overrides,
  } as unknown as Request;
}

describe("crew-information self-service contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findCredential.mockResolvedValue({
      id: 7,
      crewUuid: "11111111-1111-4111-8111-111111111111",
      domain: "tenant.example.com",
      userType: "Crew",
      isActive: true,
      isDeleted: false,
    });
    mocks.getCrew.mockResolvedValue({
      id: 12,
      crewUuid: "11111111-1111-4111-8111-111111111111",
      empNo: "EMP-7",
      isActive: true,
      isDeleted: false,
    });
    mocks.getFullProfile.mockResolvedValue({
      crew: { id: 12, crewUuid: "11111111-1111-4111-8111-111111111111", empNo: "EMP-7" },
      currentAssignment: null,
      personalDetails: null,
      address: null,
      family: { info: null, children: [], nextOfKin: null },
      vesselTypes: [],
    });
    for (const mock of [
      mocks.getDocuments, mocks.getVisas, mocks.getEducation, mocks.getLicenses,
      mocks.getTraining, mocks.getSeaService, mocks.getMedicals,
      mocks.getDoctorVisits, mocks.getBriefings, mocks.getDebriefings,
    ]) mock.mockResolvedValue([]);
    mocks.upsertPersonal.mockResolvedValue({ cpdUuid: "personal-1", heightCm: "180" });
    mocks.createDocument.mockResolvedValue({
      docUuid: "doc-created",
      crewUuid: "11111111-1111-4111-8111-111111111111",
      documentName: "Passport",
    });
    mocks.getDocument.mockResolvedValue({
      docUuid: "doc-1",
      crewUuid: "11111111-1111-4111-8111-111111111111",
      documentName: "Passport",
    });
    mocks.updateDocument.mockResolvedValue({
      docUuid: "doc-1",
      crewUuid: "11111111-1111-4111-8111-111111111111",
      documentName: "Updated",
    });
  });

  it("mounts only self-scoped routes behind all crew-app guards", () => {
    const routes = readFileSync("server/v2/crew-app/crew-information/routes.ts", "utf8");
    expect(routes).toContain("crewAuthMiddleware");
    expect(routes).toContain("requireCrewPasswordReset");
    expect(routes).toContain("requireCurrentCrew");
    expect(routes).toContain("const auth = [crewAuthMiddleware, requireCurrentCrew, requireCrewPasswordReset]");
    expect(routes).not.toMatch(/:crewUuid|req\.(body|query)\.crewUuid/);
    expect(routes).toContain('"particulars", "personal", "contact", "family", "next-of-kin", "vessel-types"');
  });

  it("binds literal singleton and collection URLs to controller parameters", async () => {
    const app = express();
    app.use(express.json());
    app.use(crewInformationRoutes);

    await supertest(app).put("/personal").send({ heightCm: "180" }).expect(200);
    expect(mocks.upsertPersonal).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      expect.objectContaining({ heightCm: "180" }),
    );

    await supertest(app).get("/documents").expect(200, []);
    await supertest(app).post("/documents").send({ documentName: "Passport" }).expect(201);
    await supertest(app).patch("/documents/doc-1").send({ documentName: "Updated" }).expect(200);
    await supertest(app).delete("/documents/doc-1").expect(204);
    expect(mocks.getDocuments).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
    expect(mocks.createDocument).toHaveBeenCalled();
    expect(mocks.updateDocument).toHaveBeenCalledWith("doc-1", expect.objectContaining({ documentName: "Updated" }));
    expect(mocks.deleteDocument).toHaveBeenCalledWith("doc-1");
  });

  it("revalidates live credential identity and linked crew state", async () => {
    const res = response();
    const next = vi.fn() as unknown as NextFunction;
    await requireCurrentCrew(request(), res, next);
    expect(next).toHaveBeenCalledOnce();

    mocks.findCredential.mockResolvedValueOnce({
      id: 7,
      crewUuid: "different-crew",
      domain: "tenant.example.com",
      userType: "Crew",
      isActive: true,
      isDeleted: false,
    });
    await requireCurrentCrew(request(), res, next);
    expect(res.status).toHaveBeenLastCalledWith(401);

    await requireCurrentCrew(request({
      crewUser: {
        credentialId: 7,
        crewUuid: "11111111-1111-4111-8111-111111111111",
        domain: "other.example.com",
        userType: "Crew",
      },
    }), res, next);
    expect(res.status).toHaveBeenLastCalledWith(401);

    mocks.getCrew.mockResolvedValueOnce({
      crewUuid: "11111111-1111-4111-8111-111111111111",
      isActive: false,
      isDeleted: false,
    });
    await requireCurrentCrew(request(), res, next);
    expect(res.status).toHaveBeenLastCalledWith(403);

    await requireCurrentCrew(request({
      crewUser: {
        credentialId: 7,
        crewUuid: "11111111-1111-4111-8111-111111111111",
        domain: "tenant.example.com",
        userType: "Admin",
      },
    }), res, next);
    expect(res.status).toHaveBeenLastCalledWith(403);
  });

  it("returns every section without server IDs, crew UUIDs, or storage fields", async () => {
    mocks.getMedicals.mockResolvedValue([{ id: 3, crewUuid: "secret", medUuid: "med-1", filePath: "/private" }]);
    const res = response();
    await getInformation(request(), res);
    const payload = vi.mocked(res.json).mock.calls[0][0] as any;
    expect(Object.keys(payload.sections)).toEqual(expect.arrayContaining([
      "particulars", "assignment", "personal", "contact", "family", "vesselTypes",
      "travelDocuments", "visas", "education", "licenses", "training",
      "seaService", "medicals", "doctorVisits", "briefings", "debriefings",
    ]));
    expect(payload.sections.particulars).toEqual({ empNo: "EMP-7" });
    expect(payload.sections.medicals[0]).toEqual({ medUuid: "med-1", readOnly: true });
    expect(payload.permissions.attachments).toBe(true);
    expect(payload.permissions.attachmentRules).toEqual(expect.objectContaining({
      allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg"],
      maxBytes: 5 * 1024 * 1024,
    }));
  });

  it("lists only attachments nested under an owned parent and never returns storage data", async () => {
    mocks.getDocuments.mockResolvedValue([{
      docUuid: "doc-1",
      crewUuid: "11111111-1111-4111-8111-111111111111",
      attachments: [{
        attUuid: "att-1",
        fileName: "passport.pdf",
        fileType: "application/pdf",
        fileSize: "123",
        filePath: "tenant/private/passport.pdf",
        fileData: "secret",
        createdAt: new Date("2026-09-17T00:00:00.000Z"),
      }],
    }]);
    const app = express();
    app.use(crewInformationRoutes);

    const owned = await supertest(app).get("/documents/doc-1/attachments").expect(200);
    expect(owned.body).toEqual([{
      attUuid: "att-1",
      fileName: "passport.pdf",
      fileType: "application/pdf",
      fileSize: "123",
      createdAt: "2026-09-17T00:00:00.000Z",
      canDelete: true,
    }]);
    expect(JSON.stringify(owned.body)).not.toMatch(/filePath|fileData|tenant\/private/);
    await supertest(app).get("/documents/doc-2/attachments").expect(404);
  });

  it("allows owned writable attachment deletion but rejects readonly sections", async () => {
    mocks.getDocuments.mockResolvedValue([{
      docUuid: "doc-1",
      crewUuid: "11111111-1111-4111-8111-111111111111",
      attachments: [{ attUuid: "att-1", fileName: "passport.pdf" }],
    }]);
    mocks.getMedicals.mockResolvedValue([{
      medUuid: "med-1",
      crewUuid: "11111111-1111-4111-8111-111111111111",
      attachments: [{ attUuid: "att-med", fileName: "medical.pdf" }],
    }]);
    const app = express();
    app.use(crewInformationRoutes);

    await supertest(app).delete("/documents/doc-1/attachments/att-1").expect(204);
    expect(mocks.removeDocumentAttachment).toHaveBeenCalledWith("att-1");
    await supertest(app).delete("/medicals/med-1/attachments/att-med").expect(403);
  });

  it("strictly rejects a client-supplied crew UUID before creating", async () => {
    const res = response();
    await collectionHandler(request({
      method: "POST",
      params: { collection: "documents" },
      body: { documentName: "Passport", crewUuid: "other-crew" },
    }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.createDocument).not.toHaveBeenCalled();
  });

  it("returns not found and never updates a foreign collection record", async () => {
    mocks.getDocument.mockResolvedValue({
      docUuid: "doc-1",
      crewUuid: "other-crew",
    });
    const res = response();
    await collectionHandler(request({
      method: "PATCH",
      params: { collection: "documents", uuid: "doc-1" },
      body: { documentName: "Changed" },
    }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mocks.updateDocument).not.toHaveBeenCalled();
  });

  it("keeps company sea service and archived licenses read-only", async () => {
    const res = response();
    mocks.getSeaServiceRecord.mockResolvedValue({
      seaUuid: "sea-1",
      crewUuid: "11111111-1111-4111-8111-111111111111",
      serviceType: "company",
    });
    await collectionHandler(request({
      method: "PATCH",
      params: { collection: "sea-service", uuid: "sea-1" },
      body: { vesselName: "Changed" },
    }), res);
    expect(res.status).toHaveBeenLastCalledWith(409);
    expect(mocks.updateSeaService).not.toHaveBeenCalled();

    mocks.getLicense.mockResolvedValue({
      licUuid: "lic-1",
      crewUuid: "11111111-1111-4111-8111-111111111111",
      archivedAt: new Date(),
    });
    await collectionHandler(request({
      method: "PATCH",
      params: { collection: "licenses", uuid: "lic-1" },
      body: { certificateDocument: "Changed" },
    }), res);
    expect(res.status).toHaveBeenLastCalledWith(409);
    expect(mocks.updateLicense).not.toHaveBeenCalled();
  });

  it("preserves business identifiers while removing internal fields", () => {
    expect(sanitize({
      id: 4,
      crewUuid: "crew-secret",
      createdByUuid: "user-secret",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      archivedAt: new Date("2026-01-03T00:00:00.000Z"),
      uploadedPhoto: "/private/photo.jpg",
      documentId: "P123",
      courseId: "SC001",
      licenseId: "LIC001",
      country: "India",
      vesselUuid: "vessel-uuid",
      filePath: "/private/a",
      attachmentRef: "private-ref",
      attachments: [{ id: 9 }],
      name: "Crew",
    })).toEqual({
      documentId: "P123",
      courseId: "SC001",
      licenseId: "LIC001",
      country: "India",
      vesselUuid: "vessel-uuid",
      name: "Crew",
    });
  });
});