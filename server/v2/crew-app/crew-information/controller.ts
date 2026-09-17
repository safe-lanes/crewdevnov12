import { Request, Response } from "express";
import { z } from "zod";
import {
  insertCrewAddressSchema,
  insertCrewChildSchema,
  insertCrewDocumentSchema,
  insertCrewEducationSchema,
  insertCrewFamilyInfoSchema,
  insertCrewLicenseSchema,
  insertCrewNextOfKinSchema,
  insertCrewPersonalDetailsSchema,
  insertCrewSeaServiceSchema,
  insertCrewTrainingCourseSchema,
  insertCrewVisaSchema,
} from "../../../../shared/v2/crew-pool/types";
import {
  crewBriefingService,
  crewCertificatesService,
  crewDocumentsService,
  crewEducationService,
  crewMedicalService,
  crewMembersService,
  crewProfileService,
  crewSeaServiceService,
  crewVisasService,
} from "../../crew-pool/services";
import { MastersRepository } from "../../masters/repositories/mastersRepository";
import { fileStorageService } from "../../shared/fileStorageService";

const mastersRepository = new MastersRepository();

const mobileAuditFields = {
  createdByUuid: true,
  updatedByUuid: true,
  isDeleted: true,
  isSync: true,
} as const;

const particularsSchema = z.object({
  firstName: z.string().trim().min(1).max(200).optional(),
  middleName: z.string().trim().max(200).nullable().optional(),
  familyName: z.string().trim().min(1).max(200).optional(),
  gender: z.string().trim().max(100).nullable().optional(),
  dob: z.string().trim().max(30).nullable().optional(),
  nationality: z.string().trim().min(1).max(200).optional(),
  nationalityUuid: z.string().trim().min(1).max(200).nullable().optional(),
  vesselTypeUuid: z.string().trim().min(1).max(200).nullable().optional(),
}).strict();

const personalSchema = insertCrewPersonalDetailsSchema.omit({
  cpdUuid: true,
  crewUuid: true,
  ageInYears: true,
  manningAgent: true,
  crewPool: true,
  availability: true,
  nextAvailability: true,
  ...mobileAuditFields,
}).extend({
  placeOfBirthCountry: z.string().trim().min(1).max(200).optional(),
}).strict();

const contactSchema = insertCrewAddressSchema.omit({
  addrUuid: true,
  crewUuid: true,
  ...mobileAuditFields,
}).extend({
  countryOfResidence: z.string().trim().min(1).max(200).optional(),
}).strict();

const familyInfoSchema = insertCrewFamilyInfoSchema.omit({
  famUuid: true,
  crewUuid: true,
  ...mobileAuditFields,
}).strict();
const nextOfKinSchema = insertCrewNextOfKinSchema.omit({
  nokUuid: true,
  crewUuid: true,
  ...mobileAuditFields,
}).strict();
const childDataSchema = insertCrewChildSchema.omit({
  childUuid: true,
  crewUuid: true,
  ...mobileAuditFields,
}).strict();
const vesselTypesSchema = z.object({
  vesselTypeUuids: z.array(z.string().trim().min(1).max(200)).max(100),
}).strict();

const collectionSchemas = {
  children: childDataSchema,
  documents: insertCrewDocumentSchema.omit({
    docUuid: true,
    crewUuid: true,
    attachmentRef: true,
    ...mobileAuditFields,
  }).strict(),
  visas: insertCrewVisaSchema.omit({
    visaUuid: true,
    crewUuid: true,
    attachmentRef: true,
    ...mobileAuditFields,
  }).strict(),
  education: insertCrewEducationSchema.omit({
    eduUuid: true,
    crewUuid: true,
    attachmentRef: true,
    ...mobileAuditFields,
  }).strict(),
  licenses: insertCrewLicenseSchema.omit({
    licUuid: true,
    crewUuid: true,
    attachmentRef: true,
    archivedAt: true,
    ...mobileAuditFields,
  }).strict(),
  training: insertCrewTrainingCourseSchema.omit({
    trainUuid: true,
    crewUuid: true,
    attachmentRef: true,
    ...mobileAuditFields,
  }).strict(),
  "sea-service": insertCrewSeaServiceSchema.omit({
    seaUuid: true,
    crewUuid: true,
    attachmentRef: true,
    serviceType: true,
    ...mobileAuditFields,
  }).strict(),
} as const;

