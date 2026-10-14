import { describe, expect, it, vi } from "vitest";
import {
  sectionRequiresSubmission,
  validateCompanyFormLifecycle,
} from "@server/v2/company-forms/lifecyclePolicy";
import {
  createCrewAssignmentSubject,
  type CrewAssignmentSubject,
} from "@server/v2/company-forms/subjects/crewAssignmentSubject";
import type { CompanyFormPrincipal } from "@server/v2/company-forms/contracts";
import { resolveCompanyFormPrincipal } from "@server/v2/company-forms/trustedPrincipalService";
import { assertCompanyFormSectionEditable } from "@server/v2/company-forms/draftSectionPolicy";
import { CompanyFormPermissionError } from "@server/v2/company-forms/errors";

const answerFree = {
  responsibleMode: "not_applicable",
  signatureOfficerRequired: false,
  signatureSeafarerRequired: false,
} as const;

describe("Company Form lifecycle contracts", () => {
  it.each(["content", "system_field", "info_only"])(
    "does not require submission for a section containing only %s points",
    (responseType) => {
      expect(sectionRequiresSubmission({
        ...answerFree,
        questions: [{ responseType }],
      })).toBe(false);
    },
  );

  it("requires submission for any answerable point without adding section requiredness metadata", () => {
    expect(sectionRequiresSubmission({
      ...answerFree,
      questions: [{ responseType: "content" }, { responseType: "free_text" }],
    })).toBe(true);
  });

  it("requires submission for a signature-only informational section", () => {
    expect(sectionRequiresSubmission({
      ...answerFree,
      signatureSeafarerRequired: true,
      questions: [{ responseType: "content" }, { responseType: "system_field" }],
    })).toBe(true);
  });

  it("rejects an empty required-section set and identifies sections with no responsible party", () => {
    expect(validateCompanyFormLifecycle([{
      ...answerFree,
      sectionTitle: "System-only information",
      questions: [{ responseType: "system_field" }],
    }])).toEqual([
      "Company Form versions must contain at least one section requiring submission.",
    ]);

    expect(validateCompanyFormLifecycle([{
      ...answerFree,
      sectionTitle: "Declaration",
      signatureOfficerRequired: true,
      questions: [{ responseType: "content" }],
    }])).toContain(
      'Section "Declaration" requires submission but has no responsible party. Assign a role, department, or seafarer.',
    );
  });

  it.each([
    { responsibleMode: "role", responsibleRoleUuid: "role-1" },
    { responsibleMode: "department", responsibleDepartment: "Crewing" },
    { responsibleMode: "seafarer" },
  ])("accepts the configured $responsibleMode responsible party without assignment-specific metadata", (party) => {
    expect(validateCompanyFormLifecycle([{
      ...answerFree,
      ...party,
      questions: [{ responseType: "free_text" }],
    }])).toEqual([]);
  });

  it("rejects not_applicable, missing, and blank role/department responsible parties when submission is required", () => {
    for (const responsible of [
      { responsibleMode: "not_applicable" },
      { responsibleMode: "role" },
      { responsibleMode: "role", responsibleRoleUuid: "  " },
      { responsibleMode: "department" },
      { responsibleMode: "department", responsibleDepartment: "  " },
    ]) {
      expect(validateCompanyFormLifecycle([{
        ...answerFree,
        ...responsible,
        questions: [{ responseType: "date" }],
      }])).toHaveLength(1);
    }
  });
});

