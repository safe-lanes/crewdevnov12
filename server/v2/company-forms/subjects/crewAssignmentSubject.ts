import { and, eq } from "drizzle-orm";
import { admCompanyRanksV2 } from "../../../../shared/v2/admin/schema";
import { sailDate } from "../../../../shared/v2/forms-engine/displayFormatting";
import {
  masterNationalities,
  masterVessels,
  masterVesselTypes,
} from "../../../../shared/schema";
import {
  crewAssignments,
  crewMembersV2,
} from "../../../../shared/v2/crew-pool/schema";
import { frmCompanySubmissionAssignments } from "../../../../shared/v2/forms-engine/submissions";
import {
  SHARED_SYSTEM_FIELDS,
  SUBJECT_SYSTEM_FIELDS,
} from "../../../../shared/v2/forms-engine/systemFields";
import { getDb } from "../../db";
import type {
  CompanyFormAction,
  CompanyFormPrincipal,
  CompanyFormSubjectAdapter,
  SubjectSystemField,
  SystemFieldResolutionContext,
} from "../contracts";
import { authorizeOfficeAction, type PrincipalDependencies } from "../trustedPrincipalService";
import { loadPersistedSubjectStages } from "../subjectStageRepository";
import { authorizeCrewSectionAction, captureVesselSigner } from "./vesselSigningPolicy";

export const CREW_ASSIGNMENT_SUBJECT_TYPE = "crew_assignment";

export type CrewAssignmentSubject = {
  assignUuid: string;
  crewUuid: string;
  vesselUuid: string | null;
  vesselTypeUuid?: string | null;
  signOnDate: string | null;
  signOffDate: string | null;
  assignmentType: string;
  isCurrent: boolean;
  isDeleted: boolean;
};

export type CrewAssignmentSubjectDependencies = {
  loadStages?: (subjectType: string, executor?: unknown) => Promise<readonly {
    stageKey: string;
    label: string;
    sortOrder: number;
  }[]>;
  lookup?: (assignUuid: string, executor?: unknown) => Promise<CrewAssignmentSubject | undefined>;
  authorizeOffice?: (
    principal: CompanyFormPrincipal,
    action: CompanyFormAction,
  ) => Promise<boolean>;
  principalDependencies?: PrincipalDependencies;
};

const subjectSystemFieldSources = new Set<string>(
  SUBJECT_SYSTEM_FIELDS.crew_assignment.map((field) => field.key),
);

const systemFields: readonly SubjectSystemField[] = [
  ...SHARED_SYSTEM_FIELDS.map((field) => ({
    key: field.key,
    label: field.label,
    source: "submission" as const,
  })),
  ...SUBJECT_SYSTEM_FIELDS.crew_assignment.map((field) => ({
    key: field.key,
    label: field.label,
    source: "subject" as const,
  })),
];

const allowedActions = {
  office: [
    "read_eligible_forms",
    "list_submissions",
    "count_submissions",
    "read_submission",
    "read_definition",
    "read_asset",
    "create_submission",
    "edit_draft",
    "submit_section",
    "save_signature",
    "remove_signature",
    "void_submission",
  ],
  vessel: [
    "read_eligible_forms",
    "list_submissions",
    "count_submissions",
    "read_submission",
    "read_definition",
    "read_asset",
    "create_submission",
    "edit_draft",
    "submit_section",
    "save_signature",
    "remove_signature",
  ],
  seafarer: [
    "read_eligible_forms",
    "list_submissions",
    "count_submissions",
    "read_submission",
    "read_definition",
    "read_asset",
    "create_submission",
    "edit_draft",
    "submit_section",
    "save_signature",
    "remove_signature",
  ],
} as const satisfies CompanyFormSubjectAdapter<CrewAssignmentSubject>["allowedActions"];

function mapAssignmentRow(row: any): CrewAssignmentSubject {
  return {
    assignUuid: row.assignUuid,
    crewUuid: row.crewUuid,
    vesselUuid: row.vesselUuid,
    vesselTypeUuid: row.vesselTypeUuid ?? null,
    signOnDate: row.signOnDate,
    signOffDate: row.signOffDate,
    assignmentType: row.assignmentType,
    isCurrent: row.isCurrent === true,
    isDeleted: row.isDeleted === true,
  };
}

