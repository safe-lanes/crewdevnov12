import type { Request } from "express";
import { describe, expect, it, vi } from "vitest";
import type {
  CompanyFormAction,
  CompanyFormPrincipal,
  CompanyFormSubjectAdapter,
} from "@server/v2/company-forms/contracts";
import {
  createCrewAssignmentSubject,
  type CrewAssignmentSubject,
} from "@server/v2/company-forms/subjects/crewAssignmentSubject";
import { CompanyFormSubjectRegistry } from "@server/v2/company-forms/subjectRegistry";
import { CompanyFormSubmissionsService } from "@server/v2/company-forms/submissionsService";
import type { CompanyFormSubmissionsRepository } from "@server/v2/company-forms/submissionsRepository";
import {
  authorizeOfficeAction,
  decodeTrustedVesselIds,
  resolveCompanyFormPrincipal,
} from "@server/v2/company-forms/trustedPrincipalService";
import {
  CompanyFormAuthenticationError,
  CompanyFormPermissionError,
  CompanyFormValidationError,
} from "@server/v2/company-forms/errors";

const assignment: CrewAssignmentSubject = {
  assignUuid: "assign-1",
  crewUuid: "crew-1",
  vesselUuid: "vessel-db-1",
  signOnDate: "2026-01-02",
  signOffDate: null,
  assignmentType: "Planned",
  isCurrent: false,
  isDeleted: false,
};

function requestFor(id: number | undefined, userType?: string, vessels?: string[]): Request {
  return {
    user: id === undefined ? undefined : { id, userType, vessels },
  } as unknown as Request;
}

function resolvedRole(
  roleType: "Office" | "Ship",
  masterUserType: "Office" | "Ship" = roleType,
) {
  return {
    ok: true as const,
    role: {
      roleId: `role-${roleType.toLowerCase()}`,
      roleName: `${roleType} User`,
      masterUserId: 41,
      masterUserType,
      roleType,
    },
  };
}

function stageLessAdapter(): CompanyFormSubjectAdapter<{ recordId: string }> {
  return {
    subjectType: "stage_less_test_subject",
    label: "Stage-less test subject",
    loadStages: async () => [],
    lookup: async (subjectRef) => ({ subjectRef, context: { recordId: subjectRef } }),
    lockForStart: async (subjectRef) => ({ subjectRef, context: { recordId: subjectRef } }),
    loadHomeSubjects: async () => [],
    groupingIdentifier: (_subject, subjectRef) => subjectRef,
    isOutstanding: () => true,
    canStart: () => true,
    linkSubmission: async () => undefined,
    systemFields: [],
    resolveSystemField: async () => null,
    allowedActions: { office: [], vessel: [], seafarer: [] },
    authorize: async () => false,
    authorizeHome: async () => false,
    entryPoints: [],
    entryLists: [],
    home: {
      location: "Test subject",
      groupingKey: "record_id",
      groupLabel: "Record",
      expandable: false,
      includesCancelledHistory: false,
      outstandingExcludesCancelled: true,
    },
    signatories: [],
  };
}

