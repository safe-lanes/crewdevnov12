import type { Request } from "express";
import type { CompanyFormHomeGroupDisplay } from "../../../shared/v2/forms-engine/submissionRenderContract";

export const COMPANY_FORM_ACTIONS = [
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
  "void_completed_submission",
] as const;

export type CompanyFormAction = typeof COMPANY_FORM_ACTIONS[number];
export type CompanyFormActorKind = "office" | "vessel" | "seafarer";

export type CompanyFormPrincipal =
  | {
      kind: "office";
      userId: number;
      roleId: string;
      roleName: string;
      roleType: "Office" | "SAIL Admin";
    }
  | {
      kind: "vessel";
      userId: number;
      roleId: string;
      roleName: string;
      roleType: "Ship";
      vesselUuids: readonly string[];
    }
  | {
      kind: "seafarer";
      userId: number;
      crewUuid: string;
      linkageSource: "trusted_server_resolver";
    };

export type SubjectStage = {
  stageKey: string;
  label: string;
  sortOrder: number;
};

export type SystemFieldSource = "submission" | "subject";

export type SubjectSystemField = {
  key: string;
  label: string;
  source: SystemFieldSource;
};

export type SubjectEntryPoint = {
  stageKey: string;
  location: string;
};

export type SubjectHomeDeclaration = {
  location: string;
  groupingKey: string;
  groupLabel: string;
  expandable: boolean;
  includesCancelledHistory: boolean;
  outstandingExcludesCancelled: boolean;
};

export type SubjectEntryListColumn = {
  label: string;
  mode: "count_and_list";
};

export type SubjectEntryListDeclaration = {
  location: string;
  columns: readonly SubjectEntryListColumn[];
};

export type SubjectSignatoryDeclaration = {
  signatureType: "officer" | "seafarer" | "vessel_management";
  displayLabel: string;
  allowedActors: readonly CompanyFormActorKind[];
  methods: readonly ("officer" | "authenticated" | "witnessed" | "vessel_management")[];
  methodsByActor?: Readonly<Partial<Record<
    CompanyFormActorKind,
    readonly ("officer" | "authenticated" | "witnessed" | "vessel_management")[]
  >>>;
  designationSource?: "master_users.designation";
  resolveWitnessIdentity?: (principal: CompanyFormPrincipal, executor: any) => Promise<{ name: string; rank: string } | null>;
  resolveIdentity?: (input: {
    principal: CompanyFormPrincipal;
    subject: unknown;
    method: "officer" | "authenticated" | "witnessed" | "vessel_management";
    executor: unknown;
  }) => Promise<{ name: string | null; rank: string | null }>;
};

export type SubjectLookupResult<Context> = {
  subjectRef: string;
  context: Context;
};

export type SystemFieldResolutionContext = {
  /** Raw identifiers/calendar values for companion storage and legacy comparison. */
  raw?: boolean;
  submission: {
    dateOfDeclaration: string | null;
  };
  executor?: unknown;
};

export type CompanyFormSubjectAdapter<Context = unknown> = {
  subjectType: string;
  label: string;
  loadStages(executor?: unknown): Promise<readonly SubjectStage[]>;
  lookup(subjectRef: string, executor?: unknown): Promise<SubjectLookupResult<Context> | undefined>;
  lockForStart(subjectRef: string, executor: unknown): Promise<SubjectLookupResult<Context> | undefined>;
  loadHomeSubjects(
    homeRef: string,
    executor?: unknown,
  ): Promise<readonly SubjectLookupResult<Context>[] | undefined>;
  groupingIdentifier(subject: Context, subjectRef: string): string;
  homeGroupDisplay?(subject: Context): CompanyFormHomeGroupDisplay;
  homeActions?(principal: CompanyFormPrincipal, subject: Context): Promise<{
    startableStages: string[]; unfinishedStageKeys: string[];
  }>;
  isOutstanding(subject: Context): boolean;
  canStart(subject: Context): boolean;
  linkSubmission(input: {
    executor: unknown;
    submissionUuid: string;
    subject: SubjectLookupResult<Context>;
  }): Promise<void>;
  systemFields: readonly SubjectSystemField[];
  resolveSystemField(
    key: string,
    subject: Context,
    context: SystemFieldResolutionContext,
    executor?: unknown,
  ): Promise<string | null>;
  isSectionApplicable?(section: {
    applicableVesselTypes: string | null;
  }, subject: Context): Promise<boolean>;
  allowedActions: Readonly<Record<CompanyFormActorKind, readonly CompanyFormAction[]>>;
  authorizeStageAction?(principal: CompanyFormPrincipal, action: CompanyFormAction, subject: Context, stageKey: string | null): boolean;
  authorizeSectionAction?(input: {
    principal: CompanyFormPrincipal; subject: Context; stageKey: string | null;
    section: any; action: CompanyFormAction; signatureType?: string; executor: any;
    signatures?: readonly any[];
  }): Promise<void>;
  /** Server-only provenance captured under the subject lock at signing. */
  signatureProvenance?(subject: Context): Record<string, unknown>;
  authorizeSignature?(principal: CompanyFormPrincipal, signatureType: string, executor?: any): Promise<void>;
  authorizeVersionStart?(input: {
    principal: CompanyFormPrincipal; subject: Context; stageKey: string | null;
    formVersionUuid: string; executor: any;
  }): Promise<void>;
  assertRequestContext?(subject: Context, query: Request["query"], executor?: unknown, locked?: boolean): Promise<void>;
  authorize(
    principal: CompanyFormPrincipal,
    action: CompanyFormAction,
    subject: Context,
    executor?: any,
  ): Promise<boolean>;
  authorizeHome(
    principal: CompanyFormPrincipal,
    action: CompanyFormAction,
    homeRef: string,
    subjects: readonly SubjectLookupResult<Context>[],
  ): Promise<boolean>;
  entryPoints: readonly SubjectEntryPoint[];
  entryLists: readonly SubjectEntryListDeclaration[];
  home: SubjectHomeDeclaration;
  signatories: readonly SubjectSignatoryDeclaration[];
};

export type AuthenticatedRequestPrincipal = Request["user"];