async function lookupCrewAssignment(
  assignUuid: string,
  executor: any = getDb(),
  lock = false,
): Promise<CrewAssignmentSubject | undefined> {
  let query = executor
    .select({
      assignUuid: crewAssignments.assignUuid,
      crewUuid: crewAssignments.crewUuid,
      vesselUuid: crewAssignments.vesselUuid,
      vesselType: masterVessels.vesselType,
      signOnDate: crewAssignments.signOnDate,
      signOffDate: crewAssignments.signOffDate,
      assignmentType: crewAssignments.assignmentType,
      isCurrent: crewAssignments.isCurrent,
      isDeleted: crewAssignments.isDeleted,
    })
    .from(crewAssignments)
    .leftJoin(masterVessels, eq(masterVessels.vesselUuid, crewAssignments.vesselUuid))
    .where(eq(crewAssignments.assignUuid, assignUuid))
    .limit(1);
  if (lock) query = query.for("update", { of: crewAssignments });

  // Deliberately do not filter cancelled or non-current assignments here:
  // those records remain valid historical subjects for authorized reads.
  const row = (await query)[0];
  if (!row) return undefined;
  let vesselTypeUuid: string | null = null;
  if (row.vesselType) {
    const types = await executor.select({ vesselTypeUuid: masterVesselTypes.vtUuid })
      .from(masterVesselTypes)
      .where(and(
        eq(masterVesselTypes.vesselType, row.vesselType),
        eq(masterVesselTypes.isActive, true),
        eq(masterVesselTypes.isDeleted, false),
      )).limit(2);
    if (types.length === 1) vesselTypeUuid = types[0].vesselTypeUuid;
  }
  return mapAssignmentRow({ ...row, vesselTypeUuid });
}

async function resolveCrewSystemField(
  key: string,
  subject: CrewAssignmentSubject,
  context: SystemFieldResolutionContext,
  executor: any = getDb(),
): Promise<string | null> {
  if (key === "date_of_declaration") {
    const date = context.submission.dateOfDeclaration;
    return context.raw || !date ? date : sailDate(date);
  }
  if (!subjectSystemFieldSources.has(key)) {
    throw new Error(`Unknown System field key for Company Form subject "${CREW_ASSIGNMENT_SUBJECT_TYPE}": ${key}`);
  }

  if (key === "sign_on_date") return context.raw || !subject.signOnDate ? subject.signOnDate : sailDate(subject.signOnDate);

  const db = executor;
  if (key === "seafarer_name" || key === "rank" || key === "nationality") {
    const crewRows = await db.select({
      firstName: crewMembersV2.firstName,
      middleName: crewMembersV2.middleName,
      familyName: crewMembersV2.familyName,
      presentRank: crewMembersV2.presentRank,
      nationalityUuid: crewMembersV2.nationalityUuid,
    }).from(crewMembersV2)
      .where(eq(crewMembersV2.crewUuid, subject.crewUuid))
      .limit(1);
    const crew = crewRows[0];
    if (!crew) return null;
    if (key === "seafarer_name") {
      return [crew.firstName, crew.middleName, crew.familyName]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(" ") || null;
    }
    if (key === "rank") {
      if (context.raw || !crew.presentRank) return crew.presentRank;
      const ranks = await db.select({ rank: admCompanyRanksV2.rank })
        .from(admCompanyRanksV2).where(and(
          eq(admCompanyRanksV2.rankId, crew.presentRank),
          eq(admCompanyRanksV2.isDeleted, false),
          eq(admCompanyRanksV2.isRoleRow, false),
        )).limit(2);
      if (ranks.length !== 1) throw new Error("The readable rank name cannot be resolved uniquely.");
      return ranks[0].rank;
    }
    if (!crew.nationalityUuid) return null;
    const nationalityRows = await db.select({ nationality: masterNationalities.nationality })
      .from(masterNationalities)
      .where(and(
        eq(masterNationalities.natUuid, crew.nationalityUuid),
        eq(masterNationalities.isDeleted, false),
      ))
      .limit(1);
    return nationalityRows[0]?.nationality ?? null;
  }

  if (key === "vessel_to_join") {
    if (!subject.vesselUuid) return null;
    const vesselRows = await db.select({ vessel: masterVessels.vessel })
      .from(masterVessels)
      .where(eq(masterVessels.vesselUuid, subject.vesselUuid))
      .limit(1);
    return vesselRows[0]?.vessel ?? null;
  }

  return null;
}

