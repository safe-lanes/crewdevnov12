import { v4 as uuidv4 } from "uuid";
import { eq, and, ilike } from "drizzle-orm";
import { getDb } from "../../db";
import { CrewMembersRepository } from "../repositories";
import {
  crewMembersV2,
  crewVesselTypesApplied,
  crewPersonalDetails,
  crewAddresses,
  crewFamilyInfo,
  crewChildren,
  crewNextOfKin,
  crewDocuments,
  crewDocumentsAttachments,
  crewVisas,
  crewVisasAttachments,
  crewEducation,
  crewEducationAttachments,
  crewLicenses,
  crewLicensesAttachments,
  crewTrainingCourses,
  crewTrainingAttachments,
  crewSeaService,
  crewSeaServiceAttachments,
} from "../../../../shared/v2/crew-pool/schema";
import type { InsertCrewMemberV2 } from "../../../../shared/v2/crew-pool/types";

import {
  candidateRepository,
  vesselTypesAppliedRepository,
} from "../../recruitment/repositories/candidateRepository";
import {
  personalDetailsRepository,
  addressRepository,
  familyInfoRepository,
  childrenRepository,
  nextOfKinRepository,
} from "../../recruitment/repositories/profileRepository";
import {
  documentsRepository,
  documentAttachmentsRepository,
  visasRepository,
  visaAttachmentsRepository,
  educationRepository,
  educationAttachmentsRepository,
  licensesRepository,
  licenseAttachmentsRepository,
  trainingCoursesRepository,
  trainingAttachmentsRepository,
  seaServiceRepository,
  seaServiceAttachmentsRepository,
} from "../../recruitment/repositories/documentsRepository";

const crewMembersRepository = new CrewMembersRepository();

interface TransferResult {
  success: boolean;
  crewUuid: string;
  empNo: string;
  status: string;
  transferredAt: string;
  counts: {
    vesselTypes: number;
    documents: number;
    visas: number;
    education: number;
    licenses: number;
    trainingCourses: number;
    seaService: number;
  };
}

interface TransferOptions {
  empNo?: string;
  crewPool?: string;
  availability?: string;
  status?: string;
  auditUserUuid?: string;
}

async function generateEmpNo(): Promise<string> {
  const db = getDb();
  const results = await db
    .select({ empNo: crewMembersV2.empNo })
    .from(crewMembersV2)
    .where(ilike(crewMembersV2.empNo, "A%"));

  let maxNum = 0;
  for (const row of results) {
    if (row.empNo) {
      const match = row.empNo.match(/A(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) {
          maxNum = num;
        }
      }
    }
  }

  const nextNum = maxNum + 1;
  return `A${nextNum.toString().padStart(6, "0")}`;
}

async function generateLicenseId(): Promise<string> {
  const db = getDb();
  const results = await db
    .select({ licenseId: crewLicenses.licenseId })
    .from(crewLicenses)
    .where(ilike(crewLicenses.licenseId, "LIC%"));

  let maxNum = 0;
  for (const row of results) {
    if (row.licenseId) {
      const match = row.licenseId.match(/LIC(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) {
          maxNum = num;
        }
      }
    }
  }

  const nextNum = maxNum + 1;
  return `LIC${nextNum.toString().padStart(3, "0")}`;
}

async function generateCourseId(): Promise<string> {
  const db = getDb();
  const results = await db
    .select({ courseId: crewTrainingCourses.courseId })
    .from(crewTrainingCourses)
    .where(ilike(crewTrainingCourses.courseId, "SC%"));

  let maxNum = 0;
  for (const row of results) {
    if (row.courseId) {
      const match = row.courseId.match(/SC(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) {
          maxNum = num;
        }
      }
    }
  }

  const nextNum = maxNum + 1;
  return `SC${nextNum.toString().padStart(3, "0")}`;
}