type CollectionName = keyof typeof collectionSchemas;

interface CollectionAdapter {
  list: (crewUuid: string) => Promise<any[]>;
  get: (recordUuid: string, crewUuid: string) => Promise<any>;
  create: (crewUuid: string, data: any) => Promise<any>;
  update: (recordUuid: string, data: any) => Promise<any>;
  remove: (recordUuid: string) => Promise<any>;
}

const collections: Record<CollectionName, CollectionAdapter> = {
  children: {
    list: crewUuid => crewProfileService.getChildren(crewUuid),
    get: async (recordUuid, crewUuid) => {
      const children = await crewProfileService.getChildren(crewUuid);
      const child = children.find(row => row.childUuid === recordUuid);
      if (!child) throw new Error("Child not found");
      return child;
    },
    create: (crewUuid, data) => crewProfileService.createChild(crewUuid, data),
    update: (recordUuid, data) => crewProfileService.updateChild(recordUuid, data),
    remove: recordUuid => crewProfileService.deleteChild(recordUuid),
  },
  documents: {
    list: crewUuid => crewDocumentsService.getAll(crewUuid),
    get: recordUuid => crewDocumentsService.getByUuid(recordUuid),
    create: (crewUuid, data) => crewDocumentsService.create(crewUuid, data),
    update: (recordUuid, data) => crewDocumentsService.update(recordUuid, data),
    remove: recordUuid => crewDocumentsService.delete(recordUuid),
  },
  visas: {
    list: crewUuid => crewVisasService.getAll(crewUuid),
    get: recordUuid => crewVisasService.getByUuid(recordUuid),
    create: (crewUuid, data) => crewVisasService.create(crewUuid, data),
    update: (recordUuid, data) => crewVisasService.update(recordUuid, data),
    remove: recordUuid => crewVisasService.delete(recordUuid),
  },
  education: {
    list: crewUuid => crewEducationService.getAll(crewUuid),
    get: recordUuid => crewEducationService.getByUuid(recordUuid),
    create: (crewUuid, data) => crewEducationService.create(crewUuid, data),
    update: (recordUuid, data) => crewEducationService.update(recordUuid, data),
    remove: recordUuid => crewEducationService.delete(recordUuid),
  },
  licenses: {
    list: crewUuid => crewCertificatesService.getLicenses(crewUuid),
    get: recordUuid => crewCertificatesService.getLicenseByUuid(recordUuid),
    create: (crewUuid, data) => crewCertificatesService.createLicense(crewUuid, data),
    update: (recordUuid, data) => crewCertificatesService.updateLicense(recordUuid, data),
    remove: recordUuid => crewCertificatesService.deleteLicense(recordUuid),
  },
  training: {
    list: crewUuid => crewCertificatesService.getTraining(crewUuid),
    get: recordUuid => crewCertificatesService.getTrainingByUuid(recordUuid),
    create: (crewUuid, data) => crewCertificatesService.createTraining(crewUuid, data),
    update: (recordUuid, data) => crewCertificatesService.updateTraining(recordUuid, data),
    remove: recordUuid => crewCertificatesService.deleteTraining(recordUuid),
  },
  "sea-service": {
    list: crewUuid => crewSeaServiceService.getAll(crewUuid),
    get: recordUuid => crewSeaServiceService.getByUuid(recordUuid),
    create: (crewUuid, data) => crewSeaServiceService.create(crewUuid, { ...data, serviceType: "external" }),
    update: (recordUuid, data) => crewSeaServiceService.update(recordUuid, data),
    remove: recordUuid => crewSeaServiceService.delete(recordUuid),
  },
};

/** Remove fields which can disclose server identity, storage, or audit internals. */
export function sanitize(value: any): any {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value instanceof Date) return value.toISOString();
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    const normalized = key.toLowerCase();
    if (normalized === "id" || normalized === "crewuuid" ||
        normalized === "filepath" || normalized === "filedata" ||
        normalized === "attachmentref" || normalized === "attachments" ||
        normalized === "createdbyuuid" || normalized === "updatedbyuuid" ||
        normalized === "createdat" || normalized === "updatedat" ||
        normalized === "archivedat" ||
        normalized === "uploadedphoto" || normalized === "isdeleted" ||
        normalized === "issync") continue;
    out[key] = sanitize(val);
  }
  return out;
}