export function createCrewAssignmentSubject(
  dependencies: CrewAssignmentSubjectDependencies = {},
): CompanyFormSubjectAdapter<CrewAssignmentSubject> {
  const authorizeOffice = (principal: CompanyFormPrincipal, action: CompanyFormAction) =>
    (dependencies.authorizeOffice ?? ((actor, requestedAction) =>
      authorizeOfficeAction(actor, requestedAction, dependencies.principalDependencies)))(
      principal,
      action,
    );

  return {
    subjectType: CREW_ASSIGNMENT_SUBJECT_TYPE,
    label: "Crew assignment",
    loadStages: (executor) =>
      (dependencies.loadStages ?? loadPersistedSubjectStages)(CREW_ASSIGNMENT_SUBJECT_TYPE, executor),
    lookup: async (subjectRef, executor) => {
      const context = await (dependencies.lookup ?? lookupCrewAssignment)(subjectRef, executor);
      return context ? { subjectRef: context.assignUuid, context } : undefined;
    },
    lockForStart: async (subjectRef, executor) => {
      const context = await lookupCrewAssignment(subjectRef, executor, true);
      return context ? { subjectRef: context.assignUuid, context } : undefined;
    },
    loadHomeSubjects: async (homeRef, executor: any = getDb()) => {
      const crew = await executor.select({ crewUuid: crewMembersV2.crewUuid })
        .from(crewMembersV2)
        .where(eq(crewMembersV2.crewUuid, homeRef))
        .limit(1);
      if (!crew[0]) return undefined;

      const rows = await executor.select({
        assignUuid: crewAssignments.assignUuid,
        crewUuid: crewAssignments.crewUuid,
        vesselUuid: crewAssignments.vesselUuid,
        vesselType: masterVessels.vesselType,
        signOnDate: crewAssignments.signOnDate,
        signOffDate: crewAssignments.signOffDate,
        assignmentType: crewAssignments.assignmentType,
        isCurrent: crewAssignments.isCurrent,
        isDeleted: crewAssignments.isDeleted,
      }).from(crewAssignments)
        .leftJoin(masterVessels, eq(masterVessels.vesselUuid, crewAssignments.vesselUuid))
        .where(eq(crewAssignments.crewUuid, homeRef));
      // No current/cancelled/deleted filter: home is the durable assignment
      // history, while outstanding status is computed separately below.
      return Promise.all(rows.map(async (row: any) => {
        let vesselTypeUuid: string | null = null;
        if (row.vesselType) {
          const types = await executor.select({ vesselTypeUuid: masterVesselTypes.vtUuid })
            .from(masterVesselTypes)
            .where(and(
              eq(masterVesselTypes.vesselType, row.vesselType),
              eq(masterVesselTypes.isActive, true),
              eq(masterVesselTypes.isDeleted, false),
            )).limit(2);
          if (types.length === 1) vesselTypeUuid = types[0].vesselTypeUuid;
        }
        const context = mapAssignmentRow({ ...row, vesselTypeUuid });
        return { subjectRef: context.assignUuid, context };
      }));
    },
    groupingIdentifier: (subject, subjectRef) => subject.assignUuid || subjectRef,
    isOutstanding: (subject) =>
      !subject.isDeleted && subject.assignmentType.trim().toLocaleLowerCase() !== "cancelled",
    canStart: (subject) =>
      !subject.isDeleted && subject.assignmentType.trim().toLocaleLowerCase() !== "cancelled",
    linkSubmission: async ({ executor, submissionUuid, subject }) => {
      await (executor as any).insert(frmCompanySubmissionAssignments).values({
        submissionUuid,
        assignUuid: subject.context.assignUuid,
      });
    },
    systemFields,
    resolveSystemField: resolveCrewSystemField,
    allowedActions,
    authorizeStageAction: (principal, action, subject, stageKey) =>
      principal.kind !== "vessel" || action.startsWith("read_") || action === "list_submissions" ||
      action === "count_submissions" || (stageKey === "on_board" && subject.isCurrent &&
        subject.assignmentType.replace(/[\s_]/g, "").toLowerCase() === "onboard"),
    authorizeSectionAction: authorizeCrewSectionAction,
    authorize: async (principal, action, subject) => {
      if (!allowedActions[principal.kind].includes(action as never)) return false;

      if (principal.kind === "office") {
        return authorizeOffice(principal, action);
      }

      if (principal.kind === "vessel") {
        return principal.roleType === "Ship" &&
          !!subject.vesselUuid &&
          principal.vesselUuids.includes(subject.vesselUuid);
      }

      return principal.kind === "seafarer" &&
        principal.linkageSource === "trusted_server_resolver" &&
        principal.crewUuid === subject.crewUuid;
    },
    authorizeHome: async (principal, action, homeRef, subjects) => {
      if (!allowedActions[principal.kind].includes(action as never)) return false;
      if (principal.kind === "office") return authorizeOffice(principal, action);
      if (principal.kind === "vessel") {
        return subjects.some((subject) =>
          !!subject.context.vesselUuid && principal.vesselUuids.includes(subject.context.vesselUuid));
      }
      return principal.linkageSource === "trusted_server_resolver" &&
        principal.crewUuid === homeRef;
    },
    entryPoints: [
      { stageKey: "before_joining", location: "Vessel > Planning > reliever popup" },
      { stageKey: "on_board", location: "Vessel > Crew List" },
      { stageKey: "at_sign_off", location: "Vessel > Planning > On Board Status popup" },
    ],
    entryLists: [{
      location: "Vessel > Crew List",
      columns: [{ label: "Forms", mode: "count_and_list" }],
    }],
    home: {
      location: "Crew profile",
      groupingKey: "assignment_uuid",
      groupLabel: "Assignment",
      expandable: true,
      includesCancelledHistory: true,
      outstandingExcludesCancelled: true,
    },
    signatories: [
      {
        signatureType: "officer",
        displayLabel: "Company Representative",
        allowedActors: ["office"],
        methods: ["officer"],
        methodsByActor: { office: ["officer"] },
        designationSource: "master_users.designation",
      },
      {
        signatureType: "seafarer",
        displayLabel: "Seafarer",
        allowedActors: ["seafarer", "office", "vessel"],
        methods: ["authenticated", "witnessed"],
        methodsByActor: { seafarer: ["authenticated"], office: ["witnessed"], vessel: ["witnessed"] },
        resolveWitnessIdentity: (principal, executor) => principal.kind === "vessel" ? captureVesselSigner(principal, executor) : Promise.resolve(null),
        resolveIdentity: async ({ subject, executor }) => {
          const crewSubject = subject as CrewAssignmentSubject;
          const context: SystemFieldResolutionContext = {
            submission: { dateOfDeclaration: null },
            executor,
          };
          const [name, rank] = await Promise.all([
            resolveCrewSystemField("seafarer_name", crewSubject, context, executor),
            resolveCrewSystemField("rank", crewSubject, context, executor),
          ]);
          return { name, rank };
        },
      },
      {
        signatureType: "vessel_management", displayLabel: "Vessel Management",
        allowedActors: ["vessel"], methods: ["vessel_management"],
        methodsByActor: { vessel: ["vessel_management"] },
        resolveIdentity: ({ principal, executor }) => captureVesselSigner(principal, executor),
      },
    ],
    isSectionApplicable: (section, subject) => {
      if (!section.applicableVesselTypes) return Promise.resolve(true);
      let allowed: unknown;
      try {
        allowed = JSON.parse(section.applicableVesselTypes);
      } catch {
        throw new Error("Invalid persisted vessel-type restriction in a Company Form section.");
      }
      if (!Array.isArray(allowed) || allowed.some((value) => typeof value !== "string")) {
        throw new Error("Invalid persisted vessel-type restriction in a Company Form section.");
      }
      return Promise.resolve(allowed.length === 0 ||
        (!!subject.vesselTypeUuid && allowed.includes(subject.vesselTypeUuid)));
    },
  };
}