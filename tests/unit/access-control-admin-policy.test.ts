import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

const { resolveRequestRoleMock } = vi.hoisted(() => ({
  resolveRequestRoleMock: vi.fn(),
}));

vi.mock("@server/v2/auth/roleResolutionService", () => ({
  resolveRequestRole: resolveRequestRoleMock,
}));

import { requireTrustedAccessControlAdmin } from "@server/middleware/requireTrustedAccessControlAdmin";

function responseSpy(): {
  response: Response;
  status: ReturnType<typeof vi.fn>;
} {
  const status = vi.fn();
  status.mockReturnValue({ json: vi.fn() });
  return { response: { status } as unknown as Response, status };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("trusted Access Control administrator policy", () => {
  it.each(["Admin", "Super Admin", " Sail Admin "])(
    "allows the parent-assigned trusted role %j",
    async (roleName) => {
      resolveRequestRoleMock.mockResolvedValue({
        ok: true,
        role: { roleId: "trusted-role", roleName, masterUserId: 601 },
      });
      const { response, status } = responseSpy();
      const next = vi.fn() as NextFunction;

      await requireTrustedAccessControlAdmin()(
        {} as Request,
        response,
        next,
      );

      expect(next).toHaveBeenCalledOnce();
      expect(status).not.toHaveBeenCalled();
    },
  );

  it("denies a low-privilege role even if its editable grant rows would say yes", async () => {
    resolveRequestRoleMock.mockResolvedValue({
      ok: true,
      role: { roleId: "low-role", roleName: "Crewing Manager", masterUserId: 602 },
    });
    const { response, status } = responseSpy();
    const next = vi.fn() as NextFunction;

    await requireTrustedAccessControlAdmin()({} as Request, response, next);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
  });

  it("denies unresolved or unauthenticated actors", async () => {
    resolveRequestRoleMock.mockResolvedValue({
      ok: false,
      reason: "no_authenticated_user",
    });
    const { response, status } = responseSpy();
    const next = vi.fn() as NextFunction;

    await requireTrustedAccessControlAdmin()({} as Request, response, next);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
  });
});