describe("Company Form subject-neutral declarations", () => {
  it("uses only the subject's persisted stage declaration and supports a stage-less adapter", async () => {
    const crew = createCrewAssignmentSubject({
      loadStages: async (subjectType) => {
        expect(subjectType).toBe("crew_assignment");
        return [{ stageKey: "stage-from-database", label: "Persisted", sortOrder: 7 }];
      },
      lookup: async (assignUuid) => ({ ...assignment, assignUuid }),
    });
    const registry = new CompanyFormSubjectRegistry([crew, stageLessAdapter()]);

    await expect(registry.get("crew_assignment").loadStages()).resolves.toEqual([
      { stageKey: "stage-from-database", label: "Persisted", sortOrder: 7 },
    ]);
    await expect(registry.get("stage_less_test_subject").loadStages()).resolves.toEqual([]);
    expect(registry.get("stage_less_test_subject").entryLists).toEqual([]);
    await expect(registry.get("stage_less_test_subject").lookup("opaque-ref")).resolves.toEqual({
      subjectRef: "opaque-ref",
      context: { recordId: "opaque-ref" },
    });
    expect(() => registry.get("unregistered")).toThrow(/not supported/);
  });

  it("reads eligible versions for a stage-less subject without inventing an assignment or stage", async () => {
    const adapter = {
      ...stageLessAdapter(),
      allowedActions: { office: ["read_eligible_forms"], vessel: [], seafarer: [] },
      authorize: async () => true,
    } as CompanyFormSubjectAdapter<{ recordId: string }>;
    const registry = new CompanyFormSubjectRegistry([adapter]);
    const eligible = [{
      formUuid: "form",
      formName: "Stage-less form",
      description: null,
      formVersionUuid: "version",
      versionNo: "01",
      stageKey: null,
      releasedAt: null,
    }];
    const repository = {
      findEligibleForms: vi.fn().mockResolvedValue(eligible),
    } as unknown as CompanyFormSubmissionsRepository;
    const service = new CompanyFormSubmissionsService(
      { resolveRole: vi.fn().mockResolvedValue(resolvedRole("Office")) },
      registry,
      repository,
    );

    await expect(service.eligibleForms({
      req: requestFor(41, "Office"),
      subjectType: "stage_less_test_subject",
      subjectRef: "opaque-ref",
    })).resolves.toEqual(eligible);
    expect(repository.findEligibleForms).toHaveBeenCalledWith("stage_less_test_subject", null);
    await expect(service.eligibleForms({
      req: requestFor(41, "Office"),
      subjectType: "stage_less_test_subject",
      subjectRef: "opaque-ref",
      stageKey: "invented",
    })).rejects.toBeInstanceOf(CompanyFormValidationError);
  });

  it("declares crew assignment entry points, all-assignment history, one Forms column and signatories", () => {
    const crew = createCrewAssignmentSubject({ loadStages: async () => [] });
    expect(crew.entryPoints).toEqual([
      { stageKey: "before_joining", location: "Vessel > Planning > reliever popup" },
      { stageKey: "on_board", location: "Vessel > Crew List" },
      { stageKey: "at_sign_off", location: "Vessel > Planning > On Board Status popup" },
    ]);
    expect(crew.home).toMatchObject({
      location: "Crew profile",
      groupingKey: "assignment_uuid",
      expandable: true,
      includesCancelledHistory: true,
      outstandingExcludesCancelled: true,
    });
    expect(crew.entryLists).toEqual([
      {
        location: "Vessel > Crew List",
        columns: [{ label: "Forms", mode: "count_and_list" }],
      },
    ]);
    expect(crew.signatories).toEqual([
      {
        signatureType: "officer",
        displayLabel: "Company Representative",
        allowedActors: ["office", "vessel"],
        methods: ["officer"],
        methodsByActor: { office: ["officer"], vessel: ["officer"] },
        designationSource: "master_users.designation",
      },
      {
        signatureType: "seafarer",
        displayLabel: "Seafarer",
        allowedActors: ["seafarer", "office"],
        methods: ["authenticated", "witnessed"],
        methodsByActor: { seafarer: ["authenticated"], office: ["witnessed"] },
        resolveIdentity: expect.any(Function),
      },
    ]);
    expect(crew.systemFields.find((field) => field.key === "date_of_declaration")?.source).toBe("submission");
    expect(crew.systemFields.find((field) => field.key === "rank")?.source).toBe("subject");
  });
});

