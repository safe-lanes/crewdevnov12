import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

const { getDbMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
}));

vi.mock("@server/v2/db", () => ({
  getDb: getDbMock,
}));

import { requirePermission } from "@server/middleware/requirePermission";
import { resolveRequestRole } from "@server/v2/auth/roleResolutionService";

type QueryRows = Array<Record<string, unknown>>;

function queryFor(rows: QueryRows) {
  const query = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    then: (
      resolve: (value: QueryRows) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(rows).then(resolve, reject),
  };
  query.from.mockReturnValue(query);
  query.where.mockReturnValue(query);
  query.limit.mockResolvedValue(rows);
  return query;
}

function configureDb(...results: QueryRows[]) {
  const select = vi.fn();
  for (const rows of results) {
    select.mockReturnValueOnce(queryFor(rows));
  }
  getDbMock.mockReturnValue({ select });
  return select;
}

function requestFor(
  user: { id: number; userType: string } | undefined,
  query: Record<string, string> = {},
): Request {
  return { user, query } as unknown as Request;
}

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

describe("server-trusted role resolution", () => {
  it("resolves a normalized master_users role once from the JWT actor", async () => {
    const select = configureDb(
      [{ id: 301, userType: " Office ", role: " Forms Manager " }],
      [{ roleId: "forms-manager-ruid", roleName: "Forms Manager" }],
    );
    const req = requestFor({ id: 301, userType: "office" });

    await expect(resolveRequestRole(req)).resolves.toEqual({
      ok: true,
      role: {
        roleId: "forms-manager-ruid",
        roleName: "Forms Manager",
        masterUserId: 301,
      },
    });
    await expect(resolveRequestRole(req)).resolves.toMatchObject({ ok: true });
    expect(select).toHaveBeenCalledTimes(2);
  });

  it("fails loudly when the signed userType does not match master_users", async () => {
    configureDb([{ id: 302, userType: "Office", role: "Forms Manager" }]);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(
      resolveRequestRole(requestFor({ id: 302, userType: "Ship" })),
    ).resolves.toEqual({ ok: false, reason: "identity_mismatch" });
    expect(error).toHaveBeenCalledWith(
      "[RoleResolution] identity_mismatch",
      expect.objectContaining({ masterUserId: 302 }),
    );
    error.mockRestore();
  });

  it("fails closed when the signed JWT omits userType", async () => {
    configureDb([{ id: 307, userType: "Office", role: "Forms Manager" }]);

    await expect(
      resolveRequestRole(
        requestFor({ id: 307 } as { id: number; userType: string }),
      ),
    ).resolves.toEqual({ ok: false, reason: "identity_mismatch" });
  });

  it("fails closed when the signed JWT userType is blank", async () => {
    configureDb([{ id: 308, userType: "Office", role: "Forms Manager" }]);

    await expect(
      resolveRequestRole(requestFor({ id: 308, userType: "   " })),
    ).resolves.toEqual({ ok: false, reason: "identity_mismatch" });
  });

  it.each([null, "   "])(
    "fails closed when master_users userType is blank (%j)",
    async (masterUserType) => {
      configureDb([
        { id: 309, userType: masterUserType, role: "Forms Manager" },
      ]);

      await expect(
        resolveRequestRole(requestFor({ id: 309, userType: "Office" })),
      ).resolves.toEqual({ ok: false, reason: "identity_mismatch" });
    },
  );

  it("fails closed for an authenticated JWT id with no master user", async () => {
    configureDb([]);

    await expect(
      resolveRequestRole(requestFor({ id: 303, userType: "Office" })),
    ).resolves.toEqual({ ok: false, reason: "user_not_found" });
  });

  it("fails closed when normalized role text matches more than one Access Control role", async () => {
    configureDb(
      [{ id: 304, userType: "Office", role: "Forms Manager" }],
      [
        { roleId: "role-a", roleName: "Forms Manager" },
        { roleId: "role-b", roleName: " forms manager " },
      ],
    );
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(
      resolveRequestRole(requestFor({ id: 304, userType: "Office" })),
    ).resolves.toEqual({ ok: false, reason: "role_ambiguous" });
    expect(error).toHaveBeenCalledWith(
      "[RoleResolution] role_ambiguous",
      expect.objectContaining({ masterUserId: 304 }),
    );
    error.mockRestore();
  });

  it("fails closed when the matching Access Control role is inactive", async () => {
    configureDb(
      [{ id: 306, userType: "Office", role: "Forms Manager" }],
      [],
    );

    await expect(
      resolveRequestRole(requestFor({ id: 306, userType: "Office" })),
    ).resolves.toEqual({ ok: false, reason: "role_not_matched" });
  });

  it("uses the current tenant database for each request without cross-request role caching", async () => {
    const tenantASelect = vi.fn()
      .mockReturnValueOnce(
        queryFor([{ id: 305, userType: "Office", role: "Tenant A Forms" }]),
      )
      .mockReturnValueOnce(
        queryFor([{ roleId: "tenant-a-role", roleName: "Tenant A Forms" }]),
      );
    const tenantBSelect = vi.fn()
      .mockReturnValueOnce(
        queryFor([{ id: 305, userType: "Office", role: "Tenant B Forms" }]),
      )
      .mockReturnValueOnce(
        queryFor([{ roleId: "tenant-b-role", roleName: "Tenant B Forms" }]),
      );

    getDbMock
      .mockReturnValueOnce({ select: tenantASelect })
      .mockReturnValueOnce({ select: tenantBSelect });

    await expect(
      resolveRequestRole(requestFor({ id: 305, userType: "Office" })),
    ).resolves.toMatchObject({
      ok: true,
      role: { roleId: "tenant-a-role" },
    });
    await expect(
      resolveRequestRole(requestFor({ id: 305, userType: "Office" })),
    ).resolves.toMatchObject({
      ok: true,
      role: { roleId: "tenant-b-role" },
    });
  });
});