function parse<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw Object.assign(new Error("Invalid request body"), {
      status: 400,
      details: result.error.flatten(),
    });
  }
  return result.data;
}

function sendError(res: Response, error: any): void {
  const status = error?.status ??
    (String(error?.message).toLowerCase().includes("not found") ? 404 : 400);
  res.status(status).json({
    error: status === 404 ? "not_found" : "invalid_request",
    message: error?.message || "Request failed",
    ...(error?.details ? { details: error.details } : {}),
  });
}

function readonlyRecord(row: any, readOnly: boolean): any {
  return { ...sanitize(row), readOnly };
}

function isReadonlyCollectionRecord(name: CollectionName, row: any): boolean {
  return (name === "sea-service" && row?.serviceType === "company") ||
    (name === "licenses" && Boolean(row?.archivedAt));
}

export async function getInformation(req: Request, res: Response): Promise<void> {
  try {
    const crewUuid = req.crewUser!.crewUuid;
    const [
      profile, documents, visas, education, licenses, training, seaService,
      medicals, doctorVisits, briefings, debriefings,
    ] = await Promise.all([
      crewProfileService.getFullProfile(crewUuid),
      crewDocumentsService.getAll(crewUuid),
      crewVisasService.getAll(crewUuid),
      crewEducationService.getAll(crewUuid),
      crewCertificatesService.getLicenses(crewUuid),
      crewCertificatesService.getTraining(crewUuid),
      crewSeaServiceService.getAll(crewUuid),
      crewMedicalService.getMedicals(crewUuid),
      crewMedicalService.getDoctorVisits(crewUuid),
      crewBriefingService.getBriefings(crewUuid),
      crewBriefingService.getDebriefings(crewUuid),
    ]);

    res.json({
      sections: {
        particulars: sanitize(profile.crew),
        assignment: profile.currentAssignment
          ? readonlyRecord(profile.currentAssignment, true)
          : null,
        personal: sanitize(profile.personalDetails) ?? null,
        contact: sanitize(profile.address) ?? null,
        family: sanitize(profile.family),
        vesselTypes: sanitize(profile.vesselTypes),
        travelDocuments: documents.map(row => readonlyRecord(row, false)),
        visas: visas.map(row => readonlyRecord(row, false)),
        education: education.map(row => readonlyRecord(row, false)),
        licenses: licenses.map(row => readonlyRecord(row, Boolean(row.archivedAt))),
        training: training.map(row => readonlyRecord(row, false)),
        seaService: seaService.map(row => readonlyRecord(row, row.serviceType === "company")),
        medicals: medicals.map(row => readonlyRecord(row, true)),
        doctorVisits: doctorVisits.map(row => readonlyRecord(row, true)),
        briefings: briefings.map(row => readonlyRecord(row, true)),
        debriefings: debriefings.map(row => readonlyRecord(row, true)),
      },
      permissions: {
        writableSingletons: ["particulars", "personal", "contact", "family", "next-of-kin", "vessel-types"],
        writableCollections: ["children", "documents", "visas", "education", "licenses", "training", "sea-service"],
        attachments: true,
        attachmentRules: {
          readableCollections: ["documents", "visas", "education", "licenses", "training", "sea-service", "medicals", "doctor-visits", "briefings", "debriefings"],
          writableCollections: ["documents", "visas", "education", "licenses", "training", "sea-service"],
          allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg"],
          maxBytes: 5 * 1024 * 1024,
        },
      },
    });
  } catch (error) {
    sendError(res, error);
  }
}

export async function getCrewInformationMasters(_req: Request, res: Response): Promise<void> {
  try {
    const definitions = [
      ["nationalities", "natUuid", ["nationality", "countryName"]],
      ["countries", "countryUuid", ["countryName"]],
      ["languages", "langUuid", ["languageName", "nativeName"]],
      ["vesselTypes", "vtUuid", ["vesselType"]],
      ["vessels", "vesselUuid", ["vessel"]],
    ] as const;
    const rows = await Promise.all(definitions.map(([type]) => mastersRepository.getMasterData(type)));
    const masters = Object.fromEntries(definitions.map(([type, valueKey, labelKeys], index) => [
      type,
      rows[index]
        .filter((row: any) => !row.isDeleted && row.isActive !== false)
        .map((row: any) => ({
          value: String(row[valueKey] ?? ""),
          label: String(labelKeys.map((key) => row[key]).find(Boolean) ?? ""),
        }))
        .filter((option) => option.value && option.label),
    ]));
    res.json(masters);
  } catch (error) {
    sendError(res, error);
  }
}