describe("trusted Company Form principal and action policy", () => {
  it("requires authentication and reports permission separately", async () => {
    await expect(resolveCompanyFormPrincipal(requestFor(undefined))).rejects.toBeInstanceOf(
      CompanyFormAuthenticationError,
    );
    await expect(resolveCompanyFormPrincipal(requestFor(41, "Office"), {
      resolveRole: vi.fn().mockResolvedValue({ ok: false, reason: "user_not_found" }),
    })).rejects.toBeInstanceOf(CompanyFormPermissionError);
  });

  it("resolves office authority independently from vessel scope and uses Crew Database grants by action", async () => {
    const resolveVesselScope = vi.fn();
    const principal = await resolveCompanyFormPrincipal(requestFor(41, "Office", ["untrusted-claim"]), {
      resolveRole: vi.fn().mockResolvedValue(resolvedRole("Office")),
      resolveVesselScope,
    });
    expect(principal).toMatchObject({ kind: "office", roleType: "Office", roleId: "role-office" });
    expect(resolveVesselScope).not.toHaveBeenCalled();

    const permissions = vi.fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    expect(await authorizeOfficeAction(principal, "read_submission", { hasOfficePermission: permissions })).toBe(true);
    expect(await authorizeOfficeAction(principal, "create_submission", { hasOfficePermission: permissions })).toBe(false);
    expect(await authorizeOfficeAction(principal, "edit_draft", { hasOfficePermission: permissions })).toBe(true);
    expect(permissions.mock.calls).toEqual([
      ["role-office", "view"],
      ["role-office", "create"],
      ["role-office", "edit"],
    ]);
  });

  it("uses strictly decoded DB vessel scope, never the JWT vessels claim", async () => {
    const principal = await resolveCompanyFormPrincipal(
      requestFor(41, "Ship", ["untrusted-claim"]),
      {
        resolveRole: vi.fn().mockResolvedValue(resolvedRole("Ship")),
        resolveVesselScope: vi.fn().mockResolvedValue(["vessel-db-1"]),
      },
    );
    expect(principal).toMatchObject({ kind: "vessel", vesselUuids: ["vessel-db-1"] });

    const crew = createCrewAssignmentSubject({
      loadStages: async () => [],
      lookup: async () => assignment,
      authorizeOffice: async () => false,
    });
    expect(await crew.authorize(principal, "read_submission", assignment)).toBe(true);
    expect(await crew.authorize(principal, "read_submission", { ...assignment, vesselUuid: "other-vessel" })).toBe(false);
    expect(await crew.authorize(principal, "delete_submission" as CompanyFormAction, assignment)).toBe(false);
  });

  it.each([
    undefined,
    "",
    "12junk",
    "12,",
    ",12",
    "12.5",
    "-12",
    "9007199254740992",
  ])("rejects malformed trusted vessel ID encodings: %j", (raw) => {
    expect(decodeTrustedVesselIds(raw)).toBeUndefined();
  });

  it("deduplicates complete positive vessel IDs", () => {
    expect(decodeTrustedVesselIds("12, 35,12")).toEqual([12, 35]);
  });

  it("fails closed for Ship actors with no usable scope or a role/userType mismatch", async () => {
    await expect(resolveCompanyFormPrincipal(requestFor(41, "Ship", ["claim-only"]), {
      resolveRole: vi.fn().mockResolvedValue(resolvedRole("Ship")),
      resolveVesselScope: vi.fn().mockResolvedValue(undefined),
    })).rejects.toBeInstanceOf(CompanyFormPermissionError);

    await expect(resolveCompanyFormPrincipal(requestFor(41, "Ship"), {
      resolveRole: vi.fn().mockResolvedValue(resolvedRole("Office", "Ship")),
      resolveVesselScope: vi.fn().mockResolvedValue(["vessel-db-1"]),
    })).rejects.toBeInstanceOf(CompanyFormPermissionError);
  });

  it("keeps seafarer authorization disabled without trusted server linkage and limits injected links to their own crew", async () => {
    await expect(resolveCompanyFormPrincipal(requestFor(41, "Seafarer"))).rejects.toBeInstanceOf(
      CompanyFormPermissionError,
    );

    const principal = await resolveCompanyFormPrincipal(requestFor(41, "Seafarer"), {
      resolveSeafarerCrewUuid: async () => "crew-1",
    });
    const crew = createCrewAssignmentSubject({
      loadStages: async () => [],
      lookup: async () => assignment,
    });
    expect(await crew.authorize(principal, "edit_draft", assignment)).toBe(true);
    expect(await crew.authorize(principal, "read_submission", { ...assignment, crewUuid: "crew-other" })).toBe(false);
  });
});