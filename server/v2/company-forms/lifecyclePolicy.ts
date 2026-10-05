import { and, asc, eq, inArray } from "drizzle-orm";
import { admRoleMasterAc, admFormVersionsV2 } from "../../../shared/v2/admin/schema";
import {
  frmFormParts,
  frmQuestions,
  frmSections,
} from "../../../shared/v2/forms-engine/schema";

export type LifecycleQuestion = {
  responseType: string;
};

export type LifecycleSection = {
  sectionUuid?: string;
  sectionCode?: string;
  sectionTitle?: string;
  responsibleMode: string;
  responsibleRoleUuid?: string | null;
  responsibleDepartment?: string | null;
  signatureOfficerRequired: boolean;
  signatureSeafarerRequired: boolean;
  signatureVesselManagementRequired?: boolean;
  vesselSignatureRoleUuids?: string[];
  vesselRolePolicyValid?: boolean;
  onBoard?: boolean;
  atSignOff?: boolean;
  questions: LifecycleQuestion[];
};

export function sectionRequiresSubmission(section: LifecycleSection): boolean {
  return section.signatureOfficerRequired ||
    section.signatureVesselManagementRequired ||
    section.signatureSeafarerRequired ||
    section.questions.some((question) =>
      question.responseType !== "content" &&
      question.responseType !== "system_field" &&
      question.responseType !== "info_only");
}

function sectionHasResponsibleParty(section: LifecycleSection): boolean {
  switch (section.responsibleMode) {
    case "role":
      return !!section.responsibleRoleUuid?.trim();
    case "department":
      return !!section.responsibleDepartment?.trim();
    case "seafarer":
      return true;
    default:
      return false;
  }
}

function sectionName(section: LifecycleSection): string {
  return section.sectionTitle?.trim() ||
    section.sectionCode?.trim() ||
    section.sectionUuid ||
    "Untitled section";
}

export function validateCompanyFormLifecycle(
  sections: readonly LifecycleSection[],
): string[] {
  const requiringSubmission = sections.filter(sectionRequiresSubmission);
  const errors: string[] = [];

  if (requiringSubmission.length === 0) {
    errors.push("Company Form versions must contain at least one section requiring submission.");
  }
  for (const section of requiringSubmission) {
    if (section.signatureVesselManagementRequired && section.onBoard === false && !section.atSignOff) {
      errors.push(`Section "${sectionName(section)}" enables Vessel Management outside the on-board stage or at-sign-off stage.`);
    }
    if ((section.signatureVesselManagementRequired || (section.onBoard && section.signatureSeafarerRequired)) && !section.vesselSignatureRoleUuids?.length) {
      errors.push(`Section "${sectionName(section)}" requires at least one permitted vessel role.`);
    }
    if (section.vesselRolePolicyValid === false) {
      errors.push(`Section "${sectionName(section)}" has an invalid or inactive permitted vessel role.`);
    }
    if (!sectionHasResponsibleParty(section)) {
      errors.push(
        `Section "${sectionName(section)}" requires submission but has no responsible party. Assign a role, department, or seafarer.`,
      );
    }
  }
  return errors;
}

type Executor = any;