export async function updateSection(req: Request, res: Response): Promise<void> {
  try {
    const crewUuid = req.crewUser!.crewUuid;
    if (req.params.section === "particulars") {
      const body = parse(particularsSchema, req.body);
      const { nationality, ...core } = body;
      const crew = await crewMembersService.update(crewUuid, {
        ...core,
        ...(nationality ? { nationality } : {}),
      } as any);
      res.json(sanitize(crew));
      return;
    }
    if (req.params.section === "personal") {
      res.json(sanitize(await crewProfileService.upsertPersonalDetails(
        crewUuid,
        parse(personalSchema, req.body) as any,
      )));
      return;
    }
    if (req.params.section === "contact") {
      res.json(sanitize(await crewProfileService.upsertAddress(
        crewUuid,
        parse(contactSchema, req.body) as any,
      )));
      return;
    }
    if (req.params.section === "family") {
      res.json(sanitize(await crewProfileService.upsertFamilyInfo(
        crewUuid,
        parse(familyInfoSchema, req.body) as any,
      )));
      return;
    }
    if (req.params.section === "next-of-kin") {
      res.json(sanitize(await crewProfileService.upsertNextOfKin(
        crewUuid,
        parse(nextOfKinSchema, req.body) as any,
      )));
      return;
    }
    if (req.params.section === "vessel-types") {
      const body = parse(vesselTypesSchema, req.body);
      res.json(sanitize(await crewProfileService.syncVesselTypes(
        crewUuid,
        body.vesselTypeUuids,
      )));
      return;
    }
    res.status(404).json({ error: "not_found" });
  } catch (error) {
    sendError(res, error);
  }
}

function isCollectionName(value: string): value is CollectionName {
  return Object.prototype.hasOwnProperty.call(collections, value);
}

function collectionRecordUuid(name: CollectionName, row: any): string | undefined {
  const keys: Record<CollectionName, string> = {
    children: "childUuid",
    documents: "docUuid",
    visas: "visaUuid",
    education: "eduUuid",
    licenses: "licUuid",
    training: "trainUuid",
    "sea-service": "seaUuid",
  };
  return row?.[keys[name]];
}

export async function collectionHandler(req: Request, res: Response): Promise<void> {
  try {
    const name = req.params.collection;
    if (!isCollectionName(name)) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const adapter = collections[name];
    const crewUuid = req.crewUser!.crewUuid;

    if (req.method === "GET") {
      const rows = await adapter.list(crewUuid);
      res.json(rows.map(row => readonlyRecord(row, isReadonlyCollectionRecord(name, row))));
      return;
    }
    if (req.method === "POST") {
      const body = parse(collectionSchemas[name], req.body);
      const created = await adapter.create(crewUuid, body);
      res.status(201).json(readonlyRecord(created, false));
      return;
    }

    let target: any;
    try {
      target = await adapter.get(req.params.uuid, crewUuid);
    } catch {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (!target || target.crewUuid !== crewUuid) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (isReadonlyCollectionRecord(name, target)) {
      res.status(409).json({ error: "readonly_record" });
      return;
    }
    if (req.method === "DELETE") {
      const fullTarget = (await adapter.list(crewUuid)).find(
        (row) => collectionRecordUuid(name, row) === req.params.uuid,
      );
      await adapter.remove(req.params.uuid);
      await Promise.all((fullTarget?.attachments || []).map((attachment: any) => {
        const path = attachment?.filePath;
        return path && !path.startsWith("data:")
          ? fileStorageService.deleteAttachment(path)
          : Promise.resolve();
      }));
      res.status(204).send();
      return;
    }

    const body = parse(collectionSchemas[name].partial().strict(), req.body);
    res.json(readonlyRecord(await adapter.update(req.params.uuid, body), false));
  } catch (error) {
    sendError(res, error);
  }
}