export const crewTransferService = {
  async transferFromRecruitment(
    recCanUuid: string,
    options: TransferOptions = {}
  ): Promise<TransferResult> {
    const db = getDb();

    const candidate = await candidateRepository.findByUuid(recCanUuid);
    if (!candidate) {
      throw new Error(`Candidate not found: ${recCanUuid}`);
    }

    if (
      candidate.status !== "Hired" &&
      candidate.status !== "Approved" &&
      candidate.status !== "Ready"
    ) {
      throw new Error(
        `Candidate status must be 'Hired', 'Approved', or 'Ready' for transfer. Current status: ${candidate.status}`
      );
    }

    const existingCrew = await db
      .select()
      .from(crewMembersV2)
      .where(
        and(
          eq(crewMembersV2.sourceRecCanUuid, recCanUuid),
          eq(crewMembersV2.isDeleted, false)
        )
      );
    if (existingCrew.length > 0) {
      throw new Error(
        `Candidate ${recCanUuid} has already been transferred to crew pool as ${existingCrew[0].empNo}`
      );
    }

    const crewUuid = uuidv4();
    const empNo = options.empNo || (await generateEmpNo());
    const auditUserUuid = options.auditUserUuid || null;
    const now = new Date();

    const existingEmpNo = await crewMembersRepository.findByEmpNo(empNo);
    if (existingEmpNo) {
      throw new Error(`Employee number ${empNo} already exists`);
    }

    const counts = {
      vesselTypes: 0,
      documents: 0,
      visas: 0,
      education: 0,
      licenses: 0,
      trainingCourses: 0,
      seaService: 0,
    };

    const [
      candVesselTypes,
      candPersonal,
      candAddress,
      candFamily,
      candChildrenData,
      candNok,
      candDocs,
      candVisasData,
      candEdu,
      candLic,
      candTrain,
      candSea,
    ] = await Promise.all([
      vesselTypesAppliedRepository.findByCandidateUuid(recCanUuid),
      personalDetailsRepository.findByCandidateUuid(recCanUuid),
      addressRepository.findByCandidateUuid(recCanUuid),
      familyInfoRepository.findByCandidateUuid(recCanUuid),
      childrenRepository.findByCandidateUuid(recCanUuid),
      nextOfKinRepository.findByCandidateUuid(recCanUuid),
      documentsRepository.findByCandidateUuid(recCanUuid),
      visasRepository.findByCandidateUuid(recCanUuid),
      educationRepository.findByCandidateUuid(recCanUuid),
      licensesRepository.findByCandidateUuid(recCanUuid),
      trainingCoursesRepository.findByCandidateUuid(recCanUuid),
      seaServiceRepository.findByCandidateUuid(recCanUuid),
    ]);

    await db.insert(crewMembersV2).values({
      crewUuid,
      empNo,
      firstName: candidate.firstName,
      middleName: candidate.middleName,
      familyName: candidate.familyName,
      gender: candidate.gender,
      dob: candidate.dob,
      nationalityUuid: candidate.nationalityUuid,
      vesselTypeUuid: candVesselTypes[0]?.vesselTypeUuid || null,
      presentRank: candidate.presentRank,
      rankAppliedFor: candidate.rankAppliedFor,
      status: options.status || "Active",
      availability: options.availability || null,
      nextAvailability: null,
      isActive: true,
      uploadedPhoto: candidate.uploadedPhoto,
      sourceRecCanUuid: recCanUuid,
      createdByUuid: auditUserUuid,
      updatedByUuid: auditUserUuid,
    });

    if (candVesselTypes.length > 0) {
      for (const vt of candVesselTypes) {
        await db.insert(crewVesselTypesApplied).values({
          cvtaUuid: uuidv4(),
          crewUuid,
          vesselTypeUuid: vt.vesselTypeUuid,
          sortOrder: vt.sortOrder || 0,
          createdByUuid: auditUserUuid,
          updatedByUuid: auditUserUuid,
        });
        counts.vesselTypes++;
      }
    }

    if (candPersonal) {
      await db.insert(crewPersonalDetails).values({
        cpdUuid: uuidv4(),
        crewUuid,
        heightCm: candPersonal.heightCm,
        weightKg: candPersonal.weightKg,
        bmi: null,
        ageInYears: candPersonal.ageInYears,
        placeOfBirthCity: candPersonal.placeOfBirthCity,
        placeOfBirthCountryUuid: candPersonal.placeOfBirthCountryUuid,
        nativeLanguageUuid: candPersonal.nativeLanguageUuid,
        foreignLanguages: candPersonal.foreignLanguages,
        englishProficiency: candPersonal.englishProficiency,
        manningAgent: candPersonal.manningAgent,
        crewPool: options.crewPool || "Recruitment Transfer",
        availability: options.availability || null,
        nextAvailability: null,
        createdByUuid: auditUserUuid,
        updatedByUuid: auditUserUuid,
      });
    }

    if (candAddress) {
      await db.insert(crewAddresses).values({
        addrUuid: uuidv4(),
        crewUuid,
        countryOfResidenceUuid: candAddress.countryOfResidenceUuid,
        nearestAirport: candAddress.nearestAirport,
        addressLine1: candAddress.addressLine1,
        addressLine2: candAddress.addressLine2,
        contactLandline: candAddress.contactLandline,
        mobile: candAddress.mobile,
        email: candAddress.email,
        createdByUuid: auditUserUuid,
        updatedByUuid: auditUserUuid,
      });
    }

    if (candFamily) {
      await db.insert(crewFamilyInfo).values({
        famUuid: uuidv4(),
        crewUuid,
        maritalStatus: candFamily.maritalStatus,
        numDependentChildren: candFamily.numDependentChildren,
        fatherName: candFamily.fatherName,
        motherName: candFamily.motherName,
        spouseFirstName: candFamily.spouseFirstName,
        spouseMiddleName: candFamily.spouseMiddleName,
        spouseFamilyName: candFamily.spouseFamilyName,
        spouseDob: candFamily.spouseDob,
        createdByUuid: auditUserUuid,
        updatedByUuid: auditUserUuid,
      });
    }

    if (candChildrenData.length > 0) {
      for (const child of candChildrenData) {
        await db.insert(crewChildren).values({
          childUuid: uuidv4(),
          crewUuid,
          firstName: child.firstName,
          middleName: child.middleName,
          familyName: child.familyName,
          dob: child.dob,
          gender: child.gender,
          sortOrder: child.sortOrder || 0,
          createdByUuid: auditUserUuid,
          updatedByUuid: auditUserUuid,
        });
      }
    }

    if (candNok) {
      await db.insert(crewNextOfKin).values({
        nokUuid: uuidv4(),
        crewUuid,
        firstName: candNok.firstName,
        middleName: candNok.middleName,
        familyName: candNok.familyName,
        telephone: candNok.telephone,
        email: candNok.email,
        address: candNok.address,
        relationship: candNok.relationship,
        createdByUuid: auditUserUuid,
        updatedByUuid: auditUserUuid,
      });
    }

    for (const doc of candDocs) {
      const newDocUuid = uuidv4();
      await db.insert(crewDocuments).values({
        docUuid: newDocUuid,
        crewUuid,
        documentId: doc.documentId,
        documentName: doc.documentName,
        number: doc.number,
        issued: doc.issued,
        expiry: doc.expiry,
        issuingAuthority: doc.issuingAuthority,
        issuingCountryUuid: doc.issuingCountryUuid,
        sortOrder: doc.sortOrder || 0,
        createdByUuid: auditUserUuid,
        updatedByUuid: auditUserUuid,
      });
      counts.documents++;

      const docAtts = await documentAttachmentsRepository.findByDocUuid(
        doc.docUuid
      );
      for (const att of docAtts) {
        await db.insert(crewDocumentsAttachments).values({
          attUuid: uuidv4(),
          docUuid: newDocUuid,
          fileName: att.fileName,
          fileType: att.fileType,
          fileSize: att.fileSize,
          filePath: att.filePath,
          fileData: att.fileData || null,
          uploadedByUuid: att.uploadedByUuid || auditUserUuid,
          sortOrder: att.sortOrder || 0,
          createdByUuid: auditUserUuid,
          updatedByUuid: auditUserUuid,
        });
      }
    }

    for (const visa of candVisasData) {
      const newVisaUuid = uuidv4();
      await db.insert(crewVisas).values({
        visaUuid: newVisaUuid,
        crewUuid,
        countryUuid: visa.countryUuid,
        serialNo: visa.serialNo,
        issued: visa.issued,
        expiry: visa.expiry,
        visaType: visa.visaType,
        sortOrder: visa.sortOrder || 0,
        createdByUuid: auditUserUuid,
        updatedByUuid: auditUserUuid,
      });
      counts.visas++;

      const visaAtts = await visaAttachmentsRepository.findByVisaUuid(
        visa.visaUuid
      );
      for (const att of visaAtts) {
        await db.insert(crewVisasAttachments).values({
          attUuid: uuidv4(),
          visaUuid: newVisaUuid,
          fileName: att.fileName,
          fileType: att.fileType,
          fileSize: att.fileSize,
          filePath: att.filePath,
          fileData: att.fileData || null,
          uploadedByUuid: att.uploadedByUuid || auditUserUuid,
          sortOrder: att.sortOrder || 0,
          createdByUuid: auditUserUuid,
          updatedByUuid: auditUserUuid,
        });
      }
    }

    for (const edu of candEdu) {
      const newEduUuid = uuidv4();
      await db.insert(crewEducation).values({
        eduUuid: newEduUuid,
        crewUuid,
        dateOfCompletion: edu.dateOfCompletion,
        institution: edu.institution,
        subjectsField: edu.subjectsField,
        qualifications: edu.qualifications,
        sortOrder: edu.sortOrder || 0,
        createdByUuid: auditUserUuid,
        updatedByUuid: auditUserUuid,
      });
      counts.education++;

      const eduAtts = await educationAttachmentsRepository.findByEduUuid(
        edu.eduUuid
      );
      for (const att of eduAtts) {
        await db.insert(crewEducationAttachments).values({
          attUuid: uuidv4(),
          eduUuid: newEduUuid,
          fileName: att.fileName,
          fileType: att.fileType,
          fileSize: att.fileSize,
          filePath: att.filePath,
          fileData: att.fileData || null,
          uploadedByUuid: att.uploadedByUuid || auditUserUuid,
          sortOrder: att.sortOrder || 0,
          createdByUuid: auditUserUuid,
          updatedByUuid: auditUserUuid,
        });
      }
    }

    for (const lic of candLic) {
      const newLicUuid = uuidv4();
      const licenseId = lic.licenseId || (await generateLicenseId());
      await db.insert(crewLicenses).values({
        licUuid: newLicUuid,
        crewUuid,
        licenseId,
        certificateDocument: lic.certificateDocument,
        abbr: lic.abbr,
        requirement: lic.requirement,
        certificateNo: lic.certificateNo,
        issuingAuthority: lic.issuingAuthority,
        issuingCountryUuid: lic.issuingCountryUuid,
        issued: lic.issued,
        expiry: lic.expiry,
        sortOrder: lic.sortOrder || 0,
        createdByUuid: auditUserUuid,
        updatedByUuid: auditUserUuid,
      });
      counts.licenses++;

      const licAtts = await licenseAttachmentsRepository.findByLicUuid(
        lic.licUuid
      );
      for (const att of licAtts) {
        await db.insert(crewLicensesAttachments).values({
          attUuid: uuidv4(),
          licUuid: newLicUuid,
          fileName: att.fileName,
          fileType: att.fileType,
          fileSize: att.fileSize,
          filePath: att.filePath,
          fileData: att.fileData || null,
          uploadedByUuid: att.uploadedByUuid || auditUserUuid,
          sortOrder: att.sortOrder || 0,
          createdByUuid: auditUserUuid,
          updatedByUuid: auditUserUuid,
        });
      }
    }

    for (const train of candTrain) {
      const newTrainUuid = uuidv4();
      const courseId = train.courseId || (await generateCourseId());
      await db.insert(crewTrainingCourses).values({
        trainUuid: newTrainUuid,
        crewUuid,
        courseId,
        trainingCourse: train.trainingCourse,
        abbr: train.abbr,
        requirement: train.requirement,
        certificateNo: train.certificateNo,
        issuingAuthority: train.issuingAuthority,
        issuingCountryUuid: train.issuingCountryUuid,
        issued: train.issued,
        expiry: train.expiry,
        sortOrder: train.sortOrder || 0,
        createdByUuid: auditUserUuid,
        updatedByUuid: auditUserUuid,
      });
      counts.trainingCourses++;

      const trainAtts = await trainingAttachmentsRepository.findByTrainUuid(
        train.trainUuid
      );
      for (const att of trainAtts) {
        await db.insert(crewTrainingAttachments).values({
          attUuid: uuidv4(),
          trainUuid: newTrainUuid,
          fileName: att.fileName,
          fileType: att.fileType,
          fileSize: att.fileSize,
          filePath: att.filePath,
          fileData: att.fileData || null,
          uploadedByUuid: att.uploadedByUuid || auditUserUuid,
          sortOrder: att.sortOrder || 0,
          createdByUuid: auditUserUuid,
          updatedByUuid: auditUserUuid,
        });
      }
    }

    for (const sea of candSea) {
      const newSeaUuid = uuidv4();
      await db.insert(crewSeaService).values({
        seaUuid: newSeaUuid,
        crewUuid,
        serviceType: "external",
        vesselName: sea.vesselName,
        vesselUuid: sea.vesselUuid,
        vesselTypeUuid: sea.vesselTypeUuid,
        deadweight: sea.deadweight,
        engineTypePower: sea.engineTypePower,
        ownerOperator: sea.ownerOperator,
        rank: sea.rank,
        fromDate: sea.fromDate,
        toDate: sea.toDate,
        periodMonths: sea.periodMonths,
        experienceCategories: [],
        sortOrder: sea.sortOrder || 0,
        createdByUuid: auditUserUuid,
        updatedByUuid: auditUserUuid,
      });
      counts.seaService++;

      const seaAtts = await seaServiceAttachmentsRepository.findBySeaUuid(
        sea.seaUuid
      );
      for (const att of seaAtts) {
        await db.insert(crewSeaServiceAttachments).values({
          attUuid: uuidv4(),
          seaUuid: newSeaUuid,
          fileName: att.fileName,
          fileType: att.fileType,
          fileSize: att.fileSize,
          filePath: att.filePath,
          fileData: att.fileData || null,
          uploadedByUuid: att.uploadedByUuid || auditUserUuid,
          sortOrder: att.sortOrder || 0,
          createdByUuid: auditUserUuid,
          updatedByUuid: auditUserUuid,
        });
      }
    }

    await candidateRepository.updateByUuid(recCanUuid, {
      status: "Transferred",
      updatedByUuid: auditUserUuid,
    });

    return {
      success: true,
      crewUuid,
      empNo,
      status: options.status || "Active",
      transferredAt: now.toISOString(),
      counts,
    };
  },

  async transferFromLegacyCrewPool(legacyCrewId: number) {
    throw new Error(
      "Not implemented - requires legacy crew_members table integration"
    );
  },

  async validateTransferData(
    data: Partial<InsertCrewMemberV2>
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!data.firstName) {
      errors.push("First name is required");
    }
    if (!data.familyName) {
      errors.push("Family name is required");
    }
    if (!data.empNo) {
      errors.push("Employee number is required");
    }

    if (data.empNo) {
      const existing = await crewMembersRepository.findByEmpNo(data.empNo);
      if (existing) {
        errors.push(`Employee number ${data.empNo} already exists`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  async prepareTransferData(
    sourceData: Record<string, unknown>
  ): Promise<Partial<InsertCrewMemberV2>> {
    return {
      firstName: sourceData.firstName as string | undefined,
      familyName: sourceData.familyName as string | undefined,
      empNo: sourceData.empNo as string | undefined,
      employeeId: sourceData.employeeId as string | undefined,
      presentRank: sourceData.presentRank as string | undefined,
      nationalityUuid: sourceData.nationalityUuid as string | undefined,
      status: "active",
      isActive: true,
    };
  },

  async checkDuplicateTransfer(
    recCanUuid: string
  ): Promise<{ isDuplicate: boolean; existingEmpNo?: string }> {
    const db = getDb();
    const existingCrew = await db
      .select({ empNo: crewMembersV2.empNo })
      .from(crewMembersV2)
      .where(
        and(
          eq(crewMembersV2.sourceRecCanUuid, recCanUuid),
          eq(crewMembersV2.isDeleted, false)
        )
      );

    if (existingCrew.length > 0) {
      return { isDuplicate: true, existingEmpNo: existingCrew[0].empNo || undefined };
    }
    return { isDuplicate: false };
  },
};
