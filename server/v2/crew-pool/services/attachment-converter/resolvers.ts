import { and, eq, isNotNull } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  crewMembersV2,
  crewTrainingCourses,
} from "../../../../../shared/v2/crew-pool/schema";
import type {
  AttachmentSectionId,
  CrewCandidate,
  SectionRecordCandidate,
} from "./types";
import { normalizeCrewName } from "./parser";
import { normalizeProfileAlias } from "./profiles";

export interface AttachmentConverterResolvers {
  findCrewsByName(crewName: string): Promise<CrewCandidate[]>;
  findRecords(
    section: AttachmentSectionId,
    crewUuid: string,
    documentName: string,
  ): Promise<SectionRecordCandidate[]>;
  findRecordByUuid(
    section: AttachmentSectionId,
    crewUuid: string,
    recordUuid: string,
  ): Promise<SectionRecordCandidate | null>;
}

function crewNameVariants(row: {
  firstName: string | null;
  middleName: string | null;
  familyName: string | null;
}): string[] {
  const first = row.firstName?.trim() ?? "";
  const middle = row.middleName?.trim() ?? "";
  const family = row.familyName?.trim() ?? "";
  return [
    [first, middle, family].filter(Boolean).join(" "),
    [first, family].filter(Boolean).join(" "),
    [family, first, middle].filter(Boolean).join(" "),
  ].filter(Boolean);
}

function recordMatchesDocument(
  documentName: string,
  record: {
    abbr: string | null;
  },
): boolean {
  const source = normalizeProfileAlias(documentName);
  // D3 filenames identify the crew-specific training abbreviation only.
  return Boolean(record.abbr?.trim()) && normalizeProfileAlias(record.abbr!) === source;
}

export function createDatabaseAttachmentConverterResolvers(
  database = getDb(),
): AttachmentConverterResolvers {
  return {
    async findCrewsByName(crewName) {
      const rows = await database
        .select({
          crewUuid: crewMembersV2.crewUuid,
          employeeId: crewMembersV2.empNo,
          firstName: crewMembersV2.firstName,
          middleName: crewMembersV2.middleName,
          familyName: crewMembersV2.familyName,
        })
        .from(crewMembersV2)
        .where(eq(crewMembersV2.isDeleted, false));

      const expected = normalizeCrewName(crewName);
      return rows
        .filter((row: any) => crewNameVariants(row).some((name) => normalizeCrewName(name) === expected))
        .map((row: any) => ({
          crewUuid: row.crewUuid,
          employeeId: row.employeeId,
          crewName: [row.firstName, row.middleName, row.familyName].filter(Boolean).join(" "),
        }));
    },

    async findRecords(section, crewUuid, documentName) {
      if (section !== "training") return [];

      const rows = await database
        .select({
          recordUuid: crewTrainingCourses.trainUuid,
          crewUuid: crewTrainingCourses.crewUuid,
          attachmentRef: crewTrainingCourses.attachmentRef,
          trainingCourse: crewTrainingCourses.trainingCourse,
          abbr: crewTrainingCourses.abbr,
          courseId: crewTrainingCourses.courseId,
          certificateNo: crewTrainingCourses.certificateNo,
        })
        .from(crewTrainingCourses)
        .where(
          and(
            eq(crewTrainingCourses.crewUuid, crewUuid),
            eq(crewTrainingCourses.isDeleted, false),
            isNotNull(crewTrainingCourses.attachmentRef),
          ),
        );

      return rows
        .filter((row: any) => row.attachmentRef && recordMatchesDocument(documentName, row))
        .map((row: any) => ({
          section,
          recordUuid: row.recordUuid,
          crewUuid: row.crewUuid,
          documentName: row.trainingCourse ?? row.abbr ?? row.courseId ?? row.certificateNo ?? row.recordUuid,
          attachmentRef: row.attachmentRef as string,
          erpRecord: `D3 Training ${row.trainingCourse ?? row.courseId ?? row.recordUuid}`,
        }));
    },

    async findRecordByUuid(section, crewUuid, recordUuid) {
      if (section !== "training") return null;

      const rows = await database
        .select({
          recordUuid: crewTrainingCourses.trainUuid,
          crewUuid: crewTrainingCourses.crewUuid,
          attachmentRef: crewTrainingCourses.attachmentRef,
          trainingCourse: crewTrainingCourses.trainingCourse,
          abbr: crewTrainingCourses.abbr,
          courseId: crewTrainingCourses.courseId,
        })
        .from(crewTrainingCourses)
        .where(
          and(
            eq(crewTrainingCourses.trainUuid, recordUuid),
            eq(crewTrainingCourses.crewUuid, crewUuid),
            eq(crewTrainingCourses.isDeleted, false),
            isNotNull(crewTrainingCourses.attachmentRef),
          ),
        );
      const row = rows[0];
      if (!row?.attachmentRef) return null;
      return {
        section,
        recordUuid: row.recordUuid,
        crewUuid: row.crewUuid,
        documentName: row.trainingCourse ?? row.abbr ?? row.courseId ?? row.recordUuid,
        attachmentRef: row.attachmentRef,
        erpRecord: `D3 Training ${row.trainingCourse ?? row.courseId ?? row.recordUuid}`,
      };
    },
  };
}