describe("requirePermission", () => {
  it("denies a role without the explicitly required action", async () => {
    configureDb(
      [{ id: 401, userType: "Office", role: "Forms Manager" }],
      [{ roleId: "forms-manager-ruid", roleName: "Forms Manager" }],
      [{ menuId: "forms-menu-uuid" }],
      [{ canview: true, cancreate: true, canedit: false, candelete: false }],
    );
    const { response, status, json } = responseSpy();
    const next = vi.fn() as NextFunction;

    await requirePermission("Forms", "edit")(
      requestFor({ id: 401, userType: "Office" }),
      response,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      error: "forbidden",
      message: "You do not have permission to perform this action.",
    });
  });

  it("fails closed when no active menu record can be resolved", async () => {
    configureDb(
      [{ id: 403, userType: "Office", role: "Forms Manager" }],
      [{ roleId: "forms-manager-ruid", roleName: "Forms Manager" }],
      [],
    );
    const { response, status } = responseSpy();
    const next = vi.fn() as NextFunction;
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await requirePermission("Forms", "view")(
      requestFor({ id: 403, userType: "Office" }),
      response,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
    error.mockRestore();
  });

  it("fails closed when the role has no grant for the active menu", async () => {
    configureDb(
      [{ id: 404, userType: "Office", role: "Forms Manager" }],
      [{ roleId: "forms-manager-ruid", roleName: "Forms Manager" }],
      [{ menuId: "forms-menu-uuid" }],
      [],
    );
    const { response, status } = responseSpy();
    const next = vi.fn() as NextFunction;
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await requirePermission("Forms", "view")(
      requestFor({ id: 404, userType: "Office" }),
      response,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
    error.mockRestore();
  });

  it("allows the requested action and ignores browser role query parameters", async () => {
    configureDb(
      [{ id: 402, userType: "Office", role: "Forms Manager" }],
      [{ roleId: "forms-manager-ruid", roleName: "Forms Manager" }],
      [{ menuId: "forms-menu-uuid" }],
      [{ canview: true, cancreate: false, canedit: true, candelete: false }],
    );
    const { response, status } = responseSpy();
    const next = vi.fn() as NextFunction;

    await requirePermission("Forms", "edit")(
      requestFor(
        { id: 402, userType: "Office" },
        { roleId: "browser-supplied-admin-role", roleName: "Super Admin" },
      ),
      response,
      next,
    );

    expect(next).toHaveBeenCalledOnce();
    expect(status).not.toHaveBeenCalled();
  });
});