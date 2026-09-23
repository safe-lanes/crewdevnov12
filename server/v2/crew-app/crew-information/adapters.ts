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
  crewCertificatesService,
  crewDocumentsService,
  crewEducationService,
  crewMembersService,
  crewProfileService,
  crewSeaServiceService,
  crewVisasService,
} from "../../crew-pool/services";
import { CrewLicensesRepository, CrewTrainingRepository } from "../../crew-pool/repositories";
import { fileStorageService } from "../../shared/fileStorageService";

const licensesRepository = new CrewLicensesRepository();
const trainingRepository = new CrewTrainingRepository();

// Extracted from crew-information/controller.ts so both the crew-facing
// staging path (pendingChangesService) and the office-side review "apply"
// step (server/v2/crewAppReview) call the exact same create/update/remove
// functions — one place that knows how a crew-app section maps onto the
// canonical crew-pool services, no duplicated business logic.

const mobileAuditFields = {
  createdByUuid: true,
  updatedByUuid: true,
  isDeleted: true,
  isSync: true,
} as const;

export const particularsSchema = z.object({
  firstName: z.string().trim().min(1).max(200).optional(),
  middleName: z.string().trim().max(200).nullable().optional(),
  familyName: z.string().trim().min(1).max(200).optional(),
  gender: z.string().trim().max(100).nullable().optional(),
  dob: z.string().trim().max(30).nullable().optional(),
  nationality: z.string().trim().min(1).max(200).optional(),
  nationalityUuid: z.string().trim().min(1).max(200).nullable().optional(),
  vesselTypeUuid: z.string().trim().min(1).max(200).nullable().optional(),
}).strict();