export async function readCompanyFormLifecycleVersions(
  executor: Executor,
  formVersionUuids: readonly string[],
): Promise<Map<string, { sections: LifecycleSection[]; errors: string[] }>> {
  const result = new Map<string, { sections: LifecycleSection[]; errors: string[] }>();
  for (const uuid of new Set(formVersionUuids)) result.set(uuid, { sections: [], errors: [] });
  if (result.size === 0) return result;

  const rows = await executor.select({
    formVersionUuid: frmSections.formVersionUuid,
    sectionUuid: frmSections.sectionUuid,
    sectionCode: frmSections.sectionCode,
    sectionTitle: frmSections.sectionTitle,
    responsibleMode: frmSections.responsibleMode,
    responsibleRoleUuid: frmSections.responsibleRoleUuid,
    responsibleDepartment: frmSections.responsibleDepartment,
    signatureOfficerRequired: frmSections.signatureOfficerRequired,
    signatureSeafarerRequired: frmSections.signatureSeafarerRequired,
    signatureVesselManagementRequired: frmSections.signatureVesselManagementRequired,
    vesselSignatureRoleUuids: frmSections.vesselSignatureRoleUuids,
    stageKey: admFormVersionsV2.stageKey,
    questionUuid: frmQuestions.questionUuid,
    responseType: frmQuestions.responseType,
  })
    .from(frmSections)
    .innerJoin(admFormVersionsV2, eq(admFormVersionsV2.fvUuid, frmSections.formVersionUuid))
    .innerJoin(frmFormParts, and(
      eq(frmFormParts.formPartUuid, frmSections.formPartUuid),
      eq(frmFormParts.formVersionUuid, frmSections.formVersionUuid),
      eq(frmFormParts.isDeleted, false),
    ))
    .leftJoin(frmQuestions, and(
      eq(frmQuestions.sectionUuid, frmSections.sectionUuid),
      eq(frmQuestions.isDeleted, false),
    ))
    .where(and(
      inArray(frmSections.formVersionUuid, [...result.keys()]),
      eq(frmSections.isDeleted, false),
    ))
    .orderBy(asc(frmSections.formVersionUuid), asc(frmSections.sortOrder), asc(frmSections.id),
      asc(frmQuestions.sortOrder), asc(frmQuestions.id));

  for (const row of rows) {
    const lifecycle = result.get(row.formVersionUuid)!;
    let section = lifecycle.sections.find((candidate) => candidate.sectionUuid === row.sectionUuid);
    if (!section) {
      section = {
        sectionUuid: row.sectionUuid,
        sectionCode: row.sectionCode,
        sectionTitle: row.sectionTitle,
        responsibleMode: row.responsibleMode,
        responsibleRoleUuid: row.responsibleRoleUuid,
        responsibleDepartment: row.responsibleDepartment,
        signatureOfficerRequired: row.signatureOfficerRequired,
        signatureSeafarerRequired: row.signatureSeafarerRequired,
        signatureVesselManagementRequired: row.signatureVesselManagementRequired,
        vesselSignatureRoleUuids: row.vesselSignatureRoleUuids,
        onBoard: row.stageKey === "on_board",
        atSignOff: row.stageKey === "at_sign_off",
        questions: [],
      };
      lifecycle.sections.push(section);
    }
    if (row.questionUuid) section.questions.push({ responseType: row.responseType });
  }
  const roleIds = [...new Set<string>(rows.flatMap((row: any) => row.vesselSignatureRoleUuids ?? []))];
  const validRoles = roleIds.length ? await executor.select({ id: admRoleMasterAc.ruid }).from(admRoleMasterAc)
    .where(and(inArray(admRoleMasterAc.ruid, roleIds), eq(admRoleMasterAc.roletype, "Ship"),
      eq(admRoleMasterAc.isActive, true), eq(admRoleMasterAc.isDeleted, false))) : [];
  const validRoleIds = new Set(validRoles.map((role: any) => role.id));
  for (const lifecycle of result.values()) {
    for (const section of lifecycle.sections) {
      section.vesselRolePolicyValid = (section.vesselSignatureRoleUuids ?? []).every(id => validRoleIds.has(id));
    }
    lifecycle.errors = validateCompanyFormLifecycle(lifecycle.sections);
  }
  return result;
}

export async function validatePersistedCompanyFormLifecycle(
  executor: Executor,
  formVersionUuid: string,
): Promise<string[]> {
  return (await readCompanyFormLifecycleVersions(executor, [formVersionUuid]))
    .get(formVersionUuid)?.errors ?? [];
}

export async function validatePersistedCompanyFormLifecycles(
  executor: Executor,
  formVersionUuids: readonly string[],
): Promise<Map<string, string[]>> {
  const versions = await readCompanyFormLifecycleVersions(executor, formVersionUuids);
  return new Map([...versions].map(([uuid, lifecycle]) => [uuid, lifecycle.errors]));
}
