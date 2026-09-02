import { describe, expect, it } from "vitest";
import adminRouter from "@server/v2/admin/routes";
import type {
  PermissionAction,
  PermissionMiddleware,
} from "@server/middleware/requirePermission";

type GuardedRoute = {
  key: string;
  menuName: string;
  action: PermissionAction;
};

const routeKey = (method: string, path: string) =>
  `${method.toUpperCase()} ${path}`;

const EXPECTED_FORMS_GUARDS: GuardedRoute[] = [
  { key: "GET /forms", menuName: "Forms", action: "view" },
  { key: "GET /forms/:id", menuName: "Forms", action: "view" },
  { key: "GET /forms/:id/parts", menuName: "Forms", action: "view" },
  { key: "POST /forms", menuName: "Forms", action: "create" },
  { key: "PUT /forms/:id", menuName: "Forms", action: "edit" },
  { key: "PATCH /forms/:id", menuName: "Forms", action: "edit" },
  { key: "DELETE /forms/:id", menuName: "Forms", action: "delete" },
  {
    key: "POST /forms/cleanup-duplicates",
    menuName: "Forms",
    action: "delete",
  },
  { key: "GET /forms/:id/versions", menuName: "Forms", action: "view" },
  {
    key: "POST /forms/:id/versions",
    menuName: "Forms",
    action: "create",
  },
  {
    key: "GET /form-versions/:fvUuid/parts/:partUuid/structure",
    menuName: "Forms",
    action: "view",
  },
  {
    key: "PUT /form-versions/:fvUuid/parts/:partUuid/structure",
    menuName: "Forms",
    action: "edit",
  },
  {
    key: "PUT /form-versions/:fvUuid/structures",
    menuName: "Forms",
    action: "edit",
  },
  { key: "GET /form-versions/:id", menuName: "Forms", action: "view" },
  { key: "PUT /form-versions/:id", menuName: "Forms", action: "edit" },
  {
    key: "DELETE /form-versions/:id",
    menuName: "Forms",
    action: "delete",
  },
  {
    key: "POST /form-versions/:id/release",
    menuName: "Forms",
    action: "edit",
  },
  { key: "GET /rank-groups", menuName: "Forms", action: "view" },
  {
    key: "GET /rank-groups/check-assignment",
    menuName: "Forms",
    action: "view",
  },
  {
    key: "GET /rank-groups/form/:formId",
    menuName: "Forms",
    action: "view",
  },
  {
    key: "GET /rank-groups/form/:formId/rank-conflicts",
    menuName: "Forms",
    action: "view",
  },
  { key: "GET /rank-groups/:id", menuName: "Forms", action: "view" },
  {
    key: "GET /rank-groups/:id/copy-sources",
    menuName: "Forms",
    action: "view",
  },
  { key: "POST /rank-groups", menuName: "Forms", action: "create" },
  {
    key: "POST /rank-groups/:id/copy-configuration",
    menuName: "Forms",
    action: "create",
  },
  { key: "PUT /rank-groups/:id", menuName: "Forms", action: "edit" },
  {
    key: "PUT /rank-groups/:id/configuration",
    menuName: "Forms",
    action: "edit",
  },
  {
    key: "POST /rank-groups/:id/release-configuration",
    menuName: "Forms",
    action: "edit",
  },
  {
    key: "POST /rank-groups/:id/archive",
    menuName: "Forms",
    action: "delete",
  },
  {
    key: "POST /rank-groups/:id/unarchive",
    menuName: "Forms",
    action: "edit",
  },
  {
    key: "DELETE /rank-groups/:id",
    menuName: "Forms",
    action: "delete",
  },
];

function getPermissionRequirement(handler: unknown) {
  return (handler as PermissionMiddleware).permissionRequirement;
}

function guardedRoutes(): GuardedRoute[] {
  const routes: GuardedRoute[] = [];
  for (const layer of (adminRouter as any).stack as any[]) {
    if (!layer.route) continue;

    const requirement = layer.route.stack
      .map((routeLayer: { handle: unknown }) =>
        getPermissionRequirement(routeLayer.handle),
      )
      .find(Boolean);
    if (!requirement) continue;

    for (const method of Object.keys(layer.route.methods)) {
      if (method === "_all" || method === "head") continue;
      routes.push({
        key: routeKey(method, layer.route.path),
        menuName: requirement.menuName,
        action: requirement.action,
      });
    }
  }
  return routes;
}

function routeHasPermissionGuard(path: string, method: string): boolean {
  const targetKey = routeKey(method, path);
  return guardedRoutes().some((route) => route.key === targetKey);
}

function sortRoutes(routes: GuardedRoute[]): GuardedRoute[] {
  return [...routes].sort((left, right) => left.key.localeCompare(right.key));
}

describe("Forms Configuration permission route inventory", () => {
  it("applies exactly the approved explicit route-to-action table", () => {
    expect(sortRoutes(guardedRoutes())).toEqual(sortRoutes(EXPECTED_FORMS_GUARDS));
  });

  it("keeps ordinary appraisal and promotion configuration reads unguarded", () => {
    expect(
      routeHasPermissionGuard("/forms/for-rank/:rankLabel", "GET"),
    ).toBe(false);
    expect(
      routeHasPermissionGuard(
        "/form-versions/:versionId/configuration",
        "GET",
      ),
    ).toBe(false);
  });

  it("keeps every Access Control route unguarded for grant recovery", () => {
    for (const layer of (adminRouter as any).stack as any[]) {
      if (!layer.route) continue;
      const path = layer.route.path as string;
      if (!path.startsWith("/access-control/")) continue;

      for (const method of Object.keys(layer.route.methods)) {
        if (method === "_all" || method === "head") continue;
        expect(routeHasPermissionGuard(path, method)).toBe(false);
      }
    }
  });
});