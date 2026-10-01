import { describe, expect, it } from "vitest";
import type { CompanyFormPrincipal } from "../../server/v2/company-forms/contracts";
import { CompanyFormPermissionError } from "../../server/v2/company-forms/errors";
import { assertCompanyFormSectionEditable } from "../../server/v2/company-forms/draftSectionPolicy";

const office: CompanyFormPrincipal = {
  kind: "office",
  userId: 101,
  roleId: "office-role",
  roleName: "Crewing",
  roleType: "Office",
};
const vessel: CompanyFormPrincipal = {
  kind: "vessel",
  userId: 102,
  roleId: "ship-role",
  roleName: "Master",
  roleType: "Ship",
  vesselUuids: ["vessel-a"],
};
const linkedSeafarer: CompanyFormPrincipal = {
  kind: "seafarer",
  userId: 103,
  crewUuid: "crew-a",
  linkageSource: "trusted_server_resolver",
};

function executorWithDepartment(department: string | null) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [{ department }],
        }),
      }),
    }),
  };
}

describe("Company Form draft section responsibility", () => {
  it("requires an exact trusted role id and rejects other roles", async () => {
    const section = {
      responsibleMode: "role",
      responsibleRoleUuid: "office-role",
      responsibleDepartment: null,
    };
    await expect(assertCompanyFormSectionEditable({
      principal: office,
      section,
      part: { isOfficeOnly: false },
      executor: executorWithDepartment(null),
    })).resolves.toBeUndefined();
    await expect(assertCompanyFormSectionEditable({
      principal: vessel,
      section,
      part: { isOfficeOnly: false },
      executor: executorWithDepartment(null),
    })).rejects.toBeInstanceOf(CompanyFormPermissionError);
  });

  it("uses only the authenticated master-user department for department responsibility", async () => {
    const section = {
      responsibleMode: "department",
      responsibleRoleUuid: null,
      responsibleDepartment: "Crewing",
    };
    await expect(assertCompanyFormSectionEditable({
      principal: office,
      section,
      part: { isOfficeOnly: false },
      executor: executorWithDepartment("CREWING"),
    })).resolves.toBeUndefined();
    await expect(assertCompanyFormSectionEditable({
      principal: office,
      section,
      part: { isOfficeOnly: false },
      executor: executorWithDepartment(null),
    })).rejects.toBeInstanceOf(CompanyFormPermissionError);
  });

  it("allows only a trusted linked seafarer for seafarer sections", async () => {
    const section = {
      responsibleMode: "seafarer",
      responsibleRoleUuid: null,
      responsibleDepartment: null,
    };
    await expect(assertCompanyFormSectionEditable({
      principal: linkedSeafarer,
      section,
      part: { isOfficeOnly: false },
      executor: executorWithDepartment(null),
    })).resolves.toBeUndefined();
    await expect(assertCompanyFormSectionEditable({
      principal: office,
      section,
      part: { isOfficeOnly: false },
      executor: executorWithDepartment(null),
    })).rejects.toBeInstanceOf(CompanyFormPermissionError);
  });

  it("allows office and subject-scoped vessel actors for not-applicable sections, but honors office-only parts", async () => {
    const section = {
      responsibleMode: "not_applicable",
      responsibleRoleUuid: null,
      responsibleDepartment: null,
    };
    await expect(assertCompanyFormSectionEditable({
      principal: office,
      section,
      part: { isOfficeOnly: false },
      executor: executorWithDepartment(null),
    })).resolves.toBeUndefined();
    await expect(assertCompanyFormSectionEditable({
      principal: vessel,
      section,
      part: { isOfficeOnly: false },
      executor: executorWithDepartment(null),
    })).resolves.toBeUndefined();
    await expect(assertCompanyFormSectionEditable({
      principal: vessel,
      section,
      part: { isOfficeOnly: true },
      executor: executorWithDepartment(null),
    })).rejects.toBeInstanceOf(CompanyFormPermissionError);
    await expect(assertCompanyFormSectionEditable({
      principal: linkedSeafarer,
      section,
      part: { isOfficeOnly: false },
      executor: executorWithDepartment(null),
    })).rejects.toBeInstanceOf(CompanyFormPermissionError);
  });
});