describe("crew-assignment responsible-party declarations", () => {
  const assignment: CrewAssignmentSubject = {
    assignUuid: "assignment-1",
    crewUuid: "crew-1",
    vesselUuid: "vessel-1",
    signOnDate: null,
    signOffDate: null,
    assignmentType: "Planned",
    isCurrent: false,
    isDeleted: false,
  };

  it("permits trusted vessel witnessing on board but refuses it before joining", async () => {
    const authorizeOffice = vi.fn(async () => true);
    const crew = createCrewAssignmentSubject({
      loadStages: async () => [],
      lookup: async () => assignment,
      authorizeOffice,
    });
    const seafarer = crew.signatories.find(({ signatureType }) => signatureType === "seafarer");

    expect(seafarer).toMatchObject({
      signatureType: "seafarer",
      displayLabel: "Seafarer",
      allowedActors: ["seafarer", "office", "vessel"],
      methods: ["authenticated", "witnessed"],
      methodsByActor: { vessel: ["witnessed"], office: ["witnessed"], seafarer: ["authenticated"] },
    });

    const office: CompanyFormPrincipal = {
      kind: "office",
      userId: 7,
      roleId: "role-office",
      roleName: "Crewing",
      roleType: "Office",
    };
    expect(await crew.authorize(office, "save_signature", assignment)).toBe(true);
    expect(authorizeOffice).toHaveBeenCalledWith(office, "save_signature");

    const vessel: CompanyFormPrincipal = {
      kind: "vessel",
      userId: 8,
      roleId: "role-ship",
      roleName: "Ship user",
      roleType: "Ship",
      vesselUuids: ["vessel-1"],
    };
    expect(await crew.authorize(vessel, "save_signature", assignment)).toBe(true);
    const responsibleSeafarerSection = {
      responsibleMode: "seafarer",
      responsibleRoleUuid: null,
      responsibleDepartment: null,
      vesselSignatureRoleUuids: ["role-ship"],
    };
    const onBoardAssignment = { ...assignment, assignmentType: "OnBoard", isCurrent: true };
    // Supply persisted identity, active Ship role, rank and vessel membership;
    // do not mock the policy or trust the JWT vessel assertion.
    const rows = [
      [{ id: 8, userType: "Ship", role: "Ship user", designation: "Master", fullname: "Saved Master" }],
      [{ assignedRole: "Ship user" }],
      [{ rankId: "master-rank", rank: "Master" }],
      [{ id: 8, vesselIds: "12" }],
      [{ id: 12, vesselUuid: "vessel-1" }],
    ];
    const executor = {
      execute: vi.fn(async () => []),
      select: vi.fn(() => ({
        from: () => ({
          where: () => {
            const result = rows.shift()!;
            return Object.assign(Promise.resolve(result), { limit: async () => result });
          },
        }),
      })),
    };
    expect(crew.authorizeStageAction!(vessel, "save_signature", onBoardAssignment, "on_board")).toBe(true);
    await expect(crew.authorizeSectionAction!({
      principal: vessel, subject: onBoardAssignment, stageKey: "on_board",
      section: responsibleSeafarerSection, action: "save_signature",
      signatureType: "seafarer", executor,
    })).resolves.toBeUndefined();
    expect(executor.select).toHaveBeenCalledTimes(5);

    // Even a current vessel assignment and a permitted section role cannot
    // make a before-joining form witnessable by a Ship actor.
    expect(crew.authorizeStageAction!(vessel, "save_signature", onBoardAssignment, "before_joining")).toBe(false);
    await expect(crew.authorizeSectionAction!({
      principal: vessel, subject: onBoardAssignment, stageKey: "before_joining",
      section: responsibleSeafarerSection, action: "save_signature",
      signatureType: "seafarer", executor,
    })).rejects.toBeInstanceOf(CompanyFormPermissionError);
    expect(executor.select).toHaveBeenCalledTimes(5);
    await expect(assertCompanyFormSectionEditable({
      principal: office,
      section: responsibleSeafarerSection,
      part: { isOfficeOnly: false },
      executor: undefined,
    })).resolves.toBeUndefined();
    await expect(assertCompanyFormSectionEditable({
      principal: vessel,
      section: responsibleSeafarerSection,
      part: { isOfficeOnly: false },
      executor: undefined,
    })).resolves.toBeUndefined();
  });

  it("resolves the authenticated seafarer link on the server and limits sign/submit to his own assignment", async () => {
    const crew = createCrewAssignmentSubject({
      loadStages: async () => [],
      lookup: async () => assignment,
    });
    const linkedSeafarer = await resolveCompanyFormPrincipal({
      user: { id: 9, userType: "Seafarer" },
    } as any, {
      resolveSeafarerCrewUuid: async (masterUserId) => masterUserId === 9 ? "crew-1" : "crew-2",
    });
    const crossCrewPrincipal: CompanyFormPrincipal = {
      ...linkedSeafarer,
      userId: 10,
      crewUuid: "crew-2",
    };
    expect(linkedSeafarer).toMatchObject({
      kind: "seafarer",
      userId: 9,
      crewUuid: "crew-1",
      linkageSource: "trusted_server_resolver",
    });

    expect(await crew.authorize(linkedSeafarer, "submit_section", assignment)).toBe(true);
    expect(await crew.authorize(linkedSeafarer, "save_signature", assignment)).toBe(true);
    expect(await crew.authorize(crossCrewPrincipal, "submit_section", assignment)).toBe(false);
    expect(await crew.authorize(crossCrewPrincipal, "save_signature", assignment)).toBe(false);
  });
});