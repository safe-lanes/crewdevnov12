import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const { getMyPermissionsMock, resolveRequestRoleMock } = vi.hoisted(() => ({
  getMyPermissionsMock: vi.fn(),
  resolveRequestRoleMock: vi.fn(),
}));

vi.mock("@server/v2/admin/services", () => ({
  accessControlService: {
    getMyPermissions: getMyPermissionsMock,
  },
}));

vi.mock("@server/v2/auth/roleResolutionService", () => ({
  resolveRequestRole: resolveRequestRoleMock,
}));

import { accessControlController } from "@server/v2/admin/controllers/accessControlController";

beforeEach(() => {
  vi.clearAllMocks();
});

function responseSpy(): {
  response: Response;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
} {
  const status = vi.fn();
  const json = vi.fn();
  status.mockReturnValue({ json });
  return {
    response: { status, json } as unknown as Response,
    status,
    json,
  };
}

describe("/my-permissions", () => {
  it("uses only the server-resolved role despite browser-supplied role query parameters", async () => {
    resolveRequestRoleMock.mockResolvedValue({
      ok: true,
      role: {
        roleId: "resolved-forms-role",
        roleName: "Forms Editor",
        masterUserId: 501,
      },
    });
    getMyPermissionsMock.mockResolvedValue({
      roleId: "resolved-forms-role",
      roleName: "Forms Editor",
      permissions: [],
    });
    const { response, json } = responseSpy();
    const req = {
      query: {
        roleId: "browser-supplied-admin-role",
        roleName: "Super Admin",
      },
    } as unknown as Request;

    await accessControlController.getMyPermissions(req, response);

    expect(getMyPermissionsMock).toHaveBeenCalledWith(
      "resolved-forms-role",
      "Forms Editor",
    );
    expect(json).toHaveBeenCalledWith({
      roleId: "resolved-forms-role",
      roleName: "Forms Editor",
      permissions: [],
    });
  });

  it("returns a generic 403 without querying permissions when role resolution fails", async () => {
    resolveRequestRoleMock.mockResolvedValue({
      ok: false,
      reason: "user_not_found",
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { response, status, json } = responseSpy();

    await accessControlController.getMyPermissions(
      { query: {} } as unknown as Request,
      response,
    );

    expect(getMyPermissionsMock).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      error: "forbidden",
      message: "Unable to resolve permissions for this user.",
    });
    error.mockRestore();
  });
});