export const personalSchema = insertCrewPersonalDetailsSchema.omit({
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

export const contactSchema = insertCrewAddressSchema.omit({
  addrUuid: true,
  crewUuid: true,
  ...mobileAuditFields,
}).extend({
  countryOfResidence: z.string().trim().min(1).max(200).optional(),
}).strict();

export const familyInfoSchema = insertCrewFamilyInfoSchema.omit({
  famUuid: true,
  crewUuid: true,
  ...mobileAuditFields,
}).strict();
export const nextOfKinSchema = insertCrewNextOfKinSchema.omit({
  nokUuid: true,
  crewUuid: true,
  ...mobileAuditFields,
}).strict();
export const childDataSchema = insertCrewChildSchema.omit({
  childUuid: true,
  crewUuid: true,
  ...mobileAuditFields,
}).strict();
export const vesselTypesSchema = z.object({
  vesselTypeUuids: z.array(z.string().trim().min(1).max(200)).max(100),
}).strict();

export const collectionSchemas = {
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

export type CollectionName = keyof typeof collectionSchemas;

export function isCollectionName(value: string): value is CollectionName {
  return Object.prototype.hasOwnProperty.call(collectionSchemas, value);
}

export interface CollectionAdapter {
  primaryKey: string;
  list: (crewUuid: string) => Promise<any[]>;
  get: (recordUuid: string, crewUuid: string) => Promise<any>;
  create: (crewUuid: string, data: any) => Promise<any>;
  update: (recordUuid: string, data: any) => Promise<any>;
  remove: (recordUuid: string) => Promise<any>;
}

export const collections: Record<CollectionName, CollectionAdapter> = {
  children: {
    primaryKey: "childUuid",
    list: crewUuid => crewProfileService.getChildren(crewUuid),
    get: async (recordUuid) => {
      const child = await crewProfileService.getChildByUuid(recordUuid);
      if (!child) throw new Error("Child not found");
      return child;
    },
    create: (crewUuid, data) => crewProfileService.createChild(crewUuid, data),
    update: (recordUuid, data) => crewProfileService.updateChild(recordUuid, data),
    remove: recordUuid => crewProfileService.deleteChild(recordUuid),
  },
  documents: {
    primaryKey: "docUuid",
    list: crewUuid => crewDocumentsService.getAll(crewUuid),
    get: recordUuid => crewDocumentsService.getByUuid(recordUuid),
    create: (crewUuid, data) => crewDocumentsService.create(crewUuid, data),
    update: (recordUuid, data) => crewDocumentsService.update(recordUuid, data),
    remove: recordUuid => crewDocumentsService.delete(recordUuid),
  },
  visas: {
    primaryKey: "visaUuid",
    list: crewUuid => crewVisasService.getAll(crewUuid),
    get: recordUuid => crewVisasService.getByUuid(recordUuid),
    create: (crewUuid, data) => crewVisasService.create(crewUuid, data),
    update: (recordUuid, data) => crewVisasService.update(recordUuid, data),
    remove: recordUuid => crewVisasService.delete(recordUuid),
  },
  education: {
    primaryKey: "eduUuid",
    list: crewUuid => crewEducationService.getAll(crewUuid),
    get: recordUuid => crewEducationService.getByUuid(recordUuid),
    create: (crewUuid, data) => crewEducationService.create(crewUuid, data),
    update: (recordUuid, data) => crewEducationService.update(recordUuid, data),
    remove: recordUuid => crewEducationService.delete(recordUuid),
  },
  licenses: {
    primaryKey: "licUuid",
    list: crewUuid => crewCertificatesService.getLicenses(crewUuid),
    get: recordUuid => crewCertificatesService.getLicenseByUuid(recordUuid),
    create: (crewUuid, data) => crewCertificatesService.createLicense(crewUuid, data),
    update: (recordUuid, data) => crewCertificatesService.updateLicense(recordUuid, data),
    remove: recordUuid => crewCertificatesService.deleteLicense(recordUuid),
  },
  training: {
    primaryKey: "trainUuid",
    list: crewUuid => crewCertificatesService.getTraining(crewUuid),
    get: recordUuid => crewCertificatesService.getTrainingByUuid(recordUuid),
    create: (crewUuid, data) => crewCertificatesService.createTraining(crewUuid, data),
    update: (recordUuid, data) => crewCertificatesService.updateTraining(recordUuid, data),
    remove: recordUuid => crewCertificatesService.deleteTraining(recordUuid),
  },
  "sea-service": {
    primaryKey: "seaUuid",
    list: crewUuid => crewSeaServiceService.getAll(crewUuid),
    get: recordUuid => crewSeaServiceService.getByUuid(recordUuid),
    create: (crewUuid, data) => crewSeaServiceService.create(crewUuid, { ...data, serviceType: "external" }),
    update: (recordUuid, data) => crewSeaServiceService.update(recordUuid, data),
    remove: recordUuid => crewSeaServiceService.delete(recordUuid),
  },
};

// Attachment add/remove functions per collection, keyed the same as
// `collections` above — used by both attachmentController.ts (live path for
// an already-canonical parent) and the office-review apply step (linking a
// pending create's staged_attachments once the canonical record exists).
export const attachmentAdapters: Partial<Record<CollectionName, {
  add: (parentUuid: string, file: any) => Promise<any>;
  remove: (attUuid: string) => Promise<void>;
}>> = {
  documents: { add: crewDocumentsService.addAttachment.bind(crewDocumentsService), remove: crewDocumentsService.removeAttachment.bind(crewDocumentsService) },
  visas: { add: crewVisasService.addAttachment.bind(crewVisasService), remove: crewVisasService.removeAttachment.bind(crewVisasService) },
  education: { add: crewEducationService.addAttachment.bind(crewEducationService), remove: crewEducationService.removeAttachment.bind(crewEducationService) },
  licenses: { add: crewCertificatesService.addLicenseAttachment.bind(crewCertificatesService), remove: crewCertificatesService.removeLicenseAttachment.bind(crewCertificatesService) },
  training: { add: crewCertificatesService.addTrainingAttachment.bind(crewCertificatesService), remove: crewCertificatesService.removeTrainingAttachment.bind(crewCertificatesService) },
  "sea-service": { add: crewSeaServiceService.addAttachment.bind(crewSeaServiceService), remove: crewSeaServiceService.removeAttachment.bind(crewSeaServiceService) },
};

export function isReadonlyCollectionRecord(name: CollectionName, row: any): boolean {
  return (name === "sea-service" && row?.serviceType === "company") ||
    (name === "licenses" && Boolean(row?.archivedAt));
}

// Per-collection attachment listing, for the delete-cleanup helper below.
// licenses/training go through the repository directly (mirrors
// attachmentsByCollection in the pre-staging controller.ts) since those two
// services don't expose a getAttachments() of their own.
const listAttachments: Partial<Record<CollectionName, (recordUuid: string) => Promise<any[]>>> = {
  documents: recordUuid => crewDocumentsService.getAttachments(recordUuid),
  visas: recordUuid => crewVisasService.getAttachments(recordUuid),
  education: recordUuid => crewEducationService.getAttachments(recordUuid),
  licenses: recordUuid => licensesRepository.findAttachmentsByLicUuid(recordUuid),
  training: recordUuid => trainingRepository.findAttachmentsByTrainUuid(recordUuid),
  "sea-service": recordUuid => crewSeaServiceService.getAttachments(recordUuid),
};

/** Deletes a collection record and its stored attachment files — same cleanup collectionHandler's DELETE branch used to do inline. */
export async function removeRecordAndAttachments(name: CollectionName, recordUuid: string): Promise<void> {
  const listFn = listAttachments[name];
  const attachments = listFn ? await listFn(recordUuid) : [];
  await collections[name].remove(recordUuid);
  await Promise.all(attachments.map((attachment: any) => {
    const path = attachment?.filePath;
    return path && !path.startsWith("data:") ? fileStorageService.deleteAttachment(path) : Promise.resolve();
  }));
}

// Singleton profile sections (one row per crew member, upsert semantics —
// there is no separate "create").
export type SingletonSection = "particulars" | "personal" | "contact" | "family" | "next-of-kin" | "vessel-types";

export const singletonSchemas: Record<SingletonSection, z.ZodTypeAny> = {
  particulars: particularsSchema,
  personal: personalSchema,
  contact: contactSchema,
  family: familyInfoSchema,
  "next-of-kin": nextOfKinSchema,
  "vessel-types": vesselTypesSchema,
};

export function isSingletonSection(value: string): value is SingletonSection {
  return Object.prototype.hasOwnProperty.call(singletonSchemas, value);
}

/** Fetches a section's current field values (for the office-review page to diff against a pending payload). Returns null when there's nothing to compare against (unknown record, section, or lookup failure). */
export async function getCurrentValues(section: string, crewUuid: string, targetUuid: string | null): Promise<Record<string, any> | null> {
  try {
    if (isSingletonSection(section)) {
      switch (section) {
        case "particulars":
          return await crewMembersService.getByUuid(crewUuid);
        case "personal":
          return (await crewProfileService.getPersonalDetails(crewUuid)) ?? null;
        case "contact":
          return (await crewProfileService.getAddress(crewUuid)) ?? null;
        case "family":
          return (await crewProfileService.getFamilyInfo(crewUuid)) ?? null;
        case "next-of-kin":
          return (await crewProfileService.getNextOfKin(crewUuid)) ?? null;
        case "vessel-types": {
          const rows = await crewProfileService.getVesselTypes(crewUuid);
          return {
            vesselTypeUuids: rows.map((r: any) => r.vesselTypeUuid),
            vesselTypeNames: rows.map((r: any) => r.resolvedVesselTypeName ?? r.vesselTypeUuid),
          };
        }
        default:
          return null;
      }
    }
    if (isCollectionName(section) && targetUuid) {
      return (await collections[section].get(targetUuid, crewUuid)) ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

export async function applySingletonSection(section: SingletonSection, crewUuid: string, body: any): Promise<any> {
  switch (section) {
    case "particulars": {
      const { nationality, ...core } = body;
      return crewMembersService.update(crewUuid, { ...core, ...(nationality ? { nationality } : {}) } as any);
    }
    case "personal":
      return crewProfileService.upsertPersonalDetails(crewUuid, body as any);
    case "contact":
      return crewProfileService.upsertAddress(crewUuid, body as any);
    case "family":
      return crewProfileService.upsertFamilyInfo(crewUuid, body as any);
    case "next-of-kin":
      return crewProfileService.upsertNextOfKin(crewUuid, body as any);
    case "vessel-types":
      return crewProfileService.syncVesselTypes(crewUuid, body.vesselTypeUuids);
    default:
      throw Object.assign(new Error("Unknown section"), { status: 404 });
  }
}
